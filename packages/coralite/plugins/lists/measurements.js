/**
 * Measurement cache and per-row ResizeObserver wiring for virtual lists.
 */

/**
 * Creates a measurement cache that manages item height measurements.
 *
 * @param {number} defaultSize - Default estimated item height
 * @returns {Object} Measurement cache instance
 */
export function createMeasurementCache (defaultSize = 64) {
  const cache = new Map()
  let observer = null
  // Map of observed element to item key
  const observedElements = new Map()

  /**
   * Initializes or gets the shared ResizeObserver.
   *
   * @param {Function} onResize - Callback invoked when an observed row resizes: (key, newHeight, oldHeight) => void
   */
  function initObserver (onResize) {
    if (observer || typeof ResizeObserver === 'undefined') {
      return
    }

    observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const key = observedElements.get(entry.target)
        if (!key) {
          continue
        }

        let height = 0
        if (entry.borderBoxSize && entry.borderBoxSize.length > 0) {
          height = entry.borderBoxSize[0].blockSize
        } else if (entry.contentRect) {
          height = entry.contentRect.height
        } else if (entry.target && typeof entry.target.getBoundingClientRect === 'function') {
          height = entry.target.getBoundingClientRect().height
        }

        if (typeof height === 'number' && height > 0) {
          const oldHeight = cache.get(key)
          if (oldHeight !== height) {
            cache.set(key, height)
            if (typeof onResize === 'function') {
              onResize(key, height, oldHeight)
            }
          }
        }
      }
    })
  }

  return {
    get (key) {
      return cache.get(key) ?? defaultSize
    },

    has (key) {
      return cache.has(key)
    },

    set (key, height) {
      cache.set(key, height)
    },

    delete (key) {
      cache.delete(key)
    },

    clear () {
      cache.clear()
    },

    observe (element, key, onResize) {
      if (!element || typeof element !== 'object') {
        return
      }

      initObserver(onResize)
      if (observer) {
        observedElements.set(element, key)
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
