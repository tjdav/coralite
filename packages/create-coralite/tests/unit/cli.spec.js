import { test, describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const binPath = path.resolve(fileURLToPath(import.meta.url), '../../../bin/index.js')

function runCLI (args, options = {}) {
  return new Promise((resolve) => {
    const child = execFile(
      process.execPath,
      [binPath, ...args],
      {
        cwd: options.cwd || process.cwd(),
        env: { ...process.env, ...options.env }
      },
      (error, stdout, stderr) => {
        resolve({
          code: error ? (error.code ?? 1) : 0,
          error,
          stdout,
          stderr
        })
      }
    )

    if (options.stdin !== undefined) {
      child.stdin.write(options.stdin)
      child.stdin.end()
    } else {
      child.stdin.end()
    }
  })
}

describe('CLI integration tests', () => {
  let tmpDir

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'create-coralite-cli-test-'))
  })

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  test('scaffolding into non-existent directory succeeds', async () => {
    const targetDir = path.join(tmpDir, 'new-project')
    const res = await runCLI(['-o', targetDir, '-t', 'css'])

    assert.equal(res.code, 0)
    assert.equal(res.stdout.includes('is not empty. Please choose how to proceed:'), false)
    assert.equal(fs.existsSync(path.join(targetDir, 'package.json')), true)
  })

  test('scaffolding into existing empty directory succeeds without prompting', async () => {
    const targetDir = path.join(tmpDir, 'empty-dir')
    fs.mkdirSync(targetDir, { recursive: true })

    const res = await runCLI(['-o', targetDir, '-t', 'css'])

    assert.equal(res.code, 0)
    assert.equal(res.stdout.includes('is not empty. Please choose how to proceed:'), false)
    assert.equal(fs.existsSync(path.join(targetDir, 'package.json')), true)
  })

  test('scaffolding into existing directory containing only .git succeeds without prompting', async () => {
    const targetDir = path.join(tmpDir, 'git-dir')
    fs.mkdirSync(path.join(targetDir, '.git'), { recursive: true })

    const res = await runCLI(['-o', targetDir, '-t', 'css'])

    assert.equal(res.code, 0)
    assert.equal(res.stdout.includes('is not empty. Please choose how to proceed:'), false)
    assert.equal(fs.existsSync(path.join(targetDir, '.git')), true)
    assert.equal(fs.existsSync(path.join(targetDir, 'package.json')), true)
  })

  test('scaffolding into non-empty directory prompts user and preserves files when cancelled or non-interactive', async () => {
    const targetDir = path.join(tmpDir, 'non-empty-dir')
    fs.mkdirSync(targetDir, { recursive: true })
    const userFilePath = path.join(targetDir, 'user-code.js')
    fs.writeFileSync(userFilePath, 'console.log("preserve me")')

    const res = await runCLI(['-o', targetDir, '-t', 'css'])

    assert.equal(res.stdout.includes('is not empty. Please choose how to proceed:'), true)
    assert.equal(fs.existsSync(userFilePath), true)
    assert.equal(fs.readFileSync(userFilePath, 'utf-8'), 'console.log("preserve me")')
  })

  test('target directory with whitespace and trailing slashes is formatted correctly', async () => {
    const rawTarget = '  custom-dir/  '
    const res = await runCLI(['-o', rawTarget, '-t', 'css'], { cwd: tmpDir })

    const expectedDir = path.join(tmpDir, 'custom-dir')
    assert.equal(res.code, 0)
    assert.equal(res.stdout.includes('is not empty. Please choose how to proceed:'), false)
    assert.equal(fs.existsSync(path.join(expectedDir, 'package.json')), true)
  })
})
