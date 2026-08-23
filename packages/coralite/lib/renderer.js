import { randomUUID } from 'node:crypto'
import { dirname, join, relative } from 'node:path'
import { availableParallelism } from 'node:os'
import { readFile, writeFile, mkdir, rename, access } from 'node:fs/promises'
import pLimit from 'p-limit'
import serialize from 'serialize-javascript'
import {
  cleanKeys,
  cloneModuleInstance,
  cloneComponentInstance,
  normalizeObjectFunctions,
  validateSerializable,
  normalizeStyleKey,
  parseInlineStyle,
  formatInlineStyle,
  createReadOnlyProxy
} from './utils/core.js'
import {
  replaceToken,
  findAndExtractScript,
  extractComponentProperty,
  astTransformer
} from './utils/server/server.js'
import { getHtmlFile } from './utils/server/html.js'
import { parseHTML } from './utils/server/parse.js'
import {
  findHeadAndBody,
  injectExternalStyles,
  injectStyles,
  injectReadinessScript,
  injectImportMap,
  removeElements,
  resolvePageQueue
} from './utils/server/render.js'
import {
  calculateHash,
  calculateSRIDigest,
  resolveNonce,
  formatCSPDirectives,
  injectCSPMeta
} from './utils/server/csp.js'
import picomatch from 'picomatch'
import { stat } from 'node:fs/promises'
import { generateClientRuntime } from './utils/client/runtime.js'
import { transformCss } from './utils/server/style.js'
import { transformNode } from './parser.js'
import { CoraliteError } from './utils/errors.js'
import { RESERVED_DOM_ATTRIBUTES } from './coralite-element.js'
import { checkFileChange, hash } from './utils/server/manifest.js'
import {
  isCoraliteElement,
  isCoraliteCollectionItem
} from './utils/types.js'
import { createCoraliteElement, createCoraliteTextNode, relinkChildren } from './utils/server/dom.js'

/**
 * @import {
 *  CoraliteInstance,
 *  CoraliteSession,
 *  CoraliteBuildResult,
 *  CoraliteBuildCallback,
 *  CoraliteBuildOptions,
 *  CoraliteOnError,
 *  CoraliteAnyNode,
 *  CoraliteCollectionItem,
 *  ComponentElementOptions,
 *  HTMLData
 * } from '../types/index.js'
 */

/**
 * @import { InstanceContext } from '../types/script.js'
 * @import { ScriptManager } from './script-manager.js'
 */

/**
 * Factory for the rendering pipeline.
 *
 * @param {Object} dependencies - The dependencies required to create the renderer.
 * @param {CoraliteInstance} dependencies.app - The global Coralite app instance.
 * @param {ScriptManager} dependencies.scriptManager - The script manager for handling client-side scripts.
 * @param {Object} dependencies.source - The framework source utilities and context.
 * @param {Function} dependencies.evaluate - The function used to evaluate component scripts.
 * @param {CoraliteOnError} dependencies.handleError - The callback for handling errors during rendering.
 * @param {Object} dependencies.hooks - The collection of bound plugin hooks.
 * @param {any} dependencies.options - The normalized configuration options for the framework.
 * @param {Function} dependencies.createExecutionError - The factory function for creating detailed execution errors.
 * @returns {Object}
 */
/**
 * Filters out reserved DOM attributes unless explicitly declared in the component's attributes schema.
 *
 * @param {Object} attribs - Raw element attributes object.
 * @param {Object} [declaredAttributes={}] - Component attributes schema object.
 * @returns {Object} Filtered attributes object.
 */
function filterReservedAttributes (attribs, declaredAttributes = {}) {
  if (!attribs || typeof attribs !== 'object') {
    return {}
  }
  const result = {}
  for (const [key, value] of Object.entries(attribs)) {
    const lowerKey = key.toLowerCase()
    const camelKey = key.replace(/-([a-z])/g, (g) => g[1].toUpperCase())
    const isDeclared = Boolean(declaredAttributes && (declaredAttributes[camelKey] || declaredAttributes[key] || declaredAttributes[lowerKey]))
    if (!RESERVED_DOM_ATTRIBUTES.has(lowerKey) || isDeclared) {
      result[key] = value
    }
  }
  return result
}

/**
 * Factory for creating the renderer pipeline instance.
 *
 * @param {Object} dependencies - The renderer factory dependencies.
 * @param {CoraliteInstance} dependencies.app - Global app instance.
 * @param {ScriptManager} dependencies.scriptManager - Script manager instance.
 * @param {Object} dependencies.source - Source utilities.
 * @param {Function} dependencies.evaluate - Evaluation function.
 * @param {CoraliteOnError} dependencies.handleError - Error handler callback.
 * @param {Object} dependencies.hooks - Bound plugin hooks.
 * @param {any} dependencies.options - Normalized options.
 * @param {Function} dependencies.createExecutionError - Execution error factory.
 * @returns {Object} Renderer pipeline instance.
 */
