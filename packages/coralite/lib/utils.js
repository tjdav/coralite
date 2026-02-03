/**
 * @import {CoraliteElement, CoraliteModule, CoraliteModuleSlotElement, CoraliteModuleValue, CoraliteTextNode} from '../types/index.js'
 */

/**
 * Converts a kebab-case string to camelCase
 * @param {string} str - The kebab-case string to convert
 * @returns {string} - The camelCase version of the string
 */
function kebabToCamel (str) {
  // replace each dash followed by a letter with the uppercase version of the letter
  return str.replace(/[-|:]([a-z])/g, function (match, letter) {
    return letter.toUpperCase()
  })
}

/**
 * Converts all keys in an object from kebab-case to camelCase
 * @template {Object} T
 * @param {T} object - The object with kebab-case keys
 * @returns {T} - A new object with camelCase keys
 */
export function cleanKeys (object) {
  const result = Object.assign({}, object)

  for (const key in object) {
    if (Object.prototype.hasOwnProperty.call(object, key)) {
      // convert the kebab-case key to camelCase and assign the value to the new object
      result[kebabToCamel(key)] = object[key]
    }
  }

  return result
}

/**
 * Normalizes function declarations to ensure consistent formatting.
 * Converts shorthand method syntax to full function declarations where needed,
 * while preserving arrow functions and existing full declarations.
 *
 * @param {Function} func - The function to normalize
 * @returns {string} The normalized function string representation
 */
