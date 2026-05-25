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
 *
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
 *
 */
export class CoraliteElement extends HTMLElement {
  /**
   *
   */
  constructor () {
    super()
    this._abortController = null
    this._instanceId = null
    this._state = null
    this._bindings = []
    this._isUpdatePending = false
    this._currentRenderVersion = null
    this._observer = null
    this._clientContextGetter = null
    this._hooks = {
      onBeforeComponentRender: [],
      onAfterComponentRender: []
    }
    this.componentOptions = null
  }

  /**
   *
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
   *
   */
  disconnectedCallback () {
    this._abortController.abort()
  }

  /**
   *
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
   *
   */
  _setupState () {
    const options = this.componentOptions
    const target = { ...options.defaultValues }

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
   *
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
   *
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
   *
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
   *
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
   *
   */
  _updateDOM () {
    // 1. Create a unique lock for this specific render cycle
    /** @type {symbol} */
    const renderVersion = Symbol()
    this._currentRenderVersion = renderVersion

    // 2. Extract unique tokens to prevent double-reading and accidental aborts
    const requiredTokens = new Set()
    for (const binding of this._bindings) {
      binding.template.replace(/\{\{\s*(.+?)\s*\}\}/g, (_, key) => {
        requiredTokens.add(key)
        return ''
      })
    }

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
   *
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
   *
   */
  async _init (isImperative = false) {
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
 *
 */
export function createCoraliteClass (options, contextGetter = null, hooks = {}) {
  return class extends CoraliteElement {

    static get observedAttributes () {
      if (!options.attributes) {
        return []
      }
      return Object.keys(options.attributes).map(key => key.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
      )
    }

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
