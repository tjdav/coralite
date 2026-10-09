import { CoraliteError } from './errors.js'
import { inferTypeFromValues } from './attributes.js'

export const SUPPORTED_CONFIG_TYPES = new Set(['String', 'Number', 'Boolean', 'Object', 'Array'])

/**
 * Returns normalized type string for standard constructor or constructor string name.
 * @param {any} decl - Declaration or constructor function
 * @returns {string|null}
 */
function getTypeName (decl) {
  if (decl === String || decl === 'String') {
    return 'String'
  }
  if (decl === Number || decl === 'Number') {
    return 'Number'
  }
  if (decl === Boolean || decl === 'Boolean') {
    return 'Boolean'
  }
  if (decl === Object || decl === 'Object') {
    return 'Object'
  }
  if (decl === Array || decl === 'Array') {
    return 'Array'
  }
  return null
}

/**
 * Validates a single schema declaration or plain value for a config key.
 *
 * @param {string} key - Config key name
 * @param {any} decl - Schema declaration or value
 * @param {string} [blockName='config'] - Name of the block ('config', 'server.config', 'client.config')
 * @returns {Object} Normalized schema object { type, default, required, values, transform, validate }
 * @throws {CoraliteError} CORALITE-P206 if schema shape is invalid
 */
export function normalizeAndValidateConfigSchemaKey (key, decl, blockName = 'config') {
  if (decl === undefined) {
    return { type: 'String' }
  }

  // 1. Shorthand constructor form: e.g. base: String
  const shorthandType = getTypeName(decl)
  if (shorthandType !== null) {
    return {
      type: shorthandType
    }
  }

  // 2. Shorthand enum array form: e.g. mode: ['history', 'hash']
  if (Array.isArray(decl)) {
    const inferred = inferTypeFromValues(decl)
    const typeName = getTypeName(inferred) || 'String'
    return {
      type: typeName,
      values: decl
    }
  }

  // 3. Full object form or plain object default value
  if (typeof decl === 'object' && decl !== null) {
    const hasSchemaKeys = Object.hasOwn(decl, 'type') ||
      Object.hasOwn(decl, 'values') ||
      Object.hasOwn(decl, 'default') ||
      Object.hasOwn(decl, 'required') ||
      Object.hasOwn(decl, 'transform') ||
      Object.hasOwn(decl, 'validate')

    if (!hasSchemaKeys) {
      // Plain object value without schema keys -> treat as { type: 'Object', default: decl }
      return {
        type: 'Object',
        default: decl
      }
    }

    // Full object form
    let typeName = null
    if ('type' in decl && decl.type !== undefined && decl.type !== null) {
      const resolved = getTypeName(decl.type)
      if (resolved !== null) {
        typeName = resolved
      } else {
        throw new CoraliteError(
          `[CORALITE-P206] Plugin config schema error in "${blockName}.${key}": Unknown or unsupported type "${decl.type}". Supported types are String, Number, Boolean, Object, Array.`,
          { code: 'CORALITE-P206' }
        )
      }
    } else if (Array.isArray(decl.values)) {
      const inferred = inferTypeFromValues(decl.values)
      typeName = getTypeName(inferred) || 'String'
    } else {
      throw new CoraliteError(
        `[CORALITE-P206] Plugin config schema error in "${blockName}.${key}": Missing required "type" property in schema declaration.`,
        { code: 'CORALITE-P206' }
      )
    }

    // Validate default value if present
    if ('default' in decl && decl.default !== undefined && decl.default !== null) {
      if (typeName === 'String' || typeName === 'Number' || typeName === 'Boolean') {
        const defaultType = typeof decl.default
        if (defaultType === 'object' || defaultType === 'function') {
          throw new CoraliteError(
            `[CORALITE-P206] Plugin config schema error in "${blockName}.${key}": Primitive type "${typeName}" cannot have a non-primitive default value of type "${defaultType}".`,
            { code: 'CORALITE-P206' }
          )
        }
      }
    }

    // Validate values array if present
    if ('values' in decl && decl.values !== undefined && decl.values !== null) {
      if (!Array.isArray(decl.values)) {
        throw new CoraliteError(
          `[CORALITE-P206] Plugin config schema error in "${blockName}.${key}": Property "values" must be an array.`,
          { code: 'CORALITE-P206' }
        )
      }
    }

    // Validate transform function if present
    if ('transform' in decl && decl.transform !== undefined && decl.transform !== null) {
      if (typeof decl.transform !== 'function') {
        throw new CoraliteError(
          `[CORALITE-P206] Plugin config schema error in "${blockName}.${key}": Property "transform" must be a function.`,
          { code: 'CORALITE-P206' }
        )
      }
    }

    // Validate validate function if present
    if ('validate' in decl && decl.validate !== undefined && decl.validate !== null) {
      if (typeof decl.validate !== 'function') {
        throw new CoraliteError(
          `[CORALITE-P206] Plugin config schema error in "${blockName}.${key}": Property "validate" must be a function.`,
          { code: 'CORALITE-P206' }
        )
      }
    }

    return {
      type: typeName,
      ...(decl.default !== undefined ? { default: decl.default } : {}),
      ...(decl.required !== undefined ? { required: Boolean(decl.required) } : {}),
      ...(decl.lateBound !== undefined ? { lateBound: Boolean(decl.lateBound) } : {}),
      ...(decl.values !== undefined ? { values: decl.values } : {}),
      ...(decl.transform !== undefined ? { transform: decl.transform } : {}),
      ...(decl.validate !== undefined ? { validate: decl.validate } : {})
    }
  }

  // 4. Primitive or plain default values (string, number, boolean, function)
  if (typeof decl === 'string') {
    return {
      type: 'String',
      default: decl
    }
  }
  if (typeof decl === 'number') {
    return {
      type: 'Number',
      default: decl
    }
  }
  if (typeof decl === 'boolean') {
    return {
      type: 'Boolean',
      default: decl
    }
  }
  if (typeof decl === 'function') {
    return {
      type: 'Object',
      default: decl
    }
  }

  throw new CoraliteError(
    `[CORALITE-P206] Plugin config schema error in "${blockName}.${key}": Malformed schema declaration of type "${typeof decl}".`,
    { code: 'CORALITE-P206' }
  )
}

