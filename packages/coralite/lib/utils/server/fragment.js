import { transformNode } from '../../parser.js'
import { createCoraliteTextNode } from './dom.js'
import { cleanKeys, createReadOnlyProxy, normalizeStyleKey, parseInlineStyle, formatInlineStyle } from '../core.js'
import { filterReservedAttributes } from '../../renderer.js'
import { CoraliteError } from '../errors.js'
import { BOOLEAN_ATTRIBUTES, isAriaAttribute, isAriaBooleanState, resolveAriaBooleanState } from '../tags.js'

/**
 * Deeply freezes a target value (object, array) recursively, excluding DOM AST nodes.
 *
 * @param {any} obj - Target object to freeze.
 * @returns {any} Frozen object.
 */
function deepFreeze (obj) {
  if (obj === null || typeof obj !== 'object' || Object.isFrozen(obj)) {
    return obj
  }

  // Do not freeze DOM AST nodes (tags, text, root, directives, comments)
  // because dom-serializer mutates elem.name in-place when normalizing SVG/MathML elements
  if (obj.type === 'tag' || obj.type === 'text' || obj.type === 'root' || obj.type === 'directive' || obj.type === 'comment') {
    return obj
  }

  Object.freeze(obj)

  for (const key of Object.keys(obj)) {
    if (key === 'parent' || key === 'node' || key === 'textNode' || key === 'template') {
      continue
    }
    const val = obj[key]
    if (val !== null && typeof val === 'object' && !Object.isFrozen(val)) {
      deepFreeze(val)
    }
  }

  return obj
}

/**
 * Deeply freezes component metadata dictionaries (values, customElements, slotElements).
 *
 * @param {any} module - Component module object.
 * @returns {any} Module object.
 */
export function freezeTemplate (module) {
  if (!module || typeof module !== 'object') {
    return module
  }

  if (module.values) {
    deepFreeze(module.values)
  }
  if (module.customElements) {
    deepFreeze(module.customElements)
  }
  if (module.slotElements) {
    deepFreeze(module.slotElements)
  }

  return module
}

/**
 * Compiles a component's template AST into a flat list of fragment rendering operations
 * and determines if the component is capable of fast-path string concatenation rendering (`__opsCapable`).
 *
 * @param {Object} component - Component document object (`componentComponent.result` or module).
 * @param {Object} app - Coralite application instance.
 * @returns {Object} `{ ops: Array, opsCapable: boolean }`
 */
const VISITING = Symbol('VISITING')

/**
 * Checks if a component's local template structure is capable of fragment ops
 * (i.e. no slots, no-hydration, or unhandled directives).
 *
 * @param {Object} component - Component document object.
 * @returns {boolean} True if locally ops capable.
 */
export function isLocallyOpsCapable (component) {
  if (!component) {
    return false
  }
  const hasDeclaredSlots = Boolean(component.slotElements && Object.keys(component.slotElements).length > 0)
  const scriptMetaSlots = component.script?.slots || component.attributes?.slots || {}
  const hasScriptSlots = Boolean(scriptMetaSlots && Object.keys(scriptMetaSlots).length > 0)
  if (hasDeclaredSlots || hasScriptSlots) {
    return false
  }

  let hasSlotTag = false
  let hasNoHydrationInTemplate = false
  let unhandledDirective = false

  const scanTemplateAST = (nodes) => {
    if (!nodes || !Array.isArray(nodes)) {
      return
    }
    for (const node of nodes) {
      if (node.type === 'tag') {
        if (node.name === 'slot') {
          hasSlotTag = true
        }
        if (node.attribs && 'no-hydration' in node.attribs) {
          hasNoHydrationInTemplate = true
        }
        if (node.children) {
          scanTemplateAST(node.children)
        }
      } else if (node.type === 'directive') {
        unhandledDirective = true
      }
    }
  }
  scanTemplateAST(component.template?.children || [])

  return !hasSlotTag && !hasNoHydrationInTemplate && !unhandledDirective
}

