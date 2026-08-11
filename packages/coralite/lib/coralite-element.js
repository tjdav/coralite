import { createReadOnlyProxy } from './utils/core.js'
import { processHTML } from './utils/client/inject.js'
import { recordDevToolsEvent } from './utils/client/devtools.js'
import { ObserverRecord } from './utils/observer-record.js'

/**
 * @import {
 *  CoraliteClientPluginDisconnectedCallback,
 *  CoraliteClientPluginAfterComponentRenderCallback,
 *  CoraliteClientPluginBeforeComponentRenderCallback
 * } from '../types/plugin.js'
 */


const BOOLEAN_ATTRIBUTES = new Set([
  'allowfullscreen',
  'async',
  'autofocus',
  'autoplay',
  'checked',
  'controls',
  'default',
  'defer',
  'disabled',
  'formnovalidate',
  'hidden',
  'inert',
  'ismap',
  'itemscope',
  'loop',
  'multiple',
  'muted',
  'nomodule',
  'novalidate',
  'open',
  'playsinline',
  'readonly',
  'required',
  'reversed',
  'selected',
  'truespeed'
])

/**
 * Coerces a value to a specified type.
 * Supports Number, Boolean, and String.
 * @param {any} value - The value to coerce.
 * @param {Function|string} type - The target type (Constructor or string name).
 * @returns {any} The coerced value.
 */
export function coerce (value, type) {
  if (value === null || value === undefined) {
    return value
  }

  if (typeof value === 'string' && value.includes('{{') && value.includes('}}')) {
    return null
  }

  if (type === Number || type === 'Number') {
    const num = Number(value)
    return Number.isNaN(num) ? null : num
  }

  if (type === Boolean || type === 'Boolean') {
    if (value === '') {
      return true
    }
    return value !== 'false' && value !== null
  }

  if (type === String || type === 'String') {
    return String(value)
  }

  return value
}

/**
 * Finds the closest enclosing component/custom element of a DOM node.
 *
 * @param {any} element - The DOM node.
 * @returns {any} The enclosing custom element instance or null.
 */
export function getEnclosingComponent (element) {
  if (!element) {
    return null
  }

  let parent = element.parentElement

  while (parent) {
    if (parent._instanceId !== undefined) {
      return parent
    }

    if (parent.hasAttribute && parent.hasAttribute('data-cid')) {
      return parent
    }

    parent = parent.parentElement
  }

  return null
}

/**
 * @typedef {Object} CoraliteComponentOptions
 * @property {string} componentId - The unique identifier for the component.
 * @property {string} [templateHTML] - The raw HTML string for imperative mounting.
 * @property {Object} [defaultValues] - The initial state values extracted from the server data block.
 * @property {Object} [attributes] - Schema for coercing HTML attributes into typed primitives.
 * @property {Object.<string, Function>} [getters] - Pure functions for derived state, supporting Promises.
 * @property {Object.<string, Function>} [slots] - Transformation functions for projected Light DOM.
 * @property {Function} [client] - The client-side controller logic.
 * @property {Object} [hydrationMap] - AST mapping for reactive text nodes, attributes, and refs.
 * @property {Object} [templateValues] - Token positions for AST updates.
 */

/**
 * Base class for all Coralite custom elements.
 *
 * @augments HTMLElement
 */
export class CoraliteElement extends HTMLElement {
  /**
   * Initializes a new instance of the CoraliteElement.
   * Sets up internal state trackers, binding collections, and hook registries.
   */
  constructor () {
    super()
    /**
     * Controls native teardown of event listeners and async fetches upon disconnection.
     * @type {AbortController|null}
     * @protected
     */
    this._abortController = null

    /**
     * @type {Map<string, Set<Function>>|null}
     * @protected
     */
    this._observers = new Map()

    /**
     * Flag to detect infinite loops in state observation callback.
     * @type {boolean}
     * @protected
     */
    this._isExecutingObserver = false

    /**
     * A globally unique, deterministic identifier (e.g., `my-comp-0`).
     * @type {string|null}
     * @protected
     */
    this._instanceId = null

    /**
     * The unified, deeply reactive proxy holding attributes, data, and getters.
     * @type {Object|null}
     * @protected
     */
    this._state = null

    /**
     * The collection of DOM nodes mapped to template tokens and attributes.
     * @type {Array<{type: string, node: Node, template?: string, name?: string}>}
     * @protected
     */
    this._bindings = []

    /**
     * Flag to prevent multiple synchronous state mutations from triggering multiple DOM paints.
     * @type {boolean}
     * @protected
     */
    this._isUpdatePending = false

    /**
     * A unique Symbol generated per render cycle to prevent async getter race conditions.
     * @type {symbol|null}
     * @protected
     */
    this._currentRenderVersion = null

    /**
     * @type {MutationObserver|null}
     * @protected
     */
    this._observer = null

    /**
     * Hook to fetch globally registered Phase-2 plugin contexts.
     * @type {Function|null}
     * @protected
     */
    this._clientContextGetter = null

    /**
     * Tracks AbortControllers specifically for cancelling stale async getters.
     * @type {Object.<string, AbortController>|null}
     * @protected
     */
    this._getterAbortControllers = null

    /**
     * Internal lifecycle hooks injected by registered Coralite plugins.
     * @type {{
     *   onBeforeComponentRender: Array<CoraliteClientPluginBeforeComponentRenderCallback>,
     *   onAfterComponentRender: Array<CoraliteClientPluginAfterComponentRenderCallback>,
     *   onDisconnected: Array<CoraliteClientPluginDisconnectedCallback>
     * }}
     * @protected
     */
    this._hooks = {
      onBeforeComponentRender: [],
      onAfterComponentRender: [],
      onDisconnected: []
    }

    /**
     * The definition and schema of the component generated by the compiler.
     * @type {CoraliteComponentOptions|null}
     */
    this.componentOptions = null

    /**
     * Hydrated data passed from the server.
     * @type {Object|null}
     * @protected
     */
    this._hydrationData = null
  }