export function normalizeFunction (func) {
  const original = func.toString().trim()

  // Find the first occurrence of either '{' or '=>'
  const firstBrace = original.indexOf('{')
  const firstArrow = original.indexOf('=>')

  // Determine the "Header Boundary"
  // If there's an arrow and it comes before a brace (or no brace exists),
  // it's an arrow function.
  const isArrow = firstArrow !== -1 && (firstBrace === -1 || firstArrow < firstBrace)

  if (isArrow) {
    // Return arrow functions as-is (e.g., log: (a) => a + 1)
    return original
  }

  // For non-arrows, extract header to check for shorthand
  const header = firstBrace !== -1 ? original.slice(0, firstBrace).trim() : original

  const isStandard = header.startsWith('function') || header.startsWith('async function')

  if (isStandard) {
    return original
  }

  // Handle Method Shorthand
  if (header.startsWith('async ')) {
    // Check for getters/setters
    if (header.startsWith('async get ') || header.startsWith('async set ')) {
      return original
    }

    // Capture the name (group 1) and allow $ in name
    return original.replace(/^async\s+([$\w]+)\s*\(/, 'async function $1(')
  } else {
    // Check for getters/setters
    if (header.startsWith('get ') || header.startsWith('set ')) return original

    // Capture the name (group 1) and allow $ in name
    return original.replace(/^([$\w]+)\s*\(/, 'function $1(')
  }
}


/**
   * Recursively clones a node and its children.
   * @param {CoraliteElement} node
   * @param {CoraliteElement|null} parent
   */
function cloneNode (nodeMap, node, parent) {
  // Shallow copy the node structure
  const newNode = { ...node }

  // Update parent reference
  if (parent) {
    newNode.parent = parent
  }

  // Deep copy 'attribs' because we mutate them (e.g. data-coralite-ref)
  if (newNode.attribs) {
    newNode.attribs = { ...newNode.attribs }
  }

  // Deep copy 'slots' array because we push to it
  if (newNode.slots) {
    newNode.slots = [...newNode.slots]
  }

  // Register in map
  nodeMap.set(node, newNode)

  // Recursively clone children
  if (newNode.children) {
    newNode.children = new Array(node.children.length)

    for (let i = 0; i < node.children.length; i++) {
      // @ts-ignore
      newNode.children[i] = cloneNode(nodeMap, node.children[i], newNode)
    }
  }

  return newNode
}

/**
/**
 * Creates a shallow copy of a CoraliteModule with a deep clone of its DOM tree (template) and re-linked internal references to enable safe independent mutation.
 *
 * Top-level non-DOM properties (id, path, script, isTemplate, lineOffset) are shallow copied. Nested objects within these properties (e.g., path) remain shared references. Only DOM-related structures undergo deep cloning and reference re-linking to isolate mutations from the original module.
 *
 * @param {CoraliteModule} originalModule - Module to clone.
 * @returns {CoraliteModule}
 */
export function cloneModuleInstance (originalModule) {
  const nodeMap = new Map()

  // Clone the main template tree
  const newTemplate = cloneNode(nodeMap, originalModule.template, null)

  // Reconstruct the 'values' object
  const newValues = {
    attributes: originalModule.values.attributes.map(item => ({
      ...item,
      element: nodeMap.get(item.element)
    })),
    textNodes: originalModule.values.textNodes.map(item => ({
      ...item,
      textNode: nodeMap.get(item.textNode)
    })),
    refs: originalModule.values.refs.map(item => ({
      ...item,
      element: nodeMap.get(item.element)
    }))
  }

  // Reconstruct customElements list
  const newCustomElements = originalModule.customElements.map(el => nodeMap.get(el))

  // Reconstruct slotElements
  const newSlotElements = {}
  if (originalModule.slotElements) {
    for (const modId in originalModule.slotElements) {
      newSlotElements[modId] = {}
      const slotGroup = originalModule.slotElements[modId]

      for (const slotName in slotGroup) {
        const slotItem = slotGroup[slotName]
        newSlotElements[modId][slotName] = {
          ...slotItem,
          element: nodeMap.get(slotItem.element)
        }
      }
    }
  }

  // Return the new module structure
  return {
    ...originalModule,
    template: newTemplate,
    values: newValues,
    customElements: newCustomElements,
    // @ts-ignore
    slotElements: newSlotElements
  }
}


/**
 * Converts ESM import/export syntax to CommonJS require/module.exports
 * This is a lightweight transform intended for use inside new Function()
 * where ES modules are not supported but Top-Level Await is needed (via async wrapper).
 *
 * @param {string} code - The ESM code to transform
 * @returns {string} - The CommonJS compatible code
 */
export function convertEsmToCjs (code) {
  let cjsCode = code

  // Handle "export { x, y as z }"
  cjsCode = cjsCode.replace(
    /export\s*\{([^}]+)\};?/g,
    (match, content) => {
      const exports = content.split(',').map(p => {
        const parts = p.trim().split(/\s+as\s+/)
        const name = parts[0].trim()
        const alias = parts[1] ? parts[1].trim() : name
        return `module.exports.${alias} = ${name};`
      }).filter(Boolean)
      return exports.join(' ')
    }
  )

  // Handle "export default"
  cjsCode = cjsCode.replace(/export\s+default\s+/g, 'module.exports.default = ')

  // Handle "export const/let/var x ="
  cjsCode = cjsCode.replace(
    /export\s+(const|let|var)\s+([$\w]+)\s*=/g,
    '$1 $2 = module.exports.$2 ='
  )

  // Handle "export function/class x" (including async)
  // `export async function foo` -> `module.exports.foo = async function foo`
  cjsCode = cjsCode.replace(
    /export\s+(async\s+function|function|class)\s+([$\w]+)/g,
    'module.exports.$2 = $1 $2'
  )

  // Handle "import { x } from 'y'"
  cjsCode = cjsCode.replace(
    /import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"];?/g,
    'const {$1} = require("$2");'
  )

  // Handle "import x from 'y'" (default import)
  // Matches "import identifier from 'path'"
  cjsCode = cjsCode.replace(
    /import\s+([$\w]+)\s+from\s*['"]([^'"]+)['"];?/g,
    'const _req_$1 = require("$2"); const $1 = _req_$1.default || _req_$1;'
  )

  // Handle "import * as x from 'y'"
  cjsCode = cjsCode.replace(
    /import\s*\*\s*as\s+([$\w]+)\s+from\s*['"]([^'"]+)['"];?/g,
    'const $1 = require("$2");'
  )

  // Handle side-effect import "import 'y'"
  cjsCode = cjsCode.replace(
    /import\s*['"]([^'"]+)['"];?/g,
    'require("$1");'
  )

  return cjsCode
}



/**
 * Replaces a token in a Coralite node based on its type, attribute, and content.
 *
 * @param {Object} token - The token to replace.
 * @param {string} token.type - The type of the token ('attribute' or 'text').
 * @param {CoraliteElement|CoraliteTextNode} token.node - The node containing the token.
 * @param {string} [token.attribute] - The attribute name to replace within the node.
 * @param {string} token.content - The content of the token.
 * @param {CoraliteModuleValue} token.value - The value associated with the token.
 */
export function replaceToken ({
  type,
  node,
  attribute,
  content,
  value
}) {
  if (
    type === 'attribute'
    && node.type === 'tag'
    && typeof value === 'string'
  ) {
    node.attribs[attribute] = node.attribs[attribute].replace(content, value)
  } else if (node.type === 'text') {
    if (typeof value === 'object') {
      if (!Array.isArray(value)) {
        // handle single nodes
        value = [value]
      }

      // inject nodes
      const textSplit = node.data.split(content)
      const childIndex = node.parent.children.indexOf(node)
      const children = []

      // append computed tokens in between token split
      for (let i = 0; i < value.length; i++) {
        const child = value[i]

        if (typeof child !== 'string' && child.type !== 'directive') {
          // update child parent
          child.parent = node.parent
          children.push(child)
        }
      }

      // replace computed token
      node.parent.children.splice(childIndex, 1,
        {
          type: 'text',
          data: textSplit[0],
          parent: node.parent
        },
        ...children,
        {
          type: 'text',
          data: textSplit[1],
          parent: node.parent
        })
    } else {
      // replace token string
      node.data = node.data.replace(content, value)
    }
  }
}
