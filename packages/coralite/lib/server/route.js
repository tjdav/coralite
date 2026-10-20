import { inspect } from 'node:util'
import { CoraliteError, CoraliteBuildError } from '../shared/errors.js'
import { parsePagePattern } from './pattern.js'

/**
 * Extracts route parameters from a page relative path.
 *
 * @param {string} relPath - Relative file path under pages directory (e.g. "posts/[id].html")
 * @returns {{ routeParams: string[], isCatchAll: boolean }}
 */
export function extractRouteParams (relPath) {
  if (!relPath || typeof relPath !== 'string') {
    return {
      routeParams: [],
      isCatchAll: false
    }
  }

  const { params } = parsePagePattern(relPath, '')
  const isCatchAll = /\[\.\.\.[^\]]+\]/.test(relPath)

  return {
    routeParams: params,
    isCatchAll
  }
}

/**
 * Validates the return value of a page `paths()` execution against the page's route parameters.
 *
 * @param {any} rawPaths - Value returned by `paths()`
 * @param {string[]} routeParams - Declared route param names
 * @param {string} filePath - Path to page file for diagnostics
 * @returns {void}
 * @throws {CoraliteError} CORALITE-E402 if validation fails
 */
export function validateEnumeratedPaths (rawPaths, routeParams = [], filePath = '') {
  if (!Array.isArray(rawPaths)) {
    throw new CoraliteError(
      `Page "paths" block must return an array of param objects, received ${rawPaths === null ? 'null' : typeof rawPaths}.`,
      {
        code: 'CORALITE-E402',
        filePath
      }
    )
  }

  const expectedParamsSet = new Set(routeParams)

  for (let i = 0; i < rawPaths.length; i++) {
    const entry = rawPaths[i]

    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      /** @type {string} */
      let typeDesc = typeof entry
      if (entry === null) {
        typeDesc = 'null'
      } else if (Array.isArray(entry)) {
        typeDesc = 'array'
      }
      throw new CoraliteError(
        `Page "paths" entry at index ${i} must be a param object, received ${typeDesc}.`,
        {
          code: 'CORALITE-E402',
          filePath
        }
      )
    }

    const entryKeys = Object.keys(entry)

    // Check missing params
    for (const param of routeParams) {
      if (!(param in entry)) {
        throw new CoraliteError(
          `Page "paths" entry at index ${i} missing required route param "${param}".`,
          {
            code: 'CORALITE-E402',
            filePath
          }
        )
      }
    }

    // Check extra params & value types
    for (const key of entryKeys) {
      if (!expectedParamsSet.has(key)) {
        throw new CoraliteError(
          `Page "paths" entry at index ${i} contains undeclared param "${key}".`,
          {
            code: 'CORALITE-E402',
            filePath
          }
        )
      }

      if (typeof entry[key] !== 'string') {
        throw new CoraliteError(
          `Page "paths" param "${key}" at index ${i} must be a string, received ${typeof entry[key]}.`,
          {
            code: 'CORALITE-E402',
            filePath
          }
        )
      }
    }
  }
}

/**
 * Generates a canonical string key for a parameter object by sorting keys and values.
 *
 * @param {Object} obj - The parameter object
 * @returns {string} Unique parameter key
 */
function paramsKey (obj) {
  if (!obj || typeof obj !== 'object') {
    return ''
  }
  const sortedKeys = Object.keys(obj).sort()
  return sortedKeys.map(k => `${JSON.stringify(k)}:${JSON.stringify(obj[k])}`).join(',')
}

/**
 * Deduplicates enumerated path param objects from multiple contribution sources.
 *
 * @param {Array<{ source: string, paths: Array<Object> }>} contributions - Array of contribution objects containing source label and array of param objects
 * @param {string} [filePath] - Path to page file for diagnostics
 * @returns {Array<Object>} Deduplicated array of param objects
 * @throws {CoraliteBuildError} On duplicate paths from same source or cross-source conflicts
 */
export function deduplicateEnumeratedPaths (contributions, filePath = '') {
  const seen = new Map()
  const result = []

  if (!Array.isArray(contributions)) {
    return result
  }

  for (const contrib of contributions) {
    if (!contrib || !Array.isArray(contrib.paths)) {
      continue
    }
    const source = contrib.source || 'unknown'

    for (const paramObj of contrib.paths) {
      if (!paramObj || typeof paramObj !== 'object') {
        continue
      }
      const key = paramsKey(paramObj)

      if (!seen.has(key)) {
        seen.set(key, {
          paramObj,
          sources: [source]
        })
        result.push(paramObj)
      } else {
        seen.get(key).sources.push(source)
      }
    }
  }

  for (const entry of seen.values()) {
    if (entry.sources.length > 1) {
      const uniqueSources = Array.from(new Set(entry.sources))
      const formattedParam = inspect(entry.paramObj)

      if (uniqueSources.length === 1) {
        throw new CoraliteBuildError(
          `Duplicate path in ${filePath}: ${formattedParam}\nSource: ${uniqueSources[0]}`,
          { filePath }
        )
      } else {
        throw new CoraliteBuildError(
          `Conflicting path in ${filePath}: ${formattedParam}\nSources: ${uniqueSources.join(' and ')}`,
          { filePath }
        )
      }
    }
  }

  return result
}

/**
 * Validates plugin-contributed `paths` array against route parameters.
 *
 * @param {any} rawPaths - Value returned by plugin's `onPageSet` as `{ paths }`
 * @param {string[]} routeParams - Declared route param names
 * @param {string} filePath - Path to page file for diagnostics
 * @returns {void}
 * @throws {CoraliteError} CORALITE-E407 if validation fails
 */
export function validatePluginEnumeratedPaths (rawPaths, routeParams = [], filePath = '') {
  if (!Array.isArray(rawPaths)) {
    throw new CoraliteError(
      `Plugin "onPageSet" returned "paths" must be an array, received ${rawPaths === null ? 'null' : typeof rawPaths}.`,
      {
        code: 'CORALITE-E407',
        filePath
      }
    )
  }

  const expectedParamsSet = new Set(routeParams)

  for (let i = 0; i < rawPaths.length; i++) {
    const entry = rawPaths[i]

    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      /** @type {string} */
      let typeDesc = typeof entry
      if (entry === null) {
        typeDesc = 'null'
      } else if (Array.isArray(entry)) {
        typeDesc = 'array'
      }
      throw new CoraliteError(
        `Plugin "onPageSet" paths entry at index ${i} must be a param object, received ${typeDesc}.`,
        {
          code: 'CORALITE-E407',
          filePath
        }
      )
    }

    const entryKeys = Object.keys(entry)

    // Check missing params
    for (const param of routeParams) {
      if (!(param in entry)) {
        throw new CoraliteError(
          `Plugin "onPageSet" paths entry at index ${i} missing required route param "${param}".`,
          {
            code: 'CORALITE-E407',
            filePath
          }
        )
      }
    }

    // Check extra params & value types
    for (const key of entryKeys) {
      if (!expectedParamsSet.has(key)) {
        throw new CoraliteError(
          `Plugin "onPageSet" paths entry at index ${i} contains undeclared param "${key}".`,
          {
            code: 'CORALITE-E407',
            filePath
          }
        )
      }

      if (typeof entry[key] !== 'string') {
        throw new CoraliteError(
          `Plugin "onPageSet" paths param "${key}" at index ${i} must be a string, received ${typeof entry[key]}.`,
          {
            code: 'CORALITE-E407',
            filePath
          }
        )
      }
    }
  }
}
