
import { parse as parseJS } from 'acorn'
import { CoraliteError } from '../errors.js'

/**
 * @import { CoraliteModule, CoraliteCollectionItem, CoralitePage } from '../../../types/index.js'
 */

const CURRENT_FILE_URL = import.meta.url

/**
 * Helper to create CoraliteError during component execution
 * @param {Error} error - The caught error
 * @param {CoraliteModule} module - The component module
 * @param {CoraliteCollectionItem} moduleComponent - The parent module component
 * @param {CoralitePage} page - The current page
 * @param {string} instanceId - The unique instance id
 * @returns {CoraliteError} The generated error object
 */
export function createExecutionError (error, module, moduleComponent, page, instanceId) {
  let line, column, stackFile
  const isSyntaxError = error instanceof SyntaxError
  const isImportError = error.message.includes('provide an export named')

  if (error.stack) {
    const stackLines = error.stack.split('\n')

    for (let i = 1; i < stackLines.length; i++) {
      const stackLine = stackLines[i]
      if (stackLine.includes(CURRENT_FILE_URL) || stackLine.includes('packages/coralite/lib/errors.js')) {
        continue
      }

      const match = stackLine.match(/\(([^)]*):(\d+):(\d+)\)$/) || stackLine.match(/at\s+(.*?):(\d+):(\d+)$/)

      if (match) {
        stackFile = match[1]
        line = parseInt(match[2], 10)
        column = parseInt(match[3], 10)


        if (stackFile === 'node:internal/vm/module') {
          stackFile = moduleComponent.path.pathname
          line = undefined
          column = undefined
        }
        break
      }
    }
  }

  // Attempt to recover location for SyntaxErrors or Linking errors that lost it
  if (isSyntaxError || isImportError) {
    stackFile = moduleComponent.path.pathname
    try {
      // Re-parse to find syntax error location if missing
      parseJS(module.script, {
        ecmaVersion: 'latest',
        sourceType: 'module',
        locations: true
      })
    } catch (e) {
      const errorToParse = e

      if (errorToParse.loc) {
        line = (module.lineOffset || 0) + errorToParse.loc.line
        column = errorToParse.loc.column + 1
      } else if (errorToParse.pos !== undefined) {
        const prefix = module.script.substring(0, errorToParse.pos)
        const lines = prefix.split('\n')

        line = (module.lineOffset || 0) + lines.length
        column = lines[lines.length - 1].length + 1
      }
    }

    // Some SyntaxErrors from VM have line/column properties (though often 1-based and relative to script)
    // @ts-ignore
    if (!line && error.lineNumber !== undefined) {
      // @ts-ignore
      line = (module.lineOffset || 0) + error.lineNumber
      // @ts-ignore
      column = error.columnNumber || 1
    }

    // For import errors, try to find the problematic import line
    if (isImportError && !line && module.script) {
      const match = error.message.match(/module '([^']*)' does not provide an export named '([^']*)'/)

      if (match) {
        const [, moduleName, exportName] = match
        const lines = module.script.split('\n')

        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes(moduleName) && lines[i].includes(exportName)) {
            line = (module.lineOffset || 0) + i + 1
            column = lines[i].indexOf(exportName) + 1
            break
          }
        }
      }
    }
  }

  return new CoraliteError(error.message, {
    cause: error,
    componentId: module.id,
    filePath: moduleComponent.path.pathname,
    pagePath: page?.file?.pathname,
    instanceId,
    line,
    column,
    stackFile
  })
}
