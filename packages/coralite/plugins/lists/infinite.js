/**
 * Sentinel element creation and IntersectionObserver setup for infinite scroll reach callbacks.
 */

/**
 * Sets up infinite scroll sentinels and IntersectionObserver for reach callbacks.
 *
 * @param {Object} options - Infinite scroll options
 * @param {HTMLElement} options.container - Scroll container
 * @param {Function} [options.onReachStart] - Callback when reaching start of list
 * @param {Function} [options.onReachEnd] - Callback when reaching end of list
 * @param {number} [options.reachThreshold=200] - Distance in px to trigger reach callbacks
 * @returns {{ topSentinel: HTMLElement|null, bottomSentinel: HTMLElement|null, disconnect: () => void }} Infinite handle
 */
export function setupInfiniteScroll ({ container, onReachStart, onReachEnd, reachThreshold = 200 }) {
  if (
    typeof document === 'undefined' ||
    typeof IntersectionObserver === 'undefined' ||
    (!onReachStart && !onReachEnd)
  ) {
    return {
      topSentinel: null,
      bottomSentinel: null,
      disconnect: () => {
      }
    }
  }

  const topSentinel = onReachStart ? document.createElement('div') : null
  if (topSentinel) {
    topSentinel.className = 'lists-sentinel-top'
  }

  const bottomSentinel = onReachEnd ? document.createElement('div') : null
  if (bottomSentinel) {
    bottomSentinel.className = 'lists-sentinel-bottom'
  }

  let observer = null

  try {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue
          }
          if (entry.target === topSentinel && typeof onReachStart === 'function') {
            try {
              onReachStart()
            } catch (err) {
              if (process.env.NODE_ENV !== 'production') {
                console.error('[Coralite lists] Error in onReachStart callback:', err)
              }
            }
          } else if (entry.target === bottomSentinel && typeof onReachEnd === 'function') {
            try {
              onReachEnd()
            } catch (err) {
              if (process.env.NODE_ENV !== 'production') {
                console.error('[Coralite lists] Error in onReachEnd callback:', err)
              }
            }
          }
        }
      },
      {
        root: container,
        rootMargin: `${reachThreshold}px 0px`
      }
    )

    if (topSentinel) {
      observer.observe(topSentinel)
    }
    if (bottomSentinel) {
      observer.observe(bottomSentinel)
    }
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[Coralite lists] Failed to initialize IntersectionObserver:', err)
    }
  }

  function disconnect () {
    if (observer) {
      observer.disconnect()
      observer = null
    }
  }

  return {
    topSentinel,
    bottomSentinel,
    disconnect
  }
}
