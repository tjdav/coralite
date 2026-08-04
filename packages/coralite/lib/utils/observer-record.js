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
     * The last evaluated value of the observed state property.
     * @type {any}
     */
    this.lastValue = undefined

    /**
     * Indicates whether the observer record has been initialized.
     * @type {boolean}
     */
    this.initialized = false
  }

  /**
   * Updates the dependencies of the observed property and computes its current value.
   * Temporarily intercepts the element's dependency collector to track which state keys
   * are accessed during evaluation of the key.
   * @returns {any} The newly evaluated value of the observed state property.
   */
  updateDependenciesAndValue () {
    // @ts-ignore
    const parentCollector = this.element._collectingDependencies
    // @ts-ignore
    this.element._activeObserverRecord = this
    const dependencies = new Set()
    // @ts-ignore
    this.element._collectingDependencies = dependencies

    let value
    try {
      // @ts-ignore
      value = this.element._state[this.key]
    } finally {
      // @ts-ignore
      this.element._activeObserverRecord = parentCollector ? null : this.element._activeObserverRecord
      // @ts-ignore
      this.element._collectingDependencies = parentCollector
    }

    this.element._updateObserverSubscriptions(this, dependencies)
    return value
  }

  /**
   * Initializes the observer record by performing the first evaluation of the
   * observed state property and caching its initial value.
   * @returns {void}
   */
  init () {
    this.lastValue = this.updateDependenciesAndValue()
    this.initialized = true
  }

  /**
   * Evaluates the observed property and, if the value has changed since the last
   * evaluation, executes the user's observer callback.
   * Ensures protection against nested re-entry during execution.
   * @returns {void}
   */
  run () {
    const newVal = this.updateDependenciesAndValue()
    const oldVal = this.lastValue
    if (newVal !== oldVal) {
      this.lastValue = newVal
      // @ts-ignore
      const wasExecuting = this.element._isExecutingObserver
      // @ts-ignore
      this.element._isExecutingObserver = true
      try {
        this.callback(newVal, oldVal)
      } finally {
        // @ts-ignore
        this.element._isExecutingObserver = wasExecuting
      }
    }
  }

  /**
   * Cleans up the observer subscriptions by removing all dependencies.
   * @returns {void}
   */
  cleanup () {
    this.element._updateObserverSubscriptions(this, new Set())
  }
}
