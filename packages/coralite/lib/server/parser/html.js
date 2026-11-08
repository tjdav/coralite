import render from 'dom-serializer'
import { parse as parseJS } from 'acorn'
import { simple as walkJS } from 'acorn-walk'
import { parseHTML } from '../utils/parse.js'
import { relinkChildren } from '../utils/dom.js'
import { CoraliteError } from '../../shared/errors.js'
import { PAGE_EXPORTS, REJECTED_PAGE_EXPORTS } from '../../shared/page.js'

/**
 * @import { CoraliteElement, CoraliteAnyNode, CoraliteComponentRoot, Attribute, CoraliteModule, CoraliteSession } from '../../../types/index.js'
 * @import { DomSerializerOptions } from 'dom-serializer'
 */

/**
 * Renders the provided node or array of nodes using the render function.
 *
 * @param {CoraliteComponentRoot | CoraliteAnyNode | CoraliteAnyNode[]} root - The node(s) to be rendered.
 * @param {DomSerializerOptions} [options] - Changes serialization behavior
 * @returns {string}
 */
export function transformNode (root, options) {
  // @ts-ignore
  return render(root, {
    decodeEntities: false,
    ...options
  })
}

/**
 * Replaces a custom element with its template content.
 * @param {CoraliteElement} coraliteElement - The custom element to be replaced.
 * @param {CoraliteElement} element - The target element to replace the tokens with.
 */
export function replaceCustomElementWithTemplate (coraliteElement, element) {
  coraliteElement.children = element.children
  relinkChildren(coraliteElement)
}

/**
 * Process a token value - parse HTML strings and handle custom elements
 * @param {any} value - The value to process
 * @param {Object} context - Processing context
 * @param {Attribute[]} [context.excludeByAttribute] - List of attribute name-value pairs to ignore
 * @param {Object} [context.state] - Replacement tokens for the component
 * @param {CoraliteModule} [context.module] - The component module
 * @param {Function} [context.createComponentElement] - The createComponentElement function
 * @param {CoraliteSession} [context.session] - The current build session
 * @param {boolean} [context.noHydration] - No hydration flag
 * @param {any} [context.page] - Page context object
 * @returns {Promise<any>} - Processed value
 */
export async function processTokenValue (value, context) {
  const { excludeByAttribute, state, module, createComponentElement, session, noHydration, page } = context
  // If not a string, return as-is
  if (typeof value !== 'string') {
    return value
  }

  // Parse HTML string
  const result = parseHTML(value, excludeByAttribute)

  // If no children, return undefined (for empty HTML)
  if (!result.root.children.length) {
    return undefined
  }

  // Populate slots on custom elements if needed
  for (let i = 0; i < result.customElements.length; i++) {
    const customElement = result.customElements[i]
    if (customElement.children && customElement.children.length && (!customElement.slots || !customElement.slots.length)) {
      customElement.slots = []
      for (let k = 0; k < customElement.children.length; k++) {
        const childNode = customElement.children[k]
        let slotName = 'default'
        if (childNode.type === 'tag' && childNode.attribs && childNode.attribs.slot) {
          slotName = childNode.attribs.slot
          delete childNode.attribs.slot
        }
        customElement.slots.push({
          name: slotName,
          node: childNode
        })
      }
    }
  }

  // Process custom elements
  for (let i = 0; i < result.customElements.length; i++) {
    const customElement = result.customElements[i]

    /** @type {any} */
    let ancestor = customElement.parent
    let shouldSkip = false
    while (ancestor) {
      if (result.customElements.includes(ancestor)) {
        shouldSkip = true
        break
      }
      ancestor = ancestor.parent
    }
    if (shouldSkip) {
      continue
    }

    let ancestorNoHydration = noHydration
    /** @type {any} */
    let checkParent = customElement.parent
    while (checkParent) {
      if (checkParent.attribs && 'no-hydration' in checkParent.attribs) {
        ancestorNoHydration = true
        break
      }
      checkParent = checkParent.parent
    }
    const cid = `${module.path.pathname}${customElement.name}-${i}`
    const childNoHydration = ancestorNoHydration || Boolean(customElement.attribs && 'no-hydration' in customElement.attribs)

    const componentElement = await createComponentElement({
      contextId: cid,
      id: customElement.name,
      state,
      element: customElement,
      module,
      page,
      index: i,
      session,
      noHydration: childNoHydration,
      head: false
    })

    if (componentElement) {
      if (childNoHydration) {
        const parent = customElement.parent
        if (parent && parent.children) {
          const elementIndex = parent.children.indexOf(customElement)
          if (elementIndex !== -1) {
            parent.children.splice(elementIndex, 1, ...componentElement.children)
            relinkChildren(parent)
          }
        }
      } else {
        customElement.children = componentElement.children
        relinkChildren(customElement)

        if (!customElement.attribs) {
          customElement.attribs = {}
        }
        customElement.attribs['data-cid'] = cid
        customElement.attribs['data-coralite-initial'] = ''

        session.componentTags.add(customElement.name)
      }
    }
  }

  // For static strings, optimize single text nodes
  if (result.root.children.length === 1 && result.root.children[0].type === 'text') {
    return result.root.children[0].data
  }

  return result.root.children
}

