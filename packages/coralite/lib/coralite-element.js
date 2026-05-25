/**
 * @import { CoraliteModuleDefinitions, CoraliteScriptContext, CoraliteComponent } from '../types/index.js'
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
  if (type === Number || type === 'Number') {
    return Number(value)
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
 * Creates a read-only proxy that throws on mutation attempts.
 * @param {Object} target - The object to proxy.
 * @param {WeakMap} [proxies=new WeakMap()] - Cache for existing proxies.
 * @returns {Proxy} The read-only proxy.
 */
export function createReadOnlyProxy (target, proxies = new WeakMap()) {
  if (proxies.has(target)) {
    return proxies.get(target)
  }

  const handler = {
    get (target, property, receiver) {
      const value = Reflect.get(target, property, receiver)
      if (value !== null && typeof value === 'object' && !(typeof Node !== 'undefined' && value instanceof Node)) {
        return createReadOnlyProxy(value, proxies)
      }
      return value
    },
    set () {
      throw new Error('Coralite Error: Cannot mutate state inside a getter. State is read-only here.')
    },
    deleteProperty () {
      throw new Error('Coralite Error: Cannot delete state inside a getter. State is read-only here.')
    }
  }

  const proxy = new Proxy(target, handler)
  proxies.set(target, proxy)
  return proxy
}

/**
 * Base class for all Coralite custom elements.
 * Handles component hydration, reactive state management, and DOM synchronization.
 * It manages lifecycle hooks, attribute-to-state mapping, and efficient batch updates.
 * @augments HTMLElement
 */
export class CoraliteElement extends HTMLElement {
  /**
   * Initializes a new instance of the CoraliteElement.
   * Sets up internal state, binding collections, and hook registries.
   */
  constructor () {
    super()
    /** @type {AbortController|null} @protected */
    this._abortController = null
    /** @type {string|null} @protected */
    this._instanceId = null
    /** @type {any|null} @protected */
    this._state = null
    /** @type {Array<Object>} @protected */
    this._bindings = []
    /** @type {boolean} @protected */
    this._isUpdatePending = false
    /** @type {symbol|null} @protected */
    this._currentRenderVersion = null
    /** @type {MutationObserver|null} @protected */
    this._observer = null
    /** @type {Function|null} @protected */
    this._clientContextGetter = null
    /** @type {Object.<string, AbortController>|null} @protected */
    this._getterAbortControllers = null
    /**
     * Internal lifecycle hooks.
     * @type {Object}
     * @property {Array<function(any):void>} onBeforeComponentRender
     * @property {Array<function(any):void>} onAfterComponentRender
     * @protected
     */
    this._hooks = {
      onBeforeComponentRender: [],
      onAfterComponentRender: []
    }
    /**
     * Component definition and options.
     * @type {CoraliteComponent|any|null}
     */
    this.componentOptions = null
  }

