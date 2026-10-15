/**
 * Signal reactivity primitive for Coralite.
 */

let activeContext = null
const contextStack = []

/**
 * Pushes a tracking context onto the stack.
 *
 * @param {object} ctx - The tracking context to activate.
 */
function pushContext (ctx) {
  contextStack.push(activeContext)
  activeContext = ctx
}

/**
 * Pops the active tracking context from the stack.
 */
function popContext () {
  activeContext = contextStack.pop()
}

/**
 * Creates a reactive signal container.
 *
 * @template T
 * @param {T} initialValue - The initial value for the signal.
 * @returns {{ value: T, subscribe: (fn: (newValue: T, oldValue: T) => void) => () => void }} The signal object.
 */
export function createSignal (initialValue) {
  let value = initialValue
  const subscribers = new Set()

  const signal = {
    get value () {
      if (activeContext !== null) {
        const currentCtx = activeContext
        if (!currentCtx.seenSignals.has(signal)) {
          currentCtx.seenSignals.add(signal)
          const subscriber = (nextVal, oldVal) => {
            currentCtx.notify(nextVal, oldVal)
          }
          subscribers.add(subscriber)
          currentCtx.deps.add(() => {
            subscribers.delete(subscriber)
            currentCtx.seenSignals.delete(signal)
          })
        }
      }
      return value
    },
    set value (nextValue) {
      if (Object.is(value, nextValue)) return
      const oldValue = value
      value = nextValue
      const subs = Array.from(subscribers)
      for (const sub of subs) {
        sub(nextValue, oldValue)
      }
    },
    subscribe (fn) {
      const subCtx = {
        deps: new Set(),
        seenSignals: new Set(),
        running: false,
        disposed: false,
        notify (nextVal, oldVal) {
          if (subCtx.disposed || subCtx.running) return
          subCtx.running = true
          for (const cleanup of subCtx.deps) {
            cleanup()
          }
          subCtx.deps.clear()
          subCtx.seenSignals.clear()

          pushContext(subCtx)
          try {
            fn(nextVal, oldVal)
          } finally {
            popContext()
            subCtx.running = false
          }
        }
      }

      const handle = (nextVal, oldVal) => {
        subCtx.notify(nextVal, oldVal)
      }

      subscribers.add(handle)

      return function dispose () {
        subCtx.disposed = true
        subscribers.delete(handle)
        for (const cleanup of subCtx.deps) {
          cleanup()
        }
        subCtx.deps.clear()
        subCtx.seenSignals.clear()
      }
    }
  }

  return signal
}

/**
 * Creates a reactive computed value derived from signals.
 *
 * @template T
 * @param {() => T} fn - The derivation function.
 * @returns {{ readonly value: T }} The computed signal object.
 */
export function createComputed (fn) {
  let cachedValue
  let isStale = true
  let isEvaluating = false
  const computedSubscribers = new Set()

  const computedCtx = {
    deps: new Set(),
    seenSignals: new Set(),
    running: false,
    disposed: false,
    notify () {
      if (computedCtx.disposed) return
      isStale = true

      if (computedSubscribers.size > 0) {
        const oldValue = cachedValue
        const newValue = evaluate()
        if (!Object.is(oldValue, newValue)) {
          const subs = Array.from(computedSubscribers)
          for (const sub of subs) {
            sub(newValue, oldValue)
          }
        }
      }
    }
  }

  function evaluate () {
    if (isEvaluating) {
      const err = new Error('Cyclic dependency detected in computed')
      err.name = 'CoraliteError'
      throw err
    }

    isEvaluating = true

    for (const cleanup of computedCtx.deps) {
      cleanup()
    }
    computedCtx.deps.clear()
    computedCtx.seenSignals.clear()

    pushContext(computedCtx)
    try {
      cachedValue = fn()
      isStale = false
      return cachedValue
    } finally {
      popContext()
      isEvaluating = false
    }
  }

  const computedSignal = {
    get value () {
      if (isEvaluating) {
        const err = new Error('Cyclic dependency detected in computed')
        err.name = 'CoraliteError'
        throw err
      }

      if (activeContext !== null) {
        const currentCtx = activeContext
        if (!currentCtx.seenSignals.has(computedSignal)) {
          currentCtx.seenSignals.add(computedSignal)
          const sub = (nextVal, oldVal) => {
            currentCtx.notify(nextVal, oldVal)
          }
          computedSubscribers.add(sub)
          currentCtx.deps.add(() => {
            computedSubscribers.delete(sub)
            currentCtx.seenSignals.delete(computedSignal)
          })
        }
      }

      if (isStale) {
        evaluate()
      }

      return cachedValue
    }
  }

  return computedSignal
}

/**
 * Creates an effect that runs immediately and re-runs on dependency changes.
 *
 * @param {() => void} fn - The effect function.
 * @returns {() => void} A dispose function to stop the effect.
 */
export function createEffect (fn) {
  const effectCtx = {
    deps: new Set(),
    seenSignals: new Set(),
    running: false,
    disposed: false,
    notify () {
      if (effectCtx.disposed || effectCtx.running) return
      effectCtx.running = true
      for (const cleanup of effectCtx.deps) {
        cleanup()
      }
      effectCtx.deps.clear()
      effectCtx.seenSignals.clear()

      pushContext(effectCtx)
      try {
        fn()
      } finally {
        popContext()
        effectCtx.running = false
      }
    }
  }

  effectCtx.notify()

  return function dispose () {
    effectCtx.disposed = true
    for (const cleanup of effectCtx.deps) {
      cleanup()
    }
    effectCtx.deps.clear()
    effectCtx.seenSignals.clear()
  }
}
