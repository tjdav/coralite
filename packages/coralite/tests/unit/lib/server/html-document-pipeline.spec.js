import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { createCoralite } from '#lib'
import { extractScriptTagsFromHTML } from '../../../../lib/server/utils/parse.js'
import { validatePageSource } from '../../../../lib/server/page/validator.js'
import { validateComponentSource } from '../../../../lib/server/component/validator.js'

describe('HTML document pipeline and coralite-ignore', () => {
  let projectDir
  let pagesDir
  let componentsDir
  let app

  beforeEach(async () => {
    projectDir = await mkdtemp(join(tmpdir(), 'coralite-document-pipeline-'))
    pagesDir = join(projectDir, 'pages')
    componentsDir = join(projectDir, 'components')
    await mkdir(pagesDir, { recursive: true })
    await mkdir(componentsDir, { recursive: true })
    await writeFile(join(projectDir, 'package.json'), JSON.stringify({ type: 'module' }))
    app = null
  })

  afterEach(async () => {
    if (app) {
      try {
        await app.clearCache(true)
      } catch {
        // The build may have failed before the cache was initialized.
      }
    }
    if (projectDir) {
      await rm(projectDir, {
        recursive: true,
        force: true
      })
    }
  })

  async function writeProjectFile (relativePath, content) {
    const target = join(projectDir, relativePath)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, content)
  }

  async function buildProject (mode = 'production') {
    app = await createCoralite({
      projectRoot: projectDir,
      pages: pagesDir,
      components: componentsDir,
      output: join(projectDir, 'dist'),
      mode,
      incremental: false
    })
    return app.build()
  }

  function extractPageConfig (html) {
    const match = html.match(/coralite\.config\.page = Object\.assign\(\s*\{\},\s*coralite\.config\.page \|\| \{\},\s*(\{[\s\S]*?\})\s*\);/)
    return match ? JSON.parse(match[1]) : null
  }

  it('removes the page controller, keeps normal scripts, and honours coralite-ignore in production', async () => {
    await writeProjectFile('components/code-block.html', `<template id="code-block"><pre><code><slot coralite-ignore></slot></code></pre></template>`)
    await writeProjectFile('pages/index.html', `<!DOCTYPE html>
<html>
<head><script src="/analytics.js"></script></head>
<body>
  <h1>{{ title }}</h1>
  <code-block>
    <template id="counter"><span>{{ count }}</span></template>
    <script type="module">export function server () { return { count: 0 } }</script>
  </code-block>
  <div coralite-ignore><p>{{ literal }}</p><unknown-demo></unknown-demo></div>
  <script>console.log("{{ notAToken }}")</script>
</body>
</html>
<script type="module">
  export function server () { return { title: 'Pipeline' } }
  export const getters = { greeting: ({ state }) => state.title }
</script>`)

    const result = await buildProject('production')
    const html = result[0].content

    assert.ok(html.includes('Pipeline'))
    assert.ok(html.includes('/analytics.js'))
    assert.ok(!html.includes("export function server () { return { title: 'Pipeline' } }"), 'page controller must be stripped')
    assert.ok(html.includes('{{ count }}'), 'ignored slot content must stay literal')
    assert.ok(html.includes('{{ literal }}'), 'ignored element content must stay literal')
    assert.ok(!html.includes('<unknown-demo data-cid'), 'ignored custom elements must not compile')
    assert.ok(html.includes('{{ notAToken }}'), 'script text must not be interpolated')
    assert.ok(html.includes('data-cid="code-block-0"'), 'the component hosting an ignored slot must still compile')

    const pageConfig = extractPageConfig(html)
    assert.ok(pageConfig)
    assert.ok(!Object.hasOwn(pageConfig.state.page, 'script'))
    assert.ok(!Object.hasOwn(pageConfig.state.page, 'blocks'))
  })

  it('matches production behaviour in development mode', async () => {
    await writeProjectFile('components/code-block.html', `<template id="code-block"><pre><code><slot coralite-ignore></slot></code></pre></template>`)
    await writeProjectFile('pages/index.html', `<!DOCTYPE html>
<html><body>
  <h1>{{ title }}</h1>
  <code-block><span>{{ count }}</span></code-block>
</body></html>
<script type="module">
  export function server () { return { title: 'Dev Pipeline' } }
</script>`)

    const result = await buildProject('development')
    const html = result[0].content

    assert.ok(html.includes('Dev Pipeline'))
    assert.ok(!html.includes("export function server () { return { title: 'Dev Pipeline' } }"))
    assert.ok(html.includes('{{ count }}'))
  })

  it('leaves a custom element and its subtree untouched when coralite-ignore is on the element', async () => {
    await writeProjectFile('components/ui-card.html', `<template id="ui-card"><div class="card"><slot></slot></div></template>`)
    await writeProjectFile('pages/index.html', `<!DOCTYPE html>
<html><body>
  <ui-card coralite-ignore><span>{{ literal }}</span><inner-demo></inner-demo></ui-card>
</body></html>`)

    const result = await buildProject('production')
    const html = result[0].content

    assert.ok(html.includes('<ui-card coralite-ignore>'))
    assert.ok(html.includes('{{ literal }}'))
    assert.ok(!html.includes('data-cid="ui-card'), 'ignored custom element must not compile')
    assert.ok(!html.includes('<inner-demo data-cid'), 'nested custom elements must not compile')
  })

  it('does not interpolate script or style text without an explicit directive', async () => {
    await writeProjectFile('pages/index.html', `<!DOCTYPE html>
<html><head><style>.x::after { content: "{{ styleToken }}" }</style></head>
<body><script>console.log("{{ scriptToken }}")</script></body></html>`)

    const result = await buildProject('production')
    const html = result[0].content

    assert.ok(html.includes('{{ styleToken }}'))
    assert.ok(html.includes('{{ scriptToken }}'))
  })

  it('fails the page when more than one page controller script exists', async () => {
    await writeProjectFile('pages/index.html', `<!DOCTYPE html><html><body><h1>Duplicate</h1></body></html>
<script type="module">export function server () { return {} }</script>
<script type="module">export const getters = { title: () => 'x' }</script>`)

    await assert.rejects(
      () => buildProject('production'),
      (error) => {
        assert.match(error.message, /Multiple page controller/)
        assert.match(error.message, /index\.html/)
        return true
      }
    )
  })

  it('suppresses component token replacement, compilation, and validation inside coralite-ignore', async () => {
    await writeProjectFile('components/ignored-comp.html', `<template id="ignored-comp">
  <div coralite-ignore><span>{{ raw }}</span><inner-demo></inner-demo></div>
  <p>{{ rendered }}</p>
</template>
<script type="module">
  export function server () { return { rendered: 'Rendered' } }
</script>`)
    await writeProjectFile('pages/index.html', '<!DOCTYPE html><html><body><ignored-comp></ignored-comp></body></html>')

    const result = await buildProject('production')
    const html = result[0].content

    assert.ok(html.includes('{{ raw }}'))
    assert.ok(html.includes('Rendered'))
    assert.ok(!html.includes('<inner-demo data-cid'))
  })

  it('processes raw slot fallback content normally', async () => {
    await writeProjectFile('components/code-block.html', `<template id="code-block"><pre><code><slot coralite-ignore><span>{{ fallback }}</span></slot></code></pre></template>
<script type="module">
  export function server () { return { fallback: 'Fallback Text' } }
</script>`)
    await writeProjectFile('pages/index.html', '<!DOCTYPE html><html><body><code-block></code-block></body></html>')

    const result = await buildProject('production')
    assert.ok(result[0].content.includes('Fallback Text'))
  })

  it('extracts script offsets and skips coralite-ignore subtrees', () => {
    const source = `<div>
  <!-- <script>ignored by comment</script> -->
  <script type="module">
    export const value = 1
  </script>
  <div coralite-ignore><script>ignored()</script></div>
</div>`

    const scripts = extractScriptTagsFromHTML(source)
    assert.strictEqual(scripts.length, 1)
    const script = scripts[0]
    assert.strictEqual(source.slice(script.contentStart, script.contentEnd).trim(), 'export const value = 1')
    assert.strictEqual(source.slice(script.tagStart, script.tagStart + 7), '<script')
    assert.strictEqual(source.slice(script.tagEnd - 9, script.tagEnd), '</script>')
    assert.strictEqual(script.lineOffset, 2)
  })

  it('reports duplicate controllers in the page validator', () => {
    const source = `<!DOCTYPE html><html><body></body></html>
<script type="module">export function server () { return {} }</script>
<script type="module">export const getters = { title: () => 'x' }</script>`

    const result = validatePageSource(source, {
      knownComponents: new Map()
    })

    const diagnostic = result.diagnostics.find(item => item.code === 'CORALITE-E107')
    assert.ok(diagnostic)
    assert.match(diagnostic.message, /Multiple page controller/)
  })

  it('uses ignored slot metadata from known components in the page validator', () => {
    const source = '<code-block><unknown-demo></unknown-demo></code-block>'

    const flagged = validatePageSource(source, {
      knownComponents: new Map([
        ['code-block', {
          attributes: {},
          slots: ['default']
        }]
      ])
    })
    assert.ok(flagged.diagnostics.some(item => item.code === 'CORALITE-PAGE-101'))

    const ignored = validatePageSource(source, {
      knownComponents: new Map([
        ['code-block', {
          attributes: {},
          slots: ['default'],
          ignoredSlots: ['default']
        }]
      ])
    })
    assert.ok(!ignored.diagnostics.some(item => item.code === 'CORALITE-PAGE-101'))
  })

  it('records ignored template slots and skips diagnostics inside coralite-ignore subtrees', () => {
    const result = validateComponentSource(`<template id="x-demo">
  <div coralite-ignore><span>{{ raw }}</span><inner-demo></inner-demo></div>
  <slot coralite-ignore></slot>
</template>`)

    assert.deepEqual(result.defined.ignoredSlots, ['default'])
    assert.deepEqual(result.defined.templateSlots, [{
      name: 'default',
      isIgnoredSlot: true
    }])
    assert.ok(!result.diagnostics.some(item => item.message.includes('{{ raw }}')))
  })

  it('preserves unknown page tokens in regular custom-element slots', async () => {
    await writeProjectFile('components/ui-card.html', `<template id="ui-card"><div class="card"><slot></slot></div></template>`)
    await writeProjectFile('pages/index.html', `<!DOCTYPE html>
<html><body>
  <ui-card>
    <span>{{ known }}</span>
    <span>{{ missing }}</span>
    <a href="{{ missingUrl }}">link</a>
  </ui-card>
</body></html>
<script type="module">
  export function server () { return { known: 'Known' } }
</script>`)

    const result = await buildProject('production')
    const html = result[0].content

    assert.ok(html.includes('Known'))
    assert.ok(html.includes('{{ missing }}'))
    assert.ok(html.includes('{{ missingUrl }}'))
  })
})
