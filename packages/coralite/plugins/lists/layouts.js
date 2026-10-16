/**
 * Layout engine for lists plugin: linear, grid, masonry, and table layouts.
 */

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
 * Computes layout for linear vertical stacking.
 *
 * @param {Array<any>} items - Store items
 * @param {Array<number>} heights - Item heights in px
 * @param {number} containerWidth - Container width in px
 * @param {number} gap - Gap in px
 * @param {Function} [keyFn] - Key extractor
 * @returns {Array<Object>}
 */
export function layoutLinear (items, heights, containerWidth, gap = 0, keyFn) {
  const positions = new Array(items.length)
  let y = 0
  for (let i = 0; i < items.length; i++) {
    const h = heights[i]
    const k = getItemKey(items[i], keyFn, i)
    positions[i] = {
      key: k,
      x: 0,
      y,
      width: containerWidth,
      height: h,
      lane: 0
    }
    y += h + gap
  }
  return positions
}

/**
 * Computes layout for grid (row-major filling).
 *
 * @param {Array<any>} items - Store items
 * @param {Array<number>} heights - Item heights in px
 * @param {number} lanes - Number of lanes
 * @param {number} containerWidth - Container width in px
 * @param {number} gap - Gap in px
 * @param {Function} [keyFn] - Key extractor
 * @returns {Array<Object>}
 */
export function layoutGrid (items, heights, lanes = 1, containerWidth = 800, gap = 0, keyFn) {
  const safeLanes = Math.max(1, lanes)
  const laneWidth = (containerWidth - (gap * (safeLanes - 1))) / safeLanes
  const positions = []
  let y = 0
  let i = 0
  while (i < items.length) {
    if (items[i] && items[i].__header) {
      const k = getItemKey(items[i], keyFn, i)
      const h = heights[i]
      positions.push({
        key: k,
        x: 0,
        y,
        width: containerWidth,
        height: h,
        lane: 0
      })
      y += h + gap
      i++
      continue
    }

    const row = []
    let rowHeight = 0
    for (let l = 0; l < safeLanes && i < items.length; l++) {
      if (items[i] && items[i].__header) {
        break
      }
      const h = heights[i]
      row.push({
        item: items[i],
        height: h,
        index: i
      })
      if (h > rowHeight) {
        rowHeight = h
      }
      i++
    }

    for (let l = 0; l < row.length; l++) {
      const k = getItemKey(row[l].item, keyFn, row[l].index)
      positions.push({
        key: k,
        x: l * (laneWidth + gap),
        y,
        width: laneWidth,
        height: rowHeight,
        lane: l
      })
    }
    if (row.length > 0) {
      y += rowHeight + gap
    }
  }
  return positions
}

/**
 * Computes layout for masonry (shortest lane first).
 *
 * @param {Array<any>} items - Store items
 * @param {Array<number>} heights - Item heights in px
 * @param {number} lanes - Number of lanes
 * @param {number} containerWidth - Container width in px
 * @param {number} gap - Gap in px
 * @param {Function} [keyFn] - Key extractor
 * @returns {Array<Object>}
 */
export function layoutMasonry (items, heights, lanes = 1, containerWidth = 800, gap = 0, keyFn) {
  const safeLanes = Math.max(1, lanes)
  const laneWidth = (containerWidth - (gap * (safeLanes - 1))) / safeLanes
  const laneHeights = new Array(safeLanes).fill(0)
  const positions = new Array(items.length)
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const h = heights[i]
    const k = getItemKey(item, keyFn, i)

    if (item && item.__header) {
      let maxLaneY = 0
      for (let l = 0; l < safeLanes; l++) {
        if (laneHeights[l] > maxLaneY) {
          maxLaneY = laneHeights[l]
        }
      }
      positions[i] = {
        key: k,
        x: 0,
        y: maxLaneY,
        width: containerWidth,
        height: h,
        lane: 0
      }
      const nextY = maxLaneY + h + gap
      laneHeights.fill(nextY)
    } else {
      let shortest = 0
      for (let l = 1; l < safeLanes; l++) {
        if (laneHeights[l] < laneHeights[shortest]) {
          shortest = l
        }
      }
      const x = shortest * (laneWidth + gap)
      const y = laneHeights[shortest]
      positions[i] = {
        key: k,
        x,
        y,
        width: laneWidth,
        height: h,
        lane: shortest
      }
      laneHeights[shortest] = y + h + gap
    }
  }
  return positions
}

/**
 * Computes layout for table rows.
 *
 * @param {Array<any>} items - Store items
 * @param {Array<number>} heights - Item heights in px
 * @param {Array<{ key: string, width: number }>} [columns=[]] - Column definitions
 * @param {number} [containerWidth=800] - Container width in px
 * @param {number} [gap=0] - Gap in px
 * @param {Function} [keyFn] - Key extractor
 * @returns {Array<Object>}
 */
export function layoutTable (items, heights, columns = [], containerWidth = 800, gap = 0, keyFn) {
  const totalWidth = Array.isArray(columns) && columns.length > 0
    ? columns.reduce((sum, c) => sum + (c.width || 0), 0) + (gap * Math.max(0, columns.length - 1))
    : containerWidth

  const positions = new Array(items.length)
  let y = 0
  for (let i = 0; i < items.length; i++) {
    const rowHeight = heights[i]
    const k = getItemKey(items[i], keyFn, i)
    positions[i] = {
      key: k,
      x: 0,
      y,
      width: totalWidth,
      height: rowHeight,
      lane: 0
    }
    y += rowHeight + gap
  }
  return positions
}

/**
 * Computes dynamic lane count when lanes option is 'auto'.
 *
 * @param {number} containerWidth - Container width in px
 * @param {number} [laneWidth=280] - Preferred lane width in px
 * @param {number} [minLaneWidth=200] - Minimum lane width in px
 * @param {number} [maxLanes=6] - Maximum allowed lanes
 * @param {number} [gap=0] - Gap in px
 * @returns {number} Calculated lane count
 */
export function computeLaneCount (containerWidth, laneWidth = 280, minLaneWidth = 200, maxLanes = 6, gap = 0) {
  if (containerWidth <= 0) {
    return 1
  }
  const count = Math.floor((containerWidth + gap) / (laneWidth + gap))
  const fallbackCount = Math.floor((containerWidth + gap) / (minLaneWidth + gap)) || 1
  const calculated = count >= 1 ? count : fallbackCount
  return Math.max(1, Math.min(maxLanes, calculated))
}
