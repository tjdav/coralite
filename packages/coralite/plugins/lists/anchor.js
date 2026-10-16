/**
 * Position array and anchor model for windowed virtualization.
 */

/**
 * Computes the cumulative positions of all items in the store.
 *
 * @param {Array<any>} items - Store items array
 * @param {Function} keyFn - Key extraction function
 * @param {Map<string, number>|{ get: (key: string) => number|undefined }} measurements - Height measurement cache
 * @param {number} defaultSize - Fallback/estimated item height in px
 * @returns {Array<{ key: string, y: number, height: number }>} Recomputed positions
 */
export function computePositions (items, keyFn, measurements, defaultSize) {
  const positions = new Array(items.length)
  let currentY = 0

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const k = keyFn(item)
    const measuredHeight = measurements ? measurements.get(k) : undefined
    const height = typeof measuredHeight === 'number' && measuredHeight > 0 ? measuredHeight : defaultSize

    positions[i] = {
      key: k,
      y: currentY,
      height
    }

    currentY += height
  }

  return positions
}

/**
 * Computes the visible range [startIndex, endIndex] using binary search.
 *
 * @param {Array<{ key: string, y: number, height: number }>} positions - Position array
 * @param {number} virtualScrollTop - Current virtual scroll top in px
 * @param {number} viewportHeight - Viewport container height in px
 * @param {number} overscan - Extra off-screen items to render above and below
 * @returns {{ startIndex: number, endIndex: number }} Visible range indices
 */
export function computeVisibleRange (positions, virtualScrollTop, viewportHeight, overscan = 0) {
  if (!positions || positions.length === 0) {
    return {
      startIndex: 0,
      endIndex: -1
    }
  }

  const scrollTop = Math.max(0, virtualScrollTop)
  const scrollBottom = scrollTop + Math.max(0, viewportHeight)

  // 1. Binary search positions for the last item whose y <= scrollTop
  let low = 0
  let high = positions.length - 1
  let startIndex = 0

  while (low <= high) {
    const mid = (low + high) >> 1
    if (positions[mid].y <= scrollTop) {
      startIndex = mid
      low = mid + 1
    } else {
      high = mid - 1
    }
  }

  // 2. Walk forward from startIndex accumulating heights until y >= scrollBottom
  let endIndex = startIndex
  while (endIndex < positions.length - 1 && positions[endIndex].y < scrollBottom) {
    endIndex++
  }

  // 3. Apply overscan padding
  startIndex = Math.max(0, startIndex - overscan)
  endIndex = Math.min(positions.length - 1, endIndex + overscan)

  return {
    startIndex,
    endIndex
  }
}

/**
 * Derives absolute virtual scrollTop from an anchor point.
 *
 * @param {{ key: string, offset: number }|null} anchor - Current anchor
 * @param {Array<{ key: string, y: number, height: number }>} positions - Position array
 * @param {'start'|'end'} [anchorTo='start'] - Anchoring mode
 * @param {number} [viewportHeight=0] - Viewport container height in px
 * @returns {number} Virtual scrollTop in px
 */
export function computeScrollTopFromAnchor (anchor, positions, anchorTo = 'start', viewportHeight = 0) {
  if (!anchor || !positions || positions.length === 0) {
    return 0
  }

  const item = positions.find((p) => p.key === anchor.key)
  if (!item) {
    return 0
  }

  if (anchorTo === 'end') {
    return ((item.y + item.height) - viewportHeight) + (anchor.offset || 0)
  }

  return item.y + (anchor.offset || 0)
}

/**
 * Computes anchor fallback when the current anchor item is removed.
 *
 * @param {string} removedKey - Key of the removed item
 * @param {{ key: string, offset: number }|null} anchor - Current anchor
 * @param {Array<{ key: string, y: number, height: number }>} positions - Position array before/after removal lookup
 * @param {'start'|'end'} [anchorTo='start'] - Anchoring mode
 * @returns {{ key: string, offset: number }|null} New anchor or null
 */
export function reanchorOnRemove (removedKey, anchor, positions, anchorTo = 'start') {
  if (!anchor || anchor.key !== removedKey) {
    return anchor
  }

  if (!positions || positions.length === 0) {
    return null
  }

  const index = positions.findIndex((p) => p.key === removedKey)
  if (index === -1) {
    return null
  }

  if (anchorTo === 'end') {
    const fallbackItem = positions[index - 1] ?? positions[index + 1] ?? positions[0]
    if (!fallbackItem) {
      return null
    }
    return {
      key: fallbackItem.key,
      offset: 0
    }
  }

  const nextItem = positions[index + 1] ?? positions[0]
  if (!nextItem) {
    return null
  }

  return {
    key: nextItem.key,
    offset: 0
  }
}