/**
 * Recursively checks if a component and all of its nested child custom elements are ops capable.
 * Uses memoization and cycle detection (`VISITING` symbol).
 *
 * @param {Object} component - Component result object.
 * @param {Object} app - Global Coralite app instance.
 * @param {Map} [memo=new Map()] - Memoization map.
 * @returns {boolean} True if component is ops capable.
 */
export function checkComponentCapability (component, app, memo = new Map()) {
  if (!component) {
    return false
  }
  const id = component.id
  if (memo.has(id)) {
    const val = memo.get(id)
    if (val === VISITING) {
      return false
    }
    return val
  }

  memo.set(id, VISITING)

  if (!isLocallyOpsCapable(component)) {
    memo.set(id, false)
    component.__opsCapable = false
    return false
  }

  const customElements = component.customElements || []
  for (const ce of customElements) {
    const childComponent = app?.components?.getItem(ce.name)
    if (!childComponent || !childComponent.result) {
      memo.set(id, false)
      component.__opsCapable = false
      return false
    }
    const childCapable = checkComponentCapability(childComponent.result, app, memo)
    if (!childCapable) {
      memo.set(id, false)
      component.__opsCapable = false
      return false
    }
  }

  memo.set(id, true)
  component.__opsCapable = true
  return true
}

/**
 * Single-pass resolution of capabilities and compilation of fragment ops for all registered components.
 *
 * @param {Object} app - Global Coralite app instance.
 */
export function prepareAllComponentOps (app) {
  if (!app?.components?.list) {
    return
  }

  const memo = new Map()
  for (const item of app.components.list) {
    if (item.result) {
      checkComponentCapability(item.result, app, memo)
    }
  }

  for (const item of app.components.list) {
    const comp = item.result
    if (!comp) {
      continue
    }
    if (comp.__opsCapable) {
      const { ops } = compileOps(comp, app)
      comp._ops = ops
      freezeTemplate(comp)
    } else {
      comp._ops = []
      freezeTemplate(comp)
    }
  }
}

/**
 *
 */
