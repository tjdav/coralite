import getCustomElementsFromString from './get-custom-elements-from-string.js'
import getScriptFromString from './get-script-from-string.js'
import getTokensFromString from './get-tokens-from-string.js'

/**
 * @import { CoraliteComponent } from './component.js'
 */

/**
 * Extract component from string
 * @param {string} string
 * @returns {CoraliteComponent}
 */
function getComponentFromString (string) {
  const matches = string.matchAll(/<template\s*id\s*=\s*["']\s*(?<id>[\w+\-]*)\s*['"]>(?<content>[\s*\S*]*?)<\/template>/g)
  const match = matches.next()
  const template = match.value

  if (!template) {
    throw new Error('No template found')
  }

  const content = template.groups.content
  const customElements = getCustomElementsFromString(content)
  const tokens = getTokensFromString(content)
  const computedTokens = getScriptFromString(string)
  const component = {
    id: template.groups.id,
    content: content,
    tokens,
    customElements,
    computedTokens
  }

  // @ts-ignore
  return component
}

export default getComponentFromString
