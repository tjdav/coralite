import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { rm, writeFile, mkdir } from 'node:fs/promises'
import createCoralite from '../../../../lib/server/create.js'

describe('Computed Slots SSR Processing', () => {
  it('processes computed slots authored with (content) reading content.length and indices', async () => {
    const tmpDir = path.resolve('packages/coralite/tests/unit/lib/server/tmp-slots-array-test')
    const pagesDir = path.join(tmpDir, 'pages')
    const componentsDir = path.join(tmpDir, 'components')

    await rm(tmpDir, {
      recursive: true,
      force: true
    })
    await mkdir(pagesDir, { recursive: true })
    await mkdir(componentsDir, { recursive: true })

    const componentHtml = `<template id="code-block">
  <div class="code-wrap">
    <pre><code><slot></slot></code></pre>
  </div>
</template>
<script type="module">
  import { defineComponent } from 'coralite'
  export default defineComponent({
    slots: {
      default (content) {
        if (typeof window !== 'undefined') {
          return
        }
        const result = []
        for (let i = 0; i < content.length; i++) {
          result.push(content[i])
        }
        return result
      }
    }
  })
</script>`

    const pageHtml = `<!DOCTYPE html>
<html>
  <body>
    <code-block>coralite [options]</code-block>
  </body>
</html>`

    await writeFile(path.join(componentsDir, 'code-block.html'), componentHtml, 'utf8')
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
      assert.ok(content.includes('coralite [options]'), 'Computed slot content must be rendered in SSR output')
      assert.ok(content.includes('data-coralite-slot-computed'), 'Slot should be marked as computed for hydration bypass')
    } finally {
      await rm(tmpDir, {
        recursive: true,
        force: true
      })
    }
  })

  it('processes computed slots authored with (content, state) reading state properties', async () => {
    const tmpDir = path.resolve('packages/coralite/tests/unit/lib/server/tmp-slots-state-test')
    const pagesDir = path.join(tmpDir, 'pages')
    const componentsDir = path.join(tmpDir, 'components')

    await rm(tmpDir, {
      recursive: true,
      force: true
    })
    await mkdir(pagesDir, { recursive: true })
    await mkdir(componentsDir, { recursive: true })

    const componentHtml = `<template id="syntax-block">
  <div class="syntax-wrap">
    <pre><code class="lang-{{languageClass}}"><slot></slot></code></pre>
  </div>
</template>
<script type="module">
  import { defineComponent } from 'coralite'
  export default defineComponent({
    attributes: {
      language: {
        type: String,
        default: 'text'
      }
    },
    getters: {
      languageClass: ({ state }) => state.language.toLowerCase()
    },
    slots: {
      default (content, state) {
        if (typeof window !== 'undefined') {
          return
        }
        const lang = state.language.toUpperCase()
        const text = content.map(n => n.data || '').join('').trim()
        return [{
          type: 'tag',
          name: 'span',
          attribs: { class: 'highlighted' },
          children: [{
            type: 'text',
            data: '[' + lang + '] ' + text
          }]
        }]
      }
    }
  })
</script>`

    const pageHtml = `<!DOCTYPE html>
<html>
  <body>
    <syntax-block language="javascript">console.log("hello")</syntax-block>
  </body>
</html>`

    await writeFile(path.join(componentsDir, 'syntax-block.html'), componentHtml, 'utf8')
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
      assert.ok(content.includes('[JAVASCRIPT] console.log("hello")'), 'Transformed slot content must appear')
      assert.ok(content.includes('class="highlighted"'), 'Transformed span tag must appear')
      assert.ok(content.includes('class="lang-javascript"'), 'Getter languageClass must be applied')
      assert.ok(content.includes('data-coralite-slot-computed'), 'Slot should be marked as computed for hydration bypass')
    } finally {
      await rm(tmpDir, {
        recursive: true,
        force: true
      })
    }
  })

  it('processes computed slots authored with ({ nodes, state }) destructuring', async () => {
    const tmpDir = path.resolve('packages/coralite/tests/unit/lib/server/tmp-slots-destructure-test')
    const pagesDir = path.join(tmpDir, 'pages')
    const componentsDir = path.join(tmpDir, 'components')

    await rm(tmpDir, {
      recursive: true,
      force: true
    })
    await mkdir(pagesDir, { recursive: true })
    await mkdir(componentsDir, { recursive: true })

    const componentHtml = `<template id="badge-wrapper">
  <div>
    <slot name="label"></slot>
  </div>
</template>
<script type="module">
  import { defineComponent } from 'coralite'
  export default defineComponent({
    attributes: {
      prefix: {
        type: String,
        default: 'TAG'
      }
    },
    slots: {
      label ({ nodes, state }) {
        if (typeof window !== 'undefined') {
          return
        }
        const raw = nodes.map(n => n.children?.[0]?.data || n.data || '').join('').trim()
        return [{
          type: 'tag',
          name: 'strong',
          attribs: {},
          children: [{
            type: 'text',
            data: state.prefix + ': ' + raw
          }]
        }]
      }
    }
  })
</script>`

    const pageHtml = `<!DOCTYPE html>
<html>
  <body>
    <badge-wrapper prefix="STATUS"><span slot="label">Active</span></badge-wrapper>
  </body>
</html>`

    await writeFile(path.join(componentsDir, 'badge-wrapper.html'), componentHtml, 'utf8')
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
      assert.ok(content.includes('STATUS: Active'), 'Destructured slot must render correctly')
      assert.ok(content.includes('data-coralite-slot-computed'), 'Slot should be marked as computed for hydration bypass')
    } finally {
      await rm(tmpDir, {
        recursive: true,
        force: true
      })
    }
  })
})
