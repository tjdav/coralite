import { defineComponent, createContext, ContextRequestEvent } from '../../shared/core.js'
import { definePlugin } from '../../shared/define-plugin.js'

const TOKEN_TEST = /\{\{[\s\S]*?\}\}/
const TOKEN_GLOBAL = /\{\{[\s\S]*?\}\}/g
const TAG_RE =
  /<([a-zA-Z][\w:-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*(\/?)>/gs
const ATTR_RE =
  /(\s+[^\s"'>/=]+)\s*=\s*(?:(['"])([\s\S]*?)\2|([^\s"'>]+))/g
const COMMENT_RE = /<!--(?:>|->|[\s\S]*?(?:-->|$))/g
const RAW_TEXT_RE =
  /(<(script|style|textarea|title)\b(?:[^>"']|"[^"]*"|'[^']*')*>)([\s\S]*?)(<\/\2\s*>|$)/gi

/**
 * Creates a Coralite element or a standard HTML element.
 * Delegates to `window.__coralite__.dom.createElement` or `document.createElement`.
 *
 * @param {string} tag - The tag name.
 * @param {Object} [options] - Optional element options.
 * @returns {HTMLElement} The created element.
 */
export function createCoraliteElement (tag, options) {
  if (typeof window !== 'undefined') {
    /** @type {import('../../../types/globals.js').CoraliteGlobalThis} */
    const win = window
    const dom = win.__coralite__?.dom
    if (dom && typeof dom.createElement === 'function') {
      return dom.createElement(tag, options)
    }
  }
  return document.createElement(tag, options)
}

/**
 * Protects comments and raw-text element content from tag rewriting.
 *
 * @param {string} html - Raw HTML string.
 * @returns {{ html: string, placeholders: string[], prefix: string }} Guard state.
 */
function createRawHtmlGuard (html) {
  const placeholders = []
  const prefix = `\u0000CORALITE_RAW_${Math.random().toString(36).slice(2)}_`

  let guarded = html.replace(COMMENT_RE, (match) => {
    const id = `${prefix}${placeholders.length}\u0000`
    placeholders.push(match)
    return id
  })

  guarded = guarded.replace(RAW_TEXT_RE, (match, open, tagName, inner, close) => {
    if (inner === '') {
      return match
    }
    const id = `${prefix}${placeholders.length}\u0000`
    placeholders.push(inner)
    return open + id + close
  })

  return {
    html: guarded,
    placeholders,
    prefix
  }
}

/**
 * Restores content protected by `createRawHtmlGuard()`.
 *
 * Markers are resolved in one pass, then re-scanned only if restored content
 * itself contains markers (nested comments/raw-text content).
 *
 * @param {string} html - Rewritten HTML string.
 * @param {{ placeholders: string[], prefix: string }} guard - Guard state.
 * @returns {string} Restored HTML string.
 */
function restoreRawHtml (html, guard) {
  const pattern = new RegExp(`${guard.prefix}(\\d+)\\u0000`, 'g')
  let restored = html
  let replaced = true

  while (replaced) {
    replaced = false
    restored = restored.replace(pattern, (match, index) => {
      replaced = true
      return guard.placeholders[Number(index)]
    })
  }

  return restored
}

/**
 * Checks whether an attribute name exists in a raw attribute string.
 *
 * @param {string} attrs - Raw attribute string.
 * @param {string} name - Lowercase attribute name.
 * @returns {boolean} Whether the attribute is present.
 */
function hasAttribute (attrs, name) {
  let found = false
  attrs.replace(ATTR_RE, (match, nameWithWhitespace) => {
    if (nameWithWhitespace.trim().toLowerCase() === name) {
      found = true
    }
    return match
  })
  return found
}

/**
 * Strips unresolved {{ token }} syntax from HTML attribute values before
 * the browser parses them. Pure-token attributes are removed entirely;
 * mixed attributes retain their static content.
 *
 * Token matching follows the strict template grammar from parseTemplateSegments:
 * {{ opens, first }} closes, no nested brace tracking.
 *
 * @param {string} html - Raw HTML string.
 * @returns {string} Sanitized HTML string.
 */
export function sanitizeTokenAttributes (html) {
  if (!html || !html.includes('{{')) {
    return html
  }

  const guard = createRawHtmlGuard(html)
  const sanitized = guard.html.replace(TAG_RE, (fullTag, tagName, attrs, slash) => {
    if (!TOKEN_TEST.test(attrs)) {
      return fullTag
    }

    const sanitizedAttrs = attrs.replace(
      ATTR_RE,
      (attrMatch, nameWithWhitespace, quote, quotedValue, unquotedValue) => {
        const attrValue = quote ? quotedValue : unquotedValue
        if (!TOKEN_TEST.test(attrValue)) {
          return attrMatch
        }

        const stripped = attrValue.replace(TOKEN_GLOBAL, '').trim()

        if (stripped === '') {
          return ''
        }

        if (quote) {
          return `${nameWithWhitespace}=${quote}${stripped}${quote}`
        }
        return /\s/.test(stripped)
          ? `${nameWithWhitespace}="${stripped}"`
          : `${nameWithWhitespace}=${stripped}`
      }
    )

    if (sanitizedAttrs === attrs) {
      return fullTag
    }

    return `<${tagName}${sanitizedAttrs}${slash ? ' /' : ''}>`
  })

  return restoreRawHtml(sanitized, guard)
}

/**
 * Sanitizes template tokens, strips deprecated/production test attributes,
 * and prefixes `ref` attributes with `data-coralite-owner` for a component instance.
 *
 * @param {string} html - Raw HTML string.
 * @param {string} [instanceId] - Component instance ID for scoping refs.
 * @param {boolean} [shouldStripTestId=false] - Whether to strip `data-testid` attributes.
 * @returns {string} Processed HTML string.
 */
export function formatCoraliteHTML (html, instanceId, shouldStripTestId = false) {
  if (typeof html !== 'string') {
    return html
  }

  const sanitizedHtml = sanitizeTokenAttributes(html)

  if (!instanceId && !shouldStripTestId && !/test/i.test(sanitizedHtml)) {
    return sanitizedHtml
  }

  const guard = createRawHtmlGuard(sanitizedHtml)
  const processed = guard.html.replace(TAG_RE, (fullTag, tagName, attrs, slash) => {
    const hasOwner = hasAttribute(attrs, 'data-coralite-owner')
    let ownerAdded = false
    let changed = false

    const newAttrs = attrs.replace(
      ATTR_RE,
      (attrMatch, nameWithWhitespace, quote, quotedValue, unquotedValue) => {
        const name = nameWithWhitespace.trim().toLowerCase()

        if (name === 'test') {
          changed = true
          return ''
        }

        if (name === 'data-testid' && shouldStripTestId) {
          changed = true
          return ''
        }

        if (name !== 'ref' || !instanceId) {
          return attrMatch
        }

        const refValue = quote ? quotedValue : unquotedValue
        const prefix = instanceId + '__'
        const prefixedRef = refValue.startsWith(prefix) ? refValue : prefix + refValue
        let ownerAttr = ''

        if (!hasOwner && !ownerAdded) {
          ownerAttr = ' data-coralite-owner="' + instanceId + '"'
          ownerAdded = true
        }

        changed = true
        return ' ref="' + prefixedRef + '"' + ownerAttr
      }
    )

    if (!changed) {
      return fullTag
    }

    return `<${tagName}${newAttrs}${slash ? ' /' : ''}>`
  })

  return restoreRawHtml(processed, guard)
}

/**
 * Processes an HTML string for custom elements.
 * Delegates to `window.__coralite__.dom.processHTML` when available, falling back to `formatCoraliteHTML`.
 *
 * @param {string} html - The HTML string.
 * @param {string} [instanceId] - The component instance ID.
 * @returns {string} The processed HTML string.
 */
export function processHTML (html, instanceId) {
  if (typeof window !== 'undefined') {
    /** @type {import('../../../types/globals.js').CoraliteGlobalThis} */
    const win = window
    const dom = win.__coralite__?.dom
    if (dom && typeof dom.processHTML === 'function') {
      return dom.processHTML(html, instanceId)
    }
  }

  return formatCoraliteHTML(html, instanceId, false)
}

export { defineComponent, definePlugin, createContext, ContextRequestEvent }
