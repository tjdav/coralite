import { defineComponent } from '../core.js'
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
 * Proxy to window.processHTML if available.
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
  return html
}

export { defineComponent, definePlugin }
