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
      }
    }
  }
}
