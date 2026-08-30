import { createReadOnlyProxy, normalizeStyleKey, camelToKebab } from './utils/core.js'
import { processHTML } from './utils/client/inject.js'
import { recordDevToolsEvent } from './utils/client/devtools.js'
import { ObserverRecord } from './utils/observer-record.js'
import { CoraliteError } from './utils/errors.js'
import { BOOLEAN_ATTRIBUTES } from './utils/tags.js'
import {
  RESERVED_DOM_ATTRIBUTES,
  validateAttributeValue
} from './utils/attributes.js'
import {
  findOwnedRefNode
} from './utils/client/dom.js'

export {
  RESERVED_DOM_ATTRIBUTES,
  normalizeErrorMessage,
  inferTypeFromValues,
  executeAttributeValidator,
  validateAttributeValue,
  coerce
} from './utils/attributes.js'

export {
  getEnclosingComponent,
  isOwnedByComponent,
  findOwnedRefNode
} from './utils/client/dom.js'

/**
 * @import {
 *  CoraliteClientPluginDisconnectedCallback,
 *  CoraliteClientPluginAfterComponentRenderCallback,
 *  CoraliteClientPluginBeforeComponentRenderCallback
 * } from '../types/plugin.js'
 */

/**
 * @typedef {Object} CoraliteComponentOptions
 * @property {string} componentId - The unique identifier for the component.
 * @property {string} [templateHTML] - The raw HTML string for imperative mounting.
 * @property {Object} [defaultValues] - The initial state values extracted from the server data block.
 * @property {Object} [attributes] - Schema for coercing HTML attributes into typed primitives.
 * @property {Object.<string, Function>} [getters] - Pure functions for derived state, supporting Promises.
 * @property {Object.<string, Function>} [slots] - Transformation functions for projected Light DOM.
 * @property {Object.<string, ((state: any) => string | number | null | undefined | false) | string | number>} [style] - Reactive style definitions and CSS custom properties.
 * @property {Function} [client] - The client-side controller logic.
 * @property {Object} [hydrationMap] - AST mapping for reactive text nodes, attributes, and refs.
 * @property {Object} [templateValues] - Token positions for AST updates.
 */

/** @type {any} */
const FallbackElement = class {
}

/** @type {typeof HTMLElement} */
const BaseElement = typeof HTMLElement !== 'undefined' ? HTMLElement : FallbackElement

/**
 * Base class for all Coralite custom elements.
 *
 * @augments BaseElement
 */
export class CoraliteElement extends BaseElement {
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
     * @type {Array<{type: string, node: Node, path?: number[], template?: string, name?: string}>}
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

    /**
     * Set of internal root elements from template stamping.
     * @type {Set<Node>|null}
     * @protected
     */
    this._templateRoots = null

    /**
     * Monotonic index counter for Light DOM slot indexing.
     * @type {number}
     * @protected
     */
    this._nextSlotIndex = 0

    /**
     * Per-instance MutationObserver for dynamic Light DOM slot reconciliation.
     * @type {MutationObserver|null}
     * @protected
     */
    this._slotObserver = null

    /**
     * Guard flag to prevent infinite loops during slot reconciliation.
     * @type {boolean}
     * @protected
     */
    this._isReconcilingSlots = false

    /**
     * Cached resolved client context after plugin resolution.
     * @type {Object|null}
     * @protected
     */
    this._resolvedClientContext = null

    /**
     * Flag indicating client context and plugins are fully resolved for slot execution.
     * @type {boolean}
     * @protected
     */
    this._slotRuntimeReady = false

    /**
     * Flag indicating _processSlots should execute once runtime becomes ready.
     * @type {boolean}
     * @protected
     */
    this._processSlotsOnReady = false

    /**
     * Map tracking slots that have registered internal state observers.
     * @type {Map<string, boolean>|null}
     * @protected
     */
    this._slotHasInternalObservers = null

    /**
     * Per-instance MutationObserver for testing.refs ownKeys cache invalidation.
     * @type {MutationObserver|null}
     * @protected
     */
    this._refsKeysObserver = null

    /**
     * Flag indicating if testing.refs ownKeys cache is dirty.
     * @type {boolean}
     * @protected
     */
    this._refsKeysDirty = true

    /**
     * Cached list of ref keys for testing.refs proxy ownKeys.
     * @type {string[]|null}
     * @protected
     */
    this._refsKeysCache = null

    /**
     * Fast-path flag indicating if the component has active DOM bindings, reactive styles, slots, or after-render hooks.
     * @type {boolean}
     * @protected
     */
    this._needsDOMUpdate = false

    /**
     * Set tracking state keys that have slot observation registered.
     * @type {Set<string>|null}
     * @protected
     */
    this._slotObservedKeys = null

    /**
     * Cached scratch buffer array for running dirty observers without allocations.
     * @type {Array<ObserverRecord>|null}
     * @protected
     */
    this._dirtyObserversBuffer = null

