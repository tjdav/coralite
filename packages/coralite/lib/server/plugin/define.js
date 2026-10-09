/**
 * @import { CoralitePlugin, HTMLData } from '../../../types/index.js'
 */

import { basename, dirname } from 'path'
import { fileURLToPath } from 'node:url'
import { CoraliteError } from '../../shared/errors.js'
import { validatePluginConfigBlocks } from '../../shared/plugin-config-schema.js'

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
 * @param {CoralitePlugin & { config?: Record<string, any>, server?: { config?: Record<string, any>, components?: string[] }, client?: { config?: Record<string, any> } }} options - Plugin configuration object
 * @returns {CoralitePlugin} A configured plugin instance ready to be registered with Coralite
 */
export function definePlugin ({
  name,
  rootDir,
  filePath,
  config,
  server,
  client
}) {
  validateNonEmptyString(name, 'name')

  if (config !== undefined && (typeof config !== 'object' || config === null)) {
    throw new CoraliteError(
      `Coralite plugin validation failed: "config" must be an object, received ${typeof config}`
    )
  }

  const selfFile = fileURLToPath(import.meta.url)
  let callerDir
  let callerFile
  if ((client !== undefined || server !== undefined) && (!rootDir || !filePath || !client?.rootDir || !client?.filePath)) {
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

  let resolvedServer = server
  // Validate server plugin if provided
  if (resolvedServer !== undefined && resolvedServer !== null) {
    if (typeof resolvedServer !== 'object') {
      throw new CoraliteError(
        `Coralite plugin validation failed: "server" must be an object, received ${typeof resolvedServer}`
      )
    }

    resolvedServer = { ...resolvedServer }
    resolvedServer.name = resolvedServer.name || name

    if (resolvedServer.config !== undefined && (typeof resolvedServer.config !== 'object' || resolvedServer.config === null)) {
      throw new CoraliteError(
        `Coralite plugin validation failed: "server.config" must be an object, received ${typeof resolvedServer.config}`
      )
    }

    if (resolvedServer.context !== undefined && typeof resolvedServer.context !== 'function') {
      throw new CoraliteError(
        `Coralite plugin validation failed: "server.context" must be a function, received ${typeof resolvedServer.context}`
      )
    }

    // Process component files with error handling
    if (resolvedServer.components) {
      validateStringArray(resolvedServer.components, 'server.components')

      const componentHTMLData = []
      try {
        // Process all components
        for (const path of resolvedServer.components) {
          componentHTMLData.push(processComponents(path))
        }
        // @ts-ignore
        resolvedServer.components = componentHTMLData
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
  if (client !== undefined && client !== null) {
    if (typeof client !== 'object') {
      throw new CoraliteError(
        `Coralite plugin validation failed: "client" must be an object, received ${typeof client}`
      )
    }

    if (client.context !== undefined && typeof client.context !== 'function') {
      throw new CoraliteError(
        `Coralite plugin validation failed: "client.context" must be a function, received ${typeof client.context}`
      )
    }

    if (client.config !== undefined && (typeof client.config !== 'object' || client.config === null)) {
      throw new CoraliteError(
        `Coralite plugin validation failed: "client.config" must be an object, received ${typeof client.config}`
      )
    }

    // append rootDir & filePath
    client.rootDir = client.rootDir || resolvedRootDir
    client.filePath = client.filePath || resolvedFilePath
    client.name = client.name || name
  }

  // Perform schema shape and key uniqueness validation
  validatePluginConfigBlocks({
    pluginName: name,
    config,
    serverConfig: resolvedServer?.config,
    clientConfig: client?.config
  })

  // Create the plugin object with all configured state
  return {
    name,
    rootDir: resolvedRootDir,
    filePath: resolvedFilePath,
    ...(config !== undefined ? { config } : {}),
    server: resolvedServer,
    client
  }
}
