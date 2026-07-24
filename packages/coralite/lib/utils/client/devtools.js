// Module-scoped private registry (Garbage-collection safe)
const registeredComponents = new Set()
const eventLog = []
const MAX_EVENTS = 100

/**
 *
 */
export function registerDevToolsComponent (id) {
  // @ts-ignore
  const isDevOrTest = typeof import.meta.env !== 'undefined'
    // @ts-ignore
    ? import.meta.env.MODE !== 'production'
    : true

  if (isDevOrTest) {
    registeredComponents.add(id)
  }
}

/**
 *
 */
export function recordDevToolsEvent (event) {
  // @ts-ignore
  const isDevOrTest = typeof import.meta.env !== 'undefined'
    // @ts-ignore
    ? import.meta.env.MODE !== 'production'
    : true

  if (isDevOrTest) {
    if (eventLog.length >= MAX_EVENTS) {
      eventLog.shift()
    }
    eventLog.push(event)
  }
}

/**
 *
 */
export function setupDevTools () {
  // @ts-ignore
  const isDevOrTest = typeof import.meta.env !== 'undefined'
    // @ts-ignore
    ? import.meta.env.MODE !== 'production'
    : true

  if (isDevOrTest) {
    if (typeof window === 'undefined' || (window['__coralite__'] && window['__coralite__'].getRegisteredComponents)) {
      return
    }

    // Preserve existing lifecycle if it was created by SSR readiness script
    const existingLifecycle = window['__coralite__']?.lifecycle

    const devtoolsAPI = {
      version: '1.0.0',
      // @ts-ignore
      mode: typeof import.meta.env !== 'undefined' ? import.meta.env.MODE : 'development',

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
      }
    }

    // Attach to window using non-enumerable descriptor to prevent global key pollution
    Object.defineProperty(window, '__coralite__', {
      value: devtoolsAPI,
      writable: false,
      configurable: true,
      enumerable: false
    })
  }
}
