import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { createCoralite, definePlugin } from '#lib'

async function createPageApp (pageHtml, options = {}) {
  const root = await mkdtemp(join(tmpdir(), 'coralite-page-meta-'))
  const pagesDir = join(root, 'pages')
  const componentsDir = join(root, 'components')
  const outputDir = join(root, 'dist')

  await mkdir(pagesDir, { recursive: true })
  await mkdir(componentsDir, { recursive: true })
  await writeFile(join(pagesDir, 'index.html'), pageHtml)

  const app = await createCoralite({
    pages: pagesDir,
    components: componentsDir,
    output: outputDir,
    mode: 'production',
    ...options
  })

  return {
    root,
    app,
    outputDir
  }
}

describe('Page meta render isolation', () => {
  it('keeps collection page meta literal-only after rendering defaults', async () => {
    const { root, app } = await createPageApp(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <title>Literal title</title>
        <meta name="description" content="Literal description">
      </head>
      <body>
        <h1>{{ title }}</h1>
        <p>{{ campaign }}</p>
        <script type="module">
          export const meta = {
            title: { type: String, default: 'Default title' },
            campaign: { type: String, default: 'organic' }
          }
        </script>
      </body>
      </html>
    `)

    try {
      const results = await app.build()

      const pageItem = app.pages.getItem('index.html')
      assert.strictEqual(pageItem.result.page.meta.title, 'Literal title')
      assert.strictEqual(pageItem.result.page.meta.description, 'Literal description')
      assert.strictEqual(pageItem.result.page.meta.campaign, undefined)

      const html = results[0].content
      assert.match(html, /Default title/)
      assert.match(html, /organic/)
    } finally {
      await rm(root, {
        recursive: true,
        force: true
      })
    }
  })

  it('preserves hook page.meta mutations for the render without writing them back', async () => {
    const { root, app } = await createPageApp(`
      <!DOCTYPE html>
      <html lang="en">
      <head><title>Literal title</title></head>
      <body>
        <p>{{ hookCampaign }}</p>
        <script type="module">
          export const meta = {
            campaign: { type: String, default: 'organic' }
          }

          export const getters = {
            hookCampaign: ({ state }) => state.page.meta.campaign
          }
        </script>
      </body>
      </html>
    `, {
      plugins: [
        definePlugin({
          name: 'meta-hook',
          server: {
            onBeforePageRender ({ page }) {
              page.meta.campaign = 'from-hook'
              return { page }
            }
          }
        })
      ]
    })

    try {
      const results = await app.build()

      const pageItem = app.pages.getItem('index.html')
      assert.strictEqual(pageItem.result.page.meta.campaign, undefined)

      const html = results[0].content
      assert.match(html, /from-hook/)
    } finally {
      await rm(root, {
        recursive: true,
        force: true
      })
    }
  })

  it('reflects server page.meta mutations in render state without writing them back', async () => {
    const { root, app } = await createPageApp(`
      <!DOCTYPE html>
      <html lang="en">
      <head><title>Literal title</title></head>
      <body>
        <p>{{ docTitle }}</p>
        <script type="module">
          export const meta = {
            title: { type: String, default: 'Default title' }
          }

          export async function server ({ page }) {
            page.meta.title = 'Server title'
            return {}
          }

          export const getters = {
            docTitle: ({ state }) => state.page.meta.title
          }
        </script>
      </body>
      </html>
    `)

    try {
      const results = await app.build()

      const pageItem = app.pages.getItem('index.html')
      assert.strictEqual(pageItem.result.page.meta.title, 'Literal title')

      const html = results[0].content
      assert.match(html, /Server title/)
    } finally {
      await rm(root, {
        recursive: true,
        force: true
      })
    }
  })
})
