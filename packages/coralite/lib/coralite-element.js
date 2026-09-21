import { createReadOnlyProxy, normalizeStyleKey, camelToKebab, kebabToCamel, ContextRequestEvent, normalizeConsumerItems, applyConsumedState, safeInvoke, getContextValue, hasContextValue } from './utils/core.js'
import { processHTML } from './utils/client/inject.js'
import { recordDevToolsEvent } from './utils/client/devtools.js'
import { isDevRuntime } from './utils/dev-mode.js'
import { ObserverRecord } from './utils/observer-record.js'
import { CoraliteError } from './utils/errors.js'
import { classifyAttribute, resolveAriaBooleanState } from './utils/tags.js'
import {
  RESERVED_DOM_ATTRIBUTES,
  RESERVED_PROPERTY_BLACKLIST,
  validateAttributeValue,
  shouldReflectAttribute,
  inferTypeFromValues,
  resolveSchema,
  isBooleanCustomAttribute
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
  coerce,
  shouldReflectAttribute,
  isBooleanCustomAttribute
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
 * @import { CoraliteSlotsHelper, CoraliteGetterContext } from '../types/index.js'
 */

/**
 * Helper for querying slotted content in client elements.
 * @param {CoraliteElement} element - Host element instance.
 * @returns {CoraliteSlotsHelper} Slots helper proxy.
 */
function createClientSlotsHelper (element) {
  const filterNodes = (nodes) => {
    return Array.from(nodes).filter(node => {
      if (!node) {
        return false
      }

      if (node.nodeType === 8) {
        return false
      }

      if (node.nodeType === 3 && !node.textContent.trim()) {
        return false
      }

      return true
    })
  }

  const getSlotNodes = (name = 'default') => {
    /** @type {any} */
    const el = element
    const ownSlots = typeof el._getOwnSlots === 'function' ? el._getOwnSlots() : []
    const targetSlot = ownSlots.find((slot) => (slot.getAttribute('name') || 'default') === name)

    if (!targetSlot) {
      return []
    }

    if (targetSlot.hasAttribute('data-coralite-fallback')) {
      return []
    }

    if (targetSlot._originalNodes && Array.isArray(targetSlot._originalNodes)) {
      return filterNodes(targetSlot._originalNodes)
    }

    return filterNodes(targetSlot.childNodes)
  }

  /** @type {any} */
  const slotsProxy = new Proxy({
    has: (name = 'default') => getSlotNodes(name).length > 0,
    get: (name = 'default') => getSlotNodes(name),
    count: (name = 'default') => getSlotNodes(name).length,
    get names () {
      /** @type {any} */
      const el = element
      const ownSlots = typeof el._getOwnSlots === 'function' ? el._getOwnSlots() : []
      return ownSlots.map((s) => s.getAttribute('name') || 'default')
    }
  }, {
    get (target, prop) {
      if (prop in target) {
        /** @type {any} */
        const t = target
        return t[prop]
      }
      if (typeof prop === 'string') {
        return getSlotNodes(prop)
      }
      return undefined
    }
  })

  return slotsProxy
}

/**
 * @typedef {function(CoraliteGetterContext): any} CoraliteGetter
 */

/**
 * @typedef {HTMLSlotElement & {
 *   _slotRenderVersion?: number | null,
 *   _originalNodes?: Node[],
 *   _slotEvaluated?: boolean
 * }} CoraliteSlotElement
 */


/**
 * @typedef {Object} CoraliteComponentOptions
 * @property {string} componentId - The unique identifier for the component.
 * @property {boolean} [formAssociated] - Whether element is form-associated custom element.
 * @property {string} [templateHTML] - The raw HTML string for imperative mounting.
 * @property {Object} [defaultValues] - The initial state values extracted from the server data block.
 * @property {Object} [attributes] - Schema for coercing HTML attributes into typed primitives.
 * @property {Object.<string, Function>} [getters] - Pure functions for derived state, supporting Promises.
 * @property {Object.<string, Function>} [slots] - Transformation functions for projected Light DOM.
 * @property {Object.<string, ((state: any) => string | number | null | undefined | false) | string | number>} [style] - Reactive style definitions and CSS custom properties.
 * @property {Object.<string|symbol, Function|any>} [provide] - Provided context definitions for descendant components.
 * @property {Array<string|symbol> | Object.<string|symbol, { default?: any }>} [consume] - Consumed context keys from ancestor components.
 * @property {Function} [client] - The client-side controller logic.
 * @property {Object} [hydrationMap] - AST mapping for reactive text nodes, attributes, and refs.
 * @property {Object} [templateValues] - Token positions for AST updates.
 */

/** @type {any} */
const FallbackElement = class {
}

const MAX_REACTIVE_CASCADE_DEPTH = 50
const MAX_FLUSHES_PER_WINDOW = 100
const FLUSH_WINDOW_MS = 1000
const MAX_PENDING_BINDING_RETRIES = 8

/**
 * O(1) liveness check for a DOM node.
 * @param {Node|null} node - The DOM node to check.
 * @returns {boolean}
 */
function isNodeConnected (node) {
  if (!node) {
    return false
  }
  if (typeof node.isConnected === 'boolean') {
    return node.isConnected
  }
  return typeof document !== 'undefined' && document.body ? document.body.contains(node) : false
}

/** @type {typeof HTMLElement} */
const BaseElement = typeof HTMLElement !== 'undefined' ? HTMLElement : FallbackElement

/**
 * Base class for all Coralite custom elements.
 *
 * @augments BaseElement
 */
export class CoraliteElement extends BaseElement {
  static formAssociated = false

  /**
   * Initializes a new instance of the CoraliteElement.
   * Sets up internal state trackers, binding collections, and hook registries.
   */
  constructor () {
    super()

    /** @type {typeof CoraliteElement} */
    // @ts-ignore
    const ctor = this.constructor
    if (ctor.formAssociated && typeof this.attachInternals === 'function') {
      this._internals = this.attachInternals()
    } else {
      this._internals = null
    }

    this._formResetCallbacks = new Set()
    this._formDisabledCallbacks = new Set()
    this._formRestoreCallbacks = new Set()
    this._manualValiditySet = false
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
     * Instance-cached read-only view of `_state`. Created lazily by
     * `_getReadOnlyState()` so that repeated getter/style/context evaluations
     * do not re-allocate a handler closure, `Proxy` and `WeakMap` per call.
     * @type {Object|null}
     * @protected
     */
    this._roState = null

    /**
     * Stable dependency tracker for reactive `style` getters. Created once and
     * reused across evaluations; it writes into `_styleDeps` live so the
     * dependency-gated render path stays accurate without per-render
     * tracker/proxy allocation.
     * @type {{ activeCollector: (prop: string) => void }|null}
     * @protected
     */
    this._styleTracker = null

    /**
     * Instance-cached tracked read-only view of `_state` used by reactive
     * `style` getters. Shares the stable `_styleTracker`, so repeated style
     * evaluations allocate nothing.
     * @type {Object|null}
     * @protected
     */
    this._roStateStyle = null

    /**
     * Per-component-getter caches for tracked read-only proxies, keyed by the
     * derived state key. Each entry is `{ proxies: WeakMap, roState: Object }`.
     * @type {Map<string, {proxies: WeakMap, roState: Object}>|null}
     * @protected
     */
    this._roStateTracked = null

    /**
     * State keys the reactive `style` getters read, collected on the first style
     * evaluation so later render passes can skip evaluation when none changed.
     * @type {Set<string>|null}
     * @protected
     */
    this._styleDeps = null

    /**
     * Raw changed state keys accumulated by `_markKeysDirty` between style
     * evaluations. Consumed (and cleared) by `_applyStyles`.
     * @type {Set<string>|null}
     * @protected
     */
    this._changedStateKeys = null

    /**
     * Whether reactive styles have been applied at least once successfully.
     * @type {boolean}
     * @protected
     */
    this._stylesEvaluated = false

    /**
     * Unique template token keys across all bindings, pre-computed in
     * `_setupBindings` (static for the lifetime of the binding set).
     * @type {string[]}
     * @protected
     */
    this._requiredTokens = []

    /**
     * The collection of DOM nodes mapped to template tokens and attributes.
     * @type {Array<{type: string, node: Node, path?: number[], template?: string, name?: string, tokens?: string[], isSingleToken?: boolean, singleTokenKey?: string, segments?: Array<[number, string]> | null, attrKind?: number}>}
     * @protected
     */
    this._bindings = []

    /**
     * Cached own slots resolved from hydrationMap.slots or querySelector.
     * @type {CoraliteSlotElement[]|null}
     * @private
     */
    this._cachedOwnSlots = null

    /**
     * Inverted token-to-binding-indices map from hydration map.
     * @type {Record<string, number[]>|null}
     * @private
     */
    this._tokenBindings = null

    /**
     * Flag to prevent multiple synchronous state mutations from triggering multiple DOM paints.
     * @type {boolean}
     * @protected
     */
    this._isUpdatePending = false

    /**
     * Flag indicating whether the reactive batch is currently executing DOM updates or observers.
     * @type {boolean}
     * @protected
     */
    this._isFlushing = false

    /**
     * Pending resolver callbacks waiting for the current reactive batch to settle.
     * @type {Array<Function>|null}
     * @protected
     */
    this._updateCompleteResolvers = null

    /**
     * Monotonic render cycle counter generator.
     * @type {number}
     * @private
     */
    this._renderVersionCounter = 0

    /**
     * Active DOM render cycle version lock.
     * @type {number}
     * @protected
     */
    this._domRenderVersion = 0

    /**
     * Monotonic slot evaluation counter generator.
     * @type {number}
     * @private
     */
    this._slotRenderVersionCounter = 0

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
     * Remaining follow-up renders for unresolved binding paths.
     * @type {number}
     * @protected
     */
    this._pendingBindingRetries = 0

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
     * Flag indicating whether a stale slot cache warning has already been logged for this instance.
     * @type {boolean}
     * @private
     */
    this._staleSlotCacheWarned = false

    /**
     * Recursion guard flag indicating active state-to-host-attribute reflection.
     * @type {boolean}
     * @protected
     */
    this._isReflectingToAttribute = false

    /**
     * Recursion guard flag indicating active host-attribute-to-state synchronization.
     * @type {boolean}
     * @protected
     */
    this._isReflectingFromAttribute = false

    /**
     * Context subscription records for provided context keys.
     * @type {Map<string|symbol, Set<{callbackRef: { deref: () => Function|undefined }, getValueWithDeps: Function, deps: Set<string>, unsubscribe?: Function, isFunction?: boolean}>>}
     * @protected
     */
    this._contextSubscriptions = new Map()

    /**
     * Array of unsubscription functions for consumed contexts.
     * @type {Array<Function>}
     * @protected
     */
    this._contextUnsubscribers = []

    /**
     * Array of consumer callback references held to prevent premature garbage collection.
     * @type {Array<Function>}
     * @protected
     */
    this._contextCallbacks = []

    /**
     * Active dependency collector set for state tracking.
     * @type {Set<string>|null}
     * @protected
     */
    this._collectingDependencies = null

    /**
     * Currently active ObserverRecord evaluating a getter or observed key.
     * @type {ObserverRecord|null}
     * @protected
     */
    this._activeObserverRecord = null

    /**
     * Cache mapping getter keys to their direct dependency Sets for nested getter dependency propagation.
     * @type {Map<string, Set<string>>|null}
     * @protected
     */
    this._getterDeps = null

    /**
     * Count of consecutive microtask flushes without settling.
     * @type {number}
     * @protected
     */
    this._consecutiveFlushCount = 0

    /**
     * Count of flushes in current sliding window.
     * @type {number}
     * @protected
     */
    this._flushWindowCount = 0

    /**
     * Start timestamp of current sliding window.
     * @type {number}
     * @protected
     */
    this._flushWindowStart = 0

    /**
     * Flag indicating if a reactive infinite loop was broken by circuit breaker.
     * @type {boolean}
     * @protected
     */
    this._reactiveLoopBroken = false

    /**
     * Test hook flag indicating if circuit breaker tripped.
     * @type {boolean}
     * @protected
     */
    this._cascadeBreakerTripped = false

    /**
     * Flag indicating whether the client() controller script has been executed.
     * @type {boolean}
     * @protected
     */
    this._hasRunClient = false

    /**
     * Flag indicating whether the component lifecycle was torn down on genuine detachment.
     * @type {boolean}
     * @protected
     */
    this._wasTornDown = false

    /**
     * Flag indicating a pending disconnection awaiting deferred teardown evaluation.
     * @type {boolean}
     * @protected
     */
    this._pendingDisconnect = false

    /**
     * Cached slots helper proxy for getter evaluations and script contexts.
     * @type {CoraliteSlotsHelper|null}
     * @private
     */
    this._slotsHelper = null

    /**
     * Cached context objects per getter key to avoid per-read allocation.
     * @type {Map<string, Object>|null}
     * @private
     */
    this._getterContexts = null
  }

  /**
   * Lazily returns an instance-cached slots helper proxy.
   * @returns {CoraliteSlotsHelper}
   * @private
   */
  _getSlotsHelper () {
    if (!this._slotsHelper) {
      this._slotsHelper = createClientSlotsHelper(this)
    }
    return this._slotsHelper
  }

  /**
   * Native Form-Associated Custom Element callback when parent <fieldset disabled> state changes.
   * @param {boolean} disabled - Whether the fieldset container is disabled.
   */
  formDisabledCallback (disabled) {
    /** @type {typeof CoraliteElement} */
    // @ts-ignore
    const ctor = this.constructor
    if (!ctor.formAssociated) {
      return
    }

    if (this._state) {
      this._state.disabled = disabled
    } else {
      this._pendingDisabled = disabled
    }

    if (this._formDisabledCallbacks) {
      for (const cb of this._formDisabledCallbacks) {
        cb(disabled)
      }
    }
  }

  /**
   * Native Form-Associated Custom Element callback when associated <form> changes.
   * @param {Element|null} form - The associated parent form element.
   */
  formAssociatedCallback (form) {
    /** @type {typeof CoraliteElement} */
    // @ts-ignore
    const ctor = this.constructor
    if (!ctor.formAssociated) {
      return
    }

    this._form = form
  }

  /**
   * Clears error state for a specific key across camelCase and kebab-case variants.
   * @param {string} key - State key to clear errors for.
   * @protected
   */
  _clearErrorFor (key) {
    if (!this._state) {
      return
    }
    const camelKey = kebabToCamel(key)
    const kebabKey = camelToKebab(camelKey)
    if (this._state.errors) {
      delete this._state.errors[camelKey]
      if (camelKey !== kebabKey) {
        delete this._state.errors[kebabKey]
      }
    }
    this._state[`error_${camelKey}`] = ''
    if (camelKey !== kebabKey) {
      this._state[`error_${kebabKey}`] = ''
    }
  }

  /**
   * Native Form-Associated Custom Element callback when parent <form> is reset.
   */
  formResetCallback () {
    /** @type {typeof CoraliteElement} */
    // @ts-ignore
    const ctor = this.constructor
    if (!ctor.formAssociated) {
      return
    }

    this._manualValiditySet = false

    if (this._state) {
      if ('value' in this._state || this._initialFormValue !== null) {
        this._state.value = this._initialFormValue
      }
      if ('checked' in this._state) {
        this._state.checked = this._initialChecked
      }
      this._clearErrorFor('value')
    }

    if (this._internals && typeof this._internals.setFormValue === 'function') {
      this._internals.setFormValue(this._initialFormValue)
    }

    if (this._internals && typeof this._internals.setValidity === 'function') {
      this._internals.setValidity({})
    }

    if (this._formResetCallbacks) {
      for (const cb of this._formResetCallbacks) {
        cb()
      }
    }
  }

  /**
   * Native Form-Associated Custom Element callback when state is restored by browser.
   * @param {string|File|FormData|null} state - Restored form value or entry.
   * @param {string} mode - Restoration mode ('restore' or 'autocomplete').
   */
  formStateRestoreCallback (state, mode) {
    /** @type {typeof CoraliteElement} */
    // @ts-ignore
    const ctor = this.constructor
    if (!ctor.formAssociated) {
      return
    }

    if (this._state && typeof state === 'string') {
      this._state.value = state
    }

    if (this._internals && typeof this._internals.setFormValue === 'function') {
      this._internals.setFormValue(state)
    }

    if (this._formRestoreCallbacks) {
      for (const cb of this._formRestoreCallbacks) {
        cb(state, mode)
      }
    }
  }

  /**
   * Retrieves the form control name.
   * @returns {string|undefined} The name attribute value for form-associated elements, or undefined.
   */
  get name () {
    /** @type {typeof CoraliteElement} */
    // @ts-ignore
    const ctor = this.constructor
    if (ctor.formAssociated) {
      return this.getAttribute('name') ?? ''
    }
    return undefined
  }

  /**
   * Sets the form control name attribute.
   * @param {string} val - Name value.
   */
  set name (val) {
    /** @type {typeof CoraliteElement} */
    // @ts-ignore
    const ctor = this.constructor
    if (ctor.formAssociated) {
      this.setAttribute('name', val)
    } else {
      Object.defineProperty(this, 'name', {
        value: val,
        writable: true,
        configurable: true,
        enumerable: true
      })
    }
  }

  /**
   * Retrieves the element tag type name.
   * @returns {string|undefined} Local tag name for form-associated elements, or undefined.
   */
  get type () {
    /** @type {typeof CoraliteElement} */
    // @ts-ignore
    const ctor = this.constructor
    if (ctor.formAssociated) {
      return this.localName
    }
    return undefined
  }

  /**
   * Retrieves associated parent form element.
   * @returns {Element|null} The parent form element.
   */
  get form () {
    if (this._internals && this._internals.form) {
      return this._internals.form
    }
    if (this._form) {
      return this._form
    }
    /** @type {typeof CoraliteElement} */
    // @ts-ignore
    const ctor = this.constructor
    if (ctor.formAssociated) {
      const formAttr = this.getAttribute('form')
      if (formAttr && this.ownerDocument) {
        const targetForm = this.ownerDocument.getElementById(formAttr)
        if (targetForm && targetForm.tagName && targetForm.tagName.toLowerCase() === 'form') {
          return targetForm
        }
      }
      return this.closest ? (this.closest('form') ?? null) : null
    }
    return null
  }

  /**
   * Retrieves validity state object from ElementInternals.
   * @returns {Object|undefined} ValidityState object.
   */
  get validity () {
    return this._internals ? this._internals.validity : undefined
  }

  /**
   * Retrieves validation message string from ElementInternals.
   * @returns {string} Validation message string.
   */
  get validationMessage () {
    return this._internals ? this._internals.validationMessage : ''
  }

  /**
   * Retrieves willValidate flag from ElementInternals.
   * @returns {boolean} Whether element will be validated on form submit.
   */
  get willValidate () {
    return this._internals ? this._internals.willValidate : false
  }

  /**
   * Checks form validity.
   * @returns {boolean} True if valid.
   */
  checkValidity () {
    return this._internals && typeof this._internals.checkValidity === 'function'
      ? this._internals.checkValidity()
      : true
  }

  /**
   * Reports form validity to the user agent.
   * @returns {boolean} True if valid.
   */
  reportValidity () {
    return this._internals && typeof this._internals.reportValidity === 'function'
      ? this._internals.reportValidity()
      : true
  }

  /**
   * Retrieves associated label elements from ElementInternals.
   * @returns {Object|null} Label node list.
   */
  get labels () {
    return this._internals ? this._internals.labels : null
  }

  /**
   * Resolves when the element has completed its current update cycle and flushed DOM mutations.
   * If no update is pending or in-flight, returns an immediately resolved Promise.
   * @returns {Promise<boolean>} Resolves to true when updates complete, or false if aborted/disconnected.
   */
  get updateComplete () {
    if (!this._isUpdatePending && !this._isFlushing) {
      return Promise.resolve(true)
    }
    return new Promise(resolve => {
      if (!this._updateCompleteResolvers) {
        this._updateCompleteResolvers = []
      }
      this._updateCompleteResolvers.push(resolve)
    })
  }

  /**
   * Drains all pending updateComplete resolvers with the given completion status.
   * @param {boolean} [value=true] - Whether updates completed successfully.
   * @private
   */
  _resolveUpdateComplete (value = true) {
    if (this._updateCompleteResolvers && this._updateCompleteResolvers.length > 0) {
      const resolvers = this._updateCompleteResolvers
      this._updateCompleteResolvers = null
      for (let i = 0; i < resolvers.length; i++) {
        resolvers[i](value)
      }
    }
  }

  /**
   * Synchronizes state.errors.value to ElementInternals setValidity().
   * @protected
   */
  _syncValidityFromErrors () {
    /** @type {typeof CoraliteElement} */
    // @ts-ignore
    const ctor = this.constructor
    if (!ctor.formAssociated || !this._internals || this._manualValiditySet) {
      return
    }

    const valueError = this._state?.errors?.value
    if (valueError) {
      /** @type {HTMLElement|null} */
      const targetAnchor = this.querySelector('input, textarea, select')
      const anchor = targetAnchor || this
      this._internals.setValidity({ customError: true }, valueError, anchor)
    } else {
      this._internals.setValidity({})
    }
  }

  /**
   * Invoked natively when the element is added to the document.
   * Handles the architectural split between Declarative (SSR) and Imperative (JS) components.
   * Orchestrates template injection, instance ID generation, and state/binding setup.
   */
  connectedCallback () {
    this._pendingDisconnect = false
    this._isExecutingObserver = false
    this._resolutionStack = new Set()
    this._collectingDependencies = null
    this._activeObserverRecord = null
    this._consecutiveFlushCount = 0
    this._flushWindowCount = 0
    this._flushWindowStart = 0
    this._reactiveLoopBroken = false
    this._cascadeBreakerTripped = false

    if (!this._abortController || this._abortController.signal.aborted) {
      this._abortController = new AbortController()
      this._observers = new Map()
      this._getterDeps = new Map()
      this._subscriberMap = new Map()
      this._observerRecords = new Set()
      this._dependencyGraph = new Map()
      this._dirtyObservers = new Set()
      this._slotObservedKeys = new Set()
      this._dirtyObserversBuffer = []
    }

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
    this._contextUnsubscribers = []
    this._contextCallbacks = []

    this._setupState()
    if (this.componentOptions?.consume) {
      this._setupContextConsumers(this.componentOptions.consume)
    }
    this._setupBindings()
    this._needsDOMUpdate = Boolean(
      (this._bindings && this._bindings.length > 0) ||
      (this.componentOptions?.style && typeof this.componentOptions.style === 'object' && Object.keys(this.componentOptions.style).length > 0) ||
      (this.componentOptions?.slots && Object.keys(this.componentOptions.slots).length > 0) ||
      (this._hooks && this._hooks.onAfterComponentRender && this._hooks.onAfterComponentRender.length > 0)
    )
    if (this._getOwnSlots().length > 0) {
      this._setupSlotObserver()
      this._reconcileLightDOM()
    }

    if (this.componentOptions?.provide) {
      const CustomEventCtor = typeof window !== 'undefined' && window.CustomEvent ? window.CustomEvent : CustomEvent
      this.dispatchEvent(new CustomEventCtor('context-provider', {
        bubbles: true,
        composed: true,
        detail: {
          element: this
        }
      }))
    }

    this._init(isImperative)
  }

  /**
   * Invoked natively when the element is removed from the document.
   * Aborts pending requests and triggers `onDisconnected` plugin hooks
   * to ensure external libraries (e.g., Observers) do not cause memory leaks.
   * @this {any}
   */
  disconnectedCallback () {
    if (this._contextSubscriptions) {
      this._contextSubscriptions.clear()
    }

    if (this._contextUnsubscribers && this._contextUnsubscribers.length > 0) {
      for (const unsub of this._contextUnsubscribers) {
        try {
          unsub()
        } catch {
          /* ignore */
        }
      }
      this._contextUnsubscribers = []
    }

    this._contextCallbacks = []

    if (this._slotObserver) {
      this._slotObserver.disconnect()
      this._slotObserver = null
    }

    if (this._refsKeysObserver) {
      this._refsKeysObserver.disconnect()
      this._refsKeysObserver = null
      this._refsKeysDirty = true
    }

    const ownSlots = this._getOwnSlots()
    ownSlots.forEach(slotEl => {
      slotEl._slotEvaluated = false
    })

    if (this.componentOptions) {
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

    this._pendingDisconnect = true

    queueMicrotask(() => {
      if (this._pendingDisconnect && !this.isConnected) {
        this._teardownLifecycle()
      }
    })
  }

  /**
   * Performs destructive teardown of observers, event controllers, context subscriptions,
   * and signal controllers when an element is genuinely detached from the DOM across task turns.
   * @protected
   */
  _teardownLifecycle () {
    this._wasTornDown = true
    this._domRenderVersion = 0
    this._resolveUpdateComplete(false)
    this._updateCompleteResolvers = null
    this._isUpdatePending = false
    this._isFlushing = false

    if (this._contextSubscriptions) {
      this._contextSubscriptions.clear()
    }

    if (this._contextUnsubscribers && this._contextUnsubscribers.length > 0) {
      for (const unsub of this._contextUnsubscribers) {
        try {
          unsub()
        } catch {
          /* ignore */
        }
      }
      this._contextUnsubscribers = []
    }

    this._contextCallbacks = []

    if (this._getterAbortControllers) {
      for (const ctrl of Object.values(this._getterAbortControllers)) {
        ctrl?.abort()
      }
      this._getterAbortControllers = {}
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

    if (this._getterDeps) {
      this._getterDeps.clear()
      this._getterDeps = null
    }

    if (this._getterContexts) {
      this._getterContexts.clear()
      this._getterContexts = null
    }
    this._slotsHelper = null

    if (this._roStateTracked) {
      this._roStateTracked.clear()
      this._roStateTracked = null
    }
    this._roState = null
    this._styleTracker = null
    this._roStateStyle = null
    this._styleDeps = null
    this._changedStateKeys = null
    this._stylesEvaluated = false
    this._requiredTokens = []
    this._evaluatedTokens = {}
    this._cachedOwnSlots = null
    this._tokenBindings = null

    if (this._formResetCallbacks) {
      this._formResetCallbacks.clear()
    }
    if (this._formDisabledCallbacks) {
      this._formDisabledCallbacks.clear()
    }
    if (this._formRestoreCallbacks) {
      this._formRestoreCallbacks.clear()
    }

    this._dirtyObserversBuffer = null
    this._staleSlotCacheWarned = false
    this._consecutiveFlushCount = 0
    this._flushWindowCount = 0
    this._reactiveLoopBroken = false
    this._slotRuntimeReady = false
    this._processSlotsOnReady = false
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
    if (this._isReflectingToAttribute) {
      return
    }

    this._isReflectingFromAttribute = true
    try {
      const camelName = kebabToCamel(name)
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
    } finally {
      this._isReflectingFromAttribute = false
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
    if (this._state) {
      this._registerSlotStateObserver()
      return
    }

    if (!this._instanceId) {
      if (this.hasAttribute('data-cid')) {
        this._instanceId = this.getAttribute('data-cid')
      } else if (this.componentOptions?.componentId) {
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
    }

    if (!this.hasAttribute('data-cid') && this._instanceId) {
      this.setAttribute('data-cid', this._instanceId)
    }

    const options = this.componentOptions
    const target = { ...options.defaultValues }
    target.errors = {}

    if (options.attributes) {
      for (const key of Object.keys(options.attributes)) {
        const camelName = kebabToCamel(key)
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

    this._initialFormValue = target.value !== undefined
      ? target.value
      : (this.getAttribute('value') ?? options.attributes?.value?.default ?? options.defaultValues?.value ?? null)

    this._initialChecked = target.checked !== undefined
      ? target.checked
      : (this.hasAttribute('checked') || Boolean(options.attributes?.checked?.default) || Boolean(options.defaultValues?.checked))

    if (this._pendingDisabled !== undefined) {
      target.disabled = this._pendingDisabled
      this._pendingDisabled = undefined
    }

    if (this._internals && typeof this._internals.setFormValue === 'function' && target.value !== undefined) {
      this._internals.setFormValue(target.value)
    }

    // Process initial attributes mapping
    for (const attr of this.attributes) {
      const lowerName = attr.name.toLowerCase()
      const camelName = kebabToCamel(attr.name)
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
        const camelName = kebabToCamel(key)
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

    // Initialize consumed context properties on state target
    if (options.consume) {
      const consumerItems = normalizeConsumerItems(options.consume)
      for (const item of consumerItems) {
        applyConsumedState(target, item, item.default, true)
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

    if (options.attributes) {
      for (const key of Object.keys(options.attributes)) {
        const camelName = kebabToCamel(key)

        if (!RESERVED_PROPERTY_BLACKLIST.has(camelName) && (!(camelName in this) || camelName === 'name' || camelName === 'type')) {
          Object.defineProperty(this, camelName, {
            get: () => (this._state ? this._state[camelName] : target[camelName]),
            set: (val) => {
              if (this._state) {
                this._state[camelName] = val
              } else {
                target[camelName] = val
              }
            },
            enumerable: true,
            configurable: true
          })
        }
      }
    }

    const getRef = (id) => this._resolveRef(id, target)

    // Define derived state getters with isolation controllers
    this._getterAbortControllers = {}
    if (!this._getterDeps) {
      this._getterDeps = new Map()
    }
    for (const [key, getter] of Object.entries(options.getters || {})) {
      Object.defineProperty(target, key, {
        get: () => {
          if (this._getterAbortControllers[key]) {
            this._getterAbortControllers[key].abort()
          }
          this._getterAbortControllers[key] = new AbortController()

          let directDeps = this._getterDeps.get(key)
          if (!directDeps) {
            directDeps = new Set()
            this._getterDeps.set(key, directDeps)
          }

          if (!this._getterContexts) {
            this._getterContexts = new Map()
          }

          let context = this._getterContexts.get(key)
          if (!context) {
            const tracker = {
              activeCollector: (p) => {
                if (typeof p === 'string' && (p in target || (options.getters && p in options.getters))) {
                  directDeps.add(p)
                  if (this._collectingDependencies) {
                    this._collectingDependencies.add(p)
                  }
                  if (this._getterDeps?.has(p)) {
                    for (const subDep of this._getterDeps.get(p)) {
                      directDeps.add(subDep)
                      if (this._collectingDependencies) {
                        this._collectingDependencies.add(subDep)
                      }
                    }
                  }
                }
              }
            }
            const roState = this._getTrackedReadOnlyState(key, tracker)
            context = {
              state: roState,
              root: this,
              refs: getRef,
              slots: this._getSlotsHelper(),
              signal: null
            }
            this._getterContexts.set(key, context)
          }

          context.signal = this._getterAbortControllers[key].signal
          return getter(context)
        },
        enumerable: true,
        configurable: true
      })
    }

    this._state = this._createReactiveProxy(target, getRef)
    this._registerSlotStateObserver()
    this._syncValidityFromErrors()

  }

  /**
   * Notifies active context subscribers when a provided state property changes or is deleted.
   * @param {string|symbol} prop - The mutated or deleted property key.
   * @protected
   */
  _notifyContextSubscribers (prop) {
    if (!this._contextSubscriptions || this._contextSubscriptions.size === 0) {
      return
    }
    for (const [key, subs] of this._contextSubscriptions.entries()) {
      for (const sub of Array.from(subs)) {
        const cb = sub.callbackRef ? sub.callbackRef.deref() : undefined
        if (!cb) {
          subs.delete(sub)
          if (subs.size === 0) {
            this._contextSubscriptions.delete(key)
          }
          continue
        }
        if (sub.isFunction && (sub.deps.size === 0 || (typeof prop === 'string' && sub.deps.has(prop)))) {
          safeInvoke(() => {
            const { value, deps } = sub.getValueWithDeps()
            sub.deps = deps
            safeInvoke(cb, value, sub.unsubscribe)
          })
        }
      }
    }
  }

  /**
   * Configures the W3C Context Protocol provider listener on the element instance.
   * @param {Map<any, any> | Object.<string|symbol, Function|any>} provides - Context keys and providers.
   * @protected
   */
  _setupContextProvider (provides) {
    if (!provides || typeof provides !== 'object') {
      return
    }

    this.addEventListener('context-request', (e) => {
      /** @type {any} */
      const event = e
      const key = event.context ?? event.detail?.context
      const callback = event.callback ?? event.detail?.callback
      const subscribe = event.subscribe ?? event.detail?.subscribe

      if (key === undefined || key === null) {
        return
      }

      if (hasContextValue(provides, key)) {
        event.stopImmediatePropagation()

        if (typeof callback === 'function') {
          const getValueWithDeps = () => {
            if (!this._state && this.componentOptions) {
              this._setupState()
            }
            const valOrFn = getContextValue(provides, key)
            if (typeof valOrFn !== 'function') {
              return {
                value: valOrFn,
                deps: new Set()
              }
            }

            const deps = new Set()
            const prevCollector = this._collectingDependencies
            this._collectingDependencies = deps
            try {
              const roState = this._getReadOnlyState()
              const context = {
                state: roState,
                root: this,
                refs: (id) => this._resolveRef(id),
                slots: this._getSlotsHelper(),
                signal: this._abortController?.signal || new AbortController().signal
              }
              const value = valOrFn(context)
              return {
                value,
                deps
              }
            } finally {
              this._collectingDependencies = prevCollector
            }
          }

          const initial = getValueWithDeps()
          let unsubscribe = undefined

          if (subscribe) {
            if (!this._contextSubscriptions) {
              this._contextSubscriptions = new Map()
            }
            if (!this._contextSubscriptions.has(key)) {
              this._contextSubscriptions.set(key, new Set())
            }
            const subs = this._contextSubscriptions.get(key)
            const callbackRef = typeof WeakRef !== 'undefined' ? new WeakRef(callback) : { deref: () => callback }
            const subRecord = {
              callbackRef,
              getValueWithDeps,
              deps: initial.deps,
              isFunction: typeof getContextValue(provides, key) === 'function'
            }
            subs.add(subRecord)
            unsubscribe = () => {
              subs.delete(subRecord)
              if (subs.size === 0) {
                this._contextSubscriptions.delete(key)
              }
            }
            subRecord.unsubscribe = unsubscribe
            safeInvoke(callback, initial.value, unsubscribe)
          } else {
            safeInvoke(callback, initial.value)
          }
        }
      }
    })
  }

  /**
   * Dispatches context-request events for consumed context keys.
   * @param {Array<string|symbol> | Object.<string|symbol, { default?: any }>} consume - Consumed keys.
   * @protected
   */
  _setupContextConsumers (consume) {
    if (!consume) {
      return
    }

    if (this._contextUnsubscribers && this._contextUnsubscribers.length > 0) {
      for (const unsub of this._contextUnsubscribers) {
        try {
          unsub()
        } catch {
          /* ignore */
        }
      }
      this._contextUnsubscribers = []
    }

    this._contextCallbacks = []

    const consumerItems = normalizeConsumerItems(consume)

    if (!this._contextCallbacks) {
      this._contextCallbacks = []
    }

    for (const item of consumerItems) {
      let satisfied = false

      const assignState = (val) => {
        if (!this._state) {
          return
        }
        applyConsumedState(this._state, item, val, false)
      }

      const callback = (value, unsubscribe) => {
        satisfied = true
        if (typeof unsubscribe === 'function') {
          this._contextUnsubscribers.push(unsubscribe)
        }
        assignState(value)
      }

      this._contextCallbacks.push(callback)

      const dispatchReq = () => {
        const ContextRequestEventCtor = typeof ContextRequestEvent !== 'undefined' ? ContextRequestEvent : null
        let event
        if (ContextRequestEventCtor) {
          event = new ContextRequestEventCtor(item.key, callback, true)
        } else {
          const CustomEventCtor = typeof window !== 'undefined' && window.CustomEvent ? window.CustomEvent : CustomEvent
          event = new CustomEventCtor('context-request', {
            bubbles: true,
            composed: true,
            detail: {
              context: item.key,
              subscribe: true,
              callback
            }
          })
          Object.assign(event, {
            context: item.key,
            subscribe: true,
            callback
          })
        }

        /** @type {any} */
        const ev = event
        this.dispatchEvent(ev)
      }

      dispatchReq()

      if (!satisfied && item.default !== null && item.default !== undefined) {
        assignState(item.default)
      }

      if (!satisfied && typeof window !== 'undefined') {
        const onProvider = (e) => {
          if (satisfied) {
            window.removeEventListener('context-provider', onProvider)
            return
          }
          const provEl = e.detail?.element || e.target
          if (provEl && provEl.contains && provEl.contains(this)) {
            dispatchReq()
            if (satisfied) {
              window.removeEventListener('context-provider', onProvider)
            }
          }
        }
        window.addEventListener('context-provider', onProvider)
        this._contextUnsubscribers.push(() => {
          window.removeEventListener('context-provider', onProvider)
        })
      }
    }
  }

  /**
   * Asserts that state mutation inside an observer callback does not create a direct cyclic dependency.
   * Dev/test detection honours the live runtime mode (`window.__coralite__.mode`) with a
   * `process.env.NODE_ENV` fallback, see {@link isDevRuntime}.
   * In dev/test: logs warning for any mutation, and throws CoraliteError on direct cycles.
   * In prod: silently permits non-cyclic cascades, and aborts direct cycles (reporting via console.error and coralite-error event).
   * @param {string|symbol} p - Property being mutated.
   * @returns {boolean} True if the mutation is permitted; false if aborted.
   * @protected
   */
  _assertNotObservingStateMutation (p) {
    if (!this._isExecutingObserver) {
      return true
    }

    const strP = typeof p === 'string' ? p : String(p)
    const activeRecord = this._activeObserverRecord

    const isDirectCycle = activeRecord ? (
      activeRecord.key === strP ||
      activeRecord.dependencies.has(strP) ||
      (typeof p === 'string' && (
        activeRecord.dependencies.has(kebabToCamel(strP)) ||
        activeRecord.dependencies.has(camelToKebab(strP))
      ))
    ) : true

    const msg = isDirectCycle
      ? `Cyclic state mutation detected inside an observe() callback. The observer for "${activeRecord?.key || 'unknown'}" mutates "${strP}", which it depends on. This causes an infinite reactivity loop. Use getters for derived state instead.`
      : `State mutation detected inside an observe() callback. This can cause infinite reactivity loops. Use getters for derived state instead. (mutated property: "${strP}")`

    const isDev = isDevRuntime()

    if (isDev) {
      console.warn(msg)
    }

    if (isDirectCycle) {
      if (isDev) {
        throw new CoraliteError(msg, {
          componentId: this.componentOptions?.componentId,
          instanceId: this._instanceId,
          path: typeof p === 'string' ? p : undefined
        })
      }

      const err = new CoraliteError(msg, {
        componentId: this.componentOptions?.componentId,
        instanceId: this._instanceId,
        path: typeof p === 'string' ? p : undefined
      })

      console.error('Coralite Observer Error:', err)

      let CustomEventCtor = null
      if (typeof window !== 'undefined' && window.CustomEvent) {
        CustomEventCtor = window.CustomEvent
      } else if (typeof CustomEvent !== 'undefined') {
        CustomEventCtor = CustomEvent
      }

      if (CustomEventCtor && typeof this.dispatchEvent === 'function') {
        this.dispatchEvent(new CustomEventCtor('coralite-error', {
          bubbles: true,
          composed: true,
          detail: { error: err }
        }))
      }

      /** @type {any} */
      const self = this
      if (typeof self.emit === 'function') {
        self.emit('coralite-error', { error: err })
      }
      return false
    }

    return true
  }

  /**
   * Resolves a ref identifier to its target element, checking the host
   * attribute, the scoped DOM query, and owned ref nodes as fallbacks.
   *
   * @param {string} id - The ref identifier.
   * @param {Object} [fallbackTarget=null] - State target consulted before the
   * reactive state proxy is initialized.
   * @returns {HTMLElement|null} The resolved element or null.
   * @protected
   */
  _resolveRef (id, fallbackTarget = null) {
    const stateTarget = this._state || fallbackTarget
    const refId = stateTarget ? stateTarget[`ref_${id}`] : null
    if (!refId && typeof refId !== 'string') {
      return null
    }
    if (this.getAttribute && (this.getAttribute('ref') === refId || this.getAttribute('ref') === id)) {
      return this
    }
    /** @type {any} */
    let node = this.querySelector ? this.querySelector(`[ref="${refId}"]`) : null
    if (!node && typeof findOwnedRefNode === 'function') {
      node = findOwnedRefNode(this, id, refId, this._instanceId)
    }
    return node
  }

  /**
   * Wraps the state target in a reactive Proxy.
   * Intercepts property setters to automatically batch and schedule DOM updates.
   * @param {Object} target - The state dictionary.
   * @returns {Proxy} The reactive state proxy.
   * @internal
   */
  _createReactiveProxy (target, getRef) {
    const self = this
    const options = this.componentOptions
    if (!options) {
      return target
    }

    const resolveRef = getRef || ((id) => self._resolveRef(id, target))

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
            const camelTop = kebabToCamel(currentTopKey)
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
          if (!self._assertNotObservingStateMutation(p)) {
            return true
          }
          const oldValue = t[p]
          if (oldValue === v) {
            return true
          }

          const currentTopKey = topKey || p
          const camelTop = kebabToCamel(currentTopKey)
          const kebabTop = camelToKebab(camelTop)

          t[p] = v

          const rootVal = errorsTarget[currentTopKey]
          let flatVal = rootVal
          if (rootVal === null || rootVal === undefined) {
            flatVal = ''
          }

          target['error_' + camelTop] = flatVal
          target['error_' + kebabTop] = flatVal

          self._markKeysDirty('errors', currentTopKey, 'error_' + camelTop, 'error_' + kebabTop)
          self._syncValidityFromErrors()
          self._scheduleUpdate()
          return true
        },

        deleteProperty (t, p) {
          if (typeof p !== 'string') {
            return Reflect.deleteProperty(t, p)
          }
          if (!self._assertNotObservingStateMutation(p)) {
            return true
          }
          const hasProp = Object.prototype.hasOwnProperty.call(t, p)
          const oldValue = t[p]

          if (!hasProp || oldValue === undefined) {
            return true
          }

          const deleted = Reflect.deleteProperty(t, p)
          if (deleted) {
            const currentTopKey = topKey || p
            const camelTop = kebabToCamel(currentTopKey)
            const kebabTop = camelToKebab(camelTop)

            const rootVal = errorsTarget[currentTopKey]
            let flatVal = rootVal
            if (rootVal === null || rootVal === undefined) {
              flatVal = ''
            }

            target['error_' + camelTop] = flatVal
            target['error_' + kebabTop] = flatVal

            self._markKeysDirty('errors', currentTopKey, 'error_' + camelTop, 'error_' + kebabTop)
            self._syncValidityFromErrors()
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

          if (!self._getterDeps) {
            self._getterDeps = new Map()
          }
          let directDeps = self._getterDeps.get(getterKey)
          if (!directDeps) {
            directDeps = new Set()
            self._getterDeps.set(getterKey, directDeps)
          }
          directDeps.clear()

          const parentCollecting = self._collectingDependencies
          self._collectingDependencies = directDeps

          const activeRecord = self._activeObserverRecord

          let value
          try {
            if (options.getters && getterKey in options.getters) {
              value = Reflect.get(t, p, receiver)
            } else {
              if (!self._getterContexts) {
                self._getterContexts = new Map()
              }

              let getterContext = self._getterContexts.get(getterKey)
              if (!getterContext) {
                const tracker = {
                  activeCollector: (subProp) => {
                    if (typeof subProp === 'string' && (subProp in target || (options.getters && subProp in options.getters))) {
                      directDeps.add(subProp)
                      if (self._collectingDependencies) {
                        self._collectingDependencies.add(subProp)
                      }
                      if (self._getterDeps?.has(subProp)) {
                        for (const subDep of self._getterDeps.get(subProp)) {
                          directDeps.add(subDep)
                          if (self._collectingDependencies) {
                            self._collectingDependencies.add(subDep)
                          }
                        }
                      }
                    }
                  }
                }
                const roState = self._getTrackedReadOnlyState(getterKey, tracker)
                getterContext = {
                  state: roState,
                  root: self,
                  refs: resolveRef,
                  slots: self._getSlotsHelper(),
                  signal: null
                }
                self._getterContexts.set(getterKey, getterContext)
              }

              getterContext.signal = self._getterAbortControllers?.[getterKey]?.signal || new AbortController().signal
              value = getterFn(getterContext)
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
          if (value instanceof Promise && activeRecord) {
            const record = activeRecord
            const deps = directDeps
            value.then(() => {
              if (!self._observerRecords || !self._observerRecords.has(record)) {
                return
              }
              const merged = new Set([...record.dependencies, ...deps])
              if (merged.size === record.dependencies.size && [...merged].every(d => record.dependencies.has(d))) {
                return
              }
              self._updateObserverSubscriptions(record, merged)
            }, (err) => {
              if (err?.name !== 'AbortError') {
                console.error('Coralite Async Getter Error:', err)
              }
            })
          }

          return value
        }

        const value = Reflect.get(t, p, receiver)

        if (self._collectingDependencies && typeof p === 'string' && (p in target || (options.getters && p in options.getters))) {
          self._collectingDependencies.add(p)
        }

        return value
      },

      set (t, p, v) {
        if (!self._assertNotObservingStateMutation(p)) {
          return true
        }
        if (!self._isExecutingObserver) {
          self._reactiveLoopBroken = false
          self._cascadeBreakerTripped = false
        }
        if (p === 'errors') {
          const existingKeys = Object.keys(errorsTarget)
          const newKeys = (v && typeof v === 'object') ? Object.keys(v) : []
          const affectedKeys = new Set([...existingKeys, ...newKeys])

          for (const key of existingKeys) {
            delete errorsTarget[key]
            const camelName = kebabToCamel(key)
            const kebabName = camelToKebab(camelName)
            target['error_' + camelName] = ''
            target['error_' + kebabName] = ''
          }

          if (v && typeof v === 'object') {
            for (const key of Object.keys(v)) {
              const val = v[key]
              errorsTarget[key] = val
              const camelName = kebabToCamel(key)
              const kebabName = camelToKebab(camelName)
              target['error_' + camelName] = val
              target['error_' + kebabName] = val
            }
          }

          self._markKeysDirty('errors')
          for (const key of affectedKeys) {
            const camelName = kebabToCamel(key)
            const kebabName = camelToKebab(camelName)
            self._markKeysDirty(key, 'error_' + camelName, 'error_' + kebabName)
          }
          self._syncValidityFromErrors()
          self._scheduleUpdate()
          return true
        }

        const isStrProp = typeof p === 'string'
        let camelName = null
        let kebabName = null

        if (isStrProp) {
          camelName = kebabToCamel(p)
        }

        if (isStrProp && options.attributes) {
          kebabName = camelToKebab(camelName)
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

              self._abortGetterControllers(camelName, kebabName, p)
              self._reflectAttributeChange(camelName, p, schema, { removed: true }, kebabName)
              self._observeSlotStateKey(p)
              self._markKeysDirty(camelName, kebabName, p)
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

        t[p] = v

        if (isStrProp) {
          if (!kebabName) {
            kebabName = camelToKebab(camelName)
          }
          self._reflectAttributeChange(camelName, p, options.attributes?.[camelName] || options.attributes?.[p], { value: v }, kebabName)
          self._observeSlotStateKey(p)
          if (!p.includes('-') && p === p.toLowerCase()) {
            self._markKeysDirty(p)
          } else {
            self._markKeysDirty(camelName, kebabName, p)
          }
        }

        /** @type {typeof CoraliteElement} */
        // @ts-ignore
        const ctor = self.constructor
        if (ctor.formAssociated && self._internals) {
          if (p === 'value') {
            if (typeof self._internals.setFormValue === 'function') {
              if (typeof v === 'string' || v === null || v === undefined || (typeof File !== 'undefined' && v instanceof File) || (typeof FormData !== 'undefined' && v instanceof FormData)) {
                self._internals.setFormValue(v ?? null)
              }
            }
            self._syncValidityFromErrors()
          }
        }

        self._notifyContextSubscribers(p)

        self._scheduleUpdate()

        return true
      },

      deleteProperty (t, p) {
        if (typeof p !== 'string') {
          return Reflect.deleteProperty(t, p)
        }
        if (!self._assertNotObservingStateMutation(p)) {
          return true
        }
        const camelName = kebabToCamel(p)
        const kebabName = camelToKebab(camelName)

        const oldValue = t[p] ?? t[camelName] ?? t[kebabName]

        let deleted = false
        for (const key of [camelName, kebabName, p]) {
          if (Reflect.deleteProperty(t, key)) {
            deleted = true
          }
        }

        self._abortGetterControllers(camelName, kebabName, p)

        if (deleted && oldValue !== undefined) {
          self._reflectAttributeChange(camelName, p, options.attributes?.[camelName] || options.attributes?.[p], { removed: true })
          self._observeSlotStateKey(p)
          self._markKeysDirty(camelName, kebabName, p)

          self._notifyContextSubscribers(p)

          self._scheduleUpdate()
        }
        return deleted
      }
    })
  }

  /**
   * Traverses the DOM tree using an AST-generated path index array.
   * Allows O(1) element lookups without relying on querySelectors or classes.
   * Component boundaries resolve by compiler-stamped slot index; everything else traverses positionally.
   * @param {number[]} path - Array of childNode indices (e.g., `[0, 1, 2]`).
   * @returns {Node|null} The physical DOM node, or null if traversal fails.
   */
  getNodeByPath (path) {
    let node = this
    for (const index of path) {
      if (!node) {
        return null
      }

      // Only real Coralite components own a slot-index space; plain and foreign elements do not.
      const isComponentBoundary = node !== this && Boolean(node.componentOptions || node._instanceId || (node.hasAttribute && node.hasAttribute('data-cid')))

      if (isComponentBoundary) {
        const candidates = node.querySelectorAll(`[data-coralite-slot-index="${index}"]`)
        let foundNode = null
        for (const cand of candidates) {
          // Reject candidates owned by a deeper Coralite component boundary.
          /** @type {any} */
          let parent = cand.parentElement
          while (parent && parent !== node) {
            const isDeeperBoundary = Boolean(parent.componentOptions || parent._instanceId || (parent.hasAttribute && parent.hasAttribute('data-cid')))

            if (isDeeperBoundary) {
              break
            }
            parent = parent.parentElement
          }
          if (parent === node) {
            foundNode = cand
            break
          }
        }
        if (!foundNode) {
          return null
        }
        // @ts-ignore
        node = foundNode
        continue
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
    this._requiredTokens = []
    this._evaluatedTokens = {}
    this._cachedOwnSlots = null
    this._pendingBindingRetries = 0

    const map = this.componentOptions.hydrationMap
    if (!map) {
      return
    }

    this._tokenBindings = map.tokenBindings || null

    const fallbackParse = (template) => {
      if (!template || typeof template !== 'string') {
        return {
          tokens: [],
          isSingleToken: false,
          singleTokenKey: undefined,
          segments: null
        }
      }
      const tokens = []
      template.replace(/\{\{\s*(.+?)\s*\}\}/g, (_, key) => {
        tokens.push(key)
        return ''
      })
      const trimmed = template.trim()
      const isSingleToken = tokens.length === 1 && (trimmed === `{{${tokens[0]}}}` || trimmed === `{{ ${tokens[0]} }}`)
      return {
        tokens,
        isSingleToken,
        singleTokenKey: tokens[0],
        segments: null
      }
    }

    if (map.texts) {
      for (let i = 0; i < map.texts.length; i++) {
        const item = map.texts[i]
        const node = this.getNodeByPath(item.path)
        const parsed = item.tokens !== undefined ? item : fallbackParse(item.template)
        this._bindings.push({
          type: item.type || 'text',
          node,
          path: item.path,
          template: item.template,
          tokens: parsed.tokens,
          isSingleToken: parsed.isSingleToken,
          singleTokenKey: parsed.singleTokenKey,
          segments: parsed.segments
        })
      }
    }

    if (map.attributes) {
      for (let i = 0; i < map.attributes.length; i++) {
        const item = map.attributes[i]
        // See the note above: unresolved paths stay pending and are retried by _updateDOM().
        const node = this.getNodeByPath(item.path)
        const parsed = item.tokens !== undefined ? item : fallbackParse(item.template)
        const attrKind = item.attrKind !== undefined ? item.attrKind : classifyAttribute(item.name, parsed.isSingleToken)
        this._bindings.push({
          type: 'attribute',
          node,
          path: item.path,
          name: item.name,
          template: item.template,
          tokens: parsed.tokens,
          isSingleToken: parsed.isSingleToken,
          singleTokenKey: parsed.singleTokenKey,
          segments: parsed.segments,
          attrKind
        })
      }
    }

    if (map.requiredTokens && Array.isArray(map.requiredTokens)) {
      this._requiredTokens = map.requiredTokens
    } else if (this._bindings.length > 0) {
      const seen = new Set()
      for (let i = 0; i < this._bindings.length; i++) {
        const bindingTokens = this._bindings[i].tokens
        if (!bindingTokens) {
          continue
        }
        for (let j = 0; j < bindingTokens.length; j++) {
          seen.add(bindingTokens[j])
        }
      }
      this._requiredTokens = Array.from(seen)
    }
  }

  /**
   * Schedules a DOM update in the next microtask queue.
   * This guarantees that multiple synchronous state mutations result in only one render pass.
   * Note: Observers must be marked dirty via _markObserverDirty() BEFORE calling _scheduleUpdate() so microtask elision checks inspect updated observers.
   * @private
   */
  _scheduleUpdate () {
    if (this._isUpdatePending || this._reactiveLoopBroken) {
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
    this._isFlushing = true
    this._isUpdatePending = false

    let aborted = false
    try {
      if (!this.isConnected) {
        if (this._dirtyObservers) {
          this._dirtyObservers.clear()
        }
        this._consecutiveFlushCount = 0
        this._flushWindowCount = 0
        aborted = true
        return
      }

      if (this._reactiveLoopBroken) {
        return
      }

      const now = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()
      if (!this._flushWindowStart || (now - this._flushWindowStart) > FLUSH_WINDOW_MS) {
        this._flushWindowStart = now
        this._flushWindowCount = 1
      } else {
        this._flushWindowCount++
      }

      this._consecutiveFlushCount++

      const exceedsDepth = this._consecutiveFlushCount > MAX_REACTIVE_CASCADE_DEPTH
      const exceedsRate = this._flushWindowCount > MAX_FLUSHES_PER_WINDOW

      if (exceedsDepth || exceedsRate) {
        this._consecutiveFlushCount = 0
        this._flushWindowCount = 0
        this._reactiveLoopBroken = true
        this._cascadeBreakerTripped = true

        if (this._dirtyObservers) {
          this._dirtyObservers.clear()
        }

        if (this._needsDOMUpdate) {
          try {
            this._updateDOM()
          } catch {
            // ignore render error during emergency latch
          }
        }

        const reason = exceedsDepth
          ? `Maximum reactive cascade depth exceeded (${MAX_REACTIVE_CASCADE_DEPTH}).`
          : `Maximum reactive flush rate exceeded (${MAX_FLUSHES_PER_WINDOW} flushes in ${FLUSH_WINDOW_MS}ms).`

        const err = new CoraliteError(
          `${reason} This indicates an infinite reactivity loop where an observer or getter cyclically mutates state. ` +
          `Ensure observe() callbacks and getters do not mutate state properties they depend on.`,
          {
            componentId: this.componentOptions?.componentId,
            instanceId: this._instanceId
          }
        )

        console.error('Coralite Reactive Cascade Error:', err)
        let CustomEventCtor = null
        if (typeof window !== 'undefined' && window.CustomEvent) {
          CustomEventCtor = window.CustomEvent
        } else if (typeof CustomEvent !== 'undefined') {
          CustomEventCtor = CustomEvent
        }

        if (CustomEventCtor && typeof this.dispatchEvent === 'function') {
          this.dispatchEvent(new CustomEventCtor('coralite-error', {
            bubbles: true,
            composed: true,
            detail: { error: err }
          }))
        }

        /** @type {any} */
        const self = this
        if (typeof self.emit === 'function') {
          self.emit('coralite-error', { error: err })
        }
        aborted = true
        return
      }

      try {
        if (this._needsDOMUpdate) {
          this._updateDOM()
        }

        if (this._dirtyObservers && this._dirtyObservers.size > 0) {
          this._flushDirtyObservers()
        }
      } finally {
        if (!this._isUpdatePending) {
          this._consecutiveFlushCount = 0
        }
      }
    } catch (err) {
      aborted = true
      throw err
    } finally {
      this._isFlushing = false
      if (!this._isUpdatePending) {
        this._resolveUpdateComplete(!aborted)
      }
    }
  }

  /**
   * Evaluates reactive style definitions and sets/removes CSS property declarations on the host element.
   * @private
   */
  /**
   * Returns an instance-cached read-only proxy of the reactive state.
   * Avoids re-allocating a `WeakMap`, handler closure and `Proxy` on every
   * style/context evaluation.
   * @returns {Object|null} The read-only state view, or `null` before state init.
   * @protected
   */
  _getReadOnlyState () {
    if (!this._state) {
      return null
    }
    if (!this._roState) {
      this._roState = createReadOnlyProxy(this._state)
    }
    return this._roState
  }

  /**
   * Returns an instance-cached read-only proxy of reactive state bound to a dependency tracker.
   * @param {string} key - The derived state key the tracker belongs to.
   * @param {Object} tracker - Dependency tracker exposing `activeCollector`.
   * @returns {Object|null} The tracked read-only state view.
   * @protected
   */
  _getTrackedReadOnlyState (key, tracker) {
    if (!this._state) {
      return null
    }
    if (!this._roStateTracked) {
      this._roStateTracked = new Map()
    }

    let entry = this._roStateTracked.get(key)
    if (!entry) {
      const proxies = new WeakMap()
      entry = {
        proxies,
        roState: createReadOnlyProxy(this._state, proxies, tracker)
      }
      this._roStateTracked.set(key, entry)
    }

    return entry.roState
  }

  /**
   * Returns an instance-cached tracked read-only view of reactive state for style getters.
   * @returns {Object|null} The style-tracked read-only state view.
   * @protected
   */
  _getStyleReadOnlyState () {
    if (!this._state) {
      return null
    }
    if (!this._styleDeps) {
      this._styleDeps = new Set()
    }
    if (!this._styleTracker) {
      const self = this
      this._styleTracker = {
        activeCollector: (prop) => {
          if (typeof prop === 'string' && self._styleDeps) {
            self._styleDeps.add(prop)
          }
        }
      }
    }
    if (!this._roStateStyle) {
      this._roStateStyle = createReadOnlyProxy(this._state, new WeakMap(), this._styleTracker)
    }
    return this._roStateStyle
  }

  /**
   * Applies reactive styles only when a style dependency has changed.
   * @protected
   */
  _applyStylesIfDirty () {
    if (!this.componentOptions?.style) {
      if (this._changedStateKeys) {
        this._changedStateKeys.clear()
      }
      return
    }

    if (this._stylesEvaluated) {
      const changedKeys = this._changedStateKeys
      if (!changedKeys || changedKeys.size === 0) {
        return
      }

      let intersect = false
      for (const dep of this._styleDeps) {
        if (changedKeys.has(dep)) {
          intersect = true
          break
        }
      }

      if (!intersect) {
        changedKeys.clear()
        return
      }
    }

    this._applyStyles()
  }

  /**
   * @private
   */
  _applyStyles () {
    const styleObj = this.componentOptions?.style
    if (!styleObj || typeof styleObj !== 'object') {
      return
    }

    const roState = this._getReadOnlyState()
    /** @type {Array<{ normKey: string, val: any }>} */
    const evaluatedProps = []

    // Track style dependencies for subsequent render passes
    if (!this._styleDeps) {
      this._styleDeps = new Set()
    }
    const styleDeps = this._styleDeps
    styleDeps.clear()

    const prevCollector = this._collectingDependencies
    const trackedRoState = this._getStyleReadOnlyState() || roState
    this._collectingDependencies = styleDeps

    try {
      // Phase 1: Evaluation & Validation
      for (const [key, valOrFn] of Object.entries(styleObj)) {
        const normKey = normalizeStyleKey(key)
        if (!normKey) {
          continue
        }

        let val
        if (typeof valOrFn === 'function') {
          try {
            val = valOrFn(trackedRoState || roState)
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
    } finally {
      this._collectingDependencies = prevCollector
    }

    this._stylesEvaluated = true
    if (this._changedStateKeys) {
      this._changedStateKeys.clear()
    }
  }

  /**
   * Performs the physical DOM update and resolves template tokens.
   * Uses Symbol-based locking (`renderVersion`) to discard stale async renders.
   * @this {any}
   * @private
   */
  _updateDOM () {
    if (!this._needsDOMUpdate) {
      return
    }

    const renderVersion = ++this._renderVersionCounter
    this._domRenderVersion = renderVersion

    // Reuse pre-computed requiredTokens and evaluatedTokens container
    const requiredTokens = this._requiredTokens || []
    let evaluatedTokens = this._evaluatedTokens
    if (!evaluatedTokens) {
      evaluatedTokens = this._evaluatedTokens = {}
    }
    let hasPromise = false

    for (let i = 0; i < requiredTokens.length; i++) {
      const key = requiredTokens[i]
      let val = this._state[key]
      if (typeof val === 'function') {
        val = val(this._state)
      }
      evaluatedTokens[key] = val
      if (val instanceof Promise) {
        hasPromise = true
      }
    }

    const applyBindings = (tokenValues) => {
      if (this._domRenderVersion !== renderVersion) {
        return
      }

      // Selectively update only bindings affected by changed state keys
      let targetBindings = this._bindings
      const changedKeys = this._changedStateKeys
      const tokenMap = this._tokenBindings

      if (this._bindings.length > 6 && changedKeys && changedKeys.size > 0 && tokenMap) {
        const dirtyIndices = new Set()
        const allDirtyKeys = new Set(changedKeys)

        if (this._getterDeps) {
          for (const [getterKey, deps] of this._getterDeps) {
            for (const key of changedKeys) {
              if (deps.has(key)) {
                allDirtyKeys.add(getterKey)
                break
              }
            }
          }
        }

        if (this.componentOptions.getters) {
          for (const getterKey of Object.keys(this.componentOptions.getters)) {
            if (!this._getterDeps || !this._getterDeps.has(getterKey)) {
              allDirtyKeys.add(getterKey)
            }
          }
        }

        for (const key of allDirtyKeys) {
          const indices = tokenMap[key]
          if (indices) {
            for (let k = 0; k < indices.length; k++) {
              dirtyIndices.add(indices[k])
            }
          }
        }
        if (dirtyIndices.size > 0) {
          const selective = []
          for (const idx of dirtyIndices) {
            if (this._bindings[idx]) {
              selective.push(this._bindings[idx])
            }
          }
          targetBindings = selective
        }
      }

      let unresolvedBindings = 0

      for (let i = 0; i < targetBindings.length; i++) {
        const binding = targetBindings[i]
        let node = binding.node
        if (binding.path && (!node || !isNodeConnected(node))) {
          const resolved = this.getNodeByPath(binding.path)
          if (resolved) {
            binding.node = resolved
            node = resolved
          }
        }

        if (!node) {
          unresolvedBindings++
          continue
        }

        let hydratedValue
        if (binding.isSingleToken) {
          hydratedValue = String(tokenValues[binding.singleTokenKey] ?? '')
        } else {
          const segments = binding.segments
          if (segments) {
            hydratedValue = ''
            for (let s = 0; s < segments.length; s++) {
              const segment = segments[s]
              hydratedValue += segment[0] === 0 ? segment[1] : (tokenValues[segment[1]] ?? '')
            }
          } else {
            hydratedValue = binding.template.replace(/\{\{\s*(.+?)\s*\}\}/g, (_, key) => {
              return tokenValues[key] ?? ''
            })
          }
        }

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

          let kind = binding.attrKind || 0
          if (kind === 0 && isBooleanCustomAttribute(element, binding.name)) {
            kind = 1
          }
          switch (kind) {
            case 1: {
              const isFalsy = hydratedValue === '' || hydratedValue === 'false' || hydratedValue === 'null' || hydratedValue === '0' || hydratedValue === 'undefined'
              if (isFalsy) {
                element.removeAttribute(binding.name)
              } else {
                element.setAttribute(binding.name, '')
              }
              break
            }
            case 2: {
              const rawTokenVal = tokenValues[binding.singleTokenKey]
              const targetVal = resolveAriaBooleanState(rawTokenVal)

              if (targetVal === null) {
                element.removeAttribute(binding.name)
              } else if (element.getAttribute(binding.name) !== targetVal) {
                element.setAttribute(binding.name, targetVal)
              }
              break
            }
            case 3: {
              const isFalsy = hydratedValue === '' || hydratedValue === 'false' || hydratedValue === 'null' || hydratedValue === 'undefined'
              if (isFalsy) {
                element.removeAttribute(binding.name)
              } else {
                if (element.getAttribute(binding.name) !== hydratedValue) {
                  element.setAttribute(binding.name, hydratedValue)
                }
              }
              break
            }
            default: {
              let isNullish = false
              if (binding.isSingleToken) {
                const rawVal = tokenValues[binding.singleTokenKey]
                isNullish = rawVal === null || rawVal === undefined
              } else {
                isNullish = hydratedValue === 'null' || hydratedValue === 'undefined'
              }

              if (isNullish) {
                if (element.hasAttribute(binding.name)) {
                  element.removeAttribute(binding.name)
                }
              } else if (element.getAttribute(binding.name) !== hydratedValue) {
                element.setAttribute(binding.name, hydratedValue)
              }

              break
            }
          }
        }
      }

      if (unresolvedBindings > 0 && this._pendingBindingRetries < MAX_PENDING_BINDING_RETRIES) {
        this._pendingBindingRetries++
        this._needsDOMUpdate = true
        this._scheduleUpdate()
      }

      this._applyStylesIfDirty()

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
      const keys = requiredTokens
      const promises = []
      for (let i = 0; i < keys.length; i++) {
        promises.push(Promise.resolve(evaluatedTokens[keys[i]]))
      }

      Promise.all(promises).then(resolvedValues => {
        const resolvedMap = {}
        for (let i = 0; i < keys.length; i++) {
          resolvedMap[keys[i]] = resolvedValues[i]
        }
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

    if (record.dependencies.size === 0 && typeof key === 'string') {
      this._updateObserverSubscriptions(record, new Set([key]))
    }

    if (this._abortController && this._abortController.signal) {
      this._abortController.signal.addEventListener('abort', () => {
        if (this._observerRecords && this._observerRecords.has(record)) {
          record.cleanup()
          this._observerRecords.delete(record)
        }
      }, { once: true })
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
   * Aborts and cleans up active getter AbortControllers for the specified property names.
   * @param {...string} names - Property names to abort.
   * @protected
   */
  _abortGetterControllers (...names) {
    if (!this._getterAbortControllers) {
      return
    }
    for (const name of names) {
      if (this._getterAbortControllers[name]) {
        this._getterAbortControllers[name].abort()
        delete this._getterAbortControllers[name]
      }
    }
  }

  /**
   * Synchronizes a reactive state property change to its corresponding DOM attribute.
   * @param {string} camelName - Camel-cased property name.
   * @param {string} [p] - Raw property key.
   * @param {object|Function|Array|string} [schema] - Property attribute schema.
   * @param {object} [options] - Options indicating whether the attribute is removed or its new value.
   * @param {*} [options.value] - The new value to reflect.
   * @param {boolean} [options.removed=false] - Whether the property/attribute is removed.
   * @protected
   */
  _reflectAttributeChange (camelName, p, schema, { value, removed = false } = {}, precomputedKebabName = null) {
    if (this._isReflectingFromAttribute) {
      return
    }

    const kebabName = precomputedKebabName || camelToKebab(camelName || (p ? kebabToCamel(p) : ''))
    const resolvedSchema = schema ||
      this.componentOptions?.attributes?.[camelName] ||
      (p ? this.componentOptions?.attributes?.[p] : undefined) ||
      (kebabName ? this.componentOptions?.attributes?.[kebabName] : undefined)

    if (!resolvedSchema || !shouldReflectAttribute(resolvedSchema)) {
      return
    }

    if (removed) {
      if (typeof this.removeAttribute === 'function') {
        this._isReflectingToAttribute = true
        try {
          if (this.hasAttribute(kebabName)) {
            this.removeAttribute(kebabName)
          }
        } finally {
          this._isReflectingToAttribute = false
        }
      }
      return
    }

    if (typeof this.setAttribute !== 'function') {
      return
    }

    this._isReflectingToAttribute = true
    try {
      const schemaObj = resolveSchema(resolvedSchema)
      const targetType = schemaObj.type || (schemaObj.values ? inferTypeFromValues(schemaObj.values) : undefined)
      const isBoolean = targetType === Boolean || targetType === 'Boolean'

      if (isBoolean) {
        const isTruthy = Boolean(value) && value !== 'false'
        if (isTruthy) {
          if (!this.hasAttribute(kebabName)) {
            this.setAttribute(kebabName, '')
          }
        } else {
          if (typeof this.removeAttribute === 'function' && this.hasAttribute(kebabName)) {
            this.removeAttribute(kebabName)
          }
        }
      } else {
        if (value === null || value === undefined) {
          if (typeof this.removeAttribute === 'function' && this.hasAttribute(kebabName)) {
            this.removeAttribute(kebabName)
          }
        } else {
          const strVal = String(value)
          if (this.getAttribute(kebabName) !== strVal) {
            this.setAttribute(kebabName, strVal)
          }
        }
      }
    } finally {
      this._isReflectingToAttribute = false
    }
  }

  /**
   * Registers dynamic slot re-processing observer for a mutated state property if slotted content exists.
   * @param {string} prop - State property key.
   * @protected
   */
  _observeSlotStateKey (prop) {
    if (typeof prop !== 'string') {
      return
    }

    if (this.componentOptions?.slots && Object.keys(this.componentOptions.slots).length > 0) {
      if (this._slotObservedKeys && !this._slotObservedKeys.has(prop)) {
        this._slotObservedKeys.add(prop)
        this._observeStateKey(prop, () => this._processSlots())
      }
    }
  }

  /**
   * Marks observers dirty for multiple state keys and schedules an update if needed.
   * @param {...string} names - State keys to mark dirty.
   * @protected
   */
  _markKeysDirty (...names) {
    // A state change gives unresolved binding paths another chance to resolve.
    this._pendingBindingRetries = 0

    // Track changed keys before subscriber guard for style and binding checks
    if (this._styleDeps || this._tokenBindings) {
      if (!this._changedStateKeys) {
        this._changedStateKeys = new Set()
      }
      for (let i = 0; i < names.length; i++) {
        this._changedStateKeys.add(names[i])
      }
    }

    if (!this._subscriberMap) {
      return
    }

    for (const key of names) {
      const records = this._subscriberMap.get(key)
      if (records) {
        if (!this._dirtyObservers) {
          this._dirtyObservers = new Set()
        }
        for (const record of records) {
          this._dirtyObservers.add(record)
        }
      }
    }

    if (this._dirtyObservers && this._dirtyObservers.size > 0) {
      this._scheduleUpdate()
    }
  }

  /**
   * Marks observers dirty for a single state key and schedules an update if needed.
   * @param {string} stateKey - State key to mark dirty.
   * @protected
   */
  _markObserverDirty (stateKey) {
    this._markKeysDirty(stateKey)
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
        if (this._slotObservedKeys && !this._slotObservedKeys.has(key)) {
          this._slotObservedKeys.add(key)
          this._observeStateKey(key, () => {
            this._processSlots()
          })
        }
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
    this._slotObserver = new MutationObserver((mutations) => {
      this._reconcileLightDOM()
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          /** @type {any} */
          const elNode = node
          if (elNode && elNode.nodeType === 1 && typeof elNode._reconcileLightDOM === 'function') {
            elNode._reconcileLightDOM()
          }
        }
      }
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
            let lightIndex = 0
            for (let ci = 0; ci < candidates.length; ci++) {
              const cn = candidates[ci]
              if (cn === elementNode) {
                break
              }
              lightIndex++
            }

            if (lightIndex < this._nextSlotIndex) {
              lightIndex = this._nextSlotIndex
            }

            elementNode.setAttribute('data-coralite-slot-index', String(lightIndex))
            if (lightIndex >= this._nextSlotIndex) {
              this._nextSlotIndex = lightIndex + 1
            }
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
          // Store the live node reference by identity so computed slot functions
          // receive the authored nodes (with listeners and bindings intact) and
          // repeated reconciliations stay idempotent.
          if (!targetSlot._originalNodes.includes(node)) {
            targetSlot._originalNodes.push(node)
          }

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
   * @returns {CoraliteSlotElement[]}
   * @private
   */
  _getOwnSlots () {
    if (this._cachedOwnSlots !== null) {
      if (this._cachedOwnSlots.every(s => s && s.isConnected)) {
        return this._cachedOwnSlots
      }

      this._cachedOwnSlots = null

      if (isDevRuntime() && !this._staleSlotCacheWarned) {
        this._staleSlotCacheWarned = true
        console.warn(`[Coralite] Stale slot cache detected for component "${this.componentOptions?.componentId || this.tagName?.toLowerCase() || 'unknown'}". One or more previously cached <slot> elements have been disconnected from the DOM.`)
      }
    }

    const map = this.componentOptions?.hydrationMap

    if (map?.slots && Array.isArray(map.slots) && map.slots.length > 0) {
      /** @type {any[]} */
      const slots = []
      let allFound = true
      for (let i = 0; i < map.slots.length; i++) {
        const node = this.getNodeByPath(map.slots[i].path)
        if (node && node.nodeName === 'SLOT') {
          slots.push(node)
        } else {
          allFound = false
          break
        }
      }
      if (allFound) {
        this._cachedOwnSlots = slots
        return slots
      }
    }

    /** @type {CoraliteSlotElement[]} */
    const allSlots = Array.from(this.querySelectorAll('slot'))
    const ownId = this.getAttribute('data-cid') || this._instanceId

    const ownSlots = allSlots.filter(slotEl => {
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

    this._cachedOwnSlots = ownSlots
    return ownSlots
  }

  /**
   * Evaluates and projects Light DOM elements into their respective `<slot>` nodes.
   * Invokes component-specific slot transformation functions.
   * @private
   */
  /**
   * Applies the returned result of a slot function or observer callback to the slot element.
   * Handles single Nodes, Node arrays, strings, null/empty clears, undefined no-ops, and Promises.
   * @param {CoraliteSlotElement} slotEl - The slot DOM element.
   * @param {any} result - The transformation result.
   * @param {number|null} [renderVersion=null] - Optional render cycle lock token.
   * @protected
   */
  _applySlotResult (slotEl, result, renderVersion = null) {
    const currentSlotVersion = slotEl._slotRenderVersion
    if (renderVersion && currentSlotVersion && currentSlotVersion !== renderVersion) {
      return
    }
    if (this._abortController?.signal?.aborted) {
      return
    }

    if (slotEl.hasAttribute('data-coralite-slot-computed')) {
      slotEl.removeAttribute('data-coralite-slot-computed')
    }

    if (result === undefined) {
      return
    }

    if (result && typeof result.then === 'function') {
      const capturedVersion = renderVersion || ++this._slotRenderVersionCounter
      slotEl._slotRenderVersion = capturedVersion
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
   * @param {CoraliteSlotElement} slotEl - The target slot element.
   * @returns {Proxy} The context proxy.
   * @private
   */
  _createSlotContext (slotName, slotEl) {
    const baseCtx = this._resolvedClientContext || {
      instanceId: this._instanceId,
      state: this._state,
      root: this,
      slots: this._getSlotsHelper(),
      signal: this._abortController?.signal,
      refs: (id) => this._resolveRef(id),
      isServer: false,
      isClient: true
    }

    const slotContextObj = {
      ...baseCtx,
      observe: (key, cb) => {
        if (!this._slotHasInternalObservers) {
          this._slotHasInternalObservers = new Map()
        }
        this._slotHasInternalObservers.set(slotName, true)

        const wrappedCb = (newVal, oldVal) => {
          const renderVersion = ++this._slotRenderVersionCounter
          slotEl._slotRenderVersion = renderVersion
          const res = cb(newVal, oldVal)
          this._applySlotResult(slotEl, res, renderVersion)
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
        const isServerComputed = slotEl.hasAttribute('data-coralite-slot-computed')
        const isFallback = slotEl.hasAttribute('data-coralite-fallback')

        if (!slotEl._slotEvaluated) {
          if (isServerComputed) {
            slotEl._slotEvaluated = true
            if (!slotEl._originalNodes) {
              if (isFallback) {
                slotEl._originalNodes = []
              } else {
                slotEl._originalNodes = Array.from(slotEl.childNodes)
              }
            }
            slotEl.removeAttribute('data-coralite-slot-computed')
            return
          } else {
            if (!slotEl._originalNodes) {
              slotEl._originalNodes = Array.from(slotEl.childNodes)
            }
          }
        }

        if (slotEl.hasAttribute('data-coralite-slot-computed')) {
          slotEl.removeAttribute('data-coralite-slot-computed')
        }

        if (slotEl._slotEvaluated && this._slotHasInternalObservers?.get(slotName)) {
          return
        }

        const slotContext = this._createSlotContext(slotName, slotEl)
        const renderVersion = ++this._slotRenderVersionCounter
        slotEl._slotRenderVersion = renderVersion

        const result = slotFn(slotEl._originalNodes, slotContext)
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

    if (!this._hasInitAbortListener || signal !== this._lastInitSignal) {
      this._lastInitSignal = signal
      this._hasInitAbortListener = true
      signal.addEventListener('abort', () => {
        this._hasInitAbortListener = false
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
      }, { once: true })
    }

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
      slots: this._getSlotsHelper(),
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
      emit,
      isServer: false,
      isClient: true,

      setFormValue: (value, state) => {
        /** @type {typeof CoraliteElement} */
        // @ts-ignore
        const ctor = self.constructor
        if (self._internals && typeof self._internals.setFormValue === 'function') {
          self._internals.setFormValue(value, state)
        } else if (isDevRuntime() && !ctor.formAssociated) {
          console.warn(`Coralite Warning: setFormValue() called on component "${self.componentOptions?.componentId}", but "formAssociated: true" is not configured.`)
        }
      },
      setValidity: (flags = {}, message = '', anchor) => {
        /** @type {typeof CoraliteElement} */
        // @ts-ignore
        const ctor = self.constructor
        const hasError = Object.values(flags).some(Boolean)
        self._manualValiditySet = hasError
        if (self._internals && typeof self._internals.setValidity === 'function') {
          self._internals.setValidity(flags, message, anchor)
        } else if (isDevRuntime() && !ctor.formAssociated) {
          console.warn(`Coralite Warning: setValidity() called on component "${self.componentOptions?.componentId}", but "formAssociated: true" is not configured.`)
        }
      },
      internals: this._internals,

      get form () {
        return self.form
      },
      get validity () {
        return self.validity
      },
      get validationMessage () {
        return self.validationMessage
      },
      get updateComplete () {
        return self.updateComplete
      },
      checkValidity: () => self.checkValidity(),
      reportValidity: () => self.reportValidity(),

      onFormReset: (cb) => {
        self._formResetCallbacks.add(cb)
        return () => self._formResetCallbacks.delete(cb)
      },
      onFormDisabled: (cb) => {
        self._formDisabledCallbacks.add(cb)
        return () => self._formDisabledCallbacks.delete(cb)
      },
      onFormRestore: (cb) => {
        self._formRestoreCallbacks.add(cb)
        return () => self._formRestoreCallbacks.delete(cb)
      }
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

    if (isDevRuntime()) {
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

    const shouldRunClient = Boolean(this.componentOptions.client) && (!this._hasRunClient || this._wasTornDown)
    if (shouldRunClient) {
      this._hasRunClient = true
      this._wasTornDown = false
      try {
        await this.componentOptions.client(localContext)
      } catch (error) {
        console.error(`Coralite Error: Component "${this.componentOptions.componentId}" script failed:`, error)
        if (isDevRuntime()) {
          const fatalError = new Error(`Coralite Component Error: Component "${this.componentOptions.componentId}" (${this._instanceId}) client() block failed: ${error.message}`)
          fatalError.stack = error.stack

          if (typeof window['showCoraliteError'] === 'function') {
            window['showCoraliteError'](fatalError)
          } else {
            const overlay = document.createElement('div')
            overlay.style.position = 'fixed'
            overlay.style.top = '0'
            overlay.style.left = '0'
            overlay.style.width = '100%'
            overlay.style.height = '100%'
            overlay.style.backgroundColor = 'rgba(127, 29, 29, 0.98)'
            overlay.style.color = '#ffffff'
            overlay.style.padding = '20px'
            overlay.style.zIndex = '10000'
            overlay.style.fontFamily = 'monospace'
            overlay.style.whiteSpace = 'pre-wrap'
            overlay.style.overflow = 'auto'

            const heading = document.createElement('h1')
            heading.textContent = 'Coralite Component Error'
            const desc = document.createElement('p')
            desc.textContent = fatalError.message

            overlay.appendChild(heading)
            overlay.appendChild(desc)

            if (fatalError.stack) {
              const stackTrace = document.createElement('pre')

              stackTrace.textContent = fatalError.stack
              overlay.appendChild(stackTrace)
            }

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
  const isFormAssociated = Boolean(options.formAssociated)

  return class extends CoraliteElement {
    static formAssociated = isFormAssociated
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
        if (isDevRuntime() && event instanceof CustomEvent) {
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

      if (options.provide) {
        this._setupContextProvider(options.provide)
      }
    }
  }
}
