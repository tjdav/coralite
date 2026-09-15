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

const { createCoraliteClass } = await import('../../../lib/coralite-element.js')

describe('Render Concurrency & Lock Isolation (BUG-01)', () => {
  beforeEach(() => {
    window.document.body.innerHTML = ''
  })

  it('1. Interleaved async getter & computed slot: getter output is not dropped', async () => {
    const options = {
      componentId: 'test-async-getter-slot',
      templateHTML: '<div class="box"><h1>{{ asyncTitle }}</h1><slot name="header"></slot></div>',
      defaultValues: { title: 'Async Title' },
      hydrationMap: {
        texts: [
          {
            path: [0, 0, 0],
            template: '{{ asyncTitle }}'
          }
        ]
      },
      getters: {
        asyncTitle: async ({ state }) => {
          await new Promise(resolve => setTimeout(resolve, 20))
          return state.title
        }
      },
      slots: {
        header: (nodes) => {
          const div = document.createElement('div')
          div.className = 'header-content'
          div.textContent = 'Slotted Header'
          return div
        }
      }
    }

    const ElementClass = createCoraliteClass(options)
    const testTag = 'test-async-getter-slot'
    if (!customElements.get(testTag)) {
      customElements.define(testTag, ElementClass)
    }

    const el = document.createElement(testTag)
    document.body.appendChild(el)

    // Wait 50ms for async getter resolution
    await new Promise(resolve => setTimeout(resolve, 50))

    const h1 = el.querySelector('h1')
    assert.ok(h1, 'h1 element should exist')
    assert.equal(h1.textContent, 'Async Title', 'Async getter output should not be dropped by slot execution')

    const headerContent = el.querySelector('.header-content')
    assert.ok(headerContent, 'Slot content should exist')
    assert.equal(headerContent.textContent, 'Slotted Header')
  })

  it('2. Multi-slot asynchronous resolution: earlier slot output is not dropped by later slots', async () => {
    const options = {
      componentId: 'test-multi-async-slots',
      templateHTML: '<div><slot name="header"></slot><slot name="footer"></slot></div>',
      slots: {
        header: () => {
          return new Promise(resolve => {
            setTimeout(() => {
              const div = document.createElement('div')
              div.className = 'res-header'
              div.textContent = 'Header Resolved'
              resolve(div)
            }, 30)
          })
        },
        footer: () => {
          const div = document.createElement('div')
          div.className = 'res-footer'
          div.textContent = 'Footer Resolved'
          return div
        }
      }
    }

    const ElementClass = createCoraliteClass(options)
    const testTag = 'test-multi-async-slots'
    if (!customElements.get(testTag)) {
      customElements.define(testTag, ElementClass)
    }

    const el = document.createElement(testTag)
    document.body.appendChild(el)

    // Wait 60ms for all slot promises to resolve
    await new Promise(resolve => setTimeout(resolve, 60))

    const headerEl = el.querySelector('.res-header')
    assert.ok(headerEl, 'Header slot content should be rendered despite being async and run before footer')
    assert.equal(headerEl.textContent, 'Header Resolved')

    const footerEl = el.querySelector('.res-footer')
    assert.ok(footerEl, 'Footer slot content should be rendered')
    assert.equal(footerEl.textContent, 'Footer Resolved')
  })

  it('3. Stale DOM render abort: rapid consecutive state updates abort older in-flight getters', async () => {
    const options = {
      componentId: 'test-stale-dom-abort',
      templateHTML: '<div class="data">{{ asyncData }}</div>',
      defaultValues: { query: 'v1' },
      hydrationMap: {
        texts: [
          {
            path: [0, 0],
            template: '{{ asyncData }}'
          }
        ]
      },
      getters: {
        asyncData: async ({ state }) => {
          const q = state.query
          // v1 takes 50ms, v2 takes 10ms
          const delay = q === 'v1' ? 50 : 10
          await new Promise(resolve => setTimeout(resolve, delay))
          return `Result for ${q}`
        }
      }
    }

    const ElementClass = createCoraliteClass(options)
    const testTag = 'test-stale-dom-abort'
    if (!customElements.get(testTag)) {
      customElements.define(testTag, ElementClass)
    }

    const el = document.createElement(testTag)
    document.body.appendChild(el)

    // Trigger v2 state update immediately before v1 resolves
    el._state.query = 'v2'

    // Wait 70ms for both getters to attempt resolution
    await new Promise(resolve => setTimeout(resolve, 70))

    const dataEl = el.querySelector('.data')
    assert.ok(dataEl)
    assert.equal(dataEl.textContent, 'Result for v2', 'v1 getter should be aborted because v2 started a newer DOM render')
  })

  it('4. Stale slot render abort: rapid consecutive slot observe updates abort older in-flight promises', async () => {
    const options = {
      componentId: 'test-stale-slot-abort',
      templateHTML: '<div><slot name="header"></slot></div>',
      defaultValues: { count: 0 },
      slots: {
        header: (nodes, { observe }) => {
          observe('count', (val) => {
            if (val === 0) return 'Initial Slot'
            // val 1 takes 50ms, val 2 takes 10ms
            const delay = val === 1 ? 50 : 10
            return new Promise(resolve => {
              setTimeout(() => {
                const div = document.createElement('div')
                div.className = 'slot-val'
                div.textContent = `Slot Count ${val}`
                resolve(div)
              }, delay)
            })
          })
          return 'Initial Slot'
        }
      }
    }

    const ElementClass = createCoraliteClass(options)
    const testTag = 'test-stale-slot-abort'
    if (!customElements.get(testTag)) {
      customElements.define(testTag, ElementClass)
    }

    const el = document.createElement(testTag)
    document.body.appendChild(el)

    // Rapidly update count: 1 then 2
    el._state.count = 1
    el._state.count = 2

    // Wait 70ms for all promises to resolve
    await new Promise(resolve => setTimeout(resolve, 70))

    const slotVal = el.querySelector('.slot-val')
    assert.ok(slotVal)
    assert.equal(slotVal.textContent, 'Slot Count 2', 'Count 1 slot promise should be aborted because Count 2 started a newer slot render version')
  })

  it('5. Disconnection mid-flight: pending slot promises do not mutate DOM after element disconnected', async () => {
    let resolvedValue = null

    const options = {
      componentId: 'test-slot-disconnect',
      templateHTML: '<div><slot name="header"></slot></div>',
      slots: {
        header: () => {
          return new Promise(resolve => {
            setTimeout(() => {
              const div = document.createElement('div')
              div.className = 'late-slot'
              div.textContent = 'Late Slot Content'
              resolvedValue = 'Late Slot Content'
              resolve(div)
            }, 30)
          })
        }
      }
    }

    const ElementClass = createCoraliteClass(options)
    const testTag = 'test-slot-disconnect'
    if (!customElements.get(testTag)) {
      customElements.define(testTag, ElementClass)
    }

    const el = document.createElement(testTag)
    document.body.appendChild(el)

    // Disconnect element mid-flight while slot promise is pending
    el.remove()

    // Wait 60ms for late slot promise resolution
    await new Promise(resolve => setTimeout(resolve, 60))

    assert.equal(resolvedValue, 'Late Slot Content', 'Promise completed')
    const lateSlotEl = el.querySelector('.late-slot')
    assert.equal(lateSlotEl, null, 'Slot DOM should not be mutated after disconnection')
  })
})
