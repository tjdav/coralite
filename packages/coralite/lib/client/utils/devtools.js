import { isDevRuntime } from '../../utils/dev-mode.js'

const registeredComponents = new Set()
const eventLog = []
const MAX_EVENTS = 100

/**
 * Registers a custom element tag name in the DevTools component registry.
 *
 * @param {string} id - The custom element tag name.
 */
export function registerDevToolsComponent (id) {
  if (isDevRuntime()) {
    registeredComponents.add(id)
  }
}

/**
 * Appends a dispatched CustomEvent to the bounded DevTools event telemetry ring buffer.
 *
 * @param {CustomEvent|Record<string, any>} event - The dispatched custom event or telemetry record.
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
 * Renders a full-screen diagnostic error overlay in development and testing modes.
 *
 * @param {Error} error - The fatal error instance to display.
 * @param {string} [title='Coralite Error'] - The heading title for the overlay.
 */
export function showCoraliteErrorOverlay (error, title = 'Coralite Error') {
  if (typeof document === 'undefined' || !document.body) {
    return
  }

  const overlay = document.createElement('div')
  overlay.style.position = 'fixed'
  overlay.style.top = '0'
  overlay.style.left = '0'
  overlay.style.width = '100%'
  overlay.style.height = '100%'
  overlay.style.backgroundColor = 'rgba(127, 29, 29, 0.98)'
  overlay.style.color = '#ffffff'
  overlay.style.padding = '20px'
  overlay.style.zIndex = '10000'
  overlay.style.fontFamily = 'monospace'
  overlay.style.whiteSpace = 'pre-wrap'
  overlay.style.overflow = 'auto'

  const heading = document.createElement('h1')
  heading.textContent = title
  const desc = document.createElement('p')
  desc.textContent = error?.message || String(error)

  overlay.appendChild(heading)
  overlay.appendChild(desc)

  if (error?.stack) {
    const stackTrace = document.createElement('pre')
    stackTrace.textContent = error.stack
    overlay.appendChild(stackTrace)
  }

  document.body.appendChild(overlay)
}

/**
 * Constructs a promise that resolves when both `data-coralite-ready` is set on `<html>`
 * and `window.__coralite__.lifecycle.hydrated` has settled.
 *
 * @returns {Promise<void>} Promise resolving when the page is fully ready.
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

  /** @type {import('../../../types/globals.js').CoraliteGlobalThis} */
  const win = typeof window !== 'undefined' ? window : null
  const lifecycle = win?.__coralite__?.lifecycle
  const lifecyclePromise = lifecycle?.hydrated ? lifecycle.hydrated : Promise.resolve()

  return Promise.all([docReadyPromise, lifecyclePromise]).then(() => {
  })
}

/**
 * Initializes `window.__coralite__.devtools` in development/testing modes and
 * `window.__coralite__.test` in testing mode.
 */
export function setupDevTools () {
  if (!isDevRuntime() || typeof window === 'undefined') {
    return
  }

  /** @type {import('../../../types/globals.js').CoraliteGlobalThis} */
  const win = window
  const existing = win.__coralite__ || {}
  if (existing.devtools && typeof existing.devtools.getRegisteredComponents === 'function') {
    return
  }

  const existingLifecycle = existing.lifecycle
  // @ts-ignore
  const currentMode = existing.mode || (typeof import.meta.env !== 'undefined' && import.meta.env ? import.meta.env.MODE : 'development')

  /** @type {import('../../../types/globals.js').CoraliteDevToolsAPI} */
  const devtools = {
    getComponent (element) {
      if (!element || !(element instanceof HTMLElement)) {
        return null
      }
      return element[Symbol.for('coralite.testing')] || null
    },

    getRegisteredComponents () {
      return Array.from(registeredComponents)
    },

    getHydratedCount () {
      const activeLifecycle = win.__coralite__?.lifecycle || existingLifecycle
      return activeLifecycle ? activeLifecycle._hc : 0
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
      const stateObj = win.__coralite__?.state
      return Array.from(stateObj?.stylesLoaded || [])
    },

    showError (error, title) {
      showCoraliteErrorOverlay(error, title)
    },

    recordEvent (event) {
      recordDevToolsEvent(event)
    }
  }

  /** @type {import('../../../types/globals.js').CoraliteRuntime} */
  const runtimeObj = {
    ...existing,
    version: '1.0.0',
    mode: currentMode,
    config: existing.config || {},
    state: existing.state || {},
    dom: existing.dom || {},
    plugins: existing.plugins || {},
    get lifecycle () {
      return existingLifecycle || null
    },
    devtools
  }

  if (currentMode === 'testing') {
    /** @type {import('../../../types/globals.js').CoraliteTestAPI} */
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
          const activeDevTools = win.__coralite__?.devtools || devtools
          const instances = activeDevTools.getInstances()
          const promises = []
          for (const el of instances) {
            /** @type {any} */
            const customEl = el
            if (customEl && typeof customEl.updateComplete !== 'undefined') {
              promises.push(customEl.updateComplete)
            }
          }
          if (promises.length === 0) {
            break
          }
          await Promise.all(promises)
          const stillPending = activeDevTools.getInstances().some(el => {
            /** @type {any} */
            const customEl = el
            return Boolean(customEl && customEl._isUpdatePending)
          })
          if (!stillPending) {
            break
          }
        }
      },
      getComponent (element) {
        const activeDevTools = win.__coralite__?.devtools || devtools
        return activeDevTools.getComponent(element)
      },
      getHydratedCount () {
        const activeDevTools = win.__coralite__?.devtools || devtools
        return activeDevTools.getHydratedCount()
      },
      getEvents () {
        const activeDevTools = win.__coralite__?.devtools || devtools
        return activeDevTools.getEvents()
      },
      getInstances (tagName) {
        const activeDevTools = win.__coralite__?.devtools || devtools
        return activeDevTools.getInstances(tagName)
      }
    }

    runtimeObj.test = testAPI
  }

  Object.defineProperty(window, '__coralite__', {
    value: runtimeObj,
    writable: true,
    configurable: true,
    enumerable: false
  })
}
