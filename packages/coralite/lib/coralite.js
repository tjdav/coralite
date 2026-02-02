import { cleanKeys, cloneModuleInstance, convertEsmToCjs, createElement, createTextNode, getHtmlFile, getHtmlFiles, parseHTML, parseModule, ScriptManager } from '#lib'
import { defineComponent, refsPlugin } from '#plugins'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, normalize, relative, resolve } from 'node:path'
import { createRequire } from 'node:module' // Replaces createContext, SourceTextModule
import { transform } from 'esbuild' // reused from script-manager dependency
import { isCoraliteElement, isCoraliteCollectionItem } from './type-helper.js'
import { pathToFileURL } from 'node:url'
import { availableParallelism } from 'node:os'
import render from 'dom-serializer'
import pLimit from 'p-limit'

/**
 * @import {
 *  CoraliteElement,
 *  CoraliteTextNode,
 *  CoraliteAnyNode,
 *  CoraliteModule,
 *  CoraliteResult,
 *  CoraliteModuleValues,
 *  CoraliteDocument,
 *  CoraliteModuleValue,
 *  CoraliteCollectionItem,
 *  CoraliteDocumentRoot,
 *  CoralitePluginInstance,
 *  CoraliteCollectionEventSet,
 *  IgnoreByAttribute,
 *  CoraliteDocumentResult,
 *  CoraliteFilePath,
 *  CoraliteValues,
 *  CoraliteScriptContent,
 *  InstanceContext} from '../types/index.js'
 * @import CoraliteCollection from './collection.js'
 * @import {Module} from 'node:vm'
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

  if (!templates && typeof templates !== 'string') {
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
    ignoreByAttribute,
    path
  }

  // plugins
  this._plugins = {
    templates: [],
    hooks: {
      onPageSet: [],
      onPageUpdate: [],
      onPageDelete: [],
      onTemplateSet: [],
      onTemplateUpdate: [],
      onTemplateDelete: []
    }
  }

  // Initialize script manager
  this._scriptManager = new ScriptManager()

  // module source context
  this._source = {
    specifierImportURL: pathToFileURL(process.cwd()).href,
    modules: {
      coralite: {
        export: 'export const document = coralite.document;\n'
        + 'export const values = coralite.values;\n'
        + 'export const path = coralite.path;\n'
        + 'export const excludeByAttribute = coralite.excludeByAttribute;\n'
        + 'export const templates = coralite.templates;\n'
        + 'export const pages = coralite.pages;\n'
        + 'export const defineComponent = coralite.defineComponent;\n'
        + 'export const getHtmlFiles = coralite.getHtmlFiles;\n'
        + 'export const getHtmlFile = coralite.getHtmlFile;\n'
        + 'export const createTextNode = coralite.createTextNode;\n'
        + 'export const createElement = coralite.createElement;\n'
        + 'export const parseModule = coralite.parseModule;\n'
        + 'export const parseHTML = coralite.parseHTML;\n',
        default: 'export default {\n'
        + '  values,\n'
        + '  document,\n'
        + '  path,\n'
        + '  excludeByAttribute,\n'
        + '  templates,\n'
        + '  pages,\n'
        + '  parseModule,\n'
        + '  parseHTML,\n'
        + '  getHtmlFiles,\n'
        + '  getHtmlFile,\n'
        + '  createTextNode,\n'
        + '  createElement,\n'
        + '  defineComponent,\n'
        + '};'
      },
      plugins: {
        export: '',
        default: 'export default { '
      }
    },
    currentContextId: '',
    contextInstances: {},
    contextModules: {
      parseHTML,
      parseModule,
      getHtmlFiles,
      getHtmlFile,
      createElement,
      createTextNode
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
  plugins.unshift(defineComponent, refsPlugin)

  const source = this._source
  // iterate over each plugin and register its hooks and modules in the Coralite source context.
  for (let i = 0; i < plugins.length; i++) {
    const plugin = plugins[i]

    // set plugin method
    if (typeof plugin.method === 'function') {
      const name = plugin.name
      const callback = plugin.method.bind(this)

      // add an export for each plugin in the generated modules.
      source.modules.plugins.export += `export const ${name} = coralite.plugins.${name};\n`
      source.modules.plugins.default += name + ', '

      // extend the source context with a reference to the plugin method.
      source.context.plugins[name] = function (options) {
        return callback(options, source.contextInstances[source.currentSourceContextId])
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

    // register script plugin if provided
    if (plugin.script) {
      this._scriptManager.use(plugin.script)
    }
  }

  source.modules.plugins.default = source.modules.plugins.default.substring(0, source.modules.plugins.default.length - 2) + ' }'

  // add defineComponent to module context
  source.contextModules.defineComponent = source.context.plugins.defineComponent

  /** @type {Object.<string, CoraliteModuleValues>} */
  this.values = {}
  this._scripts = {
    /**
     * @param {string} id
     * @param {CoraliteScriptContent} item
     */
    add (id, item) {
      if (!this.content[id]) {
        // @ts-ignore
        this.content[id] = {}
      }

      this.content[id][item.id] = item
    },
    restore () {
      this.content = {}
    },
    /** @type {Object.<string, Object.<string, CoraliteScriptContent>>} */
    content: {}
  }
  /** @type {CoraliteCollectionItem[]} */
  this._currentRenderQueue = []
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

  /** @type {CoraliteCollection} */
  this.pages = await getHtmlFiles({
    path: this.options.pages,
    recursive: true,
    type: 'page',
    onFileSet,
    onFileUpdate: async (newValue, oldValue) => {
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
    },
    onFileDelete: async (value) => {
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
  })
}

