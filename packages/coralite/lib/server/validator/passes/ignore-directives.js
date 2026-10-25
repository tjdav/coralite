/**
 * Pass 0: Parses component-wide and symbol-specific ignore directives.
 * e.g., coralite-ignore symbol1 symbol2, or @coralite-ignore-unused.
 *
 * @param {object} context - ValidationContext instance
 */
export function parseIgnoreDirectives (context) {
  const { sourceCode, ignoredSymbols } = context

  if (sourceCode.includes('coralite-ignore') || sourceCode.includes('@coralite-ignore-unused')) {
    if (sourceCode.includes('coralite-ignore-unused') || sourceCode.includes('@coralite-ignore-unused')) {
      context.isEntireComponentIgnored = true
    }

    const ignoreCommentRegex = /(?:<!--|\/\*|\/\/)\s*coralite-ignore\s+([^\n]*?)(?:-->|\*\/|\n|$)/gi
    let iMatch
    while ((iMatch = ignoreCommentRegex.exec(sourceCode)) !== null) {
      const symbols = iMatch[1].split(/[\s,]+/).filter(Boolean)
      for (const sym of symbols) {
        ignoredSymbols.add(sym)
        ignoredSymbols.add(sym.toLowerCase())
        ignoredSymbols.add(sym.toUpperCase())
        if (sym.toUpperCase().startsWith('A10') || sym.toUpperCase().startsWith('CORALITE-A10') ||
            sym.toUpperCase().startsWith('W5') || sym.toUpperCase().startsWith('CORALITE-W5')) {
          const short = sym.toUpperCase().replace(/^CORALITE-/, '')
          ignoredSymbols.add(short)
          ignoredSymbols.add(`CORALITE-${short}`)
        }
      }
    }
  }
}

/**
 * Checks if a specific diagnostic code (e.g., 'CORALITE-A101') is ignored for the given context.
 *
 * @param {string} code - Diagnostic code, e.g. 'CORALITE-A101' or 'A101'
 * @param {object} context - ValidationContext instance
 * @returns {boolean} True if diagnostic is ignored
 */
export function isDiagnosticIgnored (code, context) {
  if (!context) {
    return false
  }
  if (context.isEntireComponentIgnored) {
    return true
  }
  const ignored = context.ignoredSymbols
  if (!ignored || ignored.size === 0) {
    return false
  }

  const normalizedCode = code.toUpperCase()
  const shortCode = normalizedCode.replace(/^CORALITE-/, '')

  if (
    ignored.has(code) ||
    ignored.has(code.toLowerCase()) ||
    ignored.has(normalizedCode) ||
    ignored.has(shortCode) ||
    ignored.has(shortCode.toLowerCase()) ||
    ignored.has(`CORALITE-${shortCode}`)
  ) {
    return true
  }

  // Check wildcard / category pragmas for accessibility
  if (normalizedCode.startsWith('CORALITE-A') || shortCode.startsWith('A')) {
    if (
      ignored.has('a11y') ||
      ignored.has('A11Y') ||
      ignored.has('coralite-a11y') ||
      ignored.has('CORALITE-A11Y')
    ) {
      return true
    }
  }

  return false
}
