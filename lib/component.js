/**
 * @import { CoraliteCustomElement } from './getCustomElementsFromString.js'
 */

/**
 * @callback coraliteComputedTokens
 * @param {Object.<string,string>} tokens
 */

/**
 * @typedef {Object} CoraliteToken
 * @property {string} name - Token name
 * @property {number} startIndex - Start position of token
 * @property {number} endIndex - End position of token
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
export function computedTokens (tokens) {
  const result = {}

  for (const key in tokens) {
    if (Object.prototype.hasOwnProperty.call(tokens, key)) {
      result[key] = tokens[key].call(this)
    }
  }

  return result
}

/**
 * @param {CoraliteComponent} component
 * @param {Object} values
 * @param {Object.<string, CoraliteComponent>} components
 */
export function render (component, values, components) {
  let content = component.content
  const computedValues = component.computedTokens(values)

  if (computedValues) {
    values = Object.assign(values, computedValues)
  }

  let result = ''
  let index = 0
  let offset = 0
  let offsetStartIndex = 0

  // render nested components
  for (let index = 0; index < component.customElements.length; index++) {
    const element = component.customElements[index]
    const nestedComponent = components[element.id]

    if (!nestedComponent) {
      throw new Error('No component found by the id: ' + element.id)
    }

    const renderedComponent = render(nestedComponent, values, components)

    // insert nested component
    content = content.slice(0, element.index + offset)
    content += renderedComponent
    content += component.content.slice(element.index, component.content.length)
    // increment nested component offset
    offset += renderedComponent.length

    if (!offsetStartIndex) {
      offsetStartIndex = element.index
    }
  }

  // replace tokens with values
  for (let i = 0; i < component.tokens.length; i++) {
    const token = component.tokens[i]
    const value = values[token.name] || ''
    let endIndex = token.startIndex

    if (endIndex > offsetStartIndex) {
      endIndex -= offset
    }

    result += content.slice(index, endIndex) + value

    index = token.endIndex

    if (index > offsetStartIndex) {
      index += offset
    }

    if (token.endIndex < token.startIndex + value.length) {
      //
      index += value.length
    }
  }

  if (index < content.length) {
    result += content.slice(index, content.length)
  }

  return result
}
