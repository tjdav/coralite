import '../setup.js'
import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { createCoraliteClass } from '../../../lib/coralite-element.js'
import { createComponentDefinition } from '../../../lib/component-setup.js'
import { validateComponentSource } from '../../../lib/component-validator.js'
import { CoraliteError } from '../../../lib/utils/errors.js'

describe('emit Helper in Client Context', () => {
  it('should dispatch CustomEvent with default bubbles: true and composed: true', (t, done) => {
    let clientEmit = null
    const tagName = 'emit-comp-' + Math.random().toString(36).substring(2, 9)

    const EmitElement = createCoraliteClass({
      componentId: 'emit-comp',
      client: ({ emit }) => {
        clientEmit = emit
      }
    })
    customElements.define(tagName, EmitElement)

    const el = document.createElement(tagName)
    document.body.appendChild(el)

    queueMicrotask(() => {
      let receivedEvent = null
      el.addEventListener('my-event', (e) => {
        receivedEvent = e
      })

      const res = clientEmit('my-event', { id: 123 })

      assert.strictEqual(res, true)
      assert.ok(receivedEvent)
      assert.strictEqual(receivedEvent.type, 'my-event')
      assert.deepEqual(receivedEvent.detail, { id: 123 })
      assert.strictEqual(receivedEvent.bubbles, true)
      assert.strictEqual(receivedEvent.composed, true)
      assert.strictEqual(receivedEvent.cancelable, false)

      document.body.removeChild(el)
      done()
    })
  })

  it('should bubble event to parent DOM node', (t, done) => {
    let clientEmit = null
    const tagName = 'emit-bubble-comp-' + Math.random().toString(36).substring(2, 9)

    const EmitElement = createCoraliteClass({
      componentId: 'emit-bubble-comp',
      client: ({ emit }) => {
        clientEmit = emit
      }
    })
    customElements.define(tagName, EmitElement)

    const parentContainer = document.createElement('div')
    const el = document.createElement(tagName)
    parentContainer.appendChild(el)
    document.body.appendChild(parentContainer)

    queueMicrotask(() => {
      let parentReceived = null
      parentContainer.addEventListener('child-saved', (e) => {
        parentReceived = e
      })

      clientEmit('child-saved', { saved: true })

      assert.ok(parentReceived)
      assert.strictEqual(parentReceived.type, 'child-saved')
      assert.deepEqual(parentReceived.detail, { saved: true })

      document.body.removeChild(parentContainer)
      done()
    })
  })

  it('should allow custom options to override default event configuration', (t, done) => {
    let clientEmit = null
    const tagName = 'emit-options-comp-' + Math.random().toString(36).substring(2, 9)

    const EmitElement = createCoraliteClass({
      componentId: 'emit-options-comp',
      client: ({ emit }) => {
        clientEmit = emit
      }
    })
    customElements.define(tagName, EmitElement)

    const el = document.createElement(tagName)
    document.body.appendChild(el)

    queueMicrotask(() => {
      let receivedEvent = null
      el.addEventListener('non-bubbling', (e) => {
        receivedEvent = e
      })

      clientEmit('non-bubbling', { payload: 'data' }, { bubbles: false, cancelable: true })

      assert.ok(receivedEvent)
      assert.strictEqual(receivedEvent.bubbles, false)
      assert.strictEqual(receivedEvent.composed, true)
      assert.strictEqual(receivedEvent.cancelable, true)
      assert.deepEqual(receivedEvent.detail, { payload: 'data' })

      document.body.removeChild(el)
      done()
    })
  })

  it('should give 2nd argument detail precedence over options.detail, but fallback to options.detail if 2nd arg is undefined', (t, done) => {
    let clientEmit = null
    const tagName = 'emit-detail-comp-' + Math.random().toString(36).substring(2, 9)

    const EmitElement = createCoraliteClass({
      componentId: 'emit-detail-comp',
      client: ({ emit }) => {
        clientEmit = emit
      }
    })
    customElements.define(tagName, EmitElement)

    const el = document.createElement(tagName)
    document.body.appendChild(el)

    queueMicrotask(() => {
      let event1 = null
      let event2 = null

      el.addEventListener('evt1', (e) => { event1 = e })
      el.addEventListener('evt2', (e) => { event2 = e })

      // 1. Explicit 2nd arg takes precedence over options.detail
      clientEmit('evt1', { primary: true }, { detail: { fallback: true } })
      assert.deepEqual(event1.detail, { primary: true })

      // 2. Undefined 2nd arg falls back to options.detail
      clientEmit('evt2', undefined, { detail: { fallback: true } })
      assert.deepEqual(event2.detail, { fallback: true })

      document.body.removeChild(el)
      done()
    })
  })

  it('should return false if preventDefault() is called on a cancelable event', (t, done) => {
    let clientEmit = null
    const tagName = 'emit-cancel-comp-' + Math.random().toString(36).substring(2, 9)

    const EmitElement = createCoraliteClass({
      componentId: 'emit-cancel-comp',
      client: ({ emit }) => {
        clientEmit = emit
      }
    })
    customElements.define(tagName, EmitElement)

    const el = document.createElement(tagName)
    document.body.appendChild(el)

    queueMicrotask(() => {
      el.addEventListener('cancelable-event', (e) => {
        e.preventDefault()
      })

      const result = clientEmit('cancelable-event', null, { cancelable: true })

      assert.strictEqual(result, false)

      document.body.removeChild(el)
      done()
    })
  })

  it('should throw CoraliteError with component metadata when name is missing, not a string, or empty/whitespace', (t, done) => {
    let clientEmit = null
    const tagName = 'emit-error-comp-' + Math.random().toString(36).substring(2, 9)

    const EmitElement = createCoraliteClass({
      componentId: 'emit-error-comp',
      client: ({ emit }) => {
        clientEmit = emit
      }
    })
    customElements.define(tagName, EmitElement)

    const el = document.createElement(tagName)
    document.body.appendChild(el)

    queueMicrotask(() => {
      const invalidNames = [undefined, null, 123, true, {}, [], '', '   ']

      for (const invalidName of invalidNames) {
        assert.throws(() => {
          clientEmit(invalidName)
        }, (err) => {
          assert.ok(err instanceof CoraliteError)
          assert.ok(err.message.includes('Component "emit-error-comp" event name must be a non-empty string.'))
          assert.strictEqual(err.componentId, 'emit-error-comp')
          assert.strictEqual(err.instanceId, el._instanceId)
          return true
        })
      }

      document.body.removeChild(el)
      done()
    })
  })

  it('should provide emit in client-side slot context and emit: () => false stub in SSR slotContext', async () => {
    // 1. Test SSR stub in component-setup
    let ssrEmitResult = null
    const fakeApp = { options: { mode: 'testing' }, createComponentElement: () => {} }
    const defineComp = createComponentDefinition({ app: fakeApp })

    const options = {
      slots: {
        default (nodes, context) {
          assert.strictEqual(typeof context.emit, 'function')
          ssrEmitResult = context.emit('ssr-event', { data: 1 })
          return nodes
        }
      }
    }

    const mockModule = { id: 'ssr-comp', path: { pathname: '/ssr-comp.html' } }
    await defineComp(options, { module: mockModule, state: {} })

    assert.strictEqual(ssrEmitResult, false)

    // 2. Test Client-side slot context
    let clientSlotEmitResult = null
    let slotEventReceived = null
    const slotCompTag = 'slot-emit-comp-' + Math.random().toString(36).substring(2, 9)

    const SlotEmitElement = createCoraliteClass({
      componentId: 'slot-emit-comp',
      templateHTML: '<div><slot></slot></div>',
      slots: {
        default (nodes, context) {
          if (typeof context.emit === 'function') {
            clientSlotEmitResult = context.emit('slot-custom-event', { slotData: 'abc' })
          }
          return nodes
        }
      }
    })
    customElements.define(slotCompTag, SlotEmitElement)

    const slotEl = document.createElement(slotCompTag)
    slotEl.addEventListener('slot-custom-event', (e) => {
      slotEventReceived = e
    })
    document.body.appendChild(slotEl)

    await new Promise(resolve => queueMicrotask(resolve))

    assert.strictEqual(clientSlotEmitResult, true)
    assert.ok(slotEventReceived)
    assert.deepEqual(slotEventReceived.detail, { slotData: 'abc' })

    document.body.removeChild(slotEl)
  })

  it('should trigger warning in component-validator if attribute or server property collides with emit when slots are defined', () => {
    const originalWarn = console.warn
    const warnings = []
    console.warn = (msg) => {
      warnings.push(msg)
    }

    try {
      const sourceCode = `
        <template>
          <div><slot></slot></div>
        </template>

        <script>
          export default defineComponent({
            attributes: {
              emit: String
            },
            server() {
              return {
                emit: 'server-val'
              }
            },
            slots: {
              default(nodes) { return nodes }
            }
          })
        </script>
      `

      validateComponentSource(sourceCode, 'test-component.html')

      assert.strictEqual(warnings.length, 2)
      assert.ok(warnings[0].includes('Component attribute "emit" in "test-component.html" collides with a reserved context property (emit).'))
      assert.ok(warnings[1].includes('Component server property "emit" in "test-component.html" collides with a reserved context property (emit).'))
    } finally {
      console.warn = originalWarn
    }
  })
})
