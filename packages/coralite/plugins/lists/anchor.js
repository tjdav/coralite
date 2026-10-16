import {
  layoutLinear,
  layoutGrid,
  layoutMasonry,
  layoutTable,
  computeLaneCount
} from './layouts.js'

function getItemKey (item, keyFn, index) {
  if (item && item.__header && item.key) {
    return item.key
  }
  if (keyFn) {
    return keyFn(item)
  }
  if (item && item.key) {
    return item.key
  }
  return String(index)
}

/**
 * Computes the cumulative positions array of all items in the store.
 *
 * @param {Array<any>} items - Store items array
 * @param {Function} keyFn - Key extraction function
 * @param {Object} [measurements] - Height measurement cache
 * @param {number} defaultSize - Fallback/estimated item height in px
 * @param {Object} [layoutOptions={}] - Layout options
 * @returns {Array<{ key: string, x: number, y: number, width: number, height: number, lane: number }>} Recomputed positions
 */
export function computePositions (
  items,
  keyFn,
  measurements,
  defaultSize = 64,
  layoutOptions = {}
) {
  if (!items || items.length === 0) {
    return []
  }

  const {
    layout = 'linear',
    lanes = 1,
    laneWidth = 280,
    minLaneWidth = 200,
    maxLanes = 6,
    gap = 0,
    columns = [],
    containerWidth = 800
  } = layoutOptions

  const activeLanes = lanes === 'auto'
    ? computeLaneCount(containerWidth, laneWidth, minLaneWidth, maxLanes, gap)
    : Math.max(1, Number(lanes) || 1)

  const actualLaneWidth = (layout === 'grid' || layout === 'masonry')
    ? (containerWidth - (gap * (activeLanes - 1))) / activeLanes
    : laneWidth

  const signature = `${activeLanes}:${Math.round(actualLaneWidth)}:${Math.round(containerWidth)}`

  const headerEstimate = typeof layoutOptions.headerHeight === 'number' ? layoutOptions.headerHeight : 40

  const heights = new Array(items.length)
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const k = getItemKey(item, keyFn, i)
    let measured
    if (measurements && typeof measurements.get === 'function') {
      measured = measurements.get(k, signature)
      if (typeof measured !== 'number') {
        measured = measurements.get(k)
      }
    }
    const fallbackSize = item && item.__header ? headerEstimate : defaultSize
    heights[i] = typeof measured === 'number' && measured > 0 ? measured : fallbackSize
  }

  switch (layout) {
    case 'grid':
      return layoutGrid(items, heights, activeLanes, containerWidth, gap, keyFn)
    case 'masonry':
      return layoutMasonry(items, heights, activeLanes, containerWidth, gap, keyFn)
    case 'table':
      return layoutTable(items, heights, columns, containerWidth, gap, keyFn)
    case 'linear':
    default:
      return layoutLinear(items, heights, containerWidth, gap, keyFn)
  }
}

/**
 * Computes the visible range [startIndex, endIndex] using binary search.
 *
 * @param {Array<{ key: string, x: number, y: number, width: number, height: number, lane: number }>} positions - Position array
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

  let endIndex = startIndex
  while (endIndex < positions.length - 1 && positions[endIndex].y < scrollBottom) {
    endIndex++
  }

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
 * @param {Array<{ key: string, x: number, y: number, width: number, height: number, lane: number }>} positions - Position array
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
 * @param {Array<{ key: string, x: number, y: number, width: number, height: number, lane: number }>} positions - Position array
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