const ALLOWED_PAGE_BLOCKS = new Set(PAGE_EXPORTS)

/**
 * Parses and extracts definePage configuration from page HTML scripts.
 *
 * @param {string} content - Raw page HTML content
 * @param {Object} [options={}] - Options containing filePath
 * @returns {{ hasDefinePage: boolean, hasPageExports: boolean, blocks: Record<string, any> | null, script: string | null }}
 */
export function extractPageScript (content, options = {}) {
  const filePath = options.filePath || ''
  if (!content || typeof content !== 'string') {
    return {
      hasDefinePage: false,
      hasPageExports: false,
      blocks: null,
      script: null
    }
  }

  const scriptRegex = /<script[\s\S]*?>([\s\S]*?)<\/script>/gi
  let match
  let scriptContent = null

  while ((match = scriptRegex.exec(content)) !== null) {
    if (match[1] !== undefined) {
      scriptContent = match[1]
      break
    }
  }

  if (!scriptContent || !scriptContent.trim()) {
    return {
      hasDefinePage: false,
      hasPageExports: false,
      blocks: null,
      script: null
    }
  }

  let ast
  try {
    ast = parseJS(scriptContent, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      locations: true
    })
  } catch {
    return {
      hasDefinePage: false,
      hasPageExports: false,
      blocks: null,
      script: scriptContent
    }
  }

  let definePageCall = null
  let definePageArg = null
  let hasPageExports = false

  if (ast && ast.body) {
    for (const node of ast.body) {
      if (node.type === 'ExportNamedDeclaration') {
        if (node.declaration) {
          if (node.declaration.type === 'VariableDeclaration') {
            for (const decl of node.declaration.declarations) {
              if (decl.id && decl.id.type === 'Identifier' && ALLOWED_PAGE_BLOCKS.has(decl.id.name)) {
                hasPageExports = true
              }
            }
          } else if (node.declaration.type === 'FunctionDeclaration') {
            if (node.declaration.id && ALLOWED_PAGE_BLOCKS.has(node.declaration.id.name)) {
              hasPageExports = true
            }
          }
        }
        if (node.specifiers) {
          for (const spec of node.specifiers) {
            let exportedName = ''
            if (spec.exported) {
              exportedName = spec.exported.type === 'Identifier' ? spec.exported.name : String(spec.exported.value)
            } else if (spec.local) {
              exportedName = spec.local.type === 'Identifier' ? spec.local.name : String(spec.local.value)
            }
            if (ALLOWED_PAGE_BLOCKS.has(exportedName)) {
              hasPageExports = true
            }
          }
        }
      }

      if (node.type === 'ExportDefaultDeclaration') {
        const decl = node.declaration
        if (
          decl &&
          decl.type === 'CallExpression' &&
          decl.callee &&
          decl.callee.type === 'Identifier' &&
          decl.callee.name === 'definePage'
        ) {
          definePageCall = decl
          definePageArg = decl.arguments[0]
        }
      }
    }

    if (!definePageCall) {
      walkJS(ast, {
        CallExpression (node) {
          if (
            node.callee &&
            node.callee.type === 'Identifier' &&
            node.callee.name === 'definePage' &&
            !definePageCall
          ) {
            definePageCall = node
            definePageArg = node.arguments[0]
          }
        }
      })
    }
  }

  if (!definePageCall || !definePageArg || definePageArg.type !== 'ObjectExpression') {
    return {
      hasDefinePage: false,
      hasPageExports,
      blocks: null,
      script: scriptContent
    }
  }

  const blocks = {}

  for (const prop of definePageArg.properties) {
    if (prop.type !== 'Property') {
      continue
    }

    let keyName = ''
    if (prop.key.type === 'Identifier') {
      keyName = prop.key.name
    } else if (prop.key.type === 'Literal') {
      keyName = String(prop.key.value)
    }

    if (!keyName) {
      continue
    }

    if (REJECTED_PAGE_EXPORTS[keyName] && !content.includes('coralite-ignore E107')) {
      throw new CoraliteError(REJECTED_PAGE_EXPORTS[keyName], {
        code: 'CORALITE-E107',
        filePath
      })
    }

    if (!ALLOWED_PAGE_BLOCKS.has(keyName) && !content.includes('coralite-ignore E107')) {
      throw new CoraliteError(`Unknown block "${keyName}" in definePage. Valid blocks are: paths, server, meta, getters, style, provide, client, onError.`, {
        code: 'CORALITE-E107',
        filePath
      })
    }

    blocks[keyName] = prop
  }

  return {
    hasDefinePage: true,
    hasPageExports,
    blocks,
    script: scriptContent
  }
}
