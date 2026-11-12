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
  parsePackageOption,
  buildReleasePostArgs,
  getReleasePostTargets
} from '../bin/release.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const releaseBin = path.resolve(__dirname, '../bin/release.js')
const releasePostBin = path.resolve(__dirname, '../bin/release-post.js')
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
        'create-coralite'
      ])
    })
  })

  describe('sortPackagesInTopologicalOrder()', () => {
    it('sorts package string names according to topological order', () => {
      const unsorted = ['create-coralite', 'coralite']
      const sorted = sortPackagesInTopologicalOrder(unsorted)
      assert.deepStrictEqual(sorted, ['coralite', 'create-coralite'])
    })

    it('sorts package objects according to topological order', () => {
      const unsorted = [
        { name: 'create-coralite' },
        { name: 'coralite' }
      ]
      const sorted = sortPackagesInTopologicalOrder(unsorted)
      assert.deepStrictEqual(sorted, [
        { name: 'coralite' },
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
      assert.deepStrictEqual(parsePackageOption('coralite,create-coralite'), [
        'coralite',
        'create-coralite'
      ])
    })

    it('parses array of package names and space/comma combinations', () => {
      assert.deepStrictEqual(parsePackageOption(['coralite', 'create-coralite']), [
        'coralite',
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

  describe('buildReleasePostArgs()', () => {
    const rel = {
      name: 'coralite',
      tagName: 'coralite-v1.3.0'
    }

    const withToken = (value, fn) => {
      const previous = process.env.CODEBERG_TOKEN
      if (value === undefined) {
        delete process.env.CODEBERG_TOKEN
      } else {
        process.env.CODEBERG_TOKEN = value
      }
      try {
        return fn()
      } finally {
        if (previous === undefined) {
          delete process.env.CODEBERG_TOKEN
        } else {
          process.env.CODEBERG_TOKEN = previous
        }
      }
    }

    it('builds HTTP provider args with GitHub and website defaults', () => {
      withToken(undefined, () => {
        const args = buildReleasePostArgs(rel, {}, 'http')

        assert.match(args, /--package "coralite"/)
        assert.match(args, /--to "coralite-v1\.3\.0"/)
        assert.match(args, /--provider http/)
        assert.doesNotMatch(args, /--agy/)
        assert.match(args, /--github-release/)
        assert.match(args, /--website-changelog/)
        assert.doesNotMatch(args, /--codeberg-release/)
        assert.match(args, /-y$/)
      })
    })

    it('builds agy provider args', () => {
      withToken(undefined, () => {
        const args = buildReleasePostArgs(rel, {}, 'agy')

        assert.match(args, /--provider agy/)
        assert.doesNotMatch(args, /--agy/)
      })
    })

    it('adds Codeberg when explicitly requested or a token is present', () => {
      assert.match(buildReleasePostArgs(rel, { codebergRelease: true }, 'http'), /--codeberg-release/)
      withToken('token', () => {
        assert.match(buildReleasePostArgs(rel, {}, 'http'), /--codeberg-release/)
      })
    })

    it('respects explicit publish opt-outs', () => {
      withToken('token', () => {
        const args = buildReleasePostArgs(rel, {
          githubRelease: false,
          noCodebergRelease: true,
          websiteChangelog: false
        }, 'http')

        assert.doesNotMatch(args, /--github-release/)
        assert.doesNotMatch(args, /--codeberg-release/)
        assert.doesNotMatch(args, /--website-changelog/)
      })
    })
  })

  describe('getReleasePostTargets()', () => {
    it('returns enabled targets with defaults', () => {
      const previous = process.env.CODEBERG_TOKEN
      delete process.env.CODEBERG_TOKEN
      try {
        assert.deepStrictEqual(getReleasePostTargets({}), ['GitHub', 'website changelog'])
      } finally {
        if (previous !== undefined) {
          process.env.CODEBERG_TOKEN = previous
        }
      }
    })

    it('includes Codeberg when configured and respects opt-outs', () => {
      const previous = process.env.CODEBERG_TOKEN
      process.env.CODEBERG_TOKEN = 'token'
      try {
        assert.deepStrictEqual(
          getReleasePostTargets({}),
          ['GitHub', 'Codeberg', 'website changelog']
        )
        assert.deepStrictEqual(
          getReleasePostTargets({
            githubRelease: false,
            noCodebergRelease: true,
            websiteChangelog: false
          }),
          []
        )
      } finally {
        if (previous === undefined) {
          delete process.env.CODEBERG_TOKEN
        } else {
          process.env.CODEBERG_TOKEN = previous
        }
      }
    })
  })

  describe('CLI options & help', () => {
    it('displays help output containing updated options and release types', () => {
      const output = execFileSync('node', [releaseBin, '--help'], {
        cwd: repoRoot,
        encoding: 'utf8'
      })
      assert.match(output, /rc/)
      assert.match(output, /preminor/)
      assert.match(output, /--allow-any-branch/)
      assert.match(output, /-p, --package <packages...>/)
      assert.match(output, /-a, --all/)
      assert.match(output, /--agy/)
      assert.match(output, /--release-post <provider>/)
    })

    it('displays release-post provider option in help output', () => {
      const output = execFileSync('node', [releasePostBin, '--help'], {
        cwd: repoRoot,
        encoding: 'utf8'
      })
      assert.match(output, /--provider <provider>/)
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
      const gitDiffBefore = execFileSync('git', ['diff', 'packages/coralite/package.json'], {
        cwd: repoRoot,
        encoding: 'utf8'
      })
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

      const gitDiff = execFileSync('git', ['diff', 'packages/coralite/package.json'], {
        cwd: repoRoot,
        encoding: 'utf8'
      })
      assert.strictEqual(gitDiff.trim(), gitDiffBefore.trim())
    })

    it('executes non-interactive --dry-run with --all flag', () => {
      const gitDiffBefore = execFileSync('git', ['diff', '--', 'packages/*/package.json', 'packages/*/templates/*/package.json'], {
        cwd: repoRoot,
        encoding: 'utf8'
      })
      const output = execFileSync('node', [releaseBin, 'minor', '--all', '-y', '-d', '--allow-any-branch'], {
        cwd: repoRoot,
        encoding: 'utf8'
      })
      assert.match(output, /Dry run completed/)
      assert.match(output, /Release Plan:/)
      assert.match(output, /coralite:/)
      assert.match(output, /create-coralite:/)
      assert.doesNotMatch(output, /coralite-scripts:/)

      const gitDiff = execFileSync('git', ['diff', '--', 'packages/*/package.json', 'packages/*/templates/*/package.json'], {
        cwd: repoRoot,
        encoding: 'utf8'
      })
      assert.strictEqual(gitDiff.trim(), gitDiffBefore.trim())
    })
  })
})
