/**
 * @import {CoraliteElement} from '../coralite-element.js'
 */

/**
 * Extracts a unique key from a list item, consulting a custom key function,
 * or defaulting to `item.id`, `item.key`, or strict item identity.
 * @param {any} item - The item to extract a key for.
 * @param {Function} [keyFn] - Optional key extraction function.
 * @returns {any} The key for the item.
 */
export function getItemKey (item, keyFn) {
  if (typeof keyFn === 'function') {
    try {
      return keyFn(item)
    } catch {
      // fallback
    }
  }
  if (item === null || item === undefined) {
    return item
  }
  if (typeof item === 'object') {
    if ('id' in item) {
      return item.id
    }
    if ('key' in item) {
      return item.key
    }
  }
  return item
}

/**
 * Detects if a list update corresponds to a swap or single-removal pattern.
 * @param {Array} oldList - The previous array value.
 * @param {Array} newList - The new array value.
 * @param {Function} [keyFn] - Optional key function.
 * @returns {{type: 'swap', i: number, j: number}|{type: 'remove', index: number}|null} The detected pattern or null.
 */
export function detectListPattern (oldList, newList, keyFn) {
  if (!Array.isArray(oldList) || !Array.isArray(newList)) {
    return null
  }

  // Swap: same length, exactly two indices differ, and old[i] key === new[j] key and old[j] key === new[i] key
  if (oldList.length === newList.length) {
    const diffs = []
    for (let i = 0; i < oldList.length; i++) {
      const itemOld = oldList[i]
      const itemNew = newList[i]
      if (itemOld !== itemNew) {
        const keyOld = getItemKey(itemOld, keyFn)
        const keyNew = getItemKey(itemNew, keyFn)
        if (keyOld === undefined || keyOld !== keyNew) {
          diffs.push(i)
        }
      }
      if (diffs.length > 2) {
        return null
      }
    }
    if (diffs.length === 2) {
      const [i, j] = diffs
      const keyI = getItemKey(oldList[i], keyFn)
      const keyJ = getItemKey(oldList[j], keyFn)
      const newKeyI = getItemKey(newList[i], keyFn)
      const newKeyJ = getItemKey(newList[j], keyFn)
      if (keyI !== undefined && keyI === newKeyJ && keyJ === newKeyI) {
        return {
          type: 'swap',
          i,
          j
        }
      }
    }
    return null
  }

  // Single removal: newList is oldList with one element removed
  if (oldList.length === newList.length + 1) {
    let removedIndex = -1
    for (let i = 0, j = 0; i < oldList.length; i++) {
      const itemOld = oldList[i]
      const itemNew = newList[j]
      const keyOld = getItemKey(itemOld, keyFn)
      const keyNew = getItemKey(itemNew, keyFn)
      const matches = j < newList.length && (itemOld === itemNew || (keyOld !== undefined && keyOld === keyNew))
      if (!matches) {
        if (removedIndex !== -1) {
          return null
        }
        removedIndex = i
      } else {
        j++
      }
    }
    if (removedIndex !== -1) {
      return {
        type: 'remove',
        index: removedIndex
      }
    }
    if (removedIndex === -1 && oldList.length > 0) {
      return {
        type: 'remove',
        index: oldList.length - 1
      }
    }
  }

  return null
}

/**
 * Applies a detected list pattern directly to the DOM container.
 * @param {any} element - The component element instance.
 * @param {string} key - The state property key.
 * @param {{type: 'swap', i: number, j: number}|{type: 'remove', index: number}} pattern - The detected list pattern.
 * @returns {boolean} True if applied successfully, false otherwise.
 */
export function applyListPattern (element, key, pattern) {
  if (!element) {
    return false
  }

  /** @type {any} */
  const el = element
  let container = null
  if (typeof el._resolveRef === 'function') {
    container = el._resolveRef(key) ||
      el._resolveRef('tbody') ||
      el._resolveRef('list') ||
      el._resolveRef('container')
  }

  if (!container && el.querySelector) {
    container = el.querySelector('tbody, ul, ol, [ref]')
  }

  if (!container) {
    container = el.firstElementChild || el
  }

  if (!container || !container.children) {
    return false
  }

  if (pattern.type === 'swap') {
    const { i, j } = pattern
    const row1 = container.children[i]
    const row2 = container.children[j]
    if (!row1 || !row2) {
      return false
    }
    const next1 = row1.nextSibling
    const next2 = row2.nextSibling
    if (next1 === row2) {
      container.insertBefore(row2, row1)
    } else {
      container.insertBefore(row2, next1)
      container.insertBefore(row1, next2)
    }
    return true
  }

  if (pattern.type === 'remove') {
    const { index } = pattern
    const targetChild = container.children[index]
    if (targetChild && typeof targetChild.remove === 'function') {
      targetChild.remove()
      return true
    }
  }

  return false
}

/**
 * Represents a single state key observer record.
 * Handles tracking, evaluation, dependency collection, and invocation of state change callbacks.
 */
