import { parse as parseJS } from 'acorn'
import { simple as walkJS, ancestor as walkAncestorJS } from 'acorn-walk'
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
 * Resolves potential string values for a node, tracing variables if necessary.
 *
 * @param {any} node - The AST node to resolve
 * @param {any[]} ancestors - The ancestors of the node
 * @returns {string[]} - Array of potential string values
 */
function resolveStringValues (node, ancestors) {
  if (!node) {
    return []
  }

  if (node.type === 'Literal' && typeof node.value === 'string') {
    return [node.value]
  }

  if (node.type === 'ConditionalExpression') {
    return [
      ...resolveStringValues(node.consequent, ancestors),
      ...resolveStringValues(node.alternate, ancestors)
    ]
  }

  if (node.type === 'Identifier' && ancestors && ancestors.length > 0) {
    const name = node.name
    // Trace back through ancestors to find the declaration
    for (let i = ancestors.length - 1; i >= 0; i--) {
      const ancestor = ancestors[i]

      // Identify potential body of statements to search
      let body = null
      if (ancestor.type === 'BlockStatement' || ancestor.type === 'Program') {
        body = ancestor.body
      } else if (
        ancestor.type === 'FunctionExpression' ||
        ancestor.type === 'ArrowFunctionExpression' ||
        ancestor.type === 'FunctionDeclaration'
      ) {
        if (ancestor.body && ancestor.body.type === 'BlockStatement') {
          body = ancestor.body.body
        }
      }

      if (body && Array.isArray(body)) {
        for (const stmt of body) {
          if (stmt.type === 'VariableDeclaration') {
            for (const decl of stmt.declarations) {
              if (decl.id.type === 'Identifier' && decl.id.name === name && decl.init) {
                // Return potential values, but prevent further identifier resolution to avoid loops and keep it fast
                return resolveStringValues(decl.init, [])
              }
            }
          }
        }
      }
    }
  }

  return []
}

/**
 * Extracts custom components from an HTML string.
 *
 * @param {string} html - The HTML string
 * @param {Set<string>} components - The set to add identified components to
 */
function extractFromHTMLString (html, components) {
  try {
    const matches = html.matchAll(/<([a-zA-Z0-9-]+)/g)
    for (const match of matches) {
      const tag = match[1].toLowerCase()
      if (tag.includes('-')) {
        components.add(tag)
      }
    }
  } catch {
    // Ignore errors
  }
}

/**
 *
 */
