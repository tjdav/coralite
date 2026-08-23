import { createReadOnlyProxy } from './utils/core.js'
import { processHTML } from './utils/client/inject.js'
import { recordDevToolsEvent } from './utils/client/devtools.js'
import { ObserverRecord } from './utils/observer-record.js'
import { CoraliteError } from './utils/errors.js'

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
 * Reserved DOM attributes used internally by Coralite or standard HTML semantics.
 * Filtered out during state initialization unless explicitly declared in component attributes.
 */
export const RESERVED_DOM_ATTRIBUTES = new Set([
  'data-cid',
  'data-coralite-owner',
  'data-coralite-initial',
  'data-coralite-slot-index',
  'data-coralite-page',
  'data-style-selector',
  'slot',
  'ref',
  'data-testid',
  'no-hydration'
])

/**
 * Infers the primitive constructor or type name from an array of allowed values.
 * @param {Array<any>} valuesArray - Array of allowed primitive values.
 * @returns {Function} String, Number, or Boolean constructor.
 */
export function inferTypeFromValues (valuesArray) {
  if (!Array.isArray(valuesArray) || valuesArray.length === 0) {
    return String
  }
  const types = new Set(valuesArray.map(v => typeof v))
  if (types.size === 1) {
    const singleType = Array.from(types)[0]
    if (singleType === 'number') {
      return Number
    }
    if (singleType === 'boolean') {
      return Boolean
    }
    if (singleType === 'string') {
      return String
    }
  }
  return String
}

/**
 * Executes custom synchronous validation function on an attribute value.
 *
 * @param {any} value - The input value (after coercion/transformation).
 * @param {Object} schema - Attribute schema object containing optional validate function.
 * @param {string} name - Attribute name.
 * @param {string} [componentId] - Component ID for error messaging.
 * @param {Object} [errorOptions] - Additional options for CoraliteError.
 * @returns {any} The validated value.
 */
export function executeAttributeValidator (value, schema, name, componentId = 'component', errorOptions = {}) {
  if (!schema || typeof schema.validate !== 'function') {
    return value
  }

  let result
  try {
    result = schema.validate(value)
  } catch (err) {
    if (err instanceof CoraliteError) {
      throw err
    }
    throw new CoraliteError(`Component "${componentId}" attribute "${name}" validation failed: ${err.message}`, {
      componentId,
      cause: err,
      ...errorOptions
    })
  }

  if (result && typeof result.then === 'function') {
    throw new CoraliteError(`Component "${componentId}" attribute "${name}" validate function must be synchronous. Use getters or server() for asynchronous validation.`, {
      componentId,
      ...errorOptions
    })
  }

  if (result === false) {
    throw new CoraliteError(`Component "${componentId}" attribute "${name}" validation failed for value ${JSON.stringify(value)}.`, {
      componentId,
      ...errorOptions
    })
  }

  if (typeof result === 'string' && result.trim() !== '') {
    const customMessage = result.endsWith('.') ? result : `${result}.`
    throw new CoraliteError(`Component "${componentId}" attribute "${name}" validation failed: ${customMessage}`, {
      componentId,
      ...errorOptions
    })
  }

  return value
}

/**
 * Validates an attribute value against a component attribute schema following the full 6-step pipeline:
 * 1. Required check
 * 2. Type coercion
 * 3. Custom transformation
 * 4. Allowed values check
 * 5. Custom validation
 * 6. State application
 *
 * @param {any} value - The input value.
 * @param {Object|Array} schema - Attribute schema object or allowed values array.
 * @param {string} name - Attribute name.
 * @param {string} [componentId] - Component ID for error messaging.
 * @param {Object} [errorOptions] - Additional options for CoraliteError.
 * @returns {any} The validated and coerced primitive value.
 */
export function validateAttributeValue (value, schema, name, componentId = 'component', errorOptions = {}) {
  let schemaObj
  if (typeof schema === 'function') {
    schemaObj = { type: schema }
  } else if (Array.isArray(schema)) {
    schemaObj = { values: schema }
  } else {
    schemaObj = schema || {}
  }

  // Step 1: required check
  if (schemaObj.required && (value === undefined || value === null)) {
    throw new CoraliteError(`Component "${componentId}" attribute "${name}" is required.`, {
      componentId,
      ...errorOptions
    })
  }

  // Handle omitted value (optional attribute with or without default)
  let val = value
  if (val === undefined || val === null) {
    if (schemaObj.default !== undefined) {
      val = schemaObj.default
    } else {
      return undefined
    }
  }

  // Step 2: coerce (always runs before transform)
  if (schemaObj.type) {
    val = coerce(val, schemaObj.type)
  }

  // Step 3: transform
  if (typeof schemaObj.transform === 'function') {
    let transformed
    try {
      transformed = schemaObj.transform(val)
    } catch (err) {
      if (err instanceof CoraliteError) {
        throw err
      }
      throw new CoraliteError(`Component "${componentId}" attribute "${name}" transform failed: ${err.message}`, {
        componentId,
        cause: err,
        ...errorOptions
      })
    }
    if (transformed && typeof transformed.then === 'function') {
      throw new CoraliteError(`Component "${componentId}" attribute "${name}" transform function must be synchronous.`, {
        componentId,
        ...errorOptions
      })
    }
    val = transformed
  }

  // Step 4: values constraint check
  const values = schemaObj.values
  if (Array.isArray(values) && values.length > 0) {
    let matched = values.includes(val)
    if (!matched && typeof val === 'string') {
      const hasNumbers = values.some(v => typeof v === 'number')
      if (hasNumbers && val.trim() !== '') {
        const num = Number(val)
        if (!Number.isNaN(num) && values.includes(num)) {
          val = num
          matched = true
        }
      }
      const hasBooleans = values.some(v => typeof v === 'boolean')
      if (hasBooleans) {
        if ((val === '' || val === 'true') && values.includes(true)) {
          val = true
          matched = true
        } else if (val === 'false' && values.includes(false)) {
          val = false
          matched = true
        }
      }
    }

    if (!matched) {
      const formattedValue = JSON.stringify(val)
      const formattedExpected = values.map(v => JSON.stringify(v)).join(', ')
      throw new CoraliteError(`Invalid value ${formattedValue} for attribute "${name}" in component "${componentId}". Expected one of: ${formattedExpected}.`, {
        componentId,
        ...errorOptions
      })
    }
  }

  // Step 5: validate
  if (typeof schemaObj.validate === 'function') {
    val = executeAttributeValidator(val, schemaObj, name, componentId, errorOptions)
  }

  // Step 6: State application
  return val
}

