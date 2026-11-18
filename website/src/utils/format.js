/**
 *
 */
export function dedent (str) {
  const lines = str.split('\n')
  const minIndent = Math.min(...lines.filter(l => l.trim().length > 0).map(l => l.match(/^(\s*)/)[0].length))
  return lines.map(l => l.slice(minIndent)).join('\n')
}

/**
 *
 */
export function indent (str, prefix) {
  return str.split('\n').map(l => prefix + l).join('\n')
}
