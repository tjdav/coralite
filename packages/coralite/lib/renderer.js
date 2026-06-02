import { randomUUID } from 'node:crypto'
import { dirname, join, relative } from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import { availableParallelism } from 'node:os'
import pLimit from 'p-limit'
import {
  cleanKeys,
  cloneModuleInstance,
  replaceToken,
  cloneComponentInstance,
  findAndExtractScript,
  findAndExtractProperties,
  normalizeObjectFunctions,
  astTransformer
} from './utils.js'
import { getHtmlFile } from './html.js'
import { parseHTML } from './parse.js'
import {
  findHeadAndBody,
  injectExternalStyles,
  injectStyles,
  injectReadinessScript,
  injectImportMap,
  removeElements,
  resolvePageQueue
} from './render-helpers.js'
import { generateClientRuntime } from './client-runtime.js'
import { transformCss } from './style-transform.js'
import { transformNode } from './parser.js'
import {
  isCoraliteElement,
  isCoraliteCollectionItem,
  isCoraliteComment,
  isCoraliteTextNode
} from './type-helper.js'
import { createCoraliteElement, createCoraliteTextNode } from './dom.js'

/**
 * @import {
 *  CoraliteInstance,
 *  CoraliteConfig,
 *  CoraliteSession,
 *  CoraliteBuildResult,
 *  CoraliteBuildCallback,
 *  CoraliteBuildOptions,
 *  CoraliteOnError,
 *  CoraliteAnyNode,
 *  CoralitePage,
 *  CoraliteCollectionItem,
 *  ComponentElementOptions
 * } from '../types/index.js'
 */

/**
 * @import { InstanceContext } from '../types/script.js'
 * @import { ScriptManager } from './script-manager.js'
 */