  /**
   * Invoked natively when the element is added to the document.
   * Handles the architectural split between Declarative (SSR) and Imperative (JS) components.
   * Orchestrates template injection, instance ID generation, and state/binding setup.
   */
  connectedCallback () {
    this._abortController = new AbortController()
    this._observers = new Map()
    this._isExecutingObserver = false
    this._resolutionStack = new Set()
    this._collectingDependencies = null
    this._activeObserverRecord = null
    this._subscriberMap = new Map()
    this._observerRecords = new Set()
    this._dependencyGraph = new Map()
    this._dirtyObservers = new Set()
    this._isFlushingObservers = false

    if (!this.componentOptions) {
      return
    }

    // Declarative components receive a data-cid from the server.
    // Imperative components (created via document.createElement) do not.
    const isImperative = !this.hasAttribute('data-cid')

    // Establish the Deterministic Instance ID
    if (this.hasAttribute('data-cid')) {
      this._instanceId = this.getAttribute('data-cid')
    } else {
      // Fallback counter for imperatively created components
      // @ts-ignore
      window.__coralite_instanceCounters = window.__coralite_instanceCounters || {}
      const prefix = this.componentOptions.componentId
      // @ts-ignore
      if (window.__coralite_instanceCounters[prefix] === undefined) {
        // @ts-ignore
        window.__coralite_instanceCounters[prefix] = 0
      }
      // @ts-ignore
      this._instanceId = `${prefix}-${window.__coralite_instanceCounters[prefix]++}`
    }

    // Manually stamp the template and project the Light DOM.
    if (isImperative && this.componentOptions.templateHTML) {
      const originalLightDOM = Array.from(this.childNodes)
      const stamped = processHTML(this.componentOptions.templateHTML, this._instanceId)

      this.innerHTML = this._tagOwnSlots(stamped, this._instanceId)

      if (originalLightDOM.length > 0) {
        originalLightDOM.forEach((element, i) => {
          if (element && 'setAttribute' in element && typeof element.setAttribute === 'function') {
            element.setAttribute('data-coralite-slot-index', String(i))
          }
        })

        const slots = this._getOwnSlots()
        slots.forEach(slot => {
          const slotName = slot.getAttribute('name') || 'default'
          const matchingNodes = originalLightDOM.filter(node => {
            // @ts-ignore
            const nodeSlot = (node.getAttribute && node.getAttribute('slot')) || 'default'
            return nodeSlot === slotName
          })
          matchingNodes.forEach(n => slot.appendChild(n))
        })
      }
    }

    if (isImperative) {
      this.setAttribute('data-cid', this._instanceId)
    }

    this._setupState()
    this._setupBindings()
    this._init(isImperative)
  }

  /**
   * Invoked natively when the element is removed from the document.
   * Aborts pending requests and triggers `onDisconnected` plugin hooks
   * to ensure external libraries (e.g., Observers) do not cause memory leaks.
   * @this {any}
   */
  disconnectedCallback () {
    if (this._abortController) {
      this._abortController.abort()
    }

    if (this._observers) {
      this._observers.clear()
      this._observers = null
    }

    if (this._observerRecords) {
      for (const record of this._observerRecords) {
        record.cleanup()
      }
      this._observerRecords.clear()
      this._observerRecords = null
    }

    if (this._subscriberMap) {
      this._subscriberMap.clear()
      this._subscriberMap = null
    }

    if (this._dependencyGraph) {
      this._dependencyGraph.clear()
      this._dependencyGraph = null
    }

    if (this._dirtyObservers) {
      this._dirtyObservers.clear()
      this._dirtyObservers = null
    }

    if (!this.componentOptions) {
      return
    }

    for (const hook of this._hooks.onDisconnected) {
      hook({
        state: this._state,
        instanceId: this._instanceId,
        componentId: this.componentOptions.componentId,
        element: this,
        options: this.componentOptions
      })
    }
  }

