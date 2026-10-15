/**
 * @file Signals primitive for Coralite reactivity
 */

let currentEffect = null

function isSameValue (a, b) {
  if (a === b) {
    return true
  }
  if (Number.isNaN(a) && Number.isNaN(b)) {
    return true
  }
  return false
}

class Signal {
  constructor (initialValue) {
    this._value = initialValue
    this._subscribers = new Set()
  }

  get value () {
    if (currentEffect !== null) {
      this._subscribers.add(currentEffect)
      currentEffect.dependencies.add(this)
    }
    return this._value
  }

  set value (newValue) {
    if (isSameValue(newValue, this._value)) {
      return
    }
    const oldValue = this._value
    this._value = newValue
    this._notifySubscribers(newValue, oldValue)
  }

  subscribe (fn) {
    const subscriber = {
      fn,
      dependencies: new Set(),
      notify: (newVal, oldVal) => {
        const prev = currentEffect
        currentEffect = subscriber
        try {
          fn(newVal, oldVal)
        } finally {
          currentEffect = prev
        }
      }
    }
    this._subscribers.add(subscriber)
    return () => {
      this._subscribers.delete(subscriber)
      for (const dep of subscriber.dependencies) {
        dep._subscribers.delete(subscriber)
      }
      subscriber.dependencies.clear()
    }
  }

  _notifySubscribers (newValue, oldValue) {
    const subs = Array.from(this._subscribers)
    for (let i = 0; i < subs.length; i++) {
      const sub = subs[i]
      if (this._subscribers.has(sub)) {
        if (typeof sub === 'function') {
          sub(newValue, oldValue)
        } else if (sub && typeof sub.notify === 'function') {
          sub.notify(newValue, oldValue)
        }
      }
    }
  }
}

class Computed {
  constructor (fn) {
    this._fn = fn
    this._value = undefined
    this._isStale = true
    this._evaluating = false
    this._subscribers = new Set()
    this.dependencies = new Set()
  }

  get value () {
    if (this._evaluating) {
      throw new Error('Cyclic dependency detected in computed')
    }

    if (this._isStale) {
      this._reevaluate()
    }

    if (currentEffect !== null) {
      this._subscribers.add(currentEffect)
      currentEffect.dependencies.add(this)
    }

    return this._value
  }

  subscribe (fn) {
    const subscriber = {
      fn,
      dependencies: new Set(),
      notify: (newVal, oldVal) => {
        const prev = currentEffect
        currentEffect = subscriber
        try {
          fn(newVal, oldVal)
        } finally {
          currentEffect = prev
        }
      }
    }
    this._subscribers.add(subscriber)
    return () => {
      this._subscribers.delete(subscriber)
      for (const dep of subscriber.dependencies) {
        dep._subscribers.delete(subscriber)
      }
      subscriber.dependencies.clear()
    }
  }

  _reevaluate () {
    this._cleanupDependencies()
    this._evaluating = true
    const prevEffect = currentEffect
    currentEffect = this
    let nextValue
    try {
      nextValue = this._fn()
    } finally {
      currentEffect = prevEffect
      this._evaluating = false
    }

    const oldValue = this._value
    const valueChanged = this._isStale && !isSameValue(nextValue, oldValue)
    this._value = nextValue
    this._isStale = false

    return {
      valueChanged,
      oldValue,
      nextValue
    }
  }

  _cleanupDependencies () {
    for (const dep of this.dependencies) {
      dep._subscribers.delete(this)
    }
    this.dependencies.clear()
  }

  notify () {
    if (this._subscribers.size === 0) {
      this._isStale = true
      this._cleanupDependencies()
      return
    }

    this._isStale = true
    const { valueChanged, oldValue, nextValue } = this._reevaluate()
    if (valueChanged) {
      this._notifySubscribers(nextValue, oldValue)
    }
  }

  _notifySubscribers (newValue, oldValue) {
    const subs = Array.from(this._subscribers)
    for (let i = 0; i < subs.length; i++) {
      const sub = subs[i]
      if (this._subscribers.has(sub)) {
        if (typeof sub === 'function') {
          sub(newValue, oldValue)
        } else if (sub && typeof sub.notify === 'function') {
          sub.notify(newValue, oldValue)
        }
      }
    }
  }
}

class Effect {
  constructor (fn) {
    this._fn = fn
    this.dependencies = new Set()
    this.disposed = false
    this.running = false
  }

  run () {
    if (this.disposed || this.running) {
      return
    }
    this.running = true
    this._cleanup()
    const prevEffect = currentEffect
    currentEffect = this
    try {
      this._fn()
    } finally {
      currentEffect = prevEffect
      this.running = false
    }
  }

  notify () {
    if (!this.disposed && !this.running) {
      this.run()
    }
  }

  _cleanup () {
    for (const dep of this.dependencies) {
      dep._subscribers.delete(this)
    }
    this.dependencies.clear()
  }

  dispose () {
    this.disposed = true
    this._cleanup()
  }
}

/**
 * Creates a reactive signal container.
 * @param {*} initialValue - The initial value of the signal.
 * @returns {Signal} Signal instance with .value getter/setter and .subscribe.
 */
export function signal (initialValue) {
  return new Signal(initialValue)
}

/**
 * Creates a computed signal that derives its value from other signals.
 * @param {Function} fn - Derivation function.
 * @returns {Computed} Computed instance with .value getter.
 */
export function computed (fn) {
  return new Computed(fn)
}

/**
 * Creates a reactive effect that runs immediately and re-runs on dependency changes.
 * @param {Function} fn - Effect callback.
 * @returns {Function} Disposal function.
 */
export function effect (fn) {
  const eff = new Effect(fn)
  eff.run()
  return () => eff.dispose()
}