export function findAndExtractScript (code) {
  const ast = getAST(code, true)

  /** @type {ScriptContent | null} */
  let result = null
  const components = new Set()

  const findHTMLComponents = (node, ancestors = []) => {
    if (node.type === 'Literal' && typeof node.value === 'string') {
      extractFromHTMLString(node.value, components)
    } else if (node.type === 'TemplateLiteral') {
      for (const element of node.quasis) {
        if (element.value && element.value.cooked) {
          extractFromHTMLString(element.value.cooked, components)
        }
      }
    } else {
      const values = resolveStringValues(node, ancestors)
      for (const val of values) {
        extractFromHTMLString(val, components)
      }
    }
  }

  walkAncestorJS(ast, {
    AssignmentExpression (node, ancestors) {
      if (
        node.left.type === 'MemberExpression' &&
        node.left.property.type === 'Identifier' &&
        (node.left.property.name === 'innerHTML' || node.left.property.name === 'outerHTML')
      ) {
        findHTMLComponents(node.right, ancestors)
      }
    },
    CallExpression (node, ancestors) {
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
        if (arg) {
          const values = resolveStringValues(arg, ancestors)
          for (const val of values) {
            if (val.includes('-')) {
              components.add(val)
            }
          }
        }
      }

      if (
        node.callee &&
        node.callee.type === 'MemberExpression' &&
        node.callee.property &&
        node.callee.property.type === 'Identifier' &&
        node.callee.property.name === 'insertAdjacentHTML'
      ) {
        const arg = node.arguments[1]
        if (arg) {
          findHTMLComponents(arg, ancestors)
        }
      }

      if (
        node.callee &&
        node.callee.type === 'Identifier' &&
        node.callee.name === 'defineComponent'
      ) {
        const firstArg = node.arguments[0]

        if (firstArg && firstArg.type === 'ObjectExpression') {
          // Track explicit dependencies array
          const depsProp = firstArg.properties.find(
            prop => prop.type === 'Property' &&
              prop.key && prop.key.type === 'Identifier' &&
              prop.key.name === 'dependencies'
          )

          if (depsProp && depsProp.type === 'Property' && depsProp.value.type === 'ArrayExpression') {
            for (const el of depsProp.value.elements) {
              if (el && el.type === 'Literal' && typeof el.value === 'string') {
                components.add(el.value)
              }
            }
          }

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

            /**
             * Deterministically resolve the instance ID variable name for processHTML calls.
             * Supports:
             * - client({ id }) => id
             * - client(context) => context.id
             * - client() { ... } (Method shorthand) => this.instanceId
             * Defaults to 'id' if no parameters are present and it's not a method.
             */
            // Collect all document.createElement calls within this client block for transformation
            const replacements = []

            let instanceIdVar
            // @ts-ignore
            if (value.params && value.params[0]) {
              // @ts-ignore
              const param = value.params[0]
              if (param.type === 'Identifier') {
                instanceIdVar = param.name + '.instanceId'
              } else if (param.type === 'ObjectPattern') {
                // @ts-ignore
                const idProp = param.properties.find(p => p.key?.type === 'Identifier' && p.key?.name === 'instanceId')
                if (idProp) {
                  if (idProp.value.type === 'Identifier') {
                    instanceIdVar = idProp.value.name
                  }
                } else {
                  instanceIdVar = '_coralite_instanceId'
                  replacements.push({
                    start: param.start - (value.start + 1),
                    end: param.start - (value.start + 1),
                    replacement: 'instanceId: _coralite_instanceId, '
                  })
                }
              }
            } else if (method) {
              instanceIdVar = 'this._instanceId'
            }

            // Get source slice
            let source = code.slice(value.start, value.end)
            walkAncestorJS(value, {
              AssignmentExpression (node, ancestorsInClient) {
                if (
                  node.left.type === 'MemberExpression' &&
                  node.left.property.type === 'Identifier' &&
                  (node.left.property.name === 'innerHTML' || node.left.property.name === 'outerHTML')
                ) {
                  findHTMLComponents(node.right, [...ancestors, ...ancestorsInClient])
                  replacements.push({
                    start: node.right.start - value.start,
                    end: node.right.start - value.start,
                    replacement: 'processHTML('
                  })
                  replacements.push({
                    start: node.right.end - value.start,
                    end: node.right.end - value.start,
                    replacement: `, ${instanceIdVar})`
                  })
                }
              },
              CallExpression (node, ancestorsInClient) {
                const combinedAncestors = [...ancestors, ...ancestorsInClient]
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
                  if (arg) {
                    const values = resolveStringValues(arg, combinedAncestors)
                    let isCustom = false
                    for (const val of values) {
                      if (val.includes('-')) {
                        components.add(val)
                        isCustom = true
                      }
                    }

                    if (isCustom || (arg.type === 'Literal' && typeof arg.value === 'string' && arg.value.includes('-')) || arg.type !== 'Literal') {
                      replacements.push({
                        start: node.callee.start - value.start,
                        end: node.callee.end - value.start,
                        replacement: 'createCoraliteElement'
                      })
                    }
                  }
                }

                if (
                  node.callee &&
                  node.callee.type === 'MemberExpression' &&
                  node.callee.property &&
                  node.callee.property.type === 'Identifier' &&
                  node.callee.property.name === 'insertAdjacentHTML'
                ) {
                  const arg = node.arguments[1]
                  if (arg) {
                    findHTMLComponents(arg, combinedAncestors)
                    replacements.push({
                      start: arg.start - value.start,
                      end: arg.start - value.start,
                      replacement: 'processHTML('
                    })
                    replacements.push({
                      start: arg.end - value.start,
                      end: arg.end - value.start,
                      replacement: `, ${instanceIdVar})`
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
        if (arg) {
          const values = resolveStringValues(arg, ancestors)
          for (const val of values) {
            if (val.includes('-')) {
              components.add(val)
            }
          }
        }
      }
    }
  })

  if (result) {
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
/**
 * Extracts a specific property from a defineComponent call.
 *
 * @param {string} code - The raw script content
 * @param {string} propertyName - The name of the property to extract
 * @returns {ScriptContent | null}
 */
export function extractComponentProperty (code, propertyName) {
  const ast = getAST(code, true)
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
          const prop = firstArg.properties.find(
            p => p.type === 'Property' &&
              p.key && p.key.type === 'Identifier' &&
              p.key.name === propertyName
          )

          if (prop && prop.type === 'Property') {
            const { value, method } = prop
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
                prefix += (isAsync ? 'async ' : '') + 'function ' + propertyName
                content = prefix + source
                startLine = prop.key.loc.start.line - 1
              } else {
                content = prefix + source
                startLine = value.loc.start.line - 1
              }
            } else if (value.type === 'ObjectExpression') {
              if (propertyName === 'server') {
                content = `() => (${source})`
              } else {
                content = source
              }
              startLine = value.loc.start.line - 1
            } else if (value.type === 'Literal' || value.type === 'Identifier') {
              content = source
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

    const findHTMLComponents = (node, ancestors = []) => {
      if (node.type === 'Literal' && typeof node.value === 'string') {
        extractFromHTMLString(node.value, components)
      } else if (node.type === 'TemplateLiteral') {
        for (const element of node.quasis) {
          extractFromHTMLString(element.value.cooked, components)
        }
      } else {
        const values = resolveStringValues(node, ancestors)
        for (const val of values) {
          extractFromHTMLString(val, components)
        }
      }
    }

    walkAncestorJS(ast, {
      AssignmentExpression (node, ancestors) {
        if (
          node.left.type === 'MemberExpression' &&
          node.left.property.type === 'Identifier' &&
          (node.left.property.name === 'innerHTML' || node.left.property.name === 'outerHTML')
        ) {
          findHTMLComponents(node.right, ancestors)
        }
      },
      CallExpression (node, ancestors) {
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
          if (arg) {
            const values = resolveStringValues(arg, ancestors)
            for (const val of values) {
              if (val.includes('-')) {
                components.add(val)
              }
            }
          }
        }

        if (
          node.callee &&
          node.callee.type === 'MemberExpression' &&
          node.callee.property &&
          node.callee.property.type === 'Identifier' &&
          node.callee.property.name === 'insertAdjacentHTML'
        ) {
          const arg = node.arguments[1]
          if (arg) {
            findHTMLComponents(arg, ancestors)
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
