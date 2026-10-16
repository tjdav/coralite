/**
 * Measurement cache and per-row ResizeObserver wiring for virtual lists.
 * Keyed by (itemKey, layoutSignature).
 */

/**
 * Creates a measurement cache that manages item height measurements per layout signature.
 *
 * @param {number} defaultSize - Default estimated item height
 * @returns {Object} Measurement cache instance
 */
export function createMeasurementCache (defaultSize = 64) {
  // Map of itemKey -> Map<layoutSignature, height>
  const cache = new Map()
  let observer = null
  // Map of observed element to { key, getSignature }
  const observedElements = new Map()

  /**
   * Initializes or gets the shared ResizeObserver.
   *
   * @param {Function} onResize - Callback invoked when an observed row resizes: (key, newHeight, oldHeight, signature) => void
   */
  function initObserver (onResize) {
    if (observer || typeof ResizeObserver === 'undefined') {
      return
    }

    observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const info = observedElements.get(entry.target)
        if (!info) {
          continue
        }

        const { key, getSignature } = info
        const signature = typeof getSignature === 'function' ? getSignature() : 'default'

        let height = 0
        if (entry.borderBoxSize && entry.borderBoxSize.length > 0) {
          height = entry.borderBoxSize[0].blockSize
        } else if (entry.contentRect) {
          height = entry.contentRect.height
        } else if (entry.target && typeof entry.target.getBoundingClientRect === 'function') {
          height = entry.target.getBoundingClientRect().height
        }

        if (typeof height === 'number' && height > 0) {
          const itemMap = cache.get(key)
          const oldHeight = itemMap ? itemMap.get(signature) : undefined
          if (oldHeight !== height) {
            if (!itemMap) {
              const newMap = new Map()
              newMap.set(signature, height)
              cache.set(key, newMap)
            } else {
              itemMap.set(signature, height)
            }
            if (typeof onResize === 'function') {
              onResize(key, height, oldHeight, signature)
            }
          }
        }
      }
    })
  }

  return {
    get (key, signature = 'default') {
      const itemMap = cache.get(key)
      if (!itemMap) {
        return defaultSize
      }
      return itemMap.get(signature) ?? defaultSize
    },

    has (key, signature) {
      const itemMap = cache.get(key)
      if (!itemMap) {
        return false
      }
      if (signature !== undefined) {
        return itemMap.has(signature)
      }
      return itemMap.size > 0
    },

    set (key, signatureOrHeight, heightVal) {
      let sig = 'default'
      let val = defaultSize

      if (heightVal !== undefined) {
        sig = signatureOrHeight
        val = heightVal
      } else if (typeof signatureOrHeight === 'number') {
        val = signatureOrHeight
      } else {
        sig = signatureOrHeight
      }

      let itemMap = cache.get(key)
      if (!itemMap) {
        itemMap = new Map()
        cache.set(key, itemMap)
      }
      itemMap.set(sig, val)
    },

    delete (key, signature) {
      if (signature !== undefined) {
        const itemMap = cache.get(key)
        if (itemMap) {
          itemMap.delete(signature)
          if (itemMap.size === 0) {
            cache.delete(key)
          }
        }
      } else {
        cache.delete(key)
      }
    },

    clear () {
      cache.clear()
    },

    observe (element, key, onResize, getSignature) {
      if (!element || typeof element !== 'object') {
        return
      }

      initObserver(onResize)
      if (observer) {
        observedElements.set(element, {
          key,
          getSignature
        })
        observer.observe(element)
      }
    },

    unobserve (element) {
      if (!element) {
        return
      }

      if (observer) {
        observer.unobserve(element)
      }
      observedElements.delete(element)
    },

    disconnect () {
      if (observer) {
        observer.disconnect()
        observer = null
      }
      observedElements.clear()
    }
  }
}
