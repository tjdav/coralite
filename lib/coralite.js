import { createComponent, parseHTMLDocument, parseModule, getHtmlFiles } from '#lib'
import render from 'dom-serializer'

/**
 * @import {
 *  CoraliteElement,
 *  CoraliteTextNode,
 *  CoraliteAnyNode,
 *  CoraliteModule,
 *  CoraliteResult,
 *  CoraliteAggregate,
 *  IgnoreByAttribute,
 *  HTMLData } from '#types'
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
  this.templates = getHtmlFiles({
    path: templates,
    recursive: true,
    onFileLoaded (value) {
      const template = parseModule(value.content, {
        ignoreByAttribute
      })
      return {
        id: template.id,
        value: template
      }
    }
  })

  this.pages = getHtmlFiles({
    path: pages,
    recursive: true,
    onFileLoaded (value) {
      const result = parseHTML(value.content, ignoreByAttribute)

      return {
        value: {
          path: value.path,
          customElements: result.customElements,
          root: result.root
        }
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
    path: {
      templates,
      pages
    },
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

  /** @type {CoraliteDocumentCollectionItem[]} */
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
      const pathname = path[i]
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

  for (let i = 0; i < this._currentRenderQueue.length; i++) {
    const document = this._currentRenderQueue[i].result

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

    documents.push(result)
  }

  this._currentRenderQueue = []

  return documents
}

/**
 * Renders an HTML document using the provided configuration and components.
 *
 * @param {Object} param
 * @param {HTMLData} param.html - The raw HTML content to render.
 * @param {string} param.pages - Path to the root pages directory.
 * @param {string} param.templates - Path to the root templates directory.
 * @param {IgnoreByAttribute} param.ignoreByAttribute - An array of attribute names and values to ignore by element type.
 * @param {Object} param.components - Components configuration used during rendering.
 * @param {number} param.startTime - Timestamp when rendering started (for performance tracking).
 * @param {CoraliteResult[]} [param.documents=[]] - Array of rendered documents to accumulate results.
 * @param {boolean} [param.isHead=true] - Whether this is the head section (controls recursive rendering behavior).
 *
 * @returns {Promise<CoraliteResult[]>} A promise that resolves to an array of rendered document results.
 */
async function renderDocument ({
  html,
  pages,
  templates,
  ignoreByAttribute,
  components,
  startTime,
  documents = [],
  isHead = true
}) {
  const document = parseHTMLDocument(html, {
    pages,
    templates
  }, ignoreByAttribute)

  for (let i = 0; i < document.customElements.length; i++) {
    const customElement = document.customElements[i]
    const component = await createComponent({
      id: customElement.name,
      values: customElement.attribs,
      element: customElement,
      components,
      document
    })

    if (component) {
      const element = component.element
      for (let i = 0; i < element.children.length; i++) {
        // update component parent
        element.children[i].parent = customElement.parent
      }

      const index = customElement.parent.children.indexOf(customElement, customElement.parentChildIndex)
      // replace custom element with template
      customElement.parent.children.splice(index, 1, ...element.children)

      if (isHead && component.documents) {
        for (let i = 0; i < component.documents.length; i++) {
          const html = component.documents[i]
          await renderDocument({
            html,
            pages,
            templates,
            ignoreByAttribute,
            components,
            startTime,
            documents,
            isHead: false
          })
        }
      }
    }
  }

  // render document
  // @ts-ignore
  const result = render(document.root)

  documents.push({
    item: document,
    html: result,
    duration: performance.now() - startTime
  })

  return documents
}

export default coralite
