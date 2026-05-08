import { parse as parseJS } from 'acorn'
import { simple as walkJS } from 'acorn-walk'
import { createCoraliteTextNode } from './dom.js'

/**
 * @import {
 * CoraliteElement,
 * CoraliteModule,
 * CoraliteModuleSlotElement,
 * CoraliteModuleDefinition,
 * CoraliteTextNode,
 * CoraliteComponent,
 * CoraliteComponentResult,
 * CoraliteContentNode,
 * CoraliteAnyNode,
 * CoraliteDirective,
 * ScriptImport,
 * ScriptContent
 * } from '../types/index.js'
 */

const KEBAB_REGEX = /[-|:]([a-z])/g

/**
 * Converts a kebab-case string to camelCase
 * @param {string} str - The kebab-case string to convert
 * @returns {string} - The camelCase version of the string
 */
export function kebabToCamel (str) {
  // replace each dash followed by a letter with the uppercase version of the letter
  return str.replace(KEBAB_REGEX, function (match, letter) {
    return letter.toUpperCase()
  })
}

/**
 * Converts all keys in an object from kebab-case to camelCase
 * @template T
 * @param {Record<string, T>} object - The object with kebab-case keys
 * @returns {Record<string, T>} - A new object with camelCase keys
 */
export function cleanKeys (object) {
  /** @type {Record<string, T>} */
  const result = {}

  for (const [key, value] of Object.entries(object)) {
    result[key] = value

    const camelKey = kebabToCamel(key)
    if (camelKey !== key) {
      result[camelKey] = value
    }
  }

  return result
}

/**
 * Recursively clones an object or array and normalizes any function properties
 * it finds into a string representation that preserves standard function syntax,
 * bypassing ES6 shorthand method serialization issues.
 * @param {any} target - The object or array to normalize.
 * @param {WeakMap} [seen=new WeakMap()] - Map of seen objects to handle circular references.
 * @returns {any} A deeply cloned object with normalized functions.
 */
export function normalizeObjectFunctions (target, seen = new WeakMap()) {
  if (typeof target !== 'object' || target === null) {
    return target
  }

  if (seen.has(target)) {
    return seen.get(target)
  }

  if (Array.isArray(target)) {
    const arr = []
    seen.set(target, arr)
    for (let i = 0; i < target.length; i++) {
      arr.push(normalizeObjectFunctions(target[i], seen))
    }
    return arr
  }

  const obj = {}
  seen.set(target, obj)
  for (const key in target) {
    if (Object.hasOwn(target, key)) {
      if (typeof target[key] === 'function') {
        const normalizedString = normalizeFunction(target[key])
        const originalFunction = target[key]

        const wrapper = function () {
          return originalFunction.apply(this, arguments)
        }
        wrapper.toString = () => normalizedString
        obj[key] = wrapper
      } else {
        obj[key] = normalizeObjectFunctions(target[key], seen)
      }
    }
  }

  return obj
}

/**
 * Checks whether the given object is an object and has at least one own key.
 * @param {any} obj - The object to check.
 * @returns {boolean} True if the object is truthy and has keys, otherwise false.
 */
export function hasObjectKeys (obj) {
  return obj && typeof obj === 'object' && Object.keys(obj).length > 0
}

/**
 * Merges two arrays, returning a new array with unique items.
 * Uses JSON.stringify for deep comparison of object elements, preserving object uniqueness correctly.
 * @param {Array<any>} [arr1] - The first array.
 * @param {Array<any>} [arr2] - The second array.
 * @returns {Array<any>} A new array with unique values from both input arrays.
 */
export function mergeUniqueObjects (arr1, arr2) {
  const all = [...(arr1 || []), ...(arr2 || [])]
  const seen = new Set()
  return all.filter(item => {
    const key = typeof item === 'object' ? JSON.stringify(item) : item
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
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
    return original.replace(/^async\s+([$\w]+)\s*\(/, 'async function(')
  } else {
    // Check for getters/setters
    if (header.startsWith('get ') || header.startsWith('set ')) {
      return original
    }

    // Capture the name (group 1) and allow $ in name
    return original.replace(/^([$\w]+)\s*\(/, 'function(')
  }
}


/**
 * Recursively clones an AST node and its children, ensuring that
 * inner references (like parents and slots) point to the newly cloned nodes.
 *
 * @param {Map<Object, Object>} nodeMap - A map tracking original nodes to their newly cloned counterparts.
 * @param {Object} node - The current AST node being cloned.
 * @param {Object} [parent] - The parent node reference to assign to the clone.
 * @returns {Object} The newly cloned node.
 */
export function cloneNode (nodeMap, node, parent) {
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

  // Update slot references to point to new cloned nodes
  if (newNode.slots) {
    for (let i = 0; i < newNode.slots.length; i++) {
      const slot = newNode.slots[i]
      if (slot.node) {
        const clonedNode = nodeMap.get(slot.node)
        if (clonedNode) {
          slot.node = clonedNode
        }
      }
    }
  }

  return newNode
}

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
 * Replaces a token in a Coralite node based on its type, attribute, and content.
 *
 * @param {Object} token - The token to replace.
 * @param {string} token.type - The type of the token ('attribute' or 'text').
 * @param {CoraliteElement|CoraliteTextNode} token.node - The node containing the token.
 * @param {string} [token.attribute] - The attribute name to replace within the node.
 * @param {string} token.content - The content of the token.
 * @param {CoraliteModuleDefinition} token.value - The definition associated with the token.
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
    if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value) || value.type) {
        let nodesArray = Array.isArray(value) ? value : [value]

        // inject nodes
        const textSplit = node.data.split(content)
        const childIndex = node.parent.children.indexOf(node)
        const children = []

        // append computed tokens in between token split
        for (let i = 0; i < nodesArray.length; i++) {
          const child = nodesArray[i]

          if (typeof child !== 'string' && child.type !== 'directive' && typeof child === 'object' && child.type) {
            // update child parent
            // @ts-ignore
            child.parent = node.parent
            // @ts-ignore
            children.push(child)
          }
        }

        // replace computed token
        node.parent.children.splice(childIndex, 1,
          createCoraliteTextNode({
            type: 'text',
            data: textSplit[0],
            parent: node.parent
          }),
          // @ts-ignore
          ...children,
          createCoraliteTextNode({
            type: 'text',
            data: textSplit[1],
            parent: node.parent
          })
        )
      } else {
        // Handle object values like refs stringification
        node.data = node.data.replace(content, JSON.stringify(value))
      }
    } else {
      // replace token string
      // @ts-ignore
      node.data = node.data.replace(content, value)
    }
  }
}

