import { parseModule, getHtmlFiles, parseHTML, cleanKeys } from '#lib'
import render from 'dom-serializer'
import { isCoraliteElement, isCoralitePageItem } from './type-helper.js'
import { resolve, join } from 'node:path'
import { createContext, SourceTextModule } from 'node:vm'
import { defineComponent } from '#plugins'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'

/**
 * @import {
 *  CoraliteElement,
 *  CoraliteTextNode,
 *  CoraliteAnyNode,
 *  CoraliteModule,
 *  CoraliteResult,
 *  CoraliteModuleValues,
 *  CoraliteDocument,
 *  CoraliteDirective,
 *  CoraliteModuleValue,
 *  CoraliteCollectionItem,
 *  CoraliteDocumentRoot,
 *  CoralitePluginInstance,
 *  CoraliteCollectionEventSet,
 *  IgnoreByAttribute} from '#types'
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
  plugins = [],
  ignoreByAttribute
}) {
  const version = process.versions.node.split('.')

  if (version[0] >= '18' && version[1] >= '19') {
    throw new Error('Node version does not meet the minimum requirement of >=18.19.0.')
  }

  const path = {
    templates,
    pages
  }
  this._options = {
    templates,
    pages,
    ignoreByAttribute,
    path,
    plugins: {
      templates: [],
      hooks: {
        onPageCreate: [],
        onPageUpdate: [],
        onPageDelete: [],
        onTemplateCreate: [],
        onTemplateUpdate: [],
        onTemplateDelete: []
      }
    },
    source: {
      modules: {
        coralite: {
          export: 'export const document = coralite.document;'
          + 'export const values = coralite.values;'
          + 'export const path = coralite.path;'
          + 'export const excludeByAttribute = coralite.excludeByAttribute;'
          + 'export const templates = coralite.templates;'
          + 'export const pages = coralite.pages;',
          default: 'export default { values, document, path, excludeByAttribute, templates, pages }'
        },
        plugins: {
          export: '',
          default: 'export default { '
        }
      },
      currentContextId: '',
      contextInstances: {},
      context: {
        plugins: {},
        path,
        excludeByAttribute: ignoreByAttribute,
        templates: this.templates,
        pages: this.pages
      }
    }
  }
  this.values = {}
  this.templates = getHtmlFiles({
    path: templates,
    recursive: true,
    type: 'template',
    onFileSet (value) {
      const template = parseModule(value.content, {
        ignoreByAttribute
      })

      return {
        type: 'template',
        id: template.id,
        value: template
      }
    },
    onFileUpdate (value) {
      return parseModule(value.content, {
        ignoreByAttribute
      })
    }
  })

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
  const onFileSet = (data) => {
    const result = parseHTML(data.content, ignoreByAttribute)

    // track parent-child relationship between custom elements
    for (let i = 0; i < result.customElements.length; i++) {
      const customElement = result.customElements[i]
      const name = customElement.name
      let item = pageCustomElements[name]

      if (!item) {
        pageCustomElements[name] = new Set()
        item = pageCustomElements[name]

        const template = this.templates.getItem(name)
        if (template && template.result.customElements.length) {
          const stack = [template.result.customElements]

          while (stack.length > 0) {
            const current = stack.pop()

            for (let i = 0; i < current.length; i++) {
              const element = current[i]

              if (!childCustomElements[element.name]) {
                childCustomElements[element.name] = name

                // process nested elements recursively
                const template = this.templates.getItem(element.name)

                if (template.result.customElements.length) {
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

    result.meta.$pathname = data.path.pathname
    result.meta.$dirname = data.path.dirname
    result.meta.$filename = data.path.filename

    return {
      type: 'page',
      value: {
        values: Object.assign(result.meta, data.values || {}),
        path: data.path,
        customElements: result.customElements,
        root: result.root
      }
    }
  }

  /** @type {CoraliteCollection} */
  this.pages = getHtmlFiles({
    path: pages,
    recursive: true,
    type: 'page',
    onFileSet,
    onFileUpdate (newValue, oldValue) {
      let newCustomElements

      if (!newValue.result) {
        const result = onFileSet(newValue)

        newValue = result.value
        newCustomElements = result.value.customElements
      } else {
        newCustomElements = newValue.result.customElements
      }

      let oldElements = oldValue.result.customElements.slice()

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
    onFileDelete (value) {
      const customElements = value.result.customElements

      for (let i = 0; i < customElements.length; i++) {
        const pageCustomElement = pageCustomElements[customElements[i]]

        // remove page from custom element reference
        pageCustomElement.delete(value.path.pathname)
      }
    }
  })

  this._sourceModules = 'export const document = coralite.document;'
    + 'export const values = coralite.values;'
    + 'export const path = coralite.path;'
    + 'export const excludeByAttribute = coralite.excludeByAttribute;'
    + 'export const templates = coralite.templates;'
    + 'export const pages = coralite.pages;'
  this._sourceModuleDefault = 'export default { values, document, path, excludeByAttribute, templates, pages'
  this._currentSourceContextId = ''
  this._sourceContextInstances = {}
  this._sourceContext = {
    plugins: {},
    path: this.path,
    excludeByAttribute: ignoreByAttribute,
    templates: this.templates,
    pages: this.pages
  }

  plugins.unshift(defineComponent)

  for (let i = 0; i < plugins.length; i++) {
    const { name, method, templates } = plugins[i]
    const callback = method.bind(this)

    this._sourceModules += `export const ${name} = coralite.plugins.${name};`
    this._sourceModuleDefault += ', ' + name
    this._sourceContext.plugins[name] = (options) => {
      const context = this._sourceContextInstances[this._currentSourceContextId]

      return callback(options, context)
    }

    for (let i = 0; i < templates.length; i++) {
      this.templates.setItem(templates[i])
    }
  }

  this._sourceModuleDefault += ' }'

  /** @type {CoraliteCollectionItem[]} */
  this._currentRenderQueue = []
}

