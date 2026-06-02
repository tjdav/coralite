import {
  cleanKeys,
  cloneModuleInstance,
  replaceToken,
  cloneComponentInstance,
  findAndExtractScript,
  findAndExtractProperties,
  mergePluginState,
  normalizeObjectFunctions,
  astTransformer,
  createReadOnlyProxy
} from './utils.js'
import { getHtmlFile, getHtmlFiles, discoverHtmlFiles } from './html.js'
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
import { parseHTML, parseModule, createElement, createTextNode } from './parse.js'
import { transformCss } from './style-transform.js'
import { ScriptManager } from './script-manager.js'
import { metadataPlugin, refsPlugin, staticAssetPlugin, testingPlugin } from '#plugins'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, normalize, relative, resolve } from 'node:path'
import {
  isCoraliteElement,
  isCoraliteCollectionItem,
  isCoraliteComment,
  isCoraliteTextNode
} from './type-helper.js'
import { handleError, createExecutionError } from './errors.js'
import { pathToFileURL } from 'node:url'
import { availableParallelism } from 'node:os'
import pLimit from 'p-limit'
import { createCoraliteElement, createCoraliteTextNode } from './dom.js'
import CoraliteCollection from './collection.js'
import { randomUUID } from 'node:crypto'

// Modularized helper imports
import { transformNode, processTokenValue } from './parser.js'
import { evaluate } from './compiler.js'
import {
  addPluginHook,
  triggerPluginAggregateHook,
  triggerPluginHook,
  bindPlugins
} from './hooks.js'

/**
 * @import {
 *  CoraliteElement,
 *  CoraliteAnyNode,
 *  CoraliteModule,
 *  CoraliteResult,
 *  CoraliteModuleDefinitions,
 *  CoraliteComponent,
 *  CoraliteCollectionItem,
 *  CoraliteComponentRoot,
 *  CoraliteCollectionEventSet,
 *  CoraliteComponentResult,
 *  InstanceContext,
 *  CoraliteConfig,
 *  CoraliteFilePath,
 *  CoralitePage,
 *  CoraliteSession,
 *  CoralitePluginContext,
 *  Attribute,
 * CoraliteInstance
 * } from '../types/index.js'
 */

/**
 * @import {DomSerializerOptions} from 'dom-serializer'
 */

/**
 * Factory function to create and initialize a Coralite instance.
 *
 * @param {CoraliteConfig} options
 * @returns {Promise<CoraliteInstance>} A fully initialized Coralite instance.
 * @example
 * const app = await createCoralite({
 *   components: './path/to/components',
 *   pages: './path/to/pages',
 *   mode: 'development',
 *   plugins: [myPlugin]
 * });
 */
