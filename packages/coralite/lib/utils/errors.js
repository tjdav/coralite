
/**
 * @import { CoraliteErrorData } from '../../types/index.js'
 */

/**
 * Base error class for all Coralite-related errors.
 */
export class CoraliteError extends Error {
  /**
   * @param {string} message - The error message.
   * @param {Object} [options] - Additional options for the error.
   * @param {string} [options.componentId] - The ID of the component where the error occurred.
   * @param {string} [options.filePath] - The path to the file where the error occurred.
   * @param {string} [options.instanceId] - The unique ID of the component instance.
   * @param {string} [options.pagePath] - The path to the page being rendered.
   * @param {string} [options.path] - The path to the data property where the error occurred.
   * @param {number} [options.line] - The line number where the error occurred.
   * @param {number} [options.column] - The column number where the error occurred.
   * @param {string} [options.stackFile] - The file name from the stack trace.
   * @param {Error} [options.cause] - The original error that caused this error.
   */
  constructor (message, options = {}) {
    super(message, options)
    this.name = 'CoraliteError'
    this.isCoraliteError = true
    this.componentId = options.componentId
    this.filePath = options.filePath
    this.instanceId = options.instanceId
    this.pagePath = options.pagePath
    this.path = options.path
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
 * @param {CoraliteErrorData} data - The data object containing error details.
 */
export function defaultOnError ({ level, message, error }) {
  if (level === 'ERR') {
    if (error) {
      throw error
    }
    throw new CoraliteError(message)
  } else if (level === 'WARN') {
    console.warn(message)
  } else {
    console.log(message)
  }
}

/**
 * Handles errors using an optional callback or the default handler.
 * @param {Object} options - The options for handling the error.
 * @param {Function} [options.onErrorCallback] - The optional custom error callback function.
 * @param {CoraliteErrorData} options.data - The error data to be handled.
 */
export function handleError ({ onErrorCallback, data }) {
  const error = data.error
  if (error && 'isCoraliteError' in error && error.isCoraliteError) {
    const coraliteError = error
    // @ts-ignore
    data.componentId = data.componentId || coraliteError.componentId
    // @ts-ignore
    data.filePath = data.filePath || coraliteError.filePath
    // @ts-ignore
    data.instanceId = data.instanceId || coraliteError.instanceId
    // @ts-ignore
    data.pagePath = data.pagePath || coraliteError.pagePath
    // @ts-ignore
    data.path = data.path || coraliteError.path
    // @ts-ignore
    data.line = data.line || coraliteError.line
    // @ts-ignore
    data.column = data.column || coraliteError.column
    // @ts-ignore
    data.stackFile = data.stackFile || coraliteError.stackFile
  }

  if (onErrorCallback) {
    onErrorCallback(data)
  } else {
    defaultOnError(data)
  }
}
