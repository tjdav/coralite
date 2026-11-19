import { readdir, readFile, access } from 'node:fs/promises'
import { join } from 'node:path'
import { definePlugin } from 'coralite'
import { parseHTML } from 'coralite/utils/server'
import { renderOgImage } from '../og/render.js'

/**
 * Finds the first element with a tag name.
 * @param {object} node - Parsed AST node.
 * @param {string} name - Lowercase tag name.
 * @returns {object|null} Matching element, or null.
 */
function findElement (node, name) {
  if (!node) {
    return null
  }
  if (node.type === 'tag' && node.name === name) {
    return node
  }
  for (const child of node.children || []) {
    const found = findElement(child, name)
    if (found) {
      return found
    }
  }
  return null
}

/**
 * Collects the text content of a node.
 * @param {object} node - Parsed AST node.
 * @returns {string} Concatenated text.
 */
function textContent (node) {
  if (!node) {
    return ''
  }
  if (node.type === 'text') {
    return node.data
  }
  return (node.children || []).map(textContent).join('')
}

/**
 * Walks the tree for a meta tag with the requested property.
 * @param {object} node - Parsed AST node.
 * @param {string} property - Meta property value.
 * @returns {string} Content value, or an empty string.
 */
function readMeta (node, property) {
  if (!node) {
    return ''
  }
  if (node.type === 'tag' && node.name === 'meta' && node.attribs && node.attribs.property === property) {
    return node.attribs.content || ''
  }
  for (const child of node.children || []) {
    const found = readMeta(child, property)
    if (found) {
      return found
    }
  }
  return ''
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
        const document = parseHTML(html).root
        let rawTitle = textContent(findElement(document, 'title'))
        const suffix = rawTitle.indexOf(' — Coralite')
        if (suffix !== -1) {
          rawTitle = rawTitle.slice(0, suffix)
        }
        if (!rawTitle.trim()) {
          rawTitle = textContent(findElement(document, 'h1'))
        }
        const title = rawTitle.replace(/\s+/g, ' ').trim()
        if (!title) {
          continue
        }

        const png = await renderOgImage({
          title,
          section: readMeta(document, 'article:section'),
          author: readMeta(document, 'article:author'),
          date: readMeta(document, 'article:published_time')
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
