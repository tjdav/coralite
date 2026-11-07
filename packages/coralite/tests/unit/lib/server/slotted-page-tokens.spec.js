import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createCoralite } from '#lib'

describe('slotted page tokens during SSR', () => {
  let testDir
  let componentsDir
  let pagesDir
  let outputDir

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'coralite-slotted-tokens-'))
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

  it('resolves page tokens in slotted elements within custom element default and named slots', async () => {
    await writeFile(join(componentsDir, 'ui-tabs.html'), `<template id="ui-tabs">
      <div class="tabs">
        <div class="tabs-nav"><slot name="tab"></slot></div>
        <div class="tabs-content"><slot name="panel"></slot></div>
      </div>
    </template>`)

    await writeFile(join(pagesDir, 'index.html'), `<!DOCTYPE html>
    <html>
    <body>
      <ui-tabs label="{{ tabsAriaLabel }}">
        <button slot="tab" data-tab-id="about">{{ tabAboutLabel }}</button>
        <div slot="panel" data-panel-id="about">
          <p>{{ venueAddressLine }}</p>
          <a href="{{ directionsUrl }}">{{ directionsLinkText }}</a>
        </div>
      </ui-tabs>
    </body>
    </html>
    <script type="module">
      export const getters = {
        tabsAriaLabel: () => 'Event Information Tabs',
        tabAboutLabel: () => 'About the Venue',
        venueAddressLine: () => 'Gran Teatre del Liceu, La Rambla 51-59',
        directionsUrl: () => 'https://maps.example.com/directions',
        directionsLinkText: () => 'Get Directions'
      }
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
    // Extract rendered markup by removing script tags
    const markupOnly = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')

    assert.ok(markupOnly.includes('Gran Teatre del Liceu, La Rambla 51-59'), 'address line token should be resolved')
    assert.ok(markupOnly.includes('About the Venue'), 'tab button label token should be resolved')
    assert.ok(markupOnly.includes('https://maps.example.com/directions'), 'directions URL attribute token should be resolved')
    assert.ok(markupOnly.includes('Get Directions'), 'directions link text token should be resolved')
    assert.ok(markupOnly.includes('label="Event Information Tabs"'), 'custom element host attribute token should be resolved')

    assert.ok(!markupOnly.includes('{{ venueAddressLine }}'), 'no raw venueAddressLine token in SSR markup')
    assert.ok(!markupOnly.includes('{{ tabAboutLabel }}'), 'no raw tabAboutLabel token in SSR markup')
    assert.ok(!markupOnly.includes('{{ directionsUrl }}'), 'no raw directionsUrl token in SSR markup')
    assert.ok(!markupOnly.includes('{{ directionsLinkText }}'), 'no raw directionsLinkText token in SSR markup')
    assert.ok(!markupOnly.includes('{{ tabsAriaLabel }}'), 'no raw tabsAriaLabel token in SSR markup')

    const pageConfigMatch = html.match(/coralite\.config\.page = Object\.assign\(\s*\{\},\s*coralite\.config\.page \|\| \{\},\s*(\{[\s\S]*?\})\s*\);/)
    assert.ok(pageConfigMatch, 'page config should be present')
    const pageConfig = JSON.parse(pageConfigMatch[1])
    const tokenValues = Object.values(pageConfig.tokens || {})
    assert.ok(tokenValues.some(entry => entry.texts && entry.texts.some(t => t.raw.includes('venueAddressLine'))), 'venueAddressLine should be registered in pageConfig.tokens')
    assert.ok(tokenValues.some(entry => entry.attrs && entry.attrs.href && entry.attrs.href.includes('directionsUrl')), 'directionsUrl should be registered in pageConfig.tokens')
  })

  it('wraps bare text tokens in <c-token> and resolves them during SSR', async () => {
    await writeFile(join(componentsDir, 'ui-box.html'), `<template id="ui-box">
      <div class="box"><slot></slot></div>
    </template>`)

    await writeFile(join(pagesDir, 'index.html'), `<!DOCTYPE html>
    <html>
    <body>
      <ui-box>{{ greeting }}</ui-box>
    </body>
    </html>
    <script type="module">
      export const getters = {
        greeting: () => 'Hello Coralite Slotted!'
      }
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

    assert.ok(markupOnly.includes('Hello Coralite Slotted!'), 'bare text token should be resolved in SSR')
    assert.ok(!markupOnly.includes('{{ greeting }}'), 'no raw greeting token in SSR markup')
    assert.ok(markupOnly.includes('<c-token data-coralite-page-token='), 'bare text should be wrapped in c-token with page token marker')

    const pageConfigMatch = html.match(/coralite\.config\.page = Object\.assign\(\s*\{\},\s*coralite\.config\.page \|\| \{\},\s*(\{[\s\S]*?\})\s*\);/)
    const pageConfig = JSON.parse(pageConfigMatch[1])
    const tokenValues = Object.values(pageConfig.tokens || {})
    assert.ok(tokenValues.some(entry => entry.texts && entry.texts.some(t => t.raw.includes('greeting'))), 'greeting should be registered in pageConfig.tokens')
  })

  it('recursively resolves page tokens across nested custom elements in slots', async () => {
    await writeFile(join(componentsDir, 'parent-card.html'), `<template id="parent-card">
      <div class="card">
        <h2><slot name="header"></slot></h2>
        <div class="body"><slot></slot></div>
      </div>
    </template>`)

    await writeFile(join(componentsDir, 'child-badge.html'), `<template id="child-badge">
      <span class="badge"><slot></slot></span>
    </template>`)

    await writeFile(join(pagesDir, 'index.html'), `<!DOCTYPE html>
    <html>
    <body>
      <parent-card>
        <span slot="header">{{ pageHeader }}</span>
        <p>{{ pageBody }}</p>
        <child-badge>{{ badgeText }}</child-badge>
      </parent-card>
    </body>
    </html>
    <script type="module">
      export const getters = {
        pageHeader: () => 'Card Header Title',
        pageBody: () => 'Card Body Description',
        badgeText: () => 'Verified'
      }
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

    assert.ok(markupOnly.includes('Card Header Title'), 'slotted header token should be resolved')
    assert.ok(markupOnly.includes('Card Body Description'), 'slotted body token should be resolved')
    assert.ok(markupOnly.includes('Verified'), 'nested child badge token should be resolved')

    assert.ok(!markupOnly.includes('{{ pageHeader }}'))
    assert.ok(!markupOnly.includes('{{ pageBody }}'))
    assert.ok(!markupOnly.includes('{{ badgeText }}'))
  })
})
