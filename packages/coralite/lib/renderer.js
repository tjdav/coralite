import { randomUUID } from 'node:crypto'
import { dirname, join } from 'node:path'
import { availableParallelism } from 'node:os'
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises'
import pLimit from 'p-limit'
import {
  cleanKeys,
  cloneModuleInstance,
  cloneComponentInstance,
  normalizeObjectFunctions
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
  injectExternalStyleLinks,
  injectStyles,
  injectReadinessScript,
  injectImportMap,
  removeElements,
  resolvePageQueue
} from './utils/server/render.js'
import { generateClientRuntime } from './utils/client/runtime.js'
import { transformCss } from './utils/server/style.js'
import { transformNode } from './parser.js'
import { CoraliteError } from './utils/errors.js'
import { checkFileChange } from './utils/server/manifest.js'
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
  let globalScriptResult = null
  let siteWideBundlePromise = null

  /**
   * Creates a new rendering session.
   * @param {string} [buildId] - Unique identifier for the build
   * @returns {CoraliteSession}
   */
  const _createSession = (buildId) => ({
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
    source: {
      currentSourceContextId: '',
      contextInstances: {}
    }
  })

  const _replaceSlots = async ({ id, element, module, state, page, root, index, session, noHydration }) => {
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
          }
          slotChildren[slotName].push(elementSlotContent.node)
        }
      }
    }

    const slotTasks = []

    for (let i = 0; i < slotNames.length; i++) {
      const slotName = slotNames[i]
      let slotNodes = slotChildren[slotName]
      const slot = slots[slotName]

      if (!slot.element || !slot.element.parent || !slot.element.parent.children) {
        continue
      }
      const emptySlot = slotNodes.filter(node => node.type !== 'text' || (node.data && node.data.trim().length > 0))
      if (!emptySlot.length) {
        slotNodes = slot.element.children || []
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
              const attribValues = cleanKeys(node.attribs)
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
        // @ts-ignore
        componentState = Object.assign(componentState, element.attribs)
      }
      componentState = cleanKeys(componentState)
    }

    const module = cloneModuleInstance(moduleComponent.result)

    if (module.values && module.values.refs) {
      for (let i = 0; i < module.values.refs.length; i++) {
        const ref = module.values.refs[i]
        const uniqueRefValue = `${instanceId}__${ref.name}`

        if (ref.element && ref.element.attribs) {
          ref.element.attribs.ref = uniqueRefValue
        }

        componentState[`ref_${ref.name}`] = uniqueRefValue
      }
    }

    const mappedComponentContext = await hooks.trigger('onBeforeComponentRender', {
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
    componentState = mappedComponentContext.state
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
      const parent = customElement.parent

      if (parent && 'slots' in parent && Array.isArray(parent.slots)) {
        return
      }

      const childContextId = session.generateId(customElement.name)
      const currentProperties = session.state[childContextId] || {}

      let childState = { ...state }
      if (typeof customElement.attribs === 'object') {
        const attribValues = cleanKeys(customElement.attribs)
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
          session.componentTags.add(customElement.name)
        }
      }
    }

    await _replaceSlots({
      id,
      element,
      module,
      state: componentState,
      page,
      root,
      index,
      session,
      noHydration
    })

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
      const contextId = mappedSessionObject.generateId(customElement.name)
      const currentProperties = mappedSessionObject.state[contextId] || {}
      mappedSessionObject.state[contextId] = typeof customElement.attribs === 'object'
        ? {
          ...currentProperties,
          ...state,
          ...mappedComponent.state,
          ...customElement.attribs
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
          mappedSessionObject.componentTags.add(customElement.name)
        }
      }
    }
  }

  const _generatePages = async function* (activeQueue, buildId, state = {}) {
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

        if (normalizedOptions.externalStyles && normalizedOptions.externalStyles.length > 0) {
          injectExternalStyles(mappedComponent.root, headElement, normalizedOptions.externalStyles)
        }

        if (mappedSessionObject.styles.size > 0) {
          if (isProduction && globalScriptResult && globalScriptResult.manifest) {
            const cssPaths = []
            const remainingStyles = new Map()

            for (const [selector, css] of mappedSessionObject.styles) {
              const entry = globalScriptResult.manifest[selector]
              if (entry && entry.css) {
                cssPaths.push(entry.css)
              } else {
                remainingStyles.set(selector, css)
              }
            }

            if (cssPaths.length > 0) {
              const base = normalizedOptions.baseURL.endsWith('/') ? normalizedOptions.baseURL : normalizedOptions.baseURL + '/'
              injectExternalStyleLinks(mappedComponent.root, headElement, cssPaths, base)
            }

            if (remainingStyles.size > 0) {
              injectStyles(mappedComponent.root, headElement, remainingStyles)
            }
          } else {
            injectStyles(mappedComponent.root, headElement, mappedSessionObject.styles)
          }
        }

        if (componentsToInclude.size > 0) {
          const targetElement = headElement || bodyElement || mappedComponent.root
          const layoutStyleElement = createCoraliteElement({
            type: 'tag',
            name: 'style',
            parent: targetElement,
            attribs: { id: 'coralite-components' },
            children: []
          })

          const selectors = Array.from(componentsToInclude)

          selectors.push('c-token')

          layoutStyleElement.children.push(createCoraliteTextNode({
            type: 'text',
            data: `${selectors.join(', ')} { display: contents; }`,
            parent: layoutStyleElement
          }))

          if (targetElement === headElement || targetElement === bodyElement) {
            targetElement.children.push(layoutStyleElement)
          } else {
            targetElement.children.unshift(layoutStyleElement)
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
          }

          // Filter manifest to only include components used on this page (already collected in componentsToInclude)
          const chunkManifest = {}

          for (const tag of componentsToInclude) {
            if (scriptResult.manifest[tag]) {
              chunkManifest[tag] = scriptResult.manifest[tag]
            }
          }

          // Ensure all components registered in the build are available in the manifest
          // even if they aren't explicitly used on this page, if they might be used imperatively.
          // This fixes the issue where imperative components aren't loaded if they aren't in the page manifest.
          for (const tag in scriptResult.manifest) {
            if (tag !== 'coralite-runtime' && !chunkManifest[tag]) {
              chunkManifest[tag] = scriptResult.manifest[tag]
            }
          }

          injectReadinessScript(mappedComponent.root, headElement, true)
          injectImportMap(mappedComponent.root, headElement, scriptResult.importMap)
          const base = normalizedOptions.baseURL.endsWith('/') ? normalizedOptions.baseURL : normalizedOptions.baseURL + '/'
          const scriptContent = generateClientRuntime({
            base,
            sharedChunkPath: scriptResult.manifest['coralite-runtime'],
            chunkManifest,
            declarativeTags: Array.from(declarativeTags)
          })
          const hydrationData = {}

          for (const [id, instance] of Object.entries(instances)) {
            if (instance.state && Object.keys(instance.state).length > 0) {
              hydrationData[id] = normalizeObjectFunctions(instance.state, astTransformer)
            }
          }

          const hydrationScriptElement = createCoraliteElement({
            type: 'tag',
            name: 'script',
            parent: bodyElement,
            attribs: {
              id: '__CORALITE_HYDRATION__',
              type: 'application/json'
            },
            children: []
          })

          hydrationScriptElement.children.push(createCoraliteTextNode({
            type: 'text',
            data: JSON.stringify(hydrationData),
            parent: hydrationScriptElement
          }))

          bodyElement.children.push(hydrationScriptElement)
          const scriptElement = createCoraliteElement({
            type: 'tag',
            name: 'script',
            parent: bodyElement,
            attribs: { type: 'module' },
            children: []
          })

          scriptElement.children.push(createCoraliteTextNode({
            type: 'text',
            data: scriptContent,
            parent: scriptElement
          }))
          bodyElement.children.push(scriptElement)
        }

        removeElements(mappedComponent.skipRenderElements, true)

        if (!mappedSessionObject.scripts.content[mappedComponent.path.pathname]) {
          injectReadinessScript(mappedComponent.root, headElement, false)
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

    // Phase 1: Discovery & Pre-Render Staging
    if (normalizedOptions.mode === 'production') {
      const allComponentIds = app.components.list.map(c => c.result.id)
      globalScriptResult = await scriptManager.compileAllInstances(allComponentIds, normalizedOptions.mode)
      Object.assign(outputFiles, globalScriptResult.outputFiles)
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
    const projectRoot = app.options.projectRoot || process.cwd()
    const cacheDir = join(projectRoot, '.coralite')
    const manifestPath = join(cacheDir, 'manifest.json')
    let manifest = {
      physical: {},
      virtual: {},
      dependencies: {}
    }

    try {
      const content = await readFile(manifestPath, 'utf8')
      manifest = JSON.parse(content)
    } catch (e) {
      // Manifest missing (cold start) or corrupt, use default
      if (e.code !== 'ENOENT') {
        handleError({
          level: 'WARN',
          message: `Could not parse manifest at ${manifestPath}: ${e.message}. Starting with fresh manifest.`
        })
      }
    }

    const pagesToRender = []
    const skippedPages = []
    const newManifest = {
      physical: {},
      virtual: {},
      dependencies: {}
    }

    // Check components first for dependency cascading
    const componentChanges = new Map()
    const allComponents = app.components.list
    for (const component of allComponents) {
      const { changed, metadata } = await checkFileChange(component.path.pathname, manifest.physical[component.path.pathname])
      newManifest.physical[component.path.pathname] = metadata
      if (changed) {
        componentChanges.set(component.result.id, true)
        // Force re-parse
        await app.components.updateItem(component.path.pathname)
      }
    }

    const pageCustomElements = {
      ...manifest.dependencies,
      ...app._dependencyGraph.pageCustomElements
    }

    for (const pageItem of queue) {
      let shouldRebuild = false

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

      if (pageItem.virtual) {
        if (pageItem.volatile || !manifest.virtual || !manifest.virtual[pageItem.path.pathname] || String(manifest.virtual[pageItem.path.pathname].cacheKey) !== String(pageItem.cacheKey) || normalizedOptions.mode === 'development') {
          shouldRebuild = true
        } else {
          shouldRebuild = false
        }
        if (!shouldRebuild) {
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
          if (!newManifest.virtual) {
            newManifest.virtual = {}
          }

          newManifest.virtual[pageItem.path.pathname] = { cacheKey: pageItem.cacheKey }
        } else {
          pagesToRender.push(pageItem)
          if (!newManifest.virtual) {
            newManifest.virtual = {}
          }
          newManifest.virtual[pageItem.path.pathname] = { cacheKey: pageItem.cacheKey }
        }
      } else {
        const { changed, metadata } = await checkFileChange(pageItem.path.pathname, manifest.physical[pageItem.path.pathname])
        newManifest.physical[pageItem.path.pathname] = metadata
        if (changed || shouldRebuild || normalizedOptions.mode === 'development') {
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

          skippedPages.push(skippedResult)
        }
      }
    }

    // Update dependency graph in manifest
    const { pageCustomElements: livePageCustomElements } = app._dependencyGraph

    for (const [id, pages] of Object.entries(livePageCustomElements)) {
      newManifest.dependencies[id] = Array.from(pages)
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
      for await (const result of _generatePages(pagesToRender, buildId, variables)) {
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
      app._clearDependencies()
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
