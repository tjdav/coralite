/* eslint-disable no-restricted-imports -- Node test runner spec; requires node:* builtins */
import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { createCoralite, CoraliteBuildError } from '#lib'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixtureRoot = join(__dirname, '../../../../fixtures/pages/redirect')

let TEST_DIR
let COMPONENTS_DIR
let OUTPUT_DIR

describe('__redirect page marker', () => {
  beforeEach(async () => {
    TEST_DIR = await mkdtemp(join(tmpdir(), 'coralite-redirect-test-'))
    COMPONENTS_DIR = join(TEST_DIR, 'components')
    OUTPUT_DIR = join(TEST_DIR, 'dist')
    await mkdir(COMPONENTS_DIR, { recursive: true })
    await mkdir(OUTPUT_DIR, { recursive: true })
  })

  afterEach(async () => {
    await rm(TEST_DIR, {
      recursive: true,
      force: true
    })
  })

  it('server() returning { __redirect: { to: "/new-path", status: 301 } } emits redirect stub and ignores other keys', async () => {
    const coralite = await createCoralite({
      pages: fixtureRoot,
      components: COMPONENTS_DIR,
      output: OUTPUT_DIR,
      cleanUrls: true
    })
    const results = await coralite.build('static-redirect.html')
    assert.equal(results.length, 1)

    const result = results[0]
    assert.equal(result.route.path, '/static-redirect')

    const html = result.content
    assert.ok(html.includes('<meta http-equiv="refresh" content="0; url=/new-path">'))
    assert.ok(html.includes('<link rel="canonical" href="/new-path">'))
    assert.ok(html.includes("<script>location.replace('/new-path')</script>"))
    assert.ok(html.includes('<a href="/new-path">/new-path</a>'))
    assert.ok(html.includes('<title>Redirecting...</title>'))
    assert.ok(!html.includes('This content should not be rendered'))
  })

  it('accepts external URLs starting with http:// or https://', async () => {
    const coralite = await createCoralite({
      pages: fixtureRoot,
      components: COMPONENTS_DIR,
      output: OUTPUT_DIR,
      cleanUrls: true
    })
    const results = await coralite.build('external-url.html')
    assert.equal(results.length, 1)

    const html = results[0].content
    assert.ok(html.includes('<meta http-equiv="refresh" content="0; url=https://example.com/external">'))
    assert.ok(html.includes('<link rel="canonical" href="https://example.com/external">'))
    assert.ok(html.includes("<script>location.replace('https://example.com/external')</script>"))
    assert.ok(html.includes('<a href="https://example.com/external">https://example.com/external</a>'))
  })

  it('dynamic page redirects for one enumerated path and renders normally for another', async () => {
    const coralite = await createCoralite({
      pages: fixtureRoot,
      components: COMPONENTS_DIR,
      output: OUTPUT_DIR,
      cleanUrls: true
    })
    const results = await coralite.build('dynamic-some-redirect/[id].html')
    assert.equal(results.length, 2)

    const path1 = results.find(r => r.route.path === '/dynamic-some-redirect/1')
    const path2 = results.find(r => r.route.path === '/dynamic-some-redirect/2')

    assert.ok(path1)
    assert.ok(path2)

    // Path 1 redirects
    assert.ok(path1.content.includes('<meta http-equiv="refresh" content="0; url=/target-1">'))
    assert.ok(!path1.content.includes('Page ID: 1'))

    // Path 2 renders template normally
    assert.ok(path2.content.includes('<h1>Page ID: 2</h1>'))
    assert.ok(!path2.content.includes('Redirecting...'))
  })

  it('throws CoraliteBuildError when to is non-string or invalid', async () => {
    const coralite = await createCoralite({
      pages: fixtureRoot,
      components: COMPONENTS_DIR,
      output: OUTPUT_DIR,
      cleanUrls: true
    })

    await assert.rejects(
      async () => {
        await coralite.build('invalid-to.html')
      },
      (err) => {
        assert.ok(err instanceof CoraliteBuildError || err.cause instanceof CoraliteBuildError)
        const targetErr = err instanceof CoraliteBuildError ? err : err.cause
        assert.ok(targetErr.message.includes('invalid "to" field'))
        return true
      }
    )
  })

  it('throws CoraliteBuildError when status is invalid', async () => {
    const coralite = await createCoralite({
      pages: fixtureRoot,
      components: COMPONENTS_DIR,
      output: OUTPUT_DIR,
      cleanUrls: true
    })

    await assert.rejects(
      async () => {
        await coralite.build('invalid-status.html')
      },
      (err) => {
        assert.ok(err instanceof CoraliteBuildError || err.cause instanceof CoraliteBuildError)
        const targetErr = err instanceof CoraliteBuildError ? err : err.cause
        assert.ok(targetErr.message.includes('invalid "status" field'))
        return true
      }
    )
  })

  it('respects cleanUrls setting for output file path while preserving route.path source path and keeping target to unchanged', async () => {
    const coraliteFileStyle = await createCoralite({
      pages: fixtureRoot,
      components: COMPONENTS_DIR,
      output: OUTPUT_DIR,
      cleanUrls: false
    })
    const resultsFileStyle = await coraliteFileStyle.build('static-redirect.html')
    assert.equal(resultsFileStyle.length, 1)

    const res = resultsFileStyle[0]
    assert.equal(res.route.path, '/static-redirect.html')
    assert.ok(res.path.pathname.endsWith('static-redirect.html'))
    assert.ok(res.content.includes('content="0; url=/new-path"'))
  })
})
