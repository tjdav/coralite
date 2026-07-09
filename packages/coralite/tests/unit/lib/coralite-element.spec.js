import '../setup.js'
import { describe, it, beforeEach } from 'node:test'
import { strict as assert } from 'node:assert'
import { createCoraliteClass } from '../../../lib/coralite-element.js'

describe('CoraliteElement', () => {
  let MyElement
  let tagName

  beforeEach(() => {
    tagName = 'my-comp-' + Math.random().toString(36).substring(2, 9)
    const options = {
      componentId: 'my-comp',
      templateHTML: '<div><span id="text">{{ message }}</span><input id="input" value="{{ message }}"></div>',
      defaultValues: { message: 'hello' },
      attributes: {
        count: { type: Number }
      },
      hydrationMap: {
        texts: [
          {
            path: [0, 0],
            template: '{{ message }}'
          }
        ],
        attributes: [
          {
            path: [0, 1],
            name: 'value',
            template: '{{ message }}'
          }
        ]
      }
    }

    MyElement = createCoraliteClass(options)
    customElements.define(tagName, MyElement)
  })

  it('should initialize with default values', () => {
    const el = document.createElement(tagName)
    document.body.appendChild(el)

    assert.strictEqual(el.querySelector('#text').textContent, 'hello')
    assert.strictEqual(el.querySelector('#input').value, 'hello')

    document.body.removeChild(el)
  })

  it('should react to state changes', (t, done) => {
    const el = document.createElement(tagName)
    document.body.appendChild(el)

    // @ts-ignore
    el._state.message = 'world'

    queueMicrotask(() => {
      assert.strictEqual(el.querySelector('#text').textContent, 'world')
      assert.strictEqual(el.querySelector('#input').value, 'world')
      document.body.removeChild(el)
      done()
    })
  })

  it('should handle attribute changes', (t, done) => {
    const el = document.createElement(tagName)
    el.setAttribute('count', '123')
    document.body.appendChild(el)

    // @ts-ignore
    assert.strictEqual(el._state.count, 123)

    el.setAttribute('count', '456')

    queueMicrotask(() => {
      // @ts-ignore
      assert.strictEqual(el._state.count, 456)
      document.body.removeChild(el)
      done()
    })
  })

  it('should handle imperative creation with innerHTML', () => {
    const el = document.createElement(tagName)
    el.innerHTML = '<span slot="default">projected</span>'
    document.body.appendChild(el)

    // Since it's imperative, connectedCallback stamps templateHTML if available
    // and projects Light DOM.
    // templateHTML in beforeEach has a <div> but no <slot>.
    // Let's redefine MyElement with a slot for this test.
    const slotTagName = 'comp-slot-' + Math.random().toString(36).substring(2, 9)
    const optionsWithSlot = {
      componentId: 'comp-slot',
      templateHTML: '<div><slot></slot></div>'
    }
    const SlotElement = createCoraliteClass(optionsWithSlot)
    customElements.define(slotTagName, SlotElement)

    const el2 = document.createElement(slotTagName)
    el2.innerHTML = '<span>projected</span>'
    document.body.appendChild(el2)

    assert.ok(el2.innerHTML.includes('projected'))
    document.body.removeChild(el2)
    document.body.removeChild(el)
  })

  it('should call disconnected hooks', () => {
    let called = false
    const hookTagName = 'hook-comp-' + Math.random().toString(36).substring(2, 9)
    const HookElement = createCoraliteClass({ componentId: 'hook-comp' }, null, {
      onDisconnected: [() => {
        called = true
      }]
    })
    customElements.define(hookTagName, HookElement)

    const el = document.createElement(hookTagName)
    document.body.appendChild(el)
    document.body.removeChild(el)

    assert.strictEqual(called, true)
  })

  it('should support shorthand and longhand attribute types and default values', () => {
    const attrTagName = 'attr-comp-' + Math.random().toString(36).substring(2, 9)
    const AttrElement = createCoraliteClass({
      componentId: 'attr-comp',
      defaultValues: {
        active: true,
        maxItems: 10,
        theme: 'dark'
      },
      attributes: {
        // Boolean
        visible: Boolean,
        active: {
          type: Boolean,
          default: true
        },

        // Number
        count: Number,
        maxItems: {
          type: Number,
          default: 10
        },

        // String
        titleText: String,
        theme: {
          type: String,
          default: 'dark'
        }
      }
    })
    customElements.define(attrTagName, AttrElement)

    const el = document.createElement(attrTagName)
    document.body.appendChild(el)

    // Check initial values / defaults
    // @ts-ignore
    assert.strictEqual(el._state.visible, undefined)
    // @ts-ignore
    assert.strictEqual(el._state.active, true)
    // @ts-ignore
    assert.strictEqual(el._state.count, undefined)
    // @ts-ignore
    assert.strictEqual(el._state.maxItems, 10)
    // @ts-ignore
    assert.strictEqual(el._state.titleText, undefined)
    // @ts-ignore
    assert.strictEqual(el._state.theme, 'dark')

    // Set attributes on the DOM
    el.setAttribute('visible', '')
    el.setAttribute('active', 'false')
    el.setAttribute('count', '42')
    el.setAttribute('max-items', '20')
    el.setAttribute('title-text', 'hello')
    el.setAttribute('theme', 'light')

    // Check coerced values after DOM attributes updates
    // @ts-ignore
    assert.strictEqual(el._state.visible, true)
    // @ts-ignore
    assert.strictEqual(el._state.active, false)
    // @ts-ignore
    assert.strictEqual(el._state.count, 42)
    // @ts-ignore
    assert.strictEqual(el._state.maxItems, 20)
    // @ts-ignore
    assert.strictEqual(el._state.titleText, 'hello')
    // @ts-ignore
    assert.strictEqual(el._state.theme, 'light')

    document.body.removeChild(el)
  })

  it('should toggle native boolean attributes by adding/removing them, and keep non-native attributes as strings', (t, done) => {
    const toggleTagName = 'toggle-comp-' + Math.random().toString(36).substring(2, 9)
    const ToggleElement = createCoraliteClass({
      componentId: 'toggle-comp',
      templateHTML: '<div><button id="btn" disabled="{{ isDisabled }}">Btn</button><span id="span" active="{{ isActive }}">Span</span></div>',
      defaultValues: {
        isDisabled: false,
        isActive: false
      },
      hydrationMap: {
        attributes: [
          {
            path: [0, 0],
            name: 'disabled',
            template: '{{ isDisabled }}'
          },
          {
            path: [0, 1],
            name: 'active',
            template: '{{ isActive }}'
          }
        ]
      }
    })
    customElements.define(toggleTagName, ToggleElement)

    const el = document.createElement(toggleTagName)
    document.body.appendChild(el)

    const btn = el.querySelector('#btn')
    const span = el.querySelector('#span')

    // Initially falsy, so native 'disabled' should be removed, while non-native 'active' is set to falsy string
    assert.strictEqual(btn.hasAttribute('disabled'), false)
    assert.strictEqual(span.getAttribute('active'), 'false')

    // Change to truthy
    // @ts-ignore
    el._state.isDisabled = true
    // @ts-ignore
    el._state.isActive = true

    queueMicrotask(() => {
      // Button disabled should be set to empty string, span active to true
      assert.strictEqual(btn.getAttribute('disabled'), '')
      assert.strictEqual(span.getAttribute('active'), 'true')

      // Change back to falsy
      // @ts-ignore
      el._state.isDisabled = false
      // @ts-ignore
      el._state.isActive = false

      queueMicrotask(() => {
        // Button disabled should be completely removed, span active should be set to string 'false'
        assert.strictEqual(btn.hasAttribute('disabled'), false)
        assert.strictEqual(span.getAttribute('active'), 'false')

        document.body.removeChild(el)
        done()
      })
    })
  })

  it('should pass context containing root (the custom element itself) to the client function', (t, done) => {
    let clientContext = null
    const clientTagName = 'client-comp-' + Math.random().toString(36).substring(2, 9)
    const ClientElement = createCoraliteClass({
      componentId: 'client-comp',
      client: (ctx) => {
        clientContext = ctx
      }
    })
    customElements.define(clientTagName, ClientElement)

    const el = document.createElement(clientTagName)
    document.body.appendChild(el)

    queueMicrotask(() => {
      assert.ok(clientContext, 'client function should have been called with context')
      assert.strictEqual(clientContext.root, el, 'context.root should be the custom element instance itself')
      assert.strictEqual(clientContext.instanceId, el._instanceId, 'context.instanceId should match element _instanceId')
      document.body.removeChild(el)
      done()
    })
  })

  it('should inject observe function into client context and invoke callback on property changes', (t, done) => {
    let calledWith = []
    const observeTagName = 'observe-comp-' + Math.random().toString(36).substring(2, 9)
    const ObserveElement = createCoraliteClass({
      componentId: 'observe-comp',
      defaultValues: {
        score: 10
      },
      client: ({ observe }) => {
        observe('score', (newVal, oldVal) => {
          calledWith.push({
            newVal,
            oldVal
          })
        })
      }
    })
    customElements.define(observeTagName, ObserveElement)

    const el = document.createElement(observeTagName)
    document.body.appendChild(el)

    queueMicrotask(() => {
      // Mutate state
      // @ts-ignore
      el._state.score = 25

      queueMicrotask(() => {
        assert.deepEqual(calledWith, [{
          newVal: 25,
          oldVal: 10
        }])
        document.body.removeChild(el)
        done()
      })
    })
  })

  it('should not invoke callback if mutated property value is identical', (t, done) => {
    let callCount = 0
    const identicalTagName = 'identical-comp-' + Math.random().toString(36).substring(2, 9)
    const IdenticalElement = createCoraliteClass({
      componentId: 'identical-comp',
      defaultValues: {
        score: 10
      },
      client: ({ observe }) => {
        observe('score', () => {
          callCount++
        })
      }
    })
    customElements.define(identicalTagName, IdenticalElement)

    const el = document.createElement(identicalTagName)
    document.body.appendChild(el)

    queueMicrotask(() => {
      // Mutate with same value
      // @ts-ignore
      el._state.score = 10

      queueMicrotask(() => {
        assert.strictEqual(callCount, 0)
        document.body.removeChild(el)
        done()
      })
    })
  })

  it('should clean up observers strictly upon abort event (Zero Memory Leaks)', (t, done) => {
    let callCount = 0
    const cleanupTagName = 'cleanup-comp-' + Math.random().toString(36).substring(2, 9)
    const CleanupElement = createCoraliteClass({
      componentId: 'cleanup-comp',
      defaultValues: {
        score: 10
      },
      client: ({ observe }) => {
        observe('score', () => {
          callCount++
        })
      }
    })
    customElements.define(cleanupTagName, CleanupElement)

    const el = document.createElement(cleanupTagName)
    document.body.appendChild(el)

    queueMicrotask(() => {
      // Remove element from DOM to trigger abort signal
      const stateRef = el._state
      document.body.removeChild(el)

      // Directly change state on the disconnected state object to see if observers are cleared/inactive
      stateRef.score = 50

      queueMicrotask(() => {
        assert.strictEqual(callCount, 0)
        assert.strictEqual(el._observers, null)
        done()
      })
    })
  })

  it('should output warning when state is mutated from within an observe callback (Infinite Loop Protection)', (t, done) => {
    let warningMsg = null
    const originalWarn = console.warn
    console.warn = (msg) => {
      warningMsg = msg
    }

    // Set window.__coralite__.mode to development
    window.__coralite__ = window.__coralite__ || {}
    const prevMode = window.__coralite__.mode
    window.__coralite__.mode = 'development'

    const loopTagName = 'loop-comp-' + Math.random().toString(36).substring(2, 9)
    const LoopElement = createCoraliteClass({
      componentId: 'loop-comp',
      defaultValues: {
        score: 10,
        other: 0
      },
      client: ({ state, observe }) => {
        observe('score', (newVal) => {
          state.other = newVal + 1
        })
      }
    })
    customElements.define(loopTagName, LoopElement)

    const el = document.createElement(loopTagName)
    document.body.appendChild(el)

    queueMicrotask(() => {
      // @ts-ignore
      el._state.score = 20

      queueMicrotask(() => {
        console.warn = originalWarn
        window.__coralite__.mode = prevMode

        assert.ok(warningMsg, 'Should have emitted a warning msg')
        assert.ok(warningMsg.includes('[Coralite Warning]: State mutation detected inside an observe() callback.'))
        document.body.removeChild(el)
        done()
      })
    })
  })

  it('should support the observe pattern via plugins (contextGetter)', (t, done) => {
    let calledWith = null
    const pluginTagName = 'plugin-observe-comp-' + Math.random().toString(36).substring(2, 9)

    // Simulate a plugin context getter (Two-Phase Resolver resolver result)
    const contextGetter = (localContext) => {
      // Confirm that the observe function is in localContext
      assert.strictEqual(typeof localContext.observe, 'function')

      // Use observe inside the plugin context
      localContext.observe('score', (newVal, oldVal) => {
        calledWith = {
          newVal,
          oldVal
        }
      })

      // Return modified localContext (adding plugin helper name)
      return {
        ...localContext,
        myPlugin: {
          test: true
        }
      }
    }

    const PluginObserveElement = createCoraliteClass({
      componentId: 'plugin-observe-comp',
      defaultValues: {
        score: 10
      },
      client: ({ myPlugin }) => {
        // Assert that client receives context injected by the plugin
        assert.ok(myPlugin)
        assert.strictEqual(myPlugin.test, true)
      }
    }, contextGetter)

    customElements.define(pluginTagName, PluginObserveElement)

    const el = document.createElement(pluginTagName)
    document.body.appendChild(el)

    queueMicrotask(() => {
      // Mutate state to trigger the plugin-defined observer
      // @ts-ignore
      el._state.score = 30

      queueMicrotask(() => {
        assert.deepEqual(calledWith, {
          newVal: 30,
          oldVal: 10
        })
        document.body.removeChild(el)
        done()
      })
    })
  })
})
