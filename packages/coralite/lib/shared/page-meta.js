import { CoraliteError } from './errors.js'
import { validateAttributeValue } from './attributes.js'

const PRIMITIVE_TYPE_NAMES = new Set(['String', 'Number', 'Boolean'])

/**
 * Normalizes a page meta schema entry into a plain schema object.
 * Primitive constructors are converted to their string names so schemas
 * evaluated in a separate VM realm validate against the host runtime.
 *
 * @param {Function | Array<*> | Record<string, any> | null | undefined} schema - Raw schema definition.
 * @returns {Record<string, any>} Normalized schema object.
 */
function normalizeMetaSchema (schema) {
  let schemaObj
  if (typeof schema === 'function') {
    schemaObj = { type: schema }
  } else if (Array.isArray(schema)) {
    schemaObj = { values: schema }
  } else {
    schemaObj = schema || {}
  }

  const normalized = schemaObj && typeof schemaObj === 'object' && !Array.isArray(schemaObj)
    ? { ...schemaObj }
    : {}
  if (typeof normalized.type === 'function' && PRIMITIVE_TYPE_NAMES.has(normalized.type.name)) {
    normalized.type = normalized.type.name
  }

  return normalized
}

/**
 * Resolves the declared default values for a page `meta` schema.
 * Each key becomes a page state entry. Entries without a default are skipped.
 * Malformed schemas and invalid defaults throw a `CoraliteError` so builds fail
 * instead of rendering coerced or incorrect values.
 *
 * @param {Record<string, any> | null | undefined} meta - Page meta schema map.
 * @param {Object} [options={}] - Resolution options.
 * @param {string} [options.filePath] - Page file path used in error messages.
 * @returns {Record<string, any>} Resolved default values keyed by meta name.
 */
export function resolvePageMetaDefaults (meta, options = {}) {
  const { filePath } = options

  if (meta === undefined) {
    return {}
  }

  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
    throw new CoraliteError('Page "meta" must be an object literal of schema definitions.', {
      filePath
    })
  }

  const defaults = {}

  for (const [name, schema] of Object.entries(meta)) {
    const schemaObj = normalizeMetaSchema(schema)

    if (schemaObj.required) {
      throw new CoraliteError(`Page meta "${name}" cannot set "required". Pages have no external input; declare a default instead.`, {
        filePath
      })
    }

    if (schemaObj.default === undefined) {
      continue
    }

    let resolved
    try {
      resolved = validateAttributeValue(schemaObj.default, schemaObj, name, 'page', { filePath })
    } catch (err) {
      throw new CoraliteError(`Page meta "${name}" has an invalid default: ${err.message}`, {
        cause: err,
        filePath
      })
    }

    if (schemaObj.type === 'Number' && resolved === null && schemaObj.default !== null) {
      throw new CoraliteError(`Page meta "${name}" default ${JSON.stringify(schemaObj.default)} is not a valid Number.`, {
        filePath
      })
    }

    if (schemaObj.type === 'Boolean' && typeof resolved !== 'boolean') {
      throw new CoraliteError(`Page meta "${name}" default ${JSON.stringify(schemaObj.default)} is not a valid Boolean.`, {
        filePath
      })
    }

    defaults[name] = resolved
  }

  return defaults
}
