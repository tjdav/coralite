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
