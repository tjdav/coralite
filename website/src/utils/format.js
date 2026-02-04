
/**
 * Remove common leading whitespace from a string.
 * @param {string} text
 * @returns {string}
 */
export function dedent (text) {
  const lines = text.split('\n')
  let minIndent = Infinity

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.trim()) {
      const match = line.match(/^ */)
      const indent = match ? match[0].length : 0
      if (indent < minIndent) {
        minIndent = indent
      }
    }
  }

  if (minIndent === Infinity) {
    return text
  }

  return lines.reduce((previousValue, currentValue) => {
    let newValue = currentValue

    if (currentValue.length >= minIndent) {
      newValue = currentValue.substring(minIndent)
    }

    return previousValue = previousValue + newValue + '\n'
  }, '')
}

/**
 * Add indentation to a string.
 * @param {string} text
 * @returns {string}
 */
export function indent (text) {
  return text.split('\n').reduce((previousValue, currentValue) => previousValue + '  ' + currentValue + '\n', '').trimRight() + '\n'
}
