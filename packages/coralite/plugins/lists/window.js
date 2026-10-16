import { CoraliteError } from '../../lib/shared/errors.js'
import {
  computePositions,
  computeVisibleRange,
  computeScrollTopFromAnchor,
  reanchorOnRemove
} from './anchor.js'
import { createMeasurementCache } from './measurements.js'

const MAX_SAFE_HEIGHT = 33_000_000

/**
 * Binds a store to a container using windowed virtualization (`virtual: 'window'`).
 *
 * @param {Object} options - Bind options
 * @returns {{ destroy: () => void }} Handle with destroy method
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
    overscan = 5
  } = options

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

  const defaultSize = typeof size === 'number' && !Number.isNaN(size) && size > 0 ? size : 64
  const isDynamicMeasure = size === 'measure'

  // Verify container scrollability warning in development mode
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

  const measurements = createMeasurementCache(defaultSize)

  // Map of item key to HTMLElement
  const elementMap = new Map()

  let items = store.all()
  let positions = computePositions(items, key, measurements, defaultSize)

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
    // Default fallback viewport height
    return 600
  }

  function getScale () {
    const totalHeight = positions.length > 0
      ? positions[positions.length - 1].y + positions[positions.length - 1].height
      : 0
    return totalHeight > MAX_SAFE_HEIGHT ? MAX_SAFE_HEIGHT / totalHeight : 1
  }

  function createElementForItem (item) {
    const k = key(item)
    let el = elementMap.get(k)
    if (!el) {
      el = create(item)
      if (el) {
        elementMap.set(k, el)
      }
    }
    if (el && isDynamicMeasure) {
      measurements.observe(el, k, onRowResize)
    }
    return el
  }

  function onRowResize (resizedKey) {
    if (destroyed) {
      return
    }

    const oldPositions = positions
    positions = computePositions(items, key, measurements, defaultSize)

    // Check if resized item was above current anchor
    if (anchor) {
      const resizedIdx = oldPositions.findIndex((p) => p.key === resizedKey)
      const anchorIdx = oldPositions.findIndex((p) => p.key === anchor.key)

      if (resizedIdx !== -1 && anchorIdx !== -1 && resizedIdx < anchorIdx) {
        // Programmatically adjust container.scrollTop from anchor so visible content stays in place
        const derivedVirtualScrollTop = computeScrollTopFromAnchor(anchor, positions)
        const scale = getScale()
        container.scrollTop = derivedVirtualScrollTop * scale
      }
    }

    renderVisibleWindow()
  }

  function renderVisibleWindow () {
    if (destroyed) {
      return
    }

    const totalItems = items.length
    if (totalItems === 0) {
      // Unobserve and clear elements
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

    const totalHeight = positions[totalItems - 1].y + positions[totalItems - 1].height
    const scale = getScale()
    const virtualScrollTop = (container.scrollTop || 0) / scale
    const viewportHeight = getViewportHeight()

    const { startIndex, endIndex } = computeVisibleRange(
      positions,
      virtualScrollTop,
      viewportHeight,
      overscan
    )

    // Calculate Y_START and Y_END
    const yStart = positions[startIndex] ? positions[startIndex].y : 0
    const lastRenderedPos = positions[endIndex]
    const yEnd = lastRenderedPos ? lastRenderedPos.y + lastRenderedPos.height : 0

    // Set spacer heights scaled
    if (topSpacer) {
      topSpacer.style.height = `${yStart * scale}px`
    }
    if (bottomSpacer) {
      bottomSpacer.style.height = `${(totalHeight - yEnd) * scale}px`
    }

    // Identify keys in new visible range
    const visibleKeys = new Set()
    const newRenderedNodes = []

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
        newRenderedNodes.push(el)
      }
    }

    if (bottomSpacer) {
      newRenderedNodes.push(bottomSpacer)
    }

    // Clean up out-of-range elements from elementMap and measurements
    for (const [k, el] of elementMap.entries()) {
      if (!visibleKeys.has(k)) {
        if (isDynamicMeasure) {
          measurements.unobserve(el)
        }
        elementMap.delete(k)
      }
    }

    // Update DOM container
    container.replaceChildren(...newRenderedNodes)

    // Update anchor based on first rendered item in viewport
    if (positions[startIndex]) {
      anchor = {
        key: positions[startIndex].key,
        offset: virtualScrollTop - positions[startIndex].y
      }
    }
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

  // Initial calculation and render
  renderVisibleWindow()

  // Subscribe to store changes
  function handleStoreChange (change) {
    if (destroyed) {
      return
    }

    const oldPositions = positions
    items = store.all()
    positions = computePositions(items, key, measurements, defaultSize)

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
          anchor = reanchorOnRemove(removedKey, anchor, oldPositions)
          if (anchor) {
            const derivedVirtualScrollTop = computeScrollTopFromAnchor(anchor, positions)
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
  }

  const unsubscribe = store.subscribe(handleStoreChange)

  function destroy () {
    if (destroyed) {
      return
    }
    destroyed = true

    container.removeEventListener('scroll', onScroll)
    measurements.disconnect()

    if (container.style) {
      container.style.overflowAnchor = ''
    }

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

  return { destroy }
}
