import { cleanKeys, cloneModuleInstance, replaceToken, cloneComponentInstance, findAndExtractScript, findAndExtractProperties, extractGlobals, mergePluginState, normalizeObjectFunctions, astTransformer } from './utils.js'
import { getHtmlFile, getHtmlFiles, discoverHtmlFiles } from './html.js'
import { findHeadAndBody, injectExternalStyles, injectStyles, injectReadinessScript, injectImportMap, removeElements, resolvePageQueue } from './render-helpers.js'
import { generateClientRuntime } from './client-runtime.js'
import { parseHTML, parseModule, createElement, createTextNode } from './parse.js'
import { transformCss } from './style-transform.js'
import { ScriptManager } from './script-manager.js'
import { metadataPlugin, refsPlugin, staticAssetPlugin, testingPlugin } from '#plugins'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, normalize, relative, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { transform } from 'esbuild'
import {
  isCoraliteElement,
  isCoraliteCollectionItem,
  isCoraliteComment,
  isCoraliteTextNode
} from './type-helper.js'
import { CoraliteError } from './errors.js'
import { pathToFileURL } from 'node:url'
import { availableParallelism } from 'node:os'
import render from 'dom-serializer'
import pLimit from 'p-limit'
import { createCoraliteElement, createCoraliteTextNode } from './dom.js'
import CoraliteCollection from './collection.js'
import { randomUUID } from 'node:crypto'
import { createContext } from 'node:vm'
import { createReadOnlyProxy } from './utils.js'

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
 *  Attribute
 * } from '../types/index.js'
 */

/**
 * @import {DomSerializerOptions} from 'dom-serializer'
 */

/**
 * @class
 * @param {CoraliteConfig} options
 * @example
 * const coralite = new Coralite({
 *   components: './path/to/components',
 *   pages: './path/to/pages',
 *   mode: 'development',
 *   plugins: [myPlugin],
 *   ignoreByAttribute: [{ name: 'data-ignore', value: 'true' }],
 *   skipRenderByAttribute: ['data-skip-render']
 * });
 */
