// Module-scoped private registry (Garbage-collection safe)
import { isDevRuntime } from '../../utils/dev-mode.js'

const registeredComponents = new Set()
const eventLog = []
const MAX_EVENTS = 100

/**
 *
 */
export function registerDevToolsComponent (id) {
  if (isDevRuntime()) {
    registeredComponents.add(id)
  }
}

/**
 *
 */
export function recordDevToolsEvent (event) {
  if (isDevRuntime()) {
    if (eventLog.length >= MAX_EVENTS) {
      eventLog.shift()
    }
    eventLog.push(event)
  }
}

/**
 *
 */
/**
 * Helper to construct the ready promise for window.__coralite_test__
 */
function getReadyPromise () {
  if (typeof document === 'undefined') {
    return Promise.resolve()
  }

  const isDocReady = () => document.documentElement.hasAttribute('data-coralite-ready')
  const docReadyPromise = isDocReady()
    ? Promise.resolve()
    : new Promise(resolve => {
      const observer = new MutationObserver(() => {
        if (isDocReady()) {
          observer.disconnect()
          resolve()
        }
      })
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-coralite-ready']
      })
    })

  // @ts-ignore
  const lifecycle = typeof window !== 'undefined' && window.__coralite__?.lifecycle
  const lifecyclePromise = lifecycle?.hydrated ? lifecycle.hydrated : Promise.resolve()

  return Promise.all([docReadyPromise, lifecyclePromise]).then(() => {
  })
}

/**
 *
 */
export function setupDevTools () {
  if (isDevRuntime()) {
    if (typeof window === 'undefined' || (window['__coralite__'] && window['__coralite__'].getRegisteredComponents)) {
      return
    }

    // Preserve existing lifecycle and mode if created by SSR readiness script
    const existingLifecycle = window['__coralite__']?.lifecycle
    // @ts-ignore
    const currentMode = window['__coralite__']?.mode || (typeof import.meta.env !== 'undefined' && import.meta.env ? import.meta.env.MODE : 'development')

    const devtoolsAPI = {
      version: '1.0.0',
      mode: currentMode,

      get lifecycle () {
        return existingLifecycle || null
      },

      // Instance queries
      getComponent (element) {
        if (!element || !(element instanceof HTMLElement)) {
          return null
        }
        return element[Symbol.for('coralite.testing')] || null
      },

      // Global state metrics
      getRegisteredComponents () {
        return Array.from(registeredComponents)
      },

      getHydratedCount () {
        return existingLifecycle ? existingLifecycle._hc : 0
      },

      getInstances (tagName) {
        if (tagName) {
          const lower = tagName.toLowerCase()
          if (!registeredComponents.has(lower)) {
            return []
          }
          return Array.from(document.querySelectorAll(lower))
        }
        const selectors = Array.from(registeredComponents).join(',')
        if (!selectors) {
          return []
        }
        return Array.from(document.querySelectorAll(selectors))
      },

      getEvents () {
        return Array.from(eventLog)
      },

      get stylesLoaded () {
        // @ts-ignore
        return Array.from(window.__coralite_styles_loaded__ || [])
      }
    }

    // Attach to window using non-enumerable descriptor to prevent global key pollution
    Object.defineProperty(window, '__coralite__', {
      value: devtoolsAPI,
      writable: false,
      configurable: true,
      enumerable: false
    })

    // @ts-ignore
    if (currentMode === 'testing' && typeof window !== 'undefined' && !window.__coralite_test__) {
      const testAPI = {
        get ready () {
          return getReadyPromise()
        },
        async reset () {
          try {
            if (typeof localStorage !== 'undefined' && localStorage.clear) {
              localStorage.clear()
            }
          } catch {
          }

          try {
            if (typeof sessionStorage !== 'undefined' && sessionStorage.clear) {
              sessionStorage.clear()
            }
          } catch {
          }

          try {
            if (typeof indexedDB !== 'undefined' && typeof indexedDB.databases === 'function') {
              const dbs = await indexedDB.databases()
              if (Array.isArray(dbs)) {
                await Promise.all(
                  dbs.map(db => {
                    if (db && db.name) {
                      return new Promise(resolve => {
                        const req = indexedDB.deleteDatabase(db.name)
                        req.onsuccess = () => resolve()
                        req.onerror = () => resolve()
                        req.onblocked = () => resolve()
                      })
                    }
                    return Promise.resolve()
                  })
                )
              }
            }
          } catch {
          }

          try {
            if (typeof navigator !== 'undefined' && navigator.serviceWorker && typeof navigator.serviceWorker.getRegistrations === 'function') {
              const registrations = await navigator.serviceWorker.getRegistrations()
              if (Array.isArray(registrations)) {
                await Promise.all(
                  registrations.map(reg => (reg && typeof reg.unregister === 'function' ? reg.unregister().catch(() => {
                  }) : Promise.resolve()))
                )
              }
            }
          } catch {
          }
        },
        async flush () {
          while (true) {
            const instances = devtoolsAPI.getInstances()
            const promises = []
            for (const el of instances) {
              if (el && typeof el.updateComplete !== 'undefined') {
                promises.push(el.updateComplete)
              }
            }
            if (promises.length === 0) {
              break
            }
            await Promise.all(promises)
            const stillPending = devtoolsAPI.getInstances().some(el => el && el._isUpdatePending)
            if (!stillPending) {
              break
            }
          }
        },
        getComponent (element) {
          return devtoolsAPI.getComponent(element)
        },
        getHydratedCount () {
          return devtoolsAPI.getHydratedCount()
        },
        getEvents () {
          return devtoolsAPI.getEvents()
        },
        getInstances (tagName) {
          return devtoolsAPI.getInstances(tagName)
        }
      }

      Object.defineProperty(window, '__coralite_test__', {
        value: testAPI,
        writable: false,
        configurable: true,
        enumerable: false
      })
    }
  }
}