export class ObserverRecord {
  /**
   * Creates a new instance of ObserverRecord.
   * @param {string} key - The state key to observe.
   * @param {Function} callback - The user-defined observer callback to run when the observed state key (or its dependencies) change.
   * @param {CoraliteElement} element - The associated custom element instance of the component.
   */
  constructor (key, callback, element) {
    /**
     * The state key being observed.
     * @type {string}
     */
    this.key = key

    /**
     * The callback function to invoke on change.
     * @type {Function}
     */
    this.callback = callback

    /**
     * The associated CoraliteElement instance.
     * @type {CoraliteElement}
     */
    this.element = element

    /**
     * The set of state keys that this observer depends on.
     * @type {Set<string>}
     */
    this.dependencies = new Set()

    /**
     * Secondary dependency collection buffer for O(1) double-buffering.
     * @type {Set<string>}
     * @protected
     */
    this._nextDependencies = new Set()

    /**
     * The last evaluated value of the observed state property.
     * @type {any}
     */
    this.lastValue = undefined

    /**
     * Indicates whether the observer record has been initialized.
     * @type {boolean}
     */
    this.initialized = false

    /**
     * Monotonic async resolution counter generator.
     * @type {number}
     * @private
     */
    this._asyncVersionCounter = 0

    /**
     * Monotonic token tracking active in-flight async getter resolution lock.
     * @type {number}
     * @private
     */
    this._asyncVersion = 0
  }

  /**
   * Updates the dependencies of the observed property and computes its current value.
   * Temporarily intercepts the element's dependency collector to track which state keys
   * are accessed during evaluation of the key.
   * @returns {any} The newly evaluated value of the observed state property.
   */
  updateDependenciesAndValue () {
    /** @type {any} */
    const el = this.element
    const parentCollector = el._collectingDependencies
    const prevRecord = el._activeObserverRecord

    el._activeObserverRecord = this
    this._nextDependencies.clear()
    el._collectingDependencies = this._nextDependencies

    let value
    try {
      value = el._state ? el._state[this.key] : undefined
    } finally {
      el._activeObserverRecord = prevRecord
      el._collectingDependencies = parentCollector
    }

    if (value instanceof Promise) {
      for (const dep of this.dependencies) {
        this._nextDependencies.add(dep)
      }
    }

    this.element._updateObserverSubscriptions(this, this._nextDependencies)
    return value
  }

  /**
   * Initializes the observer record by performing the first evaluation of the
   * observed state property and caching its initial value.
   * @returns {void}
   */
  init () {
    const value = this.updateDependenciesAndValue()
    this.initialized = true

    if (value instanceof Promise) {
      const version = ++this._asyncVersionCounter
      this._asyncVersion = version
      value.then((resolved) => {
        if (this._asyncVersion === version && this.element.isConnected) {
          this.lastValue = resolved
        }
      }, (err) => {
        if (err?.name !== 'AbortError') {
          console.error('Coralite Async Getter Error:', err)
        }
      })
      return
    }

    this.lastValue = value
  }

  /**
   * Evaluates the observed property and, if the value has changed since the last
   * evaluation, executes the user's observer callback.
   * Ensures protection against nested re-entry during execution.
   * @returns {void}
   */
  run () {
    const newVal = this.updateDependenciesAndValue()

    if (newVal instanceof Promise) {
      const version = ++this._asyncVersionCounter
      this._asyncVersion = version
      newVal.then(async (resolvedNew) => {
        if (this._asyncVersion !== version || !this.element.isConnected) {
          return
        }
        let oldVal = this.lastValue
        if (oldVal instanceof Promise) {
          oldVal = await oldVal
        }
        if (this._asyncVersion !== version || !this.element.isConnected || resolvedNew === oldVal) {
          return
        }
        this.lastValue = resolvedNew
        this._invokeCallback(resolvedNew, oldVal)
      }, (err) => {
        if (err?.name !== 'AbortError') {
          console.error('Coralite Async Getter Error:', err)
        }
      })
      return
    }

    this._asyncVersion = 0
    const oldVal = this.lastValue
    if (newVal !== oldVal) {
      /** @type {any} */
      const el = this.element
      /** @type {any} */
      const win = typeof window !== 'undefined' ? window : null
      /** @type {any} */
      const proc = typeof process !== 'undefined' ? process : null

      const reconcileMode = el?.componentOptions?.reconcile ||
        win?.__coralite__?.reconcile ||
        proc?.env?.CORALITE_RECONCILE ||
        'full'

      if (reconcileMode === 'minimal' && Array.isArray(oldVal) && Array.isArray(newVal)) {
        const keyFn = el?.componentOptions?.key
        const pattern = detectListPattern(oldVal, newVal, keyFn)
        if (pattern) {
          const applied = applyListPattern(this.element, this.key, pattern)
          if (applied) {
            this.lastValue = newVal
            return
          }
        }
      }

      this.lastValue = newVal
      this._invokeCallback(newVal, oldVal)
    }
  }

  /**
   * Invokes the user callback with re-entry guard.
   * @param {any} newVal - The new evaluated state property value.
   * @param {any} oldVal - The previous evaluated state property value.
   * @private
   */
  _invokeCallback (newVal, oldVal) {
    /** @type {any} */
    const el = this.element
    const wasExecuting = el._isExecutingObserver
    const prevRecord = el._activeObserverRecord
    el._isExecutingObserver = true
    el._activeObserverRecord = this
    try {
      const res = this.callback(newVal, oldVal)
      if (res && typeof res.catch === 'function') {
        res.catch((err) => {
          console.error('Coralite Observer Error:', err)
        })
      }
    } catch (err) {
      console.error('Coralite Observer Error:', err)
    } finally {
      el._isExecutingObserver = wasExecuting
      el._activeObserverRecord = prevRecord
    }
  }

  /**
   * Cleans up the observer subscriptions by removing all dependencies.
   * @returns {void}
   */
  cleanup () {
    this._asyncVersion = 0
    this._nextDependencies.clear()
    this.element._updateObserverSubscriptions(this, this._nextDependencies)
  }
}
