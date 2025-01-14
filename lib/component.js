import { join } from 'node:path'

/**
 * @import { CoraliteCustomElement } from './get-custom-elements-from-string.js'
 * @import { CoralitePath } from './merge-component-to-document.js'
 * @import { HTMLData } from './get-html.js'
 */

import getHTML from './get-html.js'
import getMetadataFromDocument from './get-metadata-from-document.js'
import replaceAttributeTokenValue from './replace-attribute-token-value.js'

/**
 * @callback coraliteComputedTokens
 * @param {Object} thisArgs
 * @returns {Promise<Object<string, string>>}
 */

/**
 * @typedef {Object} CoraliteToken
 * @property {string} name - Token name
 * @property {string} content - End position of token
 */

/**
 * @typedef {Object} CoraliteTokenOptions
 * @property {Object.<string, string>} [default] - Token defaults
 * @property {Object.<string, string[]>} [aliases] - Token aliases
 */

/**
 * @typedef {Object} CoraliteComponent
 * @property {string} id
 * @property {string} content
 * @property {CoraliteToken[]} tokens
 * @property {coraliteComputedTokens} computedTokens
 * @property {CoraliteCustomElement[]} customElements
 */

/**
 * @param {Object.<string, Function>} tokens
 */
export async function computedTokens (tokens) {
  const result = {}

  for (const key in tokens) {
    if (Object.prototype.hasOwnProperty.call(tokens, key)) {
      result[key] = await tokens[key].call(this)
    }
  }

  return result
}

/**
 * @param {Object.<string, CoraliteComponent>} components
 * @param {CoralitePath} path
 * @param {Object.<string, string>} values
 * @param {HTMLData} document
 */
function createContext (components, path, values, document) {
  return {
    /**
     * @param {Object} options
     * @param {string} options.path
     * @param {string} options.componentId
     * @param {boolean} [options.recursive]
     * @param {CoraliteTokenOptions} [options.tokens]
     */
    async aggregate (options) {
      const component = components[options.componentId]

      if (!component) {
        throw new Error('Aggregate: no component found by the id: ' + options.componentId)
      }

      const pages = await getHTML({
        path: join(path.pages, options.path),
        recursive: options.recursive,
        exclude: [document.name]
      })

      let result = ''
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i]
        const metadata = getMetadataFromDocument(page.content)
        const pageValues = Object.assign({}, values)

        for (let i = 0; i < metadata.length; i++) {
          const item = metadata[i]

          pageValues[item.name] = item.content
        }

        result += await render(component, {
          values: pageValues,
          tokens: options.tokens,
          path,
          components,
          document: page
        })
      }

      return result
    },
    ...values
  }
}

/**
 * @param {CoraliteComponent} component
 * @param {Object} context
 * @param {Object} context.values
 * @param {CoralitePath} context.path
 * @param {CoraliteTokenOptions} [context.tokens={ default: {}, aliases: {}}]
 * @param {Object.<string, CoraliteComponent>} [context.components]
 * @param {HTMLData} [context.document]
 */
export async function render (component, {
  values,
  path,
  tokens = {
    default: {},
    aliases: {}
  },
  components,
  document
}) {
  // set alias values
  for (const name in tokens.aliases) {
    if (Object.prototype.hasOwnProperty.call(tokens.aliases, name)) {
      const aliases = tokens.aliases[name]

      if (!values[name]) {
        for (let i = 0; i < aliases.length; i++) {
          const alias = aliases[i]

          if (values[alias]) {
            values[name] = values[alias]
            break
          }
        }
      }
    }
  }

  // set default values
  for (const name in tokens.default) {
    if (Object.prototype.hasOwnProperty.call(tokens.default, name)) {
      if (!values[name]) {
        values[name] = tokens.default[name]
      }
    }
  }

  const context = createContext(components, path, values, document)
  const computedValues = await component.computedTokens(context)

  if (computedValues) {
    values = Object.assign(values, computedValues)
  }

  // render nested components
  for (let index = 0; index < component.customElements.length; index++) {
    const element = component.customElements[index]
    const nestedComponent = components[element.id]

    if (!nestedComponent) {
      throw new Error('No component found by the id: ' + element.id)
    }

    // add values from attributes
    for (let i = 0; i < element.attributes.length; i++) {
      const attribute = element.attributes[i]

      values[attribute.name] = replaceAttributeTokenValue(attribute, values)
    }
  }

  let result = component.content

  // render nested components
  for (let index = 0; index < component.customElements.length; index++) {
    const element = component.customElements[index]
    const nestedComponent = components[element.id]
    const renderedComponent = await render(nestedComponent, {
      values,
      path,
      components,
      document
    })

    result = result.replace(element.content, renderedComponent)
  }


  // replace tokens with values
  for (let i = 0; i < component.tokens.length; i++) {
    const token = component.tokens[i]
    const name = token.name
    const value = values[name] || ''

    if (!value) {
      console.error('Token "' + name +'" was empty used on "' + component.id + '" component within the document:' + document.parentPath + '/' + document.name)
    }

    result = result.replace(token.content, value)
  }

  return result
}