  /**
   * Invoked natively when an observed HTML attribute changes.
   * Coerces the raw string value based on the component's attribute schema
   * and synchronizes it into the reactive state proxy.
   * @param {string} name - The kebab-case name of the attribute.
   * @param {string|null} oldVal - The previous value.
   * @param {string|null} newVal - The new value.
   */
  attributeChangedCallback (name, oldVal, newVal) {
    if (!this._state || oldVal === newVal || name === 'data-cid') {
      return
    }
    const camelName = name.replace(/-([a-z])/g, (g) => g[1].toUpperCase())
    const schema = this.componentOptions.attributes?.[camelName] || this.componentOptions.attributes?.[name]
    const value = schema ? coerce(newVal, schema.type || schema) : newVal

    this._state[camelName] = value
  }

  /**
   * Constructs the unified state object.
   * Merges `defaultValues`, JSON hydration payloads, and DOM attributes.
   * Defines getters (wrapping state in a Read-Only proxy) and applies the final Read/Write Proxy.
   * @this {any}
   * @private
   */
  _setupState () {
    const options = this.componentOptions
    const target = { ...options.defaultValues }

    /** @type {Array<{name: string, element: HTMLElement}>} */
    const refs = []
    if (options.hydrationMap && options.hydrationMap.refs) {
      for (const ref of options.hydrationMap.refs) {
        const uniqueRefValue = `${this._instanceId}__${ref.name}`

        if (!target[`ref_${ref.name}`]) {
          target[`ref_${ref.name}`] = uniqueRefValue
        }

        let node = this.getAttribute('ref') === uniqueRefValue || this.getAttribute('ref') === ref.name ? this : null

        if (!node) {
          node = this.querySelector(`[ref="${uniqueRefValue}"]`)
        }

        if (!node) {
          node = Array.from(this.querySelectorAll(`[ref="${ref.name}"]`)).find(
            candidate => {
              const enc = getEnclosingComponent(candidate)
              return enc === this || (enc && enc.getAttribute && enc.getAttribute('data-cid') === this._instanceId)
            }
          ) || null
        }

        if (!node) {
          node = this.getNodeByPath(ref.path)
        }

        if (node) {
          if (node.setAttribute) {
            node.setAttribute('ref', uniqueRefValue)
          }
          refs.push({
            name: ref.name,
            element: node
          })
        }
      }
    }

    // Process initial attributes mapping
    for (const attr of this.attributes) {
      if (attr.name === 'data-cid') {
        continue
      }
      const camelName = attr.name.replace(/-([a-z])/g, (g) => g[1].toUpperCase())
      const schema = options.attributes?.[camelName] || options.attributes?.[attr.name]
      target[camelName] = schema ? coerce(attr.value, schema.type || schema) : attr.value
    }

    // Hydrate data() block results from the SSR payload
    if (this._hydrationData && this._hydrationData[this._instanceId]) {
      Object.assign(target, this._hydrationData[this._instanceId])
    }

    // Trigger Before-Render hooks BEFORE state is proxied, allowing plugins to inject reactive data
    for (const hook of this._hooks.onBeforeComponentRender) {
      hook({
        state: target,
        instanceId: this._instanceId,
        componentId: this.componentOptions.componentId,
        refs,
        element: this,
        options: this.componentOptions
      })
    }

    // Define derived state getters with isolation controllers
    this._getterAbortControllers = {}
    for (const [key, getter] of Object.entries(options.getters || {})) {
      Object.defineProperty(target, key, {
        get: () => {
          if (this._getterAbortControllers[key]) {
            this._getterAbortControllers[key].abort()
          }
          this._getterAbortControllers[key] = new AbortController()

          // Enforce "Dual-Proxy" safety: Getters cannot mutate state
          const tracker = {
            activeCollector: (p) => {
              if (this._collectingDependencies && typeof p === 'string') {
                this._collectingDependencies.add(p)
              }
            }
          }
          const roState = createReadOnlyProxy(this._state, new WeakMap(), tracker)
          return getter(roState, { signal: this._getterAbortControllers[key].signal })
        },
        enumerable: true,
        configurable: true
      })
    }

    this._state = this._createReactiveProxy(target)
    this._registerSlotStateObserver()
  }

