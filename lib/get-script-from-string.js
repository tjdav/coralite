import evalComputedTokens from './eval-computed-tokens.js'

/**
 * @import { coraliteComputedTokens } from './component.js'
 */

/**
 * Extract script tag from HTML
 * @param {string} string
 * @returns {coraliteComputedTokens|undefined}
 */
function getScriptFromString (string) {
  const matches = string.matchAll(/<script\s*(?<attribute>[\s\S]*?)>(?<content>[\s\S]*?)<\/script>/g)
  const match = matches.next()
  const script = match.value

  if (!script) {
    return
  }

  const attributeRegex = /type\s*=\s*["']module["']/

  if (!attributeRegex.test(script.groups.attribute)) {
    throw new Error('Script tag must contain `type="module"`')
  }

  const content = script.groups.content

  if (!content) {
    throw new Error('Script cannot be empty')
  }

  /**
   * @TODO [HTML modules]{@link https://github.com/WICG/webcomponents/blob/gh-pages/proposals/html-modules-explainer.md}
   * this regex is extremely limited and will be replaced by vm.Script
   */
  const computedTokensString = content.match(/computedTokens\s*\(\s*({(?:[^{}]|{(?:[^{}]|{[^{}]*})*})*})\s*\)/)

  if (!computedTokensString) {
    throw new Error('Script tag expects "computedAttributes" but found none')
  }

  if (computedTokensString.length > 3) {
    throw new Error('Duplicate "computedAttributes" found')
  }

  return (tokens) => evalComputedTokens(computedTokensString[1], tokens)
}

export default getScriptFromString
