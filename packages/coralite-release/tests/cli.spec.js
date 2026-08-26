import { describe, it } from 'node:test'
import assert from 'node:assert'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  calculateNewVersion,
  RELEASE_TYPES,
  TOPOLOGICAL_ORDER,
  sortPackagesInTopologicalOrder,
  parsePackageOption
} from '../bin/release.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const releaseBin = path.resolve(__dirname, '../bin/release.js')
const repoRoot = path.resolve(__dirname, '../../..')

describe('coralite-release CLI & versioning logic', () => {
  describe('RELEASE_TYPES & TOPOLOGICAL_ORDER', () => {
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

    it('defines canonical topological package order', () => {
      assert.deepStrictEqual(TOPOLOGICAL_ORDER, [
        'coralite',
        'coralite-scripts',
        'create-coralite',
        'coralite-plugin-scripts',
        'create-coralite-plugin'
      ])
    })
  })

  describe('sortPackagesInTopologicalOrder()', () => {
    it('sorts package string names according to topological order', () => {
      const unsorted = ['create-coralite', 'coralite-scripts', 'coralite']
      const sorted = sortPackagesInTopologicalOrder(unsorted)
      assert.deepStrictEqual(sorted, ['coralite', 'coralite-scripts', 'create-coralite'])
    })

    it('sorts package objects according to topological order', () => {
      const unsorted = [
        { name: 'create-coralite' },
        { name: 'coralite' },
        { name: 'coralite-scripts' }
      ]
      const sorted = sortPackagesInTopologicalOrder(unsorted)
      assert.deepStrictEqual(sorted, [
        { name: 'coralite' },
        { name: 'coralite-scripts' },
        { name: 'create-coralite' }
      ])
    })

    it('appends unrecognized packages to the end of the queue', () => {
      const unsorted = ['my-custom-package', 'create-coralite', 'coralite']
      const sorted = sortPackagesInTopologicalOrder(unsorted)
      assert.deepStrictEqual(sorted, ['coralite', 'create-coralite', 'my-custom-package'])
    })
  })

  describe('parsePackageOption()', () => {
    it('parses comma-separated package names', () => {
      assert.deepStrictEqual(parsePackageOption('coralite,coralite-scripts'), [
        'coralite',
        'coralite-scripts'
      ])
    })

    it('parses array of package names and space/comma combinations', () => {
      assert.deepStrictEqual(parsePackageOption(['coralite', 'coralite-scripts, create-coralite']), [
        'coralite',
        'coralite-scripts',
        'create-coralite'
      ])
    })

    it('handles empty or falsy input gracefully', () => {
      assert.deepStrictEqual(parsePackageOption(null), [])
      assert.deepStrictEqual(parsePackageOption(''), [])
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
      assert.match(output, /-p, --package <packages...>/)
      assert.match(output, /-a, --all/)
    })

    it('executes non-interactive --dry-run with rc type and --allow-any-branch', () => {
      const output = execFileSync('node', [releaseBin, 'rc', '-y', '-d', '--allow-any-branch'], {
        cwd: repoRoot,
        encoding: 'utf8'
      })
      assert.match(output, /Dry run completed/)
      assert.match(output, /📦 To publish coralite to npm, run:/)
      assert.match(output, /--tag rc/)
    })

    it('executes non-interactive --dry-run with multi-package --package option', () => {
      const output = execFileSync('node', [releaseBin, 'minor', '-p', 'create-coralite,coralite', '-y', '-d', '--allow-any-branch'], {
        cwd: repoRoot,
        encoding: 'utf8'
      })
      assert.match(output, /Dry run completed/)
      assert.match(output, /Release Plan:/)

      // Check topological order output (coralite before create-coralite)
      const coraliteIdx = output.indexOf('Planned steps for coralite')
      const createCoraliteIdx = output.indexOf('Planned steps for create-coralite')
      assert.ok(coraliteIdx > -1)
      assert.ok(createCoraliteIdx > -1)
      assert.ok(coraliteIdx < createCoraliteIdx)

      const gitDiff = execFileSync('git', ['diff', 'packages/coralite/package.json'], { cwd: repoRoot, encoding: 'utf8' })
      assert.strictEqual(gitDiff.trim(), '')
    })

    it('executes non-interactive --dry-run with --all flag', () => {
      const output = execFileSync('node', [releaseBin, 'minor', '--all', '-y', '-d', '--allow-any-branch'], {
        cwd: repoRoot,
        encoding: 'utf8'
      })
      assert.match(output, /Dry run completed/)
      assert.match(output, /Release Plan:/)
      assert.match(output, /coralite:/)
      assert.match(output, /coralite-scripts:/)
      assert.match(output, /create-coralite:/)
      assert.match(output, /coralite-plugin-scripts:/)
      assert.match(output, /create-coralite-plugin:/)

      const gitDiff = execFileSync('git', ['diff', '--', 'packages/*/package.json', 'packages/*/templates/*/package.json'], { cwd: repoRoot, encoding: 'utf8' })
      assert.strictEqual(gitDiff.trim(), '')
    })
  })
})
