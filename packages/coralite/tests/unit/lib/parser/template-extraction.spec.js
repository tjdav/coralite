import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { parseModule } from '../../../../lib/server/utils/parse.js'
import { transformNode } from '../../../../lib/server/parser/html.js'
import { CoraliteError } from '../../../../lib/shared/errors.js'

const fixturesDir = fileURLToPath(new URL('../../../fixtures/components', import.meta.url))

function readFixture (filename) {
  return readFileSync(join(fixturesDir, filename), 'utf8')
}

describe('Template Child Extraction (P4.02d)', () => {
  it('extracts <style> inside <template> and appends to styles array', () => {
    const content = readFixture('style-in-template.html')
    const filePath = join(fixturesDir, 'style-in-template.html')
    const result = parseModule(content, { filePath })

    assert.strictEqual(result.isTemplate, true)
    assert.strictEqual(result.id, 'style-in-template')
    assert.strictEqual(result.styles.length, 1)
    assert.match(result.styles[0], /\.card\s*\{\s*color:\s*red;\s*\}/)

    // Verify removed from template AST
    const renderedTemplate = transformNode(result.template)
    assert.doesNotMatch(renderedTemplate, /<style/)
  })

  it('extracts <style> nested inside <div> inside <template>', () => {
    const content = readFixture('style-nested-in-div.html')
    const filePath = join(fixturesDir, 'style-nested-in-div.html')
    const result = parseModule(content, { filePath })

    assert.strictEqual(result.isTemplate, true)
    assert.strictEqual(result.id, 'style-nested-in-div')
    assert.strictEqual(result.styles.length, 1)
    assert.match(result.styles[0], /\.nested\s*\{\s*color:\s*blue;\s*\}/)

    // Verify removed from template AST
    const renderedTemplate = transformNode(result.template)
    assert.doesNotMatch(renderedTemplate, /<style/)
  })

  it('extracts multiple <style> inside <template> in document order', () => {
    const content = `
      <template id="multi-style-template">
        <style>.first { color: red; }</style>
        <div>Content</div>
        <style>.second { color: blue; }</style>
      </template>
    `
    const result = parseModule(content, { filePath: 'multi-style-template.html' })

    assert.strictEqual(result.styles.length, 2)
    assert.match(result.styles[0], /\.first/)
    assert.match(result.styles[1], /\.second/)

    const renderedTemplate = transformNode(result.template)
    assert.doesNotMatch(renderedTemplate, /<style/)
  })

  it('collects sibling <style> first, then in-template <style> in document order', () => {
    const content = readFixture('style-both-places.html')
    const filePath = join(fixturesDir, 'style-both-places.html')
    const result = parseModule(content, { filePath })

    assert.strictEqual(result.styles.length, 2)
    // Sibling first
    assert.match(result.styles[0], /\.card\s*\{\s*padding:\s*8px;\s*\}/)
    // In-template second
    assert.match(result.styles[1], /\.inner\s*\{\s*margin:\s*4px;\s*\}/)

    const renderedTemplate = transformNode(result.template)
    assert.doesNotMatch(renderedTemplate, /<style/)
  })

  it('extracts <script type="module"> inside <template>', () => {
    const content = readFixture('script-in-template.html')
    const filePath = join(fixturesDir, 'script-in-template.html')
    const result = parseModule(content, { filePath })

    assert.strictEqual(result.isTemplate, true)
    assert.strictEqual(result.id, 'script-in-template')
    assert.ok(result.script)
    assert.match(result.script, /import \{ defineComponent \} from 'coralite'/)

    // Verify removed from template AST
    const renderedTemplate = transformNode(result.template)
    assert.doesNotMatch(renderedTemplate, /<script/)
  })

  it('throws CoraliteError if both sibling and in-template scripts exist', () => {
    const content = readFixture('script-both-places.html')
    const filePath = join(fixturesDir, 'script-both-places.html')

    assert.throws(() => {
      parseModule(content, { filePath })
    }, (err) => {
      assert.ok(err instanceof CoraliteError)
      assert.strictEqual(
        err.message,
        `Component "${filePath}" has more than one <script type="module"> block.\nEach component accepts exactly one script block.`
      )
      return true
    })
  })

  it('throws CoraliteError if script in template has no type="module"', () => {
    const content = readFixture('script-non-module-in-template.html')
    const filePath = join(fixturesDir, 'script-non-module-in-template.html')

    assert.throws(() => {
      parseModule(content, { filePath })
    }, (err) => {
      assert.ok(err instanceof CoraliteError)
      assert.strictEqual(
        err.message,
        `Component "${filePath}" has a <script> inside <template> without type="module".\nOnly <script type="module"> is supported inside <template>.`
      )
      return true
    })
  })

  it('throws CoraliteError if script in template has non-module type attribute', () => {
    const content = `
      <template id="script-type-test">
        <script type="text/javascript">console.log(1)</script>
      </template>
    `
    const filePath = 'script-type-test.html'

    assert.throws(() => {
      parseModule(content, { filePath })
    }, (err) => {
      assert.ok(err instanceof CoraliteError)
      assert.strictEqual(
        err.message,
        `Component "${filePath}" has a <script type="text/javascript"> inside <template>.\nOnly <script type="module"> is supported inside <template>.`
      )
      return true
    })
  })

  it('does NOT extract <script type="application/json"> and leaves it in template AST without throwing', () => {
    const content = readFixture('script-json-in-template.html')
    const filePath = join(fixturesDir, 'script-json-in-template.html')
    const result = parseModule(content, { filePath })

    assert.strictEqual(result.isTemplate, true)
    assert.strictEqual(result.script, undefined)

    // Script should remain inside the template AST
    const renderedTemplate = transformNode(result.template)
    assert.match(renderedTemplate, /<script type="application\/json">/)
  })

  it('produces byte-identical extracted styles for in-template style vs canonical style', () => {
    const inTemplateContent = readFixture('style-in-template.html')
    const canonicalContent = readFixture('style-canonical.html')

    const resInTemplate = parseModule(inTemplateContent)
    const resCanonical = parseModule(canonicalContent)

    assert.deepStrictEqual(resInTemplate.styles, resCanonical.styles)

    // Compare rendered element markup (excluding whitespace differences)
    const renderedInTemplate = transformNode(resInTemplate.template).replace(/\s+/g, ' ').trim()
    const renderedCanonical = transformNode(resCanonical.template).replace(/\s+/g, ' ').trim()

    // Both should contain <div class="card">Style in template content</div>
    assert.match(renderedInTemplate, /<div class="card">Style in template content<\/div>/)
    assert.match(renderedCanonical, /<div class="card">Style in template content<\/div>/)
  })

  it('preserves components with neither <style> nor <script> inside <template>', () => {
    const content = `
      <template id="plain-component">
        <p>Hello world</p>
      </template>
    `
    const result = parseModule(content)

    assert.strictEqual(result.isTemplate, true)
    assert.strictEqual(result.styles.length, 0)
    assert.strictEqual(result.script, undefined)
    assert.match(transformNode(result.template), /<p>Hello world<\/p>/)
  })
})