  /**
   * Wraps the state target in a reactive Proxy.
   * Intercepts property setters to automatically batch and schedule DOM updates.
   * @param {Object} target - The state dictionary.
   * @returns {Proxy} The reactive state proxy.
   * @internal
   */
  _createReactiveProxy (target) {
    const self = this
    const options = this.componentOptions
    if (!options) {
      return target
    }

    const getGetterFn = (key) => {
      if (key.startsWith('slots_method_')) {
        return null
      }
      if (options.getters && key in options.getters) {
        return options.getters[key]
      }
      if (options.slots && key in options.slots) {
        return null
      }
      if (key === 'constructor' || key === 'toString' || key === 'valueOf' || key === 'hasOwnProperty') {
        return null
      }
      if (Object.prototype.hasOwnProperty.call(target, key) && typeof target[key] === 'function') {
        return target[key]
      }
      return null
    }

    return new Proxy(target, {
      get (t, p, receiver) {
        if (typeof p !== 'string') {
          return Reflect.get(t, p, receiver)
        }

        const getterFn = getGetterFn(p)
        if (getterFn) {
          const getterKey = p

          if (self._resolutionStack.has(getterKey)) {
            throw new Error(`Circular dependency detected: ${[...self._resolutionStack].join(' → ')} → ${getterKey}`)
          }

          self._resolutionStack.add(getterKey)

          let directDeps = new Set()
          const parentCollecting = self._collectingDependencies
          self._collectingDependencies = directDeps

          let value
          try {
            if (options.getters && getterKey in options.getters) {
              value = Reflect.get(t, p, receiver)
            } else {
              value = getterFn(self._state)
            }
          } finally {
            self._collectingDependencies = parentCollecting
            self._resolutionStack.delete(getterKey)
          }

          if (self._collectingDependencies) {
            for (const dep of directDeps) {
              self._collectingDependencies.add(dep)
            }
          }

          // Async Getter Promise Handling
          if (value instanceof Promise) {
            value.then(() => {
              if (self._activeObserverRecord) {
                const record = self._activeObserverRecord
                const asyncDeps = new Set()
                const originalCollector = self._collectingDependencies
                self._collectingDependencies = asyncDeps
                try {
                  if (options.getters && getterKey in options.getters) {
                    Reflect.get(t, p, receiver)
                  } else {
                    getterFn(self._state)
                  }
                } finally {
                  self._collectingDependencies = originalCollector
                }
                self._updateObserverSubscriptions(record, asyncDeps)
              }
            })
          }

          return value
        }

        const value = Reflect.get(t, p, receiver)

        if (self._collectingDependencies) {
          self._collectingDependencies.add(p)
        }

        return value
      },

      set (t, p, v) {
        const oldValue = t[p]
        if (oldValue === v) {
          return true
        }

        if (typeof p === 'string') {
          const mode = (typeof window !== 'undefined' && window['__coralite__'] && window['__coralite__'].mode) || 'production'

          if (mode === 'development' && self._isExecutingObserver) {
            console.warn('[Coralite Warning]: State mutation detected inside an observe() callback. This can cause infinite reactivity loops. Use getters for derived state instead.')
          }
        }

        t[p] = v
        self._scheduleUpdate()

        if (typeof p === 'string' && self.componentOptions?.slots && Object.keys(self.componentOptions.slots).length > 0) {
          const hasRecord = self._observerRecords && Array.from(self._observerRecords).some(rec => rec.key === p)
          if (!hasRecord) {
            self._observeStateKey(p, () => self._processSlots())
          }
        }

        if (typeof p === 'string') {
          self._markObserverDirty(p)
        }

        return true
      }
    })
  }

  /**
   * Traverses the DOM tree using an AST-generated path index array.
   * Allows O(1) element lookups without relying on querySelectors or classes.
   * @param {number[]} path - Array of childNode indices (e.g., `[0, 1, 2]`).
   * @returns {Node|null} The physical DOM node, or null if traversal fails.
   */
  getNodeByPath (path) {
    let node = this
    for (const index of path) {
      if (!node) {
        return null
      }
      if (node !== this && node.tagName && node.tagName.includes('-')) {
        // 1. Try to find the physical projected child by data-coralite-slot-index first
        const candidates = node.querySelectorAll(`[data-coralite-slot-index="${index}"]`)
        let foundNode = null
        for (const cand of candidates) {
          let parentComponent = cand.parentElement
          while (parentComponent && parentComponent !== node) {
            if (parentComponent.tagName && parentComponent.tagName.includes('-')) {
              break
            }
            parentComponent = parentComponent.parentElement
          }
          if (parentComponent === node) {
            foundNode = cand
            break
          }
        }
        if (foundNode) {
          // @ts-ignore
          node = foundNode
          continue
        }

        // 2. Fallback to original slots traversal, with fallback-skipping added
        const slots = []
        const traverse = (current) => {
          if (!current) {
            return
          }
          if (current !== node && current.tagName && current.tagName.includes('-')) {
            return
          }
          if (current.tagName === 'SLOT') {
            slots.push(current)
            return
          }
          const children = current.childNodes || []
          for (let i = 0; i < children.length; i++) {
            traverse(children[i])
          }
        }
        traverse(node)

        const lightChildren = []
        for (let i = 0; i < slots.length; i++) {
          const slot = slots[i]
          let isFallback = slot.hasAttribute('data-coralite-fallback')
          if (!isFallback && node.componentOptions?.slots && Object.keys(node.componentOptions.slots).length > 0) {
            let hasElements = false
            let hasSlotIndex = false
            for (let j = 0; j < slot.childNodes.length; j++) {
              const child = slot.childNodes[j]
              if (child.nodeType === 1) {
                hasElements = true
                if (child.hasAttribute('data-coralite-slot-index') || child.querySelector('[data-coralite-slot-index]')) {
                  hasSlotIndex = true
                }
              }
            }
            if (hasElements && !hasSlotIndex) {
              isFallback = true
            }
          }
          if (isFallback) {
            continue
          }

          for (let j = 0; j < slot.childNodes.length; j++) {
            lightChildren.push(slot.childNodes[j])
          }
        }

        if (lightChildren.length > 0) {
          node = lightChildren[index]
          continue
        }
      }
      // @ts-ignore
      node = node.childNodes[index]
    }
    return node
  }

