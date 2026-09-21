import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  generateAgentRules,
  normalizeTargets,
  AGENT_TARGETS,
  AgentTargetError
} from '../../lib/agent-generator.js'

const silentLogger = { log () {}, warn () {}, error () {} }
const mkTmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'coralite-agent-'))

describe('normalizeTargets', () => {
  test('defaults to all targets', () => {
    assert.deepEqual(normalizeTargets(undefined), Object.keys(AGENT_TARGETS))
    assert.deepEqual(normalizeTargets('all'), Object.keys(AGENT_TARGETS))
    assert.deepEqual(normalizeTargets(''), Object.keys(AGENT_TARGETS))
  })

  test('parses comma-separated strings', () => {
    assert.deepEqual(normalizeTargets('cursor,claude'), ['cursor', 'claude'])
  })

  test('accepts arrays and de-duplicates', () => {
    assert.deepEqual(normalizeTargets(['cursor', 'cursor', 'claude']), ['cursor', 'claude'])
  })

  test('rejects unknown targets', () => {
    assert.throws(() => normalizeTargets('vscode'), AgentTargetError)
  })
})

describe('generateAgentRules', () => {
  let root
  before(() => { root = mkTmp() })
  after(() => { fs.rmSync(root, { recursive: true, force: true }) })

  test('writes all four files by default', () => {
    const cwd = path.join(root, 'all')
    fs.mkdirSync(cwd, { recursive: true })

    const result = generateAgentRules({ cwd, logger: silentLogger })

    assert.deepEqual(result.written.sort(), [
      path.join('.cursor', 'rules', 'coralite.mdc'),
      path.join('.github', 'copilot-instructions.md'),
      'AGENTS.md',
      'CLAUDE.md'
    ].sort())

    for (const dest of result.written) {
      assert.ok(fs.existsSync(path.join(cwd, dest)), `${dest} should exist`)
    }
  })

  test('creates parent directories recursively', () => {
    const cwd = path.join(root, 'nested')
    fs.mkdirSync(cwd, { recursive: true })

    generateAgentRules({ cwd, target: 'cursor', logger: silentLogger })

    assert.ok(fs.existsSync(path.join(cwd, '.cursor', 'rules', 'coralite.mdc')))
  })

  test('--target=cursor only writes the mdc file', () => {
    const cwd = path.join(root, 'cursor-only')
    fs.mkdirSync(cwd, { recursive: true })

    const result = generateAgentRules({ cwd, target: 'cursor', logger: silentLogger })

    assert.deepEqual(result.written, [path.join('.cursor', 'rules', 'coralite.mdc')])
    assert.equal(fs.existsSync(path.join(cwd, 'AGENTS.md')), false)
    assert.equal(fs.existsSync(path.join(cwd, 'CLAUDE.md')), false)
    assert.equal(fs.existsSync(path.join(cwd, '.github')), false)
  })

  test('skips existing files without --force', () => {
    const cwd = path.join(root, 'collide')
    fs.mkdirSync(cwd, { recursive: true })
    fs.writeFileSync(path.join(cwd, 'AGENTS.md'), 'USER CONTENT', 'utf8')

    const result = generateAgentRules({ cwd, target: 'agents-md', logger: silentLogger })

    assert.deepEqual(result.written, [])
    assert.deepEqual(result.skipped, ['AGENTS.md'])
    assert.equal(fs.readFileSync(path.join(cwd, 'AGENTS.md'), 'utf8'), 'USER CONTENT')
  })

  test('--force overwrites existing files', () => {
    const cwd = path.join(root, 'force')
    fs.mkdirSync(cwd, { recursive: true })
    fs.writeFileSync(path.join(cwd, 'AGENTS.md'), 'USER CONTENT', 'utf8')

    const result = generateAgentRules({
      cwd, target: 'agents-md', force: true, logger: silentLogger
    })

    assert.deepEqual(result.written, ['AGENTS.md'])
    const content = fs.readFileSync(path.join(cwd, 'AGENTS.md'), 'utf8')
    assert.notEqual(content, 'USER CONTENT')
    assert.match(content, /Coralite/)
  })

  test('interpolates {{ version }} from package.json', () => {
    const cwd = path.join(root, 'interp')
    fs.mkdirSync(cwd, { recursive: true })

    generateAgentRules({ cwd, target: 'agents-md', logger: silentLogger })

    const content = fs.readFileSync(path.join(cwd, 'AGENTS.md'), 'utf8')
    assert.equal(/\{\{\s*version\s*\}\}/.test(content), false)
  })

  test('honours custom vars', () => {
    const cwd = path.join(root, 'vars')
    fs.mkdirSync(cwd, { recursive: true })

    generateAgentRules({
      cwd, target: 'agents-md', vars: { version: '9.9.9-test' }, logger: silentLogger
    })

    assert.match(fs.readFileSync(path.join(cwd, 'AGENTS.md'), 'utf8'), /9\.9\.9-test/)
  })

  test('mdc template ships valid Cursor frontmatter', () => {
    const cwd = path.join(root, 'frontmatter')
    fs.mkdirSync(cwd, { recursive: true })

    generateAgentRules({ cwd, target: 'cursor', logger: silentLogger })

    const content = fs.readFileSync(
      path.join(cwd, '.cursor', 'rules', 'coralite.mdc'), 'utf8'
    )
    assert.match(content, /^---\n/)
    assert.match(content, /description:/)
    assert.match(content, /globs:/)
    assert.match(content, /alwaysApply:\s*false/)
  })

  test('is idempotent when run twice with --force', () => {
    const cwd = path.join(root, 'idempotent')
    fs.mkdirSync(cwd, { recursive: true })

    generateAgentRules({ cwd, force: true, logger: silentLogger })
    const first = fs.readFileSync(path.join(cwd, 'AGENTS.md'), 'utf8')
    generateAgentRules({ cwd, force: true, logger: silentLogger })
    const second = fs.readFileSync(path.join(cwd, 'AGENTS.md'), 'utf8')

    assert.equal(first, second)
  })
})
