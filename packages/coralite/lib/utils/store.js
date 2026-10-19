import { createSignal } from './signals.js'
import { CoraliteError } from '../shared/errors.js'

/**
 * Creates a signal-backed reactive store.
 *
 * @param {Record<string, any>} [defaults={}] - Initial key-value defaults for the store.
 * @returns {Record<string, any>} Proxy-backed reactive store.
 */
export function createStore (defaults = {}) {
  const storeDefaults = { ...defaults }
  const signals = new Map()

  for (const [key, value] of Object.entries(storeDefaults)) {
    signals.set(key, createSignal(value))
  }

  let isBatching = false
  const pendingCallbacks = new Map()

  function wrapSubscriber (cb, sigKey) {
    return (nextVal, oldVal) => {
      if (isBatching) {
        let cbMap = pendingCallbacks.get(cb)
        if (!cbMap) {
          cbMap = new Map()
          pendingCallbacks.set(cb, cbMap)
        }
        if (!cbMap.has(sigKey)) {
          cbMap.set(sigKey, {
            nextVal,
            oldVal
          })
        } else {
          cbMap.get(sigKey).nextVal = nextVal
        }
      } else {
        cb(nextVal, oldVal)
      }
    }
  }

  function flushBatch () {
    const pending = Array.from(pendingCallbacks.entries())
    pendingCallbacks.clear()
    for (const [cb, cbMap] of pending) {
      for (const { nextVal, oldVal } of cbMap.values()) {
        cb(nextVal, oldVal)
      }
    }
  }

  const methods = {
    subscribe (keyOrCallback, callback) {
      if (typeof keyOrCallback === 'function') {
        const disposes = []
        for (const [key, sig] of signals.entries()) {
          const wrapped = wrapSubscriber(keyOrCallback, key)
          disposes.push(sig.subscribe(wrapped))
        }
        return () => {
          disposes.forEach((d) => d())
        }
      }

      const sig = signals.get(keyOrCallback)
      if (!sig) {
        throw new CoraliteError(`store.subscribe: unknown key "${keyOrCallback}"`)
      }

      const wrapped = wrapSubscriber(callback, keyOrCallback)
      return sig.subscribe(wrapped)
    },

    batch (fn) {
      if (typeof fn !== 'function') {
        return undefined
      }
      const wasBatching = isBatching
      isBatching = true
      try {
        return fn()
      } finally {
        if (!wasBatching) {
          isBatching = false
          flushBatch()
        }
      }
    },

    reset () {
      methods.batch(() => {
        for (const [key, value] of Object.entries(storeDefaults)) {
          const sig = signals.get(key)
          if (sig) {
            sig.value = value
          }
        }
      })
    }
  }

  const target = { ...storeDefaults }

  const proxy = new Proxy(target, {
    get (t, key, receiver) {
      if (typeof key === 'string' && key in methods) {
        return methods[key]
      }
      if (typeof key === 'string') {
        const sig = signals.get(key)
        if (sig) {
          return sig.value
        }
      }
      return Reflect.get(t, key, receiver)
    },
    set (t, key, value) {
      if (typeof key === 'string' && key in methods) {
        return false
      }
      if (typeof key === 'string') {
        let sig = signals.get(key)
        if (!sig) {
          sig = createSignal(value)
          signals.set(key, sig)
        }
        sig.value = value
        t[key] = value
        return true
      }
      return Reflect.set(t, key, value)
    }
  })

  for (const [key, fn] of Object.entries(methods)) {
    Object.defineProperty(proxy, key, {
      value: fn,
      enumerable: false,
      writable: false,
      configurable: true
    })
  }

  return proxy
}

/**
 * Creates a server-side read-only store snapshot.
 * Writes throw CoraliteError.
 *
 * @param {Record<string, any>} [defaults={}] - Initial key-value defaults.
 * @returns {Record<string, any>} Read-only snapshot store.
 */
export function createServerStore (defaults = {}) {
  const target = { ...defaults }
  return new Proxy(target, {
    get (t, key, receiver) {
      return Reflect.get(t, key, receiver)
    },
    set (t, key) {
      throw new CoraliteError(`Cannot mutate store on the server (property: "${String(key)}")`)
    }
  })
}
