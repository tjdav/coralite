import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createCoralite } from '#lib'

describe('Page Token HTML and Server-Only Handling', () => {
  let testDir
  let componentsDir
  let pagesDir
  let outputDir

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'coralite-page-tokens-'))
    componentsDir = join(testDir, 'components')
    pagesDir = join(testDir, 'pages')
    outputDir = join(testDir, 'dist')

    await mkdir(componentsDir, { recursive: true })
    await mkdir(pagesDir, { recursive: true })
    await mkdir(outputDir, { recursive: true })
  })

  afterEach(async () => {
    await rm(testDir, {
      recursive: true,
      force: true
    })
  })

  it('renders HTML page tokens wrapped in <c-token> with custom elements expanded and attributes preserved when client reactive', async () => {
    await writeFile(join(componentsDir, 'my-badge.html'), `<template id="my-badge">
      <span class="badge"><slot></slot></span>
    </template>`)

    await writeFile(join(pagesDir, 'index.html'), `<!DOCTYPE html>
    <html>
    <body>
      <div id="content">{{ richHtml }}</div>
    </body>
    </html>
    <script type="module">
      import { definePage } from 'coralite'
      export default definePage({
        server () {
          return {
            richHtml: '<my-badge>New</my-badge><a href="https://example.com" target="_blank" rel="noopener">Link</a>'
          }
        },
        client () {}
      })
    </script>`)

    const app = await createCoralite({
      components: componentsDir,
      pages: pagesDir,
      output: outputDir,
      mode: 'production',
      incremental: false
    })

    const results = await app.build()
    const html = results[0].content
    const markupOnly = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')

    assert.ok(markupOnly.includes('<c-token data-coralite-page-token='), 'HTML token should be wrapped in <c-token> with page token marker')
    assert.ok(markupOnly.includes('target="_blank"'), 'HTML attributes like target="_blank" must be preserved without DOMPurify stripping')
    assert.ok(markupOnly.includes('<span class="badge"'), 'Nested custom elements inside HTML token (<my-badge>) must be SSR-expanded')
    assert.ok(markupOnly.includes('New'), 'Slot content inside custom element must be rendered')

    const pageConfigMatch = html.match(/coralite\.config\.page = Object\.assign\(\s*\{\},\s*coralite\.config\.page \|\| \{\},\s*(\{[\s\S]*?\})\s*\);/)
    assert.ok(pageConfigMatch, 'page config should be present')
    const pageConfig = JSON.parse(pageConfigMatch[1])
    const tokenValues = Object.values(pageConfig.tokens || {})
    const htmlTokenEntry = tokenValues.find(entry => entry.texts && entry.texts.some(t => t.type === 'html'))
    assert.ok(htmlTokenEntry, 'html token entry should be registered with type: "html"')
    assert.equal(htmlTokenEntry.texts[0].type, 'html')
    assert.equal(htmlTokenEntry.texts[0].raw, '{{ richHtml }}')
  })

  it('omits page token markers and sets pageConfig to null on static server-only pages', async () => {
    await writeFile(join(pagesDir, 'server-only.html'), `<!DOCTYPE html>
    <html>
    <body>
      <div id="timeline">{{ timeline }}</div>
      <p id="plain">{{ message }}</p>
    </body>
    </html>
    <script type="module">
      import { definePage } from 'coralite'
      export default definePage({
        server () {
          return {
            timeline: '<article class="entry"><h3>Title</h3><p>Description</p></article>',
            message: 'Hello Server'
          }
        }
      })
    </script>`)

    const app = await createCoralite({
      components: componentsDir,
      pages: pagesDir,
      output: outputDir,
      mode: 'production',
      incremental: false
    })

    const results = await app.build()
    const html = results[0].content
    const markupOnly = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')

    assert.ok(markupOnly.includes('<article class="entry"><h3>Title</h3><p>Description</p></article>'), 'HTML token should be spliced directly into DOM')
    assert.ok(markupOnly.includes('Hello Server'), 'Plain text token should be rendered')
    assert.ok(!markupOnly.includes('data-coralite-page-token'), 'Server-only page must omit data-coralite-page-token markers')
    assert.ok(!markupOnly.includes('<c-token'), 'Server-only page must not create <c-token> elements')

    // Verify pageConfig is null or absent
    assert.ok(html.includes('coralite.config.page = coralite.config.page || null;'), 'pageConfig should be null on server-only page')
    assert.ok(!html.includes('coralite.config.page = Object.assign'), 'server() page must not serialize pageConfig Object.assign block')
  })

  it('does not treat text with "<" that is not HTML as an HTML token', async () => {
    await writeFile(join(pagesDir, 'index.html'), `<!DOCTYPE html>
    <html>
    <body>
      <div id="math">{{ mathExpression }}</div>
    </body>
    </html>
    <script type="module">
      import { definePage } from 'coralite'
      export default definePage({
        server () {
          return {
            mathExpression: '5 < 10 and 20 > 15'
          }
        },
        client () {}
      })
    </script>`)

    const app = await createCoralite({
      components: componentsDir,
      pages: pagesDir,
      output: outputDir,
      mode: 'production',
      incremental: false
    })

    const results = await app.build()
    const html = results[0].content
    const markupOnly = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')

    assert.ok(markupOnly.includes('5 &lt; 10 and 20 &gt; 15') || markupOnly.includes('5 < 10 and 20 > 15'), 'math expression should be rendered')
    assert.ok(!markupOnly.includes('<c-token'), 'Non-HTML string with "<" must not be wrapped in <c-token>')

    const pageConfigMatch = html.match(/coralite\.config\.page = Object\.assign\(\s*\{\},\s*coralite\.config\.page \|\| \{\},\s*(\{[\s\S]*?\})\s*\);/)
    assert.ok(pageConfigMatch)
    const pageConfig = JSON.parse(pageConfigMatch[1])
    const tokenValues = Object.values(pageConfig.tokens || {})
    const tokenEntry = tokenValues.find(entry => entry.texts && entry.texts.some(t => t.raw.includes('mathExpression')))
    assert.ok(tokenEntry)
    assert.equal(tokenEntry.texts[0].type, 'text')
  })

  it('separates plain text tokens from HTML tokens in the same text node and preserves sibling textIndex', async () => {
    await writeFile(join(pagesDir, 'index.html'), `<!DOCTYPE html>
    <html>
    <body>
      <p id="combined">Greeting: {{ greeting }} and {{ htmlSnippet }}!<em>middle</em> - {{ footer }}</p>
    </body>
    </html>
    <script type="module">
      import { definePage } from 'coralite'
      export default definePage({
        server () {
          return {
            greeting: 'Welcome',
            htmlSnippet: '<span class="inner">Inner HTML</span>',
            footer: 'End'
          }
        },
        client () {}
      })
    </script>`)

    const app = await createCoralite({
      components: componentsDir,
      pages: pagesDir,
      output: outputDir,
      mode: 'production',
      incremental: false
    })

    const results = await app.build()
    const html = results[0].content
    const markupOnly = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')

    assert.ok(markupOnly.includes('Greeting: Welcome and <c-token'), 'plain text token before HTML token in same text node should be resolved')
    assert.ok(markupOnly.includes('<span class="inner">Inner HTML</span></c-token>!<em>middle</em> - End'), 'html token and trailing sibling text token should be resolved')

    const pageConfigMatch = html.match(/coralite\.config\.page = Object\.assign\(\s*\{\},\s*coralite\.config\.page \|\| \{\},\s*(\{[\s\S]*?\})\s*\);/)
    assert.ok(pageConfigMatch)
    const pageConfig = JSON.parse(pageConfigMatch[1])
    const tokenValues = Object.values(pageConfig.tokens || {})

    const htmlTokens = tokenValues.filter(e => e.texts && e.texts.some(t => t.type === 'html'))
    const textTokenEntry = tokenValues.find(e => e.texts && e.texts.some(t => t.type === 'text'))
    assert.equal(htmlTokens.length, 1, 'exactly 1 html token entry on <c-token>')
    assert.ok(textTokenEntry, 'parent element should have plain text token entry')
    assert.equal(textTokenEntry.texts.length, 2, 'parent element should track both plain text nodes (before HTML token and after <em>)')
    assert.equal(textTokenEntry.texts[0].textIndex, 0)
    assert.equal(textTokenEntry.texts[0].raw, 'Greeting: {{ greeting }} and ')
    assert.equal(textTokenEntry.texts[1].textIndex, 2)
    assert.equal(textTokenEntry.texts[1].raw, ' - {{ footer }}')
  })

  it('renders slotted HTML page tokens inside custom elements as parsed DOM wrapped in <c-token>', async () => {
    await writeFile(join(componentsDir, 'my-box.html'), `<template id="my-box">
      <div class="box"><slot></slot></div>
    </template>`)

    await writeFile(join(pagesDir, 'index.html'), `<!DOCTYPE html>
    <html>
    <body>
      <my-box>{{ htmlSnippet }}</my-box>
    </body>
    </html>
    <script type="module">
      import { definePage } from 'coralite'
      export default definePage({
        server () {
          return {
            htmlSnippet: '<strong class="slotted-rich">Rich Slot</strong>'
          }
        },
        client () {}
      })
    </script>`)

    const app = await createCoralite({
      components: componentsDir,
      pages: pagesDir,
      output: outputDir,
      mode: 'production',
      incremental: false
    })

    const results = await app.build()
    const html = results[0].content
    const markupOnly = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')

    assert.ok(markupOnly.includes('<strong class="slotted-rich">Rich Slot</strong>'), 'Slotted HTML token must be parsed into DOM inside the component slot')

    const pageConfigMatch = html.match(/coralite\.config\.page = Object\.assign\(\s*\{\},\s*coralite\.config\.page \|\| \{\},\s*(\{[\s\S]*?\})\s*\);/)
    assert.ok(pageConfigMatch)
    const pageConfig = JSON.parse(pageConfigMatch[1])
    const tokenValues = Object.values(pageConfig.tokens || {})
    const htmlTokenEntry = tokenValues.find(entry => entry.texts && entry.texts.some(t => t.type === 'html'))
    assert.ok(htmlTokenEntry, 'Slotted HTML token must be registered with type: "html"')
    assert.equal(htmlTokenEntry.texts[0].raw, '{{ htmlSnippet }}')
  })
})
