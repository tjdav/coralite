/**
 * Helper utilities for list grouping and sticky group headers.
 */

/**
 * Groups a flat array of items using a `groupBy` function.
 * Preserves first-appearance order for group keys and original store order for items within each group.
 * Ungrouped items (where groupBy returns null or undefined) are rendered after all groups.
 *
 * @param {Array<any>} items - Store items array
 * @param {Function} [groupBy] - Item grouping function (item) => string | null | undefined
 * @returns {{ flatItems: Array<any>, groups: Array<{ key: string, groupKey: string, __header: true, items: Array<any> }> }}
 */
export function groupItems (items = [], groupBy = null) {
  if (typeof groupBy !== 'function' || !Array.isArray(items) || items.length === 0) {
    return {
      flatItems: Array.isArray(items) ? [...items] : [],
      groups: []
    }
  }

  const groupsMap = new Map()
  const ungrouped = []

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const gk = groupBy(item)

    // eslint-disable-next-line eqeqeq -- null or undefined means item is ungrouped
    if (gk == null) {
      ungrouped.push(item)
    } else {
      const stringKey = String(gk)
      let groupObj = groupsMap.get(stringKey)
      if (!groupObj) {
        groupObj = {
          key: `__header__${stringKey}`,
          groupKey: stringKey,
          __header: true,
          items: []
        }
        groupsMap.set(stringKey, groupObj)
      }
      groupObj.items.push(item)
    }
  }

  const groupsList = Array.from(groupsMap.values())
  const flatItems = []

  for (let g = 0; g < groupsList.length; g++) {
    const groupObj = groupsList[g]
    flatItems.push(groupObj)
    for (let j = 0; j < groupObj.items.length; j++) {
      flatItems.push(groupObj.items[j])
    }
  }

  for (let u = 0; u < ungrouped.length; u++) {
    flatItems.push(ungrouped[u])
  }

  return {
    flatItems,
    groups: groupsList
  }
}

/**
 * Finds the topmost visible group given current virtual scrollTop and positions array.
 *
 * @param {Array<Object>} groups - List of group objects
 * @param {Array<Object>} positions - Position calculations array
 * @param {number} virtualScrollTop - Virtual scroll top coordinate
 * @returns {{ groupKey: string, items: Array<any>, headerPos: Object, nextGroupTop: number }|null} Topmost visible group info
 */
export function findTopVisibleGroup (groups, positions, virtualScrollTop) {
  if (!groups || groups.length === 0 || !positions || positions.length === 0) {
    return null
  }

  const vTop = Math.max(0, virtualScrollTop)

  for (let g = 0; g < groups.length; g++) {
    const groupObj = groups[g]
    const headerKey = groupObj.key
    const headerPosIndex = positions.findIndex((p) => p.key === headerKey)
    if (headerPosIndex === -1) {
      continue
    }

    const headerPos = positions[headerPosIndex]

    let nextGroupTop = Infinity
    if (g + 1 < groups.length) {
      const nextHeaderKey = groups[g + 1].key
      const nextHeaderPos = positions.find((p) => p.key === nextHeaderKey)
      if (nextHeaderPos) {
        nextGroupTop = nextHeaderPos.y
      }
    }

    let groupBottom = nextGroupTop
    if (groupBottom === Infinity) {
      let maxBottom = headerPos.y + headerPos.height
      for (let p = headerPosIndex + 1; p < positions.length; p++) {
        const pos = positions[p]
        if (pos.y + pos.height > maxBottom) {
          maxBottom = pos.y + pos.height
        }
      }
      groupBottom = maxBottom
    }

    if (vTop < groupBottom || g === groups.length - 1) {
      return {
        groupKey: groupObj.groupKey,
        items: groupObj.items,
        headerPos,
        nextGroupTop
      }
    }
  }

  return null
}
