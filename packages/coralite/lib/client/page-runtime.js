import { createReadOnlyProxy, normalizeStyleKey, isAsyncFunction, createCombinedSignal, normalizeFunction } from '../shared/core.js'
import { isDevRuntime } from '../utils/dev-mode.js'
import { CoraliteError } from '../shared/errors.js'
import { createIsoPluginProxy } from './utils/iso-plugin-proxy.js'
import { applyDomBoundAttribute } from '../shared/tags.js'
import { isBooleanCustomAttribute } from '../shared/attributes.js'


/**
 * Initializes client-side reactivity, style bindings, getters, observers,
 * and client() controller execution for Coralite pages on document.documentElement.
 *
 * @param {Object} pageConfig - Page configuration containing state, getters, style, and client controller.
 * @param {Function} [getClientContext] - Optional resolver function to retrieve client plugin context.
 * @returns {Promise<void>}
 */
export async function setupPageRuntime (pageConfig, getClientContext) {
  if (!pageConfig || typeof window === 'undefined' || typeof document === 'undefined') {
    return
  }
  const hasReactivity = Boolean(
    pageConfig.client
    || (pageConfig.tokens && Object.keys(pageConfig.tokens).length > 0)
    || (pageConfig.style && Object.keys(pageConfig.style).length > 0)
    || (pageConfig.getters && Object.keys(pageConfig.getters).length > 0)
  )
  if (!hasReactivity) {
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
  /** @type {import('../../types/globals.js').CoraliteGlobalThis | null} */
  const win = typeof window !== 'undefined' ? window : null
  const runtimeState = win?.__coralite__?.state
  const routeObj = runtimeState?.route || pageConfig.route || { path: (win && win.location ? win.location.pathname : '/') }

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

  const pageTokens = pageConfig.tokens || {}

  const renderTokenTemplate = (raw) => raw.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, k) => {
    const val = resolveTokenVal(k)
    return val !== undefined && val !== null ? String(val) : ''
  })

  const updatePageTokens = (isInitialSetup = false) => {
    if (Object.keys(pageTokens).length > 0) {
      const marked = document.querySelectorAll('[data-coralite-page-token]')
      for (const element of marked) {
        const id = element.getAttribute('data-coralite-page-token')
        const entry = pageTokens[id]
        if (!entry) {
          continue
        }

        for (const [name, raw] of Object.entries(entry.attrs || {})) {
          const singleMatch = typeof raw === 'string' ? raw.match(/^\s*\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}\s*$/) : null
          if (singleMatch) {
            const rawVal = resolveTokenVal(singleMatch[1])
            const isBooleanCustom = typeof isBooleanCustomAttribute === 'function' && isBooleanCustomAttribute(element, name)
            applyDomBoundAttribute(element, name, rawVal, () => renderTokenTemplate(raw), isBooleanCustom)
          } else {
            const next = renderTokenTemplate(raw)
            if (element.getAttribute(name) !== next) {
              element.setAttribute(name, next)
            }
          }
        }

        if (entry.texts && entry.texts.length > 0) {
          /** @type {any[]} */
          let textNodes = null
          for (const { textIndex, raw, type } of entry.texts) {
            const next = renderTokenTemplate(raw)
            if (type === 'html') {
              if (isInitialSetup) {
                if (element.textContent?.trim() === raw.trim()) {
                  element.innerHTML = next
                }
              } else if (element.innerHTML !== next) {
                element.innerHTML = next
              }
            } else {
              if (!textNodes) {
                textNodes = []
                for (const child of Array.from(element.childNodes)) {
                  if (child.nodeType === 3) {
                    textNodes.push(child)
                  }
                }
              }
              /** @type {any} */
              const textNode = textNodes[textIndex]
              if (!textNode) {
                continue
              }
              if (textNode.nodeValue !== next) {
                textNode.nodeValue = next
              }
            }
          }
        }
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
      updatePageTokens(false)
    })
  }

  const getterAbortControllers = {}
  const asyncGetterCache = new Map()
  const pageGetterDeps = new Map()

  /**
   * Wraps raw page getter context with a lazy proxy resolving top-level isomorphic plugin context.
   *
   * @param {Object} rawContext - Raw getter context object
   * @returns {Proxy} Wrapped getter context proxy
   */
  const wrapPageGetterContext = (rawContext) => createIsoPluginProxy(rawContext)

  const runAsyncPageGetter = (key, getterFn, entry) => {
    if (entry.controller) {
      entry.controller.abort()
    }
    const perComputeCtrl = new AbortController()
    entry.controller = perComputeCtrl
    const combinedSignal = createCombinedSignal(pageAbortController.signal, perComputeCtrl.signal)

    const directDeps = new Set()
    pageGetterDeps.set(key, directDeps)

    const pageCtx = wrapPageGetterContext({
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
    })

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
            return getterFn(wrapPageGetterContext({
              state: roState,
              route: routeObj,
              root: rootEl,
              refs: (id) => rootEl.querySelector(`[ref="${id}"]`),
              isServer: false,
              signal: getterAbortControllers[key].signal,
              store: runtimeState?.store || undefined
            }))
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
  updatePageTokens(true)

  const clientFn = parseFn(pageConfig.client)
  if (typeof clientFn === 'function') {
    const runtimePlugins = win?.__coralite__?.plugins
    const routerCtx = runtimePlugins?.router

    const baseContext = {
      state: stateProxy,
      route: routeObj,
      root: rootEl,
      refs (id) {
        return rootEl.querySelector(`[ref="${id}"]`)
      },
      signal: new AbortController().signal,
      store: runtimeState?.store || undefined,
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

    const resolveClientContext = getClientContext || runtimePlugins?.getClientContext
    let clientPluginContext = {}
    if (typeof resolveClientContext === 'function') {
      try {
        const resolved = await resolveClientContext(baseContext)
        if (resolved && typeof resolved === 'object') {
          clientPluginContext = resolved
        }
      } catch (err) {
        console.error('Coralite Plugin Error resolving client context for page:', err)
      }
    } else {
      const isoPlugins = runtimePlugins?.isomorphic
      if (isoPlugins) {
        for (const [key, fn] of Object.entries(isoPlugins)) {
          try {
            clientPluginContext[key] = typeof fn === 'function' ? fn(baseContext) : fn
          } catch (err) {
            console.error(`Coralite Plugin Error resolving isomorphic context "${key}" for page:`, err)
          }
        }
      }
    }

    const context = {
      ...clientPluginContext,
      ...(routerCtx ? { router: routerCtx } : {}),
      ...baseContext
    }

    await clientFn(context)
  }
}
