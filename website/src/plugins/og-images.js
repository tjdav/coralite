import { readdir, readFile, access } from 'node:fs/promises'
import { join } from 'node:path'
import { definePlugin } from 'coralite'
import { renderOgImage } from '../og/render.js'

/**
 * Reads one meta tag value from built HTML.
 * @param {string} html - Page HTML.
 * @param {RegExp} pattern - Pattern with the value in the first group.
 * @returns {string} Decoded value, or an empty string.
 */
function meta (html, pattern) {
  const match = html.match(pattern)
  if (!match) {
    return ''
  }
  return match[1]
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
}

/**
 * Generates Open Graph images for every blog post after the site is built.
 */
export default definePlugin({
  name: 'og-images',
  server: {
    async onAfterBuild ({ app }) {
      if (app.options.mode === 'development') {
        return
      }

      const output = app.options.output
      if (!output) {
        return
      }

      const blogDir = join(output, 'blog')
      let entries
      try {
        entries = await readdir(blogDir, { withFileTypes: true })
      } catch {
        return
      }

      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue
        }

        const pagePath = join(blogDir, entry.name, 'index.html')
        try {
          await access(pagePath)
        } catch {
          continue
        }

        const html = await readFile(pagePath, 'utf8')
        const documentTitle = meta(html, /<title>([\s\S]*?)<\/title>/).replace(/\s+—\s+Coralite.*$/, '')
        const heading = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)
        const rawTitle = documentTitle || (heading
          ? meta(heading[1], /([\s\S]+)/).replace(/<[^>]+>/g, '').trim()
          : '')
        const title = rawTitle.replace(/\s+/g, ' ').trim()
        if (!title) {
          continue
        }

        const png = await renderOgImage({
          title,
          section: meta(html, /<meta property="article:section" content="([^"]*)"/),
          author: meta(html, /<meta property="article:author" content="([^"]*)"/),
          date: meta(html, /<meta property="article:published_time" content="([^"]*)"/)
        })

        const relativePath = `images/og/blog/${entry.name}.png`
        const fullPath = join(output, relativePath)

        let existing = null
        try {
          existing = await readFile(fullPath)
        } catch {
          // Missing, write below.
        }

        if (existing && existing.equals(png)) {
          app.trackOutputFile(fullPath)
        } else {
          await app.writeFile(relativePath, png)
        }
      }
    }
  }
})
