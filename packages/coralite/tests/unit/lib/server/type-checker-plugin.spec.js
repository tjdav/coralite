import { describe, it } from 'node:test'
import assert from 'node:assert'
import { extractScriptBlock, coraliteLanguagePlugin } from '../../../../lib/server/type-checker/volar-plugin.js'

describe('volar-plugin', () => {
  it('extractScriptBlock extracts script content and offset from HTML source', () => {
    const html = '<div>\n  <h1>Title</h1>\n</div>\n<script type="module">\nconst a = 1\n</script>'
    const extracted = extractScriptBlock(html)

    assert.ok(extracted)
    assert.strictEqual(extracted.content, '\nconst a = 1\n')
    assert.strictEqual(extracted.offset, html.indexOf('\nconst a = 1\n'))
  })

  it('extractScriptBlock returns null if no script tag is present', () => {
    const html = '<div><h1>No Script</h1></div>'
    const extracted = extractScriptBlock(html)

    assert.strictEqual(extracted, null)
  })

  it('coraliteLanguagePlugin identifies .html language ID', () => {
    assert.strictEqual(coraliteLanguagePlugin.getLanguageId('test.html'), 'html')
    assert.strictEqual(coraliteLanguagePlugin.getLanguageId('test.js'), undefined)
  })

  it('coraliteLanguagePlugin creates virtual code with mappings for .html file with script', () => {
    const html = '<script>\nconst x: number = 10\n</script>'
    const snapshot = {
      getText: (start, end) => html.slice(start, end),
      getLength: () => html.length
    }

    const virtualCode = coraliteLanguagePlugin.createVirtualCode('test.html', 'html', snapshot)

    assert.ok(virtualCode)
    assert.strictEqual(virtualCode.id, 'main')
    assert.strictEqual(virtualCode.languageId, 'typescript')
    assert.strictEqual(virtualCode.snapshot.getText(0, virtualCode.snapshot.getLength()), '\nconst x: number = 10\n')
    assert.strictEqual(virtualCode.mappings.length, 1)
    assert.strictEqual(virtualCode.mappings[0].sourceOffsets[0], html.indexOf('\nconst x: number = 10\n'))
  })

  it('coraliteLanguagePlugin returns undefined when languageId is not html', () => {
    const snapshot = {
      getText: () => 'const x = 1',
      getLength: () => 11
    }

    const virtualCode = coraliteLanguagePlugin.createVirtualCode('test.js', 'javascript', snapshot)

    assert.strictEqual(virtualCode, undefined)
  })
})