export function compileOps (component, app) {
  if (!component) {
    return {
      ops: [],
      opsCapable: false
    }
  }

  if (!isLocallyOpsCapable(component)) {
    return {
      ops: [],
      opsCapable: false
    }
  }

  const templateAST = component.template?.children || []
  const values = component.values || {}
  const refs = values.refs || []
  const textNodesValues = values.textNodes || []
  const attributesValues = values.attributes || []
  const customElementsList = component.customElements || []

  // Map text nodes with tokens
  const dynamicTextNodeMap = new Map()
  for (const item of textNodesValues) {
    if (item.textNode && item.tokens && item.tokens.length > 0) {
      dynamicTextNodeMap.set(item.textNode, item.tokens)
    }
  }

  // Map element attributes with tokens
  const dynamicAttrElementMap = new Map()
  for (const item of attributesValues) {
    if (item.element && item.tokens && item.tokens.length > 0) {
      if (!dynamicAttrElementMap.has(item.element)) {
        dynamicAttrElementMap.set(item.element, [])
      }
      dynamicAttrElementMap.get(item.element).push(item)
    }
  }

  // Map custom element nodes
  const customElementNodeSet = new Set(customElementsList)

  // Map ref nodes
  const refNodeMap = new Map()
  for (const refItem of refs) {
    if (refItem.element) {
      refNodeMap.set(refItem.element, refItem.name)
    }
  }

  const ops = []
  let currentStaticSubtree = []
  let isCapable = true

  // Check child component capability cascade bottom-up
  for (const ce of customElementsList) {
    const childComponent = app?.components?.getItem(ce.name)
    if (!childComponent || !childComponent.result || !childComponent.result.__opsCapable) {
      isCapable = false
      break
    }
  }

  if (!isCapable) {
    return {
      ops: [],
      opsCapable: false
    }
  }

  const flushStaticSubtree = () => {
    if (currentStaticSubtree.length > 0) {
      const htmlStr = transformNode(currentStaticSubtree)
      ops.push({
        t: 'str',
        s: htmlStr
      })
      currentStaticSubtree = []
    }
  }

  const hasDynamicDescendant = (node) => {
    if (!node) {
      return false
    }
    if (customElementNodeSet.has(node) || dynamicTextNodeMap.has(node) || dynamicAttrElementMap.has(node) || refNodeMap.has(node)) {
      return true
    }
    if (node.children && Array.isArray(node.children)) {
      return node.children.some(hasDynamicDescendant)
    }
    return false
  }

  const traverseNodes = (nodes) => {
    if (!nodes || !Array.isArray(nodes)) {
      return
    }

    for (const node of nodes) {
      if (customElementNodeSet.has(node)) {
        flushStaticSubtree()
        const customElement = node
        const childComponent = app?.components?.getItem(customElement.name)
        const attrItems = dynamicAttrElementMap.get(customElement) || []

        ops.push({
          t: 'host',
          name: customElement.name,
          node: customElement,
          attrItems,
          module: childComponent?.result
        })
        continue
      }

      if (node.type === 'text') {
        if (dynamicTextNodeMap.has(node)) {
          flushStaticSubtree()
          const tokens = dynamicTextNodeMap.get(node)
          let textData = node.data
          for (const token of tokens) {
            const parts = textData.split(token.content)
            if (parts[0]) {
              ops.push({
                t: 'str',
                s: parts[0]
              })
            }
            ops.push({
              t: 'text',
              name: token.name,
              content: token.content
            })
            textData = parts.slice(1).join(token.content)
          }
          if (textData) {
            ops.push({
              t: 'str',
              s: textData
            })
          }
        } else {
          currentStaticSubtree.push(node)
        }
        continue
      }

      if (node.type === 'tag') {
        const isDynamicElement = dynamicAttrElementMap.has(node) || refNodeMap.has(node)
        const containsDynamicChildren = node.children && node.children.some(hasDynamicDescendant)

        if (isDynamicElement) {
          flushStaticSubtree()
          const attrItems = dynamicAttrElementMap.get(node) || []
          const refName = refNodeMap.get(node)

          let childOps = []
          if (node.children && node.children.length > 0) {
            const prevOpsLength = ops.length
            const tempStatic = currentStaticSubtree
            currentStaticSubtree = []

            traverseNodes(node.children)
            flushStaticSubtree()

            childOps = ops.splice(prevOpsLength)
            currentStaticSubtree = tempStatic
          }

          ops.push({
            t: 'elem',
            node,
            attrItems,
            refName,
            childOps
          })
          continue
        }

        if (containsDynamicChildren) {
          flushStaticSubtree()
          // Serialize element start tag
          const openNode = {
            ...node,
            children: []
          }
          const fullOpenTag = transformNode(openNode)
          // Derive opening tag string by trimming self-closing slash or closing tag
          const closeTag = `</${node.name}>`
          let openTagStr = fullOpenTag
          if (openTagStr.endsWith(closeTag)) {
            openTagStr = openTagStr.slice(0, openTagStr.length - closeTag.length)
          }
          ops.push({
            t: 'str',
            s: openTagStr
          })

          // Traverse child nodes
          traverseNodes(node.children)
          flushStaticSubtree()

          // Serialize closing tag
          ops.push({
            t: 'str',
            s: closeTag
          })
          continue
        }

        currentStaticSubtree.push(node)
        continue
      }

      currentStaticSubtree.push(node)
    }
  }

  traverseNodes(templateAST)
  flushStaticSubtree()

  // Optimize: Merge adjacent 'str' ops into single string segments
  const optimizedOps = []
  for (const op of ops) {
    if (op.t === 'str') {
      const lastOp = optimizedOps[optimizedOps.length - 1]
      if (lastOp && lastOp.t === 'str') {
        lastOp.s += op.s
      } else {
        optimizedOps.push({ ...op })
      }
    } else {
      optimizedOps.push(op)
    }
  }

  return {
    ops: optimizedOps,
    opsCapable: isCapable
  }
}

