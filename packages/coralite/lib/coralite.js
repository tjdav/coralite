import { cleanKeys, cloneModuleInstance, replaceToken, cloneComponentInstance, findAndExtractScript } from './utils.js'
import { getHtmlFile, getHtmlFiles } from './html.js'
import { parseHTML, parseModule, createElement, createTextNode } from './parse.js'
import { transformCss } from './style-transform.js'
import { ScriptManager } from './script-manager.js'
import { defineComponent, metadataPlugin, refsPlugin, staticAssetPlugin } from '#plugins'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, normalize, relative, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { transform } from 'esbuild'
import { isCoraliteElement, isCoraliteCollectionItem } from './type-helper.js'
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
 *  CoraliteModuleValues,
 *  CoraliteComponent,
 *  CoraliteCollectionItem,
 *  CoraliteComponentRoot,
 *  CoraliteCollectionEventSet,
 *  Attribute,
 *  CoraliteComponentResult,
 *  CoraliteValues,
 *  InstanceContext,
 *  CoraliteConfig} from '../types/index.js'
 */

/**
 * @import {DomSerializerOptions} from 'dom-serializer'
 */

/**
 * @constructor
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

  // module source context
  this._source = {
    contextModules: {
      parseHTML: (string, ignoreByAttribute, skipRenderByAttribute) => parseHTML(string, ignoreByAttribute, skipRenderByAttribute, (errorData) => this._handleError(errorData)),
      parseModule: (string, options) => parseModule(string, {
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
    context: {
      plugins: {},
      path,
      excludeByAttribute: ignoreByAttribute,
      components: this.components,
      pages: this.pages
    }
  }

  // place core plugin first
  plugins.unshift(defineComponent, refsPlugin, metadataPlugin)

  if (assets) {
    plugins.unshift(staticAssetPlugin(assets))
  }

  const source = this._source
  // iterate over each plugin and register its hooks and modules in the Coralite source context.
  for (let i = 0; i < plugins.length; i++) {
    const plugin = plugins[i]

    // set plugin method
    if (typeof plugin.method === 'function') {
      const name = plugin.name
      const callback = plugin.method.bind(this)

      // extend the source context with a reference to the plugin method.
      source.context.plugins[name] = function (options, contextInstance) {
        return callback(options, contextInstance)
      }
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

  // add defineComponent to module context
  source.contextModules.defineComponent = source.context.plugins.defineComponent

  const propertyDescriptors = {
    enumerable: false,
    configurable: false,
    writable: true
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
    _source: { ...propertyDescriptors }
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

      await this._triggerPluginHook('onComponentSet', component)

      return {
        type: 'component',
        id: component.id,
        value: component
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

      await this._triggerPluginHook('onComponentUpdate', component)

      return component
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

  /** @type {CoraliteCollectionEventSet} */
  const onFileSet = async (data) => {
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

    // Determine the root path based on the data type
    let rootPath = this.options.path.pages

    if (data.type === 'component') {
      rootPath = this.options.path.components
    }

    // Convert relative file path to a URL pathname format
    const urlPathname = pathToFileURL(join('/', relative(rootPath, data.path.pathname))).pathname

    // define a set of context values for component rendering
    /** @type {CoraliteValues} */
    const values = {
      $urlPathname: urlPathname,
      $urlDirname: pathToFileURL(dirname(urlPathname)).pathname,
      $filePathname: data.path.pathname,
      $fileDirname: data.path.dirname,
      $filename: data.path.filename,
      ...data.values
    }

    await this._triggerPluginHook('onPageSet', {
      elements,
      values,
      data
    })

    return {
      type: 'page',
      value: {
        values,
        path: data.path,
        root: elements.root,
        customElements: elements.customElements,
        tempElements: elements.tempElements,
        skipRenderElements: elements.skipRenderElements
      }
    }
  }

  const onPageUpdate = async (newValue, oldValue) => {
    let newCustomElements

    if (!newValue.result) {
      const result = await onFileSet(newValue)

      newValue = result.value
      newCustomElements = result.value.customElements
    } else {
      newCustomElements = newValue.result.customElements
    }

    let oldElements = oldValue.result.customElements.slice()

    await this._triggerPluginHook('onPageUpdate', {
      elements: newCustomElements,
      newValue,
      oldValue
    })

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

    return newValue
  }

  const onPageDelete = async (value) => {
    await this._triggerPluginHook('onPageDelete', value)

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
 * @param {Object} data
 * @param {'WARN' | 'ERR' | 'LOG'} data.level
 * @param {string} data.message
 * @param {Error} [data.error]
 */
Coralite.prototype._handleError = function (data) {
  if (this._onErrorCallback) {
    this._onErrorCallback(data)
  } else {
    this._defaultOnError(data)
  }
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
    values: {},
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
 * @param {Object} [values] - Values to be passed to the page
 * @return {AsyncGenerator<CoraliteResult>}
 */
Coralite.prototype._generatePages = async function* (path, values = {}) {
  let queue = []

  if (Array.isArray(path)) {
    // Remove path duplicates
    const uniquePaths = new Set(path)
    for (const path of uniquePaths) {
      const result = this.pages.getListByPath(path) || this.pages.getItem(path)

      if (result) {
        if (Array.isArray(result)) {
          queue = queue.concat(result)
        } else {
          queue.push(result)
        }
      }
    }
  } else if (typeof path === 'string') {
    const result = this.pages.getListByPath(path) || this.pages.getItem(path)

    if (result) {
      if (Array.isArray(result)) {
        queue = queue.concat(result)
      } else {
        queue.push(result)
      }
    }
  } else {
    // Slice creates a shallow copy of the list array, safe for iteration
    queue = this.pages.list.slice()
  }

  const buildId = randomUUID()
  this._renderQueues.set(buildId, queue)
  const scriptResultCache = new Map()

  try {
    const queue = this._renderQueues.get(buildId)

    for (let q = 0; q < queue.length; q++) {
      const startTime = performance.now()

      /** @type {CoraliteComponent & CoraliteComponentResult} */
      const originalDocument = queue[q].result

      // Deep clone the document to ensure thread safety
      const component = cloneComponentInstance(originalDocument)

      // Merge variables into document values
      Object.assign(component.values, values)

      // Initialize Render Context
      const renderContext = this._createRenderContext(buildId)
      renderContext.mode = this.options.mode

      await this._triggerPluginHook('onBeforePageRender', {
        component,
        values,
        renderContext
      })

      // remove temporary elements
      if (component.tempElements) {
        for (const element of component.tempElements) {
          if (element.parent && element.parent.children) {
            // Filter children directly on the cloned document
            element.parent.children = element.parent.children.filter(
              child => !child.remove
            )
          }
        }
      }

      for (let i = 0; i < component.customElements.length; i++) {
        const customElement = component.customElements[i]

        const contextId = component.path.pathname + i + customElement.name
        const currentValues = renderContext.values[contextId] || {}

        if (typeof customElement.attribs === 'object') {
          renderContext.values[contextId] = {
            ...currentValues,
            ...component.values,
            ...customElement.attribs
          }
        } else {
          renderContext.values[contextId] = Object.assign(currentValues, component.values)
        }

        const componentElement = await this.createComponentElement({
          id: customElement.name,
          values: renderContext.values[contextId],
          element: customElement,
          component,
          contextId,
          index: i,
          renderContext
        })

        if (componentElement) {
          for (let i = 0; i < componentElement.children.length; i++) {
            // update component parent
            componentElement.children[i].parent = customElement.parent
          }

          const index = customElement.parent.children.indexOf(customElement, customElement.parentChildIndex)
          // replace custom element with component
          customElement.parent.children.splice(index, 1, ...componentElement.children)
        }
      }

      if (renderContext.styles.size > 0) {
        let cssContent = ''

        for (const [selector, css] of renderContext.styles) {
          cssContent += `[data-style-selector="${selector}"] {\n${css}\n}\n`
        }

        /** @type {CoraliteElement} */
        let headElement

        findHeadLoop: for (let i = 0; i < component.root.children.length; i++) {
          const rootNode = component.root.children[i]

          if (rootNode.type === 'tag' && rootNode.name === 'html') {
            for (let i = 0; i < rootNode.children.length; i++) {
              const node = rootNode.children[i]

              if (node.type === 'tag' && node.name === 'head') {
                headElement = node
                break findHeadLoop
              }
            }
          }
        }

        const styleElement = createCoraliteElement({
          type: 'tag',
          name: 'style',
          parent: headElement || component.root,
          attribs: {},
          children: []
        })

        styleElement.children.push(createCoraliteTextNode({
          type: 'text',
          data: cssContent,
          parent: styleElement
        }))

        if (headElement) {
          headElement.children.push(styleElement)
        } else {
          component.root.children.unshift(styleElement)
        }
      }

      if (renderContext.scripts.content[component.path.pathname]) {
        const scripts = renderContext.scripts.content[component.path.pathname]

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
              values: script.values
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

        /** @type {CoraliteElement | CoraliteComponentRoot} */
        let bodyElement = component.root
        let headElement = null

        findBodyLoop: for (let i = 0; i < component.root.children.length; i++) {
          const rootNode = component.root.children[i]

          if (rootNode.type === 'tag' && rootNode.name === 'html') {
            for (let i = 0; i < rootNode.children.length; i++) {
              const node = rootNode.children[i]

              if (node.type === 'tag' && node.name === 'body') {
                bodyElement = node
              }
              if (node.type === 'tag' && node.name === 'head') {
                headElement = node
              }
            }
          }
        }

        if (scriptResult.importMap && Object.keys(scriptResult.importMap).length > 0) {
          const importMapElement = createCoraliteElement({
            type: 'tag',
            name: 'script',
            parent: headElement || component.root,
            attribs: {
              type: 'importmap'
            },
            children: []
          })

          importMapElement.children.push(createCoraliteTextNode({
            type: 'text',
            data: JSON.stringify({ imports: scriptResult.importMap }),
            parent: importMapElement
          }))

          if (headElement) {
            headElement.children.push(importMapElement)
          } else {
            component.root.children.unshift(importMapElement)
          }
        }

        const chunkManifest = { ...scriptResult.manifest }
        delete chunkManifest['chunk-shared']

        const base = this.options.baseURL.endsWith('/') ? this.options.baseURL : this.options.baseURL + '/'

        let scriptContent = `
import { getHelpers, getSetups, render } from '${base}assets/js/${scriptResult.manifest['chunk-shared']}';

// Global setups initialization
const globalContext = {};
const globalSetupValuesPromise = getSetups(globalContext);

(async () => {
  let resolveCoraliteReady;
  window.__coralite_ready__ = new Promise(resolve => resolveCoraliteReady = resolve);
  const globalAbortController = new AbortController();
  const componentManifest = ${JSON.stringify(chunkManifest)};
  const loadCache = {};
  
  const loadComponent = (componentId) => {
    if (!componentManifest[componentId]) return Promise.resolve();
    if (customElements.get(componentId)) return Promise.resolve();
    if (loadCache[componentId]) return loadCache[componentId];
    
    loadCache[componentId] = (async () => {
      // Dynamic import to lazy-load the component chunk
      const module = await import('${base}assets/js/' + componentManifest[componentId]);
      if (module.default && module.default.componentId) {
        if (!customElements.get(module.default.componentId)) {
          class ComponentElement extends HTMLElement {
          constructor() {
            super();
            this.componentId = module.default.componentId;
            this._abortController = null;
            
            const randomID = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
            this._instanceId = \`\${this.componentId}-\${randomID}\`;
            
            this._values = {};

            this._styles = ''
            if (module.default.styles) {
              this._styles += \`<style>\${module.default.styles}</style>\`;
            }
          }

          connectedCallback() {
            this._abortController = new AbortController();
            
            // Extract attributes to values
            const attributes = this.attributes;
            for (let i = 0; i < attributes.length; i++) {
              const attr = attributes[i];
              const camelName = attr.name.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
              this._values[camelName] = attr.value;
              if (camelName !== attr.name) {
                this._values[attr.name] = attr.value;
              }
            }
            
            // Merge defaults
            this._values = Object.assign({}, module.default.defaultValues, this._values);

            ;(async () => {
              const deps = module.default.dependencies || [];
              if (deps.length > 0) {
                const loadPromises = deps.map(dep => loadComponent(dep));
                await Promise.all(loadPromises);
              }

              this._render();
              
              const localContext = {
                instanceId: this._instanceId,
                componentId: this.componentId,
                values: this._values,
                root: this, 
                helpers: {},
                signal: this._abortController.signal
              };

              const setupValues = await globalSetupValuesPromise;
              localContext.values = { ...localContext.values, ...setupValues };

              const helpers = await getHelpers(localContext);
              localContext.helpers = helpers;
              
              localContext.imports = module.default.imports || {};

              if (module.default.script) {
                await module.default.script(localContext);
              }
            })();

            this._observer = new MutationObserver((mutations) => {
              let shouldRender = false;
              for (const mutation of mutations) {
                if (mutation.type === 'attributes') {
                  const attrName = mutation.attributeName;
                  const camelName = attrName.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
                  const newValue = this.getAttribute(attrName);
                  
                  if (this._values[camelName] !== newValue) {
                    this._values[camelName] = newValue;
                    if (camelName !== attrName) {
                        this._values[attrName] = newValue;
                    }
                    shouldRender = true;
                  }
                }
              }
              if (shouldRender) {
                this._render();
              }
            });

            this._observer.observe(this, { attributes: true });
          }

          _replaceTokens(templateAST, templateValues) {
            // Map to store cloned nodes by their _id
            const nodeById = {};

            // Function to deep clone AST and build ID map
            const cloneAST = (nodes) => {
              return nodes.map((node) => {
                const cloned = { ...node };
                if (cloned._id != null) {
                  nodeById[cloned._id] = cloned;
                }
                if (cloned.children) {
                  cloned.children = cloneAST(cloned.children);
                }
                if (cloned.attribs) {
                  cloned.attribs = { ...cloned.attribs };
                }
                return cloned;
              });
            };

            const ast = cloneAST(templateAST);

            if (!templateValues) return ast;

            // Replace tokens in attributes using the exact token matches
            if (templateValues.attributes) {
              for (let i = 0; i < templateValues.attributes.length; i++) {
                const item = templateValues.attributes[i];
                const node = nodeById[item.elementId];
                if (!node || !node.attribs || node.attribs[item.name] == null) continue;

                for (let j = 0; j < item.tokens.length; j++) {
                  const token = item.tokens[j];
                  let value = this._values[token.name];
                  
                  if (typeof value === 'function') {
                    value = value(this._values);
                  }
                  if (value == null) value = '';

                  // Replace exactly the token content string rather than a regex over the whole attribute
                  node.attribs[item.name] = node.attribs[item.name].split(token.content).join(value);
                }
              }
            }

            // Replace tokens in text nodes using the exact token matches
            if (templateValues.textNodes) {
              for (let i = 0; i < templateValues.textNodes.length; i++) {
                const item = templateValues.textNodes[i];
                const node = nodeById[item.textNodeId];
                if (!node || node.data == null) continue;

                for (let j = 0; j < item.tokens.length; j++) {
                  const token = item.tokens[j];
                  let value = this._values[token.name];
                  
                  if (typeof value === 'function') {
                    value = value(this._values);
                  }
                  if (value == null) value = '';

                  node.data = node.data.split(token.content).join(value);
                }
              }
            }

            return ast;
          }

          _render() {
            let content = this._styles;
            const ast = this._replaceTokens(module.default.templateAST, module.default.templateValues);

            if (this._styles) {
              for (let i = 0; i < ast.length; i++) {
                const node = ast[i];
                if (node.type === 'tag') {
                  if (!node.attribs) node.attribs = {};
                  node.attribs['data-style-selector'] = this.componentId;
                }
              }
            }

            content += render(ast, { decodeEntities: false });
            
            this.innerHTML = content;

            const refElements = this.querySelectorAll('[ref]');
            for (let i = 0; i < refElements.length; i++) {
              const element = refElements[i];
              const refName = element.getAttribute('ref');
              
              const dynamicId = \`\${this.componentId}__\${refName}-\${this._instanceId}\`;
              element.setAttribute('ref', dynamicId);
              
              this._values[\`ref_\${refName}\`] = dynamicId;
            }
          }

          disconnectedCallback() {
            if (this._abortController) {
              this._abortController.abort();
              this._abortController = null;
            }
            if (this._observer) {
              this._observer.disconnect();
              this._observer = null;
            }
          }
        }
        customElements.define(module.default.componentId, ComponentElement);
      }
      }
    })();
    return loadCache[componentId];
  };

  // Define all custom elements present in the dynamically determined chunk manifest
  const componentTags = Object.keys(componentManifest);
  const loadPromises = [];
  for (let i = 0; i < componentTags.length; i++) {
    const tagName = componentTags[i];
    if (tagName.includes('-') && !tagName.endsWith('.js')) {
      const elements = document.querySelectorAll(tagName);
      if (elements.length > 0) {
        loadPromises.push(loadComponent(tagName));
      }
    }
  }

  await Promise.all(loadPromises);

  // Invoke inline declarative instances defined in HTML (legacy support for <script> blocks mapped to _generatePages instances if needed)
  const declarativePromises = [];
  ${Object.values(instances).map(instance => `
  declarativePromises.push((async() => {
    const context = {
      instanceId: '${instance.instanceId}',
      componentId: '${instance.componentId}',
      values: ${JSON.stringify(instance.values || {})},
      component: {},
      signal: globalAbortController.signal
    };
    context.root = window.document;
    const setupValues = await globalSetupValuesPromise;
    context.values = { ...context.values, ...setupValues };
    const helpers = await getHelpers(context);
    context.helpers = helpers;

    const module = await import('${base}assets/js/${scriptResult.manifest[instance.componentId]}');
    
    // Explicitly load declarative script dependencies if any
    const deps = module.default.dependencies || [];
    if (deps.length > 0) {
      const loadPromises = deps.map(dep => loadComponent(dep));
      await Promise.all(loadPromises);
    }

    context.imports = module.default.imports || {};
    if (module.default.script) {
      await module.default.script(context);
    }
  })());
  `).join('\n')}
  await Promise.all(declarativePromises);
  resolveCoraliteReady();
})();
`

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
      if (component.skipRenderElements) {
        for (const element of component.skipRenderElements) {
          if (element.parent && element.parent.children) {
            // Filter children directly on the cloned document
            element.parent.children = element.parent.children.filter(
              child => child !== element
            )
          }
        }
      }

      let rawHTML = ''
      // render document
      rawHTML = this.transform(component.root)

      yield {
        type: 'page',
        path: component.path,
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

  await this._triggerPluginHook('onBeforeBuild', {
    path,
    options
  })

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
      if (signal?.aborted) throw signal.reason

      // Backpressure - don't pull more data than we can process
      if (executing.size >= limit.concurrency) {
        await Promise.race(executing)
      }

      const task = limit(async () => {
        // Exit early if build was cancelled while in queue
        if (signal?.aborted) throw signal.reason

        // Trigger onAfterPageRender hooks
        const hookResults = await this._triggerPluginHook('onAfterPageRender', result)
        let hookItems = []

        // Collect new results from hooks
        for (const hookResult of hookResults) {
          if (hookResult) {
            if (Array.isArray(hookResult)) {
              hookItems.push(...hookResult)
            } else {
              hookItems.push(hookResult)
            }
          }
        }

        const items = [result, ...hookItems]
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
        duration: 0 // Duration handled collectively during compileAllInstances
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
 * @param {CoraliteComponent} parentComponent - The document context in which the module is being processed
 * @returns {Promise<void>}
 */
Coralite.prototype._processDependentComponents = async function (componentIds, renderContext, parentComponent) {
  if (!componentIds || !componentIds.length) return

  for (const id of componentIds) {
    // Prevent infinite loops / duplicate processing
    if (this._scriptManager.sharedFunctions[id]) continue

    const moduleComponent = this.components.getItem(id)
    if (!moduleComponent) continue

    const module = cloneModuleInstance(moduleComponent.result)

    // Evaluate the script to trigger `defineComponent` and extract `__script__`
    let scriptResult = {}
    if (module.script) {
      scriptResult = await this._evaluate({
        module,
        values: {},
        component: parentComponent,
        contextId: `dependent-${id}`,
        renderContext
      })
    }

    // Pass the AST
    const templateAST = moduleComponent.result.template.children
    const templateValues = moduleComponent.result.values

    if (module.styles.length && !moduleComponent.result._processedCss) {
      const rawCss = module.styles.join('\n')
      const { rootClasses, descendantClasses } = moduleComponent.result
      moduleComponent.result._processedCss = await transformCss(rawCss, rootClasses, descendantClasses, (errorData) => this._handleError(errorData))
    }

    // Extract processed styles from the module
    const stylesHTML = moduleComponent.result._processedCss || ''

    let scriptObj = {
      content: 'function(){}',
      values: {}
    }
    let nestedComponents = []
    let defaultValues = {}

    if (scriptResult.__script__) {
      const extractedScript = findAndExtractScript(module.script)
      if (extractedScript) {
        scriptObj.content = extractedScript.content
        scriptObj.lineOffset = (module.lineOffset || 0) + extractedScript.lineOffset
      }
      scriptObj.values = scriptResult.__script__.values || {}

      const scriptComponents = scriptResult.__script__.components || []
      const declarativeComponents = (module.customElements || []).map(el => el.name)

      nestedComponents = Array.from(new Set([...scriptComponents, ...declarativeComponents]))
      scriptObj.components = nestedComponents
      defaultValues = scriptResult.__script__.defaultValues || {}
      delete scriptResult.__script__
    } else {
      const declarativeComponents = (module.customElements || []).map(el => el.name)
      nestedComponents = Array.from(new Set([...declarativeComponents]))
      scriptObj.components = nestedComponents
    }

    // Register with ScriptManager (including the template, defaults, and styles)
    this._scriptManager.registerComponent({
      id: module.id,
      script: scriptObj,
      filePath: moduleComponent.path.pathname,
      templateAST,
      templateValues,
      defaultValues,
      styles: stylesHTML
    })

    // Recursively process deeper dependencies
    if (nestedComponents.length > 0) {
      await this._processDependentComponents(nestedComponents, renderContext, parentComponent)
    }
  }
}

/**
 * @param {Object} options
 * @param {string} options.id - id - Unique identifier for the component
 * @param {CoraliteModuleValues} [options.values={}] - Token values available for replacement
 * @param {CoraliteElement} [options.element] - Mapping of component IDs to their module definitions
 * @param {CoraliteComponent} options.component - Current document being processed
 * @param {string} [options.contextId] - Context Id
 * @param {number} [options.index] - Context index
 * @param {Object} [options.renderContext] - Render Context
 * @param {boolean} [head=true] - Indicates if the current function call is for the head of the recursion
 * @returns {Promise<CoraliteElement | void>}
 */
Coralite.prototype.createComponentElement = async function ({
  id,
  values = {},
  element,
  component,
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
      values = Object.assign(values, element.attribs)
    }

    // convert object keys to camel case format for consistent naming conventions
    values = cleanKeys(values)
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

  // merge values from component script
  if (module.script) {
    const scriptResult = await this._evaluate({
      module,
      element,
      values,
      component,
      contextId,
      renderContext
    })

    if (scriptResult.__script__ != null) {
      const extractedScript = findAndExtractScript(module.script)

      if (extractedScript) {
        scriptResult.__script__.lineOffset = (module.lineOffset || 0) + extractedScript.lineOffset
        scriptResult.__script__.content = extractedScript.content
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

      // Include all computed properties into default values so client script can use them
      const componentDefaultValues = scriptResult.__script__.defaultValues || {}
      if (values) {
        for (const token of Object.keys(componentTokens)) {
          if (typeof values[token] === 'function') {
            componentDefaultValues[token] = values[token]
          }
        }
      }

      // Dynamically load any components dynamically inserted if they are explicitly mentioned
      const declarativeComponents = (module.customElements || []).map(el => el.name)
      const scriptComponents = scriptResult.__script__ ? (scriptResult.__script__.components || []) : []
      const mergedComponents = Array.from(new Set([...scriptComponents, ...declarativeComponents]))

      if (scriptResult.__script__) {
        scriptResult.__script__.components = mergedComponents
      }

      // Register component script with script manager
      this._scriptManager.registerComponent({
        id: module.id,
        script: scriptResult.__script__,
        filePath: moduleComponent.path.pathname,
        templateAST,
        templateValues,
        defaultValues: componentDefaultValues,
        styles: stylesHTML
      })

      if (mergedComponents.length > 0) {
        await this._processDependentComponents(mergedComponents, renderContext, component)
      }

      // Ensure values object exists in scriptResult
      if (!scriptResult.__script__.values) {
        scriptResult.__script__.values = {}
      }

      for (let i = 0; i < module.values.refs.length; i++) {
        const ref = module.values.refs[i]
        const uniqueRefValue = `${module.id}__${ref.name}-${index}`

        // Update the ref attribute value to be unique
        ref.element.attribs.ref = uniqueRefValue

        // inject flat token into script instance values
        scriptResult.__script__.values[`ref_${ref.name}`] = uniqueRefValue
      }

      // Store instance data for script manager
      renderContext.scripts.add(component.path.pathname, {
        id: contextId,
        componentId: module.id,
        component,
        values: scriptResult.__script__.values
      })

      delete scriptResult.__script__
    }

    values = Object.assign(values, scriptResult)
    renderContext.values[contextId] = values
  }

  // append ref objects to values
  for (let i = 0; i < module.values.refs.length; i++) {
    const ref = module.values.refs[i]
    values[`ref_${ref.name}`] = `${module.id}__${ref.name}-${index}`
  }

  // replace tokens in the component with their values from `values` object and store them into computed value array for later use if needed (e.g., to be injected back).
  for (let i = 0; i < module.values.attributes.length; i++) {
    const item = module.values.attributes[i]

    for (let i = 0; i < item.tokens.length; i++) {
      const token = item.tokens[i]
      let value = values[token.name]

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
      let value = values[token.name]

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
    const currentValues = renderContext.values[childContextId] || {}

    // append custom attributes to values
    if (typeof customElement.attribs === 'object') {
      const attribValues = cleanKeys(customElement.attribs)

      renderContext.values[childContextId] = {
        ...currentValues,
        ...values,
        ...attribValues
      }
    } else {
      renderContext.values[childContextId] = Object.assign(currentValues, values)
    }

    createComponentTasks.push(
      this.createComponentElement({
        id: customElement.name,
        values: renderContext.values[childContextId],
        element: customElement,
        component,
        contextId: childContextId,
        index,
        renderContext
      }, false).then(component => ({
        component,
        customElement
      }))
    )
  }

  const results = await Promise.all(createComponentTasks)

  for (let i = 0; i < results.length; i++) {
    const { component, customElement } = results[i]
    const children = customElement.parent.children

    if (!childIndex) {
      childIndex = customElement.parentChildIndex
    } else {
      childIndex = children.indexOf(customElement, customElement.parentChildIndex)
    }

    // replace custom element with component
    if (component && typeof component === 'object') {
      children.splice(childIndex, 1, ...component.children)
    }
  }

  const slots = module.slotElements[id]

  // replace slot content
  if (slots) {
    const slotChildren = {}
    const slotNames = Object.keys(slots)

    // sort slot content by name
    for (let i = 0; i < slotNames.length; i++) {
      const slotName = slotNames[i]
      slotChildren[slotName] = []
    }

    // insert slot content by name
    if (element) {
      for (let i = 0; i < element.slots.length; i++) {
        const elementSlotContent = element.slots[i]
        const slotName = elementSlotContent.name
        const slot = slots[slotName]

        if (slot) {
          if (elementSlotContent.node.attribs) {
            // remove slot attribute
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

      // filter out whitespace only text nodes
      const emptySlot = slotNodes.filter(node => {
        return node.type !== 'text' || (node.data && node.data.trim().length > 0)
      })

      if (!emptySlot.length) {
        // set default content
        slotNodes = slot.element.children || []
      } else {
        const startIndex = slotNodes.length - 1

        for (let i = startIndex; i > -1; i--) {
          const node = slotNodes[i]

          if (node.name) {
            const component = this.components.getItem(node.name)

            if (component) {
              const slotContextId = contextId + slotName + i + node.name
              const currentValues = renderContext.values[slotContextId] || {}
              const attribValues = cleanKeys(node.attribs)

              if (typeof node.attribs === 'object') {
                renderContext.values[slotContextId] = {
                  ...currentValues,
                  ...values,
                  ...attribValues
                }
              } else {
                renderContext.values[slotContextId] = Object.assign(currentValues, values)
              }

              const componentElement = await this.createComponentElement({
                id: node.name,
                values: renderContext.values[slotContextId],
                element: node,
                component: component.result,
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

      // replace slot element with content
      slot.element.parent.children.splice(slotIndex, 1, ...slotNodes)
    }
  }

  return result
}

/**
 * @param {import('../types/core.js').CoraliteFilePath} path
 */
Coralite.prototype._moduleLinker = function (path, context) {
  const source = this._source
  const componentDirURL = pathToFileURL(resolve(path.dirname)).href

  /**
   * @param {string} specifier - The specifier of the requested module
   * @param {import('node:vm').Module} referencingModule - The Module object link() is called on.
   * @param {{ attributes: ImportAttributes }} extra - The type for the with property of the optional second argument to import().
   */
  return async (specifier, referencingModule, extra) => {
    const originalSpecifier = specifier

    if (specifier == 'coralite/plugins') {
      const plugins = source.context.plugins
      let pluginExports = ''

      pluginExports = 'const plugins = globalThis.__coralite_plugins__; export default plugins;'

      for (const key in plugins) {
        if (Object.prototype.hasOwnProperty.call(plugins, key)) {
          pluginExports += `export const ${key} = plugins["${key}"];\n`
        }
      }

      const { SourceTextModule } = await import('node:vm')

      return new SourceTextModule(pluginExports, {
        context: referencingModule.context
      })
    } else if (specifier === 'coralite') {
      let coraliteExports = 'const context = globalThis.__coralite_context__; export default context;'

      for (const key in context) {
        if (Object.prototype.hasOwnProperty.call(context, key)) {
          coraliteExports += `export const ${key} = context["${key}"];\n`
        }
      }

      const { SourceTextModule } = await import('node:vm')

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
      const module = await import(specifier, { with: extra.attributes })
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
 * @param {CoraliteModuleValues} data.values - Replacement tokens for the component
 * @param {CoraliteElement} data.element - The Coralite module to parse
 * @param {CoraliteComponent} data.component - The document context in which the module is being processed
 * @param {string} data.contextId - Context Id
 * @param {Object} data.renderContext - Render Context
 *
 * @returns {Promise<CoraliteModuleValues>}
 */
Coralite.prototype._evaluateDevelopment = async function ({
  module,
  values,
  element,
  component,
  contextId,
  renderContext
}) {
  const { SourceTextModule } = await import('node:vm')

  if (!SourceTextModule) {
    throw new Error('SourceTextModule is not available. Please run Node.js with --experimental-vm-modules to use Development mode.')
  }

  const plugins = this._source.context.plugins
  const cachedBoundPlugins = {}

  for (const key in plugins) {
    cachedBoundPlugins[key] = typeof plugins[key] === 'function'
      ? (options) => plugins[key](options, context)
      : plugins[key]
  }

  const context = {
    ...this._source.contextModules,
    ...this._source.context,
    ...cachedBoundPlugins,
    component,
    values,
    element,
    module,
    id: contextId,
    renderContext
  }

  renderContext.source.currentSourceContextId = contextId
  renderContext.source.contextInstances[contextId] = context


  // Create a fresh context for the module
  const contextifiedObject = createContext({
    console: globalThis.console,
    crypto: globalThis.crypto,
    __coralite_context__: context,
    __coralite_plugins__: cachedBoundPlugins
  })

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
  await script.evaluate()

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
 * @param {CoraliteModuleValues} data.values - Replacement tokens for the component
 * @param {CoraliteElement} data.element - The Coralite module to parse
 * @param {CoraliteComponent} data.component - The document context in which the module is being processed
 * @param {string} data.contextId - Context Id
 * @param {Object} data.renderContext - Render Context
 *
 * @returns {Promise<CoraliteModuleValues>}
 */
Coralite.prototype._evaluateProduction = async function ({
  module,
  values,
  element,
  component,
  contextId,
  renderContext
}) {
  const context = {
    ...this._source.contextModules,
    ...this._source.context,
    component,
    values,
    element,
    module,
    id: contextId,
    renderContext
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

    // Handle internal coralite imports
    if (isCoralite || isPlugins) {
      // Lazily bind plugins once per evaluation
      if (!cachedBoundPlugins) {
        const plugins = this._source.context.plugins
        cachedBoundPlugins = {}

        for (const key in plugins) {
          cachedBoundPlugins[key] = typeof plugins[key] === 'function'
            ? (options) => plugins[key](options, context)
            : plugins[key]
        }
      }

      if (isCoralite) {
        return {
          ...context,
          ...cachedBoundPlugins,
          default: context
        }
      }

      if (isPlugins) {
        return {
          ...cachedBoundPlugins,
          default: cachedBoundPlugins
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
    if (error instanceof Error) {
      error.message = `Error in "${moduleComponent.path.pathname}": ${error.message}`
    }
    throw error
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
 * @param {Object} data
 * @param {CoraliteModule} data.module - The Coralite module to parse
 * @param {CoraliteModuleValues} data.values - Replacement tokens for the component
 * @param {CoraliteElement} data.element - The Coralite module to parse
 * @param {CoraliteComponent} data.component - The document context in which the module is being processed
 * @param {string} data.contextId - Context Id
 * @param {Object} data.renderContext - Render Context
 *
 * @returns {Promise<CoraliteModuleValues>}
 */
Coralite.prototype._evaluate = async function (options) {
  if (this.options.mode === 'development') {
    return this._evaluateDevelopment(options)
  }
  return this._evaluateProduction(options)
}

/**
 * @template {Object} T
 *
 * Executes all plugin callbacks registered under the specified hook name.
 *
 * @internal
 *
 * @param {'onPageSet'|'onPageUpdate'|'onPageDelete'|'onComponentSet'|'onComponentUpdate'|'onComponentDelete'|'onBeforePageRender'|'onAfterPageRender'|'onBeforeBuild'|'onAfterBuild'} name - The name of the hook to trigger.
 * @param {T} data - Data to pass to each callback function.
 * @return {Promise<Array<T>>} A promise that resolves to an array of results from all callbacks.
 */
Coralite.prototype._triggerPluginHook = async function (name, data) {
  const pluginCallbacks = []
  const pluginHooks = this._plugins.hooks[name]

  // iterate over each plugin callback associated with the given hook name
  for (let i = 0; i < pluginHooks.length; i++) {
    // push a promise representing the execution of the callback into the array
    pluginCallbacks.push(pluginHooks[i](data))
  }

  // wait for all plugin callbacks to complete and return their results
  return await Promise.all(pluginCallbacks)
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

  const pluginCallback = callback.bind(this)

  if (this._plugins.hooks[name]) {
    this._plugins.hooks[name].push(pluginCallback)
  }
}

export default Coralite
