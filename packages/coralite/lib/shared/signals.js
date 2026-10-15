/**
 * Signal reactivity primitive for Coralite.
 */

let activeContext = null
const contextStack = []

/**
 * Pushes a tracking context onto the stack.
 *
 * @param {object|null} ctx - The tracking context to activate.
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
      if (Object.is(value, nextValue)) {
        return
      }
      const oldValue = value
      value = nextValue
      const subs = Array.from(subscribers)
      for (const sub of subs) {
        sub(nextValue, oldValue)
      }
    },
    subscribe (fn) {
      const subCtx = {
        running: false,
        disposed: false,
        hasQueued: false,
        queuedNextVal: undefined,
        queuedOldVal: undefined,
        notify (nextVal, oldVal) {
          if (subCtx.disposed) {
            return
          }
          if (subCtx.running) {
            subCtx.queuedNextVal = nextVal
            subCtx.hasQueued = true
            return
          }
          subCtx.running = true
          let currentNext = nextVal
          let currentOld = oldVal
          let iterations = 0

          try {
            while (true) {
              subCtx.hasQueued = false

              pushContext(null)
              try {
                fn(currentNext, currentOld)
              } finally {
                popContext()
              }

              if (subCtx.hasQueued && !subCtx.disposed) {
                iterations++
                if (iterations > 1000) {
                  const err = new Error('Maximum reactive subscriber depth exceeded')
                  err.name = 'CoraliteError'
                  throw err
                }
                currentOld = currentNext
                currentNext = subCtx.queuedNextVal
              } else {
                break
              }
            }
          } finally {
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
      if (computedCtx.disposed) {
        return
      }
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

    const cleanups = Array.from(computedCtx.deps)
    computedCtx.deps.clear()
    computedCtx.seenSignals.clear()
    for (const cleanup of cleanups) {
      cleanup()
    }

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
    dirty: false,
    notify () {
      if (effectCtx.disposed) {
        return
      }
      if (effectCtx.running) {
        effectCtx.dirty = true
        return
      }
      effectCtx.running = true
      let iterations = 0
      try {
        do {
          effectCtx.dirty = false
          iterations++
          if (iterations > 1000) {
            const err = new Error('Maximum reactive effect depth exceeded')
            err.name = 'CoraliteError'
            throw err
          }
          const cleanups = Array.from(effectCtx.deps)
          effectCtx.deps.clear()
          effectCtx.seenSignals.clear()
          for (const cleanup of cleanups) {
            cleanup()
          }

          pushContext(effectCtx)
          try {
            fn()
          } finally {
            popContext()
          }
        } while (effectCtx.dirty && !effectCtx.disposed)
      } finally {
        effectCtx.running = false
      }
    }
  }

  effectCtx.notify()

  return function dispose () {
    effectCtx.disposed = true
    const cleanups = Array.from(effectCtx.deps)
    effectCtx.deps.clear()
    effectCtx.seenSignals.clear()
    for (const cleanup of cleanups) {
      cleanup()
    }
  }
}
