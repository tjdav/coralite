/**
 * @import { CoralitePlugin, HTMLData } from '../types/index.js'
 */

import { basename, dirname } from 'path'
import { fileURLToPath } from 'node:url'
import { CoraliteError } from './utils/errors.js'

/**
 * Validates that a value is a non-empty string
 * @param {*} value - Value to validate
 * @param {string} paramName - Parameter name for error messages
 * @throws {Error} If value is not a valid non-empty string
 */
function validateNonEmptyString (value, paramName) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new CoraliteError(
      `Coralite plugin validation failed: "${paramName}" must be a non-empty string, received ${typeof value}`
    )
  }
}

/**
 * Validates that a value is an array of strings (or empty array)
 * @param {*} value - Value to validate
 * @param {string} paramName - Parameter name for error messages
 * @throws {Error} If value is defined but not an array of strings
 */
function validateStringArray (value, paramName) {
  if (!Array.isArray(value)) {
    throw new CoraliteError(
      `Coralite plugin validation failed: "${paramName}" must be an array, received ${typeof value}`
    )
  }

  for (let i = 0; i < value.length; i++) {
    if (typeof value[i] !== 'string') {
      throw new CoraliteError(
        `Coralite plugin validation failed: "${paramName}[${i}]" must be a string, received ${typeof value[i]}`
      )
    }
  }
}

/**
 * Processes a single components file with optional caching
 * @param {string} path - Template file path
 * @returns {HTMLData} Template data
 * @throws {Error} If components file cannot be read or is invalid
 */
function processComponents (path) {
  try {
    const componentData = {
      path: {
        pathname: path,
        dirname: dirname(path),
        filename: basename(path)
      }
    }

    return componentData
  } catch (error) {
    throw new CoraliteError(
      `Coralite plugin component processing failed for "${path}": ${error.message}`,
      {
        cause: error,
        filePath: path
      }
    )
  }
}

/**
 * Creates a new Coralite plugin instance based on provided configuration options.
 * @param {CoralitePlugin & { server?: { components?: string[] } }} options - Plugin configuration object
 * @returns {CoralitePlugin} A configured plugin instance ready to be registered with Coralite
 * @example
 * // Basic plugin
 * const myPlugin = definePlugin({
 *   name: 'my-plugin',
 *   server: {
 *     context: ({ app }) => {
 *       // Phase 1: Singleton/Global Context
 *       return () => ({
 *         // Phase 2: Instance Context
 *         getData: (options) => {
 *            return { custom: 'data', ...options }
 *         }
 *       })
 *     }
 *   }
 * })
 *
 * @example
 * // Plugin with components and metadata
 * const advancedPlugin = definePlugin({
 *   name: 'advanced-plugin',
 *   server: {
 *     context: () => {
 *       // Phase 1: Singleton/Global Context
 *       return () => ({
 *         // Phase 2: Instance Context
 *         process: async (options) => {
 *           return { processed: true, ...options }
 *         }
 *       })
 *     },
 *     components: ['src/components/header.html', 'src/components/footer.html'],
 *     onPageSet: async (data) => {
 *       console.log('Page created:', data.path.pathname)
 *     }
 *   }
 * })
 */
export function definePlugin ({
  name,
  rootDir,
  filePath,
  server,
  client
}) {
  validateNonEmptyString(name, 'name')

  const selfFile = fileURLToPath(import.meta.url)
  let callerDir
  let callerFile
  if ((client != null || server != null) && (!rootDir || !filePath || !client?.rootDir || !client?.filePath)) {
    const stack = new Error().stack
    if (stack) {
      const lines = stack.split('\n')
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i]
        if (!line) {
          continue
        }
        const match = line.match(/(file:\/\/[^\s:)]+|(?:[a-zA-Z]:[\\\/]|\/)[^\s:)]+):(?:\d+)(?::\d+)?/)
        if (match) {
          let candidate = match[1]
          if (candidate.startsWith('file://')) {
            candidate = fileURLToPath(candidate)
          }
          if (
            candidate !== selfFile &&
            !candidate.startsWith('node:') &&
            !candidate.includes('/node_modules/') &&
            !candidate.includes('\\node_modules\\')
          ) {
            callerFile = candidate
            callerDir = dirname(candidate)
            break
          }
        }
      }
    }
  }

  const resolvedRootDir = rootDir || client?.rootDir || callerDir
  const resolvedFilePath = filePath || client?.filePath || callerFile

  // Validate server plugin if provided
  if (server != null) {
    if (typeof server !== 'object') {
      throw new CoraliteError(
        `Coralite plugin validation failed: "server" must be an object, received ${typeof server}`
      )
    }

    server = { ...server }
    server.name = server.name || name

    if (server.context != null && typeof server.context !== 'function') {
      throw new CoraliteError(
        `Coralite plugin validation failed: "server.context" must be a function, received ${typeof server.context}`
      )
    }

    // Process component files with error handling
    if (server.components) {
      validateStringArray(server.components, 'server.components')

      const componentHTMLData = []
      try {
        // Process all components
        for (const path of server.components) {
          componentHTMLData.push(processComponents(path))
        }
        // @ts-ignore
        server.components = componentHTMLData
      } catch (error) {
        // Enhance error message with plugin context
        throw new CoraliteError(
          `Coralite plugin "${name}" failed to load components: ${error.message}`,
          { cause: error }
        )
      }
    }
  }

  // Validate client plugin if provided
  if (client != null) {
    if (typeof client !== 'object') {
      throw new CoraliteError(
        `Coralite plugin validation failed: "client" must be an object, received ${typeof client}`
      )
    }

    if (client.context != null && typeof client.context !== 'function') {
      throw new CoraliteError(
        `Coralite plugin validation failed: "client.context" must be a function, received ${typeof client.context}`
      )
    }

    if (client.config != null && typeof client.config !== 'object') {
      throw new CoraliteError(
        `Coralite plugin validation failed: "client.config" must be an object, received ${typeof client.config}`
      )
    }

    // append rootDir & filePath
    client.rootDir = client.rootDir || resolvedRootDir
    client.filePath = client.filePath || resolvedFilePath
    client.name = client.name || name
  }

  // Create the plugin object with all configured state
  return {
    name,
    rootDir: resolvedRootDir,
    filePath: resolvedFilePath,
    server,
    client
  }
}
