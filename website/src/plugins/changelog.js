import { definePlugin } from 'coralite'
import { parseHTML } from 'coralite/utils/server'

const DATA_CANDIDATES = [
  'src/data/changelog.json',
  'website/src/data/changelog.json'
]

/**
 * Escapes text for safe interpolation into generated markup.
 * @param {*} value - Raw value.
 * @returns {string} Escaped text.
 */
function escapeText (value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Builds a URL-safe id from heading text.
 * @param {string} value - Heading text.
 * @returns {string} Slug.
 */
function slugify (value) {
  return value
    .replace(/`/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Converts balanced single-backtick spans into inline code elements.
 * @param {string} value - Escaped text.
 * @returns {string} Text with code elements.
 */
function inlineCode (value) {
  return value.replace(/`([^`]+)`/g, (_, code) => `<code>${code}</code>`)
}

/**
 * Escapes raw markup that legacy entries embed as code samples but never
 * escaped. `<script>`, `<slot>` and `<template>` would otherwise change how
 * the parser reads the rest of the document.
 * @param {string} html - Raw entry HTML.
 * @returns {string} HTML with those tags escaped.
 */
function escapeRawTags (html) {
  return html.replace(
    /<(\/?)(script|slot|template|noscript|pre)(\b[^>]*)>/gi,
    (_, closing, name, attributes) => `&lt;${closing}${name}${attributes}&gt;`
  )
}

/**
 * Converts legacy changelog markup into the markup the site renders today.
 * @param {string} html - Raw entry HTML.
 * @returns {string} Site markup.
 */
function renderEntryBody (html) {
  return escapeRawTags(html)
    .replace(
      /<coralite-heading level="(\d)" text="([^"]*)"><\/coralite-heading>/g,
      (_, level, text) => `<h${level} id="${slugify(text)}">${text}</h${level}>`
    )
    .replace(
      /<coralite-code-highlight language="([^"]*)">([\s\S]*?)<\/coralite-code-highlight>/g,
      (_, language, code) => `<code-block language="${language}">${code}</code-block>`
    )
}

/**
 * Renders one changelog entry.
 * @param {Object} entry - Changelog entry record.
 * @returns {string} Entry markup.
 */
function renderEntry (entry) {
  const title = inlineCode(escapeText(entry.title))
  const summary = entry.summary ? inlineCode(escapeText(entry.summary)) : ''
  const pkg = escapeText(entry.package || 'coralite')

  return `
        <article class="changelog-item" id="${escapeText(entry.id)}">
          <div class="changelog-aside">
            <time class="changelog-date" datetime="${escapeText(entry.date)}">${escapeText(entry.formattedDate)}</time>
            <span class="changelog-badge">${pkg} v${escapeText(entry.version)}</span>
          </div>
          <div class="changelog-content">
            <h2 class="changelog-title"><a href="#${escapeText(entry.id)}">${title}</a></h2>
            ${summary ? `<p class="changelog-summary">${summary}</p>` : ''}
            <div class="changelog-body">${renderEntryBody(entry.html || '')}</div>
            <div class="changelog-footer">
              <a href="https://github.com/tjdav/coralite/releases/tag/${escapeText(entry.tag)}" class="changelog-anchor-link" target="_blank" rel="noopener">GitHub Release ↗</a>
            </div>
          </div>
        </article>`
}

/**
 * Finds the changelog mount point in a parsed page.
 * @param {Object} node - AST node.
 * @returns {Object|null} Mount element.
 */
function findMount (node) {
  if (!node || !Array.isArray(node.children)) {
    return null
  }

  for (const child of node.children) {
    if (child.type === 'tag' && child.attribs && 'data-changelog' in child.attribs) {
      return child
    }

    const found = findMount(child)
    if (found) {
      return found
    }
  }

  return null
}

/**
 * Replaces the changelog mount point with entries rendered from data.
 */
export default definePlugin({
  name: 'changelog',
  server: {
    async onPageSet ({ app, elements, data }) {
      const pathname = data.path.pathname.replace(/\\/g, '/')
      if (!pathname.endsWith('/changelog/index.html')) {
        return
      }

      const mount = findMount(elements.root)
      if (!mount) {
        return
      }

      const { readFileSync, existsSync } = await import('node:fs')
      const { resolve } = await import('node:path')

      const projectRoot = app.options.projectRoot || process.cwd()
      const dataPath = DATA_CANDIDATES
        .map(candidate => resolve(projectRoot, candidate))
        .find(candidate => existsSync(candidate))

      const entries = dataPath ? JSON.parse(readFileSync(dataPath, 'utf8')) : []
      const html = entries.length
        ? entries.map(renderEntry).join('\n')
        : '<p>No changelog entries found.</p>'

      const parsed = parseHTML(html)
      mount.children = parsed.root.children.map((node) => {
        node.parent = mount
        return node
      })

      const injected = parsed.customElements || []
      if (Array.isArray(elements.customElements) && injected.length) {
        elements.customElements = elements.customElements.concat(injected)
      }
    }
  }
})
