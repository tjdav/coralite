import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { createCoralite } from '#lib'

function extractHydration (html) {
  const match = html.match(/coralite\.state\.hydration\s*=\s*Object\.assign\(\s*\{\},\s*coralite\.state\.hydration\s*\|\|\s*\{\},\s*(\{[\s\S]*?\})\s*\);/)
  assert.ok(match, 'Expected hydration payload')
  return Function(`return ${match[1]}`)()
}

function extractPageConfig (html) {
  const match = html.match(/coralite\.config\.page\s*=\s*Object\.assign\(\s*\{\},\s*coralite\.config\.page\s*\|\|\s*\{\},\s*(\{[\s\S]*?\})\s*\);/)
  assert.ok(match, 'Expected page config payload')
  return Function(`return ${match[1]}`)()
}

describe('Hydration payload pruning', () => {
  let root
  let coralite
  let html

  before(async () => {
    root = await mkdtemp(join(tmpdir(), 'coralite-hydration-pruning-'))
    const pages = join(root, 'pages')
    const components = join(root, 'components')

    await mkdir(pages, { recursive: true })
    await mkdir(components, { recursive: true })

    await writeFile(join(components, 'static-badge.html'), `<template id="static-badge">
  <span class="badge">{{ label }}</span>
</template>

<script type="module">
  export const attributes = {
    label: { type: String, default: 'badge' }
  }
</script>
`)

    await writeFile(join(components, 'client-card.html'), `<template id="client-card">
  <button ref="button">{{ display }}</button>
</template>

<script type="module">
  export const attributes = {
    label: { type: String, default: '' }
  }

  export const getters = {
    display: ({ state }) => state.label ? state.label.toUpperCase() : 'none'
  }

  export function client ({ refs }) {
    refs('button').addEventListener('click', () => {})
  }
</script>
`)

    await writeFile(join(pages, 'index.html'), `<!DOCTYPE html>
<html>
<head><title>{{ title }}</title></head>
<body>
  <static-badge label="static"></static-badge>
  <client-card label="Child label"></client-card>
</body>
</html>

<script type="module">
  export function server () {
    // HYDRATION_PAGE_SOURCE_MARKER
    return {
      title: 'Hello',
      label: 'Page label',
      event: { id: 1 },
      related: [{ id: 2 }],
      big: { a: 1 }
    }
  }
</script>
`)

    coralite = await createCoralite({
      components,
      pages,
      output: join(root, 'dist'),
      mode: 'production',
      incremental: false
    })

    const results = await coralite.build()
    assert.equal(results.length, 1)
    html = results[0].content
  })

  after(async () => {
    if (coralite) {
      await coralite.clearCache(true)
    }
    await rm(root, {
      recursive: true,
      force: true
    }).catch(() => {
    })
  })

  it('omits hydration entries for static attributes-only components', () => {
    const hydration = extractHydration(html)
    assert.equal(Object.hasOwn(hydration, 'static-badge-0'), false)
    assert.equal(Object.hasOwn(hydration, 'client-card-0'), true)
  })

  it('serializes only component-owned state in component entries', () => {
    const hydration = extractHydration(html)
    const entry = hydration['client-card-0']

    assert.equal(entry.label, 'Child label')
    assert.equal(entry.display, 'CHILD LABEL')
    assert.deepEqual(entry.errors, {})
    assert.equal(Object.hasOwn(entry, 'page'), false)
    assert.equal(Object.hasOwn(entry, 'title'), false)
    assert.equal(Object.hasOwn(entry, 'event'), false)
    assert.equal(Object.hasOwn(entry, 'related'), false)
    assert.equal(Object.hasOwn(entry, 'big'), false)
  })

  it('serializes page state once with a minimal page descriptor', () => {
    const pageConfig = extractPageConfig(html)
    assert.equal(pageConfig.state.title, 'Hello')
    assert.equal(pageConfig.state.label, 'Page label')
    assert.deepEqual(pageConfig.state.event, { id: 1 })
    assert.deepEqual(pageConfig.state.related, [{ id: 2 }])
    assert.deepEqual(pageConfig.state.big, { a: 1 })

    const page = pageConfig.state.page
    assert.equal(page.url.pathname, '/')
    assert.equal(page.url.dirname, '/')
    assert.equal(page.route.path, '/')
    assert.equal(page.is404, false)

    for (const key of [
      'file',
      'script',
      'blocks',
      'scriptLineOffset',
      'enumeratedPaths',
      'hasDefinePage',
      'hasPageExports',
      'routeSegments'
    ]) {
      assert.equal(Object.hasOwn(page, key), false, `page.${key} must not be serialized`)
    }
  })

  it('does not leak the page controller source into rendered HTML', () => {
    assert.equal(html.includes('HYDRATION_PAGE_SOURCE_MARKER'), false)
  })
})