  /**
   * Initializes DOM bindings based on the compiler's hydration map.
   * Caches physical DOM references to text nodes and attributes that contain template tokens.
   * @private
   */
  _setupBindings () {
    this._bindings = []
    const map = this.componentOptions.hydrationMap
    if (!map) {
      return
    }

    if (map.texts) {
      for (const item of map.texts) {
        const node = this.getNodeByPath(item.path)
        if (node) {
          this._bindings.push({
            type: item.type || 'text',
            node,
            template: item.template
          })
        }
      }
    }

    if (map.attributes) {
      for (const item of map.attributes) {
        const node = this.getNodeByPath(item.path)
        if (node) {
          this._bindings.push({
            type: 'attribute',
            node,
            name: item.name,
            template: item.template
          })
        }
      }
    }
  }

  /**
   * Schedules a DOM update in the next microtask queue.
   * This guarantees that multiple synchronous state mutations result in only one render pass.
   * @private
   */
  _scheduleUpdate () {
    if (this._isUpdatePending) {
      return
    }
    this._isUpdatePending = true
    queueMicrotask(() => {
      this._updateDOM()
      this._isUpdatePending = false
    })
  }

  /**
   * Performs the physical DOM update and resolves template tokens.
   * **Async Safety:** Implements a Symbol-based locking mechanism (`renderVersion`)
   * to guarantee that if state mutates while an async getter is pending, the stale
   * Promise will be discarded, preventing DOM race conditions.
   * @this {any}
   * @private
   */
  _updateDOM () {
    // Create a unique lock for this specific render cycle
    const renderVersion = Symbol()
    this._currentRenderVersion = renderVersion

    // Extract unique tokens to prevent double-reading and accidental aborts
    /** @type {Set<string>} */
    const requiredTokens = new Set()
    for (const binding of this._bindings) {
      binding.template.replace(/\{\{\s*(.+?)\s*\}\}/g, (_, key) => {
        requiredTokens.add(key)
        return ''
      })
    }

    const evaluatedTokens = {}
    let hasPromise = false

    // Evaluate getters exactly once per render cycle
    for (const key of requiredTokens) {
      let val = this._state[key]
      if (typeof val === 'function') {
        val = val(this._state)
      }
      evaluatedTokens[key] = val
      if (val instanceof Promise) {
        hasPromise = true
      }
    }

    // The DOM Mutator Function
    const applyBindings = (tokenValues) => {
      // Race Condition Lock: Abort if a newer render cycle has already begun
      if (this._currentRenderVersion !== renderVersion) {
        return
      }

      for (const binding of this._bindings) {
        const hydratedValue = binding.template.replace(/\{\{\s*(.+?)\s*\}\}/g, (_, key) => {
          return tokenValues[key] ?? ''
        })

        if (binding.type === 'text') {
          if (binding.node.textContent !== hydratedValue) {
            binding.node.textContent = hydratedValue
          }
        } else if (binding.type === 'html') {
          /** @type {HTMLElement} */
          // @ts-ignore
          const element = binding.node

          if (element.innerHTML !== hydratedValue) {
            element.innerHTML = hydratedValue
          }
        } else if (binding.type === 'attribute') {
          /** @type {HTMLElement} */
          // @ts-ignore
          const element = binding.node

          if (BOOLEAN_ATTRIBUTES.has(binding.name)) {
            const isFalsy = hydratedValue === '' || hydratedValue === 'false' || hydratedValue === 'null' || hydratedValue === '0' || hydratedValue === 'undefined'
            if (isFalsy) {
              element.removeAttribute(binding.name)
            } else {
              element.setAttribute(binding.name, '')
            }
          } else {
            if (element.getAttribute(binding.name) !== hydratedValue) {
              element.setAttribute(binding.name, hydratedValue)
            }
          }
        }
      }

      if (this.componentOptions.slots && Object.keys(this.componentOptions.slots).length > 0) {
        this._processSlots()
      }

      // Trigger After-Render hooks ONLY after the physical DOM is stable
      for (const hook of this._hooks.onAfterComponentRender) {
        hook({
          state: this._state,
          instanceId: this._instanceId,
          componentId: this.componentOptions.componentId,
          element: this,
          options: this.componentOptions
        })
      }

      // @ts-ignore
      if (window.__coralite__ && window.__coralite__.lifecycle) {
        // @ts-ignore
        window.__coralite__.lifecycle._markInstanceRendered(this)
      }
    }

    // Await Promises or Apply Synchronously
    if (hasPromise) {
      const keys = Object.keys(evaluatedTokens)
      const promises = keys.map(k => Promise.resolve(evaluatedTokens[k]))

      Promise.all(promises).then(resolvedValues => {
        const resolvedMap = {}
        keys.forEach((k, i) => {
          resolvedMap[k] = resolvedValues[i]
        })
        applyBindings(resolvedMap)
      }).catch(e => {
        if (e.name !== 'AbortError') {
          console.error('Coralite Async Getter Error:', e)
        }
      })
    } else {
      applyBindings(evaluatedTokens)
    }
  }