/**
 * Validates uniqueness and schema shape across config, server.config, and client.config blocks.
 *
 * @param {Object} options
 * @param {string} [options.pluginName='plugin'] - Plugin name for error messages
 * @param {Object} [options.config] - Top-level shared config block
 * @param {Object} [options.serverConfig] - Server config block
 * @param {Object} [options.clientConfig] - Client config block
 * @returns {Object} Map of blockName -> normalized schema object map
 * @throws {CoraliteError} CORALITE-P203 for duplicate key, CORALITE-P206 for invalid shape
 */
export function validatePluginConfigBlocks ({ pluginName = 'plugin', config, serverConfig, clientConfig } = {}) {
  const keyToBlockMap = new Map()

  const checkUniqueness = (blockObj, blockName) => {
    if (!blockObj || typeof blockObj !== 'object') {
      return
    }
    for (const key of Object.keys(blockObj)) {
      if (keyToBlockMap.has(key)) {
        const previousBlock = keyToBlockMap.get(key)
        throw new CoraliteError(
          `[CORALITE-P203] Plugin "${pluginName}": Config key "${key}" is declared in more than one config block ("${previousBlock}" and "${blockName}"). Each key must appear in exactly one block.`,
          { code: 'CORALITE-P203' }
        )
      }
      keyToBlockMap.set(key, blockName)
    }
  }

  checkUniqueness(config, 'config')
  checkUniqueness(serverConfig, 'server.config')
  checkUniqueness(clientConfig, 'client.config')

  const normalized = {
    config: {},
    serverConfig: {},
    clientConfig: {}
  }

  const validateBlock = (blockObj, blockName, targetObj) => {
    if (!blockObj || typeof blockObj !== 'object') {
      return
    }
    for (const [key, decl] of Object.entries(blockObj)) {
      targetObj[key] = normalizeAndValidateConfigSchemaKey(key, decl, blockName)
    }
  }

  validateBlock(config, 'config', normalized.config)
  validateBlock(serverConfig, 'server.config', normalized.serverConfig)
  validateBlock(clientConfig, 'client.config', normalized.clientConfig)

  return normalized
}

/**
 * Validates config values against normalized schemas at call time or setup time.
 *
 * @param {Object} normalizedSchemas - Output from validatePluginConfigBlocks
 * @param {Object} [values={}] - Values passed to plugin callable
 * @returns {Object} Partitioned values { name, valuesByBlock: { config, serverConfig, clientConfig } }
 * @throws {CoraliteError} CORALITE-P101 for missing required keys, CORALITE-P207 for unknown keys or invalid values
 */
