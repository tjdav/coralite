import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { execSync } from 'node:child_process'
import {
  parseTagRef,
  determineTag,
  verifyPackageFiles
} from '../bin/publish.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '../../..')

describe('coralite-publish utility functions', () => {
  describe('parseTagRef', () => {
    it('parses standard tag references accurately', () => {
      assert.deepEqual(parseTagRef('coralite-v0.48.0-rc.0'), {
        packageName: 'coralite',
        version: '0.48.0-rc.0'
      })

      assert.deepEqual(parseTagRef('refs/tags/coralite-scripts-v1.2.3'), {
        packageName: 'coralite-scripts',
        version: '1.2.3'
      })

      assert.deepEqual(parseTagRef('create-coralite-v0.1.0-beta.2'), {
        packageName: 'create-coralite',
        version: '0.1.0-beta.2'
      })
    })

    it('returns null for null or invalid tag formats', () => {
      assert.equal(parseTagRef(null), null)
      assert.equal(parseTagRef(''), null)
      assert.equal(parseTagRef('v1.0.0'), null)
      assert.equal(parseTagRef('invalid-tag-format'), null)
    })
  })

  describe('determineTag', () => {
    it('returns prerelease identifier when present', () => {
      assert.equal(determineTag('0.48.0-rc.0'), 'rc')
      assert.equal(determineTag('0.48.0-beta.1'), 'beta')
      assert.equal(determineTag('1.0.0-alpha.5'), 'alpha')
    })

    it('returns "latest" for stable release versions', () => {
      assert.equal(determineTag('0.47.1'), 'latest')
      assert.equal(determineTag('1.0.0'), 'latest')
    })

    it('respects tag override if provided', () => {
      assert.equal(determineTag('0.48.0-rc.0', 'next'), 'next')
      assert.equal(determineTag('1.0.0', 'canary'), 'canary')
    })
  })

  describe('verifyPackageFiles', () => {
    const tmpDir = resolve(__dirname, '.tmp-pkg-test')

    it('passes when all declared package files exist', () => {
      if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true })
      writeFileSync(resolve(tmpDir, 'dist.txt'), 'content')
      mkdirSync(resolve(tmpDir, 'bin'), { recursive: true })

      assert.equal(verifyPackageFiles(tmpDir, ['dist.txt', 'bin']), true)

      rmSync(tmpDir, { recursive: true, force: true })
    })

    it('throws when declared package files are missing', () => {
      if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true })

      assert.throws(() => {
        verifyPackageFiles(tmpDir, ['nonexistent-file.js'])
      }, /Pre-flight assertion failed: Missing expected package files\/directories: nonexistent-file.js/)

      rmSync(tmpDir, { recursive: true, force: true })
    })

    it('passes cleanly for empty or non-array file lists', () => {
      assert.equal(verifyPackageFiles(tmpDir, null), true)
      assert.equal(verifyPackageFiles(tmpDir, []), true)
    })
  })

  describe('CLI Dry-Run Execution & Asset Lifecycle', () => {
    it('executes dry-run for coralite package, copying llms.txt and cleaning up after', () => {
      const output = execSync(
        'node --experimental-vm-modules packages/coralite-release/bin/publish.js --package coralite --dry-run --skip-build',
        { cwd: rootDir, encoding: 'utf8' }
      )

      assert.match(output, /✔ Copied website\/public\/llms.txt/)
      assert.match(output, /\[DRY RUN\] Would publish coralite@/)
      assert.match(output, /✔ Cleaned up temporary asset/)

      const targetLlms = resolve(rootDir, 'packages/coralite/llms.txt')
      assert.equal(existsSync(targetLlms), false, 'llms.txt should be cleaned up after dry-run completion')
    })

    it('executes dry-run with tag-ref for prerelease tag resolution', () => {
      const output = execSync(
        'node --experimental-vm-modules packages/coralite-release/bin/publish.js --tag-ref coralite-scripts-v1.0.0-rc.3 --dry-run --registry codeberg --skip-build',
        { cwd: rootDir, encoding: 'utf8' }
      )

      assert.match(output, /\[DRY RUN\] Would publish coralite-scripts@1.0.0-rc.3 to codeberg with tag "rc"/)
    })

    it('fails with clear error message when auth token is missing for live publish', () => {
      assert.throws(() => {
        execSync(
          'node --experimental-vm-modules packages/coralite-release/bin/publish.js --package create-coralite --skip-build',
          {
            cwd: rootDir,
            encoding: 'utf8',
            env: {
              ...process.env,
              NPM_TOKEN: '',
              NODE_AUTH_TOKEN: ''
            },
            stdio: ['pipe', 'pipe', 'pipe']
          }
        )
      }, /NPM_TOKEN or NODE_AUTH_TOKEN environment variable is required/)
    })
  })
})
