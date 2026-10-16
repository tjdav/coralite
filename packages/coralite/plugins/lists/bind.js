import { CoraliteError } from '../../lib/shared/errors.js'
import { computePositions } from './anchor.js'
import { bindWindow } from './window.js'

/**
 * Binds a keyed store to a DOM container element.
 *
 * @param {any} [options={}] - Bind options
 * @returns {{ destroy: () => void }} Binding handle
 */
export function bind (options = {}) {
  const opts = options || {}
  const {
    virtual = false,
    size = 64,
    layout = 'linear',
    lanes = 1,
    laneWidth = 280,
    minLaneWidth = 200,
    maxLanes = 6,
    gap = 0,
    columns = []
  } = opts

  if (!['linear', 'grid', 'masonry', 'table'].includes(layout)) {
    throw new CoraliteError(`lists.bind: invalid layout option "${layout}". Expected "linear", "grid", "masonry", or "table".`)
  }

  if (lanes !== 'auto' && (typeof lanes !== 'number' || Number.isNaN(lanes) || lanes < 1)) {
    throw new CoraliteError(`lists.bind: invalid lanes option "${lanes}". Expected positive number or "auto".`)
  }

  if (virtual === 'window') {
    return bindWindow(opts)
  }
  if (virtual !== false && virtual !== 'auto') {
    throw new CoraliteError(
      `lists.bind: invalid virtual option "${virtual}". Expected false, "auto", or "window".`
    )
  }
  if (opts.direction) {
    throw new CoraliteError('Direction configuration is not yet supported in this version of the lists plugin.')
  }
  if (opts.groupBy) {
    throw new CoraliteError('Grouping (groupBy) is not yet supported in this version of the lists plugin.')
  }
  if (opts.onReachStart || opts.onReachEnd) {
    throw new CoraliteError('Infinite scroll callbacks (onReachStart / onReachEnd) are not yet supported in this version of the lists plugin.')
  }

  const { container, store, key, create, update, signal } = opts

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

  const elementMap = new Map()

  let intrinsicSize = 64
  if (typeof size === 'number' && !Number.isNaN(size) && size > 0) {
    intrinsicSize = size
  } else if (size === 'measure') {
    intrinsicSize = 64
  }

  const isAutoVirtual = virtual === 'auto'
  const isNonLinear = layout !== 'linear'

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
      containerWidth: getContainerWidth()
    }
  }

  if (isNonLinear && container.style) {
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

  if (isAutoVirtual) {
    if (container.style) {
      container.style.contain = 'layout style'
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
            '[Coralite lists] Container does not have scrollable overflow. content-visibility: auto may have no effect.'
          )
        }
      } catch {
        // ignore computed style evaluation errors in non-browser/mock envs
      }
    }
  }

  let items = store.all()
  let positions = isNonLinear ? computePositions(items, key, null, intrinsicSize, getLayoutOptions()) : []

  function updateContainerHeight () {
    if (isNonLinear && container.style) {
      let max = 0
      for (let i = 0; i < positions.length; i++) {
        const bottom = positions[i].y + positions[i].height
        if (bottom > max) {
          max = bottom
        }
      }
      container.style.height = `${max}px`
    }
  }

  function applyPositioning (el, k) {
    if (isNonLinear && el && el.style) {
      const pos = positions.find((p) => p.key === k)
      if (pos) {
        el.style.position = 'absolute'
        el.style.left = `${pos.x}px`
        el.style.top = `${pos.y}px`
        el.style.width = `${pos.width}px`
      }
    }
  }

  function createElementForItem (item) {
    const k = key(item)
    const el = create.length > 1 ? create(item, { columns }) : create(item)
    if (el) {
      if (isAutoVirtual && el.style) {
        el.style.contentVisibility = 'auto'
        el.style.containIntrinsicSize = `auto ${intrinsicSize}px`
      }
      applyPositioning(el, k)
      elementMap.set(k, el)
    }
    return el
  }

  // Initial render: render all items via DocumentFragment
  if (typeof document !== 'undefined') {
    const fragment = document.createDocumentFragment()
    for (const item of items) {
      const el = createElementForItem(item)
      if (el) {
        fragment.appendChild(el)
      }
    }
    container.replaceChildren(fragment)
    updateContainerHeight()
  }

  function recomputeNonLinear () {
    if (isNonLinear) {
      positions = computePositions(items, key, null, intrinsicSize, getLayoutOptions())
      updateContainerHeight()
      for (const [k, el] of elementMap.entries()) {
        applyPositioning(el, k)
      }
    }
  }

  let containerObserver = null
  let lastWidth = getContainerWidth()

  if (isNonLinear && typeof ResizeObserver !== 'undefined') {
    containerObserver = new ResizeObserver(() => {
      const w = getContainerWidth()
      if (Math.abs(w - lastWidth) >= 1) {
        lastWidth = w
        recomputeNonLinear()
      }
    })
    containerObserver.observe(container)
  }

  function handleStoreChange (change) {
    items = store.all()
    if (isNonLinear) {
      positions = computePositions(items, key, null, intrinsicSize, getLayoutOptions())
      updateContainerHeight()
    }

    switch (change.type) {
      case 'append': {
        for (const item of change.items) {
          const el = createElementForItem(item)
          if (el) {
            container.appendChild(el)
          }
        }
        recomputeNonLinear()
        break
      }

      case 'prepend': {
        for (let i = change.items.length - 1; i >= 0; i--) {
          const item = change.items[i]
          const el = createElementForItem(item)
          if (el) {
            container.insertBefore(el, container.firstChild)
          }
        }
        recomputeNonLinear()
        break
      }

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
        const k = change.id
        const el = elementMap.get(k)
        if (el) {
          elementMap.delete(k)
          if (typeof el.remove === 'function') {
            el.remove()
          } else if (el.parentNode) {
            el.parentNode.removeChild(el)
          }
        }
        recomputeNonLinear()
        break
      }

      case 'set': {
        elementMap.clear()
        if (typeof document !== 'undefined') {
          const fragment = document.createDocumentFragment()
          for (const item of change.items) {
            const el = createElementForItem(item)
            if (el) {
              fragment.appendChild(el)
            }
          }
          container.replaceChildren(fragment)
          updateContainerHeight()
        }
        break
      }

      case 'clear': {
        elementMap.clear()
        container.replaceChildren()
        updateContainerHeight()
        break
      }
    }
  }

  const unsubscribe = store.subscribe(handleStoreChange)
  let destroyed = false

  function destroy () {
    if (destroyed) {
      return
    }
    destroyed = true
    unsubscribe()

    if (containerObserver) {
      containerObserver.disconnect()
      containerObserver = null
    }

    if (isAutoVirtual) {
      if (container.style) {
        container.style.contain = ''
      }
      for (const el of elementMap.values()) {
        if (el && el.style) {
          el.style.contentVisibility = ''
          el.style.containIntrinsicSize = ''
        }
      }
    }

    if (isNonLinear && container.style) {
      container.style.position = ''
      container.style.height = ''
    }

    elementMap.clear()
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