  /**
   * Registers an observer for a specific state key with automatic lifecycle cleanup.
   * @param {string} key - The state property key to observe.
   * @param {Function} callback - The observer callback.
   * @protected
   */
  _observeStateKey (key, callback) {
    if (!this._observerRecords) {
      this._observerRecords = new Set()
    }

    const record = new ObserverRecord(key, callback, this)
    this._observerRecords.add(record)
    record.init()

    if (this._abortController && this._abortController.signal) {
      this._abortController.signal.addEventListener('abort', () => {
        if (this._observerRecords && this._observerRecords.has(record)) {
          record.cleanup()
          this._observerRecords.delete(record)
        }
      })
    }
  }

  /**
   *
   */
  _updateObserverSubscriptions (record, newDeps) {
    if (!this._subscriberMap) {
      this._subscriberMap = new Map()
    }

    for (const oldDep of record.dependencies) {
      if (!newDeps.has(oldDep)) {
        const subs = this._subscriberMap.get(oldDep)
        if (subs) {
          subs.delete(record)
          if (subs.size === 0) {
            this._subscriberMap.delete(oldDep)
          }
        }
      }
    }

    for (const newDep of newDeps) {
      if (!record.dependencies.has(newDep)) {
        if (!this._subscriberMap.has(newDep)) {
          this._subscriberMap.set(newDep, new Set())
        }
        this._subscriberMap.get(newDep).add(record)
      }
    }

    record.dependencies = newDeps

    if (!this._dependencyGraph) {
      this._dependencyGraph = new Map()
    }
    this._dependencyGraph.set(record.key, newDeps)
  }

  /**
   *
   */
  _markObserverDirty (stateKey) {
    if (!this._subscriberMap) {
      return
    }

    const records = this._subscriberMap.get(stateKey)
    if (records) {
      for (const record of records) {
        if (!this._dirtyObservers) {
          this._dirtyObservers = new Set()
        }
        this._dirtyObservers.add(record)
      }
      this._scheduleObserversFlush()
    }
  }

  /**
   *
   */
  _scheduleObserversFlush () {
    if (this._isFlushingObservers) {
      return
    }
    this._isFlushingObservers = true
    queueMicrotask(() => {
      this._flushDirtyObservers()
    })
  }

  /**
   *
   */
  _flushDirtyObservers () {
    if (!this._dirtyObservers || this._dirtyObservers.size === 0) {
      this._isFlushingObservers = false
      return
    }

    const observers = Array.from(this._dirtyObservers)
    this._dirtyObservers.clear()
    this._isFlushingObservers = false

    observers.forEach(obs => {
      obs.run()
    })
  }

  /**
   * Subscribes _processSlots to all state property mutations if computed slots are defined.
   * @protected
   */
  _registerSlotStateObserver () {
    const slots = this.componentOptions?.slots
    if (!slots || Object.keys(slots).length === 0) {
      return
    }

    if (this._state && typeof this._state === 'object') {
      Object.keys(this._state).forEach(key => {
        this._observeStateKey(key, () => {
          this._processSlots()
        })
      })
    }
  }

