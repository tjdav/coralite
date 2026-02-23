import { cleanKeys, cloneModuleInstance, replaceToken, cloneDocumentInstance } from './utils.js'
import { getHtmlFile, getHtmlFiles } from './html.js'
import { parseHTML, parseModule, createElement, createTextNode } from './parse.js'
import { transformCss } from './style-transform.js'
import { ScriptManager } from './script-manager.js'
import { defineComponent, metadataPlugin, refsPlugin } from '#plugins'
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

/**
 * @import {
 *  CoraliteElement,
 *  CoraliteAnyNode,
 *  CoraliteModule,
 *  CoraliteResult,
 *  CoraliteModuleValues,
 *  CoraliteDocument,
 *  CoraliteCollectionItem,
 *  CoraliteDocumentRoot,
 *  CoraliteCollectionEventSet,
 *  IgnoreByAttribute,
 *  CoraliteDocumentResult,
 *  CoraliteValues,
 *  InstanceContext} from '../types/index.js'
 *
 * @import { CoralitePluginInstance } from '../types/plugin.js'
 */

/**
 * @import {DomSerializerOptions} from 'dom-serializer'
 */

/**
 * @constructor
 * @param {Object} options
 * @param {string} options.templates - The path to the directory containing Coralite templates.
 * @param {CoralitePluginInstance[]} [options.plugins=[]]
 * @param {string} options.pages - The path to the directory containing pages that will be rendered using the provided templates.
 * @param {IgnoreByAttribute[]} [options.ignoreByAttribute] - Elements to ignore with attribute name value pair
 * @example
 * const coralite = new Coralite({
 *   templates: './path/to/templates',
 *   pages: './path/to/pages',
 *   plugins: [myPlugin],
 *   ignoreByAttribute: [{ name: 'data-ignore', value: 'true' }]
 * });
 */
