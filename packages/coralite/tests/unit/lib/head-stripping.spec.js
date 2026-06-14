import { describe, test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert'
import '../setup.js'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createTestProject } from '../utils/project.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

describe('Head Stripping', () => {
  let project

  beforeEach(async () => {
    project = await createTestProject()
  })

  afterEach(async () => {
    await project.cleanup()
  })

  test('strip custom elements with no-hydration attribute', async () => {
    const fixtureDir = join(__dirname, '../../fixtures/head-stripping')

    const coralite = await project.createCoralite({
      components: fixtureDir,
      pages: fixtureDir
    })

    const results = await coralite.build()

    const indexPage = results.find(r => r.path.filename === 'head-stripping-page.html')
    assert.ok(indexPage, 'Head stripping page should be built')

    const content = indexPage.content
    document.documentElement.innerHTML = content

    // Check if <head-stripping-meta> is removed but its children are present
    const coraliteMeta = document.querySelector('head-stripping-meta')
    assert.ok(!coraliteMeta, 'Should not contain <head-stripping-meta> tag')

    const title = document.querySelector('title')
    assert.ok(title, 'Should contain <title> tag')
    assert.strictEqual(title.textContent, 'Hello World', 'Title should have correct text')

    const meta = document.querySelector('meta[name="description"]')
    assert.ok(meta, 'Should contain <meta> tag')
    assert.strictEqual(meta.getAttribute('content'), 'Test description')

    // Check if nested component inside no-hydration is also stripped
    const headNestedContent = document.head.querySelector('.nested')
    assert.ok(headNestedContent, 'Should contain nested content in head')
    assert.strictEqual(headNestedContent.parentElement.tagName, 'HEAD', 'Nested content should be direct child of head (stripped)')

    // The one in the body should NOT be stripped
    const bodyNestedComp = document.body.querySelector('nested-comp')
    assert.ok(bodyNestedComp, 'Should contain <nested-comp> tag from body')
    assert.ok(bodyNestedComp.hasAttribute('data-cid'), 'Body nested-comp should have a data-cid')

    // Check for hydration data
    const hydrationTag = document.getElementById('__CORALITE_HYDRATION__')
    if (hydrationTag) {
      const hydrationData = JSON.parse(hydrationTag.textContent)

      // head-stripping-meta should not have hydration data because it's no-hydration
      const cids = Object.keys(hydrationData)
      assert.ok(!cids.some(cid => cid.startsWith('head-stripping-meta')), 'head-stripping-meta should not have hydration data')
    }
  })
})