/**
 * Coerces a value to a specified type.
 * Supports Number, Boolean, and String.
 * @param {any} value - The value to coerce.
 * @param {Function|string|Object|Array} type - The target type (Constructor, string name, or schema object/array).
 * @returns {any} The coerced value.
 */
export function coerce (value, type) {
  if (value === null || value === undefined) {
    return value
  }

  let targetType = type
  if (Array.isArray(type) || (type && typeof type === 'object' && Array.isArray(type.values))) {
    const valuesArray = Array.isArray(type) ? type : type.values
    targetType = type.type || inferTypeFromValues(valuesArray)
  }

  if (targetType !== String && targetType !== 'String' && typeof value === 'string' && value.includes('{{') && value.includes('}}')) {
    return null
  }

  if (targetType === Number || targetType === 'Number') {
    if (typeof value === 'number') {
      return Number.isNaN(value) ? null : value
    }
    const num = Number(value)
    return Number.isNaN(num) ? null : num
  }

  if (targetType === Boolean || targetType === 'Boolean') {
    if (typeof value === 'boolean') {
      return value
    }
    if (value === '') {
      return true
    }
    return value !== 'false' && value !== null
  }

  if (targetType === String || targetType === 'String') {
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
 * Checks if a candidate node belongs to a specific Coralite component instance.
 * Prioritizes the authoritative `data-coralite-owner` attribute over geometric DOM containment.
 *
 * @param {any} candidate - The candidate DOM node.
 * @param {string|null} instanceId - The component instance ID.
 * @param {any} hostElement - The host custom element instance.
 * @returns {boolean}
 */
export function isOwnedByComponent (candidate, instanceId, hostElement) {
  if (!candidate || !instanceId) {
    return false
  }

  if (candidate.getAttribute && candidate.getAttribute('data-coralite-owner') === instanceId) {
    return true
  }

  const enc = getEnclosingComponent(candidate)
  return enc === hostElement || (enc && enc.getAttribute && enc.getAttribute('data-cid') === instanceId)
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
    const schema = this.componentOptions.attributes?.[camelName] || this.componentOptions.attributes?.[name]

    let value
    if (newVal === null) {
      if (schema) {
        value = validateAttributeValue(undefined, schema, camelName, this.componentOptions?.componentId, { instanceId: this._instanceId })
      } else {
        value = undefined
      }
    } else {
      value = schema ? validateAttributeValue(newVal, schema, camelName, this.componentOptions?.componentId, { instanceId: this._instanceId }) : newVal
    }

    if (value === undefined) {
      delete this._state[camelName]
    } else {
      this._state[camelName] = value
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
          node = Array.from(this.querySelectorAll(`[ref="${ref.name}"], [ref="${uniqueRefValue}"]`)).find(
            candidate => isOwnedByComponent(candidate, this._instanceId, this)
          ) || null
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
      const schema = options.attributes?.[camelName] || options.attributes?.[attr.name] || options.attributes?.[lowerName]

      if (RESERVED_DOM_ATTRIBUTES.has(lowerName) && !schema) {
        continue
      }

      if (schema) {
        const val = validateAttributeValue(attr.value, schema, camelName, options.componentId, { instanceId: this._instanceId })
        if (val !== undefined) {
          target[camelName] = val
        }
      } else {
        target[camelName] = attr.value
      }
    }

    if (options.attributes) {
      for (const [key, schema] of Object.entries(options.attributes)) {
        if (target[key] === undefined) {
          const val = validateAttributeValue(undefined, schema, key, options.componentId, { instanceId: this._instanceId })
          if (val !== undefined) {
            target[key] = val
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
        if (typeof p === 'string' && options.attributes) {
          const camelName = p.replace(/-([a-z])/g, (g) => g[1].toUpperCase())
          const schema = options.attributes[camelName] || options.attributes[p]
          if (schema) {
            v = validateAttributeValue(v, schema, p, options.componentId, { instanceId: self._instanceId })
          }
        }

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
          node = Array.from(this.querySelectorAll(`[ref="${id}"], [ref="${refId}"]`)).find(
            candidate => isOwnedByComponent(candidate, this._instanceId, this)
          ) || null
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
          node = Array.from(self.querySelectorAll(`[ref="${id}"], [ref="${refId}"]`)).find(
            candidate => isOwnedByComponent(candidate, self._instanceId, self)
          ) || null
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
              node = Array.from(self.querySelectorAll(`[ref="${prop}"], [ref="${refId}"]`)).find(
                candidate => isOwnedByComponent(candidate, self._instanceId, self)
              ) || null
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
