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
    this._observer = null
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

    this._instanceId = this.getAttribute('cid') || `${this.componentOptions.componentId}-${Math.random().toString(36).substr(2, 9)}`

    this._setupState()
    this._setupBindings()
    this._init()
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
    if (!this._state || oldVal === newVal || name === 'cid') {
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
      if (attr.name === 'cid') {
        continue
      }
      const camelName = attr.name.replace(/-([a-z])/g, (g) => g[1].toUpperCase())
      const schema = options.attributes?.[camelName] || options.attributes?.[attr.name]
      target[camelName] = schema ? coerce(attr.value, schema.type) : attr.value
    }

    // Hydrate refs into target before proxying
    if (options.hydrationMap && options.hydrationMap.refs) {
      for (const item of options.hydrationMap.refs) {
        const node = this._getNodeByPath(item.path)
        if (node) {
          target[item.name] = node
        }
      }
    }

    // Define reactive getters
    for (const [key, getter] of Object.entries(options.getters || {})) {
      Object.defineProperty(target, key, {
        get: () => getter(this._state),
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
  _getNodeByPath (path) {
    let node = this
    for (const index of path) {
      if (!node) {
        return null
      }
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
        const node = this._getNodeByPath(item.path)
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
        const node = this._getNodeByPath(item.path)
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
    for (const binding of this._bindings) {
      const hydratedValue = binding.template.replace(/\{\{\s*(.+?)\s*\}\}/g, (_, key) => {
        let val = this._state[key]
        if (typeof val === 'function') {
          val = val(this._state)
        }
        return val ?? ''
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
  }

  /**
   *
   */
  async _init () {
    const localContext = {
      instanceId: this._instanceId,
      state: this._state,
      root: this,
      refs: (id) => this._state[id] || this.querySelector(`[ref="${this._state['ref_' + id] || id}"]`),
      signal: this._abortController.signal
    }

    if (typeof this._clientContextGetter === 'function') {
      const pluginContext = await this._clientContextGetter(localContext)
      Object.assign(localContext, pluginContext)
    } else if (typeof window.__coralite_get_client_context === 'function') {
      const pluginContext = await window.__coralite_get_client_context(localContext)
      Object.assign(localContext, pluginContext)
    }

    if (this.componentOptions.script) {
      await this.componentOptions.script(localContext)
    }
    this._scheduleUpdate()
  }
}

/**
 *
 */
export function createCoraliteClass (options, contextGetter = null) {
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
    }
  }
}