export async function createCoralite ({
  components,
  pages,
  plugins: userPlugins,
  assets,
  externalStyles,
  baseURL = '/',
  ignoreByAttribute,
  skipRenderByAttribute,
  onError,
  mode = 'production',
  output
}) {
  // Validate required parameters
  if (!components || typeof components !== 'string') {
    throw new Error('createCoralite requires "components" option to be defined as a string')
  }

  if (!pages || typeof pages !== 'string') {
    throw new Error('createCoralite requires "pages" option to be defined as a string')
  }

  const path = {
    components: normalize(components),
    pages: normalize(pages)
  }

  const normalizedOptions = {
    components,
    pages,
    plugins: [...(userPlugins || [])],
    assets,
    externalStyles,
    baseURL,
    ignoreByAttribute,
    skipRenderByAttribute,
    mode,
    path,
    output: output ? normalize(output) : undefined
  }

  /** @type {CoraliteInstance} */
  const app = {
    options: normalizedOptions
  }

  // State
  const renderQueues = new Map()
  const plugins = {
    components: [],
    hooks: {
      onPageSet: [],
      onPageUpdate: [],
      onPageDelete: [],
      onComponentSet: [],
      onComponentUpdate: [],
      onComponentDelete: [],
      onBeforePageRender: [],
      onAfterPageRender: [],
      onBeforeComponentRender: [],
      onAfterComponentRender: [],
      onBeforeBuild: [],
      onAfterBuild: []
    }
  }
  const scriptManager = new ScriptManager(normalizedOptions)
  const serverGlobalContext = { app }
  const outputFiles = {}

  // Development only state
  const pageCustomElements = {}
  const childCustomElements = {}

  // --- Internal Orchestrators ---

  const _handleErrorLocal = (data) => handleError({
    onErrorCallback: onError,
    data
  })

  const source = {
    utils: {
      parseHTML: (string, ignore = normalizedOptions.ignoreByAttribute, skip = normalizedOptions.skipRenderByAttribute) => parseHTML(string, ignore, skip, _handleErrorLocal),
      parseModule: (string, opts) => parseModule(string, {
        ignoreByAttribute: normalizedOptions.ignoreByAttribute,
        skipRenderByAttribute: normalizedOptions.skipRenderByAttribute,
        onError: _handleErrorLocal,
        ...opts
      }),
      getHtmlFiles,
      getHtmlFile,
      createElement: (opts) => createElement({
        onError: _handleErrorLocal,
        ...opts
      }),
      createTextNode,
      transform: transformNode
    },
    plugins: {}
  }

  // Helper to register a component via its ID
  const getComponent = (id) => app.components.getItem(id)

  const _triggerPluginHookLocal = (name, initialData) => triggerPluginHook({
    app,
    hooks: plugins.hooks,
    serverGlobalContext,
    name,
    initialData
  })

  const _triggerPluginAggregateHookLocal = (name, contextData) => triggerPluginAggregateHook({
    app,
    hooks: plugins.hooks,
    serverGlobalContext,
    name,
    contextData
  })

  const _bindPluginsLocal = (phase2Functions, instanceContext) => bindPlugins({
    app,
    serverGlobalContext,
    phase2Functions,
    instanceContext
  })

  /**
   * This function defines a component for the Coralite framework.
   * @param {Object} options - Configuration options for the component
   * @param {CoralitePluginContext} context - The evaluation context
   * @returns {Promise<Object>}
   */
  const _defineComponent = async (options, context) => {
    const { attributes, data, getters, slots, script } = options
    const { state: initialState, module, root } = context

    if (attributes) {
      for (const [key, value] of Object.entries(attributes)) {
        if (value.type === Object || value.type === Array) {
          throw new Error(`Coralite Error: Component "${module.id}" defines attribute "${key}" as ${value.type.name}. Object and Array types are blocked in attributes. Use data() for complex data.`)
        }
      }
    }

    const state = Object.assign({}, initialState)
    const serializableAttributes = {}
    if (attributes) {
      for (const [key, schema] of Object.entries(attributes)) {
        serializableAttributes[key] = {
          type: schema.type.name || schema.type,
          default: schema.default
        }
      }
    }

    state.__script__ = {
      attributes: serializableAttributes,
      getters: getters || {},
      state: {},
      defaultValues: {},
      slots: slots || {}
    }

    if (attributes) {
      for (const [key, schema] of Object.entries(attributes)) {
        const typeName = schema.type.name || schema.type
        if (state[key] !== undefined) {
          const value = state[key]
          if (typeName === 'Number') {
            state[key] = Number(value)
          } else if (typeName === 'Boolean') {
            state[key] = value !== 'false' && value !== null && value !== ''
          } else if (typeName === 'String') {
            state[key] = String(value)
          }
        } else if (schema.default !== undefined) {
          state[key] = schema.default
        }
      }
    }

    if (typeof data === 'function') {
      const dataResult = await data({
        ...context,
        ...initialState
      })
      if (dataResult) {
        state.__script__.data = dataResult
        Object.assign(state, dataResult)
        Object.assign(state.__script__.state, dataResult)
      }
    }

    if (getters) {
      const roState = createReadOnlyProxy(state)
      for (const [key, getter] of Object.entries(getters)) {
        const result = getter(roState, { signal: new AbortController().signal })
        state[key] = (result && typeof result.then === 'function') ? await result : result
        if (state.__script__ && state.__script__.state) {
          state.__script__.state[key] = state[key]
        }
      }
    }

    if (slots) {
      for (const name in slots) {
        if (Object.prototype.hasOwnProperty.call(slots, name)) {
          const computedSlot = slots[name]
          const methodKey = `slots_method_${name}`
          state.__script__.defaultValues[methodKey] = computedSlot
          const slotContent = []
          const elementSlots = []

          if (root && 'slots' in root) {
            for (let j = 0; j < root.slots.length; j++) {
              const slot = root.slots[j]

              if (slot.name === name) {
                slotContent.push(slot.node)
              } else {
                elementSlots.push(slot)
              }
            }
          }

          let result = computedSlot(slotContent, state)
          if (result === undefined) {
            result = slotContent
          }
          if (result === null || result === '' || (Array.isArray(result) && result.length === 0)) {
            if (root && 'slots' in root) {
              root.slots = root.slots.filter(s => s.name !== name)
            }

            continue
          }

          if (typeof result === 'string') {
            const processedResult = await processTokenValue(result, {
              ...context,
              state,
              createComponentElement: app.createComponentElement,
              noHydration: context.noHydration
            })
            if (Array.isArray(processedResult)) {
              for (let j = 0; j < processedResult.length; j++) {
                elementSlots.push({
                  name,
                  node: processedResult[j]
                })
              }
            } else {
              elementSlots.push({
                name,
                node: {
                  type: 'text',
                  data: processedResult
                }
              })
            }
          } else if (Array.isArray(result)) {
            for (let index = 0; index < result.length; index++) {
              const node = result[index]
              if (isCoraliteElement(node) || isCoraliteTextNode(node) || isCoraliteComment(node)) {
                elementSlots.push({
                  name,
                  node
                })
              } else {
                throw new Error(`Unexpected slot value in "${module.path.pathname}"`)
              }
            }
          }

          if (root && 'slots' in root) {
            root.slots = elementSlots
          }
        }
      }
    }

    const hasScript = typeof script === 'function'
    const hasSlots = slots && Object.keys(slots).length > 0
    const hasGetters = getters && Object.keys(getters).length > 0
    const hasAttributes = attributes && Object.keys(attributes).length > 0
    const hasData = typeof data === 'function'

    if (hasScript || hasSlots || hasGetters || hasAttributes || hasData) {
      if (hasScript) {
        const scriptTextContent = script.toString().trim()
        const args = {}
        for (const key in state) {
          if (!Object.hasOwn(state, key)) {
            continue
          }
          if (scriptTextContent.includes(key) || key.startsWith('ref_')) {
            args[key] = state.__script__.defaultValues[key] !== undefined
              ? state.__script__.defaultValues[key]
              : state[key]
          }
        }
        Object.assign(state.__script__.state, args)
      }
    } else {
      delete state.__script__
    }

    return state
  }

  const _evaluateLocal = (options) => evaluate({
    ...options,
    app,
    source,
    bindPlugins: _bindPluginsLocal,
    defineComponent: _defineComponent,
    createExecutionError,
    getComponent
  })

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
              const componentElement = await app.createComponentElement({
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
                  if (parent && parent.children) {
                    const idx = parent.children.indexOf(node)
                    if (idx !== -1) {
                      for (let j = 0; j < componentElement.children.length; j++) {
                        componentElement.children[j].parent = parent
                      }
                      parent.children.splice(idx, 1, ...componentElement.children)
                    }
                  }
                } else {
                  node.children = componentElement.children
                  for (let j = 0; j < node.children.length; j++) {
                    node.children[j].parent = node
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
          scriptResult = await _evaluateLocal({
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
        moduleComponent.result._processedCss = await transformCss(rawCss, rootClasses, descendantClasses, _handleErrorLocal)
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
      if (element && element.attribs) {
        componentState = Object.assign(componentState, element.attribs)
      }
      componentState = cleanKeys(componentState)
    }

    const module = cloneModuleInstance(moduleComponent.result)
    const mappedComponentContext = await _triggerPluginHookLocal('onBeforeComponentRender', {
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
        moduleComponent.result._processedCss = await transformCss(rawCss, rootClasses, descendantClasses, _handleErrorLocal)
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
        const cachedBoundPlugins = await _bindPluginsLocal(source.plugins, pluginContext)
        for (const key in cachedBoundPlugins) {
          const plugin = cachedBoundPlugins[key]
          if (plugin !== null && typeof plugin === 'object') {
            Object.assign(evaluationState, plugin)
          }
        }
        scriptResult = await _evaluateLocal({
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
              childComponentElement.children.forEach(c => {
                c.parent = parent
              })
              parent.children.splice(idx, 1, ...childComponentElement.children)
            }
          }
        } else {
          customElement.children = childComponentElement.children
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

    const mappedAfterContext = await _triggerPluginHookLocal('onAfterComponentRender', {
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
      const componentElement = await app.createComponentElement({
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
              componentElement.children.forEach(c => {
                c.parent = parent
              })
              parent.children.splice(elementIndex, 1, ...componentElement.children)
            }
          }
        } else {
          customElement.children = componentElement.children
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
        if (!app.pages.getItem(p)) {
          try {
            await app.pages.setItem(p)
          } catch (e) {
          }
        }
      }
    }

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
          const elements = parseHTML(content, normalizedOptions.ignoreByAttribute, normalizedOptions.skipRenderByAttribute, _handleErrorLocal)
          pageContext = {
            ...originalDocument.page,
            meta: { ...originalDocument.page.meta }
          }
          const pageState = {
            ...originalDocument.state,
            page: pageContext
          }
          const mappedContext = await _triggerPluginHookLocal('onPageSet', {
            elements,
            state: pageState,
            page: pageContext,
            data: pageItem
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
        const mappedSession = await _triggerPluginHookLocal('onBeforePageRender', {
          component,
          state,
          page: pageContext,
          session
        })
        const mappedComponent = mappedSession.component
        const mappedSessionObject = mappedSession.session
        state = mappedSession.state
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
            _handleErrorLocal({
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

        yield {
          type: 'page',
          path: mappedComponent.path,
          content: rawHTML,
          duration: performance.now() - startTime,
          session
        }

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

  // --- Public API Population ---

  Object.assign(app, {
    outputFiles,
    createComponentElement,
    build: async (...args) => {
      const startTime = performance.now()
      let buildPath = args[0]
      let buildOptions
      let buildCallback

      if (typeof args[0] === 'function') {
        buildPath = null; buildCallback = args[0]
      } else if (typeof args[1] === 'function') {
        buildCallback = args[1]
      } else {
        buildOptions = args[1]; buildCallback = args[2]
      }

      if (!buildOptions) {
        buildOptions = {}
      }
      const mappedBeforeBuild = await _triggerPluginHookLocal('onBeforeBuild', {
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
            const additionalPages = await _triggerPluginAggregateHookLocal('onAfterPageRender', {
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
              executing.delete(task); _handleErrorLocal({
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
          _handleErrorLocal({
            level: 'WARN',
            message: 'Build cancelled by user.'
          })
        }
        buildError = error instanceof Error ? error : new Error(`Build failed: ${error.message}`, { cause: error })
        throw buildError
      } finally {
        const duration = performance.now() - startTime
        await _triggerPluginHookLocal('onAfterBuild', {
          results,
          error: buildError,
          duration
        })
      }
    },

    save: async (savePath, saveOptions = {}) => {
      const signal = saveOptions?.signal
      const createdDir = {}
      if (!app.options.output) {
        throw new Error('Coralite instance must be configured with an "output" option to use save()')
      }
      const outputDir = app.options.output
      const results = []
      await app.build(savePath, saveOptions, async (result) => {
        const relativeDir = relative(app.options.path.pages, result.path.dirname)
        const outDir = join(outputDir, relativeDir)
        const outFile = join(outDir, result.path.filename)
        if (!createdDir[outDir]) {
          await mkdir(outDir, { recursive: true }); createdDir[outDir] = true
        }
        await writeFile(outFile, result.content, { signal })
        results.push({
          path: outFile,
          duration: result.duration
        })
        return undefined
      })

      if (outputFiles) {
        const assetsDir = join(outputDir, 'assets', 'js')
        if (!createdDir[assetsDir]) {
          await mkdir(assetsDir, { recursive: true }); createdDir[assetsDir] = true
        }
        const assetWrites = Object.values(outputFiles).map(async (file) => {
          const outFile = join(assetsDir, file.hashedPath)
          const outDir = dirname(outFile)
          if (!createdDir[outDir]) {
            await mkdir(outDir, { recursive: true }); createdDir[outDir] = true
          }
          await writeFile(outFile, file.text, { signal })
          results.push({
            path: outFile,
            duration: 0
          })
        })
        await Promise.all(assetWrites)
      }
      return results
    },

    transform: transformNode,

    addRenderQueue: async (value, buildId) => {
      if (!buildId) {
        throw new Error('addRenderQueue requires a buildId')
      }
      const queue = renderQueues.get(buildId)
      if (!queue) {
        throw new Error(`addRenderQueue - buildId not found: "${buildId}"`)
      }
      if (typeof value === 'string') {
        const component = app.pages.getItem(value)
        if (!component) {
          throw new Error(`addRenderQueue - unexpected page ID: "${value}"`)
        }
        queue.push(component)
      } else if (isCoraliteCollectionItem(value)) {
        queue.push(await app.pages.setItem(value))
      }
    },

    _triggerPluginAggregateHook: _triggerPluginAggregateHookLocal,
    _triggerPluginHook: _triggerPluginHookLocal,
    getPagePathsUsingCustomElement: (targetPath) => {
      if (app.options.mode === 'production') {
        return []
      }
      if (targetPath.startsWith(app.options.path.components)) {
        targetPath = targetPath.substring(app.options.path.components.length + 1)
      }
      const item = app.components.getItem(targetPath)
      const results = []
      if (item) {
        const id = childCustomElements[item.result.id] || item.result.id
        const pce = pageCustomElements[id]
        if (pce) {
          pce.forEach(p => results.push(p))
        }
      }
      return results
    }
  })

  // --- Initialization (Merged from initialise) ---

  const _initialisePluginsLocal = async () => {
    const pluginsToInit = app.options.plugins
    for (const plugin of pluginsToInit) {
      if (plugin.server) {
        if (plugin.server.exports) {
          const phase2Obj = {}
          for (const prop in plugin.server.exports) {
            phase2Obj[prop] = typeof plugin.server.exports[prop] === 'function'
              // @ts-ignore
              ? await plugin.server.exports[prop](serverGlobalContext, plugin.server.config)
              : plugin.server.exports[prop]
          }
          source.plugins[plugin.name] = phase2Obj
          serverGlobalContext[plugin.name] = phase2Obj
        }
        if (plugin.server.components) {
          plugin.server.components.forEach(c => plugins.components.push(c))
        }
        const wrapHook = (hook) => (ctx) => hook(Object.assign({ config: plugin.server.config }, ctx))

        if (plugin.server.onPageSet) {
          addPluginHook(plugins.hooks, 'onPageSet', wrapHook(plugin.server.onPageSet))
        }
        if (plugin.server.onPageDelete) {
          addPluginHook(plugins.hooks, 'onPageDelete', wrapHook(plugin.server.onPageDelete))
        }
        if (plugin.server.onPageUpdate) {
          addPluginHook(plugins.hooks, 'onPageUpdate', wrapHook(plugin.server.onPageUpdate))
        }
        if (plugin.server.onComponentSet) {
          addPluginHook(plugins.hooks, 'onComponentSet', wrapHook(plugin.server.onComponentSet))
        }
        if (plugin.server.onComponentDelete) {
          addPluginHook(plugins.hooks, 'onComponentDelete', wrapHook(plugin.server.onComponentDelete))
        }
        if (plugin.server.onComponentUpdate) {
          addPluginHook(plugins.hooks, 'onComponentUpdate', wrapHook(plugin.server.onComponentUpdate))
        }
        if (plugin.server.onBeforePageRender) {
          addPluginHook(plugins.hooks, 'onBeforePageRender', wrapHook(plugin.server.onBeforePageRender))
        }
        if (plugin.server.onAfterPageRender) {
          addPluginHook(plugins.hooks, 'onAfterPageRender', wrapHook(plugin.server.onAfterPageRender))
        }
        if (plugin.server.onBeforeComponentRender) {
          addPluginHook(plugins.hooks, 'onBeforeComponentRender', wrapHook(plugin.server.onBeforeComponentRender))
        }
        if (plugin.server.onAfterComponentRender) {
          addPluginHook(plugins.hooks, 'onAfterComponentRender', wrapHook(plugin.server.onAfterComponentRender))
        }
        if (plugin.server.onBeforeBuild) {
          addPluginHook(plugins.hooks, 'onBeforeBuild', async (ctx) => {
            const res = await plugin.server.onBeforeBuild(Object.assign({ config: plugin.server.config }, ctx))
            if (res && typeof res === 'object') {
              Object.assign(serverGlobalContext, res)
            }
            return res
          })
        }
        if (plugin.server.onAfterBuild) {
          addPluginHook(plugins.hooks, 'onAfterBuild', wrapHook(plugin.server.onAfterBuild))
        }
      }
      if (plugin.client) {
        scriptManager.use(plugin.client)
      }
    }
  }

  // Pre-initialization: load core plugins
  if (app.options.mode === 'development') {
    app.options.plugins.unshift(testingPlugin)
  }
  app.options.plugins.unshift(refsPlugin, metadataPlugin)
  if (assets) {
    app.options.plugins.unshift(staticAssetPlugin(assets))
  }

  await _initialisePluginsLocal()

  app.components = await getHtmlFiles({
    path: app.options.components,
    recursive: true,
    type: 'component',
    onFileSet: async (v) => {
      if (v.content === undefined) {
        v.content = await getHtmlFile(v.path.pathname)
      }
      const component = parseModule(v.content, {
        ignoreByAttribute: app.options.ignoreByAttribute,
        skipRenderByAttribute: app.options.skipRenderByAttribute,
        onError: _handleErrorLocal
      })
      if (!component.isTemplate) {
        return
      }
      const res = await _triggerPluginHookLocal('onComponentSet', { component })
      return {
        type: 'component',
        id: res.component.id,
        value: res.component
      }
    },
    onFileUpdate: async (v) => {
      if (v.content === undefined) {
        v.content = await getHtmlFile(v.path.pathname)
      }
      const component = parseModule(v.content, {
        ignoreByAttribute: app.options.ignoreByAttribute,
        skipRenderByAttribute: app.options.skipRenderByAttribute,
        onError: _handleErrorLocal
      })
      if (!component.isTemplate) {
        return
      }
      const res = await _triggerPluginHookLocal('onComponentUpdate', { component })
      return res.component
    },
    onFileDelete: async (v) => {
      await _triggerPluginHookLocal('onComponentDelete', { component: v })
    }
  })

  await Promise.all(plugins.components.map(c => app.components.setItem(c)))

  const onFileSetLocal = async (data) => {
    const rootPath = data.type === 'component' ? app.options.path.components : app.options.path.pages
    const urlPathname = pathToFileURL(join('/', relative(rootPath, data.path.pathname))).pathname
    const page = {
      url: {
        pathname: urlPathname,
        dirname: pathToFileURL(dirname(urlPathname)).pathname
      },
      file: {
        pathname: data.path.pathname,
        dirname: data.path.dirname,
        filename: data.path.filename
      },
      meta: {}
    }
    const state = {
      ...data.state,
      page
    }
    if (data.content === undefined) {
      return ({
        type: 'page',
        value: {
          state,
          page,
          path: data.path
        }
      })
    }
    const elements = parseHTML(data.content, app.options.ignoreByAttribute, app.options.skipRenderByAttribute, _handleErrorLocal)

    if (app.options.mode !== 'production') {
      const customElementsList = elements?.customElements || []
      for (let i = 0; i < customElementsList.length; i++) {
        const name = customElementsList[i].name
        if (!pageCustomElements[name]) {
          pageCustomElements[name] = new Set()
          const component = app.components.getItem(name)

          if (component?.result?.customElements?.length) {
            const stack = [component.result.customElements]

            while (stack.length > 0) {
              const current = stack.pop()

              for (let i = 0; i < current.length; i++) {
                const element = current[i]

                if (!childCustomElements[element.name]) {
                  childCustomElements[element.name] = name
                  const comp = app.components.getItem(element.name)

                  if (comp?.result?.customElements?.length) {
                    stack.push(comp.result.customElements)
                  }
                }
              }
            }
          }
        }
        pageCustomElements[name].add(data.path.pathname)
      }
    }

    const mappedContext = await _triggerPluginHookLocal('onPageSet', {
      elements,
      state,
      page,
      data
    })
    const isProduction = app.options.mode === 'production'
    if (isProduction && data.physical) {
      delete data.content
    }
    return {
      type: 'page',
      value: {
        state: mappedContext.state,
        page: mappedContext.page,
        path: mappedContext.data.path,
        root: isProduction ? null : mappedContext.elements.root,
        customElements: isProduction ? null : mappedContext.elements.customElements,
        tempElements: isProduction ? null : mappedContext.elements.tempElements,
        skipRenderElements: isProduction ? null : mappedContext.elements.skipRenderElements
      },
      state: mappedContext.state
    }
  }

  const onPageUpdateLocal = async (newValue, oldValue) => {
    if (app.options.mode === 'production') {
      return newValue.result
    }
    let newCustomElements
    if (!newValue.result) {
      const res = await onFileSetLocal(newValue); newValue.result = res.value; newCustomElements = res.value.customElements
    } else {
      newCustomElements = newValue.result.customElements
    }
    const oldElements = (oldValue.result.customElements || []).slice()
    const mappedContext = await _triggerPluginHookLocal('onPageUpdate', {
      elements: newValue.result,
      page: newValue.result.page,
      newValue,
      oldValue
    })
    newValue.result = mappedContext.elements; newValue = mappedContext.newValue
    for (let i = 0; i < newCustomElements.length; i++) {
      const name = newCustomElements[i].name
      let hasElement = false
      for (let j = 0; j < oldElements.length; j++) {
        if (name === oldElements[j].name) {
          hasElement = true; oldElements.splice(j, 1); break
        }
      }
      if (!hasElement) {
        if (!pageCustomElements[name]) {
          pageCustomElements[name] = new Set()
        } pageCustomElements[name].add(newValue.path.pathname)
      }
    }
    oldElements.forEach(oe => {
      if (pageCustomElements[oe.name]) {
        pageCustomElements[oe.name].delete(newValue.path.pathname)
      }
    })
    return newValue.result
  }

  const onPageDeleteLocal = async (value) => {
    if (app.options.mode === 'production') {
      return
    }
    const res = await _triggerPluginHookLocal('onPageDelete', { data: value })
    value = res.data
    if (value?.result?.customElements) {
      value.result.customElements.forEach(ce => {
        const ceName = typeof ce === 'string' ? ce : ce.name
        if (pageCustomElements[ceName]) {
          pageCustomElements[ceName].delete(value.path.pathname)
        }
      })
    }
  }

  app.pages = new CoraliteCollection({
    rootDir: app.options.pages,
    onSet: onFileSetLocal,
    onUpdate: onPageUpdateLocal,
    onDelete: onPageDeleteLocal
  })

  if (app.options.mode === 'production') {
    for await (const file of discoverHtmlFiles({
      path: app.options.pages,
      recursive: true,
      type: 'page',
      discoverOnly: false
    })) {
      await app.pages.setItem(file)
    }
  } else {
    await getHtmlFiles({
      path: app.options.pages,
      recursive: true,
      type: 'page',
      discoverOnly: false,
      collection: app.pages
    })
  }

  return app
}

export default createCoralite