  /**
   * Invoked when the element is added to the document.
   * Handles initialization, template injection for imperative components,
   * instance ID generation, and state/binding setup.
   */
  connectedCallback () {
    this._abortController = new AbortController()

    if (!this.componentOptions) {
      return
    }

    const isImperative = !this.hasAttribute('data-cid')

    if (isImperative && this.componentOptions.templateHTML) {
      const originalLightDOM = Array.from(this.childNodes)
      this.innerHTML = this.componentOptions.templateHTML

      if (originalLightDOM.length > 0) {
        const slots = this.querySelectorAll('slot')
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

    if (this.hasAttribute('data-cid')) {
      this._instanceId = this.getAttribute('data-cid')
    } else {
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

    if (isImperative) {
      this.setAttribute('data-cid', this._instanceId)
    }

    this._setupState()
    this._setupBindings()
    this._init(isImperative)
  }

  /**
   * Invoked when the element is removed from the document.
   * Aborts any pending async operations via the internal AbortController.
   */
  disconnectedCallback () {
    this._abortController.abort()
  }

  /**
   * Invoked when one of the element's observed attributes changes.
   * Synchronizes the attribute change to the internal reactive state.
   * @param {string} name - The name of the attribute that changed.
   * @param {string|null} oldVal - The previous value of the attribute.
   * @param {string|null} newVal - The new value of the attribute.
   */
  attributeChangedCallback (name, oldVal, newVal) {
    if (!this._state || oldVal === newVal || name === 'data-cid') {
      return
    }
    const camelName = name.replace(/-([a-z])/g, (g) => g[1].toUpperCase())
    const schema = this.componentOptions.attributes?.[camelName] || this.componentOptions.attributes?.[name]
    const value = schema ? coerce(newVal, schema.type) : newVal
    this._state[camelName] = value
  }

  /**
   * Sets up the component's state.
   * Merges default values, hydrated data, and initial attributes.
   * Triggers `onBeforeComponentRender` hooks and defines reactive getters.
   * @private
   */
  _setupState () {
    const options = this.componentOptions
    const target = { ...options.defaultValues }

    /** @type {Array<{name: string, element: Node}>} */
    const refs = []
    if (options.hydrationMap && options.hydrationMap.refs) {
      for (const item of options.hydrationMap.refs) {
        const node = this.getNodeByPath(item.path)
        if (node) {
          refs.push({
            name: item.name,
            element: node
          })
        }
      }
    }

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

    // Hydrate data() block results
    const hydrationTag = document.getElementById('__CORALITE_HYDRATION__')
    if (hydrationTag) {
      try {
        const allData = JSON.parse(hydrationTag.textContent)
        if (allData[this._instanceId]) {
          Object.assign(target, allData[this._instanceId])
        }
      } catch (e) {
      }
    }

    // Initial attributes
    for (const attr of this.attributes) {
      if (attr.name === 'data-cid') {
        continue
      }
      const camelName = attr.name.replace(/-([a-z])/g, (g) => g[1].toUpperCase())
      const schema = options.attributes?.[camelName] || options.attributes?.[attr.name]
      target[camelName] = schema ? coerce(attr.value, schema.type) : attr.value
    }

    // Define reactive getters
    this._getterAbortControllers = {}
    for (const [key, getter] of Object.entries(options.getters || {})) {
      Object.defineProperty(target, key, {
        get: () => {
          if (this._getterAbortControllers[key]) {
            this._getterAbortControllers[key].abort()
          }
          this._getterAbortControllers[key] = new AbortController()

          const roState = createReadOnlyProxy(this._state)
          return getter(roState, { signal: this._getterAbortControllers[key].signal })
        },
        enumerable: true,
        configurable: true
      })
    }

    this._state = this._createReactiveProxy(target)
  }

  /**
   * Creates a reactive Proxy for the given state target.
   * Intercepts property sets to schedule DOM updates when values change.
   * @param {Object} target - The target state object to wrap in a Proxy.
   * @returns {Proxy} The reactive state proxy.
   * @private
   */
  _createReactiveProxy (target) {
    const self = this
    return new Proxy(target, {
      set (t, p, v) {
        if (t[p] === v) {
          return true
        }
        t[p] = v
        self._scheduleUpdate()
        return true
      }
    })
  }

  /**
   * Traverses the DOM tree from the component root to find a node by its path index.
   * @param {number[]} path - Array of child indices representing the path to the target node.
   * @returns {Node|null} The found node, or null if the path is invalid.
   */
  getNodeByPath (path) {
    let node = this
    for (const index of path) {
      if (!node) {
        return null
      }
      // @ts-ignore
      node = node.childNodes[index]
    }
    return node
  }

  /**
   * Initializes DOM bindings based on the hydration map.
   * Identifies text nodes and attributes that need to be reactive.
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
            type: 'text',
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
   * Schedules a DOM update in the next microtask.
   * Batch multiple state changes into a single render cycle.
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
   * Performs the physical DOM update.
   * Evaluates tokens (including async getters), applies changes to text nodes and attributes,
   * processes slots, and triggers `onAfterComponentRender` hooks.
   * @private
   */
  _updateDOM () {
    // 1. Create a unique lock for this specific render cycle
    /** @type {symbol} */
    const renderVersion = Symbol()
    this._currentRenderVersion = renderVersion

    // 2. Extract unique tokens to prevent double-reading and accidental aborts
    /** @type {Set<string>} */
    const requiredTokens = new Set()
    for (const binding of this._bindings) {
      binding.template.replace(/\{\{\s*(.+?)\s*\}\}/g, (_, key) => {
        requiredTokens.add(key)
        return ''
      })
    }

    /** @type {Object.<string, any>} */
    const evaluatedTokens = {}
    let hasPromise = false

    // 3. Evaluate getters exactly once per render cycle
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

    // 4. The DOM Mutator Function
    const applyBindings = (tokenValues) => {
      // 🚨 RACE CONDITION LOCK: If the state mutated again while we were
      // waiting for the Promise, bail out and let the newer render handle it!
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
          if (binding.node.innerHTML !== hydratedValue) {
            if (binding.node.setHTMLUnsafe) {
              binding.node.setHTMLUnsafe(hydratedValue)
            } else {
              binding.node.innerHTML = hydratedValue
            }
          }
        } else if (binding.type === 'attribute') {
          if (BOOLEAN_ATTRIBUTES.has(binding.name)) {
            const isFalsy = hydratedValue === '' || hydratedValue === 'false' || hydratedValue === 'null' || hydratedValue === '0' || hydratedValue === 'undefined'
            if (isFalsy) {
              binding.node.removeAttribute(binding.name)
            } else {
              binding.node.setAttribute(binding.name, '')
            }
          } else {
            if (binding.node.getAttribute(binding.name) !== hydratedValue) {
              binding.node.setAttribute(binding.name, hydratedValue)
            }
          }
        }
      }

      this._processSlots()

      // Trigger After Hooks ONLY after the physical DOM is finally flushed
      for (const hook of this._hooks.onAfterComponentRender) {
        hook({
          state: this._state,
          instanceId: this._instanceId,
          componentId: this.componentOptions.componentId,
          element: this,
          options: this.componentOptions
        })
      }
    }

    // 5. Await Promises or Apply Synchronously
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
   * Processes and renders component slots.
   * Invokes slot transformation functions defined in component options.
   * @private
   */
  _processSlots () {
    const slots = this.componentOptions.slots
    if (!slots || Object.keys(slots).length === 0) {
      return
    }

    const slotElements = this.querySelectorAll('slot')
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

        if (typeof result === 'string') {
          if (slotEl.setHTMLUnsafe) {
            slotEl.setHTMLUnsafe(result)
          } else {
            slotEl.innerHTML = result
          }
        } else if (Array.isArray(result)) {
          slotEl.replaceChildren(...result)
        }
      }
    })
  }

  /**
   * Final initialization step.
   * Sets up the client context, performs the initial render, and executes the component's script.
   * @param {boolean} [isImperative=false] - Whether the component was created imperatively.
   * @private
   */
  async _init (isImperative = false) {
    /** @type {any} */
    const localContext = {
      instanceId: this._instanceId,
      state: this._state,
      root: this,
      signal: this._abortController.signal
    }

    if (typeof this._clientContextGetter === 'function') {
      const pluginContext = await this._clientContextGetter(localContext)
      Object.assign(localContext, pluginContext)
    }

    if (isImperative) {
      this._updateDOM()
    } else {
      this._scheduleUpdate()
    }

    if (this.componentOptions.script) {
      try {
        this.componentOptions.script(localContext)
      } catch (error) {
        console.error(`Coralite Error: Component "${this.componentOptions.componentId}" script failed:`, error)
      }
    }
  }
}

/**
 * Factory function to create a Coralite element class.
 * It dynamically defines the class, including observed attributes and hook initialization.
 * @param {CoraliteComponent|any} options - Component options and metadata.
 * @param {Function|null} [contextGetter=null] - Optional function to retrieve client-side plugin context.
 * @param {Object} [hooks={}] - Lifecycle hooks to register.
 * @param {Array<function(any):void>} [hooks.onBeforeComponentRender] - Hooks to run before render.
 * @param {Array<function(any):void>} [hooks.onAfterComponentRender] - Hooks to run after render.
 * @returns {typeof CoraliteElement} A new CoraliteElement subclass.
 */
export function createCoraliteClass (options, contextGetter = null, hooks = {}) {
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
      this.componentOptions = options
      this._clientContextGetter = contextGetter
      this._hooks = {
        onBeforeComponentRender: hooks.onBeforeComponentRender || [],
        onAfterComponentRender: hooks.onAfterComponentRender || []
      }
    }
  }
}