export function validateValues (normalizedSchemas, values = {}) {
  if (values === null || typeof values !== 'object' || Array.isArray(values)) {
    throw new CoraliteError(
      '[CORALITE-P207] Plugin config values must be a plain object.',
      { code: 'CORALITE-P207' }
    )
  }

  const { config = {}, serverConfig = {}, clientConfig = {} } = normalizedSchemas || {}

  const allDeclaredKeys = new Set([
    ...Object.keys(config),
    ...Object.keys(serverConfig),
    ...Object.keys(clientConfig)
  ])

  // Check for unknown keys
  for (const key of Object.keys(values)) {
    if (key === 'name') {
      continue
    }
    if (!allDeclaredKeys.has(key)) {
      throw new CoraliteError(
        `[CORALITE-P207] Unknown plugin config key "${key}".`,
        { code: 'CORALITE-P207' }
      )
    }
  }

  const valuesByBlock = {
    config: {},
    serverConfig: {},
    clientConfig: {}
  }

  const blocks = [
    {
      name: 'config',
      schema: config
    },
    {
      name: 'serverConfig',
      schema: serverConfig
    },
    {
      name: 'clientConfig',
      schema: clientConfig
    }
  ]

  for (const { name: blockName, schema } of blocks) {
    for (const [key, decl] of Object.entries(schema)) {
      const hasValue = Object.hasOwn(values, key)
      let val

      if (hasValue) {
        val = values[key]

        // 1. Validate type
        const expectedType = decl.type
        if (expectedType === 'String') {
          if (typeof val !== 'string') {
            throw new CoraliteError(
              `[CORALITE-P207] Invalid config value for "${key}": expected String, received ${typeof val}.`,
              { code: 'CORALITE-P207' }
            )
          }
        } else if (expectedType === 'Number') {
          if (typeof val !== 'number' || Number.isNaN(val)) {
            throw new CoraliteError(
              `[CORALITE-P207] Invalid config value for "${key}": expected Number, received ${typeof val}.`,
              { code: 'CORALITE-P207' }
            )
          }
        } else if (expectedType === 'Boolean') {
          if (typeof val !== 'boolean') {
            throw new CoraliteError(
              `[CORALITE-P207] Invalid config value for "${key}": expected Boolean, received ${typeof val}.`,
              { code: 'CORALITE-P207' }
            )
          }
        } else if (expectedType === 'Object') {
          if (typeof val !== 'function' && (typeof val !== 'object' || val === null || Array.isArray(val))) {
            /** @type {string} */
            let actual = typeof val
            if (val === null) {
              actual = 'null'
            } else if (Array.isArray(val)) {
              actual = 'Array'
            }
            throw new CoraliteError(
              `[CORALITE-P207] Invalid config value for "${key}": expected Object, received ${actual}.`,
              { code: 'CORALITE-P207' }
            )
          }
        } else if (expectedType === 'Array') {
          if (!Array.isArray(val)) {
            throw new CoraliteError(
              `[CORALITE-P207] Invalid config value for "${key}": expected Array, received ${typeof val}.`,
              { code: 'CORALITE-P207' }
            )
          }
        }

        // 2. Validate values enum if present
        if (Array.isArray(decl.values)) {
          if (!decl.values.includes(val)) {
            throw new CoraliteError(
              `[CORALITE-P207] Invalid config value for "${key}": value must be one of [${decl.values.join(', ')}], received ${JSON.stringify(val)}.`,
              { code: 'CORALITE-P207' }
            )
          }
        }

        // 3. Validate custom validate function if present
        if (typeof decl.validate === 'function') {
          try {
            const isValid = decl.validate(val)
            if (isValid === false) {
              throw new CoraliteError(
                `[CORALITE-P207] Invalid config value for "${key}": custom validation failed.`,
                { code: 'CORALITE-P207' }
              )
            }
          } catch (err) {
            if (err instanceof CoraliteError && err.code === 'CORALITE-P207') {
              throw err
            }
            throw new CoraliteError(
              `[CORALITE-P207] Invalid config value for "${key}": ${err.message}`,
              {
                code: 'CORALITE-P207',
                cause: err
              }
            )
          }
        }

        // 4. Transform value if present
        if (typeof decl.transform === 'function') {
          val = decl.transform(val)
        }
      } else {
        // Key not provided
        if ('default' in decl && decl.default !== undefined) {
          val = decl.default
        } else if (decl.required) {
          throw new CoraliteError(
            `[CORALITE-P101] Missing required plugin config key "${key}".`,
            { code: 'CORALITE-P101' }
          )
        } else {
          val = undefined
        }
      }

      valuesByBlock[blockName][key] = val
    }
  }

  return {
    name: values.name,
    valuesByBlock
  }
}

