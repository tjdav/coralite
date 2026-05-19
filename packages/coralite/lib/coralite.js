import { cleanKeys, cloneModuleInstance, replaceToken, cloneComponentInstance, findAndExtractScript, findAndExtractProperties, extractGlobals, mergePluginState, findAndExtractImperativeComponents } from './utils.js'
import { getHtmlFile, getHtmlFiles } from './html.js'
import { findHeadAndBody, injectStyles, injectReadinessScript, injectImportMap, removeElements, resolvePageQueue } from './render-helpers.js'
import { generateClientRuntime } from './client-runtime.js'
import { parseHTML, parseModule, createElement, createTextNode } from './parse.js'
import { transformCss } from './style-transform.js'
import { ScriptManager } from './script-manager.js'
import { defineComponent, metadataPlugin, refsPlugin, staticAssetPlugin, testingPlugin } from '#plugins'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, normalize, relative, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { transform } from 'esbuild'
import { isCoraliteElement, isCoraliteCollectionItem } from './type-helper.js'
import { CoraliteError } from './errors.js'
import { pathToFileURL } from 'node:url'
import { availableParallelism } from 'node:os'
import render from 'dom-serializer'
import pLimit from 'p-limit'
import { createCoraliteElement, createCoraliteTextNode } from './dom.js'
import CoraliteCollection from './collection.js'
import { randomUUID } from 'node:crypto'
import { createContext } from 'node:vm'

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
 *  CoralitePage
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
  plugins.unshift(defineComponent, refsPlugin, metadataPlugin)

  if (assets) {
    plugins.unshift(staticAssetPlugin(assets))
  }

  const source = this._source
  // iterate over each plugin and register its hooks and modules in the Coralite source context.
  for (let i = 0; i < plugins.length; i++) {
    const plugin = plugins[i]

    // set plugin method
    if (plugin.exports !== undefined) {
      source.plugins[plugin.name] = plugin.exports
    }

    // queue any components provided by the plugin to be registered.
    if (plugin.components && Array.isArray(plugin.components)) {
      for (let i = 0; i < plugin.components.length; i++) {
        this._plugins.components.push(plugin.components[i])
      }
    }

    // add the plugin's hooks to the appropriate Coralite hook lists.
    if (plugin.onPageSet) {
      this._addPluginHook('onPageSet', plugin.onPageSet)
    }
    if (plugin.onPageDelete) {
      this._addPluginHook('onPageDelete', plugin.onPageDelete)
    }
    if (plugin.onPageUpdate) {
      this._addPluginHook('onPageUpdate', plugin.onPageUpdate)
    }
    if (plugin.onComponentSet) {
      this._addPluginHook('onComponentSet', plugin.onComponentSet)
    }
    if (plugin.onComponentDelete) {
      this._addPluginHook('onComponentDelete', plugin.onComponentDelete)
    }
    if (plugin.onComponentUpdate) {
      this._addPluginHook('onComponentUpdate', plugin.onComponentUpdate)
    }
    if (plugin.onBeforePageRender) {
      this._addPluginHook('onBeforePageRender', plugin.onBeforePageRender)
    }
    if (plugin.onAfterPageRender) {
      this._addPluginHook('onAfterPageRender', plugin.onAfterPageRender)
    }
    if (plugin.onBeforeBuild) {
      this._addPluginHook('onBeforeBuild', plugin.onBeforeBuild)
    }
    if (plugin.onAfterBuild) {
      this._addPluginHook('onAfterBuild', plugin.onAfterBuild)
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
      const component = parseModule(value.content, {
        ignoreByAttribute: this.options.ignoreByAttribute,
        skipRenderByAttribute: this.options.skipRenderByAttribute,
        onError: (errorData) => this._handleError(errorData)
      })

      // abort component update
      if (!component.isTemplate) {
        return
      }

      const mappedComponent = await this._triggerPluginHook('onComponentUpdate', component)

      return mappedComponent
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

    // track parent-child relationship between custom elements
    for (let i = 0; i < elements.customElements.length; i++) {
      const customElement = elements.customElements[i]
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

    const mappedContext = await this._triggerPluginHook('onPageSet', {
      elements,
      state: state,
      page,
      data
    })

    return {
      type: 'page',
      value: {
        state: mappedContext.state,
        page: mappedContext.page,
        path: mappedContext.data.path,
        root: mappedContext.elements.root,
        customElements: mappedContext.elements.customElements,
        tempElements: mappedContext.elements.tempElements,
        skipRenderElements: mappedContext.elements.skipRenderElements
      }
    }
  }

  const onPageUpdate = async (newValue, oldValue) => {
    let newCustomElements

    if (!newValue.result) {
      const result = await onFileSet(newValue)

      newValue.result = result.value
      newCustomElements = result.value.customElements
    } else {
      newCustomElements = newValue.result.customElements
    }

    let oldElements = oldValue.result.customElements.slice()

    const mappedContext = await this._triggerPluginHook('onPageUpdate', {
      elements: newValue.result,
      page: newValue.result.page,
      newValue,
      oldValue
    })

    // Assign back the mapped elements to result so that rendering uses the updated AST and state
    newValue.result = mappedContext.elements
    newValue = mappedContext.newValue
    oldValue = mappedContext.oldValue

    for (let i = 0; i < newCustomElements.length; i++) {
      const newElement = newCustomElements[i]

      let hasElement = false

      for (let i = 0; i < oldElements.length; i++) {
        const oldElement = oldElements[i]

        if (newElement.name === oldElement.name) {
          hasElement = true
          oldElements.splice(i, 1)
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

  /** @type {CoraliteCollection} */
  await getHtmlFiles({
    path: this.options.pages,
    recursive: true,
    type: 'page',
    discoverOnly: this.options.mode === 'production',
    collection: this.pages
  })
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
 * @returns {Object}
 */
Coralite.prototype._createRenderContext = function (buildId) {
  return {
    buildId,
    state: {},
    styles: new Map(),
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
 * @param {Object} mappedRenderContextObject - Global rendering state
 * @returns {Promise<void>} Resolves when the elements are processed
 */
Coralite.prototype._processCustomElementsInPage = async function (mappedComponent, originalDocument, state, mappedRenderContextObject, pageContext) {
  for (let i = 0; i < mappedComponent.customElements.length; i++) {
    const customElement = mappedComponent.customElements[i]

    const contextId = mappedComponent.path.pathname + i + customElement.name
    const currentProperties = mappedRenderContextObject.state[contextId] || {}

    if (typeof customElement.attribs === 'object') {
      mappedRenderContextObject.state[contextId] = {
        ...currentProperties,
        ...state,
        ...mappedComponent.state,
        ...customElement.attribs
      }
    } else {
      mappedRenderContextObject.state[contextId] = Object.assign(
        Object.assign(Object.assign({}, currentProperties, state), mappedComponent.state)
      )
    }

    const componentElement = await this.createComponentElement({
      id: customElement.name,
      state: mappedRenderContextObject.state[contextId],
      element: customElement,
      page: pageContext || originalDocument.page,
      root: mappedComponent.root,
      contextId,
      index: i,
      renderContext: mappedRenderContextObject
    })

    if (componentElement) {
      for (let i = 0; i < componentElement.children.length; i++) {
        componentElement.children[i].parent = customElement.parent
      }

      const index = customElement.parent.children.indexOf(customElement, customElement.parentChildIndex)
      customElement.parent.children.splice(index, 1, ...componentElement.children)
    }
  }
}

Coralite.prototype._generatePages = async function* (path, state = {}) {
  const queue = resolvePageQueue(this.pages, path)

  const buildId = randomUUID()
  this._renderQueues.set(buildId, queue)
  const scriptResultCache = new Map()

  try {
    const queue = this._renderQueues.get(buildId)

    for (let q = 0; q < queue.length; q++) {
      const startTime = performance.now()

      /** @type {CoraliteComponent & CoraliteComponentResult} */
      const originalDocument = queue[q].result

      /** @type {CoraliteComponent & CoraliteComponentResult} */
      // @ts-ignore
      let component
      let pageContext = originalDocument.page

      // If the page was discovery-only initialized (no root AST), parse it on-demand
      if (!originalDocument.root) {
        let content = queue[q].content
        if (!content) {
          content = await getHtmlFile(queue[q].path.pathname)
        }

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
          data: queue[q]
        })

        const fullPath = Object.assign({}, mappedContext.data.path, {
          pages: this.options.path.pages,
          components: this.options.path.components
        })
        /** @type {CoraliteComponent & CoraliteComponentResult} */
        // @ts-ignore
        component = {
          // @ts-ignore
          state: mappedContext.state,
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
      }

      // Merge state into component
      Object.assign(component.state, state)

      // Initialize Render Context
      const renderContext = this._createRenderContext(buildId)
      renderContext.mode = this.options.mode

      const mappedRenderContext = await this._triggerPluginHook('onBeforePageRender', {
        component,
        state,
        page: pageContext,
        renderContext
      })

      const mappedComponent = mappedRenderContext.component
      const mappedRenderContextObject = mappedRenderContext.renderContext

      // reassign the top-level state object in case it was modified
      state = mappedRenderContext.state

      // remove temporary elements
      removeElements(mappedComponent.tempElements, false)

      await this._processCustomElementsInPage(mappedComponent, originalDocument, state, mappedRenderContextObject, pageContext)

      const { head: headElement, body: bodyElement } = findHeadAndBody(mappedComponent.root)

      if (mappedRenderContextObject.styles.size > 0) {
        injectStyles(mappedComponent.root, headElement, mappedRenderContextObject.styles)
      }

      if (mappedRenderContextObject.scripts.content[mappedComponent.path.pathname]) {
        const scripts = mappedRenderContextObject.scripts.content[mappedComponent.path.pathname]

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
          // Use script manager to compile all instances
          scriptResult = await this._scriptManager.compileAllInstances(instances, this.options.mode)
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
          chunkManifest,
          instances,
          mode: this.options.mode,
          renderContext: mappedRenderContextObject
        })

        const hydrationData = {}
        for (const [id, instance] of Object.entries(instances)) {
          const contextId = instance.instanceId
          if (mappedRenderContextObject && mappedRenderContextObject.source && mappedRenderContextObject.source.contextInstances[contextId]) {
            const coraliteContext = mappedRenderContextObject.source.contextInstances[contextId]
            if (coraliteContext.state.__script__ && coraliteContext.state.__script__.data) {
              hydrationData[contextId] = coraliteContext.state.__script__.data
            }
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

      if (!mappedRenderContextObject.scripts.content[mappedComponent.path.pathname]) {
        injectReadinessScript(mappedComponent.root, headElement, false)
      }

      let rawHTML = ''
      // render document
      rawHTML = this.transform(mappedComponent.root)

      yield {
        type: 'page',
        path: mappedComponent.path,
        content: rawHTML,
        duration: performance.now() - startTime
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
        const additionalPages = await this._triggerPluginAggregateHook('onAfterPageRender', result)

        const items = [result]

        // Process any dynamically generated pages returned by the plugins
        for (const newPage of additionalPages) {
          if (newPage && newPage.path && newPage.content) {
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

  const results = await this.build(path, options, async (result) => {
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

    return {
      path: outFile,
      duration: result.duration
    }
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
 * @param {Object} renderContext - The current build render context.
 * @param {CoralitePage} page - The global page object
 * @param {CoraliteComponentRoot} root - The root element of the component
 * @param {Object} state - The current token state and state available
 * @returns {Promise<void>}
 */
Coralite.prototype._processDependentComponents = async function (componentIds, renderContext, page, root, state = {}) {
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
          renderContext
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
        ...state,
        ...scriptResult
      }
      delete inheritedState.__script__

      await this._processDependentComponents(nestedComponents, renderContext, page, root, inheritedState)
    }
  }
}

/**
 * @param {Object} options
 * @param {string} options.id - id - Unique identifier for the component
 * @param {CoraliteModuleDefinitions} [options.state={}] - Token state available for replacement
 * @param {CoraliteElement} [options.element] - Mapping of component IDs to their module definitions
 * @param {CoralitePage} options.page - The global page object
 * @param {CoraliteComponentRoot} options.root - The root element of the component
 * @param {string} [options.contextId] - Context Id
 * @param {number} [options.index] - Context index
 * @param {Object} [options.renderContext] - Render Context
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
  renderContext
}, head = true) {
  if (!renderContext) {
    renderContext = this._createRenderContext()
  }

  const moduleComponent = this.components.getItem(id)

  if (!moduleComponent) {
    return
  }

  if (head) {
    if (element && element.attribs) {
      state = Object.assign(state, element.attribs)
    }

    // convert object keys to camel case format for consistent naming conventions
    state = cleanKeys(state)
  }

  if (!contextId) {
    contextId = moduleComponent.path.pathname + id
  }

  /**
   * clone the component to avoid mutations during replacement process.
   * @type {CoraliteModule}
   */
  const module = cloneModuleInstance(moduleComponent.result)
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

    // Add styles to renderContext (idempotent for the build)
    if (!renderContext.styles.has(selector)) {
      renderContext.styles.set(selector, moduleComponent.result._processedCss)
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
      scriptResult = await this._evaluate({
        module,
        element,
        state,
        page,
        root: element || root,
        contextId,
        renderContext
      })
    } catch (error) {
      throw this._createExecutionError(error, module, moduleComponent, page, contextId)
    }

    if (scriptResult.__script__ != null) {
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
      if (state) {
        for (const token of Object.keys(componentTokens)) {
          if (componentDefaultValues[token] === undefined && state[token] !== undefined) {
            componentDefaultValues[token] = state[token]
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
        const inheritedState = Object.assign({}, state, scriptResult)
        delete inheritedState.__script__

        await this._processDependentComponents(mergedComponents, renderContext, page, root, inheritedState)
      }

      // Ensure state object exists in scriptResult
      if (!scriptResult.__script__.state) {
        scriptResult.__script__.state = {}
      }

      for (let i = 0; i < module.values.refs.length; i++) {
        const ref = module.values.refs[i]
        const uniqueRefValue = `${module.id}__${ref.name}-${index}`

        // Update the ref attribute value to be unique
        ref.element.attribs.ref = uniqueRefValue
        if (ref.element.attribs['data-testid']) {
          ref.element.attribs['data-testid'] = uniqueRefValue
        }

        // inject flat token into script instance state
        scriptResult.__script__.state[`ref_${ref.name}`] = uniqueRefValue
      }

      // Store instance data for script manager
      renderContext.scripts.add(page.file.pathname, {
        id: contextId,
        componentId: module.id,
        page,
        state: scriptResult.__script__.state
      })

      delete scriptResult.__script__
    }

    state = Object.assign(state, scriptResult)
    renderContext.state[contextId] = state
  }

  // append ref objects to state
  for (let i = 0; i < module.values.refs.length; i++) {
    const ref = module.values.refs[i]
    const refValue = `${module.id}__${ref.name}-${index}`

    state[`ref_${ref.name}`] = refValue

    if (ref.element && ref.element.attribs && ref.element.attribs['data-testid'] === ref.name) {
      ref.element.attribs['data-testid'] = refValue
    }
  }

  // replace tokens in the component with their state from `state` object and store them into computed value array for later use if needed (e.g., to be injected back).
  for (let i = 0; i < module.values.attributes.length; i++) {
    const item = module.values.attributes[i]

    for (let i = 0; i < item.tokens.length; i++) {
      const token = item.tokens[i]
      let value = state[token.name]

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

    for (let i = 0; i < item.tokens.length; i++) {
      const token = item.tokens[i]
      let value = state[token.name]

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
      for (let i = 0; i < customElement.children.length; i++) {
        const node = customElement.children[i]
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

    const childContextId = contextId + i + customElement.name
    const currentProperties = renderContext.state[childContextId] || {}

    // append custom attributes to state
    if (typeof customElement.attribs === 'object') {
      const attribValues = cleanKeys(customElement.attribs)

      renderContext.state[childContextId] = {
        ...currentProperties,
        ...state,
        ...attribValues
      }
    } else {
      renderContext.state[childContextId] = Object.assign(currentProperties, state)
    }

    createComponentTasks.push(
      this.createComponentElement({
        id: customElement.name,
        state: renderContext.state[childContextId],
        element: customElement,
        page,
        root,
        contextId: childContextId,
        index,
        renderContext
      }, false).then(childComponentElement => ({
        childComponentElement,
        customElement
      }))
    )
  }

  const results = await Promise.all(createComponentTasks)

  for (let i = 0; i < results.length; i++) {
    const { childComponentElement, customElement } = results[i]
    const children = customElement.parent.children

    if (!childIndex) {
      childIndex = customElement.parentChildIndex
    } else {
      childIndex = children.indexOf(customElement, customElement.parentChildIndex)
    }

    // replace custom element with component
    if (childComponentElement && typeof childComponentElement === 'object') {
      children.splice(childIndex, 1, ...childComponentElement.children)
    }
  }

  await this._replaceSlots(id, element, module, contextId, state, page, root, index, renderContext)

  return result
}


/**
 * Replaces slot elements in a component with provided content
 * @internal
 * @param {string} id - Component ID
 * @param {CoraliteElement} element - The original Custom Element node
 * @param {CoraliteModule} module - The component module configuration
 * @param {string} contextId - Instance context ID
 * @param {Object} state - The component state
 * @param {CoralitePage} page - Active page object
 * @param {CoraliteComponentRoot} root - The component root element
 * @param {number} index - Index of element
 * @param {Object} renderContext - Rendering state
 * @returns {Promise<void>} Resolves when slots are successfully replaced
 */
Coralite.prototype._replaceSlots = async function (id, element, module, contextId, state, page, root, index, renderContext) {
  const slots = module.slotElements[id]

  if (!slots) {
    return
  }

  const slotChildren = {}
  const slotNames = Object.keys(slots)

  for (let i = 0; i < slotNames.length; i++) {
    const slotName = slotNames[i]
    slotChildren[slotName] = []
  }

  if (element) {
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
            const slotContextId = contextId + slotName + i + node.name
            const currentProperties = renderContext.state[slotContextId] || {}
            const attribValues = cleanKeys(node.attribs)

            if (typeof node.attribs === 'object') {
              renderContext.state[slotContextId] = {
                ...currentProperties,
                ...state,
                ...attribValues
              }
            } else {
              renderContext.state[slotContextId] = Object.assign(currentProperties, state)
            }

            const componentElement = await this.createComponentElement({
              id: node.name,
              state: renderContext.state[slotContextId],
              element: node,
              page,
              root,
              contextId: slotContextId,
              index,
              renderContext
            }, false)

            if (componentElement) {
              slotNodes.splice(i, 1, ...componentElement.children)
            }
          }
        }
      }
    }

    slot.element.parent.children.splice(slotIndex, 1, ...slotNodes)
  }
}


/**
 * Generates a custom module linker callback for the Node.js VM context.
 * This linker is responsible for resolving `import` statements inside evaluated
 * component scripts. It intercepts specific specifiers to provide synthetic modules
 * for `coralite` and `coralite/plugins`, correctly resolves relative paths against
 * the component's directory, and safely bridges external Node.js modules into the VM sandbox.
 *
 * @internal
 * @param {CoraliteFilePath} path - The file path metadata of the component currently being evaluated. Used as the base for relative imports.
 * @param {Object.<string, any>} context - Contextual rendering data and state to be exposed when a script imports `'coralite'`.
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

    if (specifier == 'coralite/plugins') {
      const plugins = source.plugins
      let pluginExports = ''

      pluginExports = 'const plugins = globalThis.__coralite_plugins__; export default plugins;'

      for (const key in plugins) {
        if (Object.prototype.hasOwnProperty.call(plugins, key)) {
          pluginExports += `export const ${key} = plugins["${key}"];\n`
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
 * @param {CoraliteElement} data.root - The Coralite module to parse
 * @param {string} data.contextId - Context Id
 * @param {Object} data.renderContext - Render Context
 *
 * @returns {Promise<CoraliteModuleDefinitions>}
 */
Coralite.prototype._evaluateDevelopment = async function ({
  module,
  state,
  page,
  root,
  contextId,
  renderContext
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
    renderContext,
    app: this
  }

  const cachedBoundPlugins = this._bindPlugins(this._source.plugins, context)

  renderContext.source.currentSourceContextId = contextId
  renderContext.source.contextInstances[contextId] = context

  context.defineComponent = cachedBoundPlugins.defineComponent

  // Protect fundamental constructors from being extracted and polluting the context realm
  const standardBuiltIns = new Set(['Object', 'Function', 'Array', 'String', 'Boolean', 'Number', 'Math', 'Date', 'RegExp', 'Error', 'EvalError', 'RangeError', 'ReferenceError', 'SyntaxError', 'TypeError', 'URIError', 'JSON', 'Promise', 'Proxy', 'Reflect', 'Map', 'Set', 'WeakMap', 'WeakSet', 'ArrayBuffer', 'SharedArrayBuffer', 'DataView', 'Atomics', 'Int8Array', 'Uint8Array', 'Uint8ClampedArray', 'Int16Array', 'Uint16Array', 'Int32Array', 'Uint32Array', 'Float32Array', 'Float64Array', 'BigInt', 'BigInt64Array', 'BigUint64Array', 'Symbol', 'Infinity', 'NaN', 'undefined', 'globalThis', 'decodeURI', 'decodeURIComponent', 'encodeURI', 'encodeURIComponent', 'escape', 'eval', 'isFinite', 'isNaN', 'parseFloat', 'parseInt', 'unescape'])
  const usedGlobals = extractGlobals(module.script)
  const contextGlobals = {
    __coralite_context__: context,
    __coralite_plugins__: cachedBoundPlugins,
    __coralite_utils__: this._source.utils
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
 * @param {CoraliteElement} data.root - The Coralite module to parse
 * @param {string} data.contextId - Context Id
 * @param {Object} data.renderContext - Render Context
 *
 * @returns {Promise<CoraliteModuleDefinitions>}
 */
Coralite.prototype._evaluateProduction = async function ({
  module,
  state,
  page,
  root,
  contextId,
  renderContext
}) {
  const context = {
    state: state || {},
    page,
    root,
    module,
    id: contextId,
    renderContext,
    app: this
  }

  renderContext.source.currentSourceContextId = contextId
  renderContext.source.contextInstances[contextId] = context

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
    const isPlugins = id === 'coralite/plugins'
    const isUtils = id === 'coralite/utils'

    // Handle internal coralite imports
    if (isCoralite || isPlugins || isUtils) {
      // Lazily bind plugins once per evaluation
      if (!cachedBoundPlugins) {
        cachedBoundPlugins = this._bindPlugins(this._source.plugins, context)
      }

      if (isCoralite) {
        return {
          ...context,
          defineComponent: cachedBoundPlugins?.defineComponent,
          default: context
        }
      }

      if (isPlugins) {
        return {
          ...(cachedBoundPlugins || {}),
          default: cachedBoundPlugins
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
  const fn = new Function(
    'module',
    'exports',
    'require',
    'coralite',
    moduleComponent.result._compiledCode.trim()
  )

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
 * @param {CoraliteElement} data.element - The Coralite module to parse
 * @param {string} data.contextId - Context Id
 * @param {Object} data.renderContext - Render Context
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
    let result = pluginHooks[i](contextData)

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
 * @internal Binds plugins to the given context via 'this'.
 *
 * @param {Object} plugins - The plugins object
 * @param {Object} context - The context object to bind
 * @returns {Object} The bound plugins
 */
Coralite.prototype._bindPlugins = function (plugins, context) {
  const cachedBoundPlugins = {}

  for (const key in plugins) {
    if (typeof plugins[key] === 'function') {
      cachedBoundPlugins[key] = plugins[key].bind(context)
    } else if (plugins[key] !== null && typeof plugins[key] === 'object') {
      const pluginObj = {}
      for (const prop in plugins[key]) {
        if (typeof plugins[key][prop] === 'function') {
          pluginObj[prop] = plugins[key][prop].bind(context)
        } else {
          pluginObj[prop] = plugins[key][prop]
        }
      }
      cachedBoundPlugins[key] = pluginObj
    } else {
      cachedBoundPlugins[key] = plugins[key]
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
 * @param {'onPageSet'|'onPageUpdate'|'onPageDelete'|'onComponentSet'|'onComponentUpdate'|'onComponentDelete'|'onBeforePageRender'|'onAfterPageRender'|'onBeforeBuild'|'onAfterBuild'} name - The name of the hook to trigger.
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
 * @param {'onPageSet'|'onPageUpdate'|'onPageDelete'|'onComponentSet'|'onComponentUpdate'|'onComponentDelete'|'onBeforePageRender'|'onAfterPageRender'|'onBeforeBuild'|'onAfterBuild'} name - The name of the hook to register the callback with.
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

Object.defineProperty(Coralite.prototype, '_defaultOnError', {
  enumerable: false,
  configurable: false,
  writable: false
})
Object.defineProperty(Coralite.prototype, '_handleError', {
  enumerable: false,
  configurable: false,
  writable: false
})
Object.defineProperty(Coralite.prototype, '_createExecutionError', {
  enumerable: false,
  configurable: false,
  writable: false
})
Object.defineProperty(Coralite.prototype, '_createRenderContext', {
  enumerable: false,
  configurable: false,
  writable: false
})
Object.defineProperty(Coralite.prototype, '_processCustomElementsInPage', {
  enumerable: false,
  configurable: false,
  writable: false
})
Object.defineProperty(Coralite.prototype, '_generatePages', {
  enumerable: false,
  configurable: false,
  writable: false
})
Object.defineProperty(Coralite.prototype, '_processDependentComponents', {
  enumerable: false,
  configurable: false,
  writable: false
})
Object.defineProperty(Coralite.prototype, '_replaceSlots', {
  enumerable: false,
  configurable: false,
  writable: false
})
Object.defineProperty(Coralite.prototype, '_moduleLinker', {
  enumerable: false,
  configurable: false,
  writable: false
})
Object.defineProperty(Coralite.prototype, '_evaluateDevelopment', {
  enumerable: false,
  configurable: false,
  writable: false
})
Object.defineProperty(Coralite.prototype, '_evaluateProduction', {
  enumerable: false,
  configurable: false,
  writable: false
})
Object.defineProperty(Coralite.prototype, '_evaluate', {
  enumerable: false,
  configurable: false,
  writable: false
})
Object.defineProperty(Coralite.prototype, '_triggerPluginAggregateHook', {
  enumerable: false,
  configurable: false,
  writable: false
})
Object.defineProperty(Coralite.prototype, '_triggerPluginHook', {
  enumerable: false,
  configurable: false,
  writable: false
})
Object.defineProperty(Coralite.prototype, '_bindPlugins', {
  enumerable: false,
  configurable: false,
  writable: false
})
Object.defineProperty(Coralite.prototype, '_addPluginHook', {
  enumerable: false,
  configurable: false,
  writable: false
})

export default Coralite