/**
 * Compiles specified page(s) by rendering their document content and measuring render time.
 * Processes pages based on provided path(s), replacing custom elements with components,
 * and returns rendered results with performance metrics.
 *
 * @param {string | string[]} [path] - Path to a single page or array of page paths relative to the pages directory. If omitted, compiles all pages.
 * @return {Promise<Array<CoraliteResult>>}
 */
Coralite.prototype.compile = async function (path) {
  const startTime = performance.now()
  this._currentRenderQueue = this.pages.list.slice()

  if (Array.isArray(path)) {
    this._currentRenderQueue = []

    for (let i = 0; i < path.length; i++) {
      let pathname = path[i]

      if (pathname.startsWith(this.path.pages)) {
        pathname = pathname.substring(this.path.pages.length - 1)
      }

      const result = this.pages.getListByPath(pathname)

      if (Array.isArray(result)) {
        this._currentRenderQueue = this._currentRenderQueue.concat(result)
      } else {
        const result = this.pages.getItem(pathname)

        if (result) {
          this._currentRenderQueue.push(result)
        }
      }
    }
  } else if (typeof path === 'string') {
    if (path.startsWith(this.path.pages)) {
      path = path.substring(this.path.pages.length - 1)
    }

    const result = this.pages.getListByPath(path)
    this._currentRenderQueue = []

    if (Array.isArray(result)) {
      this._currentRenderQueue = this._currentRenderQueue.concat(result)
    } else {
      const result = this.pages.getItem(path)

      if (result) {
        this._currentRenderQueue.push(result)
      }
    }
  }

  /** @type {CoraliteResult[]} */
  const results = []

  for (let i = 0; i < this._currentRenderQueue.length; i++) {
    const document = structuredClone(this._currentRenderQueue[i].result)

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
        contextId
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

    // render document
    const rawHTML = this._render(document.root)
    const result = {
      item: document,
      html: rawHTML
    }

    if (startTime) {
      result.duration = performance.now() - startTime
    }

    results.push(result)
  }

  this._currentRenderQueue = []
  this.values = {}

  return results
}

/**
 * Saves processed documents as HTML files to the specified output directory.
 * @param {Array<CoraliteResult>} documents - Array of document objects containing metadata and HTML content
 * @param {string} output - Base directory path where generated HTML files will be saved
 */
Coralite.prototype.save = async function (documents, output) {
  try {
    // create a list of promises for writing each document's HTML file
    const writePromises = documents.map(async (document) => {
      const dir = join(output, document.item.path.dirname)
      const filename = join(dir, document.item.path.filename)

      // ensure the directory exists
      await mkdir(dir, { recursive: true })

      // write the HTML content to the file
      await writeFile(filename, document.html)

      return filename
    })

    // wait for all files to be written
    const outputFiles = await Promise.all(writePromises)
    return outputFiles
  } catch (error) {
    throw error
  }
}

/**
 * Renders the provided node or array of nodes using the render function.
 * This method serves as an internal utility to handle the rendering process.
 *
 * @param {CoraliteDocumentRoot | CoraliteAnyNode | CoraliteAnyNode[]} root - The node(s) to be rendered.
 * @returns {string} returns raw HTML
 */
Coralite.prototype._render = function (root) {
  // @ts-ignore
  return render(root)
}

