import { CoraliteError } from '../../lib/shared/errors.js'
import {
  computePositions,
  computeVisibleRange,
  computeScrollTopFromAnchor,
  reanchorOnRemove
} from './anchor.js'
import { computeLaneCount } from './layouts.js'
import { createMeasurementCache } from './measurements.js'
import { setupInfiniteScroll } from './infinite.js'
import { groupItems, findTopVisibleGroup } from './groups.js'

const MAX_SAFE_HEIGHT = 33_000_000

/**
 * Binds a store to a container using windowed virtualization (`virtual: 'window'`).
 *
 * @param {Object} options - Bind options
 * @returns {{ destroy: () => void, scrollToKey: (key: string, options?: { align?: 'start'|'center'|'end'|'auto' }) => void, getAnchor: () => { key: string, offset: number }|null }} Handle with destroy and anchor methods
 */
export function bindWindow (options = {}) {
  const {
    container,
    store,
    key,
    create,
    update,
    signal,
    size = 64,
    overscan = 5,
    anchorTo = 'start',
    followOnAppend = false,
    scrollEndThreshold = 80,
    reachThreshold = 200,
    onReachStart,
    onReachEnd,
    layout = 'linear',
    lanes = 1,
    laneWidth = 280,
    minLaneWidth = 200,
    maxLanes = 6,
    gap = 0,
    columns = [],
    groupBy = null,
    createHeader = null,
    stickyGroups = false,
    headerHeight = 40
  } = options

  if (!['linear', 'grid', 'masonry', 'table'].includes(layout)) {
    throw new CoraliteError(`lists.bind: invalid layout option "${layout}". Expected "linear", "grid", "masonry", or "table".`)
  }

  if (lanes !== 'auto' && (typeof lanes !== 'number' || Number.isNaN(lanes) || lanes < 1)) {
    throw new CoraliteError(`lists.bind: invalid lanes option "${lanes}". Expected positive number or "auto".`)
  }

  if (followOnAppend && anchorTo === 'start' && process.env.NODE_ENV !== 'production') {
    console.warn('[Coralite lists] followOnAppend is only meaningful when anchorTo is "end".')
  }

  if (!container || typeof container !== 'object' || typeof container.replaceChildren !== 'function') {
    throw new CoraliteError('lists.bind: container must be a valid DOM element')
  }
  if (!store || typeof store !== 'object' || typeof store.subscribe !== 'function') {
    throw new CoraliteError('lists.bind: store must be a valid lists store instance')
  }
  if (typeof key !== 'function') {
    throw new CoraliteError('lists.bind: key must be a function (item) => string')
  }
  if (typeof create !== 'function') {
    throw new CoraliteError('lists.bind: create must be a function (item) => HTMLElement')
  }

  if (groupBy && typeof groupBy !== 'function') {
    throw new CoraliteError('lists.bind: groupBy option must be a function (item) => string | null | undefined')
  }
  if (groupBy && typeof createHeader !== 'function') {
    throw new CoraliteError('lists.bind: createHeader must be a function (groupKey, items) => HTMLElement when groupBy is set.')
  }

  if (
    typeof window !== 'undefined' &&
    typeof window.getComputedStyle === 'function' &&
    process.env.NODE_ENV !== 'production'
  ) {
    try {
      const computed = window.getComputedStyle(container)
      const overflow = computed.overflowY || computed.overflow
      if (overflow === 'visible') {
        console.warn(
          '[Coralite lists] Container does not have scrollable overflow. virtual: "window" mode requires container to have a defined height and scrollable overflow.'
        )
      }
    } catch {
      // ignore
    }
  }

  const defaultSize = typeof size === 'number' && !Number.isNaN(size) && size > 0 ? size : 64
  const isDynamicMeasure = size === 'measure'

  function getContainerWidth () {
    if (container.clientWidth && container.clientWidth > 0) {
      return container.clientWidth
    }
    if (
      typeof window !== 'undefined' &&
      typeof window.getComputedStyle === 'function'
    ) {
      try {
        const wVal = parseFloat(window.getComputedStyle(container).width)
        if (!Number.isNaN(wVal) && wVal > 0) {
          return wVal
        }
      } catch {
        // ignore
      }
    }
    return 800
  }

  function getLayoutOptions () {
    return {
      layout,
      lanes,
      laneWidth,
      minLaneWidth,
      maxLanes,
      gap,
      columns,
      headerHeight,
      containerWidth: getContainerWidth()
    }
  }

  const effectiveKey = (item) => {
    if (item && item.__header) {
      return item.key
    }
    return key(item)
  }

  function getCurrentSignature () {
    const w = getContainerWidth()
    const activeLanes = lanes === 'auto'
      ? computeLaneCount(w, laneWidth, minLaneWidth, maxLanes, gap)
      : Math.max(1, Number(lanes) || 1)
    const actualLaneWidth = (layout === 'grid' || layout === 'masonry')
      ? (w - (gap * (activeLanes - 1))) / activeLanes
      : laneWidth
    return `${activeLanes}:${Math.round(actualLaneWidth)}:${Math.round(w)}`
  }

  // Set position relative on container if non-linear layout
  if (layout !== 'linear' && container.style) {
    if (
      typeof window !== 'undefined' &&
      typeof window.getComputedStyle === 'function'
    ) {
      try {
        const pos = window.getComputedStyle(container).position
        if (pos === 'static') {
          container.style.position = 'relative'
        }
      } catch {
        container.style.position = 'relative'
      }
    } else {
      container.style.position = 'relative'
    }
  }

  // Set overflow-anchor: none on container
  if (container.style) {
    container.style.overflowAnchor = 'none'
  }

  // Create spacers
  const topSpacer = typeof document !== 'undefined' ? document.createElement('div') : null
  const bottomSpacer = typeof document !== 'undefined' ? document.createElement('div') : null
  if (topSpacer) {
    topSpacer.className = 'lists-spacer-top'
    topSpacer.style.height = '0px'
  }
  if (bottomSpacer) {
    bottomSpacer.className = 'lists-spacer-bottom'
    bottomSpacer.style.height = '0px'
  }

  const { topSentinel, bottomSentinel, disconnect: disconnectInfinite } = setupInfiniteScroll({
    container,
    onReachStart,
    onReachEnd,
    reachThreshold
  })

  const measurements = createMeasurementCache(defaultSize)

  // Map of item key to HTMLElement
  const elementMap = new Map()

  let rawItems = store.all()
  let { flatItems: items, groups } = groupItems(rawItems, groupBy)
  let positions = computePositions(items, effectiveKey, measurements, defaultSize, getLayoutOptions())

  // Windowed Sticky Header state
  let stickyHeaderEl = null
  let stickyGroupKey = null

  if (stickyGroups && groupBy && typeof document !== 'undefined') {
    stickyHeaderEl = document.createElement('div')
    stickyHeaderEl.setAttribute('data-lists-header', '')
    stickyHeaderEl.className = 'lists-sticky-header'
    stickyHeaderEl.setAttribute('class', 'lists-sticky-header')
    stickyHeaderEl.style.position = 'absolute'
    stickyHeaderEl.style.top = '0px'
    stickyHeaderEl.style.left = '0px'
    stickyHeaderEl.style.right = '0px'
    stickyHeaderEl.style.zIndex = '1'
  }

  // Position anchor { key, offset }
  let anchor = null
  let destroyed = false

  function getViewportHeight () {
    if (container.clientHeight && container.clientHeight > 0) {
      return container.clientHeight
    }
    if (
      typeof window !== 'undefined' &&
      typeof window.getComputedStyle === 'function'
    ) {
      try {
        const heightVal = parseFloat(window.getComputedStyle(container).height)
        if (!Number.isNaN(heightVal) && heightVal > 0) {
          return heightVal
        }
      } catch {
        // ignore
      }
    }
    return 600
  }

  function getTotalHeight () {
    if (positions.length === 0) {
      return 0
    }
    let max = 0
    for (let i = 0; i < positions.length; i++) {
      const bottom = positions[i].y + positions[i].height
      if (bottom > max) {
        max = bottom
      }
    }
    return max
  }

  function getScale () {
    const totalHeight = getTotalHeight()
    return totalHeight > MAX_SAFE_HEIGHT ? MAX_SAFE_HEIGHT / totalHeight : 1
  }

  function createElementForItem (item) {
    const k = effectiveKey(item)
    let el = elementMap.get(k)
    if (!el) {
      if (item && item.__header) {
        el = createHeader(item.groupKey, item.items)
        if (el) {
          el.setAttribute('data-lists-header', '')
        }
      } else {
        el = create.length > 1 ? create(item, { columns }) : create(item)
      }
      if (el) {
        elementMap.set(k, el)
      }
    }
    if (el && isDynamicMeasure) {
      measurements.observe(el, k, onRowResize, getCurrentSignature)
    }
    return el
  }

  function onRowResize (resizedKey) {
    if (destroyed) {
      return
    }

    const oldPositions = positions
    positions = computePositions(items, effectiveKey, measurements, defaultSize, getLayoutOptions())

    if (anchor) {
      const resizedIdx = oldPositions.findIndex((p) => p.key === resizedKey)
      const anchorIdx = oldPositions.findIndex((p) => p.key === anchor.key)

      const affectsAnchor = anchorTo === 'end'
        ? (resizedIdx !== -1 && anchorIdx !== -1 && resizedIdx > anchorIdx)
        : (resizedIdx !== -1 && anchorIdx !== -1 && resizedIdx < anchorIdx)

      if (affectsAnchor) {
        const viewportHeight = getViewportHeight()
        const derivedVirtualScrollTop = computeScrollTopFromAnchor(anchor, positions, anchorTo, viewportHeight)
        const scale = getScale()
        container.scrollTop = derivedVirtualScrollTop * scale
      }
    }

    renderVisibleWindow()
  }

  function shouldFollow () {
    const totalHeight = getTotalHeight()
    const scale = getScale()
    const viewportHeight = getViewportHeight()
    const distanceFromEnd = (totalHeight * scale) - container.scrollTop - viewportHeight
    return distanceFromEnd <= scrollEndThreshold
  }

  function renderVisibleWindow () {
    if (destroyed) {
      return
    }

    const totalItems = items.length
    if (totalItems === 0) {
      for (const [, el] of elementMap.entries()) {
        if (isDynamicMeasure) {
          measurements.unobserve(el)
        }
      }
      elementMap.clear()

      if (topSpacer && topSpacer.parentNode === container) {
        topSpacer.remove()
      }
      if (bottomSpacer && bottomSpacer.parentNode === container) {
        bottomSpacer.remove()
      }
      container.replaceChildren()
      return
    }

    const totalHeight = getTotalHeight()
    const scale = getScale()
    const virtualScrollTop = (container.scrollTop || 0) / scale
    const viewportHeight = getViewportHeight()

    const { startIndex, endIndex } = computeVisibleRange(
      positions,
      virtualScrollTop,
      viewportHeight,
      overscan
    )

    const yStart = positions[startIndex] ? positions[startIndex].y : 0
    const lastRenderedPos = positions[endIndex]
    const yEnd = lastRenderedPos ? lastRenderedPos.y + lastRenderedPos.height : 0

    if (layout === 'linear') {
      if (topSpacer) {
        topSpacer.style.height = `${yStart * scale}px`
      }
      if (bottomSpacer) {
        bottomSpacer.style.height = `${(totalHeight - yEnd) * scale}px`
      }
    } else {
      if (topSpacer) {
        topSpacer.style.height = '0px'
      }
      if (bottomSpacer) {
        bottomSpacer.style.height = `${totalHeight * scale}px`
      }
    }

    const visibleKeys = new Set()
    const newRenderedNodes = []

    if (topSentinel) {
      newRenderedNodes.push(topSentinel)
    }
    if (topSpacer) {
      newRenderedNodes.push(topSpacer)
    }

    for (let i = startIndex; i <= endIndex; i++) {
      const item = items[i]
      if (!item) {
        continue
      }
      const k = key(item)
      visibleKeys.add(k)

      const el = createElementForItem(item)
      if (el) {
        const pos = positions[i]
        if (pos && layout !== 'linear' && el.style) {
          el.style.position = 'absolute'
          el.style.left = `${pos.x}px`
          el.style.top = `${pos.y * scale}px`
          el.style.width = `${pos.width}px`
        }
        newRenderedNodes.push(el)
      }
    }

    if (bottomSpacer) {
      newRenderedNodes.push(bottomSpacer)
    }
    if (bottomSentinel) {
      newRenderedNodes.push(bottomSentinel)
    }

    if (stickyHeaderEl) {
      newRenderedNodes.push(stickyHeaderEl)
    }

    for (const [k, el] of elementMap.entries()) {
      if (!visibleKeys.has(k)) {
        if (isDynamicMeasure) {
          measurements.unobserve(el)
        }
        elementMap.delete(k)
      }
    }

    container.replaceChildren(...newRenderedNodes)

    updateStickyHeader(virtualScrollTop, scale)

    if (anchorTo === 'end') {
      const scrollBottom = virtualScrollTop + viewportHeight
      let anchorIdx = endIndex
      for (let i = startIndex; i <= endIndex; i++) {
        if (positions[i]) {
          const itemBottom = positions[i].y + positions[i].height
          if (itemBottom >= scrollBottom) {
            anchorIdx = i
            break
          }
        }
      }
      if (positions[anchorIdx]) {
        const anchorItem = positions[anchorIdx]
        const itemBottom = anchorItem.y + anchorItem.height
        anchor = {
          key: anchorItem.key,
          offset: scrollBottom - itemBottom
        }
      }
    } else {
      if (positions[startIndex]) {
        anchor = {
          key: positions[startIndex].key,
          offset: virtualScrollTop - positions[startIndex].y
        }
      }
    }
  }

  function updateStickyHeader (virtualScrollTop, scale) {
    if (!stickyHeaderEl || groups.length === 0) {
      return
    }

    const topVisible = findTopVisibleGroup(groups, positions, virtualScrollTop)
    if (!topVisible) {
      stickyHeaderEl.style.display = 'none'
      return
    }

    stickyHeaderEl.style.display = ''

    if (topVisible.groupKey !== stickyGroupKey) {
      stickyGroupKey = topVisible.groupKey
      stickyHeaderEl.replaceChildren(createHeader(stickyGroupKey, topVisible.items))
    }

    let measuredHeaderH = headerHeight
    if (topVisible.headerPos && topVisible.headerPos.height > 0) {
      measuredHeaderH = topVisible.headerPos.height
    } else if (stickyHeaderEl.clientHeight && stickyHeaderEl.clientHeight > 0) {
      measuredHeaderH = stickyHeaderEl.clientHeight
    }

    const nextGroupTopScaled = topVisible.nextGroupTop !== Infinity ? topVisible.nextGroupTop * scale : Infinity
    const currentScrollTop = container.scrollTop || 0

    const diff = nextGroupTopScaled - currentScrollTop - measuredHeaderH
    const stickyTop = Math.min(0, diff)

    stickyHeaderEl.style.transform = `translateY(${stickyTop}px)`
  }

  // Scroll listener throttled with requestAnimationFrame
  let pendingScroll = false
  function onScroll () {
    if (pendingScroll || destroyed) {
      return
    }
    pendingScroll = true
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        pendingScroll = false
        if (!destroyed) {
          renderVisibleWindow()
        }
      })
    } else {
      pendingScroll = false
      renderVisibleWindow()
    }
  }

  container.addEventListener('scroll', onScroll, { passive: true })

  // Container ResizeObserver for handling responsive container width changes
  let containerObserver = null
  let lastContainerWidth = getContainerWidth()

  if (typeof ResizeObserver !== 'undefined') {
    containerObserver = new ResizeObserver(() => {
      if (destroyed) {
        return
      }
      const newWidth = getContainerWidth()
      if (Math.abs(newWidth - lastContainerWidth) >= 1) {
        lastContainerWidth = newWidth
        positions = computePositions(items, effectiveKey, measurements, defaultSize, getLayoutOptions())
        if (anchor) {
          const viewportHeight = getViewportHeight()
          const derivedVirtualScrollTop = computeScrollTopFromAnchor(anchor, positions, anchorTo, viewportHeight)
          const scale = getScale()
          container.scrollTop = derivedVirtualScrollTop * scale
        }
        renderVisibleWindow()
      }
    })
    containerObserver.observe(container)
  }

  // Initial scroll position for anchorTo: 'end'
  if (anchorTo === 'end') {
    const totalHeight = getTotalHeight()
    const scale = getScale()
    const viewportHeight = getViewportHeight()
    container.scrollTop = Math.max(container.scrollHeight || 0, (totalHeight * scale) - viewportHeight)
  }

  // Initial calculation and render
  renderVisibleWindow()

  function handleStoreChange (change) {
    if (destroyed) {
      return
    }

    let mustFollow = false
    if ((change.type === 'append' || change.type === 'appendMany') && anchorTo === 'end' && followOnAppend) {
      mustFollow = shouldFollow()
    }

    const oldPositions = positions
    rawItems = store.all()
    const { flatItems: nextItems, groups: nextGroups } = groupItems(rawItems, groupBy)
    items = nextItems
    groups = nextGroups
    positions = computePositions(items, effectiveKey, measurements, defaultSize, getLayoutOptions())

    switch (change.type) {
      case 'update': {
        const k = change.id
        const el = elementMap.get(k)
        if (el && typeof update === 'function') {
          const newItem = store.get(k)
          if (newItem) {
            update(el, newItem)
          }
        }
        break
      }

      case 'remove': {
        const removedKey = change.id
        const oldEl = elementMap.get(removedKey)
        if (oldEl) {
          if (isDynamicMeasure) {
            measurements.unobserve(oldEl)
          }
          elementMap.delete(removedKey)
        }

        if (anchor && anchor.key === removedKey) {
          anchor = reanchorOnRemove(removedKey, anchor, oldPositions, anchorTo)
          if (anchor) {
            const viewportHeight = getViewportHeight()
            const derivedVirtualScrollTop = computeScrollTopFromAnchor(anchor, positions, anchorTo, viewportHeight)
            const scale = getScale()
            container.scrollTop = derivedVirtualScrollTop * scale
          } else {
            container.scrollTop = 0
          }
        }
        break
      }

      case 'clear': {
        anchor = null
        measurements.clear()
        break
      }
    }

    renderVisibleWindow()

    if (mustFollow) {
      const newTotalHeight = getTotalHeight()
      const scale = getScale()
      const viewportHeight = getViewportHeight()
      const targetScrollTop = Math.max(0, (newTotalHeight * scale) - viewportHeight)

      if (followOnAppend === 'smooth' && typeof container.scrollTo === 'function') {
        container.scrollTo({
          top: targetScrollTop,
          behavior: 'smooth'
        })
      } else {
        container.scrollTop = targetScrollTop
      }
    }
  }

  const unsubscribe = store.subscribe(handleStoreChange)

  function scrollToKey (keyToScroll, { align = 'auto' } = {}) {
    if (destroyed) {
      return
    }

    const viewportHeight = getViewportHeight()

    for (let i = 0; i < 2; i++) {
      const pos = positions.find((p) => p.key === keyToScroll)
      if (!pos) {
        return
      }

      const scale = getScale()
      const currentVirtualScrollTop = (container.scrollTop || 0) / scale

      let effectiveAlign = align
      if (align === 'auto') {
        const itemTop = pos.y
        const itemBottom = pos.y + pos.height
        const vTop = currentVirtualScrollTop
        const vBottom = vTop + viewportHeight

        if (itemTop >= vTop && itemBottom <= vBottom) {
          return
        }
        if (itemTop < vTop) {
          effectiveAlign = 'start'
        } else {
          effectiveAlign = 'end'
        }
      }

      let targetVirtual = 0
      if (effectiveAlign === 'start') {
        targetVirtual = pos.y
      } else if (effectiveAlign === 'center') {
        targetVirtual = (pos.y + (pos.height / 2)) - (viewportHeight / 2)
      } else if (effectiveAlign === 'end') {
        targetVirtual = (pos.y + pos.height) - viewportHeight
      }

      const targetScrollTop = Math.max(0, targetVirtual * scale)
      container.scrollTop = targetScrollTop
      renderVisibleWindow()
    }
  }

  function getAnchor () {
    return anchor ? {
      key: anchor.key,
      offset: anchor.offset
    } : null
  }

  function destroy () {
    if (destroyed) {
      return
    }
    destroyed = true

    container.removeEventListener('scroll', onScroll)
    if (containerObserver) {
      containerObserver.disconnect()
      containerObserver = null
    }
    measurements.disconnect()
    disconnectInfinite()

    if (container.style) {
      container.style.overflowAnchor = ''
      if (layout !== 'linear') {
        container.style.position = ''
      }
    }

    if (stickyHeaderEl && stickyHeaderEl.parentNode === container) {
      stickyHeaderEl.remove()
    }
    stickyHeaderEl = null

    if (topSpacer && topSpacer.parentNode === container) {
      topSpacer.remove()
    }
    if (bottomSpacer && bottomSpacer.parentNode === container) {
      bottomSpacer.remove()
    }

    unsubscribe()
  }

  if (signal && typeof signal.addEventListener === 'function') {
    if (signal.aborted) {
      destroy()
    } else {
      signal.addEventListener('abort', destroy, { once: true })
    }
  }

  return {
    destroy,
    scrollToKey,
    getAnchor
  }
}
