import { parse as parseJS } from 'acorn'
import { simple as walkJS } from 'acorn-walk'
import render from 'dom-serializer'
import { sanitize } from 'isomorphic-dompurify'
import { parseHTML } from './parse.js'
import { isCoraliteNode } from '../types.js'
import { createCoraliteTextNode, relinkChildren } from './dom.js'
import { BOOLEAN_ATTRIBUTES } from '../tags.js'

/**
 * @import {
 * CoraliteElement,
 * CoraliteModuleDefinition,
 * CoraliteTextNode,
 * ScriptContent
 * } from '../../../types/index.js'
 */

const astCache = new Map()

function getAST (code, locations = false) {
  const cacheKey = `${code}_${locations}`
  if (astCache.has(cacheKey)) {
    return astCache.get(cacheKey)
  }
  const ast = parseJS(code, {
    ecmaVersion: 'latest',
    sourceType: 'module',
    locations
  })
  astCache.set(cacheKey, ast)
  return ast
}

/**
 * Extracts and normalizes the script content from a component definition.
 *
 * @param {string} code - The raw script content
 * @returns {ScriptContent | null}
 */
export function findAndExtractScript (code) {
  const ast = getAST(code, true)

  /** @type {ScriptContent | null} */
  let result = null
  const components = new Set()

  walkJS(ast, {
    CallExpression (node) {
      if (
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
        if (arg && (arg.type !== 'Literal' || (typeof arg.value === 'string' && arg.value.includes('-')))) {
          if (arg.type === 'Literal' && typeof arg.value === 'string') {
            components.add(arg.value)
          }
        }
      }

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
              prop.key.name === 'client'
          )

          if (scriptProp && scriptProp.type === 'Property') {
            const { value, method } = scriptProp
            let startLine = value.loc.start.line - 1
            let prefix = ''
            let content = ''

            // Get source slice
            let source = code.slice(value.start, value.end)

            // Collect all document.createElement calls within this client block for transformation
            const replacements = []
            walkJS(value, {
              CallExpression (node) {
                if (
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
                  if (arg && (arg.type !== 'Literal' || (typeof arg.value === 'string' && arg.value.includes('-')))) {
                    if (arg.type === 'Literal' && typeof arg.value === 'string') {
                      components.add(arg.value)
                    }
                    replacements.push({
                      start: node.callee.start - value.start,
                      end: node.callee.end - value.start,
                      replacement: 'createCoraliteElement'
                    })
                  }
                }
              }
            })

            // Apply replacements from end to start to maintain offsets
            replacements.sort((a, b) => b.start - a.start)
            for (const r of replacements) {
              source = source.slice(0, r.start) + r.replacement + source.slice(r.end)
            }

            if (value.type === 'ArrowFunctionExpression') {
              content = prefix + source
              startLine = value.loc.start.line - 1
            } else if (value.type === 'FunctionExpression') {
              if (method) {
                const isAsync = value.async
                prefix += (isAsync ? 'async ' : '') + 'function client'
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
        node.callee.type === 'Identifier' &&
        node.callee.name === 'createCoraliteElement'
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
 * Extracts and normalizes the state content from a component definition.
 *
 * @param {string} code - The raw script content
 * @returns {ScriptContent | null}
 */
export function findAndExtractProperties (code) {
  const ast = getAST(code, true)

  /** @type {ScriptContent | null} */
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
          const stateProp = firstArg.properties.find(
            prop => prop.type === 'Property' &&
              prop.key && prop.key.type === 'Identifier' &&
              prop.key.name === 'server'
          )

          if (stateProp && stateProp.type === 'Property') {
            const { value, method } = stateProp
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
                prefix += (isAsync ? 'async ' : '') + 'function server'
                content = prefix + source
                startLine = stateProp.key.loc.start.line - 1
              } else {
                content = prefix + source
                startLine = value.loc.start.line - 1
              }
            } else if (value.type === 'ObjectExpression') {
              // Wrap object in a function returning that object
              content = `() => (${source})`
              startLine = value.loc.start.line - 1
            }

            result = {
              content,
              lineOffset: startLine
            }
          }
        }
      }
    }
  })

  return result
}

/**
 * Extracts all component tag names dynamically created via document.createElement.
 *
 * @param {string} code - The raw script content
 * @returns {Array<string>} - Array of identified imperative component tags
 */
export function findAndExtractImperativeComponents (code) {
  try {
    const ast = getAST(code)

    const components = new Set()

    walkJS(ast, {
      CallExpression (node) {
        if (
          node.callee &&
          ((node.callee.type === 'MemberExpression' &&
          node.callee.object &&
          node.callee.object.type === 'Identifier' &&
          node.callee.object.name === 'document' &&
          node.callee.property &&
          node.callee.property.type === 'Identifier' &&
          node.callee.property.name === 'createElement') ||
          (node.callee.type === 'Identifier' &&
          node.callee.name === 'createCoraliteElement'))
        ) {
          const arg = node.arguments[0]
          if (arg && arg.type === 'Literal' && typeof arg.value === 'string' && arg.value.includes('-')) {
            components.add(arg.value)
          }
        }
      }
    })

    return [...components]
  } catch {
    return []
  }
}

/**
 * Extracts global variable names from a module script code using Acorn parsing and AST walking.
 * @param {string} code - The raw script code
 * @returns {Array<string>} - Array of identified global variables
 */
export function extractGlobals (code) {
  try {
    const ast = getAST(code)

    const globals = new Set()
    walkJS(ast, {
      Identifier (node) {
        globals.add(node.name)
      }
    })

    return [...globals]
  } catch {
    return []
  }
}

/**
 * Transforms Coralite AST nodes into HTML strings for serialization.
 *
 * @param {any} target - The target to transform.
 * @returns {any} The transformed target.
 */
export function astTransformer (target) {
  if (isCoraliteNode(target)) {
    // @ts-ignore
    return render(target, { decodeEntities: false })
  }

  if (Array.isArray(target) && target.length > 0 && isCoraliteNode(target[0])) {
    // @ts-ignore
    return render(target, { decodeEntities: false })
  }

  return target
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
  ) {
    if (BOOLEAN_ATTRIBUTES.has(attribute) && (node.attribs[attribute] || '').trim() === content) {
      // @ts-ignore
      const isFalsy = value === 'false' || value === 'null' || value === 'undefined' || value === '0' || value === 0 || value === '' || value === false || value === null || value === undefined

      if (isFalsy) {
        delete node.attribs[attribute]
      } else {
        node.attribs[attribute] = ''
      }
    } else if (typeof value === 'string') {
      node.attribs[attribute] = node.attribs[attribute].replace(content, value)
    }
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
        relinkChildren(node.parent)
      } else {
        // Handle object values like refs stringification
        node.data = node.data.replace(content, JSON.stringify(value))
      }
    } else {
      // replace token string
      // @ts-ignore
      const newVal = node.data.replace(content, value)
      const isHTML = /<[a-z][\s\S]*>/i.test(newVal)

      if (isHTML && node.parent
          && node.parent.type === 'tag'
          && node.parent.name === 'c-token'
      ) {
        const sanitized = sanitize(newVal)
        const parsed = parseHTML(sanitized)
        const children = parsed.root.children

        // Use the existing object-handling logic by recursing with the children array
        return replaceToken({
          type,
          node,
          attribute,
          content,
          value: children
        })
      }
      node.data = newVal
    }
  }
}
