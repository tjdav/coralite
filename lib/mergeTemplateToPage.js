/**
 * Extract template HTML from string
 * @param {string} page
 * @param {Object.<string, string>} templates
 * @returns {string}
 */
function mergeTemplateToPage (page, templates) {
  const matches = page.matchAll(/<slot\s+[^>]*>|<\/slot>/g)
  let result = ''
  let currentId = null
  let lastIndex = 0
  let startIndex = 0

  for (const match of matches) {
    const tag = match[0]

    if (currentId === null) {
      const findIdAttribute = tag.match(/name=["'][^"']*["']/)
      
      if (!findIdAttribute) {
        throw new Error('Slot requires an id attribute but found none at index: ' + match.index)
      }

      const idAttribute = findIdAttribute[0]

      currentId = idAttribute.slice(4, idAttribute.length - 1)
      lastIndex = match.index
    } else {
      const template = templates[currentId]

      if (!template) {
        throw new Error('Could not find template with the id: "' + currentId + '"')
      }

      result += page.slice(startIndex, lastIndex) + template
      lastIndex =  match.index + tag.length
      startIndex = lastIndex
      // clear current id
      currentId = null
    }
  }

  // add end of page
  result += page.substring(lastIndex)

  return result
}

export default mergeTemplateToPage