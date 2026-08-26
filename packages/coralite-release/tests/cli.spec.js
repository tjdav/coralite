import { describe, it } from 'node:test'
import assert from 'node:assert'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { calculateNewVersion, RELEASE_TYPES } from '../bin/release.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const releaseBin = path.resolve(__dirname, '../bin/release.js')
const repoRoot = path.resolve(__dirname, '../../..')

describe('coralite-release CLI & versioning logic', () => {
  describe('RELEASE_TYPES', () => {
    it('contains all expected release types including rc', () => {
      assert.deepStrictEqual(RELEASE_TYPES, [
        'major',
        'minor',
        'patch',
        'premajor',
        'preminor',
        'prepatch',
        'prerelease',
        'rc'
      ])
    })
  })

  describe('calculateNewVersion()', () => {
    it('calculates standard release types correctly', () => {
      assert.strictEqual(calculateNewVersion('0.47.1', 'major'), '1.0.0')
      assert.strictEqual(calculateNewVersion('0.47.1', 'minor'), '0.48.0')
      assert.strictEqual(calculateNewVersion('0.47.1', 'patch'), '0.47.2')
    })

    it('calculates prerelease types with default rc preid', () => {
      assert.strictEqual(calculateNewVersion('0.47.1', 'preminor'), '0.48.0-rc.0')
      assert.strictEqual(calculateNewVersion('0.47.1', 'prepatch'), '0.47.2-rc.0')
      assert.strictEqual(calculateNewVersion('0.47.1', 'premajor'), '1.0.0-rc.0')
    })

    it('handles custom preid option', () => {
      assert.strictEqual(calculateNewVersion('0.47.1', 'preminor', 'beta'), '0.48.0-beta.0')
    })

    it('handles rc shortcut on stable version with targetBase selection', () => {
      assert.strictEqual(calculateNewVersion('0.47.1', 'rc', 'rc', 'preminor'), '0.48.0-rc.0')
      assert.strictEqual(calculateNewVersion('0.47.1', 'rc', 'rc', 'prepatch'), '0.47.2-rc.0')
      assert.strictEqual(calculateNewVersion('0.47.1', 'rc', 'rc', 'premajor'), '1.0.0-rc.0')
    })

    it('handles rc and prerelease shortcuts on existing release candidates', () => {
      assert.strictEqual(calculateNewVersion('0.48.0-rc.0', 'rc', 'rc'), '0.48.0-rc.1')
      assert.strictEqual(calculateNewVersion('0.48.0-rc.0', 'prerelease', 'rc'), '0.48.0-rc.1')
      assert.strictEqual(calculateNewVersion('0.48.0-rc.1', 'rc', 'rc'), '0.48.0-rc.2')
    })

    it('graduates release candidate to stable release', () => {
      assert.strictEqual(calculateNewVersion('0.48.0-rc.2', 'minor'), '0.48.0')
    })

    it('throws error for invalid release type', () => {
      assert.throws(() => calculateNewVersion('0.47.1', 'invalid-type'), /Unknown release type/)
    })
  })

  describe('CLI options & help', () => {
    it('displays help output containing updated options and release types', () => {
      const output = execFileSync('node', [releaseBin, '--help'], { cwd: repoRoot, encoding: 'utf8' })
      assert.match(output, /rc/)
      assert.match(output, /preminor/)
      assert.match(output, /--allow-any-branch/)
      assert.match(output, /-p, --preid <identifier>/)
    })

    it('executes non-interactive --dry-run with rc type and --allow-any-branch', () => {
      const output = execFileSync('node', [releaseBin, 'rc', '-y', '-d', '--allow-any-branch'], {
        cwd: repoRoot,
        encoding: 'utf8'
      })
      assert.match(output, /Dry run completed/)
      assert.match(output, /📦 To publish this release candidate to npm, run:/)
      assert.match(output, /--tag rc/)
    })

    it('executes non-interactive --dry-run with preminor type and --allow-any-branch', () => {
      const output = execFileSync('node', [releaseBin, 'preminor', '-y', '-d', '--allow-any-branch'], {
        cwd: repoRoot,
        encoding: 'utf8'
      })
      assert.match(output, /Dry run completed/)
      assert.match(output, /📦 To publish this release candidate to npm, run:/)
    })

    it('executes non-interactive --dry-run with minor stable type and --allow-any-branch', () => {
      const output = execFileSync('node', [releaseBin, 'minor', '-y', '-d', '--allow-any-branch'], {
        cwd: repoRoot,
        encoding: 'utf8'
      })
      assert.match(output, /Dry run completed/)
      assert.match(output, /📦 To publish this release to npm, run:/)
      assert.doesNotMatch(output, /--tag/)

      // Verify that pnpm pack --dry-run outputs the target package version preview
      assert.match(output, /coralite-.*\.tgz/)

      // Verify that package.json on disk was restored cleanly and has no git diff
      const gitDiff = execFileSync('git', ['diff', 'packages/coralite/package.json'], { cwd: repoRoot, encoding: 'utf8' })
      assert.strictEqual(gitDiff.trim(), '')
    })
  })
})