/**
 * Compiles specified page(s) by rendering their document content and measuring render time.
 * Processes pages based on provided path(s), replacing custom elements with components,
 * and returns rendered results with performance metrics.
 *
 * @internal
 *
 * @param {string | string[]} [path] - Path to a single page or array of page paths relative to the pages directory. If omitted, compiles all pages.
 * @return {AsyncGenerator<CoraliteResult>}
 */
Coralite.prototype._generatePages = async function* (path) {
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

  this._currentRenderQueue = queue

  try {
    for (let q = 0; q < this._currentRenderQueue.length; q++) {
      const restoreQueue = []

      // restore global state variables
      this.values = {}
      this._scripts.restore()

      const startTime = performance.now()

      /** @type {CoraliteDocument & CoraliteDocumentResult} */
      const document = this._currentRenderQueue[q].result

      // remove temporary elements
      if (document.tempElements) {
        for (const element of document.tempElements) {
          if (element.parent && element.parent.children) {
            // Store reference to the original children
            restoreQueue.push({
              parent: element.parent,
              originalChildren: element.parent.children
            })

            // Swap in a filtered array
            element.parent.children = element.parent.children.filter(
              child => !child.remove
            )
          }
        }
      }

      for (let i = 0; i < document.customElements.length; i++) {
        const customElement = document.customElements[i]
        const contextId = document.path.pathname + i + customElement.name
        const currentValues = this.values[contextId] || {}

        if (typeof customElement.attribs === 'object') {
          this.values[contextId] = {
            ...currentValues,
            ...document.values,
            ...customElement.attribs
          }
        } else {
          this.values[contextId] = Object.assign(currentValues, document.values)
        }

        const component = await this.createComponent({
          id: customElement.name,
          values: this.values[contextId],
          element: customElement,
          document,
          contextId,
          index: i
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

      if (this._scripts.content[document.path.pathname]) {
        const scripts = this._scripts.content[document.path.pathname]

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

        /** @type {CoraliteElement} */
        const scriptElement = {
          type: 'tag',
          name: 'script',
          parent: bodyElement,
          attribs: {
            type: 'module'
          },
          children: []
        }

        scriptElement.children.push({
          type: 'text',
          data: scriptTextContent,
          parent: scriptElement
        })

        bodyElement.children.push(scriptElement)
      }

      let rawHTML = ''
      try {
        // render document
        const rawHTML = this.transform(document.root)
      } finally {
        // Restore original document after rendering
        for (const item of restoreQueue) {
          item.parent.children = item.originalChildren
        }
      }

      yield {
        path: document.path,
        html: rawHTML,
        duration: performance.now() - startTime
      }

      // memory clean up
      this._currentRenderQueue[q] = null
    }
  } finally {
    // Ensure cleanup on early termination (e.g., generator aborted)
    this._currentRenderQueue = []
    this.values = {}
    this._scripts.restore()
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
 * @param {string | string[]} [path] - The target directory or an array of specific page paths to build.
 * @param {Object} [options] - Configuration options for the build process.
 * @param {number} [options.maxConcurrent=availableParallelism] - The maximum number of concurrent file write operations.
 * @param {AbortSignal} [options.signal] - An AbortSignal to cancel the build operation.
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
  if (typeof args[1] === 'function') {
    callback = args[1]
  } else {
    options = args[1]
    callback = args[2]
  }

  // Add options with defaults
  const signal = options?.signal
  const maxConcurrent = options?.maxConcurrent || availableParallelism()

  // Initialize the limiter
  const limit = pLimit(maxConcurrent)
  const executing = new Set()
  const results = []

  try {
    for await (const result of this._generatePages(path)) {
      // Check for immediate cancellation
      if (signal?.aborted) throw signal.reason

      // Backpressure - don't pull more data than we can process
      if (executing.size >= limit.concurrency) {
        await Promise.race(executing)
      }

      const task = limit(async () => {
        // Exit early if build was cancelled while in queue
        if (signal?.aborted) throw signal.reason

        if (typeof callback === 'function') {
          return await callback(result)
        } else {
          return result
        }
      })

      executing.add(task)

      // Clean up task
      task.then((callbackResult) => {
        if (callbackResult) {
          results.push(callbackResult)
        }

        executing.delete(task)
      }).catch(() => {
        executing.delete(task)
      })
    }

    await Promise.all(executing)

    if (callback) {
      return results
    }

  } catch (error) {
    // Clean up - If one fails or we abort, wait for pending to settle
    await Promise.allSettled(executing)

    if (error.name === 'AbortError') {
      console.warn('Build cancelled by user.')
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

  const results = await this.build(path, options, async (result) => {
    const relDir = relative(this.options.path.pages, result.path.dirname)
    const outDir = join(output, relDir)
    const outFile = join(outDir, result.path.filename)

    await mkdir(outDir, { recursive: true })

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
 * @returns {string} returns raw HTML
 */
Coralite.prototype.transform = function (root) {
  // @ts-ignore
  return render(root, {
    emptyAttrs: false
  })
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
 * Adds a page to the current render queue.
 * @param {string|CoraliteCollectionItem} value - The path to a page or a CoraliteCollectionItem to add to the render queue.
 */
Coralite.prototype.addRenderQueue = async function (value) {
  if (typeof value === 'string') {
    const document = this.pages.getItem(value)

    if (!document) {
      throw new Error('addRenderQueue - unexpected page ID: "' + value + '"')
    }

    this._currentRenderQueue.push(document)
  } else if (isCoraliteCollectionItem(value)) {
    const document = await this.pages.setItem(value)

    // add render queue
    this._currentRenderQueue.push(document)
  }
}

/**
 * @param {Object} options
 * @param {string} options.id - id - Unique identifier for the component
 * @param {CoraliteModuleValues} [options.values={}] - Token values available for replacement
 * @param {CoraliteElement} [options.element] - Mapping of component IDs to their module definitions
 * @param {CoraliteDocument} options.document - Current document being processed
 * @param {string} [options.contextId] - Context Id
 * @param {number} [options.index] - Context index
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
  index
}, head = true) {
  const templateItem = this.templates.getItem(id)

  if (!templateItem) {
    return console.warn('Could not find component "' + id + '" used in document "' + document.path.pathname + '"')
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

  // merge values from component script
  if (module.script) {
    const scriptResult = await this._evaluate({
      module,
      element,
      values,
      document,
      contextId
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
      this._scripts.add(document.path.pathname, {
        id: contextId,
        templateId: module.id,
        document,
        refs,
        values: scriptResult.__script__.values
      })

      delete scriptResult.__script__
    }

    values = Object.assign(values, scriptResult)
    this.values[contextId] = values
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

    const childContextId = contextId + i + customElement.name
    const currentValues = this.values[childContextId] || {}

    // append custom attributes to values
    if (typeof customElement.attribs === 'object') {
      const attribValues = cleanKeys(customElement.attribs)

      this.values[childContextId] = {
        ...currentValues,
        ...values,
        ...attribValues
      }
    } else {
      this.values[childContextId] = Object.assign(currentValues, values)
    }

    const component = await this.createComponent({
      id: customElement.name,
      values: this.values[childContextId],
      element: customElement,
      document,
      contextId: childContextId,
      index
    }, false)
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

      if (!slotNodes.length) {
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
              const currentValues = this.values[slotContextId] || {}

              if (typeof node.attribs === 'object') {
                this.values[slotContextId] = {
                  ...currentValues,
                  ...values,
                  ...node.attribs
                }
              } else {
                this.values[slotContextId] = Object.assign(currentValues, values)
              }

              const component = await this.createComponent({
                id: node.name,
                values: this.values[slotContextId],
                element: node,
                document,
                contextId: slotContextId,
                index
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
 *
 * @returns {Promise<CoraliteModuleValues>}
 */
Coralite.prototype._evaluate = async function ({
  module,
  values,
  element,
  document,
  contextId
}) {
  this._source.currentSourceContextId = contextId

  const context = {
    ...this._source.contextModules,
    ...this._source.context,
    document,
    values,
    element,
    module,
    id: contextId
  }
  this._source.contextInstances[contextId] = context

  // Retrieve Template and check cache
  const templateItem = this.templates.getItem(module.id)

  if (!templateItem.result._compiledCode) {
    // Transform ESM to CJS using esbuild
    // We use CJS format so esbuild handles the import/export transformation
    const { code } = await transform(module.script, {
      loader: 'js',
      format: 'esm',
      target: 'node18',
      platform: 'node'
    })

    const cjsCode = convertEsmToCjs(code)

    // Wrap the transformed code in an async IIFE to support Top-Level Await (TLA)
    templateItem.result._compiledCode = `
      return (async () => {
        ${cjsCode}
      })();`
  }

  // Create a require function anchored to the template's file path to resolve relative imports
  const fileRequire = createRequire(resolve(templateItem.path.pathname))

  const customRequire = (id) => {
    // Intercept 'coralite' import to return the current context
    if (id === 'coralite') {
      return {
        ...context,
        default: context
      }
    }
    // Intercept 'coralite/plugins'
    if (id === 'coralite/plugins') {
      const plugins = this._source.context.plugins
      return {
        ...plugins,
        default: plugins
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
    templateItem.result._compiledCode
  )

  // Execute the function with our mocks and context
  await fn(moduleMock, moduleMock.exports, customRequire, context)

  if (moduleMock.exports.default != null) {
    return moduleMock.exports.default
  }

  throw new Error(`Module "${module.id}" has no default export`)
}

/**
 * @template {Object} T
 * Executes all plugin callbacks registered under the specified hook name.
 * @param {'onPageSet'|'onPageUpdate'|'onPageDelete'|'onTemplateSet'|'onTemplateUpdate'|'onTemplateDelete'} name - The name of the hook to trigger.
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
 * @param {'onPageSet'|'onPageUpdate'|'onPageDelete'|'onTemplateSet'|'onTemplateUpdate'|'onTemplateDelete'} name - The name of the hook to register the callback with.
 * @param {Function} callback - The callback function to be executed when the hook is triggered.
 */
Coralite.prototype._addPluginHook = function (name, callback) {
  const pluginCallback = callback.bind(this)

  if (this._plugins.hooks[name]) {
    this._plugins.hooks[name].push(pluginCallback)
  }
}

/**
 * Replaces a token in a Coralite node based on its type, attribute, and content.
 *
 * @param {Object} token - The token to replace.
 * @param {string} token.type - The type of the token ('attribute' or 'text').
 * @param {CoraliteElement|CoraliteTextNode} token.node - The node containing the token.
 * @param {string} [token.attribute] - The attribute name to replace within the node.
 * @param {string} token.content - The content of the token.
 * @param {CoraliteModuleValue} token.value - The value associated with the token.
 */
function replaceToken ({
  type,
  node,
  attribute,
  content,
  value
}) {
  if (
    type === 'attribute'
    && node.type === 'tag'
    && typeof value === 'string'
  ) {
    node.attribs[attribute] = node.attribs[attribute].replace(content, value)
  } else if (node.type === 'text') {
    if (typeof value === 'object') {
      if (!Array.isArray(value)) {
        // handle single nodes
        value = [value]
      }

      // inject nodes
      const textSplit = node.data.split(content)
      const childIndex = node.parent.children.indexOf(node)
      const children = []

      // append computed tokens in between token split
      for (let i = 0; i < value.length; i++) {
        const child = value[i]

        if (typeof child !== 'string' && child.type !== 'directive') {
          // update child parent
          child.parent = node.parent
          children.push(child)
        }
      }

      // replace computed token
      node.parent.children.splice(childIndex, 1,
        {
          type: 'text',
          data: textSplit[0],
          parent: node.parent
        },
        ...children,
        {
          type: 'text',
          data: textSplit[1],
          parent: node.parent
        })
    } else {
      // replace token string
      node.data = node.data.replace(content, value)
    }
  }
}

export default Coralite
