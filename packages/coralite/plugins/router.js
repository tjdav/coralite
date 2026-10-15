import { definePlugin } from '../lib/server/plugin/define.js'
import { createCoraliteElement, relinkChildren } from '../lib/server/utils/dom.js'
import { findHeadAndBody } from '../lib/server/utils/render.js'
import { fileURLToPath } from 'node:url'

/**
 * Checks if an element is a router outlet element either by tag name or attribute match.
 *
 * @param {any} node - The AST node to inspect
 * @param {string} outletAttr - The attribute name identifying the outlet
 * @returns {boolean} True if the node is an outlet element
 */
function isOutletElement (node, outletAttr) {
  if (!node || node.type !== 'tag') {
    return false
  }
  if (node.name === 'router-outlet') {
    return true
  }
  if (node.attribs && Object.hasOwn(node.attribs, outletAttr)) {
    return true
  }
  return false
}

/**
 * Recursively checks if an AST container or its children already contains an outlet element.
 *
 * @param {any} node - The AST node/container to check
 * @param {string} outletAttr - The attribute name identifying the outlet
 * @returns {boolean} True if an outlet element is found in the AST
 */
function hasOutlet (node, outletAttr) {
  if (!node) {
    return false
  }
  if (isOutletElement(node, outletAttr)) {
    return true
  }
  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      if (hasOutlet(child, outletAttr)) {
        return true
      }
    }
  }
  return false
}

/**
 * Wraps page body content in a <router-outlet> element if not already present.
 *
 * @param {Object} component - Coralite component object containing root AST
 * @param {string} outletAttr - Attribute name for outlet selector
 */
function wrapBodyInOutlet (component, outletAttr) {
  if (!component || !component.root) {
    return
  }
  const { body } = findHeadAndBody(component.root)
  if (!body) {
    return
  }

  if (hasOutlet(body, outletAttr)) {
    return
  }

  const existingChildren = body.children || []
  const outletElement = createCoraliteElement({
    type: 'tag',
    name: 'router-outlet',
    attribs: {
      [outletAttr]: ''
    },
    children: existingChildren
  })

  body.children = [outletElement]
  relinkChildren(body)
}

export const routerPlugin = definePlugin({
  name: 'router',

  config: {
    base: {
      type: String,
      default: '/'
    },
    outlet: {
      type: String,
      default: 'data-router-outlet'
    }
  },

  server: {
    components: [
      fileURLToPath(new URL('./router/outlet.html', import.meta.url))
    ],

    onBeforePageRender ({ component, config }) {
      const activeConfig = config || {}
      const outletAttr = activeConfig.outlet || 'data-router-outlet'
      wrapBodyInOutlet(component, outletAttr)
    }
  }
})

export default routerPlugin
