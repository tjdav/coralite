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
        break
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
