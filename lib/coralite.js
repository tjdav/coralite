import { parseModule, getHtmlFiles, parseHTML, cleanKeys } from '#lib'
import render from 'dom-serializer'
import { isCoraliteElement, isCoralitePageItem } from './type-helper.js'
import { resolve, join } from 'node:path'
import { createContext, SourceTextModule } from 'node:vm'
import defineComponent from '../plugins/define-component.js'

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
 *  CoraliteCollectionItem } from '#types'
 * @import {Module} from 'node:vm'
 */

/**
 * @constructor
 * @param {Object} options
 * @param {string} options.templates - The path to the directory containing Coralite templates.
 * @param {import('./plugin.js').CoralitePlugin[]} [options.plugins=[]]
 * @param {string} options.pages - The path to the directory containing pages that will be rendered using the provided templates.
 * @param {[string, string][]} [options.ignoreByAttribute] - Elements to ignore with attribute name value pair
 */
export function Coralite ({
  templates,
  pages,
  plugins = [],
  ignoreByAttribute
}) {
  this.path = {
    templates,
    pages
  }

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

  this.pages = getHtmlFiles({
    path: pages,
    recursive: true,
    type: 'page',
    onFileSet: (value) => {
      const result = parseHTML(value.content, ignoreByAttribute)

      for (let i = 0; i < result.customElements.length; i++) {
        const customElement = result.customElements[i]
        const name = customElement.name
        let item = pageCustomElements[name]

        if (!item) {
          pageCustomElements[name] = new Set()
          item = pageCustomElements[name]

          const template = this.templates.getItem(name)
          if (template.result.customElements.length) {
            const stack = [template.result.customElements]

            while (stack.length > 0) {
              const current = stack.pop()

              for (let i = 0; i < current.length; i++) {
                const element = current[i]

                // set child element
                if (!childCustomElements[element.name]) {
                  childCustomElements[element.name] = name

                  const template = this.templates.getItem(element.name)

                  if (template.result.customElements.length) {
                    // push nested custom elements to the stack to be processed
                    stack.push(template.result.customElements)
                  }
                }
              }
            }
          }
        }

        // add page to custom element collection
        item.add(value.path.pathname)
      }

      return {
        type: 'page',
        value: {
          path: value.path,
          customElements: result.customElements,
          root: result.root
        }
      }
    },
    onFileUpdate (newValue, oldValue) {
      const newCustomElements = newValue.result.customElements.filter(item => !oldValue.result.customElements.includes(item))
      const oldCustomElements = oldValue.result.customElements.filter(item => !newValue.result.customElements.includes(item))

      for (let i = 0; i < oldCustomElements.length; i++) {
        const pageCustomElement = pageCustomElements[oldCustomElements[i]]

        // remove page from custom element reference
        pageCustomElement.delete(newValue.path.pathname)
      }

      for (let i = 0; i < newCustomElements.length; i++) {
        const newCustomElement = newCustomElements[i]

        let item = pageCustomElements[newCustomElement.name]

        if (!item) {
          pageCustomElements[newCustomElement.name] = new Set()
          item = pageCustomElements[newCustomElement.name]
        }

        // add page to custom element collection
        item.add(newValue.path.pathname)
      }
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
  this._sourceContext = {
    values: {},
    plugins: {},
    path: this.path,
    excludeByAttribute: ignoreByAttribute,
    templates: this.templates,
    pages: this.pages
  }

  plugins.unshift(defineComponent)

  for (let i = 0; i < plugins.length; i++) {
    const { name, method } = plugins[i]
    const callback = method.bind(this)

    this._sourceModules += `export const ${name} = coralite.plugins.${name};`
    this._sourceModuleDefault += ', ' + name
    this._sourceContext.plugins[name] = (options) => callback(options, this._sourceContext)
  }

  this._sourceModuleDefault += ' }'

  /** @type {CoraliteCollectionItem[]} */
  this._currentRenderQueue = []
}

/**
 * @return {Promise<Array<CoraliteResult>>} - An array of objects containing the document and HTML content for each page in pages directory with their respective render times.
 */
Coralite.prototype.compile = async function (path) {
  const startTime = performance.now()

  /** @type {CoraliteResult[]} */
  const documents = []
  this._currentRenderQueue = this.pages.list

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
      const component = await this.createComponent({
        id: customElement.name,
        values: customElement.attribs,
        element: customElement,
        document
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
    // @ts-ignore
    const rawHTML = render(document.root)
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

  return results
}

/**
 * Retrieves page paths associated with a custom element template.
 *
 * @param {string} path - The original path potentially prefixed with the templates directory.
 * @returns {string[]} An array of page paths linked to the custom element template.
 */
Coralite.prototype.getPagePathsUsingCustomElement = function (path) {
  // Normalize path by removing the templates directory prefix
  if (path.startsWith(this.path.templates)) {
    path = path.substring(this.path.templates.length + 1)
  }

  // Retrieve the template item from the templates collection
  const item = this.templates.getItem(path)
  const pages = []

  // If template exists, collect associated page paths
  if (item) {
    const id = this._childCustomElements[item.result.id] || item.result.id
    const pageCustomElements = this._pageCustomElements[id]

    if (pageCustomElements) {
      // Iterate over custom element paths linked to this template
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

    this._currentRenderQueue.push(document)
  }
}

/**
 * @param {Object} options
 * @param {string} options.id - id - Unique identifier for the component
 * @param {CoraliteModuleValues} [options.values={}] - Token values available for replacement
 * @param {CoraliteElement} [options.element] - Mapping of component IDs to their module definitions
 * @param {CoraliteDocument} options.document - Current document being processed
 * @param {boolean} [head=true] - Indicates if the current function call is for the head of the recursion
 * @returns {Promise<CoraliteElement | void>}
 *
 * @example
 * ```
 * // Example usage:
 * const component = await createComponent({
 *   id: 'my-component',
 *   values: {
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
  document
}, head = true) {
  const templateItem = this.templates.getItem(id)

  if (!templateItem) {
    return console.warn('Could not find component "' + id +'" used in document "' + join(this.path.pages, document.path.pathname) + '"')
  }

  if (element && element.attribs) {
    values = Object.assign(values, element.attribs)
  }

  if (head) {
    // Convert object keys to camel case format for consistent naming conventions
    values = cleanKeys(values)
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
      document
    })

    values = Object.assign(values, scriptResult)
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

    // append custom attributes to values
    if (customElement.attribs) {
      const attribValues = cleanKeys(customElement.attribs)

      values = Object.assign(values, attribValues)
    }

    const component = await this.createComponent({
      id: customElement.name,
      values,
      element: customElement,
      document
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
            const component = await this.createComponent({
              id: node.name,
              values,
              element: node,
              document
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
 *
 * @returns {Promise<Object.<string, string | (CoraliteDirective | CoraliteAnyNode)[]>>}
 */
Coralite.prototype._evaluate = async function ({
  module,
  values,
  element,
  document
}) {
  const context = Object.assign(this._sourceContext, {
    document,
    values,
    element,
    module
  })

  // Create a new context object with the provided context and global objects
  const contextifiedObject = createContext({
    console: globalThis.console,
    crypto: globalThis.crypto,
    coralite: context
  })
  const template = this.templates.getItem(module.id)

  // Resolve the parent path of the template
  const parentPath = resolve(this.path.templates, template.path.pathname)
  const __dirname = parentPath.substring(0, parentPath.length - this.path.templates.length - 1)

  // Create a new source text module with the provided script content, configuration options, and context
  const script = new SourceTextModule(module.script, {
    initializeImportMeta (meta) {
      meta.url = __dirname
    },
    lineOffset: module.lineOffset,
    identifier: template.path.pathname,
    context: contextifiedObject
  })

  const linker = this._moduleLinker(parentPath)

  await script.link(linker)

  // Evaluate the module to execute its content
  await script.evaluate()

  // @ts-ignore
  if (script.namespace.default) {
    try {
      return await script.namespace.default
    } catch (err) {
      throw err
    }
  }

  // Throw an error if no default export was found
  throw new Error('Script found module export: "' + module.id + '"')
}

/**
 * @param {string} path
 */
Coralite.prototype._moduleLinker = function (path) {
  /**
   * @param {string} specifier - The specifier of the requested module
   * @param {Module} referencingModule - The Module object link() is called on.
   */
  return async (specifier, referencingModule) => {
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

    const module = await import(specifier)
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
    if (Array.isArray(value)) {
      // inject nodes
      const textSplit = node.data.split(content)
      const childIndex = node.parent.children.indexOf(node)
      const children = []

      // append computed tokens in between token split
      for (let i = 0; i < value.length; i++) {
        const child = value[i]

        if (typeof child !== 'string') {
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
