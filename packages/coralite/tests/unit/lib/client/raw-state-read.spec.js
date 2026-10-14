/* eslint-disable no-restricted-imports -- Node test runner spec; requires node:* builtins */
import '../../setup.js'
import { describe, it } from 'node:test'
import assert from 'node:assert'
import { createCoraliteClass } from '../../../../lib/client/element.js'

describe('Client Runtime - Raw State Read Optimization', () => {
  it('exposes _stateRaw on component instance after setupState', () => {
    const ComponentClass = createCoraliteClass({
      componentId: 'raw-test-1',
      defaultValues: { count: 42 }
    })

    const tagName = 'raw-test-' + Math.random().toString(36).slice(2)
    customElements.define(tagName, ComponentClass)

    const el = document.createElement(tagName)
    document.body.appendChild(el)

    assert.ok(el._stateRaw, '_stateRaw should be accessible')
    assert.strictEqual(el._stateRaw.count, 42)
    assert.notStrictEqual(el._stateRaw, el._state, '_stateRaw should be raw target, not Proxy')

    document.body.removeChild(el)
  })

  it('token resolution reads from _stateRaw during DOM updates', async () => {
    const template = document.createElement('template')
    template.innerHTML = '<span id="val">{{ count }}</span>'

    const ComponentClass = createCoraliteClass({
      componentId: 'raw-test-2',
      defaultValues: { count: 10 },
      hydrationMap: {
        texts: [
          {
            path: [0, 0],
            template: '{{ count }}',
            tokens: ['count'],
            isSingleToken: true,
            singleTokenKey: 'count'
          }
        ],
        requiredTokens: ['count']
      }
    })

    const tagName = 'raw-test-' + Math.random().toString(36).slice(2)
    customElements.define(tagName, ComponentClass)

    const el = document.createElement(tagName)
    el.appendChild(template.content.cloneNode(true))
    document.body.appendChild(el)

    await el.updateComplete

    const span = el.querySelector('#val')
    assert.strictEqual(span.textContent, '10')

    // Modify via Proxy
    el._state.count = 20
    await el.updateComplete

    assert.strictEqual(span.textContent, '20')
    assert.strictEqual(el._stateRaw.count, 20)

    document.body.removeChild(el)
  })

  it('resolves tokens bound to getters correctly via _stateRaw', async () => {
    const template = document.createElement('template')
    template.innerHTML = '<span id="double">{{ doubleCount }}</span>'

    const ComponentClass = createCoraliteClass({
      componentId: 'raw-test-3',
      defaultValues: { count: 5 },
      getters: {
        doubleCount ({ state }) {
          return state.count * 2
        }
      },
      hydrationMap: {
        texts: [
          {
            path: [0, 0],
            template: '{{ doubleCount }}',
            tokens: ['doubleCount'],
            isSingleToken: true,
            singleTokenKey: 'doubleCount'
          }
        ],
        requiredTokens: ['doubleCount']
      }
    })

    const tagName = 'raw-test-' + Math.random().toString(36).slice(2)
    customElements.define(tagName, ComponentClass)

    const el = document.createElement(tagName)
    el.appendChild(template.content.cloneNode(true))
    document.body.appendChild(el)

    await el.updateComplete

    const span = el.querySelector('#double')
    assert.strictEqual(span.textContent, '10')

    el._state.count = 7
    await el.updateComplete

    assert.strictEqual(span.textContent, '14')

    document.body.removeChild(el)
  })

  it('falls back to Proxy reads when compilerOptimizations is "none"', async () => {
    const template = document.createElement('template')
    template.innerHTML = '<span id="val">{{ count }}</span>'

    const ComponentClass = createCoraliteClass({
      componentId: 'raw-test-4',
      compilerOptimizations: 'none',
      defaultValues: { count: 100 },
      hydrationMap: {
        texts: [
          {
            path: [0, 0],
            template: '{{ count }}',
            tokens: ['count'],
            isSingleToken: true,
            singleTokenKey: 'count'
          }
        ],
        requiredTokens: ['count']
      }
    })

    const tagName = 'raw-test-' + Math.random().toString(36).slice(2)
    customElements.define(tagName, ComponentClass)

    const el = document.createElement(tagName)
    el.appendChild(template.content.cloneNode(true))
    document.body.appendChild(el)

    await el.updateComplete

    const span = el.querySelector('#val')
    assert.strictEqual(span.textContent, '100')

    document.body.removeChild(el)
  })

  it('direct write to _stateRaw bypassing _state Proxy does NOT trigger reactive flush', async () => {
    const template = document.createElement('template')
    template.innerHTML = '<span id="val">{{ count }}</span>'

    const ComponentClass = createCoraliteClass({
      componentId: 'raw-test-5',
      defaultValues: { count: 1 },
      hydrationMap: {
        texts: [
          {
            path: [0, 0],
            template: '{{ count }}',
            tokens: ['count'],
            isSingleToken: true,
            singleTokenKey: 'count'
          }
        ],
        requiredTokens: ['count']
      }
    })

    const tagName = 'raw-test-' + Math.random().toString(36).slice(2)
    customElements.define(tagName, ComponentClass)

    const el = document.createElement(tagName)
    el.appendChild(template.content.cloneNode(true))
    document.body.appendChild(el)

    await el.updateComplete

    const span = el.querySelector('#val')
    assert.strictEqual(span.textContent, '1')

    // Direct write to _stateRaw without going through _state Proxy
    el._stateRaw.count = 99

    // Wait a tick to ensure no reactive update was scheduled
    await new Promise(resolve => setTimeout(resolve, 50))

    // Text content remains 1 because Proxy trap was bypassed and no update was scheduled
    assert.strictEqual(span.textContent, '1')

    // Now trigger an update through Proxy
    el._state.count = 100
    await el.updateComplete

    assert.strictEqual(span.textContent, '100')

    document.body.removeChild(el)
  })

  it('external observe code reads through Proxy and dependency tracking works', async () => {
    let observedValue = null

    const ComponentClass = createCoraliteClass({
      componentId: 'raw-test-6',
      defaultValues: { num: 3 },
      client ({ state, observe }) {
        observe('num', () => {
          observedValue = state.num
        })
      }
    })

    const tagName = 'raw-test-' + Math.random().toString(36).slice(2)
    customElements.define(tagName, ComponentClass)

    const el = document.createElement(tagName)
    document.body.appendChild(el)

    await el.updateComplete

    el._state.num = 42
    await el.updateComplete

    assert.strictEqual(observedValue, 42)

    document.body.removeChild(el)
  })
})
