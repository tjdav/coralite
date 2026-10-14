import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { Window } from 'happy-dom'

const window = new Window()
globalThis.window = window
globalThis.document = window.document
globalThis.HTMLElement = window.HTMLElement
globalThis.CustomEvent = window.CustomEvent
globalThis.MutationObserver = window.MutationObserver
globalThis.Node = window.Node
globalThis.customElements = window.customElements

const { createCoraliteClass, setupPageRuntime } = await import('../../../lib/client/element.js')

describe('Client Getters and Provide Context (isServer & signal)', () => {
  beforeEach(() => {
    window.document.body.innerHTML = ''
  })

  it('component getter receives isServer: false and signal that aborts on disconnect', async () => {
    let capturedCtx = null

    const options = {
      componentId: 'test-client-getter',
      getters: {
        val: (ctx) => {
          capturedCtx = ctx
          return 'test'
        }
      }
    }

    const CompClass = createCoraliteClass(options)
    const tagName = 'test-client-getter-' + Math.random().toString(36).slice(2, 8)
    customElements.define(tagName, CompClass)

    const el = document.createElement(tagName)
    document.body.appendChild(el)

    // Access getter via state proxy
    const res = el._state.val
    assert.strictEqual(res, 'test')
    assert.ok(capturedCtx)
    assert.strictEqual(capturedCtx.isServer, false)
    assert.ok(capturedCtx.signal instanceof window.AbortSignal || capturedCtx.signal instanceof AbortSignal)
    assert.strictEqual(capturedCtx.signal.aborted, false)

    // Disconnect element from DOM (triggers disconnectedCallback & queueMicrotask _teardownLifecycle)
    document.body.removeChild(el)
    await new Promise(resolve => queueMicrotask(resolve))
    assert.strictEqual(capturedCtx.signal.aborted, true)
  })

  it('component provider receives isServer: false and signal', () => {
    let capturedCtx = null

    const options = {
      componentId: 'test-client-provider',
      provide: {
        testKey: (ctx) => {
          capturedCtx = ctx
          return 'provided-val'
        }
      }
    }

    const CompClass = createCoraliteClass(options)
    const tagName = 'test-client-provider-' + Math.random().toString(36).slice(2, 8)
    customElements.define(tagName, CompClass)

    const el = document.createElement(tagName)
    document.body.appendChild(el)

    let receivedValue = null
    el.dispatchEvent(new CustomEvent('context-request', {
      bubbles: true,
      composed: true,
      detail: {
        context: 'testKey',
        callback: (val) => {
          receivedValue = val
        }
      }
    }))

    assert.strictEqual(receivedValue, 'provided-val')
    assert.ok(capturedCtx)
    assert.strictEqual(capturedCtx.isServer, false)
    assert.ok(capturedCtx.signal instanceof window.AbortSignal || capturedCtx.signal instanceof AbortSignal)
    assert.strictEqual(capturedCtx.signal.aborted, false)

    document.body.removeChild(el)
  })

  it('page runtime getter receives isServer: false and signal', async () => {
    let capturedCtx = null

    const pageConfig = {
      state: { count: 1 },
      getters: {
        doubled: (ctx) => {
          capturedCtx = ctx
          return ctx.state.count * 2
        }
      },
      client: ({ state }) => {
        const _val = state.doubled
      }
    }

    await setupPageRuntime(pageConfig)

    assert.ok(capturedCtx)
    assert.strictEqual(capturedCtx.isServer, false)
    assert.ok(capturedCtx.signal instanceof window.AbortSignal || capturedCtx.signal instanceof AbortSignal)
  })
})