/**
 * Retrieves page paths associated with a custom element template.
 *
 * @param {string} path - The original path potentially prefixed with the templates directory.
 * @returns {string[]} An array of page paths linked to the custom element template.
 */
Coralite.prototype.getPagePathsUsingCustomElement = function (path) {
  // normalize path by removing the templates directory prefix
  if (path.startsWith(this.path.templates)) {
    path = path.substring(this.path.templates.length + 1)
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
Coralite.prototype.addRenderQueue = function (value) {
  if (typeof value === 'string') {
    const document = this.pages.getItem(value)

    if (!document) {
      throw new Error('addRenderQueue - unexpected page ID: "' + value + '"')
    }

    this._currentRenderQueue.push(document)
  } else if (isCoralitePageItem(value)) {
    const document = this.pages.setItem(value)

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
  contextId
}, head = true) {
  const templateItem = this.templates.getItem(id)

  if (!templateItem) {
    return console.warn('Could not find component "' + id +'" used in document "' + join(this.path.pages, document.path.pathname) + '"')
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
  const module = structuredClone(templateItem.result)
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
      contextId: childContextId
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
              contextId: slotContextId
            }, false)

            if (component) {
              slotNodes.splice(i, 1, ...component.children)
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
 * Parses a Coralite module script and compiles it into JavaScript.
 *
 * @param {Object} data
 * @param {CoraliteModule} data.module - The Coralite module to parse
 * @param {CoraliteModuleValues} data.values - Replacement tokens for the component
 * @param {CoraliteElement} data.element - The Coralite module to parse
 * @param {CoraliteDocument} data.document - The document context in which the module is being processed
 * @param {string} data.contextId - Context Id
 *
 * @returns {Promise<Object.<string, string | (CoraliteDirective | CoraliteAnyNode)[]>>}
 */
Coralite.prototype._evaluate = async function ({
  module,
  values,
  element,
  document,
  contextId
}) {
  this._currentSourceContextId = contextId

  const context = {
    ...this._sourceContext,
    document,
    values,
    element,
    module,
    id: contextId
  }

  this._sourceContextInstances[contextId] = context
  // create a new context object with the provided context and global objects
  const contextifiedObject = createContext({
    console: globalThis.console,
    crypto: globalThis.crypto,
    coralite: context
  })
  const template = this.templates.getItem(module.id)
  let parentPath = template.path.dirname

  // resolve the parent path of the template
  if (!existsSync(parentPath)) {
    parentPath = resolve(join(this.path.templates, template.path.dirname))

    if (!existsSync(parentPath)) {
      throw new Error('Template directory not found: ' + parentPath)
    }
  }

  // create a new source text module with the provided script content, configuration options, and context
  const script = new SourceTextModule(module.script, {
    initializeImportMeta (meta) {
      meta.url = process.cwd()
    },
    lineOffset: module.lineOffset,
    identifier: join(parentPath, template.path.filename),
    context: contextifiedObject
  })

  const linker = this._moduleLinker(parentPath)

  await script.link(linker)

  // evaluate the module to execute its content
  await script.evaluate()

  // @ts-ignore
  if (script.namespace.default) {
    // @ts-ignore
    return await script.namespace.default
  }

  // throw an error if no default export was found
  throw new Error(`Module "${module.id}" has no default export`)
}

/**
 * @param {string} path
 */
Coralite.prototype._moduleLinker = function (path) {
  /**
   * @param {string} specifier - The specifier of the requested module
   * @param {Module} referencingModule - The Module object link() is called on.
   * @param {{ attributes: ImportAttributes }} extra - The type for the with property of the optional second argument to import().
   */
  return async (specifier, referencingModule, extra) => {
    if (specifier === 'coralite') {
      return new SourceTextModule(this._sourceModules + this._sourceModuleDefault, { context: referencingModule.context })
    }

    if (specifier.startsWith('.')) {
      // handle relative path
      specifier = join(path, specifier)
    } else {
      // handle modules
      specifier = import.meta.resolve(specifier, new URL('file://' + path))
    }

    const module = await import(specifier, { with: extra.attributes })
    let exportModule = ''

    for (const key in module) {
      if (Object.prototype.hasOwnProperty.call(module, key)) {
        const name = 'globalThis["'+ specifier + '"].'

        if (key === 'default') {
          exportModule += 'export default ' + name + key + ';\n'
        } else {
          exportModule += 'export const '+ key + ' = ' + name + key + ';\n'
        }
      }

      referencingModule.context[specifier] = module
    }

    return new SourceTextModule(exportModule, {
      context: referencingModule.context
    })
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