  /**
   * Helper to tag `<slot>` tags with the instanceId of the component owner.
   * @param {string} html - Stamped HTML string
   * @param {string} instanceId - The owner component's unique ID
   * @returns {string}
   * @private
   */
  _tagOwnSlots (html, instanceId) {
    if (typeof document === 'undefined') {
      return html
    }
    const template = document.createElement('template')
    template.innerHTML = html
    const slots = template.content.querySelectorAll('slot')
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i]
      if (!slot.hasAttribute('data-coralite-owner')) {
        slot.setAttribute('data-coralite-owner', instanceId)
      }
    }
    return template.innerHTML
  }

  /**
   * Retrieves `<slot>` elements that belong directly to this custom element instance,
   * ignoring `<slot>` elements nested inside child custom elements.
   * @returns {HTMLSlotElement[]}
   * @private
   */
  _getOwnSlots () {
    const allSlots = Array.from(this.querySelectorAll('slot'))
    const ownId = this.getAttribute('data-cid') || this._instanceId
    return allSlots.filter(slotEl => {
      if (slotEl.hasAttribute('data-coralite-owner')) {
        return slotEl.getAttribute('data-coralite-owner') === ownId
      }
      // Legacy fallback for hydrated/untagged trees
      let host = slotEl.parentElement
      while (host && host !== this) {
        if (host.hasAttribute?.('data-cid') || host.hasAttribute?.('is') || (host.tagName && host.tagName.includes('-'))) {
          return false
        }
        host = host.parentElement
      }
      return host === this
    })
  }

  /**
   * Evaluates and projects Light DOM elements into their respective `<slot>` nodes.
   * Invokes component-specific slot transformation functions.
   * @private
   */
  _processSlots () {
    const slots = this.componentOptions.slots
    if (!slots || Object.keys(slots).length === 0) {
      return
    }

    const slotElements = this._getOwnSlots()
    slotElements.forEach(slotEl => {
      const slotName = slotEl.getAttribute('name') || 'default'
      const slotFn = slots[slotName]

      if (slotFn) {
        // @ts-ignore
        if (!slotEl._originalNodes) {
          // @ts-ignore
          slotEl._originalNodes = Array.from(slotEl.childNodes).map(n => n.cloneNode(true))
        }

        // @ts-ignore
        const result = slotFn(slotEl._originalNodes, this._state)

        if (result === undefined) {
          return
        }

        if (result === null || result === '' || (Array.isArray(result) && result.length === 0)) {
          slotEl.innerHTML = ''
          return
        }

        if (typeof result === 'string') {
          slotEl.innerHTML = result
        } else if (Array.isArray(result)) {
          slotEl.replaceChildren(...result)
        }
      }
    })
  }

  /**
   * The final initialization pipeline.
   * Injects globally registered client plugins into the local context payload,
   * triggers the initial DOM render, and invokes the user's `script()` logic.
   * @param {boolean} [isImperative=false] - If true, initial render runs synchronously.
   * @private
   */
  async _init (isImperative = false) {
    const self = this

    const signal = this._abortController.signal

    // Hook up AbortSignal to nuke/cleanup observers to prevent memory leaks
    signal.addEventListener('abort', () => {
      if (self._observers) {
        self._observers.clear()
        self._observers = null
      }
      if (self._observerRecords) {
        for (const record of self._observerRecords) {
          record.cleanup()
        }
        self._observerRecords.clear()
        self._observerRecords = null
      }
      if (self._subscriberMap) {
        self._subscriberMap.clear()
        self._subscriberMap = null
      }
      if (self._dependencyGraph) {
        self._dependencyGraph.clear()
        self._dependencyGraph = null
      }
      if (self._dirtyObservers) {
        self._dirtyObservers.clear()
        self._dirtyObservers = null
      }
    })

    const observe = (key, callback) => {
      self._observeStateKey(key, callback)
    }

    /**
     * The context payload injected into the user's script block.
     * @type {Object}
     */
    let localContext = {
      instanceId: this._instanceId,
      state: this._state,
      root: this,
      signal: this._abortController.signal,
      refs (id) {
        const refId = self._state[`ref_${id}`]
        if (!refId && typeof refId !== 'string') {
          return null
        }

        if (self.getAttribute('ref') === refId || self.getAttribute('ref') === id) {
          return self
        }

        let node = self.querySelector(`[ref="${refId}"]`)

        if (!node) {
          node = Array.from(self.querySelectorAll(`[ref="${id}"]`)).find(
            candidate => {
              const enc = getEnclosingComponent(candidate)
              return enc === self || (enc && enc.getAttribute && enc.getAttribute('data-cid') === self._instanceId)
            }
          ) || null
        }

        return node
      },
      observe
    }

    if (typeof this._clientContextGetter === 'function') {
      localContext = await this._clientContextGetter(localContext)
    }

    if (isImperative) {
      this._updateDOM()
    } else {
      this._scheduleUpdate()
    }

    // @ts-ignore
    const isDevOrTest = typeof import.meta.env !== 'undefined'
      // @ts-ignore
      ? import.meta.env.MODE !== 'production'
      : true

    if (isDevOrTest) {
      const options = this.componentOptions
      this[Symbol.for('coralite.testing')] = {
        instanceId: this._instanceId,
        componentId: options.componentId,
        state: this._state,
        getters: new Proxy({}, {
          get (target, prop) {
            if (typeof prop === 'string' && options.getters && prop in options.getters) {
              return self._state[prop]
            }
            return undefined
          },
          ownKeys () {
            return Object.keys(options.getters || {})
          },
          getOwnPropertyDescriptor (target, prop) {
            if (typeof prop === 'string' && options.getters && prop in options.getters) {
              return {
                enumerable: true,
                configurable: true
              }
            }
            return undefined
          }
        }),
        refs: new Proxy({}, {
          get (target, prop) {
            if (typeof prop !== 'string') {
              return undefined
            }
            const refId = self._state[`ref_${prop}`]
            if (!refId && typeof refId !== 'string') {
              return null
            }
            if (self.getAttribute('ref') === refId || self.getAttribute('ref') === prop) {
              return self
            }
            let node = self.querySelector(`[ref="${refId}"]`)
            if (!node) {
              node = Array.from(self.querySelectorAll(`[ref="${prop}"]`)).find(
                candidate => {
                  const enc = getEnclosingComponent(candidate)
                  return enc === self || (enc && enc.getAttribute && enc.getAttribute('data-cid') === self._instanceId)
                }
              ) || null
            }
            return node
          },
          ownKeys () {
            const keys = new Set()
            if (options.hydrationMap?.refs) {
              for (const ref of options.hydrationMap.refs) {
                keys.add(ref.name)
              }
            }
            if (options.templateValues?.refs) {
              for (const ref of options.templateValues.refs) {
                keys.add(ref.name)
              }
            }
            const elements = self.querySelectorAll('[ref]')
            for (const el of elements) {
              const refAttr = el.getAttribute('ref')
              if (refAttr) {
                const prefix = `${self._instanceId}__`
                if (refAttr.startsWith(prefix)) {
                  keys.add(refAttr.slice(prefix.length))
                } else {
                  keys.add(refAttr)
                }
              }
            }
            return Array.from(keys)
          },
          getOwnPropertyDescriptor () {
            return {
              enumerable: true,
              configurable: true
            }
          }
        })
      }
    }

    if (this.componentOptions.client) {
      try {
        await this.componentOptions.client(localContext)
      } catch (error) {
        console.error(`Coralite Error: Component "${this.componentOptions.componentId}" script failed:`, error)
        if (isDevOrTest) {
          const fatalError = new Error(`Coralite Component Error: Component "${this.componentOptions.componentId}" (${this._instanceId}) client() block failed: ${error.message}`)
          fatalError.stack = error.stack

          if (typeof window['showCoraliteError'] === 'function') {
            window['showCoraliteError'](fatalError)
          } else {
            const overlay = document.createElement('div')
            overlay.style = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(255,0,0,0.9);color:white;padding:20px;z-index:10000;font-family:monospace;white-space:pre-wrap;overflow:auto;'
            overlay.innerHTML = `<h1>Coralite Component Error</h1><p>${fatalError.message}</p><pre>${fatalError.stack}</pre>`
            document.body.appendChild(overlay)
          }
          throw fatalError
        }
      }
    }

    // @ts-ignore
    if (window.__coralite__ && window.__coralite__.lifecycle) {
      // @ts-ignore
      window.__coralite__.lifecycle._markInstanceReady(this)
    }
  }
}

