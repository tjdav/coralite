import { CoraliteError } from '../../shared/errors.js'

/**
 * Extracts route parameters from a page relative path.
 *
 * @param {string} relPath - Relative file path under pages directory (e.g. "posts/[id].html")
 * @returns {{ routeParams: string[], isCatchAll: boolean }}
 */
export function extractRouteParams (relPath) {
  if (!relPath || typeof relPath !== 'string') {
    return { routeParams: [], isCatchAll: false }
  }

  const normPath = relPath.replace(/\\/g, '/')
  const routeParams = []
  let isCatchAll = false

  const paramRegex = /\[(\.\.\.)?([^\]]+)\]/g
  let match

  while ((match = paramRegex.exec(normPath)) !== null) {
    if (match[1] === '...') {
      isCatchAll = true
    }
    const paramName = match[2]
    if (paramName && !routeParams.includes(paramName)) {
      routeParams.push(paramName)
    }
  }

  return { routeParams, isCatchAll }
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
