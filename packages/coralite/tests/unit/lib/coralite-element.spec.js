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
        computedGetter: (state) => state.isTrue ? 'value' : 'another value'
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
          // Clone the nodes to simulate slot transformation that causes reference disconnection
          return nodes.map(n => n.cloneNode(true))
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
        assert.strictEqual(titleSlot.children[0], badge)
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
        assert.strictEqual(slot.querySelector('.fallback'), null)
        assert.strictEqual(slot.children.length, 1)
        assert.strictEqual(slot.children[0], child)

        document.body.removeChild(box)
        done()
      })
    })

    it('should batch computed slot updates, maintain _originalNodes with un-transformed clones, and run slot transform once', (t, done) => {
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
              wrapper.appendChild(node.cloneNode(true))
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

        // Assert transform ran and _originalNodes preserved original untransformed nodes
        assert.ok(transformCallCount >= 1)
        assert.strictEqual(slot._originalNodes.length, 2)
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
        assert.strictEqual(slot.children[0], btn)
        assert.strictEqual(btn.parentElement, slot)

        btn.click()
        assert.strictEqual(clicked, true)

        document.body.removeChild(comp)
        done()
      })
    })

    it('should be idempotent and not churn or double-fold on subsequent reconcile passes', (t, done) => {
      const idempotenceTag = 'idempotence-comp-' + Math.random().toString(36).substring(2, 9)
      const IdempotenceComp = createCoraliteClass({
        componentId: 'idempotence-comp',
        templateHTML: '<div><slot></slot></div>'
      })
      customElements.define(idempotenceTag, IdempotenceComp)

      const comp = document.createElement(idempotenceTag)
      document.body.appendChild(comp)

      const child = document.createElement('div')
      child.textContent = 'Unique Child'
      comp.appendChild(child)

      queueMicrotask(() => {
        const slot = comp.querySelector('slot')
        assert.strictEqual(slot.children.length, 1)

        // Trigger manual reconciliation pass
        // @ts-ignore
        comp._reconcileLightDOM()

        assert.strictEqual(slot.children.length, 1)
        assert.strictEqual(slot.children[0], child)

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
        assert.strictEqual(slot.children[0], child)

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
        assert.strictEqual(stray.parentElement, comp)

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
})

