/**
 * @typedef {Object} CoraliteMeta
 * @property {string} name - Meta name
 * @property {number} content - Meta content
 */

/**
 * Extract metadata from document
 * @param {string} string
 * @returns {CoraliteMeta[]}
 */
function getMetadataFromDocument (string) {
  const headMatches = string.matchAll(/<head>\s*([\s\S]*?)<\/head>/g)
  /** @type {CoraliteMeta[]} */
  const result = []

  if (!headMatches) {
    throw new Error('No head tag found in document')
  }

  const head = headMatches.next()
  const metaInput = head.value[1]

  if (!metaInput) {
    throw new Error('No meta tags found in document')
  }

  const metaMatches = metaInput.matchAll(/<meta\s+(.*?)\/?>/g)

  for (const metaMatch of metaMatches) {
    const attributeMatches = metaMatch[1].matchAll(/(?:name\s*=\s*["'](?<name>[^"']*?)["'])\s+(?:[^>]*?\s)?(?:content\s*=\s*["'](?<content>[^"']*?)["'])/g)

    for (const attributeMatch of attributeMatches) {
      result.push(attributeMatch.groups)
    }
  }

  return result
}

export default getMetadataFromDocument