/**
 * Validates late-bound config values (e.g. from clientConfig staging or server lateBound writes)
 * against schema declarations after build hooks fire.
 * Re-validates types/enums/validations, applies defaults for missing keys, and returns normalized object.
 *
 * @param {Object} schema - Normalized or raw block schema declarations
 * @param {Object} values - Staging or late-bound values object
 * @returns {Object} Validated and defaulted values object
 * @throws {CoraliteError} CORALITE-P207 for unknown keys or invalid values, CORALITE-P101 for missing required keys
 */
export function validateLateBoundValues (schema = {}, values = {}) {
  if (values === null || typeof values !== 'object' || Array.isArray(values)) {
    throw new CoraliteError(
      '[CORALITE-P207] Late-bound config values must be a plain object.',
      { code: 'CORALITE-P207' }
    )
  }

  // Check for unknown keys in values against schema
  for (const key of Object.keys(values)) {
    if (!Object.hasOwn(schema, key)) {
      throw new CoraliteError(
        `[CORALITE-P207] Unknown late-bound config key "${key}".`,
        { code: 'CORALITE-P207' }
      )
    }
  }

  const result = {}

  for (const [key, rawDecl] of Object.entries(schema)) {
    const decl = normalizeAndValidateConfigSchemaKey(key, rawDecl)
    const hasValue = Object.hasOwn(values, key) && values[key] !== undefined
    let val

    if (hasValue) {
      val = values[key]

      // 1. Validate type
      const expectedType = decl.type
      if (expectedType === 'String') {
        if (typeof val !== 'string') {
          throw new CoraliteError(
            `[CORALITE-P207] Invalid config value for "${key}": expected String, received ${typeof val}.`,
            { code: 'CORALITE-P207' }
          )
        }
      } else if (expectedType === 'Number') {
        if (typeof val !== 'number' || Number.isNaN(val)) {
          throw new CoraliteError(
            `[CORALITE-P207] Invalid config value for "${key}": expected Number, received ${typeof val}.`,
            { code: 'CORALITE-P207' }
          )
        }
      } else if (expectedType === 'Boolean') {
        if (typeof val !== 'boolean') {
          throw new CoraliteError(
            `[CORALITE-P207] Invalid config value for "${key}": expected Boolean, received ${typeof val}.`,
            { code: 'CORALITE-P207' }
          )
        }
      } else if (expectedType === 'Object') {
        if (typeof val !== 'function' && (typeof val !== 'object' || val === null || Array.isArray(val))) {
          /** @type {string} */
          let actual = typeof val
          if (val === null) {
            actual = 'null'
          } else if (Array.isArray(val)) {
            actual = 'Array'
          }
          throw new CoraliteError(
            `[CORALITE-P207] Invalid config value for "${key}": expected Object, received ${actual}.`,
            { code: 'CORALITE-P207' }
          )
        }
      } else if (expectedType === 'Array') {
        if (!Array.isArray(val)) {
          throw new CoraliteError(
            `[CORALITE-P207] Invalid config value for "${key}": expected Array, received ${typeof val}.`,
            { code: 'CORALITE-P207' }
          )
        }
      }

      // 2. Validate values enum if present
      if (Array.isArray(decl.values)) {
        if (!decl.values.includes(val)) {
          throw new CoraliteError(
            `[CORALITE-P207] Invalid config value for "${key}": value must be one of [${decl.values.join(', ')}], received ${JSON.stringify(val)}.`,
            { code: 'CORALITE-P207' }
          )
        }
      }

      // 3. Validate custom validate function if present
      if (typeof decl.validate === 'function') {
        try {
          const isValid = decl.validate(val)
          if (isValid === false) {
            throw new CoraliteError(
              `[CORALITE-P207] Invalid config value for "${key}": custom validation failed.`,
              { code: 'CORALITE-P207' }
            )
          }
        } catch (err) {
          if (err instanceof CoraliteError && err.code === 'CORALITE-P207') {
            throw err
          }
          throw new CoraliteError(
            `[CORALITE-P207] Invalid config value for "${key}": ${err.message}`,
            {
              code: 'CORALITE-P207',
              cause: err
            }
          )
        }
      }

      // 4. Transform value if present
      if (typeof decl.transform === 'function') {
        val = decl.transform(val)
      }
    } else {
      if ('default' in decl && decl.default !== undefined) {
        val = decl.default
      } else if (decl.required) {
        throw new CoraliteError(
          `[CORALITE-P101] Missing required plugin config key "${key}".`,
          { code: 'CORALITE-P101' }
        )
      } else {
        val = undefined
      }
    }

    result[key] = val
  }

  return result
}
