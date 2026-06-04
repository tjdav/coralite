/**
 *
 */
export class CoraliteError extends Error {
  /**
   *
   */
  constructor (message, options = {}) {
    super(message, options)
    this.name = 'CoraliteError'
    this.isCoraliteError = true
    this.componentId = options.componentId
    this.filePath = options.filePath
    this.instanceId = options.instanceId
    this.pagePath = options.pagePath
    this.line = options.line
    this.column = options.column
    this.stackFile = options.stackFile

    // Polyfill cause if necessary (node version differences)
    if (options.cause && !this.cause) {
      this.cause = options.cause
    }
  }
}

/**
 * Default error handler.
 * @param {Object} data
 * @param {'WARN' | 'ERR' | 'LOG'} data.level
 * @param {string} data.message
 * @param {Error} [data.error]
 */
export function defaultOnError ({ level, message, error }) {
  if (level === 'ERR') {
    if (error) {
      throw error
    }
    throw new Error(message)
  } else if (level === 'WARN') {
    console.warn(message)
  } else {
    console.log(message)
  }
}

/**
 * Handles errors using an optional callback or the default handler.
 * @param {Object} options
 * @param {Function} [options.onErrorCallback]
 * @param {Object} options.data
 */
export function handleError ({ onErrorCallback, data }) {
  if (onErrorCallback) {
    onErrorCallback(data)
  } else {
    defaultOnError(data)
  }
}

import { parse as parseJS } from 'acorn'

/**
 * @import { CoraliteModule, CoraliteCollectionItem, CoralitePage } from '../types/index.js'
 */

/**
 * Helper to create CoraliteError during component execution
 * @param {Error} error - The caught error
 * @param {CoraliteModule} module - The component module
 * @param {CoraliteCollectionItem} moduleComponent - The parent module component
 * @param {CoralitePage} page - The current page
 * @param {string} instanceId - The unique instance id
 * @returns {CoraliteError} The generated error object
 */
const CURRENT_FILE_URL = import.meta.url

/**
 *
 */
export function createExecutionError (error, module, moduleComponent, page, instanceId) {
  let line, column, stackFile
  const isSyntaxError = error instanceof SyntaxError
  const isImportError = error.message.includes('provide an export named')

  if (error.stack) {
    const stackLines = error.stack.split('\n')
    // Find the first line that doesn't belong to the error handling internal logic
    // Usually the first line is the error message, and subsequent lines are stack frames.
    // We look for the first frame that is NOT from errors.js or internal node vm modules if possible,
    // but typically the first frame after the message is the most relevant.
    for (let i = 1; i < stackLines.length; i++) {
      const stackLine = stackLines[i]
      if (stackLine.includes(CURRENT_FILE_URL) || stackLine.includes('packages/coralite/lib/errors.js')) {
        continue
      }
      const match = stackLine.match(/\((.*):(\d+):(\d+)\)$/) || stackLine.match(/at (.*):(\d+):(\d+)$/)
      if (match) {
        stackFile = match[1]
        line = parseInt(match[2], 10)
        column = parseInt(match[3], 10)

        // If the error comes from node internal VM, it's usually a linking/parsing error
        // that happened in the component but is reported from internal VM code.
        // We prefer pointing to the component file in this case.
        if (stackFile === 'node:internal/vm/module') {
          stackFile = moduleComponent.path.pathname
          // Linking errors usually don't have accurate line/column in the stack trace
          // that corresponds to the component source, so we clear them unless we find better info.
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
      // Handle acorn parsing error which might be a SyntaxError with loc/pos
      const errorToParse = e
      if (errorToParse.loc) {
        line = (module.lineOffset || 0) + errorToParse.loc.line
        column = errorToParse.loc.column + 1
      } else if (errorToParse.pos !== undefined) {
        // Fallback to pos if loc is not available
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
      const match = error.message.match(/module '(.*)' does not provide an export named '(.*)'/)
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
