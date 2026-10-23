import { createReadOnlyProxy, normalizeStyleKey, isAsyncFunction, createCombinedSignal, normalizeFunction } from '../shared/core.js'
import { isDevRuntime } from '../utils/dev-mode.js'
import { CoraliteError } from '../shared/errors.js'

/**
 * Initializes client-side reactivity, style bindings, getters, observers,
 * and client() controller execution for Coralite pages on document.documentElement.
 *
 * @param {Object} pageConfig - Page configuration containing state, getters, style, and client controller.
 * @returns {Promise<void>}
 */
export async function setupPageRuntime (pageConfig) {
  if (!pageConfig || typeof window === 'undefined' || typeof document === 'undefined') {
    return
  }

  const parseFn = (fnOrStr) => {
    if (typeof fnOrStr === 'function') {
      return fnOrStr
    }
    if (typeof fnOrStr === 'string' && fnOrStr.trim()) {
      try {
        const normalizedStr = normalizeFunction(fnOrStr.trim())
        return new Function(`return (${normalizedStr})`)()
      } catch {
        return null
      }
    }
    return null
  }

  const rootEl = document.documentElement
  const stateTarget = { ...(pageConfig.state || {}) }
  const getterFns = pageConfig.getters || {}
  const styleFns = pageConfig.style || {}
  // @ts-ignore
  const routeObj = (typeof window !== 'undefined' && window.__coralite_hydration__ && window.__coralite_hydration__.__route__) || pageConfig.route || { path: (typeof window !== 'undefined' && window.location ? window.location.pathname : '/') }

  const observersMap = new Map()
  let isUpdatePending = false

  const resolveTokenVal = (key) => {
    if (key === 'route') {
      return routeObj
    }
    if (key.startsWith('route.')) {
      const prop = key.slice(6)
      return routeObj ? routeObj[prop] : undefined
    }
    if (key.includes('.')) {
      const parts = key.split('.')
      let curr = stateProxy
      for (const p of parts) {
        // eslint-disable-next-line eqeqeq -- intentionally matches null and undefined
        if (curr == null) {
          return undefined
        }
        curr = curr[p]
      }
      return curr
    }
    return stateProxy[key]
  }

  const pageAbortController = new AbortController()

  const applyPageStyles = () => {
    if (!styleFns || Object.keys(styleFns).length === 0) {
      return
    }
    const roState = createReadOnlyProxy(stateProxy)
    const pageStyleCtx = {
      state: roState,
      isServer: false,
      signal: pageAbortController.signal
    }
    for (const [key, valOrFn] of Object.entries(styleFns)) {
      const normKey = normalizeStyleKey(key)
      if (!normKey) {
        continue
      }
      const parsedFn = parseFn(valOrFn)
      const val = typeof parsedFn === 'function' ? parsedFn(pageStyleCtx) : valOrFn
      if (val !== null && val !== undefined && val !== false && val !== '') {
        rootEl.style.setProperty(normKey, String(val))
      } else {
        rootEl.style.removeProperty(normKey)
      }
    }
  }

  const updatePageTokens = (node = rootEl) => {
    if (!node) {
      return
    }
    /** @type {any} */
    const n = node
    if (n.nodeType === 3) {
      if (n._rawTemplate === undefined) {
        if (n.data && n.data.includes('{{')) {
          n._rawTemplate = n.data
        }
      }
      if (n._rawTemplate) {
        n.data = n._rawTemplate.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, k) => {
          const val = resolveTokenVal(k)
          return val !== undefined && val !== null ? String(val) : ''
        })
      }
    } else if (n.nodeType === 1) {
      if (n.attributes) {
        for (const attr of Array.from(n.attributes)) {
          /** @type {any} */
          const a = attr
          if (a._rawTemplate === undefined) {
            if (a.value && a.value.includes('{{')) {
              a._rawTemplate = a.value
            }
          }
          if (a._rawTemplate) {
            a.value = a._rawTemplate.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, k) => {
              const val = resolveTokenVal(k)
              return val !== undefined && val !== null ? String(val) : ''
            })
          }
        }
      }
      for (const child of Array.from(n.childNodes)) {
        updatePageTokens(child)
      }
    }
  }

  const schedulePageFlush = (changedProp, oldVal, newVal) => {
    if (changedProp && observersMap.has(changedProp)) {
      for (const cb of Array.from(observersMap.get(changedProp))) {
        try {
          cb(newVal, oldVal)
        } catch (err) {
          console.error(`Coralite Page Observer Error for "${changedProp}":`, err)
        }
      }
    }

    if (isUpdatePending) {
      return
    }
    isUpdatePending = true
    queueMicrotask(() => {
      isUpdatePending = false
      applyPageStyles()
      updatePageTokens(rootEl)
    })
  }

  const getterAbortControllers = {}
  const asyncGetterCache = new Map()
  const pageGetterDeps = new Map()

  const runAsyncPageGetter = (key, getterFn, entry) => {
    if (entry.controller) {
      entry.controller.abort()
    }
    const perComputeCtrl = new AbortController()
    entry.controller = perComputeCtrl
    const combinedSignal = createCombinedSignal(pageAbortController.signal, perComputeCtrl.signal)

    const directDeps = new Set()
    pageGetterDeps.set(key, directDeps)

    const pageCtx = {
      state: createReadOnlyProxy(stateProxy, new WeakMap(), {
        activeCollector: (p) => {
          if (typeof p === 'string') {
            directDeps.add(p)
          }
        }
      }),
      route: routeObj,
      root: rootEl,
      refs: (id) => rootEl.querySelector(`[ref="${id}"]`),
      isServer: false,
      signal: combinedSignal
    }

    entry.status = 'in_flight'
    let promise
    try {
      promise = getterFn(pageCtx)
    } catch (err) {
      promise = Promise.reject(err)
    }

    entry.deps = new Set(directDeps)

    Promise.resolve(promise).then(res => {
      if (perComputeCtrl.signal.aborted || pageAbortController.signal.aborted) {
        return
      }
      entry.status = 'resolved'
      entry.value = res
      entry.hasPreviousValue = true
      entry.controller = null
      schedulePageFlush(key, undefined, res)
    }).catch(err => {
      if (perComputeCtrl.signal.aborted || err?.name === 'AbortError' || pageAbortController.signal.aborted) {
        return
      }
      entry.status = 'errored'
      entry.controller = null
      if (isDevRuntime()) {
        console.error(`[Coralite] Async page getter "${key}" failed:`, err)
      } else {
        console.warn(`[Coralite] Async page getter "${key}" failed: ${err?.message || err}`)
      }
    })
  }

  for (const [key, rawGetterFn] of Object.entries(getterFns)) {
    const getterFn = parseFn(rawGetterFn)
    if (typeof getterFn === 'function') {
      if (isAsyncFunction(getterFn)) {
        Object.defineProperty(stateTarget, key, {
          get: () => {
            let entry = asyncGetterCache.get(key)
            if (!entry) {
              entry = {
                status: 'idle',
                value: undefined,
                hasPreviousValue: false,
                controller: null,
                deps: new Set()
              }
              asyncGetterCache.set(key, entry)
            }
            if (entry.status === 'idle') {
              runAsyncPageGetter(key, getterFn, entry)
            }
            return entry.hasPreviousValue ? entry.value : undefined
          },
          enumerable: true,
          configurable: true
        })
      } else {
        Object.defineProperty(stateTarget, key, {
          get: () => {
            if (getterAbortControllers[key]) {
              getterAbortControllers[key].abort()
            }
            getterAbortControllers[key] = new AbortController()
            const roState = createReadOnlyProxy(stateProxy)
            return getterFn({
              state: roState,
              route: routeObj,
              root: rootEl,
              refs: (id) => rootEl.querySelector(`[ref="${id}"]`),
              isServer: false,
              signal: getterAbortControllers[key].signal,
              // @ts-ignore
              store: (typeof window !== 'undefined' && window.__coralite__?.store) || undefined
            })
          },
          enumerable: true,
          configurable: true
        })
      }
    }
  }

  const stateProxy = new Proxy(stateTarget, {
    get (target, prop, receiver) {
      return Reflect.get(target, prop, receiver)
    },
    set (target, prop, value) {
      if (typeof prop === 'string' && prop in getterFns) {
        if (isDevRuntime()) {
          throw new CoraliteError(`Cannot assign to getter property "${prop}". Getter values are read-only.`, {
            path: prop
          })
        }
        return true
      }
      const oldVal = target[prop]
      if (oldVal === value) {
        return true
      }
      target[prop] = value
      schedulePageFlush(prop, oldVal, value)
      return true
    },
    has (target, prop) {
      return Reflect.has(target, prop) || prop in getterFns || prop === 'route'
    }
  })

  applyPageStyles()
  updatePageTokens(rootEl)

  const clientFn = parseFn(pageConfig.client)
  if (typeof clientFn === 'function') {
    const context = {
      state: stateProxy,
      route: routeObj,
      root: rootEl,
      refs (id) {
        return rootEl.querySelector(`[ref="${id}"]`)
      },
      signal: new AbortController().signal,
      // @ts-ignore
      store: (typeof window !== 'undefined' && window.__coralite__?.store) || undefined,
      emit (name, detail, options = {}) {
        const CustomEventCtor = typeof window !== 'undefined' && window.CustomEvent ? window.CustomEvent : CustomEvent
        const event = new CustomEventCtor(name, {
          bubbles: true,
          composed: true,
          ...options,
          detail: detail !== undefined ? detail : options?.detail
        })
        return rootEl.dispatchEvent(event)
      },
      observe (key, callback) {
        if (!observersMap.has(key)) {
          observersMap.set(key, new Set())
        }
        observersMap.get(key).add(callback)
        return () => observersMap.get(key)?.delete(callback)
      },
      updateComplete: Promise.resolve(true)
    }

    await clientFn(context)
  }
}