    /**
     * Cached flag indicating whether Coralite client runtime is running in development mode.
     * @type {boolean}
     * @protected
     */
    this._isDevMode = false
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
    this._slotObservedKeys = new Set()
    this._dirtyObserversBuffer = []
    this._isDevMode = typeof window !== 'undefined' && Boolean(window['__coralite__']) && window['__coralite__'].mode === 'development'

    if (!this.componentOptions) {
      return
    }

    // Declarative components receive a data-cid from the server.
    // Imperative components (created via document.createElement) do not.
    const isImperative = !this.hasAttribute('data-cid')

    if (!isImperative && !this._templateRoots) {
      this._templateRoots = new Set(this.childNodes)
    }

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
      this._templateRoots = new Set(this.childNodes)

      if (originalLightDOM.length > 0) {
        originalLightDOM.forEach(node => this.appendChild(node))
      }
    } else if (isImperative && !this._templateRoots) {
      this._templateRoots = new Set(this.childNodes)
    }

    if (isImperative) {
      this.setAttribute('data-cid', this._instanceId)
    }

    this._nextSlotIndex = this._getMaxSlotIndex() + 1
    this._resolvedClientContext = null
    this._slotRuntimeReady = false
    this._processSlotsOnReady = false
    this._slotHasInternalObservers = new Map()

    this._setupState()
    this._setupBindings()
    this._needsDOMUpdate = Boolean(
      (this._bindings && this._bindings.length > 0) ||
      (this.componentOptions?.style && typeof this.componentOptions.style === 'object' && Object.keys(this.componentOptions.style).length > 0) ||
      (this.componentOptions?.slots && Object.keys(this.componentOptions.slots).length > 0) ||
      (this._hooks && this._hooks.onAfterComponentRender && this._hooks.onAfterComponentRender.length > 0)
    )
    this._init(isImperative)

    if (this._getOwnSlots().length > 0) {
      this._setupSlotObserver()
      this._reconcileLightDOM()
    }
  }

  /**
   * Invoked natively when the element is removed from the document.
   * Aborts pending requests and triggers `onDisconnected` plugin hooks
   * to ensure external libraries (e.g., Observers) do not cause memory leaks.
   * @this {any}
   */
  disconnectedCallback () {
    if (this._slotObserver) {
      this._slotObserver.disconnect()
      this._slotObserver = null
    }

    if (this._refsKeysObserver) {
      this._refsKeysObserver.disconnect()
      this._refsKeysObserver = null
      this._refsKeysDirty = true
    }

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

    if (this._slotHasInternalObservers) {
      this._slotHasInternalObservers.clear()
      this._slotHasInternalObservers = null
    }

    if (this._slotObservedKeys) {
      this._slotObservedKeys.clear()
      this._slotObservedKeys = null
    }

    this._dirtyObserversBuffer = null
    this._isDevMode = false

    this._slotRuntimeReady = false
    this._processSlotsOnReady = false

    const ownSlots = this._getOwnSlots()
    ownSlots.forEach(slotEl => {
      // @ts-ignore
      slotEl._slotEvaluated = false
    })

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
    const kebabName = camelToKebab(camelName)
    const schema = this.componentOptions.attributes?.[camelName] || this.componentOptions.attributes?.[name]

    if (schema) {
      const res = validateAttributeValue(newVal === null ? undefined : newVal, schema, camelName, this.componentOptions?.componentId, {
        instanceId: this._instanceId,
        graceful: true
      })
      if (res.error) {
        this._state.errors[camelName] = res.error
        this._state['error_' + camelName] = res.error
        this._state['error_' + kebabName] = res.error
        this._state[camelName] = res.value !== undefined ? res.value : newVal
      } else {
        delete this._state.errors[camelName]
        this._state['error_' + camelName] = ''
        this._state['error_' + kebabName] = ''
        if (res.value === undefined) {
          delete this._state[camelName]
        } else {
          this._state[camelName] = res.value
        }
      }
    } else {
      if (newVal === null) {
        delete this._state[camelName]
      } else {
        this._state[camelName] = newVal
      }
    }
  }

  /**
   * Constructs the unified state object.
   * Merges `defaultValues`, JSON hydration payloads, and DOM attributes.
   * Defines getters (wrapping state in a Read-Only proxy) and applies the final Read/Write Proxy.
   * @this {any}
   * @private
   */
  _setupState () {
    if (!this.hasAttribute('data-cid') && this._instanceId) {
      this.setAttribute('data-cid', this._instanceId)
    }

    const options = this.componentOptions
    const target = { ...options.defaultValues }
    target.errors = {}

    if (options.attributes) {
      for (const key of Object.keys(options.attributes)) {
        const camelName = key.replace(/-([a-z])/g, (g) => g[1].toUpperCase())
        const kebabName = camelToKebab(camelName)
        target['error_' + camelName] = ''
        target['error_' + kebabName] = ''
      }
    }

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
          node = findOwnedRefNode(this, ref.name, uniqueRefValue, this._instanceId)
        }

        if (!node) {
          node = this.getNodeByPath(ref.path)
        }

        if (node) {
          if (node.setAttribute) {
            node.setAttribute('ref', uniqueRefValue)
            if (!node.hasAttribute('data-coralite-owner')) {
              node.setAttribute('data-coralite-owner', this._instanceId)
            }
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
      const lowerName = attr.name.toLowerCase()
      const camelName = attr.name.replace(/-([a-z])/g, (g) => g[1].toUpperCase())
      const kebabName = camelToKebab(camelName)
      const schema = options.attributes?.[camelName] || options.attributes?.[attr.name] || options.attributes?.[lowerName]

      if (RESERVED_DOM_ATTRIBUTES.has(lowerName) && !schema) {
        continue
      }

      if (schema) {
        const res = validateAttributeValue(attr.value, schema, camelName, options.componentId, {
          instanceId: this._instanceId,
          graceful: true
        })
        if (res.error) {
          target.errors[camelName] = res.error
          target['error_' + camelName] = res.error
          target['error_' + kebabName] = res.error
          target[camelName] = res.value !== undefined ? res.value : attr.value
        } else {
          delete target.errors[camelName]
          target['error_' + camelName] = ''
          target['error_' + kebabName] = ''
          if (res.value !== undefined) {
            target[camelName] = res.value
          } else {
            delete target[camelName]
          }
        }
      } else {
        target[camelName] = attr.value
      }
    }

    if (options.attributes) {
      for (const [key, schema] of Object.entries(options.attributes)) {
        const camelName = key.replace(/-([a-z])/g, (g) => g[1].toUpperCase())
        const kebabName = camelToKebab(camelName)
        if (target[camelName] === undefined) {
          const res = validateAttributeValue(undefined, schema, camelName, options.componentId, {
            instanceId: this._instanceId,
            graceful: true
          })
          if (res.error) {
            target.errors[camelName] = res.error
            target['error_' + camelName] = res.error
            target['error_' + kebabName] = res.error
          } else {
            delete target.errors[camelName]
            target['error_' + camelName] = ''
            target['error_' + kebabName] = ''
          }
          if (res.value !== undefined) {
            target[camelName] = res.value
          } else {
            delete target[camelName]
          }
        }
      }
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

    const errorsTarget = target.errors || {}
    const errorProxiesMap = new WeakMap()

    const createErrorProxy = (errTarget, topKey = null) => {
      if (errTarget === null || typeof errTarget !== 'object') {
        return errTarget
      }
      let keyMap = errorProxiesMap.get(errTarget)
      if (!keyMap) {
        keyMap = new Map()
        errorProxiesMap.set(errTarget, keyMap)
      }
      if (keyMap.has(topKey)) {
        return keyMap.get(topKey)
      }

      const proxy = new Proxy(errTarget, {
        get (t, p, receiver) {
          if (typeof p !== 'string') {
            return Reflect.get(t, p, receiver)
          }

          const currentTopKey = topKey || p

          if (self._collectingDependencies) {
            self._collectingDependencies.add('errors')
            const camelTop = currentTopKey.replace(/-([a-z])/g, (g) => g[1].toUpperCase())
            const kebabTop = camelToKebab(camelTop)
            self._collectingDependencies.add('error_' + camelTop)
            self._collectingDependencies.add('error_' + kebabTop)
          }

          const val = Reflect.get(t, p, receiver)
          if (val !== null && typeof val === 'object') {
            return createErrorProxy(val, currentTopKey)
          }
          return val
        },

        set (t, p, v) {
          if (typeof p !== 'string') {
            return Reflect.set(t, p, v)
          }
          const oldValue = t[p]
          if (oldValue === v) {
            return true
          }

          const currentTopKey = topKey || p
          const camelTop = currentTopKey.replace(/-([a-z])/g, (g) => g[1].toUpperCase())
          const kebabTop = camelToKebab(camelTop)

          t[p] = v

          const rootVal = errorsTarget[currentTopKey]
          let flatVal = rootVal
          if (rootVal === null || rootVal === undefined) {
            flatVal = ''
          }

          target['error_' + camelTop] = flatVal
          target['error_' + kebabTop] = flatVal

          self._markObserverDirty('errors')
          self._markObserverDirty(currentTopKey)
          self._markObserverDirty('error_' + camelTop)
          self._markObserverDirty('error_' + kebabTop)
          self._scheduleUpdate()
          return true
        },

        deleteProperty (t, p) {
          if (typeof p !== 'string') {
            return Reflect.deleteProperty(t, p)
          }
          const hasProp = Object.prototype.hasOwnProperty.call(t, p)
          const oldValue = t[p]

          if (!hasProp || oldValue === undefined) {
            return true
          }

          const deleted = Reflect.deleteProperty(t, p)
          if (deleted) {
            const currentTopKey = topKey || p
            const camelTop = currentTopKey.replace(/-([a-z])/g, (g) => g[1].toUpperCase())
            const kebabTop = camelToKebab(camelTop)

            const rootVal = errorsTarget[currentTopKey]
            let flatVal = rootVal
            if (rootVal === null || rootVal === undefined) {
              flatVal = ''
            }

            target['error_' + camelTop] = flatVal
            target['error_' + kebabTop] = flatVal

            self._markObserverDirty('errors')
            self._markObserverDirty(currentTopKey)
            self._markObserverDirty('error_' + camelTop)
            self._markObserverDirty('error_' + kebabTop)
            self._scheduleUpdate()
          }
          return deleted
        }
      })

      keyMap.set(topKey, proxy)
      return proxy
    }

    const errorsProxy = createErrorProxy(errorsTarget, null)
    target.errors = errorsProxy

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

        if (p === 'errors') {
          if (self._collectingDependencies) {
            self._collectingDependencies.add('errors')
          }
          return errorsProxy
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
        if (p === 'errors') {
          const existingKeys = Object.keys(errorsTarget)
          const newKeys = (v && typeof v === 'object') ? Object.keys(v) : []
          const affectedKeys = new Set([...existingKeys, ...newKeys])

          for (const key of existingKeys) {
            delete errorsTarget[key]
            const camelName = key.replace(/-([a-z])/g, (g) => g[1].toUpperCase())
            const kebabName = camelToKebab(camelName)
            target['error_' + camelName] = ''
            target['error_' + kebabName] = ''
          }

          if (v && typeof v === 'object') {
            for (const key of Object.keys(v)) {
              const val = v[key]
              errorsTarget[key] = val
              const camelName = key.replace(/-([a-z])/g, (g) => g[1].toUpperCase())
              const kebabName = camelToKebab(camelName)
              target['error_' + camelName] = val
              target['error_' + kebabName] = val
            }
          }

          self._markObserverDirty('errors')
          for (const key of affectedKeys) {
            const camelName = key.replace(/-([a-z])/g, (g) => g[1].toUpperCase())
            const kebabName = camelToKebab(camelName)
            self._markObserverDirty(key)
            self._markObserverDirty('error_' + camelName)
            self._markObserverDirty('error_' + kebabName)
          }
          self._scheduleUpdate()
          return true
        }

        if (typeof p === 'string' && options.attributes) {
          const camelName = p.replace(/-([a-z])/g, (g) => g[1].toUpperCase())
          const kebabName = camelToKebab(camelName)
          const schema = options.attributes[camelName] || options.attributes[p]
          if (schema) {
            const res = validateAttributeValue(v, schema, camelName, options.componentId, {
              instanceId: self._instanceId,
              graceful: true
            })
            if (res.error) {
              t.errors[camelName] = res.error
              t['error_' + camelName] = res.error
              t['error_' + kebabName] = res.error
            } else {
              delete t.errors[camelName]
              t['error_' + camelName] = ''
              t['error_' + kebabName] = ''
            }
            if (!res.error && res.value === undefined) {
              Reflect.deleteProperty(t, camelName)
              Reflect.deleteProperty(t, kebabName)
              Reflect.deleteProperty(t, p)
              delete t.errors[camelName]
              t['error_' + camelName] = ''
              t['error_' + kebabName] = ''

              if (self._getterAbortControllers?.[camelName]) {
                self._getterAbortControllers[camelName].abort()
                delete self._getterAbortControllers[camelName]
              }
              if (self._getterAbortControllers?.[kebabName]) {
                self._getterAbortControllers[kebabName].abort()
                delete self._getterAbortControllers[kebabName]
              }
              if (self._getterAbortControllers?.[p]) {
                self._getterAbortControllers[p].abort()
                delete self._getterAbortControllers[p]
              }

              if (self.componentOptions?.slots && Object.keys(self.componentOptions.slots).length > 0) {
                if (self._slotObservedKeys && !self._slotObservedKeys.has(p)) {
                  self._slotObservedKeys.add(p)
                  self._observeStateKey(p, () => self._processSlots())
                }
              }
              self._markObserverDirty(camelName)
              self._markObserverDirty(kebabName)
              self._markObserverDirty(p)
              self._scheduleUpdate()
              return true
            }
            v = res.value !== undefined ? res.value : v
          }
        }

        const oldValue = t[p]
        if (oldValue === v) {
          return true
        }

        if (typeof p === 'string' && self._isDevMode && self._isExecutingObserver) {
          console.warn('State mutation detected inside an observe() callback. This can cause infinite reactivity loops. Use getters for derived state instead.')
        }

        t[p] = v

        if (typeof p === 'string' && self.componentOptions?.slots && Object.keys(self.componentOptions.slots).length > 0) {
          if (self._slotObservedKeys && !self._slotObservedKeys.has(p)) {
            self._slotObservedKeys.add(p)
            self._observeStateKey(p, () => self._processSlots())
          }
        }

        if (typeof p === 'string') {
          if (!p.includes('-') && p === p.toLowerCase()) {
            self._markObserverDirty(p)
          } else {
            const camelName = p.replace(/-([a-z])/g, (g) => g[1].toUpperCase())
            const kebabName = camelToKebab(camelName)

            self._markObserverDirty(camelName)
            self._markObserverDirty(kebabName)
            self._markObserverDirty(p)
          }
        }

        self._scheduleUpdate()

        return true
      },

      deleteProperty (t, p) {
        if (typeof p !== 'string') {
          return Reflect.deleteProperty(t, p)
        }
        const camelName = p.replace(/-([a-z])/g, (g) => g[1].toUpperCase())
        const kebabName = camelToKebab(camelName)

        const oldValue = t[p] ?? t[camelName] ?? t[kebabName]

        const deleted1 = Reflect.deleteProperty(t, camelName)
        const deleted2 = Reflect.deleteProperty(t, kebabName)
        const deleted3 = Reflect.deleteProperty(t, p)
        const deleted = deleted1 || deleted2 || deleted3

        if (self._getterAbortControllers?.[camelName]) {
          self._getterAbortControllers[camelName].abort()
          delete self._getterAbortControllers[camelName]
        }
        if (self._getterAbortControllers?.[kebabName]) {
          self._getterAbortControllers[kebabName].abort()
          delete self._getterAbortControllers[kebabName]
        }
        if (self._getterAbortControllers?.[p]) {
          self._getterAbortControllers[p].abort()
          delete self._getterAbortControllers[p]
        }

        if (deleted && oldValue !== undefined) {
          if (self.componentOptions?.slots && Object.keys(self.componentOptions.slots).length > 0) {
            if (self._slotObservedKeys && !self._slotObservedKeys.has(p)) {
              self._slotObservedKeys.add(p)
              self._observeStateKey(p, () => self._processSlots())
            }
          }
          self._markObserverDirty(camelName)
          self._markObserverDirty(kebabName)
          self._markObserverDirty(p)
          self._scheduleUpdate()
        }
        return deleted
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

        // Fallback to light DOM child node traversal ONLY for non-Coralite / foreign custom element boundaries
        const isForeignElement = node && !node.componentOptions && !node._instanceId
        if (isForeignElement && node.childNodes && index < node.childNodes.length) {
          // @ts-ignore
          node = node.childNodes[index]
          continue
        }

        return null
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
            path: item.path,
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
            path: item.path,
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
   * Note: Observers must be marked dirty via _markObserverDirty() BEFORE calling _scheduleUpdate() so microtask elision checks inspect updated observers.
   * @private
   */
  _scheduleUpdate () {
    if (this._isUpdatePending) {
      return
    }
    if (!this._needsDOMUpdate && (!this._dirtyObservers || this._dirtyObservers.size === 0)) {
      return
    }

    this._isUpdatePending = true

    queueMicrotask(() => {
      this._flushBatch()
    })
  }

  /**
   * Executes the unified reactive batch in a single microtask turn.
   * @private
   */
  _flushBatch () {
    this._isUpdatePending = false

    if (!this.isConnected) {
      if (this._dirtyObservers) {
        this._dirtyObservers.clear()
      }
      return
    }

    if (this._needsDOMUpdate) {
      this._updateDOM()
    }

    if (this._dirtyObservers && this._dirtyObservers.size > 0) {
      this._flushDirtyObservers()
    }
  }

  /**
   * Evaluates reactive style definitions and sets/removes CSS property declarations on the host element.
   * @private
   */
  _applyStyles () {
    const styleObj = this.componentOptions?.style
    if (!styleObj || typeof styleObj !== 'object') {
      return
    }

    const roState = createReadOnlyProxy(this._state)
    /** @type {Array<{ normKey: string, val: any }>} */
    const evaluatedProps = []

    // Phase 1: Evaluation & Validation
    for (const [key, valOrFn] of Object.entries(styleObj)) {
      const normKey = normalizeStyleKey(key)
      if (!normKey) {
        continue
      }

      let val
      if (typeof valOrFn === 'function') {
        try {
          val = valOrFn(roState)
        } catch (err) {
          if (err instanceof CoraliteError) {
            throw err
          }
          throw new CoraliteError(
            `Component "${this.componentOptions?.componentId || 'unknown'}" style getter for "${key}" failed: ${err.message}`,
            {
              componentId: this.componentOptions?.componentId,
              instanceId: this._instanceId,
              cause: err
            }
          )
        }
      } else {
        val = valOrFn
      }

      /** @type {any} */
      const asyncCheckVal = val
      if (asyncCheckVal && typeof asyncCheckVal.then === 'function') {
        throw new CoraliteError(`Component "${this.componentOptions?.componentId || 'unknown'}" style property "${key}" getter must be synchronous. Use getters or server() for asynchronous operations.`, {
          componentId: this.componentOptions?.componentId,
          instanceId: this._instanceId
        })
      }

      evaluatedProps.push({
        normKey,
        val
      })
    }

    // Phase 2: Application
    for (const { normKey, val } of evaluatedProps) {
      if (val !== null && val !== undefined && val !== false && val !== '') {
        this.style.setProperty(normKey, String(val))
      } else {
        this.style.removeProperty(normKey)
      }
    }
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
    if (!this._needsDOMUpdate) {
      return
    }

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
        let node = binding.node
        const isConnected = node && typeof document !== 'undefined' && document.body && document.body.contains(node)
        if (binding.path && (!node || !isConnected)) {
          const resolved = this.getNodeByPath(binding.path)
          if (resolved) {
            binding.node = resolved
            node = resolved
          }
        }

        // Defensive null guard inside _updateDOM
        if (!node) {
          continue
        }

        const hydratedValue = binding.template.replace(/\{\{\s*(.+?)\s*\}\}/g, (_, key) => {
          return tokenValues[key] ?? ''
        })

        if (binding.type === 'text') {
          if (node.textContent !== hydratedValue) {
            node.textContent = hydratedValue
          }
        } else if (binding.type === 'html') {
          /** @type {HTMLElement} */
          // @ts-ignore
          const element = node

          if (element.innerHTML !== hydratedValue) {
            element.innerHTML = hydratedValue
          }
        } else if (binding.type === 'attribute') {
          /** @type {HTMLElement} */
          // @ts-ignore
          const element = node

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

      this._applyStyles()

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

    return () => {
      record.cleanup()
      if (this._observerRecords) {
        this._observerRecords.delete(record)
      }
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
        let subs = this._subscriberMap.get(newDep)
        if (!subs) {
          subs = new Set()
          this._subscriberMap.set(newDep, subs)
        }
        subs.add(record)
      }
    }

    // O(1) Double-buffer pointer swap
    if (record.dependencies !== newDeps) {
      const oldSet = record.dependencies
      record.dependencies = newDeps
      record._nextDependencies = oldSet
    }

    if (!this._dependencyGraph) {
      this._dependencyGraph = new Map()
    }
    if (record.dependencies.size > 0) {
      this._dependencyGraph.set(record.key, record.dependencies)
    } else {
      this._dependencyGraph.delete(record.key)
    }
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
      this._scheduleUpdate()
    }
  }

  /**
   *
   */
  _flushDirtyObservers () {
    if (!this._dirtyObservers || this._dirtyObservers.size === 0) {
      return
    }

    if (!this._dirtyObserversBuffer) {
      this._dirtyObserversBuffer = []
    }
    const buffer = this._dirtyObserversBuffer
    buffer.length = 0

    for (const record of this._dirtyObservers) {
      buffer.push(record)
    }
    this._dirtyObservers.clear()

    for (let i = 0; i < buffer.length; i++) {
      buffer[i].run()
    }
    buffer.length = 0
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
   * Calculates the maximum assigned data-coralite-slot-index among direct light DOM children.
   * @returns {number}
   * @private
   */
  _getMaxSlotIndex () {
    let max = -1
    const ownSlots = this._getOwnSlots()
    for (const slot of ownSlots) {
      if (!slot || typeof slot.querySelectorAll !== 'function') {
        continue
      }
      const candidateElements = slot.querySelectorAll('[data-coralite-slot-index]')
      for (const el of candidateElements) {
        const val = parseInt(el.getAttribute('data-coralite-slot-index'), 10)
        if (!isNaN(val) && val > max) {
          max = val
        }
      }
    }
    return max
  }

  /**
   * Sets up a per-instance MutationObserver on host to detect dynamic Light DOM additions.
   * @private
   */
  _setupSlotObserver () {
    if (typeof MutationObserver === 'undefined') {
      return
    }
    if (this._slotObserver) {
      this._slotObserver.disconnect()
    }
    this._slotObserver = new MutationObserver(() => {
      this._reconcileLightDOM()
    })
    this._slotObserver.observe(this, {
      childList: true,
      subtree: false
    })
  }

  /**
   * Reconciles direct Light DOM children by projecting them into matching <slot> elements.
   * @private
   */
  _reconcileLightDOM () {
    if (this._isReconcilingSlots) {
      return
    }
    this._isReconcilingSlots = true

    try {
      const candidates = Array.from(this.childNodes).filter(node => {
        return (!this._templateRoots || !this._templateRoots.has(node)) && node.parentElement === this
      })

      if (candidates.length === 0) {
        return
      }

      const ownSlots = this._getOwnSlots()
      const ownSlotSet = new Set(ownSlots)
      let needsComputedRecompute = false

      for (const node of candidates) {
        const isElement = node.nodeType === 1
        const isNonEmptyText = node.nodeType === 3 && Boolean(node.textContent && node.textContent.trim().length > 0)

        if (!isElement && !isNonEmptyText) {
          continue
        }

        /** @type {any} */
        const elementNode = node
        if (isElement && elementNode.nodeName === 'SLOT' && ownSlotSet.has(elementNode)) {
          continue
        }
        const slotName = isElement ? (elementNode.getAttribute('slot') || 'default') : 'default'
        /** @type {any} */
        const targetSlot = ownSlots.find(slot => (slot.getAttribute('name') || 'default') === slotName)

        if (!targetSlot) {
          continue
        }

        if (isElement) {
          if (!elementNode.hasAttribute('data-coralite-slot-index')) {
            elementNode.setAttribute('data-coralite-slot-index', String(this._nextSlotIndex++))
          }
        }

        const isComputed = Boolean(this.componentOptions?.slots?.[slotName])

        if (isComputed) {
          if (!targetSlot._originalNodes) {
            targetSlot._originalNodes = []
          }
          if (!targetSlot._hasProjectedLightNodes) {
            targetSlot._originalNodes = []
            targetSlot._hasProjectedLightNodes = true
          }
          targetSlot._originalNodes.push(node.cloneNode(true))

          const hasFallbackAttr = targetSlot.hasAttribute('data-coralite-fallback')
          const hasProjectedChildren = Array.from(targetSlot.childNodes).some(child => {
            /** @type {any} */
            const c = child
            return (c.nodeType === 1 && c.hasAttribute('data-coralite-slot-index')) || c._isProjectedLightNode
          })

          if (hasFallbackAttr || (!hasProjectedChildren && targetSlot.childNodes.length > 0)) {
            targetSlot.removeAttribute('data-coralite-fallback')
            targetSlot.replaceChildren()
          }

          if (node.nodeType === 3) {
            elementNode._isProjectedLightNode = true
          }

          targetSlot.appendChild(node)
          needsComputedRecompute = true
        } else {
          const hasFallbackAttr = targetSlot.hasAttribute('data-coralite-fallback')
          const hasProjectedChildren = Array.from(targetSlot.childNodes).some(child => {
            /** @type {any} */
            const c = child
            return (c.nodeType === 1 && c.hasAttribute('data-coralite-slot-index')) || c._isProjectedLightNode
          })

          if (hasFallbackAttr || (!hasProjectedChildren && targetSlot.childNodes.length > 0)) {
            targetSlot.removeAttribute('data-coralite-fallback')
            targetSlot.replaceChildren()
          }

          if (node.nodeType === 3) {
            elementNode._isProjectedLightNode = true
          }

          targetSlot.appendChild(node)
        }
      }

      if (needsComputedRecompute) {
        this._needsDOMUpdate = true
        this._processSlots()
      }
    } finally {
      this._isReconcilingSlots = false
    }
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
  /**
   * Applies the returned result of a slot function or observer callback to the slot element.
   * Handles single Nodes, Node arrays, strings, null/empty clears, undefined no-ops, and Promises.
   * @param {Element} slotEl - The slot DOM element.
   * @param {any} result - The transformation result.
   * @param {symbol|null} [renderVersion=null] - Optional render cycle lock token.
   * @protected
   */
  _applySlotResult (slotEl, result, renderVersion = null) {
    if (renderVersion && this._currentRenderVersion !== renderVersion) {
      return
    }
    if (this._abortController?.signal?.aborted) {
      return
    }

    if (result === undefined) {
      return
    }

    if (result && typeof result.then === 'function') {
      const capturedVersion = renderVersion || this._currentRenderVersion
      result.then(resolved => {
        this._applySlotResult(slotEl, resolved, capturedVersion)
      }).catch(err => {
        if (err?.name !== 'AbortError') {
          console.error('Coralite Slot Async Error:', err)
        }
      })
      return
    }

    if (result === null || result === '' || (Array.isArray(result) && result.length === 0)) {
      slotEl.replaceChildren()
      return
    }

    if (typeof result === 'string') {
      slotEl.innerHTML = result
    } else if (Array.isArray(result)) {
      slotEl.replaceChildren(...result)
    } else if (result instanceof Node || (result && typeof result === 'object' && typeof result.nodeType === 'number')) {
      slotEl.replaceChildren(result)
    }
  }

  /**
   * Creates a context proxy for slot transformer evaluation.
   * @param {string} slotName - The slot name.
   * @param {Element} slotEl - The target slot element.
   * @returns {Proxy} The context proxy.
   * @private
   */
  _createSlotContext (slotName, slotEl) {
    const baseCtx = this._resolvedClientContext || {
      instanceId: this._instanceId,
      state: this._state,
      root: this,
      signal: this._abortController?.signal,
      refs: (id) => {
        const refId = this._state[`ref_${id}`]
        if (!refId && typeof refId !== 'string') {
          return null
        }
        if (this.getAttribute('ref') === refId || this.getAttribute('ref') === id) {
          return this
        }
        let node = this.querySelector(`[ref="${refId}"]`)
        if (!node) {
          node = findOwnedRefNode(this, id, refId, this._instanceId)
        }
        return node
      }
    }

    const slotContextObj = {
      ...baseCtx,
      observe: (key, cb) => {
        if (!this._slotHasInternalObservers) {
          this._slotHasInternalObservers = new Map()
        }
        this._slotHasInternalObservers.set(slotName, true)

        const wrappedCb = (newVal, oldVal) => {
          const res = cb(newVal, oldVal)
          this._applySlotResult(slotEl, res)
        }

        return this._observeStateKey(key, wrappedCb)
      }
    }

    const stateProxy = this._state
    return new Proxy(slotContextObj, {
      get (target, prop, receiver) {
        if (typeof prop === 'symbol') {
          return Reflect.get(target, prop, receiver)
        }
        if (Reflect.has(target, prop)) {
          return Reflect.get(target, prop, receiver)
        }
        if (stateProxy && prop in stateProxy) {
          return stateProxy[prop]
        }
        return Reflect.get(target, prop, receiver)
      },
      has (target, prop) {
        return Reflect.has(target, prop) || Boolean(stateProxy && prop in stateProxy)
      },
      ownKeys (target) {
        const contextKeys = Reflect.ownKeys(target)
        const stateKeys = stateProxy ? Object.keys(stateProxy) : []
        return Array.from(new Set([...contextKeys, ...stateKeys]))
      },
      getOwnPropertyDescriptor (target, prop) {
        if (Reflect.has(target, prop)) {
          return Reflect.getOwnPropertyDescriptor(target, prop)
        }
        if (stateProxy && prop in stateProxy) {
          return {
            enumerable: true,
            configurable: true,
            value: stateProxy[prop]
          }
        }
        return undefined
      }
    })
  }

  /**
   * Evaluates and projects Light DOM elements into their respective `<slot>` nodes.
   * Invokes component-specific slot transformation functions.
   * @private
   */
  _processSlots () {
    const slots = this.componentOptions?.slots
    if (!slots || Object.keys(slots).length === 0) {
      return
    }

    if (!this._slotRuntimeReady) {
      this._processSlotsOnReady = true
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
        if (slotEl._slotEvaluated && this._slotHasInternalObservers?.get(slotName)) {
          return
        }

        const slotContext = this._createSlotContext(slotName, slotEl)
        const renderVersion = Symbol()
        this._currentRenderVersion = renderVersion

        // @ts-ignore
        const result = slotFn(slotEl._originalNodes, slotContext)
        // @ts-ignore
        slotEl._slotEvaluated = true

        this._applySlotResult(slotEl, result, renderVersion)
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

    const emit = (name, detail, options = {}) => {
      if (typeof name !== 'string' || name.trim() === '') {
        throw new CoraliteError(
          `Component "${self.componentOptions?.componentId || 'unknown'}" event name must be a non-empty string.`,
          {
            componentId: self.componentOptions?.componentId,
            instanceId: self._instanceId
          }
        )
      }

      const eventDetail = detail !== undefined ? detail : options?.detail
      const CustomEventCtor = typeof window !== 'undefined' && window.CustomEvent ? window.CustomEvent : CustomEvent
      const event = new CustomEventCtor(name, {
        bubbles: true,
        composed: true,
        cancelable: false,
        ...options,
        detail: eventDetail
      })

      return self.dispatchEvent(event)
    }

    /**
     * The context payload injected into the user's script block.
     * @type {Object}
     */
    let localContext = {
      instanceId: this._instanceId,
      state: this._state,
      errors: this._state.errors,
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
          node = findOwnedRefNode(self, id, refId, self._instanceId)
        }

        return node
      },
      observe,
      emit
    }

    if (typeof this._clientContextGetter === 'function') {
      localContext = await this._clientContextGetter(localContext)
    }

    this._resolvedClientContext = localContext
    this._slotRuntimeReady = true

    this._applyStyles()

    if (isImperative) {
      this._updateDOM()
    } else {
      this._scheduleUpdate()
    }

    if (this._processSlotsOnReady || (this.componentOptions.slots && Object.keys(this.componentOptions.slots).length > 0)) {
      this._processSlotsOnReady = false
      this._processSlots()
    }

    // @ts-ignore
    const isDevOrTest = typeof import.meta.env !== 'undefined'
      // @ts-ignore
      ? import.meta.env.MODE !== 'production'
      : true

    if (isDevOrTest) {
      const options = this.componentOptions
      const declaredRefKeys = new Set()

      if (options.hydrationMap?.refs) {
        for (const ref of options.hydrationMap.refs) {
          declaredRefKeys.add(ref.name)
        }
      }

      if (options.templateValues?.refs) {
        for (const ref of options.templateValues.refs) {
          declaredRefKeys.add(ref.name)
        }
      }

      this._refsKeysDirty = true

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
              node = findOwnedRefNode(self, prop, refId, self._instanceId)
            }
            return node
          },
          ownKeys () {
            if (!self._refsKeysObserver && typeof MutationObserver !== 'undefined') {
              self._refsKeysObserver = new MutationObserver(() => {
                self._refsKeysDirty = true
              })
              self._refsKeysObserver.observe(self, {
                childList: true,
                attributes: true,
                attributeFilter: ['ref', 'data-coralite-owner'],
                subtree: true
              })
            }

            if (self._refsKeysObserver && self._refsKeysObserver.takeRecords().length > 0) {
              self._refsKeysDirty = true
            }

            if (self._refsKeysDirty || !self._refsKeysCache) {
              const keys = new Set(declaredRefKeys)
              const elements = self.querySelectorAll('[ref]')
              const prefix = `${self._instanceId}__`

              for (let i = 0; i < elements.length; i++) {
                const el = elements[i]
                const refAttr = el.getAttribute('ref')
                if (refAttr) {
                  if (refAttr.startsWith(prefix)) {
                    keys.add(refAttr.slice(prefix.length))
                  } else if (el.getAttribute('data-coralite-owner') === self._instanceId) {
                    keys.add(refAttr)
                  }
                }
              }

              self._refsKeysCache = Array.from(keys)
              self._refsKeysDirty = false
            }

            return Array.from(self._refsKeysCache)
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