/**
 * Factory for the rendering pipeline.
 *
 * @param {Object} dependencies
 * @param {CoraliteInstance} dependencies.app
 * @param {ScriptManager} dependencies.scriptManager
 * @param {Object} dependencies.source
 * @param {Function} dependencies.evaluate
 * @param {CoraliteOnError} dependencies.handleError
 * @param {Object} dependencies.hooks
 * @param {any} dependencies.options
 * @param {Function} dependencies.createExecutionError
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
  const outputFiles = {}

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

  const _replaceSlots = async (id, element, module, state, page, root, index, session, noHydration) => {
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
      } else {
        for (let i = slotNodes.length - 1; i > -1; i--) {
          const node = slotNodes[i]
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
              const componentElement = await createComponentElement({
                id: node.name,
                state: session.state[slotContextId],
                element: node,
                page,
                root,
                contextId: slotContextId,
                index,
                session,
                noHydration: childNoHydration
              }, false)

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

                      for (let j = 0; j < children.length; j++) {
                        children[j].parent = parent
                      }
                      parent.children.splice(idx, 1, ...children)
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

                  for (let j = 0; j < children.length; j++) {
                    children[j].parent = node
                  }

                  if (!node.attribs) {
                    node.attribs = {}
                  }

                  node.attribs['data-cid'] = slotContextId
                  session.componentTags.add(node.name)
                }
              }
            }
          }
        }
      }
      slot.element.children = slotNodes
      for (let j = 0; j < slotNodes.length; j++) {
        if (slotNodes[j]) {
          slotNodes[j].parent = slot.element
        }
      }
    }
  }

  const _processDependentComponents = async (componentIds, session, page, root, state = {}) => {
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
        const extractedScript = findAndExtractScript(module.script)
        if (extractedScript) {
          scriptObj.content = extractedScript.content
          scriptObj.lineOffset = (module.lineOffset || 0) + extractedScript.lineOffset
          extractedComponents = extractedScript.components || []
        }
        const extractedProperties = findAndExtractProperties(module.script)
        if (extractedProperties) {
          scriptObj.stateContent = extractedProperties.content
          scriptObj.stateLineOffset = (module.lineOffset || 0) + extractedProperties.lineOffset
        }
      }

      const declarativeComponents = (module.customElements || []).map(el => el.name)
      const nestedComponents = [...new Set([...declarativeComponents, ...extractedComponents])]
      scriptObj.components = nestedComponents

      const extractTokens = (nodes) => nodes?.flatMap(n => n.tokens?.map(t => t.name) || []) || []
      const allTokens = new Set([...extractTokens(module.values?.attributes), ...extractTokens(module.values?.textNodes)])
      for (const token of allTokens) {
        if (defaultValues[token] === undefined && scriptResult[token] !== undefined) {
          defaultValues[token] = scriptResult[token]
        }
      }
      templateValues?.refs?.forEach(ref => {
        const refKey = `ref_${ref.name}`
        defaultValues[refKey] = ''
        scriptObj.state[refKey] = ''
      })
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
        await _processDependentComponents(nestedComponents, session, page, root, inheritedState)
      }
    }
  }

  /**
   * Creates and initializes a component element from its definition and state.
   *
   * @param {ComponentElementOptions} options - Configuration and context for the component instance.
   * @param {boolean} [head=true] - Whether this component is being processed as a top-level head element.
   * @returns {Promise<CoraliteAnyNode | CoraliteAnyNode[] | void>} The rendered AST node(s) for the component.
   */
  const createComponentElement = async ({ id, state = {}, element, page, root, contextId, index, session, noHydration }, head = true) => {
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
    const mappedComponentContext = await hooks.trigger('onBeforeComponentRender', {
      state: componentState,
      componentId: module.id,
      instanceId,
      refs: module.values.refs,
      textNodes: module.values.textNodes,
      attributes: module.values.attributes,
      page,
      element,
      session
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
          app,
          noHydration
        }
        const cachedBoundPlugins = await hooks.bind(source.plugins, pluginContext)
        for (const key in cachedBoundPlugins) {
          const plugin = cachedBoundPlugins[key]
          if (plugin !== null && typeof plugin === 'object') {
            Object.assign(evaluationState, plugin)
          }
        }
        scriptResult = await evaluate({
          module,
          element,
          state: evaluationState,
          page,
          root: element || root,
          contextId,
          session,
          noHydration
        })
      } catch (error) {
        throw createExecutionError(error, module, moduleComponent, page, contextId)
      }

      if (scriptResult && scriptResult.__script__ != null) {
        const extractedScript = findAndExtractScript(module.script)
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
        module.values.attributes.forEach(item => item.tokens.forEach(t => {
          componentTokens[t.name] = true
        }))
        module.values.textNodes.forEach(item => item.tokens.forEach(t => {
          componentTokens[t.name] = true
        }))

        const componentDefaultValues = scriptResult.__script__.defaultValues || {}
        if (componentState) {
          for (const token of Object.keys(componentTokens)) {
            if (componentDefaultValues[token] === undefined && componentState[token] !== undefined) {
              componentDefaultValues[token] = componentState[token]
            }
          }
        }

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
          await _processDependentComponents(mergedComponents, session, page, root, inheritedState)
        }

        if (!scriptResult.__script__.state) {
          scriptResult.__script__.state = {}
        }
        if (!noHydration) {
          session.scripts.add(page.file.pathname, {
            id: contextId,
            componentId: module.id,
            page,
            state: scriptResult.__script__.state
          })
        }
        delete scriptResult.__script__
      }
      componentState = Object.assign(componentState, scriptResult)
    }

    session.state[contextId] = componentState

    module.values.attributes.forEach(item => item.tokens.forEach(token => {
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
    }))

    module.values.textNodes.forEach(item => item.tokens.forEach(token => {
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
    }))

    const customElements = module.customElements
    customElements.forEach(customElement => {
      if (customElement.children && customElement.children.length && !customElement.slots.length) {
        customElement.children.forEach(node => {
          const slotElement = {
            name: 'default',
            node
          }
          if (isCoraliteElement(node) && node.attribs.slot) {
            slotElement.name = node.attribs.slot
          }
          customElement.slots.push(slotElement)
        })
      }
    })

    const createComponentTasks = []
    customElements.forEach(customElement => {
      if (customElement.parent && 'slots' in customElement.parent) {
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
        noHydration: childNoHydration
      }, false).then(childComponentElement => ({
        childComponentElement,
        customElement,
        childContextId,
        noHydration: childNoHydration
      })))
    })

    const results = await Promise.all(createComponentTasks)
    results.forEach(({ childComponentElement, customElement, childContextId, noHydration: childNoHydration }) => {
      if (childComponentElement && typeof childComponentElement === 'object') {
        if (childNoHydration) {
          const parent = customElement.parent
          if (parent && parent.children) {
            const idx = parent.children.indexOf(customElement)
            if (idx !== -1) {
              // @ts-ignore
              const children = Array.isArray(childComponentElement) ? childComponentElement : childComponentElement.children
              children.forEach(c => {
                c.parent = parent
              })
              parent.children.splice(idx, 1, ...children)
            }
          }
        } else {
          // @ts-ignore
          const children = Array.isArray(childComponentElement) ? childComponentElement : childComponentElement.children
          customElement.children = children
          customElement.children.forEach(c => {
            c.parent = customElement
          })
          if (!customElement.attribs) {
            customElement.attribs = {}
          }
          customElement.attribs['data-cid'] = childContextId
          session.componentTags.add(customElement.name)
        }
      }
    })

    await _replaceSlots(id, element, module, componentState, page, root, index, session, noHydration)

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
                node.children.forEach(c => {
                  c.parent = parent
                })
                parent.children.splice(idx, 1, ...node.children)
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
      session
    })
    return mappedAfterContext.result
  }

  const _processCustomElementsInPage = async (mappedComponent, originalDocument, state, mappedSessionObject, pageContext) => {
    const customElementsList = mappedComponent.customElements || []
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
      const componentElement = await createComponentElement({
        id: customElement.name,
        state: mappedSessionObject.state[contextId],
        element: customElement,
        page: pageContext || originalDocument.page,
        root: mappedComponent.root,
        contextId,
        index: i,
        session: mappedSessionObject,
        noHydration
      })

      if (componentElement) {
        if (noHydration) {
          const parent = customElement.parent
          if (parent && parent.children) {
            const elementIndex = parent.children.indexOf(customElement)
            if (elementIndex !== -1) {
              // @ts-ignore
              const children = Array.isArray(componentElement) ? componentElement : componentElement.children
              children.forEach(c => {
                c.parent = parent
              })
              parent.children.splice(elementIndex, 1, ...children)
            }
          }
        } else {
          // @ts-ignore
          const children = Array.isArray(componentElement) ? componentElement : componentElement.children
          customElement.children = children
          customElement.children.forEach(c => {
            c.parent = customElement
          })
          if (!customElement.attribs) {
            customElement.attribs = {}
          }
          customElement.attribs['data-cid'] = contextId
          mappedSessionObject.componentTags.add(customElement.name)
        }
      }
    }
  }

  const _generatePages = async function* (path, state = {}) {
    const isProduction = normalizedOptions.mode === 'production'
    if (path) {
      const paths = Array.isArray(path) ? path : [path]
      for (const p of paths) {
        // @ts-ignore
        if (!app.pages.getItem(p)) {
          try {
            // @ts-ignore
            await app.pages.setItem(p)
          } catch (e) {
          }
        }
      }
    }

    // @ts-ignore
    const queue = resolvePageQueue(app.pages, path)
    const buildId = randomUUID()
    renderQueues.set(buildId, queue)
    const scriptResultCache = new Map()

    try {
      const activeQueue = renderQueues.get(buildId)
      for (let q = 0; q < activeQueue.length; q++) {
        const pageItem = activeQueue[q]
        const startTime = performance.now()
        const originalDocument = pageItem.result
        let component
        let pageContext = originalDocument.page

        if (!originalDocument.root) {
          let content = pageItem.content
          if (content === undefined) {
            try {
              content = await getHtmlFile(pageItem.path.pathname)
            } catch (e) {
              content = pageItem.content !== undefined ? pageItem.content : (()=>{
                throw e
              })()
            }
          }
          pageItem.content = content
          const elements = parseHTML(content, normalizedOptions.ignoreByAttribute, normalizedOptions.skipRenderByAttribute, handleError)
          pageContext = {
            ...originalDocument.page,
            meta: { ...originalDocument.page.meta }
          }
          const pageState = {
            ...originalDocument.state,
            page: pageContext
          }
          const mappedContext = await hooks.trigger('onPageSet', {
            elements,
            state: pageState,
            page: pageContext,
            data: pageItem
          })
          // @ts-ignore
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
        // @ts-ignore
        session.mode = normalizedOptions.mode
        const mappedSession = await hooks.trigger('onBeforePageRender', {
          component,
          state,
          page: pageContext,
          session
        })
        const mappedComponent = mappedSession.component
        const mappedSessionObject = mappedSession.session
        state = mappedSession.state
        // @ts-ignore
        mappedSessionObject.mode = normalizedOptions.mode
        removeElements(mappedComponent.tempElements, false)
        await _processCustomElementsInPage(mappedComponent, originalDocument, state, mappedSessionObject, pageContext)
        const { head: headElement, body: bodyElement } = findHeadAndBody(mappedComponent.root)

        if (normalizedOptions.externalStyles && normalizedOptions.externalStyles.length > 0) {
          injectExternalStyles(mappedComponent.root, headElement, normalizedOptions.externalStyles)
        }
        if (mappedSessionObject.styles.size > 0) {
          injectStyles(mappedComponent.root, headElement, mappedSessionObject.styles)
        }
        if (mappedSessionObject.componentTags.size > 0) {
          const targetElement = headElement || bodyElement || mappedComponent.root
          const layoutStyleElement = createCoraliteElement({
            type: 'tag',
            name: 'style',
            parent: targetElement,
            attribs: { id: 'coralite-components' },
            children: []
          })
          const selectors = Array.from(mappedSessionObject.componentTags)
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
          const componentIds = new Set()
          for (const key in scripts) {
            const script = scripts[key]
            componentIds.add(script.componentId)
            instances[script.id] = {
              instanceId: script.id,
              componentId: script.componentId,
              page: script.page,
              state: script.state
            }
          }
          const cacheKey = Array.from(componentIds).sort().join(',')
          let scriptResult
          if (scriptResultCache.has(cacheKey)) {
            scriptResult = scriptResultCache.get(cacheKey)
          } else {
            /** @type {Object.<string, InstanceContext>} */
            const normalizedInstances = {}

            for (const [id, instance] of Object.entries(instances)) {
              normalizedInstances[id] = {
                ...instance,
                state: normalizeObjectFunctions(instance.state, astTransformer)
              }
            }

            scriptResult = await scriptManager.compileAllInstances(normalizedInstances, normalizedOptions.mode)
            scriptResultCache.set(cacheKey, scriptResult)
            Object.assign(outputFiles, scriptResult.outputFiles)
          }
          if (!scriptResult.manifest['chunk-shared']) {
            handleError({
              level: 'ERR',
              message: 'MANIFEST MISSING chunk-shared!',
              error: new Error(JSON.stringify(scriptResult.manifest))
            })
          }
          injectReadinessScript(mappedComponent.root, headElement, true)
          injectImportMap(mappedComponent.root, headElement, scriptResult.importMap)
          const chunkManifest = { ...scriptResult.manifest }
          delete chunkManifest['chunk-shared']
          const base = normalizedOptions.baseURL.endsWith('/') ? normalizedOptions.baseURL : normalizedOptions.baseURL + '/'
          const scriptContent = generateClientRuntime({
            base,
            sharedChunkPath: scriptResult.manifest['chunk-shared'],
            chunkManifest
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

  // 3. The Public/Exposed Methods
  /**
   * Adds a page or a collection item to the current render queue.
   *
   * @param {string | CoraliteCollectionItem} value - The ID of the page or the collection item to add.
   * @param {string} buildId - The unique identifier for the current build session.
   * @throws {Error} If the buildId is missing or invalid, or if the page ID is not found.
   * @returns {Promise<void>}
   */
  const addRenderQueue = async (value, buildId) => {
    if (!buildId) {
      throw new Error('addRenderQueue requires a buildId')
    }
    const queue = renderQueues.get(buildId)
    if (!queue) {
      throw new Error(`addRenderQueue - buildId not found: "${buildId}"`)
    }
    if (typeof value === 'string') {
      // @ts-ignore
      const component = app.pages.getItem(value)
      if (!component) {
        throw new Error(`addRenderQueue - unexpected page ID: "${value}"`)
      }
      queue.push(component)
    } else if (isCoraliteCollectionItem(value)) {
      // @ts-ignore
      queue.push(await app.pages.setItem(value))
    }
  }

  /**
   * Compiles and renders specified pages.
   *
   * @overload
   * @param {CoraliteBuildCallback} callback - Optional callback executed for each rendered page.
   * @returns {Promise<CoraliteBuildResult[]>}
   *
   * @overload
   * @param {string|string[]} path - The path(s) to build.
   * @param {CoraliteBuildCallback} [callback] - Optional callback executed for each rendered page.
   * @returns {Promise<CoraliteBuildResult[]>}
   *
   * @overload
   * @param {string|string[]} path - The path(s) to build.
   * @param {CoraliteBuildOptions} options - Build options.
   * @param {CoraliteBuildCallback} [callback] - Optional callback executed for each rendered page.
   * @returns {Promise<CoraliteBuildResult[]>}
   *
   * @param {string | string[] | CoraliteBuildCallback} [pathOrOptions] - The path(s) to build, or a callback if no path is provided.
   * @param {CoraliteBuildOptions | CoraliteBuildCallback} [optionsOrCallback] - Build options or a callback.
   * @param {CoraliteBuildCallback} [callback] - Optional callback executed for each rendered page.
   * @returns {Promise<CoraliteBuildResult[]>} A promise resolving to an array of build results.
   */
  const build = async (pathOrOptions, optionsOrCallback, callback) => {
    const startTime = performance.now()
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
    const mappedBeforeBuild = await hooks.trigger('onBeforeBuild', {
      path: buildPath,
      options: buildOptions
    })
    buildPath = mappedBeforeBuild.path
    buildOptions = mappedBeforeBuild.options

    const signal = buildOptions?.signal
    const maxConcurrent = buildOptions?.maxConcurrent || availableParallelism()
    const variables = buildOptions?.variables
    const limit = pLimit(maxConcurrent)
    const executing = new Set()
    const results = []
    let buildError = null

    try {
      for await (const result of _generatePages(buildPath, variables)) {
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
          const additionalPages = await hooks.triggerAggregate('onAfterPageRender', {
            result,
            session: result.session
          })
          const items = [result]
          for (const newPage of additionalPages) {
            if (newPage && newPage.path && newPage.content) {
              if (typeof newPage.path === 'string') {
                newPage.path = {
                  pathname: newPage.path,
                  filename: join(newPage.path),
                  dirname: dirname(newPage.path)
                }
              }
              items.push(newPage)
            }
          }
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
      return results
    } catch (error) {
      await Promise.allSettled(executing)
      if (error.name === 'AbortError') {
        handleError({
          level: 'WARN',
          message: 'Build cancelled by user.'
        })
      }
      buildError = error instanceof Error ? error : new Error(`Build failed: ${error.message}`, { cause: error })
      throw buildError
    } finally {
      const duration = performance.now() - startTime
      await hooks.trigger('onAfterBuild', {
        results,
        error: buildError,
        duration
      })
    }
  }

  // 4. Return what the orchestrator needs to attach to `app`
  return {
    outputFiles,
    addRenderQueue,
    createComponentElement,
    build
  }
}
