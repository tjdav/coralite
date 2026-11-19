import { definePlugin, DIAGNOSTIC_CATALOG } from 'coralite'
import { parseHTML } from 'coralite/utils/server'

const FAMILY_ORDER = ['component', 'plugin', 'page', 'accessibility', 'config']
const FAMILY_LABELS = {
  component: 'Component',
  plugin: 'Plugin',
  page: 'Page',
  accessibility: 'Accessibility',
  config: 'Configuration'
}

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
 * Builds the short form of a diagnostic code, e.g. `E201` for `CORALITE-E201`.
 * @param {string} code - Full diagnostic code.
 * @returns {string} Short code.
 */
function shortCode (code) {
  return code.replace('CORALITE-', '')
}

/**
 * Renders one catalogue row.
 * @param {import('coralite').DiagnosticCatalogEntry} entry - Catalogue entry.
 * @returns {string} Table row markup.
 */
function renderRow (entry) {
  const anchor = entry.code.toLowerCase()
  const fixable = entry.fixable ? 'true' : 'false'
  const search = escapeText(`${entry.code} ${entry.title} ${entry.summary} ${entry.fix}`.toLowerCase())
  const autoFix = entry.fixable
    ? '<span class="diag-pill diag-pill--fix">auto-fix</span>'
    : ''
  const actions = entry.fixable && entry.fixActions
    ? `<p class="diag-actions"><strong>Auto-fix.</strong> ${entry.fixActions.map(action => `<code>${escapeText(action)}</code>`).join(', ')}</p>`
    : ''
  const command = entry.fixable
    ? `<p class="diag-command"><code>coralite fix --code ${escapeText(shortCode(entry.code))}</code></p>`
    : ''

  return `<tr id="${anchor}" class="diag-row" data-diagnostics-row data-family="${entry.family}" data-severity="${entry.severity}" data-fixable="${fixable}" data-search="${search}">
  <td class="diag-code"><a href="#${anchor}"><code>${escapeText(entry.code)}</code></a></td>
  <td class="diag-severity"><span class="diag-pill diag-pill--${entry.severity}">${entry.severity}</span>${autoFix}</td>
  <td class="diag-detail">
    <details>
      <summary><span class="diag-title">${escapeText(entry.title)}</span></summary>
      <p>${escapeText(entry.summary)}</p>
      <p class="diag-fix"><strong>Fix.</strong> ${escapeText(entry.fix)}</p>
      ${actions}
      ${command}
    </details>
  </td>
</tr>`
}

/**
 * Renders a family section with its table.
 * @param {string} family - Family key.
 * @param {import('coralite').DiagnosticCatalogEntry[]} entries - Entries in the family.
 * @returns {string} Section markup.
 */
function renderGroup (family, entries) {
  const label = FAMILY_LABELS[family]
  return `<section class="diag-group" data-diagnostics-group>
  <h3>${label} <span class="diag-group-count">${entries.length}</span></h3>
  <div class="diag-table-wrap">
    <table class="diag-table">
      <caption class="diag-caption">${label} diagnostics</caption>
      <thead>
        <tr>
          <th scope="col">Code</th>
          <th scope="col">Severity</th>
          <th scope="col">Diagnostic</th>
        </tr>
      </thead>
      <tbody>
        ${entries.map(renderRow).join('\n        ')}
      </tbody>
    </table>
  </div>
</section>`
}

/**
 * Renders the summary strip, filter toolbar and family tables.
 * @param {import('coralite').DiagnosticCatalogEntry[]} entries - Full catalogue.
 * @returns {string} Catalogue markup.
 */
function renderCatalogue (entries) {
  const errors = entries.filter(entry => entry.severity === 'error').length
  const warnings = entries.filter(entry => entry.severity === 'warning').length
  const fixable = entries.filter(entry => entry.fixable).length
  const options = FAMILY_ORDER
    .map(family => `<option value="${family}">${FAMILY_LABELS[family]}</option>`)
    .join('\n          ')
  const groups = FAMILY_ORDER
    .map(family => renderGroup(family, entries.filter(entry => entry.family === family)))
    .join('\n')

  return `<div class="diag-summary">
  <div class="diag-stat"><strong>${entries.length}</strong><span>codes</span></div>
  <div class="diag-stat"><strong>${errors}</strong><span>errors</span></div>
  <div class="diag-stat"><strong>${warnings}</strong><span>warnings</span></div>
  <div class="diag-stat"><strong>${fixable}</strong><span>auto-fixable</span></div>
</div>

<div class="diag-toolbar is-hidden" data-diagnostics-toolbar>
  <label class="diag-control">
    <span>Search</span>
    <input type="search" data-diagnostics-search placeholder="E201, template, plugin…">
  </label>
  <label class="diag-control">
    <span>Family</span>
    <select data-diagnostics-family>
      <option value="">All families</option>
      ${options}
    </select>
  </label>
  <label class="diag-control diag-control--check">
    <input type="checkbox" data-diagnostics-fixable>
    <span>Auto-fixable only</span>
  </label>
  <p class="diag-count" role="status" aria-live="polite" data-diagnostics-count></p>
</div>

<p class="diag-empty is-hidden" data-diagnostics-empty>No codes match these filters.</p>

<div class="diag-catalogue">
${groups}
</div>`
}

/**
 * Finds the catalogue mount point in a parsed page.
 * @param {Object} node - AST node.
 * @returns {Object|null} Mount element.
 */
function findMount (node) {
  if (!node || !Array.isArray(node.children)) {
    return null
  }

  for (const child of node.children) {
    if (child.type === 'tag' && child.attribs && 'data-diagnostics-catalogue' in child.attribs) {
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
 * Injects the generated diagnostic catalogue into the reference page.
 */
export default definePlugin({
  name: 'diagnostics',
  server: {
    async onPageSet ({ elements, data }) {
      const pathname = data.path.pathname.replace(/\\/g, '/')
      if (!pathname.includes('/reference/diagnostics')) {
        return
      }

      const mount = findMount(elements.root)
      if (!mount) {
        return
      }

      const parsed = parseHTML(renderCatalogue(DIAGNOSTIC_CATALOG))
      mount.children = parsed.root.children.map((node) => {
        node.parent = mount
        return node
      })
    }
  }
})