/**
 * Creates a deep copy of a CoraliteComponent with re-linked internal references to enable safe independent mutation.
 *
 * @param {CoraliteComponent & CoraliteComponentResult} originalDocument - Document to clone.
 * @returns {CoraliteComponent & CoraliteComponentResult}
 */
export function cloneComponentInstance (originalDocument) {
  const nodeMap = new Map()
  const newRoot = cloneNode(nodeMap, originalDocument.root, null)

  const newCustomElements = originalDocument.customElements.map(el => nodeMap.get(el))
  const newTempElements = originalDocument.tempElements ? originalDocument.tempElements.map(el => nodeMap.get(el)) : []
  const newSkipRenderElements = originalDocument.skipRenderElements ? originalDocument.skipRenderElements.map(el => nodeMap.get(el)) : []

  return {
    ...originalDocument,
    properties: { ...originalDocument.properties },
    root: newRoot,
    customElements: newCustomElements,
    tempElements: newTempElements,
    skipRenderElements: newSkipRenderElements
  }
}

/**
 * Extracts and normalizes the script content from a component definition.
 *
 * @param {string} code - The raw script content
 * @returns {ScriptContent | null}
 */
export function findAndExtractScript (code) {
  const ast = parseJS(code, {
    ecmaVersion: 'latest',
    sourceType: 'module',
    locations: true
  })

  /** @type {ScriptContent | null} */
  let result = null
  const components = new Set()

  walkJS(ast, {
    CallExpression (node) {
      if (
        node.callee &&
        node.callee.type === 'Identifier' &&
        node.callee.name === 'defineComponent'
      ) {
        const firstArg = node.arguments[0]

        if (firstArg && firstArg.type === 'ObjectExpression') {
          const scriptProp = firstArg.properties.find(
            prop => prop.type === 'Property' &&
              prop.key && prop.key.type === 'Identifier' &&
              prop.key.name === 'script'
          )

          if (scriptProp && scriptProp.type === 'Property') {
            const { value, method } = scriptProp
            let startLine = value.loc.start.line - 1
            let prefix = ''
            let content = ''

            // Get source slice
            const source = code.slice(value.start, value.end)

            if (value.type === 'ArrowFunctionExpression') {
              content = prefix + source
              startLine = value.loc.start.line - 1
            } else if (value.type === 'FunctionExpression') {
              if (method) {
                const isAsync = value.async
                prefix += (isAsync ? 'async ' : '') + 'function script'
                content = prefix + source
                startLine = scriptProp.key.loc.start.line - 1
              } else {
                content = prefix + source
                startLine = value.loc.start.line - 1
              }
            }

            result = {
              content,
              lineOffset: startLine
            }
          }
        }
      } else if (
        node.callee &&
        node.callee.type === 'MemberExpression' &&
        node.callee.object &&
        node.callee.object.type === 'Identifier' &&
        node.callee.object.name === 'document' &&
        node.callee.property &&
        node.callee.property.type === 'Identifier' &&
        node.callee.property.name === 'createElement'
      ) {
        const arg = node.arguments[0]
        if (arg && arg.type === 'Literal' && typeof arg.value === 'string') {
          components.add(arg.value)
        }
      }
    }
  })

  if (result && components.size > 0) {
    result.components = Array.from(components)
  }

  return result
}

/**
 * Safely merges partial plugin updates into the main context object.
 * Deeply merges plain objects and overwrites other types (arrays, primitives, etc.).
 *
 * @param {any} current - The current state object.
 * @param {any} patch - The patch object containing updates.
 * @returns {any} The newly merged state object.
 */
export function mergePluginState (current, patch) {
  if (!patch || typeof patch !== 'object') {
    return current
  }

  const result = { ...current }

  for (const key of Object.keys(patch)) {
    const patchValue = patch[key]
    const currentValue = result[key]

    // If both are plain objects, merge them deeply
    if (
      patchValue && typeof patchValue === 'object' && !Array.isArray(patchValue) &&
      currentValue && typeof currentValue === 'object' && !Array.isArray(currentValue)
    ) {
      result[key] = mergePluginState(currentValue, patchValue)
    } else {
      // Otherwise, overwrite (Arrays, strings, numbers, etc.)
      result[key] = patchValue
    }
  }

  return result
}

/**
 * Extracts global variable names from a module script code using Acorn parsing and AST walking.
 * @param {string} code - The raw script code
 * @returns {Array<string>} - Array of identified global variables
 */
export function extractGlobals (code) {
  try {
    const ast = parseJS(code, {
      ecmaVersion: 'latest',
      sourceType: 'module'
    })

    const globals = new Set()
    walkJS(ast, {
      Identifier (node) {
        globals.add(node.name)
      }
    })

    return [...globals]
  } catch (err) {
    return []
  }
}
