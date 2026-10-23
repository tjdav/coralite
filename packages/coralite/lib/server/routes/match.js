/**
 * Normalizes a URL path by removing query string, hash fragment, and trailing slashes.
 *
 * @param {string} url - The URL string to normalize.
 * @returns {string|null} Normalized path or null if input is invalid.
 */
function normalizeUrl (url) {
  if (typeof url !== 'string') {
    return null
  }
  let path = url.split('?')[0].split('#')[0]
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1)
  }
  return path
}

/**
 * Gets segment ranking at position `i` for a pattern matching `urlSegments`.
 *
 * @param {Object} patternEntry - The route pattern entry.
 * @param {number} i - Segment index.
 * @returns {number} Segment rank (3 for static, 2 for param, 1 for catchall).
 */
function getSegmentRank (patternEntry, i) {
  const segments = patternEntry.segments || []
  if (i < segments.length) {
    const seg = segments[i]
    if (seg.type === 'static') {
      return 3
    }
    if (seg.type === 'param') {
      return 2
    }
    if (seg.type === 'catchall') {
      return 1
    }
  }
  // Covered by catchall past segments.length - 1
  return 1
}

/**
 * Tests if a route pattern entry matches the given URL segments.
 *
 * @param {Object} patternEntry - The route pattern entry.
 * @param {string[]} urlSegments - Array of URL path segments.
 * @returns {boolean} True if pattern matches.
 */
function matchesPattern (patternEntry, urlSegments) {
  const segments = patternEntry.segments || []
  const hasCatchall = segments.length > 0 && segments[segments.length - 1].type === 'catchall'
  const nonCatchallCount = hasCatchall ? segments.length - 1 : segments.length

  if (!hasCatchall) {
    if (urlSegments.length !== segments.length) {
      return false
    }
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]
      if (seg.type === 'static' && seg.value !== urlSegments[i]) {
        return false
      }
    }
    return true
  } else {
    if (urlSegments.length < nonCatchallCount) {
      return false
    }
    for (let i = 0; i < nonCatchallCount; i++) {
      const seg = segments[i]
      if (seg.type === 'static' && seg.value !== urlSegments[i]) {
        return false
      }
    }
    return true
  }
}

/**
 * Extracts route parameters from URL segments for a matching pattern entry.
 *
 * @param {Object} patternEntry - The matching route pattern entry.
 * @param {string[]} urlSegments - Array of URL path segments.
 * @returns {Record<string, string>} Object containing extracted route parameters.
 */
function extractParams (patternEntry, urlSegments) {
  /** @type {Record<string, string>} */
  const params = {}
  const segments = patternEntry.segments || []
  const hasCatchall = segments.length > 0 && segments[segments.length - 1].type === 'catchall'
  const nonCatchallCount = hasCatchall ? segments.length - 1 : segments.length

  for (let i = 0; i < nonCatchallCount; i++) {
    const seg = segments[i]
    if (seg.type === 'param') {
      params[seg.value] = urlSegments[i]
    }
  }

  if (hasCatchall) {
    const catchallSeg = segments[segments.length - 1]
    const remaining = urlSegments.slice(nonCatchallCount)
    params[catchallSeg.value] = remaining.join('/')
  }

  return params
}

/**
 * Compares two matching route patterns according to precedence rules.
 *
 * @param {Object} a - First route pattern entry.
 * @param {Object} b - Second route pattern entry.
 * @param {string[]} urlSegments - Array of URL path segments.
 * @returns {number} Negative if a wins, positive if b wins, 0 if equal.
 */
function comparePrecedence (a, b, urlSegments) {
  const urlLen = urlSegments.length
  for (let i = 0; i < urlLen; i++) {
    const rankA = getSegmentRank(a, i)
    const rankB = getSegmentRank(b, i)
    if (rankA !== rankB) {
      return rankB - rankA
    }
  }

  const aSegs = a.segments || []
  const bSegs = b.segments || []
  const aHasCatchall = aSegs.length > 0 && aSegs[aSegs.length - 1].type === 'catchall'
  const bHasCatchall = bSegs.length > 0 && bSegs[bSegs.length - 1].type === 'catchall'

  if (aHasCatchall !== bHasCatchall) {
    return aHasCatchall ? 1 : -1
  }

  return 0
}

const routeIndexCache = new WeakMap()

