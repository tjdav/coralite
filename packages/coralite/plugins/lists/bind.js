import { CoraliteError } from '../../lib/shared/errors.js'

/**
 * Binds a keyed store to a DOM container element.
 *
 * @param {any} [options={}] - Bind options
 * @returns {{ destroy: () => void }} Binding handle
 */
export function bind (options = {}) {
  const opts = options || {}
  if (opts.virtual) {
    throw new CoraliteError('Virtualization is not yet supported in this version of the lists plugin.')
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

  function createElementForItem (item) {
    const k = key(item)
    const el = create(item)
    if (el) {
      elementMap.set(k, el)
    }
    return el
  }

  // Initial render: render all items via DocumentFragment
  const initialItems = store.all()
  if (typeof document !== 'undefined') {
    const fragment = document.createDocumentFragment()
    for (const item of initialItems) {
      const el = createElementForItem(item)
      if (el) {
        fragment.appendChild(el)
      }
    }
    container.replaceChildren(fragment)
  }

  function handleStoreChange (change) {
    switch (change.type) {
      case 'append': {
        for (const item of change.items) {
          const el = createElementForItem(item)
          if (el) {
            container.appendChild(el)
          }
        }
        break
      }

      case 'prepend': {
        // Prepend items in order before firstChild
        for (let i = change.items.length - 1; i >= 0; i--) {
          const item = change.items[i]
          const el = createElementForItem(item)
          if (el) {
            container.insertBefore(el, container.firstChild)
          }
        }
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
        }
        break
      }

      case 'clear': {
        elementMap.clear()
        container.replaceChildren()
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
