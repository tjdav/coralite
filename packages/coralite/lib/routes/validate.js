import { matchRoute } from './match.js'
import { CoraliteBuildError } from '../shared/errors.js'

/**
 * Constructs a concrete URL string for a pattern entry given parameter values.
 *
 * @param {Object} patternEntry - The route pattern entry.
 * @param {Record<string, any>} paramObj - Parameter key-value map.
 * @returns {string} The concrete URL path.
 */
export function buildConcreteUrl (patternEntry, paramObj) {
  const segments = patternEntry.segments || []
  if (segments.length === 0) {
    return '/'
  }

  const parts = []
  for (const seg of segments) {
    if (seg.type === 'static') {
      parts.push(seg.value)
    } else if (seg.type === 'param') {
      const val = paramObj[seg.value]
      if (val !== undefined && val !== null) {
        parts.push(String(val))
      }
    } else if (seg.type === 'catchall') {
      const val = paramObj[seg.value]
      if (Array.isArray(val)) {
        if (val.length > 0) {
          parts.push(val.join('/'))
        }
      } else if (typeof val === 'string' && val.length > 0) {
        parts.push(val)
      }
    }
  }

  return '/' + parts.join('/')
}

/**
 * Validates that every enumerated path in the route table matches its own pattern unambiguously.
 *
 * @param {{ patterns: Array<Object> }} routeTable - The route table.
 * @param {Array<any> | { list: Array<any> }} pages - List or collection of page items.
 * @throws {CoraliteBuildError} If a URL does not match or matches a different pattern.
 */
export function validateRouteTable (routeTable, pages) {
  if (!routeTable || !Array.isArray(routeTable.patterns)) {
    return
  }

  let items = []
  if (pages) {
    if (Array.isArray(pages)) {
      items = pages
    } else if (Array.isArray(pages.list)) {
      items = pages.list
    }
  }

  const pageMap = new Map()
  for (const item of items) {
    if (!item) {
      continue
    }
    const page = item.result?.page || item.page || item
    const pagePath = page.file?.pathname || page.filePath || item.path?.pathname || item.file?.pathname || ''
    if (pagePath) {
      pageMap.set(pagePath, page)
    }
  }

  for (const patternEntry of routeTable.patterns) {
    const page = pageMap.get(patternEntry.pagePath)
    const enumeratedPaths = Array.isArray(page?.enumeratedPaths) ? page.enumeratedPaths : []

    const concreteUrls = []
    if (enumeratedPaths.length > 0) {
      for (const paramObj of enumeratedPaths) {
        concreteUrls.push(buildConcreteUrl(patternEntry, paramObj))
      }
    } else if (patternEntry.type === 'static') {
      concreteUrls.push(patternEntry.pattern)
    }

    for (const url of concreteUrls) {
      const match = matchRoute(url, routeTable)
      if (!match) {
        throw new CoraliteBuildError(
          `Route validation failed for page "${patternEntry.pagePath}": URL "${url}" matched no pattern.`
        )
      }

      if (match.pattern !== patternEntry.pattern) {
        throw new CoraliteBuildError(
          `Route ambiguity detected for page "${patternEntry.pagePath}": URL "${url}" with pattern "${patternEntry.pattern}" matched winning pattern "${match.pattern}" from page "${match.pagePath}".`
        )
      }
    }
  }
}
