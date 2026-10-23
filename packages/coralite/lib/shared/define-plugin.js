/**
 * @import { CoralitePlugin, HTMLData } from '../../types/index.js'
 */

import { CoraliteError } from './errors.js'
import { validatePluginConfigBlocks, validateValues } from '../utils/plugin-config-schema.js'

const VALID_MODES = /* @__PURE__ */ new Set(['development', 'testing', 'production'])
const ALLOWED_PLUGIN_KEYS = /* @__PURE__ */ new Set([
  'name',
  'config',
  'server',
  'client',
  'dependencies',
  'modes',
  'rootDir',
  'filePath'
])

/**
 * Converts a file:// URL string into a platform path string without Node built-ins.
 * @param {string} urlStr - The file URL string to convert
 * @returns {string} Resolved file path
 */
function urlToFilePath (urlStr) {
  if (!urlStr || !urlStr.startsWith('file://')) {
    return urlStr
  }
  try {
    const parsed = new URL(urlStr)
    let pathname = decodeURIComponent(parsed.pathname)
    if (/^\/[a-zA-Z]:/.test(pathname)) {
      pathname = pathname.slice(1)
      if (typeof process !== 'undefined' && process.platform === 'win32') {
        pathname = pathname.replace(/\//g, '\\')
      }
    }
    return pathname
  } catch {
    return urlStr.slice(7)
  }
}

/**
 * Extracts directory name from a file path without Node path built-in.
 * @param {string} targetPath - Input file path
 * @returns {string} Directory path
 */
function getDirname (targetPath) {
  if (!targetPath) {
    return '.'
  }
  const normalized = targetPath.length > 1 ? targetPath.replace(/[\\/]+$/, '') : targetPath
  const lastSep = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'))
  if (lastSep === -1) {
    return '.'
  }
  if (lastSep === 0) {
    return normalized[0]
  }
  if (lastSep === 2 && /^[a-zA-Z]:/.test(normalized)) {
    return normalized.slice(0, 3)
  }
  return normalized.slice(0, lastSep)
}

/**
 * Extracts base filename from a file path without Node path built-in.
 * @param {string} targetPath - Input file path
 * @returns {string} Base filename
 */
function getBasename (targetPath) {
  if (!targetPath) {
    return ''
  }
  const normalized = targetPath.length > 1 ? targetPath.replace(/[\\/]+$/, '') : targetPath
  const lastSep = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'))
  return lastSep === -1 ? normalized : normalized.slice(lastSep + 1)
}

/**
 * Validates plugin modes declaration
 * @param {*} modes - Modes value to validate
 * @throws {CoraliteError} If modes is invalid
 */
function validateModes (modes) {
  if (modes === undefined) {
    return
  }
  if (!Array.isArray(modes) || modes.length === 0) {
    throw new CoraliteError(
      '[CORALITE-P204] Plugin "modes" must be a non-empty array of valid mode names (\'development\', \'testing\', \'production\').',
      { code: 'CORALITE-P204' }
    )
  }
  for (const mode of modes) {
    if (typeof mode !== 'string' || !VALID_MODES.has(mode)) {
      throw new CoraliteError(
        `[CORALITE-P204] Invalid mode name "${mode}" in plugin "modes" declaration. Valid modes are: 'development', 'testing', 'production'.`,
        { code: 'CORALITE-P204' }
      )
    }
  }
}

/**
 * Validates plugin dependencies declaration
 * @param {*} dependencies - Dependencies value to validate
 * @throws {CoraliteError} If dependencies is invalid
 */
function validateDependencies (dependencies) {
  if (dependencies === undefined) {
    return
  }
  if (!Array.isArray(dependencies)) {
    throw new CoraliteError(
      '[CORALITE-P205] Plugin "dependencies" property must be an array of plugin names.',
      { code: 'CORALITE-P205' }
    )
  }
  for (const dep of dependencies) {
    if (typeof dep !== 'string' || dep.trim().length === 0) {
      throw new CoraliteError(
        '[CORALITE-P205] Plugin "dependencies" entries must be non-empty strings.',
        { code: 'CORALITE-P205' }
      )
    }
  }
}

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
        dirname: getDirname(path),
        filename: getBasename(path)
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
 * @param {Partial<CoralitePlugin & { config?: Record<string, any>, server?: { config?: Record<string, any>, components?: string[] }, client?: { config?: Record<string, any> } }>} [options={}] - Plugin configuration object
 * @returns {CoralitePlugin} A configured plugin instance ready to be registered with Coralite
 */
export function definePlugin (options = {}) {
  if (options && typeof options === 'object') {
    for (const key of Object.keys(options)) {
      if (key !== 'depends' && !ALLOWED_PLUGIN_KEYS.has(key)) {
        throw new CoraliteError(
          `Unknown block "${key}" in definePlugin. Valid blocks are: ${Array.from(ALLOWED_PLUGIN_KEYS).join(', ')}.`,
          { code: 'CORALITE-E107' }
        )
      }
    }
  }

  const {
    name,
    dependencies,
    depends,
    modes,
    rootDir,
    filePath,
    config,
    server,
    client
  } = options

  validateNonEmptyString(name, 'name')
  if (depends !== undefined) {
    throw new CoraliteError(
      '[CORALITE-P206] The "depends" property is unsupported. Use "dependencies" instead.',
      { code: 'CORALITE-P206' }
    )
  }
  validateDependencies(dependencies)
  validateModes(modes)

  if (config !== undefined && (typeof config !== 'object' || config === null)) {
    throw new CoraliteError(
      `Coralite plugin validation failed: "config" must be an object, received ${typeof config}`
    )
  }

  const selfFile = import.meta?.url ? urlToFilePath(import.meta.url) : ''
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
        const match = line.match(/(file:\/\/[^\s:)]+|(?:[a-zA-Z]:[\\/]|\/)[^\s:)]+):(?:\d+)(?::\d+)?/)
        if (match) {
          let candidate = match[1]
          if (candidate.startsWith('file://')) {
            candidate = urlToFilePath(candidate)
          }
          if (
            candidate !== selfFile &&
            !candidate.endsWith('/lib/server/plugin/define.js') &&
            !candidate.endsWith('\\lib\\server\\plugin\\define.js') &&
            !candidate.startsWith('node:') &&
            !candidate.includes('/node_modules/') &&
            !candidate.includes('\\node_modules\\')
          ) {
            callerFile = candidate
            callerDir = getDirname(candidate)
            break
          }
        }
      }
    }
  }

  const resolvedRootDir = rootDir || client?.rootDir || callerDir
  const resolvedFilePath = filePath || client?.filePath || callerFile

  let resolvedServer = server
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

    if (resolvedServer.components) {
      validateStringArray(resolvedServer.components, 'server.components')

      const componentHTMLData = []
      try {
        for (const path of resolvedServer.components) {
          componentHTMLData.push(processComponents(path))
        }
        // @ts-ignore
        resolvedServer.components = componentHTMLData
      } catch (error) {
        throw new CoraliteError(
          `Coralite plugin "${name}" failed to load components: ${error.message}`,
          { cause: error }
        )
      }
    }
  }

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

    if (client.init !== undefined && typeof client.init !== 'function') {
      throw new CoraliteError(
        `Coralite plugin validation failed: "client.init" must be a function, received ${typeof client.init}`
      )
    }

    if (client.config !== undefined && (typeof client.config !== 'object' || client.config === null)) {
      throw new CoraliteError(
        `Coralite plugin validation failed: "client.config" must be an object, received ${typeof client.config}`
      )
    }

    client.rootDir = client.rootDir || resolvedRootDir
    client.filePath = client.filePath || resolvedFilePath
    client.name = client.name || name
  }

  const normalizedSchemas = validatePluginConfigBlocks({
    pluginName: name,
    config,
    serverConfig: resolvedServer?.config,
    clientConfig: client?.config
  })

  /**
   * Plugin callable form: when invoked with values, returns a configured plugin instance.
   *
   * @param {Record<string, any>} [userValues={}] - Config values to pass to plugin instance
   * @returns {CoralitePlugin & { _isConfiguredInstance: boolean, _valuesByBlock: any, _normalizedSchemas: any }}
   */
  const pluginCallable = function (userValues = {}) {
    if (userValues === null || typeof userValues !== 'object' || Array.isArray(userValues)) {
      throw new CoraliteError(
        '[CORALITE-P207] Plugin config values must be a plain object.',
        { code: 'CORALITE-P207' }
      )
    }

    const { name: nameOverride, valuesByBlock } = validateValues(normalizedSchemas, userValues)
    const instanceName = nameOverride || name

    const instanceServer = resolvedServer
      ? {
        ...resolvedServer,
        name: instanceName,
        config: { ...valuesByBlock.serverConfig }
      }
      : undefined

    const instanceClient = client
      ? {
        ...client,
        name: instanceName,
        config: { ...valuesByBlock.clientConfig }
      }
      : undefined

    return {
      name: instanceName,
      ...(dependencies !== undefined ? { dependencies } : {}),
      ...(modes !== undefined ? { modes } : {}),
      rootDir: resolvedRootDir,
      filePath: resolvedFilePath,
      config: valuesByBlock.config,
      server: instanceServer,
      client: instanceClient,
      _normalizedSchemas: normalizedSchemas,
      _valuesByBlock: valuesByBlock,
      _isConfiguredInstance: true
    }
  }

  Object.defineProperty(pluginCallable, 'name', {
    value: name,
    writable: true,
    configurable: true
  })

  pluginCallable.rootDir = resolvedRootDir
  pluginCallable.filePath = resolvedFilePath
  if (dependencies !== undefined) {
    pluginCallable.dependencies = dependencies
  }
  if (modes !== undefined) {
    pluginCallable.modes = modes
  }
  if (config !== undefined) {
    pluginCallable.config = config
  }
  if (resolvedServer !== undefined) {
    pluginCallable.server = resolvedServer
  }
  if (client !== undefined) {
    pluginCallable.client = client
  }
  pluginCallable._normalizedSchemas = normalizedSchemas
  pluginCallable._isPluginCallable = true

  return pluginCallable
}
