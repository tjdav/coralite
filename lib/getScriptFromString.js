import evalComputedTokens from './evalComputedTokens.js'


/**
 * Extract script tag from HTML
 * @param {string} string
 * @param {Object.<string, string>} props
 * @returns {Object.<string, string>}
 */
function getScriptFromString (string, props) {
  const matches = string.matchAll(/<script>(.*?)<\/script>/gs)

  for (const match of matches) {
    if (!match[1]) {
      throw new Error('Script cannot be empty')
    }

    const definePropsString = match[1].match(/defineProps\s*\(\s*({(?:[^{}]|{(?:[^{}]|{[^{}]*})*})*})\s*\)/)

    if (!definePropsString) {
      throw new Error('Script tag expects "defineProps" but found none')
    }

    if (definePropsString.length > 3) {
      throw new Error('Duplicate defineProps found')
    }

    return (tokens) => evalComputedTokens(computedTokensString[1], tokens)
  }
}

export default getScriptFromString