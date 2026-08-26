import { CoraliteError } from './errors.js'

/**
 * Reserved DOM attributes used internally by Coralite or standard HTML semantics.
 * Filtered out during state initialization unless explicitly declared in component attributes.
 */
export const RESERVED_DOM_ATTRIBUTES = new Set([
  'data-cid',
  'data-coralite-owner',
  'data-coralite-initial',
  'data-coralite-slot-index',
  'data-coralite-page',
  'slot',
  'ref',
  'data-testid',
  'no-hydration'
])

/**
 * Normalizes an error message ensuring it ends with terminal punctuation (.!?).
 * @param {string} message - The error message to normalize.
 * @returns {string} Normalized error message with terminal punctuation.
 */
export function normalizeErrorMessage (message) {
  if (typeof message !== 'string') {
    return ''
  }
  const trimmed = message.trim()
  if (trimmed === '') {
    return ''
  }
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`
}

/**
 * Infers the primitive constructor or type name from an array of allowed values.
 * @param {Array<any>} valuesArray - Array of allowed primitive values.
 * @returns {Function} String, Number, or Boolean constructor.
 */
export function inferTypeFromValues (valuesArray) {
  if (!Array.isArray(valuesArray) || valuesArray.length === 0) {
    return String
  }
  const types = new Set(valuesArray.map(v => typeof v))
  if (types.size === 1) {
    const singleType = Array.from(types)[0]
    if (singleType === 'number') {
      return Number
    }
    if (singleType === 'boolean') {
      return Boolean
    }
    if (singleType === 'string') {
      return String
    }
  }
  return String
}

/**
 * Executes custom synchronous validation function on an attribute value.
 *
 * @param {any} value - The input value (after coercion/transformation).
 * @param {Object} schema - Attribute schema object containing optional validate function.
 * @param {string} name - Attribute name.
 * @param {string} [componentId] - Component ID for error messaging.
 * @param {Object} [errorOptions] - Additional options for CoraliteError.
 * @returns {any} The validated value.
 */
export function executeAttributeValidator (value, schema, name, componentId = 'component', errorOptions = {}) {
  return validateAttributeValue(value, schema, name, componentId, {
    ...errorOptions,
    graceful: false
  })
}

/**
 * Validates an attribute value against a component attribute schema following the full 6-step pipeline:
 * 1. Required check
 * 2. Type coercion
 * 3. Custom transformation
 * 4. Allowed values check
 * 5. Custom validation
 * 6. State application
 *
 * @param {any} value - The input value.
 * @param {Object|Array} schema - Attribute schema object or allowed values array.
 * @param {string} name - Attribute name.
 * @param {string} [componentId] - Component ID for error messaging.
 * @param {Object} [errorOptions] - Additional options for CoraliteError.
 * @returns {any} The validated and coerced primitive value.
 */
export function validateAttributeValue (value, schema, name, componentId = 'component', errorOptions = {}) {
  let schemaObj
  if (typeof schema === 'function') {
    schemaObj = { type: schema }
  } else if (Array.isArray(schema)) {
    schemaObj = { values: schema }
  } else {
    schemaObj = schema || {}
  }

  const graceful = Boolean(errorOptions?.graceful)

  // Step 1: required check
  if (schemaObj.required && (value === undefined || value === null)) {
    const errorMsg = `Attribute "${name}" is required.`
    if (graceful) {
      return {
        value: undefined,
        error: errorMsg
      }
    }
    throw new CoraliteError(`Component "${componentId}" requires attribute "${name}", but it was not provided.`, {
      componentId,
      ...errorOptions
    })
  }

  const targetType = schemaObj.type || (schemaObj.values ? inferTypeFromValues(schemaObj.values) : undefined)
  const isBooleanType = targetType === Boolean || targetType === 'Boolean'

  // Handle omitted value (optional attribute with or without default)
  let val = value
  if (val === undefined || (val === null && !isBooleanType)) {
    if (schemaObj.default !== undefined) {
      val = schemaObj.default
    } else {
      return graceful ? {
        value: undefined,
        error: null
      } : undefined
    }
  }

  if (targetType) {
    val = coerce(val, targetType)
  }

  let isTransformed = false
  if (typeof schemaObj.transform === 'function') {
    let transformed
    try {
      transformed = schemaObj.transform(val)
    } catch (err) {
      if (err instanceof CoraliteError && err.message.includes('transform function must be synchronous')) {
        throw err
      }
      const normErr = normalizeErrorMessage(err.message)
      if (graceful) {
        return {
          value: val,
          error: normErr
        }
      }
      if (err instanceof CoraliteError) {
        throw err
      }
      throw new CoraliteError(`Component "${componentId}" failed executing transform on attribute "${name}": ${normErr}`, {
        componentId,
        cause: err,
        ...errorOptions
      })
    }
    if (transformed && typeof transformed.then === 'function') {
      throw new CoraliteError(`Component "${componentId}" attribute "${name}" transform function must be synchronous. Use getters or server() for asynchronous data.`, {
        componentId,
        ...errorOptions
      })
    }
    if (transformed === undefined) {
      return graceful ? {
        value: undefined,
        transformed: true,
        error: null
      } : undefined
    }
    val = transformed
    isTransformed = true
  }

  // Step 4: values constraint check
  const values = schemaObj.values
  if (Array.isArray(values) && values.length > 0) {
    let matched = values.includes(val)
    if (!matched && typeof val === 'string') {
      const hasNumbers = values.some(v => typeof v === 'number')
      if (hasNumbers && val.trim() !== '') {
        const num = Number(val)
        if (!Number.isNaN(num) && values.includes(num)) {
          val = num
          matched = true
        }
      }
      const hasBooleans = values.some(v => typeof v === 'boolean')
      if (hasBooleans) {
        if ((val === '' || val === 'true') && values.includes(true)) {
          val = true
          matched = true
        } else if (val === 'false' && values.includes(false)) {
          val = false
          matched = true
        }
      }
    }

    if (!matched) {
      const formattedExpected = values.map(v => (typeof v === 'string' ? `'${v}'` : JSON.stringify(v))).join(', ')
      const errorMsg = `Invalid value for attribute "${name}". Expected one of: ${formattedExpected}.`
      if (graceful) {
        return {
          value: val,
          ...(isTransformed && val === undefined ? { transformed: true } : {}),
          error: errorMsg
        }
      }
      const formattedValue = JSON.stringify(val)
      const formattedExpectedLegacy = values.map(v => JSON.stringify(v)).join(', ')
      throw new CoraliteError(`Invalid value ${formattedValue} for attribute "${name}" in component "${componentId}". Expected one of: ${formattedExpectedLegacy}.`, {
        componentId,
        ...errorOptions
      })
    }
  }

  // Step 5: validate
  if (typeof schemaObj.validate === 'function') {
    let result
    try {
      result = schemaObj.validate(val)
    } catch (err) {
      if (err instanceof CoraliteError && err.message.includes('validate function must be synchronous')) {
        throw err
      }
      const normErr = normalizeErrorMessage(err.message)
      if (graceful) {
        return {
          value: val,
          ...(isTransformed && val === undefined ? { transformed: true } : {}),
          error: normErr
        }
      }
      if (err instanceof CoraliteError) {
        throw err
      }
      throw new CoraliteError(`Component "${componentId}" attribute "${name}" validation failed: ${normErr}`, {
        componentId,
        cause: err,
        ...errorOptions
      })
    }

    if (result && typeof result.then === 'function') {
      throw new CoraliteError(`Component "${componentId}" attribute "${name}" validate function must be synchronous. Use getters or server() for asynchronous validation.`, {
        componentId,
        ...errorOptions
      })
    }

    if (result === false) {
      const errorMsg = `Validation failed for attribute "${name}".`
      if (graceful) {
        return {
          value: val,
          ...(isTransformed && val === undefined ? { transformed: true } : {}),
          error: errorMsg
        }
      }
      throw new CoraliteError(`Component "${componentId}" attribute "${name}" validation failed for value ${JSON.stringify(val)}.`, {
        componentId,
        ...errorOptions
      })
    }

    if (typeof result === 'string' && result.trim() !== '') {
      const customMessage = normalizeErrorMessage(result)
      if (graceful) {
        return {
          value: val,
          ...(isTransformed && val === undefined ? { transformed: true } : {}),
          error: customMessage
        }
      }
      throw new CoraliteError(`Component "${componentId}" attribute "${name}" validation failed: ${customMessage}`, {
        componentId,
        ...errorOptions
      })
    }
  }

  // Step 6: State application
  return graceful ? {
    value: val,
    ...(isTransformed && val === undefined ? { transformed: true } : {}),
    error: null
  } : val
}

/**
 * Coerces a value to a specified type.
 * Supports Number, Boolean, and String.
 * @param {any} value - The value to coerce.
 * @param {Function|string|Object|Array} type - The target type (Constructor, string name, or schema object/array).
 * @returns {any} The coerced value.
 */
export function coerce (value, type) {
  let targetType = type
  if (Array.isArray(type) || (type && typeof type === 'object' && Array.isArray(type.values))) {
    const valuesArray = Array.isArray(type) ? type : type.values
    targetType = type.type || inferTypeFromValues(valuesArray)
  }

  if (targetType === Boolean || targetType === 'Boolean') {
    if (value === undefined) {
      return undefined
    }

    if (value === null || value === 'null') {
      return false
    }

    if (typeof value === 'boolean') {
      return value
    }

    if (value === '' || value === 'true') {
      return true
    }

    if (value === 'false') {
      return false
    }

    return value
  }

  if (value === null || value === undefined) {
    return value
  }

  if (targetType !== String && targetType !== 'String' && typeof value === 'string' && value.includes('{{') && value.includes('}}')) {
    return null
  }

  if (targetType === Number || targetType === 'Number') {
    if (typeof value === 'number') {
      return Number.isNaN(value) ? null : value
    }

    if (typeof value === 'string' && value.trim() === '') {
      return null
    }

    const num = Number(value)

    return Number.isNaN(num) ? null : num
  }

  if (targetType === String || targetType === 'String') {
    return String(value)
  }

  return value
}
