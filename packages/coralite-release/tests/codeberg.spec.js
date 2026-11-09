import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  parseCodebergRepoSlug,
  getCodebergRepoSlug,
  createOrUpdateCodebergRelease
} from '../lib/codeberg.js'

describe('Codeberg release helper', () => {
  describe('parseCodebergRepoSlug()', () => {
    it('parses SSH Codeberg URLs', () => {
      const slug = parseCodebergRepoSlug('git@codeberg.org:tjdavid/coralite.git')
      assert.deepStrictEqual(slug, {
        owner: 'tjdavid',
        repo: 'coralite'
      })
    })

    it('parses HTTPS Codeberg URLs with or without .git', () => {
      assert.deepStrictEqual(parseCodebergRepoSlug('https://codeberg.org/tjdavid/coralite.git'), {
        owner: 'tjdavid',
        repo: 'coralite'
      })
      assert.deepStrictEqual(parseCodebergRepoSlug('https://codeberg.org/tjdavid/coralite'), {
        owner: 'tjdavid',
        repo: 'coralite'
      })
    })

    it('parses shorthand owner/repo strings', () => {
      assert.deepStrictEqual(parseCodebergRepoSlug('tjdavid/coralite'), {
        owner: 'tjdavid',
        repo: 'coralite'
      })
    })

    it('returns null for invalid or empty inputs', () => {
      assert.strictEqual(parseCodebergRepoSlug(null), null)
      assert.strictEqual(parseCodebergRepoSlug(''), null)
      assert.strictEqual(parseCodebergRepoSlug('not-a-repo'), null)
    })
  })

  describe('getCodebergRepoSlug()', () => {
    it('resolves repository slug for current workspace', () => {
      const slug = getCodebergRepoSlug()
      assert.strictEqual(slug.owner, 'tjdavid')
      assert.strictEqual(slug.repo, 'coralite')
    })
  })

  describe('createOrUpdateCodebergRelease()', () => {
    it('throws when tag parameter is missing', async () => {
      await assert.rejects(
        async () => {
          await createOrUpdateCodebergRelease({})
        },
        /requires a "tag" parameter/
      )
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
            text: async () => 'Not Found'
          }
        }
        if (options.method === 'POST') {
          return {
            status: 201,
            ok: true,
            json: async () => ({
              id: 98765,
              html_url: 'https://codeberg.org/tjdavid/coralite/releases/tag/coralite-v1.0.0'
            })
          }
        }
        throw new Error(`Unexpected call: ${options.method} ${url}`)
      }

      const result = await createOrUpdateCodebergRelease({
        tag: 'coralite-v1.0.0',
        title: 'coralite v1.0.0',
        body: '## v1.0.0\n\nRelease notes here',
        token: 'cb-test-token',
        repoSlug: {
          owner: 'tjdavid',
          repo: 'coralite'
        },
        fetchFn: mockFetch
      })

      assert.strictEqual(result.success, true)
      assert.strictEqual(result.action, 'created')
      assert.strictEqual(result.htmlUrl, 'https://codeberg.org/tjdavid/coralite/releases/tag/coralite-v1.0.0')
      assert.strictEqual(calls.length, 2)
      assert.strictEqual(calls[0].method, 'GET')
      assert.strictEqual(calls[1].method, 'POST')
      assert.strictEqual(calls[1].body.tag_name, 'coralite-v1.0.0')
      assert.strictEqual(calls[1].body.name, 'coralite v1.0.0')
      assert.strictEqual(calls[1].body.body, 'Release notes here')
      assert.strictEqual(calls[1].body.prerelease, false)
      assert.strictEqual(calls[1].body.draft, false)
    })

    it('sets prerelease flag properly for rc/beta tags', async () => {
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
            text: async () => 'Not Found'
          }
        }
        if (options.method === 'POST') {
          return {
            status: 201,
            ok: true,
            json: async () => ({
              id: 98766,
              html_url: 'https://codeberg.org/tjdavid/coralite/releases/tag/coralite-v1.0.0-rc.10'
            })
          }
        }
        throw new Error(`Unexpected call: ${options.method} ${url}`)
      }

      const result = await createOrUpdateCodebergRelease({
        tag: 'coralite-v1.0.0-rc.10',
        title: 'coralite v1.0.0-rc.10',
        body: 'Pre-release notes',
        token: 'cb-test-token',
        repoSlug: {
          owner: 'tjdavid',
          repo: 'coralite'
        },
        fetchFn: mockFetch
      })

      assert.strictEqual(result.success, true)
      assert.strictEqual(result.action, 'created')
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
              id: 54321,
              tag_name: 'coralite-v1.0.0'
            })
          }
        }
        if (options.method === 'PATCH') {
          return {
            status: 200,
            ok: true,
            json: async () => ({
              id: 54321,
              html_url: 'https://codeberg.org/tjdavid/coralite/releases/tag/coralite-v1.0.0'
            })
          }
        }
        throw new Error(`Unexpected call: ${options.method} ${url}`)
      }

      const result = await createOrUpdateCodebergRelease({
        tag: 'coralite-v1.0.0',
        title: 'coralite v1.0.0',
        body: 'Updated notes',
        token: 'cb-test-token',
        repoSlug: {
          owner: 'tjdavid',
          repo: 'coralite'
        },
        fetchFn: mockFetch
      })

      assert.strictEqual(result.success, true)
      assert.strictEqual(result.action, 'updated')
      assert.strictEqual(result.htmlUrl, 'https://codeberg.org/tjdavid/coralite/releases/tag/coralite-v1.0.0')
      assert.strictEqual(calls.length, 2)
      assert.strictEqual(calls[0].method, 'GET')
      assert.strictEqual(calls[1].method, 'PATCH')
      assert.strictEqual(calls[1].url, 'https://codeberg.org/api/v1/repos/tjdavid/coralite/releases/54321')
      assert.strictEqual(calls[1].body.body, 'Updated notes')
    })

    it('returns error when create API call fails', async () => {
      const mockFetch = async (url, options) => {
        if (options.method === 'GET') {
          return {
            status: 404,
            ok: false,
            text: async () => 'Not Found'
          }
        }
        if (options.method === 'POST') {
          return {
            status: 422,
            ok: false,
            text: async () => 'Validation Error'
          }
        }
        throw new Error(`Unexpected call: ${options.method} ${url}`)
      }

      const result = await createOrUpdateCodebergRelease({
        tag: 'coralite-v1.0.0',
        token: 'cb-test-token',
        repoSlug: {
          owner: 'tjdavid',
          repo: 'coralite'
        },
        fetchFn: mockFetch
      })

      assert.strictEqual(result.success, false)
      assert.ok(result.error.includes('Codeberg API error creating release (422)'))
    })

    it('returns structured webUrl fallback when no token is present', async () => {
      const origToken = process.env.CODEBERG_TOKEN
      delete process.env.CODEBERG_TOKEN

      try {
        const result = await createOrUpdateCodebergRelease({
          tag: 'coralite-v1.0.0',
          title: 'coralite v1.0.0',
          body: 'Note content',
          token: null,
          repoSlug: {
            owner: 'tjdavid',
            repo: 'coralite'
          },
          fetchFn: null
        })

        assert.strictEqual(result.success, false)
        assert.ok(result.webUrl)
        assert.ok(result.webUrl.includes('https://codeberg.org/tjdavid/coralite/releases/new'))
        assert.ok(result.webUrl.includes('coralite-v1.0.0'))
      } finally {
        if (origToken) {
          process.env.CODEBERG_TOKEN = origToken
        }
      }
    })
  })
})
