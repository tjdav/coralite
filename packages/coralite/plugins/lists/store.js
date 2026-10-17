import { createSignal } from '../../lib/shared/signals.js'
import { CoraliteError } from '../../lib/shared/errors.js'

/**
 * Creates a signal-backed keyed store for list data.
 *
 * @param {Object} options - Store options
 * @param {Function|string} [options.key] - Function `(item) => key` or property string
 * @param {Array} [options.initial=[]] - Initial items array
 * @returns {Object} Keyed store instance
 */
export function createStore ({ key = (item) => item?.id, initial = [] } = {}) {
  const getKey = typeof key === 'function' ? key : (item) => item?.[key]

  if (typeof getKey !== 'function') {
    throw new CoraliteError('lists.createStore: key option must be a function or string property name')
  }

  const itemsMap = new Map()
  const itemsArray = []
  const subscribers = new Set()
  const versionSignal = createSignal(0)

  function notifySubscribers (descriptor) {
    versionSignal.value++
    const subs = Array.from(subscribers)
    for (const sub of subs) {
      try {
        sub(descriptor)
      } catch (err) {
        console.error('Error in lists store subscriber:', err)
      }
    }
  }

  function addItemInternal (item, position = 'end') {
    const k = getKey(item)
    // eslint-disable-next-line eqeqeq -- intentionally matches null and undefined
    if (k == null) {
      throw new CoraliteError('lists.createStore: Item is missing a valid key')
    }

    if (itemsMap.has(k)) {
      // If already present, update existing location or replace
      const idx = itemsArray.findIndex((it) => getKey(it) === k)
      if (idx !== -1) {
        itemsArray.splice(idx, 1)
      }
    }

    itemsMap.set(k, item)
    if (position === 'start') {
      itemsArray.unshift(item)
    } else {
      itemsArray.push(item)
    }
  }

  // Populate initial items
  if (Array.isArray(initial)) {
    for (const item of initial) {
      addItemInternal(item, 'end')
    }
  }

  const store = {
    getKey,

    append (item) {
      addItemInternal(item, 'end')
      notifySubscribers({
        type: 'append',
        items: [item]
      })
      return item
    },

    prepend (item) {
      addItemInternal(item, 'start')
      notifySubscribers({
        type: 'prepend',
        items: [item]
      })
      return item
    },

    appendMany (items = []) {
      if (!Array.isArray(items) || items.length === 0) {
        return
      }
      for (const item of items) {
        addItemInternal(item, 'end')
      }
      notifySubscribers({
        type: 'append',
        items: [...items]
      })
    },

    prependMany (items = []) {
      if (!Array.isArray(items) || items.length === 0) {
        return
      }
      // Prepend in reverse so the original order of `items` is preserved at start
      for (let i = items.length - 1; i >= 0; i--) {
        addItemInternal(items[i], 'start')
      }
      notifySubscribers({
        type: 'prepend',
        items: [...items]
      })
    },

    update (id, patch) {
      if (!itemsMap.has(id)) {
        return undefined
      }

      const oldItem = itemsMap.get(id)
      let newItem
      if (typeof patch === 'function') {
        newItem = patch(oldItem)
      } else if (typeof patch === 'object' && patch !== null) {
        newItem = {
          ...oldItem,
          ...patch
        }
      } else {
        newItem = patch
      }

      itemsMap.set(id, newItem)
      const idx = itemsArray.findIndex((it) => getKey(it) === id)
      if (idx !== -1) {
        itemsArray[idx] = newItem
      }

      notifySubscribers({
        type: 'update',
        id,
        patch
      })
      return newItem
    },

    remove (id) {
      if (!itemsMap.has(id)) {
        return false
      }

      itemsMap.delete(id)
      const idx = itemsArray.findIndex((it) => getKey(it) === id)
      if (idx !== -1) {
        itemsArray.splice(idx, 1)
      }

      notifySubscribers({
        type: 'remove',
        id
      })
      return true
    },

    set (items = []) {
      itemsMap.clear()
      itemsArray.length = 0
      if (Array.isArray(items)) {
        for (const item of items) {
          addItemInternal(item, 'end')
        }
      }
      notifySubscribers({
        type: 'set',
        items: [...itemsArray]
      })
    },

    swap (idA, idB) {
      if (idA === idB) {
        return false
      }
      if (!itemsMap.has(idA) || !itemsMap.has(idB)) {
        return false
      }
      const idxA = itemsArray.findIndex((it) => getKey(it) === idA)
      const idxB = itemsArray.findIndex((it) => getKey(it) === idB)
      if (idxA === -1 || idxB === -1) {
        return false
      }

      const temp = itemsArray[idxA]
      itemsArray[idxA] = itemsArray[idxB]
      itemsArray[idxB] = temp

      notifySubscribers({
        type: 'swap',
        idA,
        idB
      })
      return true
    },

    get (id) {
      // Track reactivity
      void versionSignal.value
      return itemsMap.get(id)
    },

    all () {
      // Track reactivity
      void versionSignal.value
      return [...itemsArray]
    },

    get size () {
      // Track reactivity
      void versionSignal.value
      return itemsArray.length
    },

    clear () {
      if (itemsArray.length === 0) {
        return
      }
      itemsMap.clear()
      itemsArray.length = 0
      notifySubscribers({
        type: 'clear'
      })
    },

    subscribe (callback) {
      if (typeof callback !== 'function') {
        throw new CoraliteError('lists.createStore subscribe: callback must be a function')
      }
      subscribers.add(callback)
      return () => {
        subscribers.delete(callback)
      }
    }
  }

  return store
}
