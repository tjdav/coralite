import '../setup.js'
import { describe, it, beforeEach } from 'node:test'
import { strict as assert } from 'node:assert'
import { createCoraliteClass } from '../../../lib/coralite-element.js'
import { assertSame } from '../helpers.js'

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
    assert.ok(el.hasAttribute('data-cid'), 'imperative element should stamp data-cid attribute')
    assert.strictEqual(el.getAttribute('data-cid'), el._instanceId)

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
      templateHTML: '<div><button id="btn" disabled="{{ isDisabled }}" allowpaymentrequest="{{ isPay }}">Btn</button><span id="span" active="{{ isActive }}">Span</span></div>',
      defaultValues: {
        isDisabled: false,
        isPay: false,
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
            path: [0, 0],
            name: 'allowpaymentrequest',
            template: '{{ isPay }}'
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

    // Initially falsy, so native 'disabled' and 'allowpaymentrequest' should be removed, while non-native 'active' is set to falsy string
    assert.strictEqual(btn.hasAttribute('disabled'), false)
    assert.strictEqual(btn.hasAttribute('allowpaymentrequest'), false)
    assert.strictEqual(span.getAttribute('active'), 'false')

    // Change to truthy
    // @ts-ignore
    el._state.isDisabled = true
    // @ts-ignore
    el._state.isPay = true
    // @ts-ignore
    el._state.isActive = true

    queueMicrotask(() => {
      // Button disabled and allowpaymentrequest should be set to empty string, span active to true
      assert.strictEqual(btn.getAttribute('disabled'), '')
      assert.strictEqual(btn.getAttribute('allowpaymentrequest'), '')
      assert.strictEqual(span.getAttribute('active'), 'true')

      // Change back to falsy
      // @ts-ignore
      el._state.isDisabled = false
      // @ts-ignore
      el._state.isPay = false
      // @ts-ignore
      el._state.isActive = false

      queueMicrotask(() => {
        // Button disabled and allowpaymentrequest should be completely removed, span active should be set to string 'false'
        assert.strictEqual(btn.hasAttribute('disabled'), false)
        assert.strictEqual(btn.hasAttribute('allowpaymentrequest'), false)
        assert.strictEqual(span.getAttribute('active'), 'false')

        document.body.removeChild(el)
        done()
      })
    })
  })

  it('should preserve live node identity and event listeners when computed slot transformer wraps nodes', (t, done) => {
      const wrapperTag = 'wrapper-comp-' + Math.random().toString(36).substring(2, 9)
      const WrapperComp = createCoraliteClass({
        componentId: 'wrapper-comp',
        templateHTML: '<div><slot name="actions"></slot></div>',
        slots: {
          actions (nodes) {
            const wrapper = document.createElement('div')
            wrapper.className = 'actions-wrapper'
            wrapper.replaceChildren(...nodes)
            return wrapper
          }
        }
      })
      customElements.define(wrapperTag, WrapperComp)

      const comp = document.createElement(wrapperTag)
      document.body.appendChild(comp)

      const btn = document.createElement('button')
      btn.setAttribute('slot', 'actions')
      btn.textContent = 'Save Action'
      let clicked = false
      btn.addEventListener('click', () => { clicked = true })

      comp.appendChild(btn)

      queueMicrotask(() => {
        const slot = comp.querySelector('slot[name="actions"]')
        assert.ok(slot)
        assert.strictEqual(slot._originalNodes.length, 1)
        assertSame(slot._originalNodes[0], btn)

        const wrapperEl = slot.querySelector('.actions-wrapper')
        assert.ok(wrapperEl)
        assertSame(wrapperEl.firstElementChild, btn)

        btn.click()
        assert.strictEqual(clicked, true)

        document.body.removeChild(comp)
        done()
      })
    })

  it('should auto-remove single-token aria-* attributes on falsy values, preserve 0 and "0", and handle truthy values', (t, done) => {
    const ariaTagName = 'aria-comp-' + Math.random().toString(36).substring(2, 9)
    const AriaElement = createCoraliteClass({
      componentId: 'aria-comp',
      templateHTML: '<div><button id="btn" aria-hidden="{{ isHidden }}" aria-label="{{ label }}" aria-valuenow="{{ valNow }}" aria-describedby="desc-{{ id }}">Btn</button></div>',
      defaultValues: {
        isHidden: false,
        label: 'Submit form',
        valNow: 0,
        id: '123'
      },
      hydrationMap: {
        attributes: [
          {
            path: [0, 0],
            name: 'aria-hidden',
            template: '{{ isHidden }}'
          },
          {
            path: [0, 0],
            name: 'aria-label',
            template: '{{ label }}'
          },
          {
            path: [0, 0],
            name: 'aria-valuenow',
            template: '{{ valNow }}'
          },
          {
            path: [0, 0],
            name: 'aria-describedby',
            template: 'desc-{{ id }}'
          }
        ]
      }
    })
    customElements.define(ariaTagName, AriaElement)

    const el = document.createElement(ariaTagName)
    document.body.appendChild(el)

    const btn = el.querySelector('#btn')

    // Initially:
    // isHidden = false -> aria-hidden should be completely removed
    assert.strictEqual(btn.hasAttribute('aria-hidden'), false)

    // label = 'Submit form' -> aria-label="Submit form"
    assert.strictEqual(btn.getAttribute('aria-label'), 'Submit form')

    // valNow = 0 -> aria-valuenow="0" (0 preserved for ARIA!)
    assert.strictEqual(btn.getAttribute('aria-valuenow'), '0')

    // Composite aria-describedby = "desc-123"
    assert.strictEqual(btn.getAttribute('aria-describedby'), 'desc-123')

    // Mutate state: set isHidden = true, label = null, valNow = "0"
    // @ts-ignore
    el._state.isHidden = true
    // @ts-ignore
    el._state.label = null
    // @ts-ignore
    el._state.valNow = '0'

    queueMicrotask(() => {
      // isHidden = true -> aria-hidden="true"
      assert.strictEqual(btn.getAttribute('aria-hidden'), 'true')

      // label = null -> aria-label removed
      assert.strictEqual(btn.hasAttribute('aria-label'), false)

      // valNow = "0" -> aria-valuenow="0" preserved
      assert.strictEqual(btn.getAttribute('aria-valuenow'), '0')

      // Mutate isHidden to "false", "null", "undefined", ""
      // @ts-ignore
      el._state.isHidden = 'false'

      queueMicrotask(() => {
        // "false" string -> falsy for aria auto-removal, so removed
        assert.strictEqual(btn.hasAttribute('aria-hidden'), false)

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

  it('should inject observe into client context and invoke callbacks for declared and dynamic property changes', (t, done) => {
    let declaredCalledWith = null
    let observedDynamic = null
    const observeTagName = 'observe-comp-' + Math.random().toString(36).substring(2, 9)
    const ObserveElement = createCoraliteClass({
      componentId: 'observe-comp',
      defaultValues: {
        score: 10
      },
      client: ({ state, observe }) => {
        observe('score', (newVal, oldVal) => {
          declaredCalledWith = { newVal, oldVal }
        })
        observe('dynamicProp', (newVal) => {
          observedDynamic = newVal
        })
        queueMicrotask(() => {
          state.dynamicProp = 'active'
        })
      }
    })
    customElements.define(observeTagName, ObserveElement)

    const el = document.createElement(observeTagName)
    document.body.appendChild(el)

    queueMicrotask(() => {
      queueMicrotask(() => {
        // Undeclared (dynamic) property is observed and delivered
        assert.strictEqual(observedDynamic, 'active')

        // Declared property mutation delivers newVal/oldVal to the callback
        // @ts-ignore
        el._state.score = 25

        queueMicrotask(() => {
          assert.deepEqual(declaredCalledWith, {
            newVal: 25,
            oldVal: 10
          })
          document.body.removeChild(el)
          done()
        })
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

  it('should output warning and throw in dev mode when state is mutated cyclically from within an observe callback (Infinite Loop Protection)', (t, done) => {
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
          state.score = newVal + 1
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
        assert.ok(warningMsg.includes('Cyclic state mutation detected inside an observe() callback.'))
        assert.strictEqual(el._state.score, 20)
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

  it('correctly updates slotted child component attributes on the client side when parent state changes (declarative/hydrated)', (t, done) => {
    const parentTagName = 'parent-comp-' + Math.random().toString(36).substring(2, 9)
    const childTagName = 'child-comp-' + Math.random().toString(36).substring(2, 9)
    const tokenTagName = 'child-token-' + Math.random().toString(36).substring(2, 9)

    const ParentElement = createCoraliteClass({
      componentId: 'parent-comp',
      templateHTML: '<div><slot></slot></div>'
    })

    const ChildElement = createCoraliteClass({
      componentId: 'child-comp',
      templateHTML: '<div>Child</div>',
      attributes: {
        name: { type: String }
      }
    })

    const TokenElement = createCoraliteClass({
      componentId: 'child-token',
      templateHTML: `<${parentTagName}><${childTagName} name="{{ computedGetter }}"></${childTagName}></${parentTagName}>`,
      defaultValues: {
        isTrue: true
      },
      getters: {
        computedGetter: ({ state }) => state.isTrue ? 'value' : 'another value'
      },
      hydrationMap: {
        attributes: [
          {
            path: [0, 0], // path to child-comp inside parent-comp in the pristine template
            name: 'name',
            template: '{{ computedGetter }}'
          }
        ]
      }
    }, null, {}, {
      'child-token-0': { isTrue: true },
      'child-comp-0': { name: 'value' }
    })

    // Set the SSR-rendered HTML first before defining elements, matching real-world deferred hydration
    document.body.innerHTML = `<${tokenTagName} data-cid="child-token-0" data-coralite-initial><${parentTagName} data-cid="parent-comp-0" data-coralite-initial><div><slot><${childTagName} name="value" data-cid="child-comp-0" data-coralite-initial><div>Child</div></${childTagName}></slot></div></${parentTagName}></${tokenTagName}>`

    // Upgrade/define custom elements now
    customElements.define(parentTagName, ParentElement)
    customElements.define(childTagName, ChildElement)
    customElements.define(tokenTagName, TokenElement)

    const el = document.body.firstElementChild

    // Wait for the components to upgrade and perform initial render
    queueMicrotask(() => {
      const child = el.querySelector(childTagName)
      assert.ok(child, 'Slotted child component should exist')
      assert.strictEqual(child.getAttribute('name'), 'value')

      // Now mutate the state of child-token
      // @ts-ignore
      el._state.isTrue = false

      // Wait for dynamic update
      queueMicrotask(() => {
        assert.strictEqual(child.getAttribute('name'), 'another value')
        document.body.removeChild(el)
        done()
      })
    })
  })

  it('should re-evaluate computed slots on state and attribute mutations even without string interpolation bindings', (t, done) => {
    const slotCompName = 'slot-reactive-' + Math.random().toString(36).substring(2, 9)

    const SlotReactiveElement = createCoraliteClass({
      componentId: 'slot-reactive',
      templateHTML: '<div><slot name="badge"></slot><slot name="icon"></slot></div>',
      attributes: {
        badge: String,
        iconName: String
      },
      slots: {
        badge (originalNodes, state) {
          if (!state.badge) {
            return null
          }
          if (originalNodes && originalNodes.length > 0) {
            return originalNodes
          }
          return `<span class="badge">${state.badge}</span>`
        },
        icon (originalNodes, state) {
          if (!state.iconName) {
            return null
          }
          if (originalNodes && originalNodes.length > 0) {
            return originalNodes
          }
          return `<i class="icon">${state.iconName}</i>`
        }
      }
    })

    customElements.define(slotCompName, SlotReactiveElement)

    const el = document.createElement(slotCompName)
    document.body.appendChild(el)

    const badgeSlot = el.querySelector('slot[name="badge"]')
    const iconSlot = el.querySelector('slot[name="icon"]')

    // Initially state.badge and state.iconName are undefined/empty -> slots should be cleared
    assert.strictEqual(badgeSlot.innerHTML, '')
    assert.strictEqual(iconSlot.innerHTML, '')

    // Mutate attribute 'badge'
    el.setAttribute('badge', '5')

    queueMicrotask(() => {
      assert.strictEqual(badgeSlot.innerHTML, '<span class="badge">5</span>')

      // Mutate state 'iconName'
      // @ts-ignore
      el._state.iconName = 'star'

      queueMicrotask(() => {
        assert.strictEqual(iconSlot.innerHTML, '<i class="icon">star</i>')

        // Remove attribute badge
        el.removeAttribute('badge')
        // @ts-ignore
        el._state.badge = null

        queueMicrotask(() => {
          assert.strictEqual(badgeSlot.innerHTML, '')
          document.body.removeChild(el)
          done()
        })
      })
    })
  })

  it('should isolate component slots so nested child custom elements do not intercept parent slots', (t, done) => {
    const parentTag = 'test-slot-parent'
    const childTag = 'test-slot-child'

    const ChildElement = createCoraliteClass({
      componentId: childTag,
      slots: {
        default (nodes) {
          return '<span class="child-slot">Child Slot Content</span>'
        }
      }
    })

    const ParentElement = createCoraliteClass({
      componentId: parentTag,
      slots: {
        default (nodes) {
          return '<div class="parent-slot">Parent Slot Content</div>'
        }
      }
    })

    customElements.define(childTag, ChildElement)
    customElements.define(parentTag, ParentElement)

    const parentEl = document.createElement(parentTag)
    parentEl.innerHTML = `
      <slot name="default"></slot>
      <${childTag}>
        <slot name="default"></slot>
      </${childTag}>
    `

    document.body.appendChild(parentEl)

    queueMicrotask(() => {
      const parentOwnSlot = parentEl.querySelector(':scope > slot[name="default"]')
      const childEl = parentEl.querySelector(childTag)
      const childSlot = childEl.querySelector('slot[name="default"]')

      assert.strictEqual(parentOwnSlot.innerHTML, '<div class="parent-slot">Parent Slot Content</div>')
      assert.strictEqual(childSlot.innerHTML, '<span class="child-slot">Child Slot Content</span>')

      document.body.removeChild(parentEl)
      done()
    })
  })

  it('should support declarative (hydrated) nested slots via pre-tagged data-coralite-owner', (t, done) => {
    const listItemTagName = 'hydrated-item-' + Math.random().toString(36).substring(2, 9)
    const listTagName = 'hydrated-list-' + Math.random().toString(36).substring(2, 9)

    const MyListItem = createCoraliteClass({
      componentId: 'hydrated-item',
      templateHTML: `
        <div class="row">
          <div class="left"><slot name="left"></slot></div>
          <div class="content"><slot></slot></div>
        </div>
      `
    })
    customElements.define(listItemTagName, MyListItem)

    const MyList = createCoraliteClass({
      componentId: 'hydrated-list',
      templateHTML: `
        <${listItemTagName}>
          <slot name="avatar" slot="left"></slot>
        </${listItemTagName}>
      `
    })
    customElements.define(listTagName, MyList)

    // Inject SSR-like pre-rendered HTML with explicit owner tags
    const container = document.createElement('div')
    container.innerHTML = `
      <${listTagName} data-cid="list-1">
        <${listItemTagName} data-cid="item-1">
          <div class="row">
            <div class="left">
              <slot name="left" data-coralite-owner="item-1">
                <slot name="avatar" slot="left" data-coralite-owner="list-1">
                  <span slot="avatar" class="avatar-el">Hydrated Avatar</span>
                </slot>
              </slot>
            </div>
          </div>
        </${listItemTagName}>
      </${listTagName}>
    `
    document.body.appendChild(container)

    queueMicrotask(() => {
      const listEl = container.firstElementChild
      const listItemEl = listEl.querySelector(listItemTagName)

      // Get own slots of listEl (owner = "list-1")
      // @ts-ignore
      const listSlots = listEl._getOwnSlots()
      assert.strictEqual(listSlots.length, 1, 'listEl should own exactly 1 slot')
      assert.strictEqual(listSlots[0].getAttribute('name'), 'avatar')

      // Get own slots of listItemEl (owner = "item-1")
      // @ts-ignore
      const itemSlots = listItemEl._getOwnSlots()
      assert.strictEqual(itemSlots.length, 1, 'listItemEl should own exactly 1 slot')
      assert.strictEqual(itemSlots[0].getAttribute('name'), 'left')

      document.body.removeChild(container)
      done()
    })
  })

  it('should auto-seed dynamic instance counter from precalculated window.__coralite_instanceCounters', () => {
    const seedTagName = 'seed-comp-' + Math.random().toString(36).substring(2, 9)
    const SeedElement = createCoraliteClass({
      componentId: 'seed-comp'
    })
    customElements.define(seedTagName, SeedElement)

    window.__coralite_instanceCounters = window.__coralite_instanceCounters || {}
    window.__coralite_instanceCounters['seed-comp'] = 5

    const el = document.createElement(seedTagName)
    document.body.appendChild(el)

    assert.strictEqual(el._instanceId, 'seed-comp-5')
    assert.strictEqual(window.__coralite_instanceCounters['seed-comp'], 6)

    document.body.removeChild(el)
  })

  it('should strictly scope ref lookups to component subtree, preventing parent/child crosstalk', (t, done) => {
    const innerTagName = 'inner-ref-comp-' + Math.random().toString(36).substring(2, 9)
    const outerTagName = 'outer-ref-comp-' + Math.random().toString(36).substring(2, 9)

    const InnerElement = createCoraliteClass({
      componentId: 'inner-ref-comp',
      templateHTML: '<div><button ref="btnElement">Inner Button</button></div>',
      hydrationMap: {
        refs: [{ name: 'btnElement', path: [0, 0] }]
      }
    })

    const OuterElement = createCoraliteClass({
      componentId: 'outer-ref-comp',
      templateHTML: `<div><button ref="btnElement">Outer Button</button><${innerTagName}></${innerTagName}></div>`,
      hydrationMap: {
        refs: [{ name: 'btnElement', path: [0, 0] }]
      }
    })

    customElements.define(innerTagName, InnerElement)
    customElements.define(outerTagName, OuterElement)

    const el = document.createElement(outerTagName)
    document.body.appendChild(el)

    queueMicrotask(() => {
      const innerEl = el.querySelector(innerTagName)
      
      // Verify both resolved their own refs correctly even though they share the same ref name
      assert.ok(el[Symbol.for('coralite.testing')].refs.btnElement)
      assert.strictEqual(el[Symbol.for('coralite.testing')].refs.btnElement.textContent, 'Outer Button')

      assert.ok(innerEl[Symbol.for('coralite.testing')].refs.btnElement)
      assert.strictEqual(innerEl[Symbol.for('coralite.testing')].refs.btnElement.textContent, 'Inner Button')

      // Each resolved ref is owner-tagged to its own component instance (no crosstalk)
      assert.strictEqual(el[Symbol.for('coralite.testing')].refs.btnElement.getAttribute('data-coralite-owner'), el._instanceId)
      assert.strictEqual(innerEl[Symbol.for('coralite.testing')].refs.btnElement.getAttribute('data-coralite-owner'), innerEl._instanceId)

      document.body.removeChild(el)
      done()
    })
  })

  it('should maintain reactivity on template token interpolations within nested custom element slot projections', (t, done) => {
    const parentTagName = 'parent-interp-comp-' + Math.random().toString(36).substring(2, 9)
    const childTagName = 'child-interp-comp-' + Math.random().toString(36).substring(2, 9)

    const ChildInterpElement = createCoraliteClass({
      componentId: 'child-interp-comp',
      templateHTML: '<div><slot></slot></div>',
      slots: {
        default (nodes) {
          // Return live projected nodes to preserve owner component binding references
          return nodes
        }
      }
    })

    const ParentInterpElement = createCoraliteClass({
      componentId: 'parent-interp-comp',
      templateHTML: `<div><${childTagName}><c-token>{{ text }}</c-token></${childTagName}></div>`,
      defaultValues: { text: 'Edit' },
      hydrationMap: {
        texts: [
          {
            // div -> child-interp-comp -> c-token (text node)
            path: [0, 0, 0],
            template: '{{ text }}',
            type: 'html'
          }
        ]
      }
    }, null, {}, {
      'parent-interp-comp-0': { text: 'Edit' }
    })

    // Set pre-rendered HTML matching real-world deferred hydration (strictly whitespace-free between tags to match path indices)
    document.body.innerHTML = `<${parentTagName} data-cid="parent-interp-comp-0" data-coralite-initial><div><${childTagName} data-cid="child-interp-comp-0" data-coralite-initial><div><slot data-coralite-owner="child-interp-comp-0"><c-token data-coralite-slot-index="0">Edit</c-token></slot></div></${childTagName}></div></${parentTagName}>`

    // Define custom elements to trigger upgrade and connectedCallback
    customElements.define(childTagName, ChildInterpElement)
    customElements.define(parentTagName, ParentInterpElement)

    const el = document.body.firstElementChild

    queueMicrotask(() => {
      const child = el.querySelector(childTagName)
      assert.ok(child, 'Child should be rendered')
      assert.strictEqual(child.textContent.trim(), 'Edit')

      // Mutate parent state
      el._state.text = 'Save'

      queueMicrotask(() => {
        // Assert that the text successfully updated inside the slot despite cloning and slot transformation
        assert.strictEqual(child.textContent.trim(), 'Save')

        document.body.removeChild(el)
        done()
      })
    })
  })

  it('should resolve refs nested in foreign custom element boundaries via getNodeByPath fallback', (t, done) => {
    const parentTagName = 'foreign-fallback-parent-' + Math.random().toString(36).substring(2, 9)
    const foreignHostTag = 'foreign-fallback-host-' + Math.random().toString(36).substring(2, 9)
    class ForeignHost extends HTMLElement {}
    customElements.define(foreignHostTag, ForeignHost)

    const ParentElement = createCoraliteClass({
      componentId: 'foreign-fallback-parent',
      templateHTML: `<div><${foreignHostTag} data-cid="foreign-fallback-host-0"><button ref="foreignBtn">Click</button></${foreignHostTag}></div>`,
      hydrationMap: {
        refs: [{ name: 'foreignBtn', path: [0, 0, 0] }]
      }
    })

    customElements.define(parentTagName, ParentElement)
    document.body.innerHTML = `<${parentTagName}><div><${foreignHostTag} data-cid="foreign-fallback-host-0"><button ref="foreignBtn">Click</button></${foreignHostTag}></div></${parentTagName}>`

    const el = document.body.firstElementChild
    queueMicrotask(() => {
      const refs = el[Symbol.for('coralite.testing')]?.refs
      assert.ok(refs, 'Refs object should exist')
      assert.ok(refs.foreignBtn, 'Foreign boundary ref should be resolved via getNodeByPath')
      assert.strictEqual(refs.foreignBtn.textContent, 'Click')

      // Direct assertion of the traversal fallback
      assert.strictEqual(el.getNodeByPath([0, 0, 0]), refs.foreignBtn)

      document.body.removeChild(el)
      done()
    })
  })

  it('should preserve component encapsulation and prevent parent state updates from targeting child private template nodes', (t, done) => {
    const childTagName = 'encap-child-' + Math.random().toString(36).substring(2, 9)
    const parentTagName = 'encap-parent-' + Math.random().toString(36).substring(2, 9)

    const ChildComp = createCoraliteClass({
      componentId: 'encap-child',
      templateHTML: '<div class="private-child-node">Private Content</div>'
    })

    const ParentComp = createCoraliteClass({
      componentId: 'encap-parent',
      templateHTML: `<div><${childTagName}></${childTagName}></div>`,
      defaultValues: { parentText: 'Parent' },
      hydrationMap: {
        texts: [
          {
            path: [0, 0, 0],
            template: '{{ parentText }}',
            type: 'text'
          }
        ]
      }
    })

    customElements.define(childTagName, ChildComp)
    customElements.define(parentTagName, ParentComp)

    document.body.innerHTML = `<${parentTagName}><div><${childTagName} data-cid="encap-child-0" data-coralite-initial><div class="private-child-node">Private Content</div></${childTagName}></div></${parentTagName}>`

    const el = document.body.firstElementChild

    queueMicrotask(() => {
      // Mutate parent state
      el._state.parentText = 'Mutated'

      queueMicrotask(() => {
        const childPrivateNode = el.querySelector('.private-child-node')
        assert.strictEqual(childPrivateNode.textContent, 'Private Content', 'Child private node must remain uncorrupted by parent binding')

        document.body.removeChild(el)
        done()
      })
    })
  })

  describe('Native Reactive Slot Context & Builder Pattern', () => {
    it('should provide full slot context ({ state, root, refs, observe, signal, instanceId }) to slot functions', (t, done) => {
      let receivedContext = null
      const slotCtxTag = 'slot-ctx-' + Math.random().toString(36).substring(2, 9)

      const SlotCtxElement = createCoraliteClass({
        componentId: 'slot-ctx',
        templateHTML: '<div><slot name="content"><p>Initial</p></slot><button ref="btn">Btn</button></div>',
        defaultValues: {
          title: 'Hello Slot'
        },
        hydrationMap: {
          refs: [{ name: 'btn', path: [0, 1] }]
        },
        slots: {
          content (nodes, context) {
            receivedContext = context
            return `<div class="slot-title">${context.state.title}</div>`
          }
        }
      })
      customElements.define(slotCtxTag, SlotCtxElement)

      const el = document.createElement(slotCtxTag)
      document.body.appendChild(el)

      queueMicrotask(() => {
        assert.ok(receivedContext, 'Slot function should receive context')
        assert.strictEqual(receivedContext.state.title, 'Hello Slot')
        assert.strictEqual(receivedContext.root, el)
        assert.strictEqual(receivedContext.instanceId, el._instanceId)
        assert.strictEqual(typeof receivedContext.observe, 'function')
        assert.strictEqual(typeof receivedContext.refs, 'function')
        assert.strictEqual(receivedContext.refs('btn').textContent, 'Btn')
        assert.ok(receivedContext.signal instanceof AbortSignal)

        const titleDiv = el.querySelector('.slot-title')
        assert.ok(titleDiv)
        assert.strictEqual(titleDiv.textContent, 'Hello Slot')

        document.body.removeChild(el)
        done()
      })
    })

    it('should support legacy (nodes, state) slot signature via proxy fallback', (t, done) => {
      let readTitle = null
      const legacySlotTag = 'slot-legacy-' + Math.random().toString(36).substring(2, 9)

      const LegacySlotElement = createCoraliteClass({
        componentId: 'slot-legacy',
        templateHTML: '<div><slot></slot></div>',
        defaultValues: {
          title: 'Legacy Title'
        },
        slots: {
          default (nodes, state) {
            readTitle = state.title
            return `<span>${state.title}</span>`
          }
        }
      })
      customElements.define(legacySlotTag, LegacySlotElement)

      const el = document.createElement(legacySlotTag)
      document.body.appendChild(el)

      queueMicrotask(() => {
        assert.strictEqual(readTitle, 'Legacy Title')
        assert.strictEqual(el.querySelector('slot').innerHTML, '<span>Legacy Title</span>')
        document.body.removeChild(el)
        done()
      })
    })

    it('should execute reactive builder slot outer function body exactly once and drive updates via internal observers', (t, done) => {
      let outerFnCallCount = 0
      let observerCallCount = 0
      const reactiveBuilderTag = 'reactive-builder-' + Math.random().toString(36).substring(2, 9)

      const ReactiveBuilderElement = createCoraliteClass({
        componentId: 'reactive-builder',
        templateHTML: '<div><slot></slot></div>',
        defaultValues: {
          count: 0
        },
        slots: {
          default (nodes, { state, observe }) {
            outerFnCallCount++
            observe('count', (newVal) => {
              observerCallCount++
              return `<span class="count">${newVal}</span>`
            })
            return `<span class="count">${state.count}</span>`
          }
        }
      })
      customElements.define(reactiveBuilderTag, ReactiveBuilderElement)

      const el = document.createElement(reactiveBuilderTag)
      document.body.appendChild(el)

      queueMicrotask(() => {
        assert.strictEqual(outerFnCallCount, 1)
        assert.strictEqual(observerCallCount, 0)
        assert.strictEqual(el.querySelector('.count').textContent, '0')

        // Mutate state
        // @ts-ignore
        el._state.count = 1

        queueMicrotask(() => {
          assert.strictEqual(outerFnCallCount, 1, 'Outer slot function body should not run again for reactive builder')
          assert.strictEqual(observerCallCount, 1)
          assert.strictEqual(el.querySelector('.count').textContent, '1')

          // Mutate state again
          // @ts-ignore
          el._state.count = 2

          queueMicrotask(() => {
            assert.strictEqual(outerFnCallCount, 1)
            assert.strictEqual(observerCallCount, 2)
            assert.strictEqual(el.querySelector('.count').textContent, '2')

            document.body.removeChild(el)
            done()
          })
        })
      })
    })

    it('should project single DOM Node returned by slot function without dropping it (R-04)', (t, done) => {
      const singleNodeTag = 'single-node-slot-' + Math.random().toString(36).substring(2, 9)

      const SingleNodeElement = createCoraliteClass({
        componentId: 'single-node-slot',
        templateHTML: '<div><slot></slot></div>',
        slots: {
          default () {
            const btn = document.createElement('button')
            btn.className = 'single-btn'
            btn.textContent = 'Single Element'
            return btn
          }
        }
      })
      customElements.define(singleNodeTag, SingleNodeElement)

      const el = document.createElement(singleNodeTag)
      document.body.appendChild(el)

      queueMicrotask(() => {
        const btn = el.querySelector('.single-btn')
        assert.ok(btn, 'Single DOM Node should be projected into the slot')
        assert.strictEqual(btn.textContent, 'Single Element')

        document.body.removeChild(el)
        done()
      })
    })

    it('should disconnect slot observer when disposer returned by observe() is invoked', (t, done) => {
      let disposerFn = null
      let observeCount = 0
      const disposerTag = 'disposer-slot-' + Math.random().toString(36).substring(2, 9)

      const DisposerElement = createCoraliteClass({
        componentId: 'disposer-slot',
        templateHTML: '<div><slot></slot></div>',
        defaultValues: {
          num: 1
        },
        slots: {
          default (nodes, { observe }) {
            disposerFn = observe('num', (val) => {
              observeCount++
              return `<span>${val}</span>`
            })
            return '<span>0</span>'
          }
        }
      })
      customElements.define(disposerTag, DisposerElement)

      const el = document.createElement(disposerTag)
      document.body.appendChild(el)

      queueMicrotask(() => {
        assert.strictEqual(typeof disposerFn, 'function')

        // Mutate state to trigger observer
        // @ts-ignore
        el._state.num = 2

        queueMicrotask(() => {
          assert.strictEqual(observeCount, 1)

          // Call disposer
          disposerFn()

          // Mutate state again
          // @ts-ignore
          el._state.num = 3

          queueMicrotask(() => {
            assert.strictEqual(observeCount, 1, 'Observer should not run after disposer is called')

            document.body.removeChild(el)
            done()
          })
        })
      })
    })

    it('should handle async slot functions, discarding stale resolutions during rapid mutations and stripping data-coralite-slot-computed', async () => {
      // Case 1: rapid mutations must discard stale promise resolutions
      const asyncSlotTag = 'async-slot-' + Math.random().toString(36).substring(2, 9)

      const AsyncSlotElement = createCoraliteClass({
        componentId: 'async-slot',
        templateHTML: '<div><slot></slot></div>',
        defaultValues: {
          step: 1
        },
        slots: {
          default (nodes, { state }) {
            const delay = state.step === 1 ? 50 : 5
            const currentStep = state.step
            return new Promise(resolve => {
              setTimeout(() => {
                resolve(`<span class="step">Step ${currentStep}</span>`)
              }, delay)
            })
          }
        }
      })
      customElements.define(asyncSlotTag, AsyncSlotElement)

      const el = document.createElement(asyncSlotTag)
      document.body.appendChild(el)

      // Immediately trigger step 2 before step 1 promise finishes
      // @ts-ignore
      el._state.step = 2

      await new Promise(resolve => setTimeout(resolve, 100))

      const stepEl = el.querySelector('.step')
      assert.ok(stepEl)
      assert.strictEqual(stepEl.textContent, 'Step 2')

      document.body.removeChild(el)

      // Case 2: the SSR computed flag must be stripped once the async slot resolves
      const ssrSlotTag = 'async-ssr-slot-' + Math.random().toString(36).substring(2, 9)
      const AsyncSSRSlotElement = createCoraliteClass({
        componentId: 'async-ssr-slot',
        templateHTML: '<div><slot name="async" data-coralite-slot-computed="true"><span>Initial</span></slot></div>',
        slots: {
          async () {
            return new Promise(resolve => {
              setTimeout(() => {
                resolve('<span class="resolved">Async Content</span>')
              }, 10)
            })
          }
        }
      })
      customElements.define(ssrSlotTag, AsyncSSRSlotElement)

      const ssrEl = document.createElement(ssrSlotTag)
      document.body.appendChild(ssrEl)
      const ssrSlotEl = ssrEl.querySelector('slot[name="async"]')

      await new Promise(resolve => setTimeout(resolve, 50))

      assert.strictEqual(ssrSlotEl.hasAttribute('data-coralite-slot-computed'), false, 'data-coralite-slot-computed attribute must be stripped after async slot resolution')
      assert.strictEqual(ssrSlotEl.querySelector('.resolved').textContent, 'Async Content')

      document.body.removeChild(ssrEl)
    })
  })

  describe('Light DOM Slot Reconciliation', () => {
    it('should reconcile dynamically appended elements and non-empty text nodes into default and named slots', (t, done) => {
      const cardTag = 'card-recon-' + Math.random().toString(36).substring(2, 9)
      const CardComp = createCoraliteClass({
        componentId: 'card-recon',
        templateHTML: '<div class="card"><header><slot name="title"></slot></header><section><slot></slot></section></div>'
      })
      customElements.define(cardTag, CardComp)

      const card = document.createElement(cardTag)
      document.body.appendChild(card)

      const badge = document.createElement('span')
      badge.setAttribute('slot', 'title')
      badge.textContent = 'Badge'

      card.appendChild(badge)
      card.append('  Hello World  ')

      queueMicrotask(() => {
        const titleSlot = card.querySelector('slot[name="title"]')
        const defaultSlot = card.querySelector('slot:not([name])')

        assert.strictEqual(titleSlot.children.length, 1)
        assertSame(titleSlot.children[0], badge)
        assert.strictEqual(badge.getAttribute('data-coralite-slot-index'), '0')

        assert.ok(defaultSlot.textContent.includes('Hello World'))

        document.body.removeChild(card)
        done()
      })
    })

    it('should clear fallback content when the first real light child is projected into a slot', (t, done) => {
      const fallbackTag = 'fallback-recon-' + Math.random().toString(36).substring(2, 9)
      const FallbackComp = createCoraliteClass({
        componentId: 'fallback-recon',
        templateHTML: '<div class="box"><slot data-coralite-fallback><span class="fallback">Default Fallback Text</span></slot></div>'
      })
      customElements.define(fallbackTag, FallbackComp)

      const box = document.createElement(fallbackTag)
      document.body.appendChild(box)

      const slot = box.querySelector('slot')
      assert.strictEqual(slot.querySelector('.fallback').textContent, 'Default Fallback Text')
      assert.strictEqual(slot.hasAttribute('data-coralite-fallback'), true)

      const child = document.createElement('p')
      child.textContent = 'Custom Content'
      box.appendChild(child)

      queueMicrotask(() => {
        assert.strictEqual(slot.hasAttribute('data-coralite-fallback'), false)
        assertSame(slot.querySelector('.fallback'), null)
        assert.strictEqual(slot.children.length, 1)
        assertSame(slot.children[0], child)

        document.body.removeChild(box)
        done()
      })
    })

    it('should batch computed slot updates, maintain _originalNodes with un-transformed live nodes, and run slot transform once', (t, done) => {
      let transformCallCount = 0
      const computedTag = 'computed-recon-' + Math.random().toString(36).substring(2, 9)

      const ComputedComp = createCoraliteClass({
        componentId: 'computed-recon',
        templateHTML: '<div><slot name="items"></slot></div>',
        slots: {
          items (originalNodes) {
            transformCallCount++
            return originalNodes.map(node => {
              const wrapper = document.createElement('li')
              wrapper.className = 'item-wrapper'
              wrapper.appendChild(node)
              return wrapper
            })
          }
        }
      })
      customElements.define(computedTag, ComputedComp)

      const comp = document.createElement(computedTag)
      document.body.appendChild(comp)

      const item1 = document.createElement('span')
      item1.setAttribute('slot', 'items')
      item1.textContent = 'Item 1'

      const item2 = document.createElement('span')
      item2.setAttribute('slot', 'items')
      item2.textContent = 'Item 2'

      comp.append(item1, item2)

      queueMicrotask(() => {
        const slot = comp.querySelector('slot[name="items"]')
        assert.strictEqual(slot.children.length, 2)
        assert.strictEqual(slot.children[0].className, 'item-wrapper')
        assert.strictEqual(slot.children[1].className, 'item-wrapper')
        assert.strictEqual(slot.children[0].textContent, 'Item 1')
        assert.strictEqual(slot.children[1].textContent, 'Item 2')

        // Assert transform ran and _originalNodes preserved original live node references
        assert.ok(transformCallCount >= 1)
        assert.strictEqual(slot._originalNodes.length, 2)
        assertSame(slot._originalNodes[0], item1)
        assertSame(slot._originalNodes[1], item2)
        assert.strictEqual(slot._originalNodes[0].tagName, 'SPAN')
        assert.strictEqual(slot._originalNodes[0].textContent, 'Item 1')

        // Sequential append test across multiple ticks
        const item3 = document.createElement('span')
        item3.setAttribute('slot', 'items')
        item3.textContent = 'Item 3'
        comp.appendChild(item3)

        queueMicrotask(() => {
          assert.strictEqual(slot.children.length, 3)
          assert.strictEqual(slot._originalNodes.length, 3)
          assertSame(slot._originalNodes[2], item3)
          assert.strictEqual(slot._originalNodes[2].textContent, 'Item 3')

          document.body.removeChild(comp)
          done()
        })
      })
    })

    it('should preserve original light node when computed slot transform returns undefined', (t, done) => {
      const undefinedCompTag = 'undef-comp-' + Math.random().toString(36).substring(2, 9)
      const UndefinedComp = createCoraliteClass({
        componentId: 'undef-comp',
        templateHTML: '<div><slot name="action"></slot></div>',
        slots: {
          action () {
            return undefined
          }
        }
      })
      customElements.define(undefinedCompTag, UndefinedComp)

      const comp = document.createElement(undefinedCompTag)
      document.body.appendChild(comp)

      const btn = document.createElement('button')
      btn.setAttribute('slot', 'action')
      btn.textContent = 'Interactive Button'
      let clicked = false
      btn.addEventListener('click', () => { clicked = true })

      comp.appendChild(btn)

      queueMicrotask(() => {
        const slot = comp.querySelector('slot[name="action"]')
        assert.strictEqual(slot.children.length, 1)
        assertSame(slot.children[0], btn)
        assertSame(btn.parentElement, slot)

        btn.click()
        assert.strictEqual(clicked, true)

        document.body.removeChild(comp)
        done()
      })
    })

    it('should reconcile children appended while detached upon reconnection', (t, done) => {
      const reconnectTag = 'reconnect-recon-' + Math.random().toString(36).substring(2, 9)
      const ReconnectComp = createCoraliteClass({
        componentId: 'reconnect-recon',
        templateHTML: '<div><slot></slot></div>'
      })
      customElements.define(reconnectTag, ReconnectComp)

      const comp = document.createElement(reconnectTag)
      document.body.appendChild(comp)

      // Detach from DOM
      document.body.removeChild(comp)

      const child = document.createElement('div')
      child.textContent = 'Detached Child'
      comp.appendChild(child)

      // Reconnect to DOM
      document.body.appendChild(comp)

      queueMicrotask(() => {
        const slot = comp.querySelector('slot')
        assert.strictEqual(slot.children.length, 1)
        assertSame(slot.children[0], child)

        document.body.removeChild(comp)
        done()
      })
    })

    it('should leave elements targeting non-existent named slots unprojected as direct children of host', (t, done) => {
      const unmatchedTag = 'unmatched-recon-' + Math.random().toString(36).substring(2, 9)
      const UnmatchedComp = createCoraliteClass({
        componentId: 'unmatched-recon',
        templateHTML: '<div><slot></slot></div>'
      })
      customElements.define(unmatchedTag, UnmatchedComp)

      const comp = document.createElement(unmatchedTag)
      document.body.appendChild(comp)

      const stray = document.createElement('div')
      stray.setAttribute('slot', 'nonexistent')
      stray.textContent = 'Stray Element'
      comp.appendChild(stray)

      queueMicrotask(() => {
        const slot = comp.querySelector('slot')
        assert.strictEqual(slot.children.length, 0)
        assertSame(stray.parentElement, comp)

        document.body.removeChild(comp)
        done()
      })
    })

    it('should disconnect _slotObserver when disconnectedCallback is invoked', () => {
      const observerTag = 'observer-recon-' + Math.random().toString(36).substring(2, 9)
      const ObserverComp = createCoraliteClass({
        componentId: 'observer-recon',
        templateHTML: '<div><slot></slot></div>'
      })
      customElements.define(observerTag, ObserverComp)

      const comp = document.createElement(observerTag)
      document.body.appendChild(comp)

      assert.ok(comp._slotObserver)

      document.body.removeChild(comp)

      assert.strictEqual(comp._slotObserver, null)
    })
  })

  describe('Direct Slot Forwarding (<slot slot="...">)', () => {
    it('should project direct named forwarded slot into child target slot with timing chain and retain slot attribute', (t, done) => {
      const childTag = 'fwd-child-' + Math.random().toString(36).substring(2, 9)
      const parentTag = 'fwd-parent-' + Math.random().toString(36).substring(2, 9)

      const ChildComp = createCoraliteClass({
        componentId: 'fwd-child',
        templateHTML: '<div class="card-root"><header class="card-header"><slot name="header"></slot></header></div>'
      })
      const ParentComp = createCoraliteClass({
        componentId: 'fwd-parent',
        templateHTML: `<${childTag}><slot name="userHeader" slot="header"></slot></${childTag}>`
      })

      customElements.define(childTag, ChildComp)
      customElements.define(parentTag, ParentComp)

      const parentEl = document.createElement(parentTag)
      document.body.appendChild(parentEl)

      const heading = document.createElement('h1')
      heading.setAttribute('slot', 'userHeader')
      heading.textContent = 'User Title'
      parentEl.appendChild(heading)

      queueMicrotask(() => {
        const childEl = parentEl.querySelector(childTag)
        const headerSlot = childEl.querySelector('slot[name="header"]')
        const forwardedSlot = headerSlot.querySelector('slot[name="userHeader"]')

        assert.ok(forwardedSlot, 'Forwarded slot <slot name="userHeader"> should be projected inside child <slot name="header">')
        assert.strictEqual(forwardedSlot.getAttribute('slot'), 'header', 'Forwarded slot should retain slot="header" attribute')
        assert.ok(forwardedSlot.hasAttribute('data-coralite-slot-index'), 'Forwarded slot should receive data-coralite-slot-index')

        assert.strictEqual(forwardedSlot.children.length, 1)
        assertSame(forwardedSlot.children[0], heading)
        assert.strictEqual(heading.textContent, 'User Title')

        document.body.removeChild(parentEl)
        done()
      })
    })

    it('should project direct default forwarded slot into child default slot', (t, done) => {
      const innerTag = 'fwd-inner-' + Math.random().toString(36).substring(2, 9)
      const outerTag = 'fwd-outer-' + Math.random().toString(36).substring(2, 9)

      const InnerComp = createCoraliteClass({
        componentId: 'fwd-inner',
        templateHTML: '<div class="card-body"><slot></slot></div>'
      })
      const OuterComp = createCoraliteClass({
        componentId: 'fwd-outer',
        templateHTML: `<${innerTag}><slot></slot></${innerTag}>`
      })

      customElements.define(innerTag, InnerComp)
      customElements.define(outerTag, OuterComp)

      const outerEl = document.createElement(outerTag)
      document.body.appendChild(outerEl)

      const paragraph = document.createElement('p')
      paragraph.textContent = 'Default Body Text'
      outerEl.appendChild(paragraph)

      queueMicrotask(() => {
        const innerEl = outerEl.querySelector(innerTag)
        const innerSlot = innerEl.querySelector('slot:not([name])')
        const fwdSlot = innerSlot.querySelector('slot:not([name])')

        assert.ok(fwdSlot, 'Forwarded default slot should be inside inner default slot')
        assertSame(fwdSlot.children[0], paragraph)
        assert.strictEqual(paragraph.textContent, 'Default Body Text')

        document.body.removeChild(outerEl)
        done()
      })
    })

    it('should project through 3-tier slot forwarding (Grandparent -> Parent -> Child)', (t, done) => {
      const level3Tag = 'tier3-comp-' + Math.random().toString(36).substring(2, 9)
      const level2Tag = 'tier2-comp-' + Math.random().toString(36).substring(2, 9)
      const level1Tag = 'tier1-comp-' + Math.random().toString(36).substring(2, 9)

      const Level3Comp = createCoraliteClass({
        componentId: 'tier3-comp',
        templateHTML: '<div class="innermost"><slot name="main"></slot></div>'
      })
      const Level2Comp = createCoraliteClass({
        componentId: 'tier2-comp',
        templateHTML: `<${level3Tag}><slot name="middle" slot="main"></slot></${level3Tag}>`
      })
      const Level1Comp = createCoraliteClass({
        componentId: 'tier1-comp',
        templateHTML: `<${level2Tag}><slot name="top" slot="middle"></slot></${level2Tag}>`
      })

      customElements.define(level3Tag, Level3Comp)
      customElements.define(level2Tag, Level2Comp)
      customElements.define(level1Tag, Level1Comp)

      const level1El = document.createElement(level1Tag)
      document.body.appendChild(level1El)

      const leafEl = document.createElement('span')
      leafEl.setAttribute('slot', 'top')
      leafEl.textContent = 'Deep Content'
      level1El.appendChild(leafEl)

      queueMicrotask(() => {
        const innermost = level1El.querySelector('.innermost')
        assert.ok(innermost, 'Innermost element should exist')
        assert.ok(innermost.textContent.includes('Deep Content'), 'Content should project into innermost container')

        document.body.removeChild(level1El)
        done()
      })
    })

    it('should clear child fallback content when parent forwards a slot into child slot', (t, done) => {
      const childTag = 'fwd-fb-child-' + Math.random().toString(36).substring(2, 9)
      const parentTag = 'fwd-fb-parent-' + Math.random().toString(36).substring(2, 9)

      const ChildComp = createCoraliteClass({
        componentId: 'fwd-fb-child',
        templateHTML: '<div class="wrapper"><slot data-coralite-fallback><span class="fb">Child Fallback</span></slot></div>'
      })
      const ParentComp = createCoraliteClass({
        componentId: 'fwd-fb-parent',
        templateHTML: `<${childTag}><slot></slot></${childTag}>`
      })

      customElements.define(childTag, ChildComp)
      customElements.define(parentTag, ParentComp)

      const parentEl = document.createElement(parentTag)
      document.body.appendChild(parentEl)

      queueMicrotask(() => {
        const childSlot = parentEl.querySelector('slot[data-coralite-fallback], slot:not([name])')
        assert.strictEqual(childSlot.hasAttribute('data-coralite-fallback'), false, 'data-coralite-fallback attribute should be cleared when parent forwards slot')
        assertSame(childSlot.querySelector('.fb'), null, 'Child fallback content should be removed')

        document.body.removeChild(parentEl)
        done()
      })
    })

    it('should pass forwarded slot to computed slot transformer functions (isComputed)', (t, done) => {
      const childTag = 'fwd-comp-child-' + Math.random().toString(36).substring(2, 9)
      const parentTag = 'fwd-comp-parent-' + Math.random().toString(36).substring(2, 9)

      let transformerNodes = null

      const ChildComp = createCoraliteClass({
        componentId: 'fwd-comp-child',
        templateHTML: '<div><slot name="header"></slot></div>',
        slots: {
          header (nodes) {
            transformerNodes = nodes
            return nodes.map(n => {
              const wrapper = document.createElement('div')
              wrapper.className = 'header-wrap'
              wrapper.appendChild(n.cloneNode(true))
              return wrapper
            })
          }
        }
      })
      const ParentComp = createCoraliteClass({
        componentId: 'fwd-comp-parent',
        templateHTML: `<${childTag}><slot name="userHeader" slot="header"></slot></${childTag}>`
      })

      customElements.define(childTag, ChildComp)
      customElements.define(parentTag, ParentComp)

      const parentEl = document.createElement(parentTag)
      document.body.appendChild(parentEl)

      queueMicrotask(() => {
        assert.ok(transformerNodes, 'Transformer should receive nodes')
        assert.strictEqual(transformerNodes.length, 1)
        assert.strictEqual(transformerNodes[0].nodeName, 'SLOT')
        assert.strictEqual(transformerNodes[0].getAttribute('name'), 'userHeader')

        const childSlot = parentEl.querySelector(childTag).querySelector('slot[name="header"]')
        assert.ok(childSlot.querySelector('.header-wrap'))

        document.body.removeChild(parentEl)
        done()
      })
    })

    it('should isolate untagged legacy direct-child slots, keeping them in host ownSlots and skipping them without HierarchyRequestError', (t, done) => {
      const legacyTag = 'fwd-legacy-' + Math.random().toString(36).substring(2, 9)

      const LegacyComp = createCoraliteClass({
        componentId: 'fwd-legacy',
        templateHTML: '<div class="root"><slot></slot></div>'
      })
      customElements.define(legacyTag, LegacyComp)

      const el = document.createElement(legacyTag)
      // Append an untagged direct child slot manually
      const directSlot = document.createElement('slot')
      el.appendChild(directSlot)

      document.body.appendChild(el)

      queueMicrotask(() => {
        // Assert el._getOwnSlots() includes directSlot
        // @ts-ignore
        const own = el._getOwnSlots()
        assert.ok(own.includes(directSlot))

        // Assert directSlot remains stranded/skipped, and host's inner slot was not attempted to append to itself
        const targetSlot = el.querySelector('.root > slot')
        assert.notStrictEqual(targetSlot, directSlot)

        document.body.removeChild(el)
        done()
      })
    })
  })

  describe('Reconnection, Reparenting & Slot Reactivity ([LFC-01])', () => {
    it('1. Context Migration on Reparenting cleans up old unsubscribers and receives new context', (t, done) => {
      const tag = 'ctx-consumer-' + Math.random().toString(36).substring(2, 9)
      const ConsumerComp = createCoraliteClass({
        componentId: 'ctx-consumer',
        templateHTML: '<div><span id="theme-display">{{ theme }}</span></div>',
        consume: { theme: { context: 'theme', default: 'light' } },
        hydrationMap: {
          texts: [{ path: [0, 0], template: '{{ theme }}' }]
        }
      })
      customElements.define(tag, ConsumerComp)

      const provider1 = document.createElement('div')
      let provider1Theme = 'dark'
      provider1.addEventListener('context-request', (e) => {
        const key = e.context || e.detail?.context
        const cb = e.callback || e.detail?.callback
        if (key === 'theme' && typeof cb === 'function') {
          cb(provider1Theme)
        }
      })

      const provider2 = document.createElement('div')
      let provider2Theme = 'blue'
      provider2.addEventListener('context-request', (e) => {
        const key = e.context || e.detail?.context
        const cb = e.callback || e.detail?.callback
        if (key === 'theme' && typeof cb === 'function') {
          cb(provider2Theme)
        }
      })

      document.body.appendChild(provider1)
      document.body.appendChild(provider2)

      const el = document.createElement(tag)
      provider1.appendChild(el)

      queueMicrotask(() => {
        assert.strictEqual(el._state.theme, 'dark')

        // Move to provider2
        provider1.removeChild(el)
        provider2.appendChild(el)

        queueMicrotask(() => {
          assert.strictEqual(el._state.theme, 'blue')
          assert.strictEqual(el._contextCallbacks.length, 1, 'contextCallbacks should not accumulate duplicates')

          document.body.removeChild(provider1)
          document.body.removeChild(provider2)
          done()
        })
      })
    })

    it('2. Active Getter Aborts on True Disconnect (cross-task)', (t, done) => {
      let getterSignal = null
      const tag = 'getter-abort-' + Math.random().toString(36).substring(2, 9)
      const GetterAbortComp = createCoraliteClass({
        componentId: 'getter-abort',
        templateHTML: '<div></div>',
        getters: {
          asyncData ({ signal }) {
            getterSignal = signal
            return new Promise(() => {}) // pending promise
          }
        }
      })
      customElements.define(tag, GetterAbortComp)

      const el = document.createElement(tag)
      document.body.appendChild(el)

      // Trigger getter access
      const dummy = el._state.asyncData

      queueMicrotask(() => {
        assert.ok(getterSignal)
        assert.strictEqual(getterSignal.aborted, false)

        // Detach element across task turns
        document.body.removeChild(el)

        setTimeout(() => {
          assert.strictEqual(getterSignal.aborted, true, 'Getter AbortController signal must be aborted on true disconnect')
          done()
        }, 10)
      })
    })

    it('3. Synchronous Offline State Mutation before attach reflects immediately upon attach', (t, done) => {
      const tag = 'offline-mutate-' + Math.random().toString(36).substring(2, 9)
      const OfflineComp = createCoraliteClass({
        componentId: 'offline-mutate',
        templateHTML: '<div><span id="num">{{ count }}</span></div>',
        defaultValues: { count: 0 },
        hydrationMap: {
          texts: [{ path: [0, 0], template: '{{ count }}' }]
        }
      })
      customElements.define(tag, OfflineComp)

      const el = document.createElement(tag)
      document.body.appendChild(el)

      queueMicrotask(() => {
        assert.strictEqual(el.querySelector('#num').textContent, '0')

        // Synchronously detach, mutate state, and re-attach in same call turn
        document.body.removeChild(el)
        el._state.count = 42
        document.body.appendChild(el)

        queueMicrotask(() => {
          assert.strictEqual(el.querySelector('#num').textContent, '42')
          document.body.removeChild(el)
          done()
        })
      })
    })

    it('4. Slot Observed Keys Deduplication prevents duplicate registrations', (t, done) => {
      const tag = 'dedup-slot-' + Math.random().toString(36).substring(2, 9)
      const DedupComp = createCoraliteClass({
        componentId: 'dedup-slot',
        templateHTML: '<div><slot name="foo"></slot></div>',
        defaultValues: { a: 1, b: 2 },
        slots: {
          foo (nodes, { state }) {
            return `<span>${state.a} - ${state.b}</span>`
          }
        }
      })
      customElements.define(tag, DedupComp)

      const el = document.createElement(tag)
      document.body.appendChild(el)

      queueMicrotask(() => {
        const expectedKeysCount = Object.keys(el._state).length
        assert.strictEqual(el._slotObservedKeys.size, expectedKeysCount)
        const initialRecordCount = el._observerRecords.size

        // Mutate property 'a'
        el._state.a = 10

        queueMicrotask(() => {
          assert.strictEqual(el._slotObservedKeys.size, expectedKeysCount)
          assert.strictEqual(el._observerRecords.size, initialRecordCount, 'ObserverRecords size must not increase on property mutation')

          document.body.removeChild(el)
          done()
        })
      })
    })

    it('5. Repeated same-task reparent cycles do not re-run client(), duplicate state, or drop signal listeners', (t, done) => {
      let clientRunCount = 0
      let clickHandledCount = 0
      const tag = 'repeat-reparent-' + Math.random().toString(36).substring(2, 9)
      const RepeatComp = createCoraliteClass({
        componentId: 'repeat-reparent',
        templateHTML: '<div><button id="btn">Click</button><slot name="bar"></slot></div>',
        defaultValues: { x: 10, items: [] },
        slots: {
          bar (nodes, { state }) {
            return `<span>${state.x}</span>`
          }
        },
        client: ({ state, root, signal }) => {
          clientRunCount++
          state.items.push('item-' + clientRunCount)
          const btn = root.querySelector('#btn')
          btn.addEventListener('click', () => {
            clickHandledCount++
          }, { signal })
        }
      })
      customElements.define(tag, RepeatComp)

      const c1 = document.createElement('div')
      const c2 = document.createElement('div')
      document.body.appendChild(c1)
      document.body.appendChild(c2)

      const el = document.createElement(tag)
      c1.appendChild(el)

      queueMicrotask(() => {
        const initialObserverCount = el._observerRecords.size
        const initialSlotKeyCount = el._slotObservedKeys.size
        assert.strictEqual(clientRunCount, 1)
        assert.deepEqual(el._state.items, ['item-1'])

        // Move 5 times synchronously across containers
        for (let i = 0; i < 5; i++) {
          const target = i % 2 === 0 ? c2 : c1
          const parent = el.parentElement
          parent.removeChild(el)
          target.appendChild(el)
        }

        queueMicrotask(() => {
          assert.strictEqual(clientRunCount, 1, 'client() must run strictly once across repeated reparents')
          assert.deepEqual(el._state.items, ['item-1'], 'State items must not be duplicated')
          assert.strictEqual(el._observerRecords.size, initialObserverCount)
          assert.strictEqual(el._slotObservedKeys.size, initialSlotKeyCount)
          assert.strictEqual(el._abortController.signal.aborted, false)

          // Signal-attached listener must remain active across reparents
          const btn = el.querySelector('#btn')
          btn.click()
          assert.strictEqual(clickHandledCount, 1, 'Event listener bound with { signal } must remain active')

          document.body.removeChild(c1)
          document.body.removeChild(c2)
          done()
        })
      })
    })

    it('6. Lifecycle Revival: cross-task detach tears down, reconnect re-runs client() and re-hooks computed slot observers', (t, done) => {
      let clientRunCount = 0
      let listenerFiredCount = 0

      const tag = 'revival-comp-' + Math.random().toString(36).substring(2, 9)
      const RevivalComp = createCoraliteClass({
        componentId: 'revival-comp',
        templateHTML: '<div><button id="revive-btn">Revive</button><slot name="computed"></slot></div>',
        defaultValues: { val: 'Initial' },
        slots: {
          computed (nodes, { state }) {
            return `<span class="val">${state.val}</span>`
          }
        },
        client: ({ root, signal }) => {
          clientRunCount++
          const btn = root.querySelector('#revive-btn')
          btn.addEventListener('click', () => {
            listenerFiredCount++
          }, { signal })
        }
      })
      customElements.define(tag, RevivalComp)

      const el = document.createElement(tag)
      document.body.appendChild(el)

      queueMicrotask(() => {
        const slotEl = el.querySelector('slot[name="computed"]')
        assert.strictEqual(clientRunCount, 1)
        assert.strictEqual(slotEl.querySelector('.val').textContent, 'Initial')

        // Detach element across task turns
        document.body.removeChild(el)

        setTimeout(() => {
          // Teardown assertions
          assert.strictEqual(el._wasTornDown, true)
          assert.strictEqual(el._abortController.signal.aborted, true)

          // Re-attach element to DOM
          document.body.appendChild(el)

          queueMicrotask(() => {
            // Revival assertions
            assert.strictEqual(clientRunCount, 2, 'client() should re-run to revive component after cross-task detach')
            assert.strictEqual(el._wasTornDown, false)
            assert.strictEqual(el._abortController.signal.aborted, false)

            const btn = el.querySelector('#revive-btn')
            btn.click()
            assert.strictEqual(listenerFiredCount, 1, 'Revived listener should fire')

            // Computed slot reactivity must be re-hooked after reconnection
            el._state.val = 'Reconnected'

            queueMicrotask(() => {
              assert.strictEqual(slotEl.querySelector('.val').textContent, 'Reconnected', 'Computed slot must update after reconnection')
              document.body.removeChild(el)
              done()
            })
          })
        }, 10)
      })
    })

    it('7. Light DOM reconciliation batches observer-driven appends and stays idempotent on manual passes', (t, done) => {
      const tag = 'batch-recon-' + Math.random().toString(36).substring(2, 9)
      const BatchComp = createCoraliteClass({
        componentId: 'batch-recon',
        templateHTML: '<div><slot></slot></div>'
      })
      customElements.define(tag, BatchComp)

      const comp = document.createElement(tag)
      document.body.appendChild(comp)

      let reconcileCalls = 0
      const origReconcile = comp._reconcileLightDOM
      comp._reconcileLightDOM = function (...args) {
        reconcileCalls++
        return origReconcile.apply(this, args)
      }

      // Synchronous burst of element appends
      const el1 = document.createElement('div')
      el1.textContent = 'One'
      const el2 = document.createElement('div')
      el2.textContent = 'Two'
      const el3 = document.createElement('div')
      el3.textContent = 'Three'

      comp.appendChild(el1)
      comp.appendChild(el2)
      comp.appendChild(el3)

      queueMicrotask(() => {
        assert.strictEqual(reconcileCalls, 1, 'MutationObserver batching should deliver synchronous appends in a single microtask batch')
        const slot = comp.querySelector('slot')
        assert.strictEqual(slot.children.length, 3)

        // A manual reconciliation pass must be idempotent (no churn/double-fold)
        comp._reconcileLightDOM()
        assert.strictEqual(slot.children.length, 3)
        assertSame(slot.children[0], el1)

        document.body.removeChild(comp)
        done()
      })
    })
  })
})