export function Coralite ({
  components,
  pages,
  plugins,
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
  if (!components && typeof components !== 'string') {
    throw new Error('Coralite constructor requires "components" option to be defined')
  }

  if (!pages && typeof pages !== 'string') {
    throw new Error('Coralite constructor requires "pages" option to be defined')
  }

  if (!plugins) {
    plugins = []
  }

  const path = {
    components: normalize(components),
    pages: normalize(pages)
  }

  this._onErrorCallback = onError

  // instance options
  this.options = {
    components,
    pages,
    plugins,
    assets,
    externalStyles,
    baseURL,
    ignoreByAttribute,
    skipRenderByAttribute,
    mode,
    path,
    output: output ? normalize(output) : undefined
  }

  /** @type {Map<string, CoraliteCollectionItem[]>} */
  this._renderQueues = new Map()

  // plugins
  this._plugins = {
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

  // Initialize script manager
  this._scriptManager = new ScriptManager(this.options)

  // source context
  this._source = {
    utils: {
      parseHTML: (string, ignoreByAttribute = this.options.ignoreByAttribute, skipRenderByAttribute = this.options.skipRenderByAttribute) => parseHTML(string, ignoreByAttribute, skipRenderByAttribute, (errorData) => this._handleError(errorData)),
      parseModule: (string, options) => parseModule(string, {
        ignoreByAttribute: this.options.ignoreByAttribute,
        skipRenderByAttribute: this.options.skipRenderByAttribute,
        onError: (errorData) => this._handleError(errorData),
        ...options
      }),
      getHtmlFiles,
      getHtmlFile,
      createElement: (options) => createElement({
        onError: (errorData) => this._handleError(errorData),
        ...options
      }),
      createTextNode,
      transform: this.transform
    },
    plugins: {
    }
  }

  // place core plugin first
  if (this.options.mode === 'development') {
    plugins.unshift(testingPlugin)
  }
  plugins.unshift(refsPlugin, metadataPlugin)

  if (assets) {
    plugins.unshift(staticAssetPlugin(assets))
  }

  const source = this._source
  // iterate over each plugin and register its hooks and modules in the Coralite source context.
  for (let i = 0; i < plugins.length; i++) {
    const plugin = plugins[i]

    if (plugin.server) {
      // set plugin method
      if (plugin.server.exports !== undefined) {
        source.plugins[plugin.name] = plugin.server.exports
      }

      // queue any components provided by the plugin to be registered.
      if (plugin.server.components && Array.isArray(plugin.server.components)) {
        for (let j = 0; j < plugin.server.components.length; j++) {
          this._plugins.components.push(plugin.server.components[j])
        }
      }

      // add the plugin's hooks to the appropriate Coralite hook lists.
      if (plugin.server.onPageSet) {
        this._addPluginHook('onPageSet', plugin.server.onPageSet)
      }
      if (plugin.server.onPageDelete) {
        this._addPluginHook('onPageDelete', plugin.server.onPageDelete)
      }
      if (plugin.server.onPageUpdate) {
        this._addPluginHook('onPageUpdate', plugin.server.onPageUpdate)
      }
      if (plugin.server.onComponentSet) {
        this._addPluginHook('onComponentSet', plugin.server.onComponentSet)
      }
      if (plugin.server.onComponentDelete) {
        this._addPluginHook('onComponentDelete', plugin.server.onComponentDelete)
      }
      if (plugin.server.onComponentUpdate) {
        this._addPluginHook('onComponentUpdate', plugin.server.onComponentUpdate)
      }
      if (plugin.server.onBeforePageRender) {
        this._addPluginHook('onBeforePageRender', plugin.server.onBeforePageRender)
      }
      if (plugin.server.onAfterPageRender) {
        this._addPluginHook('onAfterPageRender', plugin.server.onAfterPageRender)
      }
      if (plugin.server.onBeforeComponentRender) {
        this._addPluginHook('onBeforeComponentRender', plugin.server.onBeforeComponentRender)
      }
      if (plugin.server.onAfterComponentRender) {
        this._addPluginHook('onAfterComponentRender', plugin.server.onAfterComponentRender)
      }
      if (plugin.server.onBeforeBuild) {
        this._addPluginHook('onBeforeBuild', plugin.server.onBeforeBuild)
      }
      if (plugin.server.onAfterBuild) {
        this._addPluginHook('onAfterBuild', plugin.server.onAfterBuild)
      }
    }

    // register client-side plugin if provided
    if (plugin.client) {
      this._scriptManager.use(plugin.client)
    }
  }

  const propertyDescriptors = {
    enumerable: false,
    configurable: false,
    writable: false
  }

  const enumerablePropertyDescriptors = {
    enumerable: true,
    configurable: false,
    writable: true
  }

  Object.defineProperties(this, {
    options: { ...enumerablePropertyDescriptors },
    _plugins: { ...propertyDescriptors },
    _scriptManager: { ...propertyDescriptors },
    _source: { ...propertyDescriptors },
    _onErrorCallback: { ...propertyDescriptors },
    _renderQueues: { ...propertyDescriptors }
  })
}

/**
 * Initialises the Coralite instance.
 * @returns {Promise<void>}
 */
Coralite.prototype.initialise = async function () {
  this.components = await getHtmlFiles({
    path: this.options.components,
    recursive: true,
    type: 'component',
    onFileSet: async (value) => {
      if (value.content === undefined) {
        value.content = await getHtmlFile(value.path.pathname)
      }

      const component = parseModule(value.content, {
        ignoreByAttribute: this.options.ignoreByAttribute,
        skipRenderByAttribute: this.options.skipRenderByAttribute,
        onError: (errorData) => this._handleError(errorData)
      })

      // abort component add
      if (!component.isTemplate) {
        return
      }

      const mappedComponent = await this._triggerPluginHook('onComponentSet', component)

      return {
        type: 'component',
        id: mappedComponent.id,
        value: mappedComponent
      }
    },
    onFileUpdate: async (value) => {
      if (value.content === undefined) {
        value.content = await getHtmlFile(value.path.pathname)
      }

      const component = parseModule(value.content, {
        ignoreByAttribute: this.options.ignoreByAttribute,
        skipRenderByAttribute: this.options.skipRenderByAttribute,
        onError: (errorData) => this._handleError(errorData)
      })

      // abort component update
      if (!component.isTemplate) {
        return
      }

      return await this._triggerPluginHook('onComponentUpdate', component)
    },
    onFileDelete: async (value) => {
      await this._triggerPluginHook('onComponentDelete', value)
    }
  })

  // register plugin components
  await Promise.all(this._plugins.components.map(c => this.components.setItem(c)))

  // collection of custom elements used by pages
  /** @type {Object.<string, Set<string>>} */
  const pageCustomElements = {}
  /** @type {Object.<string, string>} */
  const childCustomElements = {}

  /**
   * @type {Object.<string, Set<string>>}
   */
  this._pageCustomElements = pageCustomElements
  /**
   * @type {Object.<string, string>}
   */
  this._childCustomElements = childCustomElements

  Object.defineProperties(this, {
    _pageCustomElements: {
      enumerable: false,
      configurable: false,
      writable: false
    },
    _childCustomElements: {
      enumerable: false,
      configurable: false,
      writable: false
    }
  })

  /** @type {CoraliteCollectionEventSet} */
  const onFileSet = async (data) => {
    // Determine the root path based on the data type
    let rootPath = this.options.path.pages

    if (data.type === 'component') {
      rootPath = this.options.path.components
    }

    // Convert relative file path to a URL pathname format
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

    // define a set of context state for component rendering
    /** @type {any} */
    const state = {
      ...data.state,
      page
    }

    // If discovered only, skip parsing and plugin hooks to save memory
    if (data.content === undefined) {
      return {
        type: 'page',
        value: {
          state,
          page,
          path: data.path
        }
      }
    }

    const elements = parseHTML(data.content, this.options.ignoreByAttribute, this.options.skipRenderByAttribute, (errorData) => this._handleError(errorData))

    // track parent-child relationship between custom elements (only in development)
    if (this.options.mode !== 'production') {
      const customElementsList = elements ? (elements.customElements || []) : []
      for (let i = 0; i < customElementsList.length; i++) {
        const customElement = customElementsList[i]
        const name = customElement.name
        let item = pageCustomElements[name]

        if (!item) {
          pageCustomElements[name] = new Set()
          item = pageCustomElements[name]

          const component = this.components.getItem(name)

          if (
            component &&
              component.result &&
              component.result.customElements &&
              component.result.customElements.length
          ) {
            const stack = [component.result.customElements]

            while (stack.length > 0) {
              const current = stack.pop()

              for (let i = 0; i < current.length; i++) {
                const element = current[i]

                if (!childCustomElements[element.name]) {
                  childCustomElements[element.name] = name

                  // process nested elements recursively
                  const component = this.components.getItem(element.name)

                  if (
                    component &&
                      component.result &&
                      component.result.customElements &&
                      component.result.customElements.length
                  ) {
                    // push nested custom elements to stack for processing
                    stack.push(component.result.customElements)
                  }
                }
              }
            }
          }
        }

        // add page to custom element collection
        item.add(data.path.pathname)
      }
    }

    const mappedContext = await this._triggerPluginHook('onPageSet', {
      elements,
      state: state,
      page,
      data
    })

    const isProduction = this.options.mode === 'production'

    if (isProduction && data.physical) {
      delete data.content
    }

    return {
      type: 'page',
      value: {
        state: mappedContext.state,
        page: mappedContext.page,
        path: mappedContext.data.path,
        // In production, we discard the heavy AST nodes after initialization hooks to save memory.
        // They will be re-parsed on-demand during the build/render phase.
        root: isProduction ? null : mappedContext.elements.root,
        customElements: isProduction ? null : mappedContext.elements.customElements,
        tempElements: isProduction ? null : mappedContext.elements.tempElements,
        skipRenderElements: isProduction ? null : mappedContext.elements.skipRenderElements
      },
      state: mappedContext.state
    }
  }

  const onPageUpdate = async (newValue, oldValue) => {
    if (this.options.mode === 'production') {
      return newValue.result
    }

    let newCustomElements

    if (!newValue.result) {
      const result = await onFileSet(newValue)

      newValue.result = result.value
      newCustomElements = result.value.customElements
    } else {
      newCustomElements = newValue.result.customElements
    }

    let oldElements = (oldValue.result.customElements || []).slice()

    const mappedContext = await this._triggerPluginHook('onPageUpdate', {
      elements: newValue.result,
      page: newValue.result.page,
      newValue,
      oldValue
    })

    // Assign back the mapped elements to result so that rendering uses the updated AST and state
    newValue.result = mappedContext.elements
    newValue = mappedContext.newValue

    for (let i = 0; i < newCustomElements.length; i++) {
      const newElement = newCustomElements[i]

      let hasElement = false

      for (let j = 0; j < oldElements.length; j++) {
        const oldElement = oldElements[j]

        if (newElement.name === oldElement.name) {
          hasElement = true
          oldElements.splice(j, 1)
          break
        }
      }

      if (!hasElement) {
        let item = pageCustomElements[newElement.name]

        if (!item) {
          pageCustomElements[newElement.name] = new Set()
          item = pageCustomElements[newElement.name]
        }

        // add page to custom element collection
        item.add(newValue.path.pathname)
      }
    }

    for (let i = 0; i < oldElements.length; i++) {
      const pageCustomElement = pageCustomElements[oldElements[i].name]

      // remove page from custom element reference
      pageCustomElement.delete(newValue.path.pathname)
    }

    return newValue.result
  }

  const onPageDelete = async (value) => {
    if (this.options.mode === 'production') {
      return
    }

    value = await this._triggerPluginHook('onPageDelete', value)

    // remove page from custom element reference
    if (value && value.result && value.result.customElements) {
      const customElements = value.result.customElements

      for (let i = 0; i < customElements.length; i++) {
        const pageCustomElement = pageCustomElements[customElements[i]]

        if (pageCustomElement) {
          pageCustomElement.delete(value.path.pathname)
        }
      }
    }
  }

  this.pages = new CoraliteCollection({
    rootDir: this.options.pages,
    onSet: onFileSet,
    onUpdate: onPageUpdate,
    onDelete: onPageDelete
  })

  const isProduction = this.options.mode === 'production'

  if (isProduction) {
    for await (const file of discoverHtmlFiles({
      path: this.options.pages,
      recursive: true,
      type: 'page',
      discoverOnly: false
    })) {
      // Process file for metadata, then it will be discarded because isProduction is true in onFileSet
      await this.pages.setItem(file)
    }
  } else {
    /** @type {CoraliteCollection} */
    await getHtmlFiles({
      path: this.options.pages,
      recursive: true,
      type: 'page',
      discoverOnly: false,
      collection: this.pages
    })
  }
}

/**
 * Default error handler for the Coralite instance.
 * @internal
 * @param {Object} data
 * @param {'WARN' | 'ERR' | 'LOG'} data.level
 * @param {string} data.message
 * @param {Error} [data.error]
 */
Coralite.prototype._defaultOnError = function ({ level, message, error }) {
  if (level === 'ERR') {
    if (error) {
      throw error
    }
    throw new Error(message)
  } else if (level === 'WARN') {
    console.warn(message)
  } else {
    console.log(message)
  }
}

/**
 * Internal error handler for the Coralite instance.
 * @internal
 * @param {Object} data - The error or log data object containing the details of the event.
 * @param {'WARN' | 'ERR' | 'LOG'} data.level - The severity level of the message.
 * @param {string} data.message - The descriptive message to be logged or thrown.
 * @param {Error} [data.error] - An optional Error instance providing a stack trace.
 */
Coralite.prototype._handleError = function (data) {
  if (this._onErrorCallback) {
    this._onErrorCallback(data)
  } else {
    this._defaultOnError(data)
  }
}

/**
 * Helper to create CoraliteError during component execution
 * @internal
 * @param {Error} error - The caught error
 * @param {CoraliteModule} module - The component module
 * @param {CoraliteCollectionItem} moduleComponent - The parent module component
 * @param {CoralitePage} page - The current page
 * @param {string} instanceId - The unique instance id
 * @returns {CoraliteError} The generated error object
 */
Coralite.prototype._createExecutionError = function (error, module, moduleComponent, page, instanceId) {
  return new CoraliteError(error.message, {
    cause: error,
    componentId: module.id,
    filePath: moduleComponent.path.pathname,
    pagePath: page?.file?.pathname,
    instanceId
  })
}

/**
 * Creates a render context for the build process.
 * @internal
 * @param {string} [buildId] - The unique identifier for the build process.
 * @returns {CoraliteSession}
 */
Coralite.prototype._createSession = function (buildId) {
  return {
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
  }
}
/**
 * Compiles specified page(s) by rendering their document content and measuring render time.
 * Processes pages based on provided path(s), replacing custom elements with components,
 * and returns rendered results with performance metrics.
 *
 * @internal
 *
 * @param {string | string[]} [path] - Path to a single page or array of page paths relative to the pages directory. If omitted, compiles all pages.
 * @param {Object} [state] - Properties to be passed to the page
 * @returns {AsyncGenerator<CoraliteResult>}
 */

/**
 * Processes custom elements found within a generated page context
 * @internal
 * @param {CoraliteComponent & CoraliteComponentResult} mappedComponent - The compiled component instance
 * @param {CoraliteComponentResult} originalDocument - The original document mapping
 * @param {Object} state - Local component state
 * @param {CoraliteSession} mappedSessionObject - Global rendering state
 * @returns {Promise<void>} Resolves when the elements are processed
 */
Coralite.prototype._processCustomElementsInPage = async function (mappedComponent, originalDocument, state, mappedSessionObject, pageContext) {
  const customElementsList = mappedComponent.customElements || []
  for (let i = 0; i < customElementsList.length; i++) {
    const customElement = customElementsList[i]

    const contextId = mappedSessionObject.generateId(customElement.name)
    const currentProperties = mappedSessionObject.state[contextId] || {}

    if (typeof customElement.attribs === 'object') {
      mappedSessionObject.state[contextId] = {
        ...currentProperties,
        ...state,
        ...mappedComponent.state,
        ...customElement.attribs
      }
    } else {
      mappedSessionObject.state[contextId] = {
        ...currentProperties,
        ...state,
        ...mappedComponent.state
      }
    }

    const noHydration = customElement.attribs && 'no-hydration' in customElement.attribs
    const componentElement = await this.createComponentElement({
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
            for (let j = 0; j < componentElement.children.length; j++) {
              componentElement.children[j].parent = parent
            }
            parent.children.splice(elementIndex, 1, ...componentElement.children)
          }
        }
      } else {
        customElement.children = componentElement.children
        for (let j = 0; j < customElement.children.length; j++) {
          customElement.children[j].parent = customElement
        }

        if (!customElement.attribs) {
          customElement.attribs = {}
        }
        customElement.attribs['data-cid'] = contextId

        mappedSessionObject.componentTags.add(customElement.name)
      }
    }
  }
}