/**
 * Emits dynamic fragment output as an AST root node containing a single serialized fragment text child.
 * Concatenates pre-serialized `str` segments, verbatim `text` tokens, shallow `elem` serializations,
 * and recursively awaited `host` nested component fragments.
 *
 * @param {Object} params - Emission context and parameters.
 * @param {string} [params.id] - Component ID.
 * @param {Object} params.moduleComponent - Component document object.
 * @param {Object} [params.state] - Component state.
 * @param {Object} [params.element] - Element AST node.
 * @param {Object} params.page - Page object.
 * @param {Object} [params.root] - Root AST node.
 * @param {string} params.contextId - Context ID.
 * @param {number} [params.index] - Element index.
 * @param {Object} params.session - Render session.
 * @param {boolean} [params.noHydration] - No hydration flag.
 * @param {Function} params.evaluate - Evaluation function.
 * @param {Function} params.createComponentElement - Element creation function.
 * @param {Object} params.hooks - Bound hooks object.
 * @param {Object} params.app - App instance.
 * @returns {Promise<Object>} Root AST node with fragment text node child.
 */
export async function emitFragment ({
  id: _id,
  moduleComponent,
  state = {},
  element,
  page,
  root,
  contextId,
  index: _index,
  session,
  noHydration,
  evaluate,
  createComponentElement,
  hooks,
  app
}) {
  const module = moduleComponent.result
  const instanceId = contextId
  let componentState = { ...state }

  if (element && element.attribs) {
    const declaredAttrs = module?.script?.attributes || module?.attributes || {}
    componentState = Object.assign(componentState, filterReservedAttributes(element.attribs, declaredAttrs))
  }
  componentState = cleanKeys(componentState)

  const mappedComponentContext = await hooks.trigger('onBeforeComponentRender', {
    state: componentState,
    componentId: module.id,
    instanceId,
    template: module.template,
    refs: module.values.refs,
    textNodes: module.values.textNodes,
    attributes: module.values.attributes,
    page,
    element,
    session,
    app
  })
  componentState = mappedComponentContext.state

  // Dynamic Ref property assignment
  if (module.values && module.values.refs) {
    for (let i = 0; i < module.values.refs.length; i++) {
      const ref = module.values.refs[i]
      const uniqueRefValue = `${instanceId}__${ref.name}`
      componentState[`ref_${ref.name}`] = uniqueRefValue
    }
  }

  if (module.styles.length) {
    const selector = module.id
    if (!session.styles.has(selector)) {
      session.styles.set(selector, module._processedCss)
    }
  }

  let evaluatedStyle = null
  if (module.script) {
    let scriptResult = {}
    const evaluationState = { ...componentState }

    scriptResult = await evaluate({
      module,
      element,
      state: evaluationState,
      page,
      root: element || root,
      contextId,
      session,
      noHydration,
      mode: app.options.mode
    })

    if (scriptResult && scriptResult.__script__ != null) {
      const scriptMetaAny = scriptResult.__script__
      evaluatedStyle = scriptMetaAny.style

      const declarativeComponents = (module.customElements || []).map(el => el.name)
      const extractedComponents = module._extractedScript?.components || []
      const mergedComponents = Array.from(new Set([...declarativeComponents, ...extractedComponents]))

      if (!noHydration) {
        session.scripts.add(page.file.pathname, {
          id: contextId,
          componentId: module.id,
          page,
          state: scriptResult.__script__.state || {},
          components: mergedComponents
        })
      }
      delete scriptResult.__script__
    }
    componentState = Object.assign(componentState, scriptResult)
  }

  session.state[contextId] = componentState

  // Evaluate host component reactive styles
  const scriptMeta = moduleComponent.result?.script || {}
  const componentStyleObj = evaluatedStyle || scriptMeta.style || module.script?.style || {}
  if (componentStyleObj && typeof componentStyleObj === 'object' && Object.keys(componentStyleObj).length > 0) {
    const computedStylesMap = new Map()
    if (element && element.attribs && element.attribs.style) {
      const parsed = parseInlineStyle(element.attribs.style)
      for (const [k, v] of parsed.entries()) {
        computedStylesMap.set(k, v)
      }
    }
    const roState = createReadOnlyProxy(componentState)
    for (const [key, valOrFn] of Object.entries(componentStyleObj)) {
      const normKey = normalizeStyleKey(key)
      if (!normKey) {
        continue
      }
      let val
      if (typeof valOrFn === 'function') {
        try {
          val = valOrFn(roState)
        } catch (err) {
          if (err instanceof CoraliteError) {
            throw err
          }
          throw new CoraliteError(
            `Component "${module.id}" style getter for "${key}" failed: ${err.message}`,
            {
              componentId: module.id,
              filePath: module.path?.pathname,
              cause: err
            }
          )
        }
      } else {
        val = valOrFn
      }
      if (val && typeof val.then === 'function') {
        throw new CoraliteError(`Component "${module.id}" style property "${key}" getter must be synchronous. Use getters or server() for asynchronous operations.`, {
          componentId: module.id
        })
      }
      if (val !== null && val !== undefined && val !== false && val !== '') {
        computedStylesMap.set(normKey, String(val))
      } else {
        computedStylesMap.delete(normKey)
      }
    }
    if (element) {
      const formatted = formatInlineStyle(computedStylesMap)
      if (formatted) {
        if (!element.attribs) {
          element.attribs = {}
        }
        element.attribs.style = formatted
      } else if (element.attribs && element.attribs.style !== undefined) {
        delete element.attribs.style
      }
    }
  }

  // Helper to render ops array into a string
  const renderOpsToString = async (ops) => {
    let resultStr = ''

    for (const op of ops) {
      if (op.t === 'str') {
        resultStr += op.s
      } else if (op.t === 'text') {
        const val = componentState[op.name]
        resultStr += (val != null ? String(val) : '')
      } else if (op.t === 'elem') {
        // Shallow copy element and update attributes
        const nodeCopy = {
          ...op.node,
          attribs: { ...op.node.attribs }
        }

        if (op.refName) {
          const uniqueRefValue = `${instanceId}__${op.refName}`
          nodeCopy.attribs.ref = uniqueRefValue
          nodeCopy.attribs['data-coralite-owner'] = instanceId
        }

        for (const item of op.attrItems) {
          const attrLower = item.name ? item.name.toLowerCase() : ''
          const isSingleToken = item.tokens && item.tokens.length === 1 && (nodeCopy.attribs[item.name] || '').trim() === item.tokens[0].content

          if (BOOLEAN_ATTRIBUTES.has(attrLower) && isSingleToken) {
            const rawVal = componentState[item.tokens[0].name]
            const isFalsy = rawVal === 'false' || rawVal === 'null' || rawVal === 'undefined' || rawVal === '0' || rawVal === 0 || rawVal === '' || rawVal === false || rawVal === null || rawVal === undefined
            if (isFalsy) {
              delete nodeCopy.attribs[item.name]
            } else {
              nodeCopy.attribs[item.name] = ''
            }
          } else if (isAriaBooleanState(attrLower) && isSingleToken) {
            const rawVal = componentState[item.tokens[0].name]
            const targetVal = resolveAriaBooleanState(rawVal)

            if (targetVal === null) {
              delete nodeCopy.attribs[item.name]
            } else {
              nodeCopy.attribs[item.name] = targetVal
            }
          } else if (isAriaAttribute(attrLower) && isSingleToken) {
            const rawVal = componentState[item.tokens[0].name]
            const isFalsy = rawVal === 'false' || rawVal === 'null' || rawVal === 'undefined' || rawVal === '' || rawVal === false || rawVal === null || rawVal === undefined
            if (isFalsy) {
              delete nodeCopy.attribs[item.name]
            } else {
              nodeCopy.attribs[item.name] = String(rawVal)
            }
          } else {
            let attrVal = nodeCopy.attribs[item.name] || ''
            for (const token of item.tokens) {
              let val = componentState[token.name]
              if (val == null) {
                val = ''
              }
              attrVal = attrVal.replace(token.content, String(val))
            }
            nodeCopy.attribs[item.name] = attrVal
          }
        }

        let innerContent = ''
        if (op.childOps && op.childOps.length > 0) {
          innerContent = await renderOpsToString(op.childOps)
        }

        if (innerContent) {
          nodeCopy.children = [createCoraliteTextNode({
            type: 'text',
            data: innerContent
          })]
        } else {
          nodeCopy.children = []
        }

        resultStr += transformNode(nodeCopy)
      } else if (op.t === 'host') {
        const childTag = op.name
        const childContextId = session.generateId(childTag)
        const currentProperties = session.state[childContextId] || {}
        const childModuleComponent = app.components.getItem(childTag)

        let declaredAttrs = {}
        if (childModuleComponent && childModuleComponent.result) {
          declaredAttrs = childModuleComponent.result.script?.attributes || childModuleComponent.result.attributes || {}
        }

        // Interpolate dynamic attributes on host element before state filtering
        const hostNodeAttribs = { ...(op.node.attribs || {}) }
        for (const item of op.attrItems || []) {
          let attrVal = hostNodeAttribs[item.name] || ''
          for (const token of item.tokens) {
            let val = componentState[token.name]
            if (val == null) {
              val = ''
            }
            attrVal = attrVal.replace(token.content, String(val))
          }
          hostNodeAttribs[item.name] = attrVal
        }

        const attribValues = filterReservedAttributes(hostNodeAttribs, declaredAttrs)
        const childState = {
          ...state,
          ...currentProperties,
          ...attribValues
        }
        session.state[childContextId] = childState
        const childNoHydration = noHydration || ('no-hydration' in hostNodeAttribs)

        // Route through createComponentElement to respect instance-level fallbacks/hooks if needed
        const childElementNode = {
          ...op.node,
          attribs: hostNodeAttribs
        }
        const childComponentElement = await createComponentElement({
          id: childTag,
          state: childState,
          element: childElementNode,
          page,
          root,
          contextId: childContextId,
          index: 0,
          session,
          noHydration: childNoHydration,
          head: false
        })

        let childHTML = ''
        if (Array.isArray(childComponentElement)) {
          childHTML = transformNode(childComponentElement)
        } else if (childComponentElement && childComponentElement.children) {
          childHTML = transformNode(childComponentElement.children)
        }

        if (childNoHydration) {
          resultStr += childHTML
        } else {
          let hostChildren = [createCoraliteTextNode({
            type: 'text',
            data: childHTML
          })]
          if (childComponentElement && !Array.isArray(childComponentElement) && childComponentElement.children) {
            hostChildren = childComponentElement.children
          }
          const hostCopy = {
            ...op.node,
            attribs: {
              ...hostNodeAttribs,
              'data-cid': childContextId,
              'data-coralite-initial': ''
            },
            children: hostChildren
          }
          session.componentTags.add(childTag)
          resultStr += transformNode(hostCopy)
        }
      }
    }

    return resultStr
  }

  const fragmentString = await renderOpsToString(module._ops || [])

  const finalResult = {
    type: 'root',
    children: [createCoraliteTextNode({
      type: 'text',
      data: fragmentString
    })]
  }

  const mappedAfterContext = await hooks.trigger('onAfterComponentRender', {
    result: finalResult,
    state: componentState,
    componentId: module.id,
    instanceId,
    refs: module.values.refs,
    textNodes: module.values.textNodes,
    attributes: module.values.attributes,
    page,
    element,
    session,
    app
  })

  return mappedAfterContext.result
}
