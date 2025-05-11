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
 * These exports are placeholder for types
 * The HTML module code is run in the `parseScript` function in parse.js
 */

/**
 * @callback DefineComponentSlot
 * @param {CoraliteAnyNode[]} nodes - The nodes to be rendered in the component's slots
 * @param {Object.<string, string>} values - Attribute values
 */

/**
 * @callback DefineComponentToken
 * @param {Object.<string, string>} values - Attribute values
 */

/**
 * @type {Object.<string, string>}
 */
export const tokens = {}

/**
 * Defines a Coralite component
 *
 * @param {Object} options
 * @param {string} [options.id] - Optional component id, if not defined, the id will be extracted from the first top level element with the id attribute
 * @param {Object.<string, (string | DefineComponentToken)>} [options.tokens] - Token names and values are either strings or functions representing the corresponding tokens' content or behavior.
 * @param {Object.<string, DefineComponentSlot>} [options.slots] - Middleware for slot content
 * @returns {Promise<Object.<string, string>>}
 */
export async function defineComponent (options) {
  /** @type {Object.<string, string>} */
  return {}
}

/**
 * Aggregates HTML content from specified paths into a single collection of components.
 *
 * @param {CoraliteAggregate} options - Configuration object for the aggregation process
 * @returns {Promise<(CoraliteElement | CoraliteTextNode)[]>}
 */
export async function aggregate (options) {
  return []
}

/**
 * @param {Object} options
 * @param {string} options.templates - The path to the directory containing Coralite templates.
 * @param {string} options.pages - The path to the directory containing pages that will be rendered using the provided templates.
 * @param {[string, string][]} [options.ignoreByAttribute] - Elements to ignore with attribute name value pair
 *
 * @return {Promise<Array<CoraliteResult>>} - An array of objects containing the document and HTML content for each page in pages directory with their respective render times.
 * @example
 * ```
 * coralite({
 *   templates: './path/to/templates',
 *   pages: './path/to/pages'
 *   ignoreByAttribute: [['data-dev', 'true']]
 * })
 * .then((documents) => {
 *   documents.forEach(({ document, html, duration }) => {
 *     console.log(`Rendered ${document.title} in ${duration}ms.`);
 *     console.log(html);
 *   });
 * })
 * .catch(console.error);
 * ```
 */
export async function coralite ({
  templates,
  pages,
  ignoreByAttribute
}) {
  const startTime = performance.now()
  const htmlTemplates = await getHtmlFiles({
    path: templates,
    recursive: true
  })
  const htmlPages = await getHtmlFiles({
    path: pages,
    recursive: true
  })

  /** @type {Object.<string, CoraliteModule>} */
  const components = {}

  // create templates
  for (let i = 0; i < htmlTemplates.length; i++) {
    const html = htmlTemplates[i]
    const component = parseModule(html.content, {
      ignoreByAttribute
    })

    components[component.id] = {
      ...component,
      path: html.path
    }
  }

  /** @type {CoraliteResult[]} */
  const documents = []

  for (let i = 0; i < htmlPages.length; i++) {
    const html = htmlPages[i]
    await renderDocument({
      html,
      pages,
      templates,
      ignoreByAttribute,
      components,
      startTime,
      documents
    })
  }

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
