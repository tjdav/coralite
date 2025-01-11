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

  const component = getCustomElementsFromString(template.groups.content)
  const tokens = getTokensFromString(template.groups.content)
  const computedTokens = getScriptFromString(string)

  component.id = template.groups.id
  component.tokens = tokens

  if (computedTokens) {
    component.computedTokens = computedTokens
  } else {
    component.computedTokens = () => {
    }
  }

  // @ts-ignore
  return component
}

export default getComponentFromString
