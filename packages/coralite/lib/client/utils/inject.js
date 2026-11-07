import { defineComponent, createContext, ContextRequestEvent } from '../../shared/core.js'
import { definePlugin } from '../../shared/define-plugin.js'

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

  const TOKEN_TEST = /\{\{[\s\S]*?\}\}/
  const TOKEN_GLOBAL = /\{\{[\s\S]*?\}\}/g

  /**
   * Protect raw-text element INNER CONTENT and HTML comments.
   * The opening tag (including its attributes) is left exposed so
   * attributes like <script src="{{ url }}"> are still sanitized.
   */
  const placeholders = []

  const rawInnerRegex =
    /(<(?:script|style|textarea|title)\b[^>]*>)([\s\S]*?)(<\/(?:script|style|textarea|title)>)/gi
  let protectedHtml = html.replace(rawInnerRegex, (_, open, inner, close) => {
    const id = `\x00CORALITE_RAW_${placeholders.length}\x00`
    placeholders.push(inner)
    return open + id + close
  })

  protectedHtml = protectedHtml.replace(/<!--[\s\S]*?-->/g, (match) => {
    const id = `\x00CORALITE_RAW_${placeholders.length}\x00`
    placeholders.push(match)
    return id
  })

  const TAG_RE =
    /<([a-zA-Z][\w:-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*(\/?)>/gs

  const ATTR_RE =
    /(\s+[^\s"'>/=]+)\s*=\s*(?:(['"])([\s\S]*?)\2|([^\s"'>]+))/g

  protectedHtml = protectedHtml.replace(TAG_RE, (fullTag, tagName, attrs, slash) => {
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

    const trailingSlash = slash ? ' /' : ''
    return `<${tagName}${sanitizedAttrs}${trailingSlash}>`
  })

  return protectedHtml.replace(/\x00CORALITE_RAW_(\d+)\x00/g, (_, i) => placeholders[i])
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

  return sanitizedHtml.replace(/<([a-zA-Z0-9-]+)([^>]*)>/g, (match, tagName, attrs) => {
    let newAttrs = attrs

    newAttrs = newAttrs.replace(/\s+test\s*=\s*(['"]).*?\1/g, '')

    if (shouldStripTestId) {
      newAttrs = newAttrs.replace(/\s+data-testid\s*=\s*(['"]).*?\1/g, '')
    }

    if (instanceId) {
      const prefix = instanceId + '__'
      const refRegex = /\s+ref\s*=\s*(['"])(.*?)\1/g
      newAttrs = newAttrs.replace(refRegex, (attrMatch, quote, refValue) => {
        const prefixedRef = refValue.startsWith(prefix) ? refValue : prefix + refValue
        let ownerAttr = ''
        if (!newAttrs.includes('data-coralite-owner=')) {
          ownerAttr = ' data-coralite-owner="' + instanceId + '"'
        }
        return ' ref="' + prefixedRef + '"' + ownerAttr
      })
    }

    return '<' + tagName + newAttrs + '>'
  })
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
