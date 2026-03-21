import { parse as parseJS } from 'acorn'
import { simple as walkJS } from 'acorn-walk'
import { createCoraliteTextNode } from './dom.js'

/**
 * @import {CoraliteElement, CoraliteModule, CoraliteModuleSlotElement, CoraliteModuleValue, CoraliteTextNode, CoraliteComponent, CoraliteComponentResult, CoraliteContentNode, CoraliteAnyNode, CoraliteDirective} from '../types/index.js'
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
   * @param {any} node
   * @param {any} parent
   * @returns {any}
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
    values: { ...originalDocument.values },
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
 * @returns {import('../types/script.js').ScriptContent | null}
 */
export function findAndExtractScript (code) {
  const ast = parseJS(code, {
    ecmaVersion: 'latest',
    sourceType: 'module',
    locations: true
  })

  /** @type {import('../types/script.js').ScriptContent | null} */
  let result = null

  walkJS(ast, {
    CallExpression (node) {
      if (
        node.callee &&
        node.callee.type === 'Identifier' &&
        node.callee.name === 'defineComponent'
      ) {
        const firstArg = node.arguments[0]

        if (firstArg && firstArg.type === 'ObjectExpression') {
          const tokensProp = firstArg.properties.find(
            prop => prop.type === 'Property' &&
              prop.key.type === 'Identifier' &&
              prop.key.name === 'tokens'
          )

          let tokens = []
          if (tokensProp && tokensProp.type === 'Property' && tokensProp.value.type === 'ObjectExpression') {
            tokens = tokensProp.value.properties.map(p => {
              if (p.type === 'Property') {
                return p.key.type === 'Identifier' ? p.key.name : (p.key.type === 'Literal' ? p.key.value : undefined)
              }
              return undefined
            }).filter(Boolean)
          }

          const clientProp = firstArg.properties.find(
            prop => prop.type === 'Property' &&
              prop.key.type === 'Identifier' &&
              prop.key.name === 'client'
          )

          if (clientProp && clientProp.type === 'Property' && clientProp.value.type === 'ObjectExpression') {
            const scriptProp = clientProp.value.properties.find(
              prop => prop.type === 'Property' &&
                prop.key.type === 'Identifier' &&
                prop.key.name === 'script'
            )

            const setupProp = clientProp.value.properties.find(
              prop => prop.type === 'Property' &&
                prop.key.type === 'Identifier' &&
                prop.key.name === 'setup'
            )

            const importsProp = clientProp.value.properties.find(
              prop => prop.type === 'Property' &&
                prop.key.type === 'Identifier' &&
                prop.key.name === 'imports'
            )

            /** @type {import('../types/script.js').ScriptImport[] | undefined} */
            let imports = undefined
            if (importsProp && importsProp.type === 'Property' && importsProp.value.type === 'ArrayExpression') {
              imports = importsProp.value.elements.reduce((acc, el) => {
                /** @type {Record<string, any>} */
                const imp = {}
                let hasSpecifier = false
                if (el.type === 'ObjectExpression') {
                  el.properties.forEach(p => {
                    if (p.type !== 'Property') return

                    const pKey = p.key
                    const key = String(pKey.type === 'Identifier' ? pKey.name : (pKey.type === 'Literal' ? pKey.value : ''))

                    if (!key) return

                    if (p.value.type === 'Literal') {
                      imp[key] = p.value.value
                    } else if (p.value.type === 'ArrayExpression') {
                      const elements = p.value.elements
                      imp[key] = elements.map(e => ((e && e.type === 'Literal') ? e.value : undefined))
                    } else if (p.value.type === 'ObjectExpression') {
                      imp[key] = {}
                      p.value.properties.forEach(op => {
                        if (op.type === 'Property') {
                          const opKey = op.key
                          const opKeyName = (opKey.type === 'Identifier' ? opKey.name : (opKey.type === 'Literal' ? opKey.value : undefined))
                          if (typeof opKeyName === 'string' && op.value.type === 'Literal') {
                            imp[key][opKeyName] = String(op.value.value)
                          }
                        }
                      })
                    }
                    if (key === 'specifier') {
                      hasSpecifier = true
                    }
                  })
                }
                if (hasSpecifier) {
                  // Type cast when we know it has the required properties
                  acc.push(/** @type {import('../types/script.js').ScriptImport} */ (imp))
                }
                return acc
              }, /** @type {import('../types/script.js').ScriptImport[]} */([]))
            }

            let setupContent = undefined
            if (setupProp && setupProp.type === 'Property') {
              const { value, method } = setupProp
              let prefix = ''

              const source = code.slice(value.start, value.end)
              if (value.type === 'ArrowFunctionExpression') {
                setupContent = source
              } else if (value.type === 'FunctionExpression') {
                if (method) {
                  const isAsync = value.async
                  prefix += (isAsync ? 'async ' : '') + 'function setup'
                  setupContent = prefix + source
                } else {
                  setupContent = source
                }
              }
            }

            if (scriptProp && scriptProp.type === 'Property') {
              const { value, method } = scriptProp
              let startLine = value.loc.start.line - 1
              let prefix = ''
              let content = ''

              // Get source slice
              const source = code.slice(value.start, value.end)

              if (value.type === 'ArrowFunctionExpression') {
                // Arrow function: `script: (ctx) => {}` or `script: async (ctx) => {}`
                content = prefix + source
                startLine = value.loc.start.line - 1
              } else if (value.type === 'FunctionExpression') {
                if (method) {
                  // Reconstruct function declaration
                  const isAsync = value.async
                  prefix += (isAsync ? 'async ' : '') + 'function script'
                  content = prefix + source
                  startLine = scriptProp.key.loc.start.line - 1
                } else {
                  // Function expression: `script: function(ctx) {}` or `script: async function(ctx) {}`
                  content = prefix + source
                  startLine = value.loc.start.line - 1
                }
              }

              result = {
                content,
                lineOffset: startLine
              }
              if (imports) {
                result.imports = imports
              }
              if (setupContent) {
                result.setupContent = setupContent
              }
            } else if (imports || setupContent) {
              result = {
                content: 'export default function(){}',
                lineOffset: 0
              }
              if (imports) {
                result.imports = imports
              }
              if (setupContent) {
                result.setupContent = setupContent
              }
            }

            if (result && tokens.length > 0) {
              result.tokens = tokens
            }
          } else if (tokens.length > 0) {
            // Handle case where tokens exist but client does not
            result = {
              content: 'export default function(){}',
              lineOffset: 0,
              tokens
            }
          }
        }
      }
    }
  })

  return result
}