export function Coralite ({
  templates,
  pages,
  plugins,
  ignoreByAttribute
}) {
  // Validate required parameters
  if (!templates && typeof templates !== 'string') {
    throw new Error('Coralite constructor requires "templates" option to be defined')
  }

  if (!pages && typeof pages !== 'string') {
    throw new Error('Coralite constructor requires "pages" option to be defined')
  }

  if (!plugins) {
    plugins = []
  }

  const path = {
    templates: normalize(templates),
    pages: normalize(pages)
  }

  // instance options
  this.options = {
    templates,
    pages,
    plugins,
    ignoreByAttribute,
    path
  }

  /** @type {Map<string, CoraliteCollectionItem[]>} */
  this._renderQueues = new Map()

  // plugins
  this._plugins = {
    templates: [],
    hooks: {
      onPageSet: [],
      onPageUpdate: [],
      onPageDelete: [],
      onTemplateSet: [],
      onTemplateUpdate: [],
      onTemplateDelete: [],
      onAfterPageRender: []
    }
  }

  // Initialize script manager
  this._scriptManager = new ScriptManager()

  // module source context
  this._source = {
    contextModules: {
      parseHTML,
      parseModule,
      getHtmlFiles,
      getHtmlFile,
      createElement,
      createTextNode,
      transform: this.transform
    },
    context: {
      plugins: {},
      path,
      excludeByAttribute: ignoreByAttribute,
      templates: this.templates,
      pages: this.pages
    }
  }

  // place core plugin first
  plugins.unshift(defineComponent, refsPlugin, metadataPlugin)

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

    // queue any templates provided by the plugin to be registered.
    if (plugin.templates && Array.isArray(plugin.templates)) {
      for (let i = 0; i < plugin.templates.length; i++) {
        this._plugins.templates.push(plugin.templates[i])
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
    if (plugin.onTemplateSet) {
      this._addPluginHook('onTemplateSet', plugin.onTemplateSet)
    }
    if (plugin.onTemplateDelete) {
      this._addPluginHook('onTemplateDelete', plugin.onTemplateDelete)
    }
    if (plugin.onTemplateUpdate) {
      this._addPluginHook('onTemplateUpdate', plugin.onTemplateUpdate)
    }
    if (plugin.onAfterPageRender) {
      this._addPluginHook('onAfterPageRender', plugin.onAfterPageRender)
    }

    // register script plugin if provided
    if (plugin.script) {
      this._scriptManager.use(plugin.script)
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
  this.templates = await getHtmlFiles({
    path: this.options.templates,
    recursive: true,
    type: 'template',
    onFileSet: async (value) => {
      const template = parseModule(value.content, {
        ignoreByAttribute: this.options.ignoreByAttribute
      })

      // abort template add
      if (!template.isTemplate) {
        return
      }

      await this._triggerPluginHook('onTemplateSet', template)

      return {
        type: 'template',
        // @ts-ignore
        id: template.id,
        value: template
      }
    },
    onFileUpdate: async (value) => {
      const template = parseModule(value.content, {
        ignoreByAttribute: this.options.ignoreByAttribute
      })

      // abort template update
      if (!template.isTemplate) {
        return
      }

      await this._triggerPluginHook('onTemplateUpdate', template)

      return template
    },
    onFileDelete: async (value) => {
      await this._triggerPluginHook('onTemplateDelete', value)
    }
  })

  // register plugin templates
  for (let i = 0; i < this._plugins.templates.length; i++) {
    await this.templates.setItem(this._plugins.templates[i])
  }

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
    const elements = parseHTML(data.content, this.options.ignoreByAttribute)

    // track parent-child relationship between custom elements
    for (let i = 0; i < elements.customElements.length; i++) {
      const customElement = elements.customElements[i]
      const name = customElement.name
      let item = pageCustomElements[name]

      if (!item) {
        pageCustomElements[name] = new Set()
        item = pageCustomElements[name]

        const template = this.templates.getItem(name)

        if (
          template &&
          template.result &&
          template.result.customElements &&
          template.result.customElements.length
        ) {
          const stack = [template.result.customElements]

          while (stack.length > 0) {
            const current = stack.pop()

            for (let i = 0; i < current.length; i++) {
              const element = current[i]

              if (!childCustomElements[element.name]) {
                childCustomElements[element.name] = name

                // process nested elements recursively
                const template = this.templates.getItem(element.name)

                if (
                  template &&
                  template.result &&
                  template.result.customElements &&
                  template.result.customElements.length
                ) {
                  // push nested custom elements to stack for processing
                  stack.push(template.result.customElements)
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

    if (data.type === 'template') {
      rootPath = this.options.path.templates
    }

    // Convert relative file path to a URL pathname format
    const urlPathname = pathToFileURL(join('/', relative(rootPath, data.path.pathname))).pathname

    // define a set of context values for template rendering
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
        tempElements: elements.tempElements
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

  try {
    const queue = this._renderQueues.get(buildId)

    for (let q = 0; q < queue.length; q++) {
      const startTime = performance.now()

      /** @type {CoraliteDocument & CoraliteDocumentResult} */
      const originalDocument = queue[q].result

      // Deep clone the document to ensure thread safety
      const document = cloneDocumentInstance(originalDocument)

      // Merge variables into document values
      Object.assign(document.values, values)

      // Initialize Render Context
      const renderContext = this._createRenderContext(buildId)

      // remove temporary elements
      if (document.tempElements) {
        for (const element of document.tempElements) {
          if (element.parent && element.parent.children) {
          // Filter children directly on the cloned document
            element.parent.children = element.parent.children.filter(
              child => !child.remove
            )
          }
        }
      }

      for (let i = 0; i < document.customElements.length; i++) {
        const customElement = document.customElements[i]

        const contextId = document.path.pathname + i + customElement.name
        const currentValues = renderContext.values[contextId] || {}

        if (typeof customElement.attribs === 'object') {
          renderContext.values[contextId] = {
            ...currentValues,
            ...document.values,
            ...customElement.attribs
          }
        } else {
          renderContext.values[contextId] = Object.assign(currentValues, document.values)
        }

        const component = await this.createComponent({
          id: customElement.name,
          values: renderContext.values[contextId],
          element: customElement,
          document,
          contextId,
          index: i,
          renderContext
        })

        if (component) {
          for (let i = 0; i < component.children.length; i++) {
          // update component parent
            component.children[i].parent = customElement.parent
          }

          const index = customElement.parent.children.indexOf(customElement, customElement.parentChildIndex)
          // replace custom element with component
          customElement.parent.children.splice(index, 1, ...component.children)
        }
      }

      if (renderContext.styles.size > 0) {
        let cssContent = ''

        for (const [selector, css] of renderContext.styles) {
          cssContent += `[data-style-selector="${selector}"] {\n${css}\n}\n`
        }

        /** @type {CoraliteElement} */
        let headElement

        findHeadLoop: for (let i = 0; i < document.root.children.length; i++) {
          const rootNode = document.root.children[i]

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
          parent: headElement || document.root,
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
          document.root.children.unshift(styleElement)
        }
      }

      if (renderContext.scripts.content[document.path.pathname]) {
        const scripts = renderContext.scripts.content[document.path.pathname]

        // Build instances object for script manager
        /** @type {Object.<string, InstanceContext>} */
        const instances = {}
        for (const key in scripts) {
          if (Object.prototype.hasOwnProperty.call(scripts, key)) {
            const script = scripts[key]
            // extending script content with templateId and values
            instances[script.id] = {
              instanceId: script.id,
              templateId: script.templateId,
              values: script.values,
              refs: script.refs
            }
          }
        }

        // Use script manager to compile all instances
        const scriptTextContent = await this._scriptManager.compileAllInstances(instances)

        /** @type {CoraliteElement} */
        let bodyElement

        findBodyLoop: for (let i = 0; i < document.root.children.length; i++) {
          const rootNode = document.root.children[i]

          if (rootNode.type === 'tag' && rootNode.name === 'html') {
            for (let i = 0; i < rootNode.children.length; i++) {
              const node = rootNode.children[i]

              if (node.type === 'tag' && node.name === 'body') {
                bodyElement = node
                break findBodyLoop
              }
            }
          }
        }

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
          data: scriptTextContent,
          parent: scriptElement
        }))

        bodyElement.children.push(scriptElement)
      }

      let rawHTML = ''
      // render document
      rawHTML = this.transform(document.root)

      yield {
        path: document.path,
        html: rawHTML,
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

  // Add options with defaults
  const signal = options?.signal
  const maxConcurrent = options?.maxConcurrent || availableParallelism()
  const variables = options?.variables

  // Initialize the limiter
  const limit = pLimit(maxConcurrent)
  const executing = new Set()
  const results = []

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
        console.error(err)
        executing.delete(task)
      })
    }

    await Promise.all(executing)

    return results

  } catch (error) {
    // Clean up - If one fails or we abort, wait for pending to settle
    await Promise.allSettled(executing)

    if (error.name === 'AbortError') {
      console.warn('Build cancelled by user.')
    }

    if (error instanceof Error) {
      error.message = `Build failed: ${error.message}`
      throw error
    }

    throw new Error(`Build failed: ${error.message}`, { cause: error })
  }
}

/**
 * Compiles and saves pages to disk
 *
 * @param {string} output - Output directory path
 * @param {string | string[]} [path] - Optional page path(s) to build
 * @param {Object} [options] - Build configuration
 * @param {number} [options.maxConcurrent=10] - Max concurrent file writes (min 1, max 100)
 * @param {AbortSignal} [options.signal] - AbortSignal
 * @returns {Promise<{ path: string, duration: number }[]>} Array of saved file paths
 * @example
 * // Build entire site with default concurrency (10 files)
 * await coralite.build('./dist')
 *
 * // Build specific pages with custom concurrency
 * await coralite.build('./dist', ['blog/*'], { maxConcurrent: 5 })
 */
Coralite.prototype.save = async function (output, path, options = {}) {
  const signal = options?.signal
  const createdDir = {}

  const results = await this.build(path, options, async (result) => {
    const relDir = relative(this.options.path.pages, result.path.dirname)
    const outDir = join(output, relDir)
    const outFile = join(outDir, result.path.filename)

    if (!createdDir[outDir]) {
      await mkdir(outDir, { recursive: true })

      createdDir[outDir] = true
    }

    // Pass signal to writeFile so Node can stop the I/O immediately
    await writeFile(outFile, result.html, { signal })

    return {
      path: outFile,
      duration: result.duration
    }
  })

  return results
}

/**
 * Renders the provided node or array of nodes using the render function.
 *
 * @param {CoraliteDocumentRoot | CoraliteAnyNode | CoraliteAnyNode[]} root - The node(s) to be rendered.
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
    const document = this.pages.getItem(value)

    if (!document) {
      throw new Error('addRenderQueue - unexpected page ID: "' + value + '"')
    }

    queue.push(document)
  } else if (isCoraliteCollectionItem(value)) {
    const document = await this.pages.setItem(value)

    // add render queue
    queue.push(document)
  }
}

/**
 * Retrieves page paths associated with a custom element template.
 *
 * @param {string} path - The original path potentially prefixed with the templates directory.
 * @returns {string[]} An array of page paths linked to the custom element template.
 */
Coralite.prototype.getPagePathsUsingCustomElement = function (path) {
  // normalize path by removing the templates directory prefix
  if (path.startsWith(this.options.path.templates)) {
    path = path.substring(this.options.path.templates.length + 1)
  }

  // retrieve the template item from the templates collection
  const item = this.templates.getItem(path)
  const pages = []

  // if template exists, collect associated page paths
  if (item) {
    const id = this._childCustomElements[item.result.id] || item.result.id
    const pageCustomElements = this._pageCustomElements[id]

    if (pageCustomElements) {
      // iterate over custom element paths linked to this template
      pageCustomElements.forEach(path => {
        pages.push(path)
      })
    }
  }

  return pages
}

/**
 * @param {Object} options
 * @param {string} options.id - id - Unique identifier for the component
 * @param {CoraliteModuleValues} [options.values={}] - Token values available for replacement
 * @param {CoraliteElement} [options.element] - Mapping of component IDs to their module definitions
 * @param {CoraliteDocument} options.document - Current document being processed
 * @param {string} [options.contextId] - Context Id
 * @param {number} [options.index] - Context index
 * @param {Object} [options.renderContext] - Render Context
 * @param {boolean} [head=true] - Indicates if the current function call is for the head of the recursion
 * @returns {Promise<CoraliteElement | void>}
 *
 * @example
 * ```
 * // example usage:
 * const component = await createComponent({
 *   id: 'my-component',
 *   tokens: {
 *     'some-value': 'value-for-template'
 *   },
 *   components: {
 *     'my-component': {
 *       id: 'my-component',
 *       template: someTemplate,
 *       script: someScript,
 *       values: someValues
 *     }
 *   },
 *   document: documentInstance
 * })
 * ```
 */
Coralite.prototype.createComponent = async function ({
  id,
  values = {},
  element,
  document,
  contextId,
  index,
  renderContext
}, head = true) {
  if (!renderContext) {
    renderContext = this._createRenderContext()
  }

  const templateItem = this.templates.getItem(id)

  if (!templateItem) {
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
    contextId = document.path.pathname + id
  }

  /**
   * clone the component to avoid mutations during replacement process.
   * @type {CoraliteModule}
   */
  const module = cloneModuleInstance(templateItem.result)
  const result = module.template

  if (module.styles.length) {
    const attributeName = 'data-style-selector'
    const selector = module.id

    // Check if styles have been processed for this template
    if (!templateItem.result._processedCss) {
      const rawCss = module.styles.join('\n')

      const { rootClasses, descendantClasses } = templateItem.result

      // Transform CSS
      templateItem.result._processedCss = await transformCss(rawCss, rootClasses, descendantClasses)
    }

    // Add styles to renderContext (idempotent for the build)
    if (!renderContext.styles.has(selector)) {
      renderContext.styles.set(selector, templateItem.result._processedCss)
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
      document,
      contextId,
      renderContext
    })

    if (scriptResult.__script__ != null) {
      // Register template script with script manager
      await this._scriptManager.registerTemplate(module.id, scriptResult.__script__.fn)

      const refs = {}

      for (let i = 0; i < module.values.refs.length; i++) {
        const ref = module.values.refs[i]
        const id = `${module.id}__${ref.name}-${index}`

        // map ref name id pair
        refs[ref.name] = id

        // set data ref selector
        ref.element.attribs['data-coralite-ref'] = id

        // clean up ref attribute
        delete ref.element.attribs.ref
      }

      // Store instance data for script manager
      renderContext.scripts.add(document.path.pathname, {
        id: contextId,
        templateId: module.id,
        document,
        refs,
        values: scriptResult.__script__.values
      })

      delete scriptResult.__script__
    }

    values = Object.assign(values, scriptResult)
    renderContext.values[contextId] = values
  }

  // replace tokens in the template with their values from `values` object and store them into computed value array for later use if needed (e.g., to be injected back).
  for (let i = 0; i < module.values.attributes.length; i++) {
    const item = module.values.attributes[i]

    for (let i = 0; i < item.tokens.length; i++) {
      const token = item.tokens[i]
      let value = values[token.name]

      if (value == null) {
        // console.error('Token "' + token.name +'" was empty used on "' + component.id + '"')
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
        // console.error('Token "' + token.name +'" was empty used on "' + component.id + '"')
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
      this.createComponent({
        id: customElement.name,
        values: renderContext.values[childContextId],
        element: customElement,
        document,
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
            const component = this.templates.getItem(node.name)

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

              const component = await this.createComponent({
                id: node.name,
                values: renderContext.values[slotContextId],
                element: node,
                document,
                contextId: slotContextId,
                index,
                renderContext
              }, false)

              if (component) {
                slotNodes.splice(i, 1, ...component.children)
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
 * Parses a Coralite module script and compiles it into JavaScript using esbuild.
 * Replaces node:vm SourceTextModule for better performance and memory management.
 *
 * @param {Object} data
 * @param {CoraliteModule} data.module - The Coralite module to parse
 * @param {CoraliteModuleValues} data.values - Replacement tokens for the component
 * @param {CoraliteElement} data.element - The Coralite module to parse
 * @param {CoraliteDocument} data.document - The document context in which the module is being processed
 * @param {string} data.contextId - Context Id
 * @param {Object} data.renderContext - Render Context
 *
 * @returns {Promise<CoraliteModuleValues>}
 */
Coralite.prototype._evaluate = async function ({
  module,
  values,
  element,
  document,
  contextId,
  renderContext
}) {
  const context = {
    ...this._source.contextModules,
    ...this._source.context,
    document,
    values,
    element,
    module,
    id: contextId,
    renderContext
  }

  renderContext.source.currentSourceContextId = contextId
  renderContext.source.contextInstances[contextId] = context

  // Retrieve Template and check cache
  const templateItem = this.templates.getItem(module.id)

  if (!templateItem.result._compiledCode) {
    const paddingCount = Math.max(0, (module.lineOffset - 3 || 0))
    const padding = '\n'.repeat(paddingCount)
    const sourceFile = pathToFileURL(templateItem.path.pathname).href

    // Transform using esbuild
    const { code } = await transform(padding + module.script, {
      loader: 'js',
      format: 'cjs',
      target: 'node18',
      platform: 'node',
      sourcemap: 'inline',
      sourcefile: sourceFile
    })

    templateItem.result._compiledCode = code + `\n//# sourceURL=${sourceFile}`
  }

  // Create a require function anchored to the template's file path to resolve relative imports
  const fileRequire = createRequire(resolve(templateItem.path.pathname))

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
    templateItem.result._compiledCode.trim()
  )

  // Execute the function with our mocks and context
  try {
    await fn(moduleMock, moduleMock.exports, customRequire, context)
  } catch (error) {
    if (error instanceof Error) {
      error.message = `Error in "${templateItem.path.pathname}": ${error.message}`
    }
    throw error
  }

  if (moduleMock.exports.default != null) {
    return moduleMock.exports.default
  }

  throw new Error(`Module "${module.id}" has no default export`)
}

/**
 * @template {Object} T
 *
 * Executes all plugin callbacks registered under the specified hook name.
 *
 * @internal
 *
 * @param {'onPageSet'|'onPageUpdate'|'onPageDelete'|'onTemplateSet'|'onTemplateUpdate'|'onTemplateDelete'|'onAfterPageRender'} name - The name of the hook to trigger.
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
 * @param {'onPageSet'|'onPageUpdate'|'onPageDelete'|'onTemplateSet'|'onTemplateUpdate'|'onTemplateDelete'|'onAfterPageRender'} name - The name of the hook to register the callback with.
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