/**
 * Builds or retrieves a cached lookup index for a route table's patterns array.
 *
 * @param {Array<Object>} patterns - Array of route pattern entries.
 * @returns {{
 *   length: number,
 *   staticMap: Map<string, Object>,
 *   dynamicByLength: Map<number, Array<Object>>,
 *   catchallPatterns: Array<Object>,
 *   orderMap: Map<Object, number>
 * }} Cached route index.
 */
function getRouteIndex (patterns) {
  const cached = routeIndexCache.get(patterns)
  if (cached && cached.length === patterns.length) {
    return cached
  }

  const staticMap = new Map()
  const dynamicByLength = new Map()
  const catchallPatterns = []
  const orderMap = new Map()

  for (let i = 0; i < patterns.length; i++) {
    const entry = patterns[i]
    const segments = entry.segments || []
    let isStatic = true
    for (let j = 0; j < segments.length; j++) {
      if (segments[j].type !== 'static') {
        isStatic = false
        break
      }
    }

    if (isStatic) {
      let staticPath = '/'
      if (segments.length > 0) {
        const parts = new Array(segments.length)
        for (let j = 0; j < segments.length; j++) {
          parts[j] = segments[j].value
        }
        staticPath = '/' + parts.join('/')
      }
      const normStatic = normalizeUrl(staticPath)
      if (normStatic !== null && !staticMap.has(normStatic)) {
        staticMap.set(normStatic, entry)
      }
    } else {
      orderMap.set(entry, i)
      const hasCatchall = segments.length > 0 && segments[segments.length - 1].type === 'catchall'
      if (hasCatchall) {
        catchallPatterns.push(entry)
      } else {
        const segLen = segments.length
        let bucket = dynamicByLength.get(segLen)
        if (!bucket) {
          bucket = []
          dynamicByLength.set(segLen, bucket)
        }
        bucket.push(entry)
      }
    }
  }

  const index = {
    length: patterns.length,
    staticMap,
    dynamicByLength,
    catchallPatterns,
    orderMap
  }
  routeIndexCache.set(patterns, index)
  return index
}

/**
 * Matches a URL against a route table and returns the winning pattern entry and extracted params.
 *
 * @param {string} url - The URL string to match (e.g. '/posts/intro').
 * @param {{ patterns: Array<Object> }} routeTable - Route table object from manifest.
 * @returns {{ pattern: string, params: Record<string, string>, pagePath: string } | null} The winning route match or null.
 */
export function matchRoute (url, routeTable) {
  if (!routeTable || !Array.isArray(routeTable.patterns)) {
    return null
  }

  const normalizedPath = normalizeUrl(url)
  if (normalizedPath === null) {
    return null
  }

  const index = getRouteIndex(routeTable.patterns)
  const staticWinner = index.staticMap.get(normalizedPath)
  if (staticWinner) {
    return {
      pattern: staticWinner.pattern,
      params: {},
      pagePath: staticWinner.pagePath
    }
  }

  const urlSegments = normalizedPath === '/' ? [] : normalizedPath.slice(1).split('/')
  const dynamicBucket = index.dynamicByLength.get(urlSegments.length)
  const catchallPatterns = index.catchallPatterns

  if (!dynamicBucket && catchallPatterns.length === 0) {
    return null
  }

  const matches = []
  if (dynamicBucket) {
    for (let i = 0; i < dynamicBucket.length; i++) {
      const patternEntry = dynamicBucket[i]
      if (matchesPattern(patternEntry, urlSegments)) {
        matches.push(patternEntry)
      }
    }
  }

  for (let i = 0; i < catchallPatterns.length; i++) {
    const patternEntry = catchallPatterns[i]
    if (matchesPattern(patternEntry, urlSegments)) {
      matches.push(patternEntry)
    }
  }

  if (matches.length === 0) {
    return null
  }

  if (matches.length > 1) {
    matches.sort((a, b) => {
      const cmp = comparePrecedence(a, b, urlSegments)
      if (cmp !== 0) {
        return cmp
      }
      return (index.orderMap.get(a) || 0) - (index.orderMap.get(b) || 0)
    })
  }

  const winner = matches[0]
  const params = extractParams(winner, urlSegments)

  return {
    pattern: winner.pattern,
    params,
    pagePath: winner.pagePath
  }
}
