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
 * Helper to create CoraliteError during component execution
 * @param {Error} error - The caught error
 * @param {import('../types/index.js').CoraliteModule} module - The component module
 * @param {import('../types/index.js').CoraliteCollectionItem} moduleComponent - The parent module component
 * @param {import('../types/index.js').CoralitePage} page - The current page
 * @param {string} instanceId - The unique instance id
 * @returns {CoraliteError} The generated error object
 */
export function createExecutionError (error, module, moduleComponent, page, instanceId) {
  return new CoraliteError(error.message, {
    cause: error,
    componentId: module.id,
    filePath: moduleComponent.path.pathname,
    pagePath: page?.file?.pathname,
    instanceId
  })
}
