import { test, describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {
  formatTargetDir,
  isValidPackageName,
  toValidPackageName,
  isEmpty,
  emptyDir,
  extractPackageInfoFromUserAgent,
  parseSemver,
  compareSemver,
  satisfiesEngine,
  checkNodeVersion
} from '../../lib/utils.js'

describe('utils unit tests', () => {
  let tmpDir

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'create-coralite-utils-test-'))
  })

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, {
        recursive: true,
        force: true
      })
    }
  })

  describe('formatTargetDir', () => {
    test('trims leading/trailing whitespace and trailing slashes', () => {
      assert.equal(formatTargetDir('  foo/bar///  '), 'foo/bar')
      assert.equal(formatTargetDir('my-project/'), 'my-project')
      assert.equal(formatTargetDir('   '), '')
    })
  })

  describe('isValidPackageName', () => {
    test('validates valid package names', () => {
      assert.equal(isValidPackageName('my-app'), true)
      assert.equal(isValidPackageName('@scope/my-app'), true)
      assert.equal(isValidPackageName('coralite-123'), true)
    })

    test('rejects invalid package names', () => {
      assert.equal(isValidPackageName('My-App'), false)
      assert.equal(isValidPackageName('_my-app'), false)
      assert.equal(isValidPackageName('.my-app'), false)
      assert.equal(isValidPackageName('my app'), false)
    })
  })

  describe('toValidPackageName', () => {
    test('sanitizes strings into valid npm package names', () => {
      assert.equal(toValidPackageName(' My App '), 'my-app')
      assert.equal(toValidPackageName('_Some--App!!'), 'some--app-')
      assert.equal(toValidPackageName('.coralite_project'), 'coralite-project')
    })
  })

  describe('isEmpty', () => {
    test('returns true for an empty directory', () => {
      const dir = path.join(tmpDir, 'empty')
      fs.mkdirSync(dir)
      assert.equal(isEmpty(dir), true)
    })

    test('returns true for a directory containing only .git', () => {
      const dir = path.join(tmpDir, 'git-only')
      fs.mkdirSync(dir)
      fs.mkdirSync(path.join(dir, '.git'))
      assert.equal(isEmpty(dir), true)
    })

    test('returns false for a directory containing user files', () => {
      const dir = path.join(tmpDir, 'non-empty')
      fs.mkdirSync(dir)
      fs.writeFileSync(path.join(dir, 'index.js'), 'console.log("hello")')
      assert.equal(isEmpty(dir), false)
    })

    test('returns false for a directory containing .git and user files', () => {
      const dir = path.join(tmpDir, 'git-and-file')
      fs.mkdirSync(dir)
      fs.mkdirSync(path.join(dir, '.git'))
      fs.writeFileSync(path.join(dir, 'README.md'), '# Title')
      assert.equal(isEmpty(dir), false)
    })

    test('returns true for a non-existent directory (catch fallback)', () => {
      const dir = path.join(tmpDir, 'non-existent')
      assert.equal(isEmpty(dir), true)
    })
  })

  describe('emptyDir', () => {
    test('removes all files and subdirectories except .git', () => {
      const dir = path.join(tmpDir, 'target')
      fs.mkdirSync(dir)
      fs.mkdirSync(path.join(dir, '.git'))
      fs.mkdirSync(path.join(dir, 'subfolder'))
      fs.writeFileSync(path.join(dir, 'file.txt'), 'data')
      fs.writeFileSync(path.join(dir, 'subfolder', 'file2.txt'), 'data2')

      emptyDir(dir)

      assert.equal(fs.existsSync(path.join(dir, '.git')), true)
      assert.equal(fs.existsSync(path.join(dir, 'file.txt')), false)
      assert.equal(fs.existsSync(path.join(dir, 'subfolder')), false)
    })

    test('handles non-existent directory gracefully', () => {
      const dir = path.join(tmpDir, 'does-not-exist')
      assert.doesNotThrow(() => emptyDir(dir))
    })
  })

  describe('extractPackageInfoFromUserAgent', () => {
    test('extracts package manager name and version', () => {
      const info = extractPackageInfoFromUserAgent('pnpm/9.0.0 npm/? node/v20.19.0 linux x64')
      assert.deepEqual(info, {
        name: 'pnpm',
        version: '9.0.0'
      })
    })

    test('returns undefined for empty or missing user agent', () => {
      assert.equal(extractPackageInfoFromUserAgent(''), undefined)
      assert.equal(extractPackageInfoFromUserAgent(undefined), undefined)
    })
  })

  describe('semver engine utilities', () => {
    test('parseSemver parses versions accurately', () => {
      assert.deepEqual(parseSemver('22.22.2'), [22, 22, 2])
      assert.deepEqual(parseSemver('v22.22.2-rc.1'), [22, 22, 2])
      assert.deepEqual(parseSemver('18.0.0'), [18, 0, 0])
    })

    test('compareSemver compares version tuples correctly', () => {
      assert.equal(compareSemver([22, 22, 2], [22, 22, 2]), 0)
      assert.equal(compareSemver([22, 22, 1], [22, 22, 2]), -1)
      assert.equal(compareSemver([22, 22, 3], [22, 22, 2]), 1)
      assert.equal(compareSemver([20, 0, 0], [22, 22, 2]), -1)
    })

    test('satisfiesEngine evaluates semver engine ranges', () => {
      assert.equal(satisfiesEngine('v22.22.2', '>=22.22.2'), true)
      assert.equal(satisfiesEngine('v22.22.3', '>=22.22.2'), true)
      assert.equal(satisfiesEngine('v22.22.1', '>=22.22.2'), false)
      assert.equal(satisfiesEngine('v18.20.0', '>=22.22.2'), false)
    })

    test('checkNodeVersion passes on satisfied versions and exits on unsatisfied ones', () => {
      assert.doesNotThrow(() => checkNodeVersion('>=22.22.2', 'v22.22.2'))

      let exitCode = null
      const originalExit = process.exit
      const originalConsoleError = console.error
      let errorOutput = ''

      process.exit = (code) => {
        exitCode = code
        throw new Error(`EXIT_${code}`)
      }
      console.error = (msg) => {
        errorOutput += msg
      }

      try {
        assert.throws(
          () => checkNodeVersion('>=22.22.2', 'v18.20.0'),
          /EXIT_1/
        )
        assert.equal(exitCode, 1)
        assert.match(errorOutput, /Error: this project requires Node\.js >=22\.22\.2\. You are running v18\.20\.0\./)
      } finally {
        process.exit = originalExit
        console.error = originalConsoleError
      }
    })
  })
})