export function createRenderer ({
  app,
  scriptManager,
  source,
  evaluate,
  handleError,
  hooks,
  options: normalizedOptions,
  createExecutionError
}) {
  const renderQueues = new Map()
  const sealedQueues = new Set()
  const outputFiles = {}
  const sriDigestCache = new Map()
  let globalScriptResult = null
  let siteWideBundlePromise = null

  /**
   * Creates a new rendering session.
   * @param {string} [buildId] - Unique identifier for the build
   * @returns {CoraliteSession}
   */
  const _createSession = (buildId) => {
    const sessionObj = {
      buildId,
      state: {},
      styles: new Map(),
      componentTags: new Set(),
      instanceCounters: {},
      generateId (prefix) {
        if (this.instanceCounters[prefix] === undefined) {
          this.instanceCounters[prefix] = 0
        }
        return `${prefix}-${this.instanceCounters[prefix]++}`
      },
      scripts: {
        content: {},
        add (id, item) {
          if (!this.content[id]) {
            this.content[id] = {}
          }
          this.content[id][item.id] = item
        }
      },
      _injectedTags: [],
      injectTag (options) {
        if (options && typeof options === 'object') {
          this._injectedTags.push(options)
        }
      },
      source: {
        currentSourceContextId: '',
        contextInstances: {}
      }
    }
    return sessionObj
  }

  const _replaceSlots = async ({ id, instanceId, element, module, state, page, root, index, session, noHydration }) => {
    const slots = module.slotElements ? module.slotElements[id] : null
    if (!slots) {
      return
    }

    const slotChildren = {}
    const slotNames = Object.keys(slots)
    for (let i = 0; i < slotNames.length; i++) {
      slotChildren[slotNames[i]] = []
    }

    if (element && element.slots) {
      for (let i = 0; i < element.slots.length; i++) {
        const elementSlotContent = element.slots[i]
        const slotName = elementSlotContent.name
        const slot = slots[slotName]
        if (slot) {
          if (elementSlotContent.node.attribs) {
            delete elementSlotContent.node.attribs.slot
          } else {
            elementSlotContent.node.attribs = {}
          }
          elementSlotContent.node.attribs['data-coralite-slot-index'] = String(i)
          slotChildren[slotName].push(elementSlotContent.node)
        }
      }
    }

    const slotTasks = []

    for (let i = 0; i < slotNames.length; i++) {
      const slotName = slotNames[i]
      let slotNodes = slotChildren[slotName]
      const slot = slots[slotName]

      if (slot.element) {
        if (!slot.element.attribs) {
          slot.element.attribs = {}
        }
        slot.element.attribs['data-coralite-owner'] = instanceId
      }

      if (!slot.element || !slot.element.parent || !slot.element.parent.children) {
        continue
      }
      const emptySlot = slotNodes.filter(node => node.type !== 'text' || (node.data && node.data.trim().length > 0))
      if (!emptySlot.length) {
        slotNodes = slot.element.children || []
        if (!slot.element.attribs) {
          slot.element.attribs = {}
        }
        slot.element.attribs['data-coralite-fallback'] = ''
        slot.element.children = slotNodes
        relinkChildren(slot.element)
      } else {
        const componentTasks = []
        for (let j = slotNodes.length - 1; j > -1; j--) {
          const node = slotNodes[j]
          if (node.name) {
            const slotComponentItem = app.components.getItem(node.name)

            if (slotComponentItem) {
              const slotContextId = session.generateId(node.name)
              const currentProperties = session.state[slotContextId] || {}
              const declaredAttrs = slotComponentItem.result?.script?.attributes || slotComponentItem.result?.attributes || {}
              const attribValues = filterReservedAttributes(cleanKeys(node.attribs), declaredAttrs)
              session.state[slotContextId] = typeof node.attribs === 'object'
                ? {
                  ...currentProperties,
                  ...state,
                  ...attribValues
                }
                : Object.assign(currentProperties, state)

              const childNoHydration = noHydration || (node.attribs && 'no-hydration' in node.attribs)
              componentTasks.push(createComponentElement({
                id: node.name,
                state: session.state[slotContextId],
                element: node,
                page,
                root,
                contextId: slotContextId,
                index,
                session,
                noHydration: childNoHydration,
                head: false
              }).then(componentElement => ({
                componentElement,
                node,
                slotContextId,
                childNoHydration
              })))
            }
          }
        }

        slotTasks.push(Promise.all(componentTasks).then(results => {
          for (const { componentElement, node, slotContextId, childNoHydration } of results) {
            if (componentElement) {
              if (childNoHydration) {
                const parent = node.parent

                if (parent && Array.isArray(parent.children)) {
                  const idx = parent.children.indexOf(node)
                  if (idx !== -1) {
                    let children = []

                    if (Array.isArray(componentElement)) {
                      children = componentElement
                    } else if ('children' in componentElement && Array.isArray(componentElement.children)) {
                      children = componentElement.children
                    }

                    parent.children.splice(idx, 1, ...children)
                    relinkChildren(parent)
                  }
                }
              } else {
                let children = []

                if (Array.isArray(componentElement)) {
                  children = componentElement
                } else if ('children' in componentElement && Array.isArray(componentElement.children)) {
                  children = componentElement.children
                }

                node.children = children
                relinkChildren(node)

                if (!node.attribs) {
                  node.attribs = {}
                }

                node.attribs['data-cid'] = slotContextId
                node.attribs['data-coralite-initial'] = ''
                session.componentTags.add(node.name)
              }
            }
          }
          slot.element.children = slotNodes
          relinkChildren(slot.element)
        }))
      }
    }
    await Promise.all(slotTasks)
  }

  const _processDependentComponents = async ({ componentIds, session, page, root, state = {} }) => {
    if (!componentIds?.length) {
      return
    }
    for (const id of componentIds) {
      if (scriptManager.sharedFunctions[id]) {
        continue
      }
      const moduleComponent = app.components.getItem(id)
      if (!moduleComponent) {
        continue
      }
      const module = cloneModuleInstance(moduleComponent.result)

      let scriptResult = {}
      if (module.script) {
        try {
          scriptResult = await evaluate({
            module,
            state,
            page,
            root,
            contextId: `dependent-${id}`,
            session
          })
        } catch (error) {
          throw createExecutionError(error, module, moduleComponent, page, `dependent-${id}`)
        }
      }

      const scriptMeta = scriptResult.__script__ || {}
      const templateAST = moduleComponent.result.template?.children || []
      const templateValues = moduleComponent.result.values || {}

      if (module.styles?.length && !moduleComponent.result._processedCss) {
        const rawCss = module.styles.join('\n')
        const { rootClasses, descendantClasses } = moduleComponent.result
        moduleComponent.result._processedCss = await transformCss(rawCss, rootClasses, descendantClasses, handleError)
      }
      const stylesHTML = moduleComponent.result._processedCss || ''

      const scriptObj = {
        content: 'function(){}',
        state: scriptMeta.state || {},
        slots: scriptMeta.slots || {}
      }
      let defaultValues = scriptMeta.defaultValues || {}
      let extractedComponents = []

      if (scriptResult.__script__) {
        if (!moduleComponent.result._extractedScript) {
          moduleComponent.result._extractedScript = findAndExtractScript(module.script)
        }
        const extractedScript = moduleComponent.result._extractedScript

        if (extractedScript) {
          scriptObj.content = extractedScript.content
          scriptObj.lineOffset = (module.lineOffset || 0) + extractedScript.lineOffset
          extractedComponents = extractedScript.components || []
        }

        if (!moduleComponent.result._extractedProperties) {
          moduleComponent.result._extractedProperties = extractComponentProperty(module.script, 'server')
        }

        const extractedProperties = moduleComponent.result._extractedProperties

        if (extractedProperties) {
          scriptObj.stateContent = extractedProperties.content
          scriptObj.stateLineOffset = (module.lineOffset || 0) + extractedProperties.lineOffset
        }
      }

      const declarativeComponents = (module.customElements || []).map(el => el.name)
      const nestedComponents = [...new Set([...declarativeComponents, ...extractedComponents])]
      scriptObj.components = nestedComponents

      if (templateValues && templateValues.refs) {
        const refs = templateValues.refs
        for (let i = 0; i < refs.length; i++) {
          const ref = refs[i]
          const refKey = `ref_${ref.name}`
          defaultValues[refKey] = ''
          scriptObj.state[refKey] = ''
        }
      }

      scriptObj.defaultValues = defaultValues

      scriptManager.registerComponent({
        id: module.id,
        getters: scriptMeta.getters,
        script: scriptObj,
        filePath: moduleComponent.path.pathname,
        templateAST,
        templateValues,
        defaultValues,
        styles: stylesHTML,
        slots: scriptObj.slots
      })

      if (nestedComponents.length > 0) {
        const inheritedState = { ...state }
        // @ts-ignore
        delete inheritedState.__script__
        await _processDependentComponents({
          componentIds: nestedComponents,
          session,
          page,
          root,
          state: inheritedState
        })
      }
    }
  }

  /**
   * Creates and initializes a component element from its definition and state.
   *
   * @param {ComponentElementOptions} options - Configuration and context for the component instance.
   * @returns {Promise<CoraliteAnyNode | CoraliteAnyNode[] | void>} The rendered AST node(s) for the component.
   */
  const createComponentElement = async ({ id, state = {}, element, page, root, contextId, index, session, noHydration, head = true }) => {
    if (!session) {
      session = _createSession()
    }
    const moduleComponent = app.components.getItem(id)
    if (!moduleComponent || !moduleComponent.result) {
      return
    }

    const componentId = moduleComponent.result.id
    if (!contextId) {
      contextId = session.generateId(componentId)
    }

    const instanceId = contextId
    let componentState = { ...state }
    if (head) {
      // @ts-ignore
      if (element && element.attribs) {
        const declaredAttrs = moduleComponent.result?.script?.attributes || moduleComponent.result?.attributes || {}
        // @ts-ignore
        componentState = Object.assign(componentState, filterReservedAttributes(element.attribs, declaredAttrs))
      }
      componentState = cleanKeys(componentState)
    }

    const module = cloneModuleInstance(moduleComponent.result)

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

    if (module.values && module.values.refs) {
      for (let i = 0; i < module.values.refs.length; i++) {
        const ref = module.values.refs[i]
        const uniqueRefValue = `${instanceId}__${ref.name}`

        if (ref.element && ref.element.attribs) {
          ref.element.attribs.ref = uniqueRefValue
          ref.element.attribs['data-coralite-owner'] = instanceId
        }

        componentState[`ref_${ref.name}`] = uniqueRefValue
      }
    }
    const result = module.template

    if (module.styles.length) {
      const selector = module.id
      if (!moduleComponent.result._processedCss) {
        const rawCss = module.styles.join('\n')
        const { rootClasses, descendantClasses } = moduleComponent.result
        moduleComponent.result._processedCss = await transformCss(rawCss, rootClasses, descendantClasses, handleError)
      }
      if (!session.styles.has(selector)) {
        session.styles.set(selector, moduleComponent.result._processedCss)
      }
      for (let i = 0; i < result.children.length; i++) {
        const child = result.children[i]
        if (child.type === 'tag') {
          if (!child.attribs) {
            child.attribs = {}
          }
          child.attribs['data-style-selector'] = selector
        }
      }
    }

    let evaluatedStyle = null
    if (module.script) {
      let scriptResult = {}
      try {
        const evaluationState = { ...componentState }
        const pluginContext = {
          state: evaluationState,
          page,
          root: element || root,
          module,
          id: contextId,
          session,
          noHydration
        }

        const boundPlugins = await hooks.bind(source.plugins, pluginContext)
        Object.assign(pluginContext, boundPlugins)

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
      } catch (error) {
        throw createExecutionError(error, module, moduleComponent, page, contextId)
      }

      if (scriptResult && scriptResult.__script__ != null) {
        /** @type {any} */
        const scriptMetaAny = scriptResult.__script__
        evaluatedStyle = scriptMetaAny.style
        if (!moduleComponent.result._extractedScript) {
          moduleComponent.result._extractedScript = findAndExtractScript(module.script)
        }
        const extractedScript = moduleComponent.result._extractedScript

        let extractedComponents = []
        if (extractedScript) {
          scriptResult.__script__.lineOffset = (module.lineOffset || 0) + extractedScript.lineOffset
          scriptResult.__script__.content = extractedScript.content
          if (extractedScript.components) {
            extractedComponents = extractedScript.components
          }
        } else {
          scriptResult.__script__.lineOffset = module.lineOffset || 0
          scriptResult.__script__.content = 'function(){}'
        }

        const stylesHTML = moduleComponent.result._processedCss || ''
        const templateAST = moduleComponent.result.template.children
        const templateValues = moduleComponent.result.values
        const componentTokens = {}

        const attributes = module.values.attributes
        for (let i = 0; i < attributes.length; i++) {
          const tokens = attributes[i].tokens
          for (let j = 0; j < tokens.length; j++) {
            componentTokens[tokens[j].name] = true
          }
        }

        const textNodes = module.values.textNodes
        for (let i = 0; i < textNodes.length; i++) {
          const tokens = textNodes[i].tokens
          for (let j = 0; j < tokens.length; j++) {
            componentTokens[tokens[j].name] = true
          }
        }

        const componentDefaultValues = scriptResult.__script__.defaultValues || {}

        const declarativeComponents = (module.customElements || []).map(el => el.name)
        const mergedComponents = Array.from(new Set([...declarativeComponents, ...extractedComponents]))
        if (scriptResult.__script__) {
          scriptResult.__script__.components = mergedComponents
        }

        scriptManager.registerComponent({
          id: module.id,
          getters: scriptResult.__script__.getters,
          script: scriptResult.__script__,
          filePath: moduleComponent.path.pathname,
          templateAST,
          templateValues,
          defaultValues: componentDefaultValues,
          styles: stylesHTML,
          slots: scriptResult.__script__.slots || {}
        })

        if (mergedComponents.length > 0) {
          const inheritedState = { ...state }
          // @ts-ignore
          delete inheritedState.__script__
          await _processDependentComponents({
            componentIds: mergedComponents,
            session,
            page,
            root,
            state: inheritedState
          })
        }

        if (!scriptResult.__script__.state) {
          scriptResult.__script__.state = {}
        }
        if (!noHydration) {
          session.scripts.add(page.file.pathname, {
            id: contextId,
            componentId: module.id,
            page,
            state: scriptResult.__script__.state,
            components: mergedComponents
          })
        }
        delete scriptResult.__script__
      }
      componentState = Object.assign(componentState, scriptResult)
    }

    session.state[contextId] = componentState

    const attributes = module.values.attributes
    for (let i = 0; i < attributes.length; i++) {
      const item = attributes[i]
      const tokens = item.tokens
      for (let j = 0; j < tokens.length; j++) {
        const token = tokens[j]
        let value = componentState[token.name]
        if (value == null) {
          value = ''
        }
        replaceToken({
          type: 'attribute',
          node: item.element,
          attribute: item.name,
          content: token.content,
          value
        })
      }
    }

    const textNodes = module.values.textNodes
    for (let i = 0; i < textNodes.length; i++) {
      const item = textNodes[i]
      const tokens = item.tokens
      for (let j = 0; j < tokens.length; j++) {
        const token = tokens[j]
        let value = componentState[token.name]
        if (value == null) {
          value = ''
        }
        replaceToken({
          type: 'textNode',
          node: item.textNode,
          content: token.content,
          value
        })
      }
    }

    const customElements = module.customElements
    for (let i = 0; i < customElements.length; i++) {
      const customElement = customElements[i]

      if (customElement.children && customElement.children.length && !customElement.slots.length) {
        const children = customElement.children

        for (let j = 0; j < children.length; j++) {
          const node = children[j]
          const slotElement = {
            name: 'default',
            node
          }
          if (isCoraliteElement(node) && node.attribs.slot) {
            slotElement.name = node.attribs.slot
          }
          customElement.slots.push(slotElement)
        }
      }
    }

    const createComponentTasks = []
    for (let i = 0; i < customElements.length; i++) {
      const customElement = customElements[i]

      let parent = customElement.parent
      let shouldSkip = false
      while (parent) {
        if ('slots' in parent && Array.isArray(parent.slots)) {
          shouldSkip = true
          break
        }
        // @ts-ignore
        parent = parent.parent
      }
      if (shouldSkip) {
        continue
      }

      const childContextId = session.generateId(customElement.name)
      const currentProperties = session.state[childContextId] || {}

      let childState = { ...state }
      if (typeof customElement.attribs === 'object') {
        const childModuleComponent = app.components.getItem(customElement.name)
        let declaredAttrs = {}
        if (childModuleComponent && childModuleComponent.result) {
          declaredAttrs = childModuleComponent.result.script?.attributes || childModuleComponent.result.attributes || {}
        }
        const attribValues = filterReservedAttributes(cleanKeys(customElement.attribs), declaredAttrs)
        childState = {
          ...childState,
          ...currentProperties,
          ...attribValues
        }
      } else {
        childState = {
          ...childState,
          ...currentProperties
        }
      }

      session.state[childContextId] = childState
      const childNoHydration = noHydration || (customElement.attribs && 'no-hydration' in customElement.attribs)

      createComponentTasks.push(createComponentElement({
        id: customElement.name,
        state: childState,
        element: customElement,
        page,
        root,
        contextId: childContextId,
        index,
        session,
        noHydration: childNoHydration,
        head: false
      }).then(childComponentElement => ({
        childComponentElement,
        customElement,
        childContextId,
        noHydration: childNoHydration
      })))
    }

    const results = await Promise.all(createComponentTasks)

    for (let i = 0; i < results.length; i++) {
      const { childComponentElement, customElement, childContextId, noHydration: childNoHydration } = results[i]

      if (childComponentElement && typeof childComponentElement === 'object') {
        let children = []

        if (Array.isArray(childComponentElement)) {
          children = childComponentElement
        } else if ('children' in childComponentElement && Array.isArray(childComponentElement.children)) {
          children = childComponentElement.children
        }

        if (childNoHydration) {
          const parent = customElement.parent

          if (parent && parent.children && Array.isArray(parent.children)) {
            const idx = parent.children.indexOf(customElement)
            if (idx !== -1) {
              parent.children.splice(idx, 1, ...children)
              relinkChildren(parent)
            }
          }
        } else {
          customElement.children = children
          relinkChildren(customElement)

          if (!customElement.attribs) {
            customElement.attribs = {}
          }

          customElement.attribs['data-cid'] = childContextId
          customElement.attribs['data-coralite-initial'] = ''
          session.componentTags.add(customElement.name)
        }
      }
    }

    await _replaceSlots({
      id,
      instanceId,
      element,
      module,
      state: componentState,
      page,
      root,
      index,
      session,
      noHydration
    })

    // Evaluate host component reactive styles
    const scriptMeta = moduleComponent.result?.script || {}
    /** @type {any} */
    const moduleScriptObj = module.script
    const componentStyleObj = evaluatedStyle || scriptMeta.style || moduleScriptObj?.style || {}
    if (componentStyleObj && typeof componentStyleObj === 'object' && Object.keys(componentStyleObj).length > 0) {
      const computedStylesMap = new Map()
      /** @type {any} */
      const elementNode = element

      // 1. Pre-existing static inline style attribute on host element tag
      if (elementNode && elementNode.attribs && elementNode.attribs.style) {
        const parsed = parseInlineStyle(elementNode.attribs.style)
        for (const [k, v] of parsed.entries()) {
          computedStylesMap.set(k, v)
        }
      }

      // 2. Component style properties (overriding tag style on collision)
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

      if (elementNode) {
        const formatted = formatInlineStyle(computedStylesMap)
        if (formatted) {
          if (!elementNode.attribs) {
            elementNode.attribs = {}
          }
          elementNode.attribs.style = formatted
        } else if (elementNode.attribs && elementNode.attribs.style !== undefined) {
          delete elementNode.attribs.style
        }
      }
    }

    if (noHydration) {
      const stack = [...result.children]

      while (stack.length > 0) {
        const node = stack.pop()
        if (node.type === 'tag') {
          if (node.name === 'c-token') {
            const parent = node.parent
            if (parent && parent.children) {
              const idx = parent.children.indexOf(node)
              if (idx !== -1) {
                parent.children.splice(idx, 1, ...node.children)
                relinkChildren(parent)
              }
            }
          } else {
            stack.push(...(node.children || []))
          }
        }
      }
    }

    const mappedAfterContext = await hooks.trigger('onAfterComponentRender', {
      result,
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

  const _processCustomElementsInPage = async ({ mappedComponent, originalDocument, state, mappedSessionObject, pageContext }) => {
    const customElementsList = mappedComponent.customElements || []
    const tasks = []

    for (let i = 0; i < customElementsList.length; i++) {
      const customElement = customElementsList[i]

      let parent = customElement.parent
      let shouldSkip = false
      while (parent) {
        if ('slots' in parent && Array.isArray(parent.slots)) {
          shouldSkip = true
          break
        }
        // @ts-ignore
        parent = parent.parent
      }
      if (shouldSkip) {
        continue
      }

      const contextId = mappedSessionObject.generateId(customElement.name)
      const currentProperties = mappedSessionObject.state[contextId] || {}
      const childModuleComponent = app.components.getItem(customElement.name)
      let declaredAttrs = {}
      if (childModuleComponent && childModuleComponent.result) {
        declaredAttrs = childModuleComponent.result.script?.attributes || childModuleComponent.result.attributes || {}
      }
      const attribValues = typeof customElement.attribs === 'object' ? filterReservedAttributes(customElement.attribs, declaredAttrs) : {}
      mappedSessionObject.state[contextId] = typeof customElement.attribs === 'object'
        ? {
          ...currentProperties,
          ...state,
          ...mappedComponent.state,
          ...attribValues
        }
        : {
          ...currentProperties,
          ...state,
          ...mappedComponent.state
        }

      const noHydration = customElement.attribs && 'no-hydration' in customElement.attribs

      tasks.push(createComponentElement({
        id: customElement.name,
        state: mappedSessionObject.state[contextId],
        element: customElement,
        page: pageContext || originalDocument.page,
        root: mappedComponent.root,
        contextId,
        index: i,
        session: mappedSessionObject,
        noHydration
      }).then(componentElement => ({
        componentElement,
        customElement,
        contextId,
        noHydration
      })))
    }

    const results = await Promise.all(tasks)

    for (const { componentElement, customElement, contextId, noHydration } of results) {
      if (componentElement) {
        if (noHydration) {
          const parent = customElement.parent
          if (parent && parent.children) {
            const elementIndex = parent.children.indexOf(customElement)

            if (elementIndex !== -1) {
              let children = componentElement

              if ('children' in componentElement && Array.isArray(componentElement.children)) {
                children = componentElement.children
              }

              if (Array.isArray(children)) {
                parent.children.splice(elementIndex, 1, ...children)

                relinkChildren(parent)
              }
            }
          }
        } else {
          if (Array.isArray(componentElement)) {
            customElement.children = componentElement
          } else if ('children' in componentElement && Array.isArray(componentElement.children)) {
            customElement.children = componentElement.children
          }

          relinkChildren(customElement)

          if (!customElement.attribs) {
            customElement.attribs = {}
          }

          customElement.attribs['data-cid'] = contextId
          customElement.attribs['data-coralite-initial'] = ''
          mappedSessionObject.componentTags.add(customElement.name)
        }
      }
    }
  }

  const _generatePages = async function* (activeQueue, buildId, state = {}, buildOptions = {}) {
    const isProduction = normalizedOptions.mode === 'production'

    try {
      for (let q = 0; q < activeQueue.length; q++) {
        const pageItem = activeQueue[q]
        const startTime = performance.now()
        const originalDocument = pageItem.result
        let component
        let pageContext = originalDocument.page

        if (!originalDocument.root || pageItem.virtual) {
          let content = pageItem.content

          if (content === undefined) {
            try {
              content = await getHtmlFile(pageItem.path.pathname)
            } catch (e) {
              if (pageItem.virtual) {
                // If a virtual page is missing content, it's a critical error
                throw new CoraliteError(`Virtual page missing content: ${pageItem.path.pathname}`, {
                  pagePath: pageItem.path.pathname
                })
              }
              content = pageItem.content !== undefined ? pageItem.content : (()=>{
                throw e
              })()
            }
          }

          pageItem.content = content

          const elements = parseHTML(content, normalizedOptions.ignoreByAttribute, normalizedOptions.skipRenderByAttribute, handleError)

          pageContext = {
            ...originalDocument.page,
            meta: { ...(originalDocument.page?.meta || {}) }
          }

          const pageState = {
            ...originalDocument.state,
            page: pageContext
          }

          const mappedContext = await hooks.trigger('onPageSet', {
            elements,
            state: pageState,
            page: pageContext,
            data: pageItem,
            app
          })

          const fullPath = Object.assign({}, mappedContext.data.path, {
            pages: normalizedOptions.path.pages,
            components: normalizedOptions.path.components
          })

          component = {
            state: { ...mappedContext.state },
            page: mappedContext.page,
            path: fullPath,
            root: mappedContext.elements.root,
            customElements: mappedContext.elements.customElements,
            tempElements: mappedContext.elements.tempElements,
            skipRenderElements: mappedContext.elements.skipRenderElements,
            ignoreByAttribute: normalizedOptions.ignoreByAttribute || []
          }
        } else {
          component = cloneComponentInstance(originalDocument)
          component.ignoreByAttribute = component.ignoreByAttribute || normalizedOptions.ignoreByAttribute || []
          pageContext = component.page
        }

        Object.assign(component.state, state)
        const session = _createSession(buildId)
        session.mode = normalizedOptions.mode

        const mappedSession = await hooks.trigger('onBeforePageRender', {
          component,
          state,
          page: pageContext,
          session,
          app
        })

        const mappedComponent = mappedSession.component
        const mappedSessionObject = mappedSession.session

        state = mappedSession.state
        mappedSessionObject.mode = normalizedOptions.mode

        removeElements(mappedComponent.tempElements, false)

        await _processCustomElementsInPage({
          mappedComponent,
          originalDocument,
          state,
          mappedSessionObject,
          pageContext
        })

        // Filter manifest to only include components used on this page (declarative + cascading imperative)
        const componentsToInclude = new Set()

        const addComponentAndDependencies = (id) => {
          if (componentsToInclude.has(id)) {
            return
          }
          componentsToInclude.add(id)
          const sharedFn = scriptManager.sharedFunctions[id]
          if (sharedFn && sharedFn.components) {
            const components = sharedFn.components
            for (let i = 0; i < components.length; i++) {
              addComponentAndDependencies(components[i])
            }
          }
        }

        // Include all components that were actually rendered on the page (declarative)
        for (const tag of mappedSessionObject.componentTags) {
          addComponentAndDependencies(tag)
        }

        // Include components from any imperative scripts on this page
        if (mappedSessionObject.scripts.content[mappedComponent.path.pathname]) {
          const scripts = mappedSessionObject.scripts.content[mappedComponent.path.pathname]
          for (const instanceId in scripts) {
            const script = scripts[instanceId]
            addComponentAndDependencies(script.componentId)
            if (script.components) {
              const components = script.components
              for (let i = 0; i < components.length; i++) {
                addComponentAndDependencies(components[i])
              }
            }
          }
        }

        // Include components extracted from plugin code
        for (const module of scriptManager.scriptModules) {
          const extractedComponents = module.client?._extractedComponents || module._extractedComponents
          if (extractedComponents) {
            for (const tag of extractedComponents) {
              addComponentAndDependencies(tag)
            }
          }
        }

        const { head: headElement, body: bodyElement } = findHeadAndBody(mappedComponent.root)
        const base = normalizedOptions.baseURL.endsWith('/') ? normalizedOptions.baseURL : normalizedOptions.baseURL + '/'

        const cspConfig = normalizedOptions.csp || {}
        const pageCspMeta = Boolean(pageContext?.meta?.csp === true || pageContext?.meta?.csp === 'true')
        let pageCspDirectives = pageContext?.meta?.['csp-directives']
        if (typeof pageCspDirectives === 'string') {
          try {
            pageCspDirectives = JSON.parse(pageCspDirectives)
          } catch {
            pageCspDirectives = {}
          }
        }
        if (!pageCspDirectives || typeof pageCspDirectives !== 'object' || Array.isArray(pageCspDirectives)) {
          pageCspDirectives = {}
        }

        const nonce = resolveNonce({
          buildOptions,
          pageContext,
          session: mappedSessionObject,
          config: normalizedOptions
        })

        const isCspActive = cspConfig.enabled === true || (
          cspConfig.enabled !== false && (
            nonce !== null ||
            cspConfig.externalScripts === true ||
            cspConfig.externalStyles === true ||
            cspConfig.injectMeta === true ||
            pageCspMeta === true ||
            (Boolean(cspConfig.directives) && Object.keys(cspConfig.directives).length > 0) ||
            Object.keys(pageCspDirectives).length > 0
          )
        )

        const hashAlgo = cspConfig.hashAlgorithm || 'sha256'
        const isExternalScripts = cspConfig.enabled !== false && cspConfig.externalScripts === true
        const isExternalStyles = cspConfig.enabled !== false && cspConfig.externalStyles === true
        const scriptHashes = []
        const styleHashes = []

        // --- Automated Asset Injection & Tag Flush Pass ---
        const pagePathname = pageItem.path.pathname
        const rawTagsToFlush = []

        // 1. Collect declarative options.assets with inject
        if (Array.isArray(normalizedOptions.assets)) {
          for (const asset of normalizedOptions.assets) {
            if (asset.inject) {
              const injectConfig = typeof asset.inject === 'boolean' ? {} : asset.inject
              let inferredType = injectConfig.type
              if (!inferredType) {
                if (asset.dest.endsWith('.js') || asset.dest.endsWith('.mjs') || asset.dest.endsWith('.cjs')) {
                  inferredType = 'script'
                } else if (asset.dest.endsWith('.css')) {
                  inferredType = 'link'
                }
              }

              rawTagsToFlush.push({
                type: inferredType,
                dest: asset.dest,
                placement: injectConfig.placement || 'head-end',
                sri: injectConfig.sri ?? false,
                pages: injectConfig.pages ?? '*',
                attributes: injectConfig.attributes || {},
                rel: injectConfig.rel || (inferredType === 'link' ? 'stylesheet' : undefined),
                name: injectConfig.name,
                'http-equiv': injectConfig['http-equiv'],
                content: injectConfig.content
              })
            }
          }
        }

        // 2. Collect session._injectedTags
        if (Array.isArray(mappedSessionObject._injectedTags)) {
          for (const injectedTag of mappedSessionObject._injectedTags) {
            rawTagsToFlush.push(injectedTag)
          }
        }

        // Scan existing AST for deduplication
        const existingExternalUrls = new Set()
        const existingInlineHashes = new Set()

        const scanASTForDuplicates = (container) => {
          if (!container || !container.children) {
            return
          }
          for (const child of container.children) {
            if (child.type === 'tag') {
              if ((child.name === 'script' && child.attribs?.src) || (child.name === 'link' && child.attribs?.href)) {
                const url = child.attribs.src || child.attribs.href
                existingExternalUrls.add(url)
              } else if (child.name === 'script' || child.name === 'style') {
                const textChild = child.children?.find(c => c.type === 'text')
                if (textChild && textChild.data) {
                  existingInlineHashes.add(hash(textChild.data))
                }
              }
              scanASTForDuplicates(child)
            }
          }
        }
        scanASTForDuplicates(mappedComponent.root)

        // Process and insert tags
        const pageInjectedAssetHashes = []

        for (const tagOptions of rawTagsToFlush) {
          const patterns = Array.isArray(tagOptions.pages) ? tagOptions.pages : [tagOptions.pages ?? '*']
          const universal = patterns.some(p => p === '*')
          const relPagePath = relative(normalizedOptions.path.pages, pagePathname)
          const matches = universal || patterns.some(p => picomatch(p)(pagePathname) || picomatch(p)(relPagePath))

          if (!matches) {
            continue
          }

          let type = tagOptions.type || 'script'
          let placement = tagOptions.placement || 'head-end'
          const attribs = { ...(tagOptions.attributes || {}) }

          let isExternal = false
          let targetUrl = ''

          if (attribs.src) {
            targetUrl = attribs.src
            isExternal = true
          } else if (attribs.href) {
            targetUrl = attribs.href
            isExternal = true
          } else if (tagOptions.src) {
            targetUrl = tagOptions.src.startsWith('http://') || tagOptions.src.startsWith('https://') || tagOptions.src.startsWith('/')
              ? tagOptions.src
              : `${base}${tagOptions.src}`
            isExternal = true
          } else if (tagOptions.dest) {
            targetUrl = `${base}${tagOptions.dest}`
            isExternal = true
          }

          if (isExternal) {
            if (type === 'script' && !attribs.src) {
              attribs.src = targetUrl
            }
            if (type === 'link' && !attribs.href) {
              attribs.href = targetUrl
            }
          }

          if (type === 'link' && !attribs.rel) {
            attribs.rel = tagOptions.rel || 'stylesheet'
          }
          if (type === 'meta') {
            if (tagOptions.name && !attribs.name) {
              attribs.name = tagOptions.name
            }
            if (tagOptions['http-equiv'] && !attribs['http-equiv']) {
              attribs['http-equiv'] = tagOptions['http-equiv']
            }
            if (tagOptions.content && !attribs.content) {
              attribs.content = tagOptions.content
            }
          }

          const inlineContent = tagOptions.content

          // Deduplication check
          if (isExternal) {
            if (existingExternalUrls.has(targetUrl)) {
              continue
            }
            existingExternalUrls.add(targetUrl)
          } else if (inlineContent) {
            const contentHash = hash(inlineContent)
            if (existingInlineHashes.has(contentHash)) {
              continue
            }
            existingInlineHashes.add(contentHash)
          }

          // SRI Resolution
          const sriOption = tagOptions.sri ?? false
          const explicitIntegrity = attribs.integrity

          if (sriOption && explicitIntegrity) {
            handleError({
              level: 'WARN',
              message: `[Coralite Asset Injection] Conflict on "${tagOptions.dest || targetUrl}": Explicit integrity attribute provided while sri option is enabled. Explicit attribute takes precedence; auto-crossorigin disabled.`
            })
          } else if (sriOption) {
            const algo = typeof sriOption === 'string' ? sriOption : 'sha384'
            let fileContent = null
            let assetDestPath = tagOptions.dest

            if (!assetDestPath && targetUrl.startsWith(base)) {
              assetDestPath = targetUrl.substring(base.length)
            }

            if (assetDestPath) {
              const outputDir = normalizedOptions.output || join(normalizedOptions.projectRoot || process.cwd(), 'dist')
              const fullDiskPath = join(outputDir, assetDestPath)

              try {
                const fileStat = await stat(fullDiskPath)
                const cacheKey = `${assetDestPath}:${fileStat.mtimeMs}:${fileStat.size}:${algo}`

                let computedDigest = ''
                let contentHash = ''

                if (sriDigestCache.has(cacheKey)) {
                  const cached = sriDigestCache.get(cacheKey)
                  computedDigest = cached.digest
                  contentHash = cached.contentHash
                } else {
                  fileContent = await readFile(fullDiskPath)
                  computedDigest = calculateSRIDigest(fileContent, algo)
                  contentHash = hash(fileContent)
                  sriDigestCache.set(cacheKey, {
                    digest: computedDigest,
                    contentHash
                  })
                }

                attribs.integrity = computedDigest
                if (!attribs.crossorigin) {
                  attribs.crossorigin = 'anonymous'
                }

                pageInjectedAssetHashes.push({
                  dest: assetDestPath,
                  hash: contentHash
                })
              } catch {
                handleError({
                  level: 'WARN',
                  message: `[Coralite Asset Injection] Referenced asset file "${fullDiskPath}" not found on disk. Injection skipped.`
                })
                continue
              }
            }
          }

          // CSP Hash contribution / Nonce for inline script/style content
          if (!isExternal && inlineContent) {
            if (type === 'script') {
              if (nonce) {
                attribs.nonce = nonce
              } else if (isCspActive) {
                scriptHashes.push(calculateHash(inlineContent, hashAlgo))
              }
            } else if (type === 'style' || (type === 'link' && inlineContent)) {
              if (nonce) {
                attribs.nonce = nonce
              } else if (isCspActive) {
                styleHashes.push(calculateHash(inlineContent, hashAlgo))
              }
            }
          }

          // Container resolution and placement
          let container = null
          let fallbackToRoot = false

          if (placement === 'head-start' || placement === 'head-end') {
            if (headElement) {
              container = headElement
            } else {
              container = mappedComponent.root
              fallbackToRoot = true
            }
          } else if (placement === 'body-start' || placement === 'body-end') {
            if (bodyElement && bodyElement !== mappedComponent.root) {
              container = bodyElement
            } else {
              container = mappedComponent.root
              fallbackToRoot = true
            }
          }

          if (fallbackToRoot) {
            handleError({
              level: 'WARN',
              message: `[Coralite Asset Injection] Missing target container for placement "${placement}". Falling back to root element.`
            })
          }

          const tagElement = createCoraliteElement({
            type: 'tag',
            name: type,
            parent: container,
            attribs,
            children: []
          })

          if (inlineContent && type !== 'meta') {
            tagElement.children.push(createCoraliteTextNode({
              type: 'text',
              data: inlineContent,
              parent: tagElement
            }))
          }

          if (placement === 'head-start' || (fallbackToRoot && placement.endsWith('-start'))) {
            container.children.unshift(tagElement)
          } else if (placement === 'body-start') {
            container.children.unshift(tagElement)
          } else {
            // head-end or body-end (strictly before framework client runtime bootstrap)
            container.children.push(tagElement)
          }
        }

        mappedSessionObject._pageInjectedAssetHashes = pageInjectedAssetHashes

        let pageStylePath = null
        let pageStyleHash = null
        let pageScriptPath = null
        let pageScriptHash = null
        let runtimeChunkPath = null

        /** @type {Record<string, { js: string, css: string | null }>} */
        const componentHashes = {}
        if (globalScriptResult?.manifest) {
          const sortedTags = Array.from(componentsToInclude).sort()
          for (const tag of sortedTags) {
            if (globalScriptResult.manifest[tag]) {
              componentHashes[tag] = globalScriptResult.manifest[tag]
            }
          }
        }

        if (normalizedOptions.externalStyles && normalizedOptions.externalStyles.length > 0) {
          injectExternalStyles(mappedComponent.root, headElement, normalizedOptions.externalStyles, { nonce: isExternalStyles ? null : nonce })
        }

        if (isExternalStyles) {
          if (componentsToInclude.size > 0 || mappedSessionObject.styles.size > 0) {
            let combinedCss = ''
            if (componentsToInclude.size > 0) {
              const selectors = Array.from(componentsToInclude)
              selectors.push('c-token')
              combinedCss += `${selectors.join(', ')} { display: contents; }\n`
            }
            if (mappedSessionObject.styles.size > 0) {
              for (const [selector, css] of mappedSessionObject.styles) {
                combinedCss += `[data-style-selector="${selector}"] {\n${css}\n}\n`
              }
            }
            const cssHashVal = hash(combinedCss)
            const cssFileHash = cssHashVal.slice(0, 8)
            const relPath = `coralite-inline-${cssFileHash}.css`
            const fullPath = `assets/css/${relPath}`
            pageStylePath = fullPath
            pageStyleHash = cssHashVal
            outputFiles[fullPath] = {
              path: fullPath,
              hashedPath: relPath,
              text: combinedCss
            }
            if (app.trackOutputFile) {
              app.trackOutputFile(join(normalizedOptions.output || '', fullPath))
            }

            const linkElement = createCoraliteElement({
              type: 'tag',
              name: 'link',
              parent: headElement || mappedComponent.root,
              attribs: {
                rel: 'stylesheet',
                href: `${base}${fullPath}`
              },
              children: []
            })
            if (headElement) {
              headElement.children.push(linkElement)
            } else {
              mappedComponent.root.children.unshift(linkElement)
            }
          }
        } else {
          if (mappedSessionObject.styles.size > 0) {
            const { content: inlineCss } = injectStyles(mappedComponent.root, headElement, mappedSessionObject.styles, { nonce })
            if (isCspActive && !nonce && inlineCss) {
              styleHashes.push(calculateHash(inlineCss, hashAlgo))
            }
          }

          if (componentsToInclude.size > 0) {
            const targetElement = headElement || bodyElement || mappedComponent.root
            const layoutAttribs = { id: 'coralite-components' }
            if (nonce) {
              layoutAttribs.nonce = nonce
            }

            const layoutStyleElement = createCoraliteElement({
              type: 'tag',
              name: 'style',
              parent: targetElement,
              attribs: layoutAttribs,
              children: []
            })

            const selectors = Array.from(componentsToInclude)
            selectors.push('c-token')
            const layoutCss = `${selectors.join(', ')} { display: contents; }`

            layoutStyleElement.children.push(createCoraliteTextNode({
              type: 'text',
              data: layoutCss,
              parent: layoutStyleElement
            }))

            if (targetElement === headElement || targetElement === bodyElement) {
              targetElement.children.push(layoutStyleElement)
            } else {
              targetElement.children.unshift(layoutStyleElement)
            }

            if (isCspActive && !nonce && layoutCss) {
              styleHashes.push(calculateHash(layoutCss, hashAlgo))
            }
          }
        }

        if (mappedSessionObject.scripts.content[mappedComponent.path.pathname]) {
          const scripts = mappedSessionObject.scripts.content[mappedComponent.path.pathname]
          const instances = {}
          const declarativeTags = new Set()
          for (const key in scripts) {
            const script = scripts[key]
            declarativeTags.add(script.componentId)
            instances[script.id] = {
              instanceId: script.id,
              componentId: script.componentId,
              page: script.page,
              state: script.state
            }
          }

          const scriptResult = globalScriptResult

          if (!scriptResult || !scriptResult.manifest['coralite-runtime']) {
            handleError({
              level: 'ERR',
              message: 'MANIFEST MISSING coralite-runtime!',
              error: new Error(JSON.stringify(scriptResult.manifest))
            })
          } else {
            runtimeChunkPath = scriptResult.manifest['coralite-runtime']
          }

          const { content: readyContent } = injectReadinessScript(mappedComponent.root, headElement, true, normalizedOptions.mode, {
            nonce,
            external: isExternalScripts
          })
          if (isCspActive && !nonce && readyContent) {
            scriptHashes.push(calculateHash(readyContent, hashAlgo))
          }

          const { content: mapContent } = injectImportMap(mappedComponent.root, headElement, scriptResult.importMap, base, { nonce })
          if (isCspActive && !nonce && mapContent) {
            scriptHashes.push(calculateHash(mapContent, hashAlgo))
          }

          const hydrationData = {}

          for (const [id, instance] of Object.entries(instances)) {
            if (instance.state && Object.keys(instance.state).length > 0) {
              validateSerializable(instance.state, `component "${instance.componentId}" state`)
              hydrationData[id] = normalizeObjectFunctions(instance.state, astTransformer)
            }
          }

          const scriptContent = generateClientRuntime({
            base,
            sharedChunkPath: scriptResult.manifest['coralite-runtime'],
            declarativeTags: Array.from(declarativeTags),
            hydrationData: serialize(hydrationData),
            mode: normalizedOptions.mode,
            instanceCounters: serialize(mappedSessionObject.instanceCounters || {})
          })

          if (isExternalScripts) {
            const fullScriptHash = hash(scriptContent)
            const shortScriptHash = fullScriptHash.slice(0, 8)
            const relativePagePath = relative(normalizedOptions.path.pages, pageItem.path.pathname)
            const pageStem = relativePagePath.replace(/\.html$/, '').replace(/[\/\\]/g, '-') || 'index'
            const relPath = `pages/${pageStem}-${shortScriptHash}.js`
            const fullPath = `assets/js/${relPath}`
            pageScriptPath = fullPath
            pageScriptHash = fullScriptHash
            outputFiles[fullPath] = {
              path: fullPath,
              hashedPath: relPath,
              text: scriptContent
            }
            if (app.trackOutputFile) {
              app.trackOutputFile(join(normalizedOptions.output || '', fullPath))
            }

            const scriptAttribs = {
              type: 'module',
              src: `${base}${fullPath}`
            }
            if (nonce) {
              scriptAttribs.nonce = nonce
            }

            const scriptElement = createCoraliteElement({
              type: 'tag',
              name: 'script',
              parent: bodyElement,
              attribs: scriptAttribs,
              children: []
            })
            bodyElement.children.push(scriptElement)

            if (isCspActive && !nonce && scriptContent) {
              scriptHashes.push(calculateHash(scriptContent, hashAlgo))
            }
          } else {
            const scriptAttribs = { type: 'module' }
            if (nonce) {
              scriptAttribs.nonce = nonce
            }

            const scriptElement = createCoraliteElement({
              type: 'tag',
              name: 'script',
              parent: bodyElement,
              attribs: scriptAttribs,
              children: []
            })

            scriptElement.children.push(createCoraliteTextNode({
              type: 'text',
              data: scriptContent,
              parent: scriptElement
            }))
            bodyElement.children.push(scriptElement)

            if (isCspActive && !nonce && scriptContent) {
              scriptHashes.push(calculateHash(scriptContent, hashAlgo))
            }
          }
        } else {
          const { content: readyContent } = injectReadinessScript(mappedComponent.root, headElement, false, normalizedOptions.mode, {
            nonce,
            external: isExternalScripts
          })
          if (isCspActive && !nonce && readyContent) {
            scriptHashes.push(calculateHash(readyContent, hashAlgo))
          }
        }

        removeElements(mappedComponent.skipRenderElements, true)

        let cspResult = null
        if (isCspActive) {
          const mergedDirectives = {
            ...(cspConfig.directives || {}),
            ...(pageCspDirectives || {})
          }
          const formattedHeader = formatCSPDirectives(mergedDirectives, {
            scriptHashes,
            styleHashes,
            nonce
          })
          if (cspConfig.injectMeta || pageCspMeta) {
            const metaCspContent = formatCSPDirectives(mergedDirectives, {
              scriptHashes,
              styleHashes,
              nonce,
              forMeta: true
            })
            injectCSPMeta(mappedComponent.root, headElement, metaCspContent, cspConfig.reportOnly)
          }

          /** @type {'nonce' | 'external' | 'hash'} */
          let cspMode = 'hash'
          if (nonce) {
            cspMode = 'nonce'
          } else if (isExternalScripts) {
            cspMode = 'external'
          }

          cspResult = {
            mode: cspMode,
            nonce: nonce || null,
            scriptHashes: nonce ? [] : scriptHashes,
            styleHashes: (nonce || isExternalStyles) ? [] : styleHashes,
            header: formattedHeader,
            directives: mergedDirectives
          }
        }

        const rawHTML = transformNode(mappedComponent.root)

        /** @type {CoraliteBuildResult} */
        const result = {
          type: 'page',
          path: mappedComponent.path,
          content: rawHTML,
          duration: performance.now() - startTime,
          session
        }

        if (runtimeChunkPath !== null) {
          result.runtimeChunk = runtimeChunkPath
        } else {
          result.runtimeChunk = null
        }

        if (pageScriptPath) {
          result.pageScript = pageScriptPath
          result.pageScriptHash = pageScriptHash
        }

        if (pageStylePath) {
          result.pageStyle = pageStylePath
          result.pageStyleHash = pageStyleHash
        }

        if (Object.keys(componentHashes).length > 0) {
          result.componentHashes = componentHashes
        }

        if (pageInjectedAssetHashes.length > 0) {
          result.injectedAssets = pageInjectedAssetHashes
        }

        if (cspResult) {
          result.csp = cspResult
          session.csp = cspResult
        }

        yield result

        if (isProduction) {
          mappedComponent.root = null; mappedComponent.customElements = null; mappedComponent.tempElements = null; mappedComponent.skipRenderElements = null
          delete pageItem.content
        }

        session.state = null; session.styles = null; session.scripts = null

        if (session.source) {
          session.source.contextInstances = null; session.source = null
        }
      }
    } finally {
      renderQueues.delete(buildId)
    }
  }

  /**
   * Adds a page or a collection item to the current render queue.
   *
   * @param {string | CoraliteCollectionItem | { pathname: string, content: string, cacheKey?: string, volatile?: boolean }} value - The ID of the page or the collection item to add.
   * @param {string} buildId - The unique identifier for the current build session.
   * @throws {Error} If the buildId is missing or invalid, or if the page ID is not found.
   * @returns {Promise<void>}
   */
  const addRenderQueue = async (value, buildId) => {
    if (!buildId) {
      throw new CoraliteError('addRenderQueue requires a buildId')
    }
    if (sealedQueues.has(buildId)) {
      console.warn(`[Coralite] Attempted to add to sealed queue for build "${buildId}". All virtual pages must be added in onBeforeBuild.`)
      return
    }
    const queue = renderQueues.get(buildId)
    if (!queue) {
      throw new CoraliteError(`addRenderQueue - buildId not found: "${buildId}"`)
    }

    let item
    if (typeof value === 'string') {
      item = app.pages.getItem(value)
      if (!item) {
        throw new CoraliteError(`addRenderQueue - unexpected page ID: "${value}"`)
      }
    } else if (isCoraliteCollectionItem(value)) {
      item = await app.pages.setItem(value)
    } else if (value && typeof value === 'object' && 'pathname' in value) {
      const pathname = value.pathname
      /** @type {HTMLData} */
      const itemData = {
        type: 'page',
        content: value.content,
        virtual: true,
        cacheKey: value.cacheKey,
        volatile: value.volatile,
        path: {
          pathname,
          filename: join(pathname),
          dirname: dirname(pathname)
        }
      }

      // Set content again to ensure it's not deleted if it matches collection's onSet/onUpdate criteria
      item = await app.pages.setItem({
        ...itemData,
        content: value.content
      })

      // Force properties directly on the item that resolvePageQueue might return
      item.content = value.content
      item.virtual = true
      item.cacheKey = value.cacheKey
      item.volatile = value.volatile

      // Also ensure the collection item itself has these
      const collectionItem = app.pages.getItem(pathname)
      if (collectionItem) {
        collectionItem.content = value.content
        collectionItem.virtual = true
        collectionItem.cacheKey = value.cacheKey
        collectionItem.volatile = value.volatile
      }
    }

    if (item && !queue.includes(item)) {
      queue.push(item)
    }
  }

  /**
   * Compiles and renders specified pages.
   *
   * @param {string | string[] | CoraliteBuildCallback} [pathOrOptions] - The path(s) to build, or a callback if no path is provided.
   * @param {CoraliteBuildOptions | CoraliteBuildCallback} [optionsOrCallback] - Build options or a callback.
   * @param {CoraliteBuildCallback} [callback] - Optional callback executed for each rendered page.
   * @returns {Promise<CoraliteBuildResult[]>} A promise resolving to an array of build results.
   */
  const build = async (pathOrOptions, optionsOrCallback, callback) => {
    const startTime = performance.now()
    const buildId = randomUUID()
    let buildPath = pathOrOptions
    let buildOptions
    let buildCallback = callback

    if (typeof pathOrOptions === 'function') {
      buildPath = null
      buildCallback = pathOrOptions
    } else if (typeof optionsOrCallback === 'function') {
      buildCallback = optionsOrCallback
    } else {
      buildOptions = optionsOrCallback
    }

    if (!buildOptions) {
      buildOptions = {}
    }

    const isIncremental = buildOptions.incremental ?? normalizedOptions.incremental ?? true

    // Phase 0: Manifest Loading
    const projectRoot = app.options.projectRoot || process.cwd()
    const cacheDir = join(projectRoot, '.coralite')
    const manifestPath = join(cacheDir, 'manifest.json')
    let manifest = {
      physical: {},
      virtual: {},
      dependencies: {},
      components: {}
    }

    try {
      const content = await readFile(manifestPath, 'utf8')
      manifest = JSON.parse(content)
      if (!manifest.components) {
        manifest.components = {}
      }
    } catch (e) {
      // Manifest missing (cold start) or corrupt, use default
      if (e.code !== 'ENOENT') {
        handleError({
          level: 'WARN',
          message: `Could not parse manifest at ${manifestPath}: ${e.message}. Starting with fresh manifest.`
        })
      }
    }

    // Phase 1: Discovery & Pre-Render Staging
    let componentBuildInfo = {
      completed: 0,
      skipped: 0,
      details: []
    }

    if (normalizedOptions.mode === 'production' || normalizedOptions.mode === 'testing') {
      const allComponentIds = app.components.list.map(c => c.result.id)
      globalScriptResult = await scriptManager.compileAllInstances(allComponentIds, normalizedOptions.mode)
      Object.assign(outputFiles, globalScriptResult.outputFiles)

      if (globalScriptResult.manifest) {
        const manifestJS = `export default ${JSON.stringify(globalScriptResult.manifest)};`
        outputFiles['manifest.js'] = {
          path: 'assets/js/manifest.js',
          hashedPath: 'manifest.js',
          text: manifestJS
        }

        const newComponentManifest = globalScriptResult.manifest
        const oldComponentManifest = manifest.components

        for (const [id, value] of Object.entries(newComponentManifest)) {
          if (id === 'coralite-runtime') {
            continue
          }

          const isNew = !oldComponentManifest[id]
          const hasChanged = !isNew && (
            value.js !== oldComponentManifest[id].js ||
            value.css !== oldComponentManifest[id].css
          )

          if (!isIncremental || isNew || hasChanged) {
            componentBuildInfo.completed++
            let reason = 'Source changed'

            if (!isIncremental) {
              reason = 'Incremental disabled'
            } else if (isNew) {
              reason = 'New component'
            }

            componentBuildInfo.details.push({
              id,
              status: 'built',
              reason
            })
          } else {
            componentBuildInfo.skipped++
            componentBuildInfo.details.push({
              id,
              status: 'skipped'
            })
          }
        }

        if (typeof buildOptions.onComponentBuild === 'function') {
          await buildOptions.onComponentBuild(componentBuildInfo)
        } else if (typeof normalizedOptions.onComponentBuild === 'function') {
          await normalizedOptions.onComponentBuild(componentBuildInfo)
        }
      }
    } else if (normalizedOptions.mode === 'development') {
      // Atomic site-wide rebuild for development
      if (!siteWideBundlePromise) {
        const bundlePromise = (async () => {
          const allComponentIds = app.components.list.map(c => c.result.id)
          const result = await scriptManager.compileAllInstances(allComponentIds, normalizedOptions.mode)

          // Only update if this is still the active build session
          if (siteWideBundlePromise === bundlePromise) {
            globalScriptResult = result
            // Clear old output files but keep newest
            for (const key in outputFiles) {
              delete outputFiles[key]
            }
            Object.assign(outputFiles, result.outputFiles)

            if (result.manifest) {
              const manifestJS = `export default ${JSON.stringify(result.manifest)};`
              outputFiles['manifest.js'] = {
                path: 'assets/js/manifest.js',
                hashedPath: 'manifest.js',
                text: manifestJS
              }
            }
          }
          return result
        })()
        siteWideBundlePromise = bundlePromise
      }
      await siteWideBundlePromise
    }

    if (buildPath) {
      const paths = Array.isArray(buildPath) ? buildPath : [buildPath]
      for (const p of paths) {
        if (typeof p === 'string' && !app.pages.getItem(p)) {
          try {
            await app.pages.setItem(p)
          } catch (_err) {
          }
        }
      }
    }

    renderQueues.set(buildId, [])

    let mappedBeforeBuild
    try {
      mappedBeforeBuild = await hooks.trigger('onBeforeBuild', {
        app,
        buildId,
        options: buildOptions,
        addRenderQueue: (value) => addRenderQueue(value, buildId)
      })
    } catch (errorHook) {
      const error = new CoraliteError(`Error in onBeforeBuild hook: ${errorHook.message}`, { cause: errorHook })
      handleError({
        level: 'ERR',
        message: error.message,
        error
      })
      throw error
    }

    buildOptions = mappedBeforeBuild.options || buildOptions

    // @ts-ignore
    const resolvedQueue = resolvePageQueue(app.pages, buildPath)
    const queue = renderQueues.get(buildId)

    for (let i = 0; i < resolvedQueue.length; i++) {
      const item = resolvedQueue[i]
      if (!queue.includes(item)) {
        queue.push(item)
      }
    }

    // Seal the queue
    sealedQueues.add(buildId)

    // Phase 2: ISR & Manifest Invalidation
    // Restore directPageComponents from manifest
    for (const [path, metadata] of Object.entries(manifest.physical || {})) {
      if (metadata.dependencies) {
        app._dependencyGraph.directPageComponents[path] = metadata.dependencies
      }
    }
    for (const [path, metadata] of Object.entries(manifest.virtual || {})) {
      if (metadata.dependencies) {
        app._dependencyGraph.directPageComponents[path] = metadata.dependencies
      }
    }
    app._refreshDependencyGraph()

    const mocksStr = app.options.testing?.mocks ? serialize(app.options.testing.mocks) : ''
    const mocksHash = hash(mocksStr)
    const mocksChanged = manifest.testingMocksHash !== mocksHash

    const pagesToRender = []
    const skippedPages = []
    const newManifest = {
      physical: {},
      virtual: {},
      dependencies: {},
      components: {},
      testingMocksHash: mocksHash
    }

    // Check components first for dependency cascading
    const componentChanges = new Map()
    const allComponents = app.components.list
    let anyComponentChanged = false
    for (const component of allComponents) {
      const { changed, metadata } = await checkFileChange(component.path.pathname, manifest.physical[component.path.pathname])
      newManifest.physical[component.path.pathname] = metadata
      if (changed || !manifest.physical[component.path.pathname]) {
        componentChanges.set(component.result.id, true)
        anyComponentChanged = true
        // Force re-parse
        await app.components.updateItem(component.path.pathname)
      }
    }

    if (anyComponentChanged) {
      app._refreshDependencyGraph()
    }

    const pageCustomElements = {
      ...manifest.dependencies,
      ...app._dependencyGraph.pageCustomElements
    }

    const outputDir = normalizedOptions.output || join(normalizedOptions.projectRoot || process.cwd(), 'dist')

    const checkPageAssetsAndManifest = async (existingPageMeta) => {
      if (!existingPageMeta) {
        return false
      }

      // Migration check: runtimeChunk missing on older manifests
      if (existingPageMeta.runtimeChunk === undefined) {
        return true
      }

      // Runtime chunk comparison & disk check for pages with client scripts
      if (existingPageMeta.runtimeChunk !== null) {
        const currentRuntimeChunk = globalScriptResult?.manifest?.['coralite-runtime'] || null
        if (existingPageMeta.runtimeChunk !== currentRuntimeChunk) {
          return true
        }
        if (normalizedOptions.output && existingPageMeta.runtimeChunk) {
          const runtimeDiskPath = join(outputDir, 'assets/js', existingPageMeta.runtimeChunk)
          try {
            await access(runtimeDiskPath)
          } catch {
            return true
          }
        }
      }

      // Component hashes check
      if (existingPageMeta.componentHashes) {
        const currentManifest = globalScriptResult?.manifest || {}
        for (const [tag, storedHashes] of Object.entries(existingPageMeta.componentHashes)) {
          const currentHashes = currentManifest[tag]
          if (!currentHashes) {
            return true
          }
          if (currentHashes.js !== storedHashes.js || currentHashes.css !== storedHashes.css) {
            return true
          }
        }
      }

      // Page script check
      if (existingPageMeta.pageScript && normalizedOptions.output) {
        const diskPath = join(outputDir, existingPageMeta.pageScript)
        try {
          const fileContent = await readFile(diskPath)
          if (existingPageMeta.pageScriptHash && hash(fileContent) !== existingPageMeta.pageScriptHash) {
            return true
          }
        } catch {
          return true
        }
      }

      // Page style check
      if (existingPageMeta.pageStyle && normalizedOptions.output) {
        const diskPath = join(outputDir, existingPageMeta.pageStyle)
        try {
          const fileContent = await readFile(diskPath)
          if (existingPageMeta.pageStyleHash && hash(fileContent) !== existingPageMeta.pageStyleHash) {
            return true
          }
        } catch {
          return true
        }
      }

      // Injected assets check
      if (existingPageMeta.injectedAssets && normalizedOptions.output) {
        for (const assetRef of existingPageMeta.injectedAssets) {
          const fullDiskPath = join(outputDir, assetRef.dest)
          try {
            const fileContent = await readFile(fullDiskPath)
            if (hash(fileContent) !== assetRef.hash) {
              return true
            }
          } catch {
            return true
          }
        }
      }

      return false
    }

    for (const pageItem of queue) {
      let shouldRebuild = false

      if (normalizedOptions.output && (normalizedOptions.mode === 'production' || normalizedOptions.mode === 'testing')) {
        const relativeDir = relative(normalizedOptions.path.pages, pageItem.path.dirname)
        const outFile = join(normalizedOptions.output, relativeDir, pageItem.path.filename)
        try {
          await access(outFile)
        } catch {
          shouldRebuild = true
        }
      }

      // Check if any dependent component changed
      const componentIds = Object.keys(pageCustomElements).filter(id => {
        const pages = pageCustomElements[id]
        if (pages instanceof Set) {
          return pages.has(pageItem.path.pathname)
        }
        return Array.isArray(pages) && pages.includes(pageItem.path.pathname)
      })
      if (componentIds.some(id => componentChanges.get(id))) {
        shouldRebuild = true
      }

      if (mocksChanged || !isIncremental) {
        shouldRebuild = true
      }

      if (pageItem.virtual) {
        const existingVirtualMeta = manifest.virtual ? manifest.virtual[pageItem.path.pathname] : null
        if (!shouldRebuild) {
          shouldRebuild = await checkPageAssetsAndManifest(existingVirtualMeta)
        }

        const shouldRebuildVirtual = !isIncremental || shouldRebuild || pageItem.volatile || !existingVirtualMeta || String(existingVirtualMeta.cacheKey) !== String(pageItem.cacheKey) || normalizedOptions.mode === 'development'

        if (!newManifest.virtual) {
          newManifest.virtual = {}
        }
        newManifest.virtual[pageItem.path.pathname] = { cacheKey: pageItem.cacheKey }

        if (!shouldRebuildVirtual) {
          /** @type {CoraliteBuildResult} */
          const skippedResult = {
            type: 'page',
            // @ts-ignore
            path: {
              ...pageItem.path,
              pages: normalizedOptions.path.pages,
              components: normalizedOptions.path.components
            },
            status: 'skipped'
          }

          skippedPages.push(skippedResult)

          if (existingVirtualMeta) {
            if (existingVirtualMeta.runtimeChunk !== undefined) {
              newManifest.virtual[pageItem.path.pathname].runtimeChunk = existingVirtualMeta.runtimeChunk
            }
            if (existingVirtualMeta.pageScript) {
              newManifest.virtual[pageItem.path.pathname].pageScript = existingVirtualMeta.pageScript
            }
            if (existingVirtualMeta.pageScriptHash) {
              newManifest.virtual[pageItem.path.pathname].pageScriptHash = existingVirtualMeta.pageScriptHash
            }
            if (existingVirtualMeta.pageStyle) {
              newManifest.virtual[pageItem.path.pathname].pageStyle = existingVirtualMeta.pageStyle
            }
            if (existingVirtualMeta.pageStyleHash) {
              newManifest.virtual[pageItem.path.pathname].pageStyleHash = existingVirtualMeta.pageStyleHash
            }
            if (existingVirtualMeta.componentHashes) {
              newManifest.virtual[pageItem.path.pathname].componentHashes = existingVirtualMeta.componentHashes
            }
            if (existingVirtualMeta.injectedAssets) {
              newManifest.virtual[pageItem.path.pathname].injectedAssets = existingVirtualMeta.injectedAssets
            }
            if (existingVirtualMeta.dependencies) {
              newManifest.virtual[pageItem.path.pathname].dependencies = existingVirtualMeta.dependencies
            }

            if (existingVirtualMeta.pageScript && app.trackOutputFile) {
              app.trackOutputFile(join(outputDir, existingVirtualMeta.pageScript))
            }
            if (existingVirtualMeta.pageStyle && app.trackOutputFile) {
              app.trackOutputFile(join(outputDir, existingVirtualMeta.pageStyle))
            }
            if (existingVirtualMeta.injectedAssets && app.trackOutputFile) {
              for (const assetRef of existingVirtualMeta.injectedAssets) {
                app.trackOutputFile(join(outputDir, assetRef.dest))
              }
            }
          }
        } else {
          pagesToRender.push(pageItem)
        }
      } else {
        const { changed, metadata } = await checkFileChange(pageItem.path.pathname, manifest.physical[pageItem.path.pathname])
        newManifest.physical[pageItem.path.pathname] = metadata

        const existingPageMeta = manifest.physical[pageItem.path.pathname]
        if (!shouldRebuild) {
          shouldRebuild = await checkPageAssetsAndManifest(existingPageMeta)
        }

        if (!isIncremental || changed || shouldRebuild || normalizedOptions.mode === 'development') {
          pagesToRender.push(pageItem)
        } else {
          /** @type {CoraliteBuildResult} */
          const skippedResult = {
            type: 'page',
            // @ts-ignore
            path: {
              ...pageItem.path,
              pages: normalizedOptions.path.pages,
              components: normalizedOptions.path.components
            },
            status: 'skipped'
          }

          if (existingPageMeta) {
            if (existingPageMeta.runtimeChunk !== undefined) {
              newManifest.physical[pageItem.path.pathname].runtimeChunk = existingPageMeta.runtimeChunk
            }
            if (existingPageMeta.pageScript) {
              newManifest.physical[pageItem.path.pathname].pageScript = existingPageMeta.pageScript
            }
            if (existingPageMeta.pageScriptHash) {
              newManifest.physical[pageItem.path.pathname].pageScriptHash = existingPageMeta.pageScriptHash
            }
            if (existingPageMeta.pageStyle) {
              newManifest.physical[pageItem.path.pathname].pageStyle = existingPageMeta.pageStyle
            }
            if (existingPageMeta.pageStyleHash) {
              newManifest.physical[pageItem.path.pathname].pageStyleHash = existingPageMeta.pageStyleHash
            }
            if (existingPageMeta.componentHashes) {
              newManifest.physical[pageItem.path.pathname].componentHashes = existingPageMeta.componentHashes
            }
            if (existingPageMeta.injectedAssets) {
              newManifest.physical[pageItem.path.pathname].injectedAssets = existingPageMeta.injectedAssets
            }
            if (existingPageMeta.dependencies) {
              newManifest.physical[pageItem.path.pathname].dependencies = existingPageMeta.dependencies
            }

            if (existingPageMeta.pageScript && app.trackOutputFile) {
              app.trackOutputFile(join(outputDir, existingPageMeta.pageScript))
            }
            if (existingPageMeta.pageStyle && app.trackOutputFile) {
              app.trackOutputFile(join(outputDir, existingPageMeta.pageStyle))
            }
            if (existingPageMeta.injectedAssets && app.trackOutputFile) {
              for (const assetRef of existingPageMeta.injectedAssets) {
                app.trackOutputFile(join(outputDir, assetRef.dest))
              }
            }
          }

          skippedPages.push(skippedResult)
        }
      }
    }

    // Update dependency graph in manifest
    const { pageCustomElements: livePageCustomElements, directPageComponents: liveDirectPageComponents } = app._dependencyGraph

    for (const [id, pages] of Object.entries(livePageCustomElements)) {
      newManifest.dependencies[id] = Array.from(pages)
    }

    // Attach direct dependencies to page entries in newManifest
    for (const [path, deps] of Object.entries(liveDirectPageComponents)) {
      if (newManifest.physical[path]) {
        newManifest.physical[path].dependencies = deps
      } else if (newManifest.virtual[path]) {
        newManifest.virtual[path].dependencies = deps
      }
    }

    // Carry over old dependencies if not overwritten
    for (const [id, pages] of Object.entries(manifest.dependencies || {})) {
      if (!newManifest.dependencies[id]) {
        newManifest.dependencies[id] = pages
      }
    }

    const signal = buildOptions?.signal
    const maxConcurrent = buildOptions?.maxConcurrent || availableParallelism()
    const variables = buildOptions?.variables
    const limit = pLimit(maxConcurrent)
    const executing = new Set()
    const results = []
    let buildError = null

    try {
      // Phase 3: The Render Engine
      for await (const result of _generatePages(pagesToRender, buildId, variables, buildOptions)) {
        if (signal?.aborted) {
          throw signal.reason
        }
        if (executing.size >= limit.concurrency) {
          await Promise.race(executing)
        }
        const task = limit(async () => {
          if (signal?.aborted) {
            throw signal.reason
          }
          // Note: additionalPages from onAfterPageRender are now ignored/warned if added via addRenderQueue
          await hooks.triggerAggregate('onAfterPageRender', {
            result,
            session: result.session,
            app
          })

          const pagePath = result.path.pathname
          const targetMeta = newManifest.physical[pagePath] || newManifest.virtual[pagePath]
          if (targetMeta) {
            if (result.injectedAssets) {
              targetMeta.injectedAssets = result.injectedAssets
            }
            if (result.runtimeChunk !== undefined) {
              targetMeta.runtimeChunk = result.runtimeChunk
            }
            if (result.pageScript) {
              targetMeta.pageScript = result.pageScript
            }
            if (result.pageScriptHash) {
              targetMeta.pageScriptHash = result.pageScriptHash
            }
            if (result.pageStyle) {
              targetMeta.pageStyle = result.pageStyle
            }
            if (result.pageStyleHash) {
              targetMeta.pageStyleHash = result.pageStyleHash
            }
            if (result.componentHashes) {
              targetMeta.componentHashes = result.componentHashes
            }
          }

          const items = [result]
          const finalResults = []
          for (const item of items) {
            if (typeof buildCallback === 'function') {
              const transformed = await buildCallback(item)
              if (transformed) {
                finalResults.push(transformed)
              }
            } else {
              finalResults.push(item)
            }
          }
          return finalResults
        })
        executing.add(task)
        task.then((callbackResults) => {
          if (callbackResults?.length) {
            results.push(...callbackResults)
          } executing.delete(task)
        })
          .catch((err) => {
            executing.delete(task); handleError({
              level: 'ERR',
              message: err.message,
              error: err
            })
          })
      }
      await Promise.all(executing)

      // Combine with skipped pages
      for (const skipped of skippedPages) {
        if (typeof buildCallback === 'function') {
          const transformed = await buildCallback(skipped)
          if (transformed) {
            results.push(transformed)
          }
        } else {
          results.push(skipped)
        }
      }

      // Write updated manifest atomically
      try {
        await mkdir(cacheDir, { recursive: true })
        newManifest.components = globalScriptResult?.manifest || {}
        const tempManifestPath = `${manifestPath}.tmp`
        await writeFile(tempManifestPath, JSON.stringify(newManifest, null, 2))
        await rename(tempManifestPath, manifestPath)
      } catch (e) {
        handleError({
          level: 'WARN',
          message: `Failed to write manifest: ${e.message}`
        })
      }

      return results
    } catch (error) {
      await Promise.allSettled(executing)
      if (error.name === 'AbortError') {
        handleError({
          level: 'WARN',
          message: 'Build cancelled by user.'
        })
      }
      buildError = error instanceof Error ? error : new CoraliteError(`Build failed: ${error.message}`, { cause: error })
      throw buildError
    } finally {
      const duration = performance.now() - startTime
      await hooks.trigger('onAfterBuild', {
        results,
        error: buildError,
        duration,
        app
      })
      renderQueues.delete(buildId)
      sealedQueues.delete(buildId)
      // Clean up local arrays to help GC
      pagesToRender.length = 0
      skippedPages.length = 0
    }
  }

  /**
   * Clears the internal script result cache and output files.
   * This is useful during development to ensure that changes to components
   * are reflected in the generated client-side script bundles.
   *
   * @param {boolean} [structural=false] - If true, disposes the esbuild context.
   */
  const clearCache = async (structural = false) => {
    globalScriptResult = null
    siteWideBundlePromise = null

    if (structural) {
      await scriptManager.disposeContext()
    }

    for (const key in outputFiles) {
      delete outputFiles[key]
    }
  }

  return {
    outputFiles,
    clearCache,
    createSession: _createSession,
    addRenderQueue,
    createComponentElement,
    build
  }
}
