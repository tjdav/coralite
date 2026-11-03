import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  parseRepoSlug,
  getRepoSlug,
  isPrerelease,
  extractChangelogSection,
  createOrUpdateGitHubRelease
} from '../lib/github.js'

describe('GitHub release helper & changelog extraction', () => {
  describe('parseRepoSlug()', () => {
    it('parses SSH GitHub URLs', () => {
      const slug = parseRepoSlug('git@github.com:tjdav/coralite.git')
      assert.deepStrictEqual(slug, {
        owner: 'tjdav',
        repo: 'coralite'
      })
    })

    it('parses HTTPS GitHub URLs with or without .git', () => {
      assert.deepStrictEqual(parseRepoSlug('https://github.com/tjdav/coralite.git'), {
        owner: 'tjdav',
        repo: 'coralite'
      })
      assert.deepStrictEqual(parseRepoSlug('https://github.com/tjdav/coralite'), {
        owner: 'tjdav',
        repo: 'coralite'
      })
    })

    it('parses shorthand owner/repo strings', () => {
      assert.deepStrictEqual(parseRepoSlug('tjdav/coralite'), {
        owner: 'tjdav',
        repo: 'coralite'
      })
    })

    it('returns null for invalid or empty inputs', () => {
      assert.strictEqual(parseRepoSlug(null), null)
      assert.strictEqual(parseRepoSlug(''), null)
      assert.strictEqual(parseRepoSlug('not-a-repo'), null)
    })
  })

  describe('getRepoSlug()', () => {
    it('resolves repository slug for current workspace', () => {
      const slug = getRepoSlug()
      assert.strictEqual(slug.owner, 'tjdav')
      assert.strictEqual(slug.repo, 'coralite')
    })
  })

  describe('isPrerelease()', () => {
    it('identifies prerelease versions and tags correctly', () => {
      assert.strictEqual(isPrerelease('1.0.0-rc.10'), true)
      assert.strictEqual(isPrerelease('coralite-v1.0.0-rc.10'), true)
      assert.strictEqual(isPrerelease('create-coralite-v0.48.0-beta.1'), true)
      assert.strictEqual(isPrerelease('v2.0.0-alpha.0'), true)
    })

    it('identifies stable versions and tags as non-prerelease', () => {
      assert.strictEqual(isPrerelease('1.0.0'), false)
      assert.strictEqual(isPrerelease('coralite-v1.0.0'), false)
      assert.strictEqual(isPrerelease('v0.47.0'), false)
      assert.strictEqual(isPrerelease('0.48.2'), false)
      assert.strictEqual(isPrerelease(''), false)
      assert.strictEqual(isPrerelease(null), false)
    })
  })

  describe('extractChangelogSection()', () => {
    const sampleChangelog = `# Changelog

## v1.0.0-rc.10

> Comparing \`coralite-v1.0.0-rc.9\` to \`HEAD\`

### ✨ Features
- Added new feature A
- Added new feature B

### 🐛 Bug Fixes
- Fixed bug 123

## v1.0.0-rc.9

> Comparing \`coralite-v1.0.0-rc.8\` to \`HEAD\`

### ✨ Features
- Prior feature
`

    it('extracts target version section without bleeding into older versions', () => {
      const section = extractChangelogSection(sampleChangelog, '1.0.0-rc.10')
      assert.ok(section)
      assert.ok(section.includes('Added new feature A'))
      assert.ok(section.includes('Fixed bug 123'))
      assert.strictEqual(section.includes('Prior feature'), false)
    })

    it('works when version string includes leading v', () => {
      const section = extractChangelogSection(sampleChangelog, 'v1.0.0-rc.9')
      assert.ok(section)
      assert.ok(section.includes('Prior feature'))
      assert.strictEqual(section.includes('Added new feature A'), false)
    })

    it('returns null for missing version or empty content', () => {
      assert.strictEqual(extractChangelogSection(sampleChangelog, '2.0.0'), null)
      assert.strictEqual(extractChangelogSection('', '1.0.0'), null)
      assert.strictEqual(extractChangelogSection(null, '1.0.0'), null)
    })
  })

  describe('createOrUpdateGitHubRelease() with mocked fetch', () => {
    it('throws when tag is omitted', async () => {
      await assert.rejects(async () => {
        await createOrUpdateGitHubRelease({ tag: '' })
      }, /A git tag is required/)
    })

    it('creates a new release when tag does not exist (404 check)', async () => {
      const calls = []
      const mockFetch = async (url, options) => {
        calls.push({
          url,
          method: options.method,
          body: options.body ? JSON.parse(options.body) : null
        })
        if (options.method === 'GET') {
          return {
            status: 404,
            ok: false,
            text: async () => 'Not found'
          }
        }
        if (options.method === 'POST') {
          return {
            status: 201,
            ok: true,
            json: async () => ({
              id: 9999,
              html_url: 'https://github.com/tjdav/coralite/releases/tag/coralite-v1.0.0-rc.10'
            })
          }
        }
        throw new Error(`Unexpected call: ${options.method} ${url}`)
      }

      const result = await createOrUpdateGitHubRelease({
        tag: 'coralite-v1.0.0-rc.10',
        title: 'coralite v1.0.0-rc.10',
        body: 'Release notes content',
        token: 'test-token',
        repoSlug: {
          owner: 'tjdav',
          repo: 'coralite'
        },
        fetchFn: mockFetch
      })

      assert.strictEqual(result.success, true)
      assert.strictEqual(result.action, 'created')
      assert.strictEqual(result.htmlUrl, 'https://github.com/tjdav/coralite/releases/tag/coralite-v1.0.0-rc.10')
      assert.strictEqual(calls.length, 2)
      assert.strictEqual(calls[1].method, 'POST')
      assert.strictEqual(calls[1].body.tag_name, 'coralite-v1.0.0-rc.10')
      assert.strictEqual(calls[1].body.prerelease, true)
    })

    it('updates an existing release when tag already exists (200 check)', async () => {
      const calls = []
      const mockFetch = async (url, options) => {
        calls.push({
          url,
          method: options.method,
          body: options.body ? JSON.parse(options.body) : null
        })
        if (options.method === 'GET') {
          return {
            status: 200,
            ok: true,
            json: async () => ({
              id: 12345,
              tag_name: 'coralite-v1.0.0-rc.9'
            })
          }
        }
        if (options.method === 'PATCH') {
          return {
            status: 200,
            ok: true,
            json: async () => ({
              id: 12345,
              html_url: 'https://github.com/tjdav/coralite/releases/tag/coralite-v1.0.0-rc.9'
            })
          }
        }
        throw new Error(`Unexpected call: ${options.method} ${url}`)
      }

      const result = await createOrUpdateGitHubRelease({
        tag: 'coralite-v1.0.0-rc.9',
        title: 'coralite v1.0.0-rc.9',
        body: 'Updated release notes',
        token: 'test-token',
        repoSlug: {
          owner: 'tjdav',
          repo: 'coralite'
        },
        fetchFn: mockFetch
      })

      assert.strictEqual(result.success, true)
      assert.strictEqual(result.action, 'updated')
      assert.strictEqual(result.htmlUrl, 'https://github.com/tjdav/coralite/releases/tag/coralite-v1.0.0-rc.9')
      assert.strictEqual(calls.length, 2)
      assert.strictEqual(calls[1].method, 'PATCH')
      assert.strictEqual(calls[1].body.body, 'Updated release notes')
    })

    it('returns structured webUrl fallback when no token is present', async () => {
      const origToken = process.env.GITHUB_TOKEN
      const origGhToken = process.env.GH_TOKEN
      delete process.env.GITHUB_TOKEN
      delete process.env.GH_TOKEN

      try {
        const result = await createOrUpdateGitHubRelease({
          tag: 'coralite-v1.0.0-rc.8',
          title: 'coralite v1.0.0-rc.8',
          body: 'Note content',
          token: null,
          repoSlug: {
            owner: 'tjdav',
            repo: 'coralite'
          },
          fetchFn: null
        })

        assert.strictEqual(result.success, false)
        assert.ok(result.webUrl)
        assert.ok(result.webUrl.includes('https://github.com/tjdav/coralite/releases/new'))
        assert.ok(result.webUrl.includes('coralite-v1.0.0-rc.8'))
      } finally {
        if (origToken) {
          process.env.GITHUB_TOKEN = origToken
        }
        if (origGhToken) {
          process.env.GH_TOKEN = origGhToken
        }
      }
    })
  })
})
