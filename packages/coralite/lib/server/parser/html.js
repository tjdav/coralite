import render from 'dom-serializer'
import { parse as parseJS } from 'acorn'
import { simple as walkJS } from 'acorn-walk'
import { parseHTML, hasIgnoreAttribute, extractScriptTagsFromHTML } from '../utils/parse.js'
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
 * Creates a resolver for ignored slot names on a component collection.
 *
 * @param {{ getItem?: (id: string) => any }} components - Component collection or compatible lookup.
 * @returns {(tagName: string) => Set<string> | null} Resolver for ignored slot names.
 */
export function createIgnoredSlotsResolver (components) {
  return function getIgnoredSlots (tagName) {
    const component = components && typeof components.getItem === 'function'
      ? components.getItem(tagName)
      : null
    const result = component?.result
    const slotMap = result?.slotElements?.[result?.id]

    if (!slotMap) {
      return null
    }

    let ignored = null
    for (const name in slotMap) {
      if (Object.prototype.hasOwnProperty.call(slotMap, name) && slotMap[name]?.isIgnoredSlot) {
        if (!ignored) {
          ignored = new Set()
        }
        ignored.add(name)
      }
    }

    return ignored
  }
}

/**
 * Checks whether a script element is projected into an ignored component slot.
 *
 * @param {import('../../../types/index.js').CoraliteScriptTag} script - Script metadata
 * @param {(tagName: string) => Set<string> | null} [getIgnoredSlots] - Ignored slot resolver
 * @returns {boolean}
 */
export function isScriptInsideIgnoredSlot (script, getIgnoredSlots) {
  if (!getIgnoredSlots || !script.element) {
    return false
  }

  /** @type {any} */
  let child = script.element
  while (child && child.parent) {
    const parent = child.parent

    if (parent.type === 'tag' && Array.isArray(parent.slots)) {
      const slotEntry = parent.slots.find(entry => entry.node === child)
      if (slotEntry) {
        const ignored = getIgnoredSlots(parent.name)
        if (ignored && ignored.has(slotEntry.name || 'default')) {
          return true
        }
      }
    }

    child = parent
  }

  return false
}

/**
 * Analyzes a single inline script for Coralite page blocks.
 *
 * @param {string} scriptContent - Raw script content
 * @param {string} rawContent - Full page source used for pragma checks
 * @param {string} filePath - Page file path
 * @returns {{ hasDefinePage: boolean, hasPageExports: boolean, blocks: Record<string, any> | null } | null} Analysis, or null for non-page scripts.
 */
function analyzePageScript (scriptContent, rawContent, filePath) {
  let ast
  try {
    ast = parseJS(scriptContent, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      locations: true
    })
  } catch {
    return null
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
      blocks: null
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

    if (REJECTED_PAGE_EXPORTS[keyName] && !rawContent.includes('coralite-ignore E107')) {
      throw new CoraliteError(REJECTED_PAGE_EXPORTS[keyName], {
        code: 'CORALITE-E107',
        filePath
      })
    }

    if (!ALLOWED_PAGE_BLOCKS.has(keyName) && !rawContent.includes('coralite-ignore E107')) {
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
    blocks
  }
}

/**
 * Parses and extracts the single Coralite page controller script from page HTML.
 *
 * When a `ParseHTMLResult` is supplied, the controller script node is marked
 * `skipRender` and pushed to `skipRenderElements`. When raw HTML is supplied,
 * only extraction occurs.
 *
 * @param {string | import('../../../types/index.js').ParseHTMLResult} input - Parsed elements or raw page HTML
 * @param {Object} [options={}] - Extraction options
 * @param {string} [options.filePath=''] - Page file path
 * @param {string} [options.rawContent] - Raw page source when `input` is parsed elements
 * @param {(tagName: string) => Set<string> | null} [options.getIgnoredSlots] - Ignored slot resolver
 * @returns {{ hasDefinePage: boolean, hasPageExports: boolean, blocks: Record<string, any> | null, script: string | null, lineOffset: number, tag: import('../../../types/index.js').CoraliteScriptTag | null }}
 */
export function extractPageScript (input, options = {}) {
  const filePath = options.filePath || ''
  const isElements = Boolean(input && typeof input === 'object' && Array.isArray(input.scripts))
  /** @type {import('../../../types/index.js').ParseHTMLResult | null} */
  let elements = null
  let rawContent = ''
  if (isElements) {
    // @ts-ignore -- narrowed by isElements
    elements = input
    rawContent = options.rawContent || ''
  } else if (typeof input === 'string') {
    rawContent = input
  }
  const scripts = elements ? elements.scripts : extractScriptTagsFromHTML(rawContent)
  const getIgnoredSlots = options.getIgnoredSlots

  const emptyResult = {
    hasDefinePage: false,
    hasPageExports: false,
    blocks: null,
    script: null,
    lineOffset: 0,
    tag: null
  }

  if (!scripts || scripts.length === 0) {
    return emptyResult
  }

  let controller = null
  let controllerCount = 0

  for (const script of scripts) {
    const attribs = script.attribs || {}

    if (attribs.src) {
      continue
    }

    const scriptType = attribs.type ? String(attribs.type).trim().toLowerCase() : ''
    if (scriptType && scriptType !== 'module') {
      continue
    }

    if (hasIgnoreAttribute(attribs)) {
      continue
    }

    if (isScriptInsideIgnoredSlot(script, getIgnoredSlots)) {
      continue
    }

    if (!script.content || !script.content.trim()) {
      continue
    }

    const analysis = analyzePageScript(script.content, rawContent, filePath)
    if (!analysis || (!analysis.hasDefinePage && !analysis.hasPageExports)) {
      continue
    }

    controllerCount++
    if (controllerCount > 1) {
      throw new CoraliteError('Multiple page controller <script> blocks are not allowed. Each page accepts exactly one Coralite page script.', {
        code: 'CORALITE-E107',
        filePath
      })
    }

    controller = {
      ...script,
      ...analysis
    }
  }

  if (!controller) {
    return emptyResult
  }

  if (elements && controller.element) {
    controller.element.skipRender = true
    if (!elements.skipRenderElements) {
      elements.skipRenderElements = []
    }
    if (!elements.skipRenderElements.includes(controller.element)) {
      elements.skipRenderElements.push(controller.element)
    }
  }

  return {
    hasDefinePage: controller.hasDefinePage,
    hasPageExports: controller.hasPageExports,
    blocks: controller.blocks,
    script: controller.content,
    lineOffset: controller.lineOffset || 0,
    tag: controller
  }
}