/**
 * Factory function to create a Coralite element class.
 * It dynamically defines the class, including observed attributes and hook initialization.
 * @param {CoraliteComponentOptions} options - Component options and metadata.
 * @param {Function|null} [contextGetter=null] - Optional function to retrieve client-side plugin context.
 * @param {Object} [hooks={}] - Lifecycle hooks to register.
 * @param {Array<CoraliteClientPluginBeforeComponentRenderCallback>} [hooks.onBeforeComponentRender] - Hooks to run before render.
 * @param {Array<CoraliteClientPluginAfterComponentRenderCallback>} [hooks.onAfterComponentRender] - Hooks to run after render.
 * @param {Array<CoraliteClientPluginDisconnectedCallback>} [hooks.onDisconnected] - Hooks to run after render.
 * @param {Object|null} [hydrationData=null] - Hydrated data passed from the server.
 * @returns {typeof CoraliteElement} A new CoraliteElement subclass.
 */
export function createCoraliteClass (options, contextGetter = null, hooks = {}, hydrationData = null) {
  return class extends CoraliteElement {
    /**
     * The attributes to observe for changes.
     * @returns {string[]} Array of attribute names.
     */
    static get observedAttributes () {
      if (!options.attributes) {
        return []
      }
      return Object.keys(options.attributes).map(key => key.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
      )
    }

    /**
     * Initializes the dynamic Coralite element.
     */
    constructor () {
      super()

      const self = this
      // Override dispatchEvent to intercept all CustomEvents
      const originalDispatchEvent = this.dispatchEvent
      this.dispatchEvent = function (event) {
        // @ts-ignore
        const isDevOrTest = typeof import.meta.env !== 'undefined'
          // @ts-ignore
          ? import.meta.env.MODE !== 'production'
          : true

        if (isDevOrTest && event instanceof CustomEvent) {
          recordDevToolsEvent({
            name: event.type,
            detail: event.detail,
            sourceComponentId: self._instanceId,
            sourceTagName: self.tagName.toLowerCase(),
            timestamp: Date.now()
          })
        }
        return originalDispatchEvent.call(this, event)
      }
      this.componentOptions = options
      this._clientContextGetter = contextGetter
      this._hydrationData = hydrationData
      this._hooks = {
        onBeforeComponentRender: hooks.onBeforeComponentRender || [],
        onAfterComponentRender: hooks.onAfterComponentRender || [],
        onDisconnected: hooks.onDisconnected || []
      }
    }
  }
}
