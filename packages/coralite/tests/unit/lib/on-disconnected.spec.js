import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'

// Mock HTMLElement before importing CoraliteElement
global.HTMLElement = class {
}

// Use dynamic import to ensure HTMLElement is defined before CoraliteElement is evaluated
const { CoraliteElement } = await import('../../../lib/coralite-element.js')

describe('CoraliteElement onDisconnected hook', () => {
  it('should trigger onDisconnected hooks when the element is removed from the DOM', async () => {
    let hookCalledCount = 0
    let hookPayload = null

    const options = {
      componentId: 'test-component',
      templateHTML: '<div>Test</div>',
      attributes: {},
      hydrationMap: {
        refs: [],
        texts: [],
        attributes: []
      }
    }

    const hooks = {
      onDisconnected: [
        (payload) => {
          hookCalledCount++
          hookPayload = payload
        }
      ]
    }

    const instance = new CoraliteElement()
    instance.componentOptions = options
    instance._hooks = {
      onBeforeComponentRender: [],
      onAfterComponentRender: [],
      onDisconnected: hooks.onDisconnected
    }
    instance._instanceId = 'test-id'
    instance._state = { some: 'state' }

    // Mock _abortController
    instance._abortController = {
      abort: () => {
      }
    }

    instance.disconnectedCallback()

    assert.strictEqual(hookCalledCount, 1, 'onDisconnected hook should be called once')
    assert.ok(hookPayload, 'hook should receive a payload')
    assert.strictEqual(hookPayload.componentId, 'test-component')
    assert.strictEqual(hookPayload.element, instance)
    assert.strictEqual(hookPayload.options, options)
    assert.strictEqual(hookPayload.instanceId, 'test-id')
    assert.deepStrictEqual(hookPayload.state, { some: 'state' })
  })
})
