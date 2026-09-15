/**
 * @import {CoraliteElement} from '../coralite-element.js'
 */

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
     * Monotonic token tracking active in-flight async getter resolution.
     * @type {symbol|null}
     * @protected
     */
    this._asyncVersion = null
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
      const version = Symbol('observer-init')
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
      const version = Symbol('observer-run')
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

    this._asyncVersion = null
    const oldVal = this.lastValue
    if (newVal !== oldVal) {
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
    this._asyncVersion = null
    this._nextDependencies.clear()
    this.element._updateObserverSubscriptions(this, this._nextDependencies)
  }
}
