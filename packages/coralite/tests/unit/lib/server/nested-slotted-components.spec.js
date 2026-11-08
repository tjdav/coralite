import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { rm, writeFile, mkdir } from 'node:fs/promises'
import createCoralite from '../../../../lib/server/create.js'

describe('Nested Slotted Custom Elements SSR and Hydration', () => {
  it('stamps templates and registers declarativeTags for custom elements nested in slotted HTML', async () => {
    const tmpDir = path.resolve('packages/coralite/tests/unit/lib/server/tmp-nested-slot-test-1')
    const pagesDir = path.join(tmpDir, 'pages')
    const componentsDir = path.join(tmpDir, 'components')

    await rm(tmpDir, {
      recursive: true,
      force: true
    })
    await mkdir(pagesDir, { recursive: true })
    await mkdir(componentsDir, { recursive: true })

    const cardHtml = `<template id="ui-card">
  <div class="card">
    <div class="card-header">
      <slot name="header"></slot>
    </div>
    <div class="card-body">
      <slot></slot>
    </div>
  </div>
</template>
<script type="module">
  export function client () {}
</script>`

    const iconHtml = `<template id="ui-icon">
  <span class="icon-inner" data-name="{{ name }}" data-size="{{ size }}">Icon: {{ name }}</span>
</template>
<script type="module">
  export const attributes = {
    name: { type: String, default: '' },
    size: { type: Number, default: 16 }
  }
  export function client () {}
</script>
<style>
  :host { display: inline-flex; }
</style>`

    const pageHtml = `<!DOCTYPE html>
<html>
  <head><title>Nested Slotted Test</title></head>
  <body>
    <ui-card>
      <div slot="header" class="module-title">
        <ui-icon name="doc" size="20"></ui-icon>
        <h3>Module 1: HTML Foundations</h3>
      </div>
      <p>Card body content</p>
    </ui-card>
  </body>
</html>`

    await writeFile(path.join(componentsDir, 'ui-card.html'), cardHtml, 'utf8')
    await writeFile(path.join(componentsDir, 'ui-icon.html'), iconHtml, 'utf8')
    await writeFile(path.join(pagesDir, 'index.html'), pageHtml, 'utf8')

    try {
      const app = await createCoralite({
        components: componentsDir,
        pages: pagesDir,
        plugins: [],
        mode: 'production',
        cleanUrls: false
      })

      const results = await app.build()
      await app.clearCache(true)

      assert.strictEqual(results.length, 1)
      const content = results[0].content

      // Verify ui-icon template was stamped with attributes
      assert.ok(content.includes('data-name="doc"'), 'ui-icon template should stamp attribute name')
      assert.ok(content.includes('data-size="20"'), 'ui-icon template should stamp attribute size')
      assert.match(content, /Icon:\s*<c-token[^>]*>doc<\/c-token>/, 'ui-icon template text token should be rendered inside c-token')

      // Verify ui-icon has data-cid and data-coralite-initial
      assert.match(content, /<ui-icon[^>]*data-cid="ui-icon-\d+"[^>]*data-coralite-initial/, 'ui-icon should have data-cid and data-coralite-initial stamped')

      // Verify declarativeTags includes both ui-card and ui-icon
      assert.match(content, /declarativeTags\s*=\s*\[[^\]]*"ui-card"[^\]]*\]/, 'declarativeTags must include ui-card')
      assert.match(content, /declarativeTags\s*=\s*\[[^\]]*"ui-icon"[^\]]*\]/, 'declarativeTags must include ui-icon')

      // Verify styles were collected
      assert.ok(content.includes('display: inline-flex'), 'ui-icon component styles should be collected in document')
    } finally {
      await rm(tmpDir, {
        recursive: true,
        force: true
      })
    }
  })

  it('isolates slotted child components from host attribute schema collisions', async () => {
    const tmpDir = path.resolve('packages/coralite/tests/unit/lib/server/tmp-nested-slot-test-2')
    const pagesDir = path.join(tmpDir, 'pages')
    const componentsDir = path.join(tmpDir, 'components')

    await rm(tmpDir, {
      recursive: true,
      force: true
    })
    await mkdir(pagesDir, { recursive: true })
    await mkdir(componentsDir, { recursive: true })

    const cardHtml = `<template id="ui-card">
  <div class="card {{ size }} {{ variant }}">
    <slot name="header"></slot>
  </div>
</template>
<script type="module">
  export const attributes = {
    size: { type: String, default: 'md' },
    variant: { type: String, default: 'plain' }
  }
</script>`

    const iconHtml = `<template id="ui-icon">
  <span class="icon-inner" data-name="{{ name }}" data-size="{{ size }}" data-variant="{{ variant }}">Icon</span>
</template>
<script type="module">
  export const attributes = {
    name: { type: String, default: '' },
    size: { type: Number, default: 16 },
    variant: { type: String, values: ['solid', 'outline'], default: 'solid' }
  }
  export function client () {}
</script>`

    // Host specifies size="lg" (string) and variant="elevated" which would collide with ui-icon's schema
    const pageHtml = `<!DOCTYPE html>
<html>
  <head><title>Collision Test</title></head>
  <body>
    <ui-card size="lg" variant="elevated">
      <div slot="header">
        <ui-icon name="doc"></ui-icon>
      </div>
    </ui-card>
  </body>
</html>`

    await writeFile(path.join(componentsDir, 'ui-card.html'), cardHtml, 'utf8')
    await writeFile(path.join(componentsDir, 'ui-icon.html'), iconHtml, 'utf8')
    await writeFile(path.join(pagesDir, 'index.html'), pageHtml, 'utf8')

    try {
      const app = await createCoralite({
        components: componentsDir,
        pages: pagesDir,
        plugins: [],
        mode: 'production',
        cleanUrls: false
      })

      const results = await app.build()
      await app.clearCache(true)

      assert.strictEqual(results.length, 1)
      const content = results[0].content

      // ui-card renders its attributes
      assert.ok(content.includes('card lg elevated'), 'ui-card should render with size="lg" and variant="elevated"')

      // ui-icon should NOT inherit host size="lg" or variant="elevated"; it should retain its own schema defaults
      assert.ok(content.includes('data-size="16"'), 'ui-icon should retain default size=16')
      assert.ok(content.includes('data-variant="solid"'), 'ui-icon should retain default variant="solid"')
      assert.match(content, /declarativeTags\s*=\s*\[[^\]]*"ui-icon"[^\]]*\]/, 'ui-icon should be registered in declarativeTags')
    } finally {
      await rm(tmpDir, {
        recursive: true,
        force: true
      })
    }
  })

  it('supports multi-level slotted custom elements and propagates context across slot boundaries', async () => {
    const tmpDir = path.resolve('packages/coralite/tests/unit/lib/server/tmp-nested-slot-test-3')
    const pagesDir = path.join(tmpDir, 'pages')
    const componentsDir = path.join(tmpDir, 'components')

    await rm(tmpDir, {
      recursive: true,
      force: true
    })
    await mkdir(pagesDir, { recursive: true })
    await mkdir(componentsDir, { recursive: true })

    const providerHtml = `<template id="theme-provider">
  <div class="theme-root">
    <slot></slot>
  </div>
</template>
<script type="module">
  export const provide = {
    theme: ({ state }) => state.theme || 'dark'
  }
  export const attributes = {
    theme: { type: String, default: 'dark' }
  }
</script>`

    const cardHtml = `<template id="ui-card">
  <div class="card-box">
    <slot name="header"></slot>
  </div>
</template>
<script type="module">
  export const provide = {
    cardVariant: () => 'special'
  }
  export function client () {}
</script>`

    const iconHtml = `<template id="ui-icon">
  <span class="icon" data-theme="{{ theme }}" data-variant="{{ cardVariant }}">Icon</span>
</template>
<script type="module">
  export const consume = ['theme', 'cardVariant']
  export function client () {}
</script>`

    const pageHtml = `<!DOCTYPE html>
<html>
  <head><title>Context Propagation Test</title></head>
  <body>
    <theme-provider theme="midnight">
      <div class="wrapper">
        <ui-card>
          <header slot="header" class="header-box">
            <ui-icon></ui-icon>
          </header>
        </ui-card>
      </div>
    </theme-provider>
  </body>
</html>`

    await writeFile(path.join(componentsDir, 'theme-provider.html'), providerHtml, 'utf8')
    await writeFile(path.join(componentsDir, 'ui-card.html'), cardHtml, 'utf8')
    await writeFile(path.join(componentsDir, 'ui-icon.html'), iconHtml, 'utf8')
    await writeFile(path.join(pagesDir, 'index.html'), pageHtml, 'utf8')

    try {
      const app = await createCoralite({
        components: componentsDir,
        pages: pagesDir,
        plugins: [],
        mode: 'production',
        cleanUrls: false
      })

      const results = await app.build()
      await app.clearCache(true)

      assert.strictEqual(results.length, 1)
      const content = results[0].content

      // Verify ui-icon consumed context values across all nested slot boundaries
      assert.ok(content.includes('data-theme="midnight"'), 'ui-icon should consume theme from theme-provider across slot boundary')
      assert.ok(content.includes('data-variant="special"'), 'ui-icon should consume cardVariant from ui-card across slot boundary')
      assert.match(content, /declarativeTags\s*=\s*\[[^\]]*"ui-icon"[^\]]*\]/, 'ui-icon should be in declarativeTags')
      assert.match(content, /declarativeTags\s*=\s*\[[^\]]*"ui-card"[^\]]*\]/, 'ui-card should be in declarativeTags')
    } finally {
      await rm(tmpDir, {
        recursive: true,
        force: true
      })
    }
  })

  it('defers custom elements inside slot fallback content unless fallback actually runs', async () => {
    const tmpDir = path.resolve('packages/coralite/tests/unit/lib/server/tmp-nested-slot-test-4')
    const pagesDir = path.join(tmpDir, 'pages')
    const componentsDir = path.join(tmpDir, 'components')

    await rm(tmpDir, {
      recursive: true,
      force: true
    })
    await mkdir(pagesDir, { recursive: true })
    await mkdir(componentsDir, { recursive: true })

    const cardHtml = `<template id="ui-card">
  <div class="card">
    <slot name="header">
      <div class="fallback-wrap">
        <ui-badge text="Fallback Badge"></ui-badge>
      </div>
    </slot>
  </div>
</template>`

    const badgeHtml = `<template id="ui-badge">
  <span class="badge">{{ text }}</span>
</template>
<script type="module">
  export const attributes = {
    text: { type: String, default: 'Default Badge' }
  }
  export function client () {}
</script>`

    // Page 1 overrides the slot; fallback is discarded
    const pageWithOverride = `<!DOCTYPE html>
<html>
  <body>
    <ui-card>
      <div slot="header">Custom Provided Header</div>
    </ui-card>
  </body>
</html>`

    // Page 2 omits slot; fallback executes
    const pageWithFallback = `<!DOCTYPE html>
<html>
  <body>
    <ui-card></ui-card>
  </body>
</html>`

    await writeFile(path.join(componentsDir, 'ui-card.html'), cardHtml, 'utf8')
    await writeFile(path.join(componentsDir, 'ui-badge.html'), badgeHtml, 'utf8')
    await writeFile(path.join(pagesDir, 'override.html'), pageWithOverride, 'utf8')
    await writeFile(path.join(pagesDir, 'fallback.html'), pageWithFallback, 'utf8')

    try {
      const app = await createCoralite({
        components: componentsDir,
        pages: pagesDir,
        plugins: [],
        mode: 'production',
        cleanUrls: false
      })

      const results = await app.build()
      await app.clearCache(true)

      const overridePage = results.find(r => r.path?.pathname?.endsWith('override.html'))?.content || ''
      const fallbackPage = results.find(r => r.path?.pathname?.endsWith('fallback.html'))?.content || ''

      // In override page, fallback badge must NOT be rendered or in declarativeTags
      assert.ok(overridePage.includes('Custom Provided Header'), 'Provided header should be rendered')
      assert.ok(!overridePage.includes('Fallback Badge'), 'Fallback badge should not be rendered when slot is overridden')
      assert.ok(!overridePage.includes('"ui-badge"'), 'ui-badge should not be in declarativeTags on override page')

      // In fallback page, fallback badge MUST be rendered and in declarativeTags
      assert.ok(fallbackPage.includes('Fallback Badge'), 'Fallback badge should be rendered when slot falls back')
      assert.ok(fallbackPage.includes('data-coralite-fallback'), 'Slot should have data-coralite-fallback stamped')
      assert.match(fallbackPage, /declarativeTags\s*=\s*\[[^\]]*"ui-badge"[^\]]*\]/, 'ui-badge should be in declarativeTags on fallback page')
    } finally {
      await rm(tmpDir, {
        recursive: true,
        force: true
      })
    }
  })

  it('compiles Coralite components nested inside unregistered third-party custom elements', async () => {
    const tmpDir = path.resolve('packages/coralite/tests/unit/lib/server/tmp-nested-slot-test-5')
    const pagesDir = path.join(tmpDir, 'pages')
    const componentsDir = path.join(tmpDir, 'components')

    await rm(tmpDir, {
      recursive: true,
      force: true
    })
    await mkdir(pagesDir, { recursive: true })
    await mkdir(componentsDir, { recursive: true })

    const cardHtml = `<template id="ui-card">
  <div class="card">
    <slot></slot>
  </div>
</template>
<script type="module">
  export function client () {}
</script>`

    const iconHtml = `<template id="ui-icon">
  <span class="icon">{{ name }}</span>
</template>
<script type="module">
  export const attributes = { name: { type: String, default: '' } }
  export function client () {}
</script>`

    // swiper-container and swiper-slide are unregistered hyphenated custom elements
    const pageHtml = `<!DOCTYPE html>
<html>
  <body>
    <swiper-container>
      <swiper-slide>
        <ui-card>
          <div class="inner">
            <ui-icon name="swiper-star"></ui-icon>
          </div>
        </ui-card>
      </swiper-slide>
    </swiper-container>
  </body>
</html>`

    await writeFile(path.join(componentsDir, 'ui-card.html'), cardHtml, 'utf8')
    await writeFile(path.join(componentsDir, 'ui-icon.html'), iconHtml, 'utf8')
    await writeFile(path.join(pagesDir, 'index.html'), pageHtml, 'utf8')

    try {
      const app = await createCoralite({
        components: componentsDir,
        pages: pagesDir,
        plugins: [],
        mode: 'production',
        cleanUrls: false
      })

      const results = await app.build()
      await app.clearCache(true)

      assert.strictEqual(results.length, 1)
      const content = results[0].content

      // Unregistered containers remain intact
      assert.ok(content.includes('<swiper-container>'), 'swiper-container should remain in output')
      assert.ok(content.includes('<swiper-slide>'), 'swiper-slide should remain in output')

      // Coralite components inside them are compiled and stamped
      assert.ok(content.includes('swiper-star'), 'ui-icon template should be stamped')
      assert.match(content, /declarativeTags\s*=\s*\[[^\]]*"ui-card"[^\]]*\]/, 'ui-card should be in declarativeTags')
      assert.match(content, /declarativeTags\s*=\s*\[[^\]]*"ui-icon"[^\]]*\]/, 'ui-icon should be in declarativeTags')
    } finally {
      await rm(tmpDir, {
        recursive: true,
        force: true
      })
    }
  })

  it('cascades no-hydration from intermediate HTML wrapper elements', async () => {
    const tmpDir = path.resolve('packages/coralite/tests/unit/lib/server/tmp-nested-slot-test-6')
    const pagesDir = path.join(tmpDir, 'pages')
    const componentsDir = path.join(tmpDir, 'components')

    await rm(tmpDir, {
      recursive: true,
      force: true
    })
    await mkdir(pagesDir, { recursive: true })
    await mkdir(componentsDir, { recursive: true })

    const cardHtml = `<template id="ui-card">
  <div class="card">
    <slot name="header"></slot>
  </div>
</template>`

    const iconHtml = `<template id="ui-icon">
  <span class="static-icon">{{ name }}</span>
</template>
<script type="module">
  export const attributes = { name: { type: String, default: '' } }
  export function client () {}
</script>`

    // The intermediate div carrying no-hydration wraps ui-icon
    const pageHtml = `<!DOCTYPE html>
<html>
  <body>
    <ui-card>
      <div slot="header" no-hydration>
        <ui-icon name="static-doc"></ui-icon>
      </div>
    </ui-card>
  </body>
</html>`

    await writeFile(path.join(componentsDir, 'ui-card.html'), cardHtml, 'utf8')
    await writeFile(path.join(componentsDir, 'ui-icon.html'), iconHtml, 'utf8')
    await writeFile(path.join(pagesDir, 'index.html'), pageHtml, 'utf8')

    try {
      const app = await createCoralite({
        components: componentsDir,
        pages: pagesDir,
        plugins: [],
        mode: 'production',
        cleanUrls: false
      })

      const results = await app.build()
      await app.clearCache(true)

      assert.strictEqual(results.length, 1)
      const content = results[0].content

      // ui-icon rendered template into static span
      assert.ok(content.includes('static-doc'), 'ui-icon content should be rendered')

      // ui-icon tag should be unwrapped because of no-hydration
      assert.ok(!content.includes('<ui-icon'), 'ui-icon tag should be unwrapped in no-hydration mode')

      // ui-icon should NOT be registered in declarativeTags
      assert.ok(!content.includes('"ui-icon"'), 'ui-icon should not be in declarativeTags')
    } finally {
      await rm(tmpDir, {
        recursive: true,
        force: true
      })
    }
  })

  it('handles computed slots returning HTML strings with custom elements without double stamping', async () => {
    const tmpDir = path.resolve('packages/coralite/tests/unit/lib/server/tmp-nested-slot-test-7')
    const pagesDir = path.join(tmpDir, 'pages')
    const componentsDir = path.join(tmpDir, 'components')

    await rm(tmpDir, {
      recursive: true,
      force: true
    })
    await mkdir(pagesDir, { recursive: true })
    await mkdir(componentsDir, { recursive: true })

    const wrapperHtml = `<template id="ui-wrapper">
  <div class="wrap">
    <slot name="computed"></slot>
  </div>
</template>
<script type="module">
  export const slots = {
    computed () {
      return '<div class="computed-box"><ui-computed-item name="dynamic-item"></ui-computed-item></div>'
    }
  }
</script>`

    const itemHtml = `<template id="ui-computed-item">
  <span class="computed-badge">{{ name }}</span>
</template>
<script type="module">
  export const attributes = { name: { type: String, default: '' } }
  export function client () {}
</script>`

    const pageHtml = `<!DOCTYPE html>
<html>
  <body>
    <ui-wrapper></ui-wrapper>
  </body>
</html>`

    await writeFile(path.join(componentsDir, 'ui-wrapper.html'), wrapperHtml, 'utf8')
    await writeFile(path.join(componentsDir, 'ui-computed-item.html'), itemHtml, 'utf8')
    await writeFile(path.join(pagesDir, 'index.html'), pageHtml, 'utf8')

    try {
      const app = await createCoralite({
        components: componentsDir,
        pages: pagesDir,
        plugins: [],
        mode: 'production',
        cleanUrls: false
      })

      const results = await app.build()
      await app.clearCache(true)

      assert.strictEqual(results.length, 1)
      const content = results[0].content

      assert.ok(content.includes('dynamic-item'), 'computed item content should be rendered')
      assert.match(content, /declarativeTags\s*=\s*\[[^\]]*"ui-computed-item"[^\]]*\]/, 'ui-computed-item should be in declarativeTags')
      const cidMatches = content.match(/data-cid="[^"]*ui-computed-item[^"]*"/g) || []
      assert.strictEqual(cidMatches.length, 1, 'ui-computed-item should only be stamped with data-cid once')
    } finally {
      await rm(tmpDir, {
        recursive: true,
        force: true
      })
    }
  })
})
