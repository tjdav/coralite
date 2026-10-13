import { CoraliteBuildError } from '../../shared/errors.js'

/**
 * Normalizes segments into a shape string for shape collision detection.
 *
 * @param {Array<{ type: string, value: string }>} segments - The array of route segments.
 * @returns {string} The normalized shape string.
 */
function normalizeShape (segments) {
  if (!Array.isArray(segments)) {
    return ''
  }
  return segments.map(s => {
    if (s.type === 'param' || s.type === 'catchall') {
      return `${s.type}:__`
    }
    return `${s.type}:${s.value}`
  }).join('/')
}

/**
 * Builds a route table from a list or collection of pages, detecting pattern and shape collisions.
 *
 * @param {Array<any> | { list: Array<any> }} pages - Array of page items or a CoraliteCollection instance
 * @returns {{ patterns: Array<{ pattern: string, params: string[], segments: Array<{ type: string, value: string }>, pagePath: string, type: 'static' | 'dynamic' }> }} Route table object containing pattern entries.
 */
export function buildRouteTable (pages) {
  let items = []
  if (pages) {
    if (Array.isArray(pages)) {
      items = pages
    } else if (Array.isArray(pages.list)) {
      items = pages.list
    }
  }

  const patterns = []
  const patternToPathMap = new Map()
  const shapeToInfoMap = new Map()

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (!item) {
      continue
    }

    const page = item.result?.page || item.page || item
    const routePattern = page?.routePattern
    if (!routePattern) {
      // Pages without a routePattern are skipped
      continue
    }

    const params = Array.isArray(page.routeParams) ? page.routeParams : []
    const segments = Array.isArray(page.routeSegments) ? page.routeSegments : []
    const pagePath = page.file?.pathname || page.filePath || item.path?.pathname || item.file?.pathname || ''

    // Exact pattern collision check
    if (patternToPathMap.has(routePattern)) {
      const existingPath = patternToPathMap.get(routePattern)
      if (existingPath !== pagePath) {
        throw new CoraliteBuildError(
          `Exact route collision detected: pages "${existingPath}" and "${pagePath}" both produce pattern "${routePattern}".`
        )
      }
    }

    // Shape collision check
    const shape = normalizeShape(segments)
    if (shapeToInfoMap.has(shape)) {
      const existing = shapeToInfoMap.get(shape)
      if (existing.pagePath !== pagePath) {
        throw new CoraliteBuildError(
          `Route shape collision detected: pages "${existing.pagePath}" (${existing.pattern}) and "${pagePath}" (${routePattern}) produce identical segment shape "${shape}".`
        )
      }
    }

    patternToPathMap.set(routePattern, pagePath)
    shapeToInfoMap.set(shape, {
      pattern: routePattern,
      pagePath
    })

    const isDynamic = segments.some(s => s.type === 'param' || s.type === 'catchall')
    /** @type {'static' | 'dynamic'} */
    const type = isDynamic ? 'dynamic' : 'static'

    patterns.push({
      pattern: routePattern,
      params,
      segments,
      pagePath,
      type
    })
  }

  // Order patterns deterministically by pagePath
  patterns.sort((a, b) => a.pagePath.localeCompare(b.pagePath))

  return { patterns }
}
