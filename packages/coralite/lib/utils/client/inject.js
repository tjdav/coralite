import { defineComponent, createContext, ContextRequestEvent } from '../core.js'
import { definePlugin } from '../../plugin.js'

/**
 * Creates a Coralite element or a standard HTML element.
 * Proxy to window.createCoraliteElement or document.createElement.
 *
 * @param {string} tag - The tag name.
 * @param {Object} [options] - Optional element options.
 * @returns {HTMLElement} The created element.
 */
export function createCoraliteElement (tag, options) {
  // @ts-ignore
  if (typeof window !== 'undefined' && window.createCoraliteElement) {
    // @ts-ignore
    return window.createCoraliteElement(tag, options)
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
function sanitizeTokenAttributes (html) {
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

  // Protect inner content of raw-text elements.
  // Captures: opening tag (kept), inner content (replaced), closing tag (kept).
  const rawInnerRegex =
    /(<(?:script|style|textarea|title)\b[^>]*>)([\s\S]*?)(<\/(?:script|style|textarea|title)>)/gi
  let protectedHtml = html.replace(rawInnerRegex, (_, open, inner, close) => {
    const id = `\x00CORALITE_RAW_${placeholders.length}\x00`
    placeholders.push(inner)
    return open + id + close
  })

  // Protect HTML comments.
  protectedHtml = protectedHtml.replace(/<!--[\s\S]*?-->/g, (match) => {
    const id = `\x00CORALITE_RAW_${placeholders.length}\x00`
    placeholders.push(match)
    return id
  })

  // Sanitize attribute values inside each opening tag
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

        // Pure-token → remove the attribute entirely
        if (stripped === '') {
          return ''
        }

        // Mixed → keep static content, re-quoting if needed
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

  // Restore protected content
  return protectedHtml.replace(/\x00CORALITE_RAW_(\d+)\x00/g, (_, i) => placeholders[i])
}

/**
 * Processes an HTML string for custom elements.
 * Fallback implementation mirroring runtime.js:processHTML when window.processHTML is unavailable (e.g. unit test runner).
 * Note: Tag matching uses /<([a-zA-Z0-9-]+)([^>]*)>/g assuming well-formed attributes without raw '>' in attribute values.
 *
 * @param {string} html - The HTML string.
 * @param {string} [instanceId] - The component instance ID.
 * @returns {string} The HTML string.
 */
export function processHTML (html, instanceId) {
  // @ts-ignore
  if (typeof window !== 'undefined' && window.processHTML) {
    // @ts-ignore
    return window.processHTML(html, instanceId)
  }

  if (typeof html !== 'string') {
    return html
  }

  html = sanitizeTokenAttributes(html)

  if (instanceId) {
    const prefix = instanceId + '__'
    return html.replace(/<([a-zA-Z0-9-]+)([^>]*)>/g, (match, tagName, attrs) => {
      let newAttrs = attrs
      const refRegex = /\s+ref\s*=\s*(['"])(.*?)\1/g
      newAttrs = newAttrs.replace(refRegex, (attrMatch, quote, refValue) => {
        const prefixedRef = refValue.startsWith(prefix) ? refValue : prefix + refValue
        let ownerAttr = ''
        if (!newAttrs.includes('data-coralite-owner=')) {
          ownerAttr = ' data-coralite-owner="' + instanceId + '"'
        }
        return ' ref="' + prefixedRef + '"' + ownerAttr
      })
      return '<' + tagName + newAttrs + '>'
    })
  }

  return html
}

export { defineComponent, definePlugin, createContext, ContextRequestEvent }
