
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import routerPlugin from '#plugins/router'
import { createCoralite } from '#lib'
import { parseHTML } from '../../../lib/server/utils/parse.js'
import { transformNode } from '../../../lib/server/parser/html.js'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdir, writeFile, rm } from 'node:fs/promises'

const __dirname = dirname(fileURLToPath(import.meta.url))
const tmpDir = join(__dirname, 'tmp-router-wrap-test')

describe('Router Outlet Wrapping', () => {
  it('onBeforePageRender wraps body content when no outlet exists', () => {
    const pluginInstance = routerPlugin()
    const html = '<!DOCTYPE html><html><head></head><body><h1>Hello World</h1></body></html>'
    const parsed = parseHTML(html)
    const component = {
      root: parsed.root
    }

    pluginInstance.server.onBeforePageRender({
      component,
      config: pluginInstance.config
    })

    const rendered = transformNode(component.root)
    assert.ok(rendered.includes('<router-outlet data-router-outlet>'))
    assert.ok(rendered.includes('<h1>Hello World</h1>'))
    assert.ok(rendered.includes('</router-outlet>'))
  })

  it('onBeforePageRender does not double-wrap if router-outlet element already exists', () => {
    const pluginInstance = routerPlugin()
    const html = '<!DOCTYPE html><html><head></head><body><router-outlet data-router-outlet><h1>Hello World</h1></router-outlet></body></html>'
    const parsed = parseHTML(html)
    const component = {
      root: parsed.root
    }

    pluginInstance.server.onBeforePageRender({
      component,
      config: pluginInstance.config
    })

    const rendered = transformNode(component.root)
    const matches = rendered.match(/<router-outlet/g) || []
    assert.strictEqual(matches.length, 1)
  })

  it('onBeforePageRender respects custom outlet attribute config', () => {
    const pluginInstance = routerPlugin({
      outlet: 'data-my-outlet'
    })
    const html = '<!DOCTYPE html><html><head></head><body><p>Content</p></body></html>'
    const parsed = parseHTML(html)
    const component = {
      root: parsed.root
    }

    pluginInstance.server.onBeforePageRender({
      component,
      config: pluginInstance.config
    })

    const rendered = transformNode(component.root)
    assert.ok(rendered.includes('<router-outlet data-my-outlet>'))
  })

  it('builds fixture page with router plugin registered, producing outlet wrapper and rendering slotted content', async () => {
    const pagesDir = join(tmpDir, 'pages')
    const componentsDir = join(tmpDir, 'components')

    await mkdir(pagesDir, { recursive: true })
    await mkdir(componentsDir, { recursive: true })

    const pageContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Router Outlet Test</title>
</head>
<body>
  <main>
    <h1>Welcome to SPA Router</h1>
    <p>Slotted content inside page</p>
  </main>
</body>
</html>`

    const pagePath = join(pagesDir, 'router-outlet.html')
    await writeFile(pagePath, pageContent, 'utf8')

    try {
      const app = await createCoralite({
        pages: pagesDir,
        components: componentsDir,
        plugins: [
          routerPlugin()
        ],
        mode: 'production',
        cleanUrls: true
      })

      const results = await app.build(pagePath)
      assert.strictEqual(results.length, 1)

      const pageResult = results[0]
      assert.ok(pageResult.content.includes('<router-outlet data-router-outlet>'))
      assert.ok(pageResult.content.includes('<h1>Welcome to SPA Router</h1>'))
      assert.ok(pageResult.content.includes('<p>Slotted content inside page</p>'))
    } finally {
      await rm(tmpDir, {
        recursive: true,
        force: true
      })
    }
  })
})
