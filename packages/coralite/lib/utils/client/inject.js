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