Coralite.prototype._generatePages = async function* (path, state = {}) {
  const isProduction = this.options.mode === 'production'

  if (path) {
    const paths = Array.isArray(path) ? path : [path]
    for (const p of paths) {
      if (!this.pages.getItem(p)) {
        try {
          await this.pages.setItem(p)
        } catch (e) {
          // Path might not be a direct file, could be a glob or dir handled by resolvePageQueue
        }
      }
    }
  }

  const queue = resolvePageQueue(this.pages, path)

  const buildId = randomUUID()
  this._renderQueues.set(buildId, queue)
  const scriptResultCache = new Map()

  try {
    const activeQueue = this._renderQueues.get(buildId)

    for (let q = 0; q < activeQueue.length; q++) {
      const pageItem = activeQueue[q]
      const startTime = performance.now()

      /** @type {CoraliteComponent & CoraliteComponentResult} */
      const originalDocument = pageItem.result

      /** @type {CoraliteComponent & CoraliteComponentResult} */
      // @ts-ignore
      let component
      let pageContext = originalDocument.page

      // If the page was discovery-only initialized (no root AST), parse it on-demand
      if (!originalDocument.root) {
        let content = pageItem.content
        if (content === undefined) {
          try {
            content = await getHtmlFile(pageItem.path.pathname)
          } catch (e) {
            // Re-check content in case it was set concurrently or by a plugin (virtual pages)
            if (pageItem.content !== undefined) {
              content = pageItem.content
            } else {
              throw e
            }
          }
        }

        // Temporarily store content so plugins can find it via app.pages.getItem()
        pageItem.content = content

        const elements = parseHTML(content, this.options.ignoreByAttribute, this.options.skipRenderByAttribute, (errorData) => this._handleError(errorData))

        // Shallow clone page object to avoid polluting state across builds
        pageContext = {
          ...originalDocument.page,
          meta: { ...originalDocument.page.meta }
        }
        const pageState = {
          ...originalDocument.state,
          page: pageContext
        }

        const mappedContext = await this._triggerPluginHook('onPageSet', {
          elements,
          state: pageState,
          page: pageContext,
          data: pageItem
        })

        const fullPath = Object.assign({}, mappedContext.data.path, {
          pages: this.options.path.pages,
          components: this.options.path.components
        })
        /** @type {CoraliteComponent & CoraliteComponentResult} */
        // @ts-ignore
        component = {
          // @ts-ignore
          state: { ...mappedContext.state },
          page: mappedContext.page,
          path: fullPath,
          root: mappedContext.elements.root,
          customElements: mappedContext.elements.customElements,
          tempElements: mappedContext.elements.tempElements,
          skipRenderElements: mappedContext.elements.skipRenderElements,
          ignoreByAttribute: this.options.ignoreByAttribute || []
        }

      } else {
        // Deep clone the document to ensure thread safety
        component = cloneComponentInstance(originalDocument)
        component.ignoreByAttribute = component.ignoreByAttribute || this.options.ignoreByAttribute || []

        // Ensure pageContext is correctly initialized from cloned component
        pageContext = component.page
      }

      // Merge state into component
      Object.assign(component.state, state)

      // Initialize Render Context
      const session = this._createSession(buildId)
      // @ts-ignore
      session.mode = this.options.mode

      const mappedSession = await this._triggerPluginHook('onBeforePageRender', {
        component,
        state,
        page: pageContext,
        session
      })

      const mappedComponent = mappedSession.component
      const mappedSessionObject = mappedSession.session

      // reassign the top-level state object in case it was modified
      state = mappedSession.state

      // @ts-ignore
      mappedSessionObject.mode = this.options.mode

      // remove temporary elements
      removeElements(mappedComponent.tempElements, false)

      await this._processCustomElementsInPage(mappedComponent, originalDocument, state, mappedSessionObject, pageContext)

      const { head: headElement, body: bodyElement } = findHeadAndBody(mappedComponent.root)

      if (this.options.externalStyles && this.options.externalStyles.length > 0) {
        injectExternalStyles(mappedComponent.root, headElement, this.options.externalStyles)
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
          attribs: {
            id: 'coralite-components'
          },
          children: []
        })

        const selectors = Array.from(mappedSessionObject.componentTags)
        selectors.push('c-token')
        const selector = selectors.join(', ')
        layoutStyleElement.children.push(createCoraliteTextNode({
          type: 'text',
          data: `${selector} { display: contents; }`,
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

        // Build instances object for script manager
        /** @type {Object.<string, InstanceContext>} */
        const instances = {}
        const componentIds = new Set()
        for (const key in scripts) {
          if (Object.prototype.hasOwnProperty.call(scripts, key)) {
            const script = scripts[key]
            componentIds.add(script.componentId)
            // extending script content with templateId and values
            instances[script.id] = {
              instanceId: script.id,
              componentId: script.componentId,
              page: script.page,
              state: script.state
            }
          }
        }

        // Generate a deterministic cache key based on the sorted list of components required by this page
        const cacheKey = Array.from(componentIds).sort().join(',')

        let scriptResult
        if (scriptResultCache.has(cacheKey)) {
          scriptResult = scriptResultCache.get(cacheKey)
        } else {
          // Wrap hydration state in AST-safe normalization to prevent circularity
          /** @type {Object.<string, InstanceContext>} **/
          const normalizedInstances = {}
          for (const [id, instance] of Object.entries(instances)) {
            normalizedInstances[id] = {
              ...instance,
              state: normalizeObjectFunctions(instance.state, astTransformer)
            }
          }

          // Use script manager to compile all instances
          scriptResult = await this._scriptManager.compileAllInstances(normalizedInstances, this.options.mode)
          scriptResultCache.set(cacheKey, scriptResult)

          // Store the asset results in the coralite instance to be saved later
          if (!this.outputFiles) {
            this.outputFiles = {}
          }
          Object.assign(this.outputFiles, scriptResult.outputFiles)
        }

        if (!scriptResult.manifest['chunk-shared']) {
          this._handleError({
            level: 'ERR',
            message: 'MANIFEST MISSING chunk-shared!',
            error: new Error(JSON.stringify(scriptResult.manifest))
          })
        }

        injectReadinessScript(mappedComponent.root, headElement, true)
        injectImportMap(mappedComponent.root, headElement, scriptResult.importMap)

        const chunkManifest = { ...scriptResult.manifest }
        delete chunkManifest['chunk-shared']

        const base = this.options.baseURL.endsWith('/') ? this.options.baseURL : this.options.baseURL + '/'
        const scriptContent = generateClientRuntime({
          base,
          sharedChunkPath: scriptResult.manifest['chunk-shared'],
          chunkManifest
        })

        const hydrationData = {}
        for (const [id, instance] of Object.entries(instances)) {
          const contextId = instance.instanceId
          if (instance.state && Object.keys(instance.state).length > 0) {
            // Ensure state is normalized to remove circular AST nodes before JSON serialization
            hydrationData[contextId] = normalizeObjectFunctions(instance.state, astTransformer)
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
          attribs: {
            type: 'module'
          },
          children: []
        })

        scriptElement.children.push(createCoraliteTextNode({
          type: 'text',
          data: scriptContent,
          parent: scriptElement
        }))

        bodyElement.children.push(scriptElement)
      }

      // remove skip render elements
      removeElements(mappedComponent.skipRenderElements, true)

      if (!mappedSessionObject.scripts.content[mappedComponent.path.pathname]) {
        injectReadinessScript(mappedComponent.root, headElement, false)
      }

      let rawHTML = ''
      // render document
      rawHTML = this.transform(mappedComponent.root)


      yield {
        type: 'page',
        path: mappedComponent.path,
        content: rawHTML,
        duration: performance.now() - startTime,
        session
      }

      // Explicitly nullify large objects to help GC
      if (isProduction) {
        mappedComponent.root = null
        mappedComponent.customElements = null
        mappedComponent.tempElements = null
        mappedComponent.skipRenderElements = null
      }

      if (isProduction) {
        // In production, we can discard the yielded content from the item
        // but we must keep the result object (minus the AST) for metadata and rebuilds.
        delete pageItem.content
      }

      // Explicitly nullify render context contents to help GC
      session.state = null
      session.styles = null
      session.scripts = null
      if (session.source) {
        session.source.contextInstances = null
        session.source = null
      }
    }
  } finally {
    this._renderQueues.delete(buildId)
  }
}

/**
 * @callback BuildPageHandler
 * @param {CoraliteResult} result - The rendered output document for a specific page.
 * @returns {Promise<any> | any} The transformed result to be collected (falsy values are filtered).
 */

/**
 * Compiles pages and collects the results with controlled concurrency.
 * Can optionally transform each result via a callback before collecting.
 *
 * @overload
 * @param {string | string[]} [path] - The target directory or an array of specific page paths to build.
 * @returns {Promise<CoraliteResult[]>} A Promise that resolves to an array of build results.
 *
 * @overload
 * @param {BuildPageHandler} callback - A function invoked for each page to transform the result.
 * @returns {Promise<CoraliteResult[]>} A Promise that resolves to an array of build results.
 *
 * @overload
 * @param {string | string[]} [path] - The target directory or an array of specific page paths to build.
 * @param {Object} [options] - Configuration options for the build process.
 * @param {number} [options.maxConcurrent=availableParallelism] - The maximum number of concurrent file write operations.
 * @param {AbortSignal} [options.signal] - An AbortSignal to cancel the build operation.
 * @param {Object} [options.variables] - Local variables for the page
 * @returns {Promise<CoraliteResult[]>} A Promise that resolves to an array of build results.
 *
 * @overload
 * @param {string | string[]} [path] - The target directory or an array of specific page paths to build.
 * @param {BuildPageHandler} callback - A function invoked for each page to transform the result.
 * @returns {Promise<any[]>} A Promise that resolves to an array of the transformed results.
 *
 * @overload
 * @param {string | string[]} [path] - The target directory or an array of specific page paths to build.
 * @param {Object} [options] - Configuration options for the build process.
 * @param {number} [options.maxConcurrent=availableParallelism] - The maximum number of concurrent file write operations.
 * @param {AbortSignal} [options.signal] - An AbortSignal to cancel the build operation.
 * @param {BuildPageHandler} callback - A function invoked for each page to transform the result.
 * @returns {Promise<any[]>} A Promise that resolves to an array of the transformed results.
 *
 * @example
 * // Build and get all results
 * const results = await coralite.build('./dist')
 * // results is CoraliteResult[]
 *
 * // Build and transform results
 * const titles = await coralite.build('./dist', (result) => {
 *   return result.path
 * })
 */
Coralite.prototype.build = async function (...args) {
  const startTime = performance.now()
  let path = args[0]
  let options
  let callback

  // add callback since there are no options
  if (typeof args[0] === 'function') {
    path = null
    callback = args[0]
  } else if (typeof args[1] === 'function') {
    callback = args[1]
  } else {
    options = args[1]
    callback = args[2]
  }

  if (!options) {
    options = {}
  }

  const mappedBeforeBuild = await this._triggerPluginHook('onBeforeBuild', {
    path,
    options
  })

  path = mappedBeforeBuild.path
  options = mappedBeforeBuild.options

  // Add options with defaults
  const signal = options?.signal
  const maxConcurrent = options?.maxConcurrent || availableParallelism()
  const variables = options?.variables

  // Initialize the limiter
  const limit = pLimit(maxConcurrent)
  const executing = new Set()
  const results = []
  let buildError = null
  const isStreaming = !!callback

  try {
    for await (const result of this._generatePages(path, variables)) {
      // Check for immediate cancellation
      if (signal?.aborted) {
        throw signal.reason
      }

      // Backpressure - don't pull more data than we can process
      if (executing.size >= limit.concurrency) {
        await Promise.race(executing)
      }

      const task = limit(async () => {
        // Exit early if build was cancelled while in queue
        if (signal?.aborted) {
          throw signal.reason
        }

        // Trigger onAfterPageRender hooks using the aggregate method
        const additionalPages = await this._triggerPluginAggregateHook('onAfterPageRender', {
          result,
          session: result.session
        })

        const items = [result]

        // Process any dynamically generated pages returned by the plugins
        for (const newPage of additionalPages) {
          if (newPage && newPage.path && newPage.content) {
            // Mock path data for dynamically generated pages if needed
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
          if (typeof callback === 'function') {
            const transformed = await callback(item)
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

      // Clean up task
      task.then((callbackResults) => {
        if (callbackResults && callbackResults.length) {
          results.push(...callbackResults)
        }

        executing.delete(task)
      }).catch((err) => {
        executing.delete(task)

        this._handleError({
          level: 'ERR',
          message: err.message,
          error: err
        })
      })
    }

    await Promise.all(executing)

    return results

  } catch (error) {
    // Clean up - If one fails or we abort, wait for pending to settle
    await Promise.allSettled(executing)

    let finalError = error

    if (error.name === 'AbortError') {
      this._handleError({
        level: 'WARN',
        message: 'Build cancelled by user.'
      })
    }

    if (error instanceof Error) {
      error.message = `Build failed: ${error.message}`
      finalError = error
    } else {
      finalError = new Error(`Build failed: ${error.message}`, { cause: error })
    }

    buildError = finalError
    throw finalError
  } finally {
    const duration = performance.now() - startTime
    await this._triggerPluginHook('onAfterBuild', {
      results,
      error: buildError,
      duration
    })

    // Clean up to save memory
  }
}

/**
 * Compiles and saves pages to disk
 *
 * @param {string | string[]} [path] - Optional page path(s) to build
 * @param {Object} [options] - Build configuration
 * @param {number} [options.maxConcurrent=10] - Max concurrent file writes (min 1, max 100)
 * @param {AbortSignal} [options.signal] - AbortSignal
 * @returns {Promise<{ path: string, duration: number }[]>} Array of saved file paths
 * @example
 * // Build entire site with default concurrency (10 files)
 * await coralite.save()
 *
 * // Build specific pages with custom concurrency
 * await coralite.save(['blog/*'], { maxConcurrent: 5 })
 */
Coralite.prototype.save = async function (path, options = {}) {
  const signal = options?.signal
  const createdDir = {}

  if (!this.options.output) {
    throw new Error('Coralite instance must be configured with an "output" option to use save()')
  }

  const output = this.options.output

  const results = []
  await this.build(path, options, async (result) => {
    let relativeDir, outDir, outFile, contentToWrite

    // It's a standard HTML page
    relativeDir = relative(this.options.path.pages, result.path.dirname)
    outDir = join(output, relativeDir)
    outFile = join(outDir, result.path.filename)
    contentToWrite = result.content

    if (!createdDir[outDir]) {
      await mkdir(outDir, { recursive: true })

      createdDir[outDir] = true
    }

    // Pass signal to writeFile so Node can stop the I/O immediately
    await writeFile(outFile, contentToWrite, { signal })

    results.push({
      path: outFile,
      duration: result.duration
    })

    // Return undefined to prevent build() from accumulating redundant results
    return undefined
  })

  // Write ESM script assets generated during the build phase
  if (this.outputFiles) {
    const assetsDir = join(output, 'assets', 'js')
    if (!createdDir[assetsDir]) {
      await mkdir(assetsDir, { recursive: true })
      createdDir[assetsDir] = true
    }

    const assetWrites = Object.values(this.outputFiles).map(async (file) => {
      const outFile = join(assetsDir, file.hashedPath)
      const outDir = dirname(outFile)

      if (!createdDir[outDir]) {
        await mkdir(outDir, { recursive: true })
        createdDir[outDir] = true
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
}

/**
 * Renders the provided node or array of nodes using the render function.
 *
 * @param {CoraliteComponentRoot | CoraliteAnyNode | CoraliteAnyNode[]} root - The node(s) to be rendered.
 * @param {DomSerializerOptions} [options] - Changes serialization behavior
 * @returns {string} returns raw HTML
 */
Coralite.prototype.transform = function (root, options) {
  // @ts-ignore
  return render(root, {
    decodeEntities: false,
    ...options
  })
}

/**
 * Adds a page to the current render queue.
 * @param {string|CoraliteCollectionItem} value - The path to a page or a CoraliteCollectionItem to add to the render queue.
 * @param {string} buildId - The unique identifier for the current build process.
 */
Coralite.prototype.addRenderQueue = async function (value, buildId) {
  if (!buildId) {
    throw new Error('addRenderQueue requires a buildId')
  }

  const queue = this._renderQueues.get(buildId)

  if (!queue) {
    throw new Error('addRenderQueue - buildId not found: "' + buildId + '"')
  }

  if (typeof value === 'string') {
    const component = this.pages.getItem(value)

    if (!component) {
      throw new Error('addRenderQueue - unexpected page ID: "' + value + '"')
    }

    queue.push(component)
  } else if (isCoraliteCollectionItem(value)) {
    const component = await this.pages.setItem(value)

    // add render queue
    queue.push(component)
  }
}

/**
 * Retrieves page paths associated with a custom element components.
 *
 * @param {string} path - The original path potentially prefixed with the components directory.
 * @returns {string[]} An array of page paths linked to the custom element component.
 */
Coralite.prototype.getPagePathsUsingCustomElement = function (path) {
  if (this.options.mode === 'production') {
    return []
  }

  // normalize path by removing the components directory prefix
  if (path.startsWith(this.options.path.components)) {
    path = path.substring(this.options.path.components.length + 1)
  }

  // retrieve the component item from the components collection
  const item = this.components.getItem(path)
  const pages = []

  // if component exists, collect associated page paths
  if (item) {
    const id = this._childCustomElements[item.result.id] || item.result.id
    const pageCustomElements = this._pageCustomElements[id]

    if (pageCustomElements) {
      // iterate over custom element paths linked to this component
      pageCustomElements.forEach(path => {
        pages.push(path)
      })
    }
  }

  return pages
}

/**
 * Recursively resolves imperative component dependencies, bundling their HTML and state for the client.
 *
 * @param {string[]} componentIds - Array of component IDs to process.
 * @param {CoraliteSession} session - The current build render context.
 * @param {CoralitePage} page - The global page object
 * @param {CoraliteComponentRoot} root - The root element of the component
 * @param {Object} state - The current token state and state available
 * @returns {Promise<void>}
 */
Coralite.prototype._processDependentComponents = async function (componentIds, session, page, root, state = {}) {
  if (!componentIds?.length) {
    return
  }

  for (const id of componentIds) {
    if (this._scriptManager.sharedFunctions[id]) {
      continue
    }

    const moduleComponent = this.components.getItem(id)
    if (!moduleComponent) {
      continue
    }

    const module = cloneModuleInstance(moduleComponent.result)

    // Evaluate the script
    let scriptResult = {}
    if (module.script) {
      try {
        scriptResult = await this._evaluate({
          module,
          state,
          page,
          root,
          contextId: `dependent-${id}`,
          session
        })
      } catch (error) {
        throw this._createExecutionError(error, module, moduleComponent, page, `dependent-${id}`)
      }
    }

    // Safely extract __script__ metadata once
    const scriptMeta = scriptResult.__script__ || {}
    const templateAST = moduleComponent.result.template?.children || []
    const templateValues = moduleComponent.result.values || {}

    //  Process CSS
    if (module.styles?.length && !moduleComponent.result._processedCss) {
      const rawCss = module.styles.join('\n')
      const { rootClasses, descendantClasses } = moduleComponent.result
      moduleComponent.result._processedCss = await transformCss(
        rawCss, rootClasses, descendantClasses,
        (errorData) => this._handleError(errorData)
      )
    }
    const stylesHTML = moduleComponent.result._processedCss || ''

    // Construct script object
    const scriptObj = {
      content: 'function(){}',
      state: scriptMeta.state || {},
      slots: scriptMeta.slots || {}
    }

    let defaultValues = scriptMeta.defaultValues || {}
    let extractedComponents = []

    // Extract AST
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

    // Deduplicate nested components
    const declarativeComponents = (module.customElements || []).map(el => el.name)
    const nestedComponents = [...new Set([...declarativeComponents, ...extractedComponents])]

    scriptObj.components = nestedComponents

    // Extract tokens
    const extractTokens = (nodes) => nodes?.flatMap(n => n.tokens?.map(t => t.name) || []) || []
    const allTokens = new Set([
      ...extractTokens(module.values?.attributes),
      ...extractTokens(module.values?.textNodes)
    ])

    // Apply token values to defaultValues
    for (const token of allTokens) {
      if (defaultValues[token] === undefined && scriptResult[token] !== undefined) {
        defaultValues[token] = scriptResult[token]
      }
    }

    // Process Template Refs
    templateValues?.refs?.forEach(ref => {
      const refKey = `ref_${ref.name}`
      defaultValues[refKey] = ''
      scriptObj.state[refKey] = ''
    })

    scriptObj.defaultValues = defaultValues

    this._scriptManager.registerComponent({
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

    // Recursively process deeper dependencies
    if (nestedComponents.length > 0) {
      const inheritedState = {
        ...state
      }
      delete inheritedState.__script__

      await this._processDependentComponents(nestedComponents, session, page, root, inheritedState)
    }

  }
}

/**
 * @param {Object} options
 * @param {string} options.id - id - Unique identifier for the component
 * @param {CoraliteModuleDefinitions} [options.state={}] - Token state available for replacement
 * @param {CoraliteElement} [options.element] - The original Custom Element node
 * @param {CoralitePage} options.page - The global page object
 * @param {CoraliteComponentRoot} [options.root] - The root element of the component
 * @param {string} [options.contextId] - Context Id
 * @param {number} [options.index] - Context index
 * @param {CoraliteSession} [options.session] - Render Context
 * @param {boolean} [options.noHydration] - Indicates if the component should be stripped and not hydrated
 * @param {boolean} [head=true] - Indicates if the current function call is for the head of the recursion
 * @returns {Promise<CoraliteElement | void>}
 */
Coralite.prototype.createComponentElement = async function ({
  id,
  state = {},
  element,
  page,
  root,
  contextId,
  index,
  session,
  noHydration
}, head = true) {
  if (!session) {
    session = this._createSession()
  }

  const moduleComponent = this.components.getItem(id)

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

    // convert object keys to camel case format for consistent naming conventions
    // @ts-ignore
    componentState = cleanKeys(componentState)
  }

  /**
   * clone the component to avoid mutations during replacement process.
   * @type {CoraliteModule}
   */
  const module = cloneModuleInstance(moduleComponent.result)

  const mappedComponentContext = await this._triggerPluginHook('onBeforeComponentRender', {
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
    const attributeName = 'data-style-selector'
    const selector = module.id

    // Check if styles have been processed for this component
    if (!moduleComponent.result._processedCss) {
      const rawCss = module.styles.join('\n')

      const { rootClasses, descendantClasses } = moduleComponent.result

      // Transform CSS
      moduleComponent.result._processedCss = await transformCss(rawCss, rootClasses, descendantClasses, (errorData) => this._handleError(errorData))
    }

    // Add styles to session (idempotent for the build)
    if (!session.styles.has(selector)) {
      session.styles.set(selector, moduleComponent.result._processedCss)
    }

    // Inject attribute into component root elements
    const value = selector

    for (let i = 0; i < result.children.length; i++) {
      const child = result.children[i]
      if (child.type === 'tag') {
        if (!child.attribs) {
          child.attribs = {}
        }

        // Handle existing attribute value
        child.attribs[attributeName] = value
      }
    }
  }

  // merge state from component script
  if (module.script) {
    let scriptResult = {}

    try {
      const evaluationState = Object.assign({}, componentState)

      scriptResult = await this._evaluate({
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
      throw this._createExecutionError(error, module, moduleComponent, page, contextId)
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
        // Fallback for when script extraction fails (shouldn't happen with valid defineComponent)
        // Ensure we don't crash
        scriptResult.__script__.lineOffset = module.lineOffset || 0
        scriptResult.__script__.content = 'function(){}'
      }

      // Extract processed styles from the module
      const stylesHTML = moduleComponent.result._processedCss || ''

      const templateAST = moduleComponent.result.template.children
      const templateValues = moduleComponent.result.values
      const componentTokens = {}

      for (let i = 0; i < module.values.attributes.length; i++) {
        const item = module.values.attributes[i]
        for (let j = 0; j < item.tokens.length; j++) {
          componentTokens[item.tokens[j].name] = true
        }
      }
      for (let i = 0; i < module.values.textNodes.length; i++) {
        const item = module.values.textNodes[i]
        for (let j = 0; j < item.tokens.length; j++) {
          componentTokens[item.tokens[j].name] = true
        }
      }

      // Include all computed state into default values so client script can use them
      const componentDefaultValues = scriptResult.__script__.defaultValues || {}
      if (componentState) {
        for (const token of Object.keys(componentTokens)) {
          if (componentDefaultValues[token] === undefined && componentState[token] !== undefined) {
            componentDefaultValues[token] = componentState[token]
          }
        }
      }

      // Dynamically load any components dynamically inserted if they are explicitly mentioned
      const declarativeComponents = (module.customElements || []).map(el => el.name)
      const mergedComponents = Array.from(new Set([...declarativeComponents, ...extractedComponents]))

      if (scriptResult.__script__) {
        scriptResult.__script__.components = mergedComponents
      }

      // Register component script with script manager
      this._scriptManager.registerComponent({
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
        // Merge the evaluated script results into the state context for dependencies
        const inheritedState = Object.assign({}, state)
        delete inheritedState.__script__

        await this._processDependentComponents(mergedComponents, session, page, root, inheritedState)
      }

      // Ensure state object exists in scriptResult
      if (!scriptResult.__script__.state) {
        scriptResult.__script__.state = {}
      }


      // Store instance data for script manager
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

  // replace tokens in the component with their state from `componentState` object and store them into computed value array for later use if needed (e.g., to be injected back).
  for (let i = 0; i < module.values.attributes.length; i++) {
    const item = module.values.attributes[i]

    for (let j = 0; j < item.tokens.length; j++) {
      const token = item.tokens[j]
      let value = componentState[token.name]

      if (value == null) {
        // console.error('Token "' + token.name +'" was empty used on "' + moduleComponent.id + '"')
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

  for (let i = 0; i < module.values.textNodes.length; i++) {
    const item = module.values.textNodes[i]

    for (let j = 0; j < item.tokens.length; j++) {
      const token = item.tokens[j]
      let value = componentState[token.name]

      if (value == null) {
        // console.error('Token "' + token.name +'" was empty used on "' + moduleComponent.id + '"')
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

  // replace nested customElements
  const customElements = module.customElements
  let childIndex

  // Update slot elements for all custom elements
  for (let i = 0; i < customElements.length; i++) {
    const customElement = customElements[i]

    // update slot elements
    if (customElement.children
        && customElement.children.length
        && !customElement.slots.length
    ) {
      for (let j = 0; j < customElement.children.length; j++) {
        const node = customElement.children[j]
        const slotElement = {
          name: 'default',
          node
        }

        // @ts-ignore
        if (isCoraliteElement(node) && node.attribs.slot) {
          // add named slot
          // @ts-ignore
          slotElement.name = node.attribs.slot
        }

        customElement.slots.push(slotElement)
      }
    }
  }

  const createComponentTasks = []

  for (let i = 0; i < customElements.length; i++) {
    const customElement = customElements[i]

    // Skip if this element is a direct child of another custom element.
    // The parent will handle processing this element via slots.
    // @ts-ignore
    if (customElement.parent && customElement.parent.slots) {
      continue
    }

    const childContextId = session.generateId(customElement.name)
    const currentProperties = session.state[childContextId] || {}

    let childState = { ...state }

    // append custom attributes to state
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

    createComponentTasks.push(
      this.createComponentElement({
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
      }))
    )
  }

  const results = await Promise.all(createComponentTasks)

  for (let i = 0; i < results.length; i++) {
    const { childComponentElement, customElement, childContextId, noHydration: childNoHydration } = results[i]

    // replace custom element with component
    if (childComponentElement && typeof childComponentElement === 'object') {
      if (childNoHydration) {
        const parent = customElement.parent
        if (parent && parent.children) {
          const elementIndex = parent.children.indexOf(customElement)
          if (elementIndex !== -1) {
            for (let j = 0; j < childComponentElement.children.length; j++) {
              childComponentElement.children[j].parent = parent
            }
            parent.children.splice(elementIndex, 1, ...childComponentElement.children)
          }
        }
      } else {
        customElement.children = childComponentElement.children
        for (let j = 0; j < customElement.children.length; j++) {
          customElement.children[j].parent = customElement
        }

        if (!customElement.attribs) {
          customElement.attribs = {}
        }
        customElement.attribs['data-cid'] = childContextId

        session.componentTags.add(customElement.name)
      }
    }
  }

  await this._replaceSlots(id, element, module, componentState, page, root, index, session, noHydration)

  if (noHydration) {
    const stack = [...result.children]
    while (stack.length > 0) {
      const node = stack.pop()
      if (node.type === 'tag') {
        if (node.name === 'c-token') {
          const parent = node.parent
          if (parent && parent.children) {
            const index = parent.children.indexOf(node)
            if (index !== -1) {
              for (let j = 0; j < node.children.length; j++) {
                node.children[j].parent = parent
              }
              parent.children.splice(index, 1, ...node.children)
            }
          }
        } else {
          stack.push(...(node.children || []))
        }
      }
    }
  }

  const mappedAfterContext = await this._triggerPluginHook('onAfterComponentRender', {
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


/**
 * Replaces slot elements in a component with provided content
 * @internal
 * @param {string} id - Component ID
 * @param {CoraliteElement} element - The original Custom Element node
 * @param {CoraliteModule} module - The component module configuration
 * @param {Object} state - The component state
 * @param {CoralitePage} page - Active page object
 * @param {any} root - The component root element
 * @param {number} index - Index of element
 * @param {CoraliteSession} session - Rendering state
 * @param {boolean} noHydration - No hydration flag
 * @returns {Promise<void>} Resolves when slots are successfully replaced
 */
Coralite.prototype._replaceSlots = async function (id, element, module, state, page, root, index, session, noHydration) {
  const slots = module.slotElements ? module.slotElements[id] : null

  if (!slots) {
    return
  }

  const slotChildren = {}
  const slotNames = Object.keys(slots)

  for (let i = 0; i < slotNames.length; i++) {
    const slotName = slotNames[i]
    slotChildren[slotName] = []
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

    const slotIndex = slot.element.parent.children.indexOf(slot.element)

    const emptySlot = slotNodes.filter(node => {
      return node.type !== 'text' || (node.data && node.data.trim().length > 0)
    })

    if (!emptySlot.length) {
      slotNodes = slot.element.children || []
    } else {
      const startIndex = slotNodes.length - 1

      for (let i = startIndex; i > -1; i--) {
        const node = slotNodes[i]

        if (node.name) {
          const slotComponentItem = this.components.getItem(node.name)

          if (slotComponentItem) {
            const slotContextId = session.generateId(node.name)
            const currentProperties = session.state[slotContextId] || {}
            const attribValues = cleanKeys(node.attribs)

            if (typeof node.attribs === 'object') {
              session.state[slotContextId] = {
                ...currentProperties,
                ...state,
                ...attribValues
              }
            } else {
              session.state[slotContextId] = Object.assign(currentProperties, state)
            }

            const childNoHydration = noHydration || (node.attribs && 'no-hydration' in node.attribs)

            const componentElement = await this.createComponentElement({
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
                  const elementIndex = parent.children.indexOf(node)
                  if (elementIndex !== -1) {
                    for (let j = 0; j < componentElement.children.length; j++) {
                      componentElement.children[j].parent = parent
                    }
                    parent.children.splice(elementIndex, 1, ...componentElement.children)
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


/**
 * Generates a custom module linker callback for the Node.js VM context.
 * This linker is responsible for resolving `import` statements inside evaluated
 * component scripts. It intercepts specific specifiers to provide synthetic modules
 * for `coralite` and plugins, correctly resolves relative paths against
 * the component's directory, and safely bridges external Node.js modules into the VM sandbox.
 *
 * @internal
 * @param {CoraliteFilePath} path - The file path metadata of the component currently being evaluated. Used as the base for relative imports.
 * @param {CoralitePluginContext} context - Contextual rendering data and state to be exposed when a script imports `'coralite'`.
 * @returns {(specifier: string, referencingModule: import('node:vm').Module, extra: { attributes: any }) => Promise<import('node:vm').Module>} The async linker function used by the VM module.
 */
Coralite.prototype._moduleLinker = function (path, context) {
  const source = this._source
  const componentDirURL = pathToFileURL(resolve(path.dirname)).href

  /**
   * The linker callback invoked by the Node.js VM when an `import` is encountered.
   *
   * @param {string} specifier - The string path of the requested module (e.g., `'./utils.js'`, `'coralite'`).
   * @param {import('node:vm').Module} referencingModule - The VM Module instance that initiated the import request.
   * @param {{ attributes: Record<string, string> }} extra - Additional import constraints, such as import attributes (e.g., `with { type: 'json' }`).
   * @returns {Promise<import('node:vm').Module>} A promise that resolves to a newly instantiated VM SourceTextModule containing the requested exports.
   */
  return async (specifier, referencingModule, extra) => {
    const { SourceTextModule } = await import('node:vm')
    const originalSpecifier = specifier

    if (source.plugins[specifier]) {
      const plugin = source.plugins[specifier]
      let pluginExports = ''

      for (const key in plugin) {
        if (Object.prototype.hasOwnProperty.call(plugin, key)) {
          pluginExports += `export const ${key} = globalThis.__coralite_plugins__["${specifier}"]["${key}"];\n`
        }
      }

      return new SourceTextModule(pluginExports, {
        context: referencingModule.context
      })
    } else if (specifier == 'coralite/utils') {
      const utils = source.utils
      let utilsExports = ''

      utilsExports = 'const utils = globalThis.__coralite_utils__; export default utils;'

      for (const key in utils) {
        if (Object.prototype.hasOwnProperty.call(utils, key)) {
          utilsExports += `export const ${key} = utils["${key}"];\n`
        }
      }

      return new SourceTextModule(utilsExports, {
        context: referencingModule.context
      })
    } else if (specifier === 'coralite') {
      let coraliteExports = 'const context = globalThis.__coralite_context__; export default context;'

      for (const key in context) {
        if (Object.prototype.hasOwnProperty.call(context, key)) {
          coraliteExports += `export const ${key} = context["${key}"];\n`
        }
      }

      coraliteExports += 'export const defineComponent = globalThis.__coralite_define_component__;\n'

      return new SourceTextModule(coraliteExports, {
        context: referencingModule.context
      })
    } else if (specifier.startsWith('.')) {
      // handle relative path
      specifier = pathToFileURL(resolve(path.dirname, specifier)).href
    } else {
      // handle modules
      specifier = import.meta.resolve(specifier, componentDirURL)
    }

    try {
      let module
      if (extra.attributes && Object.keys(extra.attributes).length > 0) {
        module = await import(specifier, { with: extra.attributes })
      } else {
        module = await import(specifier)
      }
      let exportModule = ''

      for (const key in module) {
        if (Object.prototype.hasOwnProperty.call(module, key)) {
          const name = 'globalThis["' + originalSpecifier + '"].'

          if (key === 'default') {
            exportModule += 'export default ' + name + key + ';\n'
          } else {
            exportModule += 'export const ' + key + ' = ' + name + key + ';\n'
          }
        }

        referencingModule.context[originalSpecifier] = module
      }

      const { SourceTextModule } = await import('node:vm')

      return new SourceTextModule(exportModule, {
        context: referencingModule.context
      })
    } catch (error) {
      throw new Error(error)
    }
  }
}

/**
 * Parses a Coralite module script and evaluates it using SourceTextModule.
 *
 * @param {Object} data
 * @param {CoraliteModule} data.module - The Coralite module to parse
 * @param {CoraliteModuleDefinitions} data.state - Replacement tokens for the component
 * @param {CoralitePage} data.page - The global page object
 * @param {any} data.root - The Coralite module to parse
 * @param {string} data.contextId - Context Id
 * @param {CoraliteSession} data.session - Render Context
 * @param {boolean} data.noHydration - No hydration flag
 *
 * @returns {Promise<CoraliteModuleDefinitions>}
 */
Coralite.prototype._evaluateDevelopment = async function ({
  module,
  state,
  page,
  root,
  contextId,
  session,
  noHydration
}) {
  const { SourceTextModule } = await import('node:vm')

  if (!SourceTextModule) {
    throw new Error('SourceTextModule is not available. Please run Node.js with --experimental-vm-modules to use Development mode.')
  }

  const context = {
    state: state || {},
    page,
    root,
    module,
    id: contextId,
    session,
    app: this,
    noHydration
  }

  const cachedBoundPlugins = this._bindPlugins(this._source.plugins, context)

  session.source.currentSourceContextId = contextId
  session.source.contextInstances[contextId] = context

  const boundDefineComponent = (options) => this._defineComponent(options, context)

  // Protect fundamental constructors from being extracted and polluting the context realm
  const standardBuiltIns = new Set(['Object', 'Function', 'Array', 'String', 'Boolean', 'Number', 'Math', 'Date', 'RegExp', 'Error', 'EvalError', 'RangeError', 'ReferenceError', 'SyntaxError', 'TypeError', 'URIError', 'JSON', 'Promise', 'Proxy', 'Reflect', 'Map', 'Set', 'WeakMap', 'WeakSet', 'ArrayBuffer', 'SharedArrayBuffer', 'DataView', 'Atomics', 'Int8Array', 'Uint8Array', 'Uint8ClampedArray', 'Int16Array', 'Uint16Array', 'Int32Array', 'Uint32Array', 'Float32Array', 'Float64Array', 'BigInt', 'BigInt64Array', 'BigUint64Array', 'Symbol', 'Infinity', 'NaN', 'undefined', 'globalThis', 'decodeURI', 'decodeURIComponent', 'encodeURI', 'encodeURIComponent', 'escape', 'eval', 'isFinite', 'isNaN', 'parseFloat', 'parseInt', 'unescape'])
  const usedGlobals = extractGlobals(module.script)
  const contextGlobals = {
    __coralite_context__: context,
    __coralite_plugins__: cachedBoundPlugins,
    __coralite_utils__: this._source.utils,
    __coralite_define_component__: boundDefineComponent
  }

  for (const glob of usedGlobals) {
    if (!standardBuiltIns.has(glob) && glob in globalThis && globalThis[glob] !== undefined && !(glob in contextGlobals)) {
      contextGlobals[glob] = globalThis[glob]
    }
  }

  // Create a fresh context for the module
  const contextifiedObject = createContext(contextGlobals)

  const moduleComponent = this.components.getItem(module.id)

  // create a new source text module with the provided script content, configuration options, and context
  const script = new SourceTextModule(module.script, {
    initializeImportMeta (meta) {
      meta.url = pathToFileURL(resolve(moduleComponent.path.pathname)).href
    },
    lineOffset: module.lineOffset,
    identifier: resolve(moduleComponent.path.pathname),
    context: contextifiedObject
  })

  const linker = this._moduleLinker(moduleComponent.path, context)

  await script.link(linker)

  // evaluate the module to execute its content
  try {
    await script.evaluate()
  } catch (error) {
    throw this._createExecutionError(error, module, moduleComponent, page, contextId)
  }

  // @ts-ignore
  if (script.namespace.default != null) {
    // @ts-ignore
    return await script.namespace.default
  }

  // throw an error if no default export was found
  throw new Error(`Module "${module.id}" has no default export`)
}

/**
 * Parses a Coralite module script and compiles it into JavaScript using esbuild.
 * Replaces node:vm SourceTextModule for better performance and memory management.
 *
 * @param {Object} data
 * @param {CoraliteModule} data.module - The Coralite module to parse
 * @param {CoraliteModuleDefinitions} data.state - Replacement tokens for the component
 * @param {CoralitePage} data.page - The global page object
 * @param {any} data.root - The Coralite module to parse
 * @param {string} data.contextId - Context Id
 * @param {CoraliteSession} data.session - Render Context
 * @param {boolean} data.noHydration - No hydration flag
 *
 * @returns {Promise<CoraliteModuleDefinitions>}
 */
Coralite.prototype._evaluateProduction = async function ({
  module,
  state,
  page,
  root,
  contextId,
  session,
  noHydration
}) {
  const context = {
    state: state || {},
    page,
    root,
    module,
    id: contextId,
    session,
    app: this,
    noHydration
  }

  session.source.currentSourceContextId = contextId
  session.source.contextInstances[contextId] = context

  // Retrieve Template and check cache
  const moduleComponent = this.components.getItem(module.id)

  if (!moduleComponent.result._compiledCode) {
    const paddingCount = Math.max(0, (module.lineOffset - 1 || 0))
    const padding = '\n'.repeat(paddingCount)

    // Transform using esbuild
    const { code } = await transform(padding + module.script, {
      loader: 'js',
      format: 'cjs',
      target: 'node18',
      platform: 'node'
    })

    moduleComponent.result._compiledCode = `(async() => {${code}})();`
  }

  // Create a require function anchored to the moduleComponent's file path to resolve relative imports
  const fileRequire = createRequire(resolve(moduleComponent.path.pathname))

  let cachedBoundPlugins = null

  const customRequire = (id) => {
    const isCoralite = id === 'coralite'
    const isUtils = id === 'coralite/utils'
    const isPlugin = this._source.plugins[id] !== undefined

    // Handle internal coralite imports
    if (isCoralite || isUtils || isPlugin) {
      // Lazily bind plugins once per evaluation
      if (!cachedBoundPlugins) {
        cachedBoundPlugins = this._bindPlugins(this._source.plugins, context)
      }

      if (isCoralite) {
        return {
          ...context,
          defineComponent: (options) => this._defineComponent(options, context),
          default: {
            ...context,
            defineComponent: (options) => this._defineComponent(options, context)
          }
        }
      }

      if (isPlugin) {
        return {
          ...(cachedBoundPlugins[id] || {}),
          default: cachedBoundPlugins[id]
        }
      }

      if (isUtils) {
        return {
          ...this._source.utils,
          default: this._source.utils
        }
      }
    }

    return fileRequire(id)
  }

  // Mock the CommonJS 'module' object to capture exports
  const moduleMock = { exports: {} }

  // Create the function. We pass 'coralite' explicitly to support the
  // "export const document = coralite.document" pattern found in existing modules.
  // Arguments: module, exports, require, coralite
  if (!moduleComponent.result._compiledFunction) {
    moduleComponent.result._compiledFunction = new Function(
      'module',
      'exports',
      'require',
      'coralite',
      moduleComponent.result._compiledCode.trim()
    )
  }

  const fn = moduleComponent.result._compiledFunction

  // Execute the function with our mocks and context
  try {
    await fn(moduleMock, moduleMock.exports, customRequire, context)
  } catch (error) {
    throw this._createExecutionError(error, module, moduleComponent, page, contextId)
  }

  if (moduleMock.exports.default != null) {
    return moduleMock.exports.default
  }

  throw new Error(`Module "${module.id}" has no default export`)
}

/**
 * Parses a Coralite module script and compiles it into JavaScript using esbuild.
 * Replaces node:vm SourceTextModule for better performance and memory management.
 *
 * @param {Object} data -
 * @param {CoraliteModule} data.module - The Coralite module to parse
 * @param {CoraliteModuleDefinitions} data.state - Replacement tokens for the component
 * @param {CoralitePage} data.page - The global page object
 * @param {any} data.element - The Coralite module to parse
 * @param {string} data.contextId - Context Id
 * @param {CoraliteSession} data.session - Render Context
 *
 * @returns {Promise<CoraliteModuleDefinitions>}
 */
Coralite.prototype._evaluate = async function (options) {
  if (this.options.mode === 'development') {
    return this._evaluateDevelopment(options)
  }
  return this._evaluateProduction(options)
}

/**
 * Executes a collecting plugin hook where the results are aggregated.
 * Useful for hooks like `onAfterPageRender` that return new pages to be added to the build.
 *
 * @internal
 * @param {string} name - The name of the hook to trigger.
 * @param {any} contextData - Context to pass to the callbacks (not mutated by this function).
 * @returns {Promise<any[]>} A flattened array of all results returned by the plugins.
 */
Coralite.prototype._triggerPluginAggregateHook = async function (name, contextData) {
  const pluginHooks = this._plugins.hooks[name]
  const aggregatedResults = []

  if (!pluginHooks || pluginHooks.length === 0) {
    return aggregatedResults
  }

  for (let i = 0; i < pluginHooks.length; i++) {
    let result = pluginHooks[i]({
      ...contextData,
      app: this
    })

    if (result !== null && typeof result === 'object' && typeof result.then === 'function') {
      result = await result
    }

    // Collect the results into a flat array instead of merging them into the context
    if (result !== undefined && result !== null) {
      if (Array.isArray(result)) {
        aggregatedResults.push(...result)
      } else {
        aggregatedResults.push(result)
      }
    }
  }

  return aggregatedResults
}

/**
 * @internal Executes Phase 1 of plugin exports with the given context.
 *
 * @param {Object} plugins - The plugins object
 * @param {Object} context - The context object to pass to Phase 1
 * @returns {Object} The Phase 2 functions
 */
Coralite.prototype._bindPlugins = function (plugins, context) {
  const cachedBoundPlugins = {}

  for (const key in plugins) {
    const pluginExports = plugins[key]
    if (pluginExports !== null && typeof pluginExports === 'object') {
      const pluginObj = {}
      for (const prop in pluginExports) {
        if (typeof pluginExports[prop] === 'function') {
          pluginObj[prop] = pluginExports[prop](context)
        } else {
          pluginObj[prop] = pluginExports[prop]
        }
      }
      cachedBoundPlugins[key] = pluginObj
    } else {
      cachedBoundPlugins[key] = pluginExports
    }
  }

  return cachedBoundPlugins
}

/**
 * @template T
 *
 * Executes all plugin callbacks registered under the specified hook name sequentially.
 *
 * @internal
 *
 * @param {'onPageSet'|'onPageUpdate'|'onPageDelete'|'onComponentSet'|'onComponentUpdate'|'onComponentDelete'|'onBeforePageRender'|'onAfterPageRender'|'onBeforeComponentRender'|'onAfterComponentRender'|'onBeforeBuild'|'onAfterBuild'} name - The name of the hook to trigger.
 * @param {T} initialData - Data to pass to each callback function.
 * @returns {Promise<T>} A promise that resolves to the merged data.
 */
Coralite.prototype._triggerPluginHook = async function (name, initialData) {
  const pluginHooks = this._plugins.hooks[name]

  if (!pluginHooks || pluginHooks.length === 0) {
    return initialData
  }

  // Clone initial data once to prevent accidental root-level mutations
  // leaking backwards if a plugin still mutates it directly.
  let currentData = typeof initialData === 'object' && initialData !== null
    ? {
      ...initialData,
      app: this
    }
    : initialData

  for (let i = 0; i < pluginHooks.length; i++) {
    let result = pluginHooks[i](currentData)

    if (result !== null && typeof result === 'object' && typeof result.then === 'function') {
      result = await result
    }

    // If the plugin returned a patch, the framework handles the mapping
    if (result !== undefined && result !== null) {
      currentData = mergePluginState(currentData, result)
    }
  }

  return currentData
}

/**
 * Registers a callback function under the specified hook name.
 *
 * @internal
 *
 * @param {'onPageSet'|'onPageUpdate'|'onPageDelete'|'onComponentSet'|'onComponentUpdate'|'onComponentDelete'|'onBeforePageRender'|'onAfterPageRender'|'onBeforeComponentRender'|'onAfterComponentRender'|'onBeforeBuild'|'onAfterBuild'} name - The name of the hook to register the callback with.
 * @param {Function} callback - The callback function to be executed when the hook is triggered.
 */
Coralite.prototype._addPluginHook = function (name, callback) {
  if (typeof callback !== 'function') {
    throw new Error(`Plugin hook "${name}" must be a function`)
  }

  if (this._plugins.hooks[name]) {
    this._plugins.hooks[name].push(callback)
  }
}

/**
 * Replaces a custom element with its template content.
 * @internal
 * @param {CoraliteElement} coraliteElement - The custom element to be replaced.
 * @param {CoraliteElement} element - The target element to replace the tokens with.
 */
Coralite.prototype._replaceCustomElementWithTemplate = function (coraliteElement, element) {
  coraliteElement.children = element.children
  for (let j = 0; j < coraliteElement.children.length; j++) {
    coraliteElement.children[j].parent = coraliteElement
  }
}

/**
 * Process a token value - parse HTML strings and handle custom elements
 * @internal
 * @param {any} value - The value to process
 * @param {Object} context - Processing context
 * @param {Attribute[]} [context.excludeByAttribute] - List of attribute name-value pairs to ignore
 * @param {Object} [context.state] - Replacement tokens for the component
 * @param {CoraliteModule} [context.module] - The component module
 * @param {Function} [context.createComponentElement] - The createComponentElement function
 * @param {CoraliteSession} [context.session] - The current build session
 * @param {boolean} [context.noHydration] - No hydration flag
 * @returns {Promise<any>} - Processed value
 */
Coralite.prototype._processTokenValue = async function (value, context) {
  const { excludeByAttribute, state, module, createComponentElement, session, noHydration } = context
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

  // Process custom elements
  for (let i = 0; i < result.customElements.length; i++) {
    const customElement = result.customElements[i]
    const cid = `${module.path.pathname}${customElement.name}-${i}`
    const childNoHydration = noHydration || (customElement.attribs && 'no-hydration' in customElement.attribs)

    const componentElement = await createComponentElement({
      contextId: cid,
      id: customElement.name,
      state,
      element: customElement,
      module,
      index: i,
      session,
      noHydration: childNoHydration
    })

    if (componentElement) {
      if (childNoHydration) {
        const parent = customElement.parent
        if (parent && parent.children) {
          const elementIndex = parent.children.indexOf(customElement)
          if (elementIndex !== -1) {
            for (let j = 0; j < componentElement.children.length; j++) {
              componentElement.children[j].parent = parent
            }
            parent.children.splice(elementIndex, 1, ...componentElement.children)
          }
        }
      } else {
        customElement.children = componentElement.children
        for (let j = 0; j < customElement.children.length; j++) {
          customElement.children[j].parent = customElement
        }

        if (!customElement.attribs) {
          customElement.attribs = {}
        }
        customElement.attribs['data-cid'] = cid

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

/**
 * This function defines a component for the Coralite framework.
 * It is used to register components with their associated state and scripts.
 * @internal
 * @param {Object} options - Configuration options for the component
 * @param {CoralitePluginContext} context - The evaluation context
 * @returns {Promise<Object>} A promise resolving to the module state associated with this component.
 */
Coralite.prototype._defineComponent = async function (options, context) {
  const {
    attributes,
    data,
    getters,
    slots,
    script
  } = options

  const {
    state: initialState,
    module,
    root
  } = context

  // Validate attributes
  if (attributes) {
    for (const [key, value] of Object.entries(attributes)) {
      if (value.type === Object || value.type === Array) {
        throw new Error(`Coralite Error: Component "${module.id}" defines attribute "${key}" as ${value.type.name}. Object and Array types are blocked in attributes for V1.1 to prevent "JSON-in-HTML" anti-patterns. Use the data() block for complex data.`)
      }
    }
  }

  let state = Object.assign({}, initialState)

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
        // Coerce existing attribute values
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
    const dataResult = await data(context)
    if (dataResult) {
      state.__script__.data = dataResult
      Object.assign(state, dataResult)
      // Ensure data results are added to state.__script__.state for serialization to client
      Object.assign(state.__script__.state, dataResult)
    }
  }

  if (getters) {
    const roState = createReadOnlyProxy(state)
    for (const [key, getter] of Object.entries(getters)) {
      // Ensure getters use read-only proxy to preemptively throw error if developer attempts to mutate the state.
      const result = getter(roState, { signal: new AbortController().signal })

      if (result && typeof result.then === 'function') {
        state[key] = await result
      } else {
        state[key] = result
      }

      // Add getter result to state.__script__.state so it's serialized to the client
      if (state.__script__ && state.__script__.state) {
        state.__script__.state[key] = state[key]
      }
    }
  }

  // process computed slots
  if (slots) {
    for (const name in slots) {
      if (Object.prototype.hasOwnProperty.call(slots, name)) {
        const computedSlot = slots[name]

        const methodKey = `slots_method_${name}`
        state.__script__.defaultValues[methodKey] = computedSlot

        // slot content to compute
        const slotContent = []
        // new slot elements
        const elementSlots = []

        // @ts-ignore
        if (root && root.slots) {
          // @ts-ignore
          for (let j = 0; j < root.slots.length; j++) {
            // @ts-ignore
            const slot = root.slots[j]

            if (slot.name === name) {
              // slot content to compute
              slotContent.push(slot.node)
            } else {
              elementSlots.push(slot)
            }
          }
        }

        // compute slot nodes
        const result = computedSlot(slotContent, state) || slotContent

        // append new slot nodes
        if (typeof result === 'string') {
          // process string result through unified processor
          const processedResult = await this._processTokenValue(result, {
            ...context,
            state,
            createComponentElement: context.app.createComponentElement,
            noHydration: context.noHydration
          })

          if (Array.isArray(processedResult)) {
            // multiple nodes from parsed HTML
            for (let j = 0; j < processedResult.length; j++) {
              elementSlots.push({
                name,
                node: processedResult[j]
              })
            }
          } else {
            // single text node
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

            if (
              isCoraliteElement(node)
                || isCoraliteTextNode(node)
                || isCoraliteComment(node)
            ) {
              elementSlots.push({
                name,
                node
              })
            } else {
              throw new Error('Unexpected slot value, expected a node but found: '
                  + '\n result: ' + JSON.stringify(node)
                  + '\n path: "' + module.path.pathname + '"')
            }
          }
        }

        // update element slots
        if (root) {
          // @ts-ignore
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

      // include state used in script
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
    // remove custom element parent script
    delete state.__script__
  }

  return state
}

const coraliteInternalProperty = {
  enumerable: false,
  configurable: false,
  writable: false
}

Object.defineProperty(Coralite.prototype, '_defaultOnError', coraliteInternalProperty)
Object.defineProperty(Coralite.prototype, '_handleError', coraliteInternalProperty)
Object.defineProperty(Coralite.prototype, '_createExecutionError', coraliteInternalProperty)
Object.defineProperty(Coralite.prototype, '_createSession', coraliteInternalProperty)
Object.defineProperty(Coralite.prototype, '_processCustomElementsInPage', coraliteInternalProperty)
Object.defineProperty(Coralite.prototype, '_generatePages', coraliteInternalProperty)
Object.defineProperty(Coralite.prototype, '_processDependentComponents', coraliteInternalProperty)
Object.defineProperty(Coralite.prototype, '_replaceSlots', coraliteInternalProperty)
Object.defineProperty(Coralite.prototype, '_moduleLinker', coraliteInternalProperty)
Object.defineProperty(Coralite.prototype, '_evaluateDevelopment', coraliteInternalProperty)
Object.defineProperty(Coralite.prototype, '_evaluateProduction', coraliteInternalProperty)
Object.defineProperty(Coralite.prototype, '_evaluate', coraliteInternalProperty)
Object.defineProperty(Coralite.prototype, '_triggerPluginAggregateHook', coraliteInternalProperty)
Object.defineProperty(Coralite.prototype, '_triggerPluginHook', coraliteInternalProperty)
Object.defineProperty(Coralite.prototype, '_bindPlugins', coraliteInternalProperty)
Object.defineProperty(Coralite.prototype, '_addPluginHook', coraliteInternalProperty)
Object.defineProperty(Coralite.prototype, '_replaceCustomElementWithTemplate', coraliteInternalProperty)
Object.defineProperty(Coralite.prototype, '_processTokenValue', coraliteInternalProperty)
Object.defineProperty(Coralite.prototype, '_defineComponent', coraliteInternalProperty)

export default Coralite
