import { createComponent, parseHTMLDocument, parseModule, getHtmlFiles } from '#lib'
import render from 'dom-serializer'

/**
 * @import {
 *  CoraliteElement,
 *  CoraliteTextNode,
 *  CoraliteAnyNode,
 *  CoraliteModule,
 *  CoraliteResult,
 *  CoraliteAggregate } from '#types'
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
  const coraliteModules = {}
  /** @type {CoraliteResult[]} */
  const documents = []

  // create templates
  for (let i = 0; i < htmlTemplates.length; i++) {
    const html = htmlTemplates[i]
    const coraliteModule = parseModule(html.content, {
      ignoreByAttribute
    })

    coraliteModules[coraliteModule.id] = {
      ...coraliteModule,
      parentPath: html.parentPath,
      filename: html.name
    }
  }

  for (let i = 0; i < htmlPages.length; i++) {
    const html = htmlPages[i]
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
        components: coraliteModules,
        document
      })

      if (!component) {
      // skip if no component
        continue
      }

      for (let i = 0; i < component.children.length; i++) {
      // update component parent
        component.children[i].parent = customElement.parent
      }
      const index = customElement.parent.children.indexOf(customElement, customElement.parentChildIndex)
      // replace custom element with template
      customElement.parent.children.splice(index, 1, ...component.children)
    }

    // render document
    // @ts-ignore
    const result = render(document.root)

    documents.push({
      item: document,
      html: result,
      duration: performance.now() - startTime
    })
  }

  return documents
}

export default coralite
