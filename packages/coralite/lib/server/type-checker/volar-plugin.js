/**
 * @typedef {import('@volar/language-core').LanguagePlugin} LanguagePlugin
 * @typedef {import('@volar/language-core').VirtualCode} VirtualCode
 */

/**
 * Extracts the first <script type="module"> (or any <script>) block from .html source code.
 *
 * @param {string} source - HTML file content
 * @returns {{ content: string, offset: number } | null} Script content and 0-based offset in HTML source
 */
export function extractScriptBlock (source) {
  const match = /<script\b[^>]*>([\s\S]*?)<\/script>/i.exec(source)
  if (!match) {
    return null
  }

  const scriptContent = match[1]
  const scriptOffset = match.index + match[0].indexOf(match[1])

  return {
    content: scriptContent,
    offset: scriptOffset
  }
}

const TS_SCRIPT_KIND = 3

/**
 * Volar LanguagePlugin for Coralite .html component and page files.
 * Extracts embedded <script> blocks into virtual TypeScript code.
 *
 * @type {LanguagePlugin<string>}
 */
export const coraliteLanguagePlugin = {
  getLanguageId (fileName) {
    if (fileName.endsWith('.html')) {
      return 'html'
    }
    return undefined
  },

  createVirtualCode (scriptId, languageId, snapshot) {
    if (languageId !== 'html') {
      return undefined
    }

    const source = snapshot.getText(0, snapshot.getLength())
    const scriptBlock = extractScriptBlock(source)
    if (!scriptBlock) {
      return undefined
    }

    const scriptContent = scriptBlock.content
    const scriptOffset = scriptBlock.offset

    const tsSnapshot = {
      getText: (start, end) => scriptContent.slice(start, end),
      getLength: () => scriptContent.length,
      getChangeRange: () => undefined
    }

    return {
      id: 'main',
      languageId: 'typescript',
      snapshot: tsSnapshot,
      mappings: [
        {
          sourceOffsets: [scriptOffset],
          generatedOffsets: [0],
          lengths: [scriptContent.length],
          data: {
            verification: true,
            completion: true,
            semantic: true,
            navigation: true,
            structure: true,
            format: true
          }
        }
      ]
    }
  },

  typescript: {
    extraFileExtensions: [
      {
        extension: 'html',
        isKind: true,
        scriptKind: TS_SCRIPT_KIND
      }
    ],
    getServiceScript (root) {
      return {
        code: root,
        scriptKind: TS_SCRIPT_KIND,
        preventLeadingOffset: true
      }
    }
  }
}

export default coraliteLanguagePlugin
