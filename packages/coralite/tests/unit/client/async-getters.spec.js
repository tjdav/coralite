import { describe, it, beforeEach, afterEach } from 'node:test'
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

const { createCoraliteClass } = await import('../../../lib/client/element.js')
const { CoraliteError } = await import('../../../lib/shared/errors.js')

describe('Client Async Getters Suite', () => {
  let origMode

  beforeEach(() => {
    window.document.body.innerHTML = ''
    origMode = window.__coralite__?.mode
    if (!window.__coralite__) {
      window.__coralite__ = {}
    }
    window.__coralite__.mode = 'development'
  })

  afterEach(() => {
    if (window.__coralite__) {
      window.__coralite__.mode = origMode
    }
  })

  it('sync getters remain unaffected', () => {
    const options = {
      componentId: 'sync-getter-comp',
      defaultValues: { count: 5 },
      getters: {
        doubled: ({ state }) => state.count * 2
      }
    }

    const tag = 'sync-getter-comp-' + Math.random().toString(36).slice(2, 8)
    const CompClass = createCoraliteClass(options)
    customElements.define(tag, CompClass)

    const el = document.createElement(tag)
    document.body.appendChild(el)

    assert.strictEqual(el._state.doubled, 10)
    el._state.count = 8
    assert.strictEqual(el._state.doubled, 16)
  })

  it('client first read triggers execution and caches resolved value', async () => {
    let executions = 0
    const options = {
      componentId: 'client-first-read-comp',
      getters: {
        asyncVal: async () => {
          executions++
          await new Promise(r => setTimeout(r, 20))
          return 'resolved-data'
        }
      }
    }

    const tag = 'client-first-read-' + Math.random().toString(36).slice(2, 8)
    const CompClass = createCoraliteClass(options)
    customElements.define(tag, CompClass)

    const el = document.createElement(tag)
    document.body.appendChild(el)

    // First read returns undefined before resolution and triggers compute
    const first = el._state.asyncVal
    assert.strictEqual(first, undefined)
    assert.strictEqual(executions, 1)

    // Second read while in flight returns undefined without re-executing
    const second = el._state.asyncVal
    assert.strictEqual(second, undefined)
    assert.strictEqual(executions, 1)

    await new Promise(r => setTimeout(r, 30))

    // Resolved read returns cached result
    const third = el._state.asyncVal
    assert.strictEqual(third, 'resolved-data')
    assert.strictEqual(executions, 1)
  })

  it('template binding re-renders when async getter resolves', async () => {
    const options = {
      componentId: 'template-async-comp',
      templateHTML: '<div data-testid="out">{{ asyncMsg }}</div>',
      hydrationMap: {
        texts: [
          {
            path: [0, 0],
            template: '{{ asyncMsg }}'
          }
        ]
      },
      getters: {
        asyncMsg: async () => {
          await new Promise(r => setTimeout(r, 20))
          return 'Hello Async'
        }
      }
    }

    const tag = 'template-async-' + Math.random().toString(36).slice(2, 8)
    const CompClass = createCoraliteClass(options)
    customElements.define(tag, CompClass)

    const el = document.createElement(tag)
    document.body.appendChild(el)

    await new Promise(r => setTimeout(r, 50))
    await el.updateComplete

    const targetDiv = el.querySelector('[data-testid="out"]') || el.children[0]
    assert.ok(targetDiv)
    assert.strictEqual(targetDiv.textContent, 'Hello Async')
  })

  it('pre-await reads subscribe the getter; post-await reads do not subscribe', async () => {
    let executions = 0
    const options = {
      componentId: 'pre-post-await-comp',
      defaultValues: {
        depPre: 'a',
        depPost: 'x'
      },
      getters: {
        async compute ({ state }) {
          executions++
          const pre = state.depPre
          await new Promise(r => setTimeout(r, 20))
          const post = state.depPost
          return `${pre}:${post}`
        }
      }
    }

    const tag = 'pre-post-await-' + Math.random().toString(36).slice(2, 8)
    const CompClass = createCoraliteClass(options)
    customElements.define(tag, CompClass)

    const el = document.createElement(tag)
    document.body.appendChild(el)

    // Trigger first read
    const _init = el._state.compute
    assert.strictEqual(executions, 1)

    await new Promise(r => setTimeout(r, 30))
    assert.strictEqual(el._state.compute, 'a:x')

    // Mutate post-await dependency
    el._state.depPost = 'y'
    await new Promise(r => setTimeout(r, 30))

    // Re-run was NOT triggered by post-await change
    assert.strictEqual(executions, 1)
    assert.strictEqual(el._state.compute, 'a:x')

    // Mutate pre-await dependency
    el._state.depPre = 'b'
    await new Promise(r => setTimeout(r, 30))

    // Re-run WAS triggered by pre-await change
    assert.strictEqual(executions, 2)
    assert.strictEqual(el._state.compute, 'b:y')
  })

  it('in-flight compute is aborted when a subscribed dependency changes', async () => {
    let abortedInFlight = false

    const options = {
      componentId: 'abort-dep-comp',
      defaultValues: { query: 'v1' },
      getters: {
        async search ({ state, signal }) {
          const q = state.query
          return new Promise((resolve, reject) => {
            const timer = setTimeout(() => resolve(`result:${q}`), 50)
            signal.addEventListener('abort', () => {
              clearTimeout(timer)
              abortedInFlight = true
              const err = new Error('Aborted')
              err.name = 'AbortError'
              reject(err)
            }, { once: true })
          })
        }
      }
    }

    const tag = 'abort-dep-' + Math.random().toString(36).slice(2, 8)
    const CompClass = createCoraliteClass(options)
    customElements.define(tag, CompClass)

    const el = document.createElement(tag)
    document.body.appendChild(el)

    // Trigger initial compute for v1
    const _init = el._state.search

    await new Promise(r => setTimeout(r, 10))

    // Mutate query while v1 compute is in flight
    el._state.query = 'v2'

    await new Promise(r => setTimeout(r, 80))

    assert.strictEqual(abortedInFlight, true)
    assert.strictEqual(el._state.search, 'result:v2')
  })

  it('in-flight compute is aborted on component disconnect', async () => {
    let disconnectAborted = false

    const options = {
      componentId: 'abort-disconnect-comp',
      getters: {
        async loadData ({ signal }) {
          return new Promise((resolve, reject) => {
            const timer = setTimeout(() => resolve('done'), 100)
            signal.addEventListener('abort', () => {
              clearTimeout(timer)
              disconnectAborted = true
              const err = new Error('Aborted')
              err.name = 'AbortError'
              reject(err)
            }, { once: true })
          })
        }
      }
    }

    const tag = 'abort-disconnect-' + Math.random().toString(36).slice(2, 8)
    const CompClass = createCoraliteClass(options)
    customElements.define(tag, CompClass)

    const el = document.createElement(tag)
    document.body.appendChild(el)

    const _init = el._state.loadData

    await new Promise(r => setTimeout(r, 10))

    document.body.removeChild(el)
    await new Promise(r => queueMicrotask(r))

    assert.strictEqual(disconnectAborted, true)
  })

  it('retains previous value on error in development mode', async () => {
    let shouldFail = false
    const errors = []
    const origErr = console.error
    console.error = (...args) => errors.push(args.join(' '))

    try {
      const options = {
        componentId: 'error-dev-comp',
        defaultValues: { tick: 0 },
        getters: {
          async data ({ state }) {
            const _t = state.tick
            if (shouldFail) {
              throw new Error('Async failure')
            }
            return 'ok-value'
          }
        }
      }

      const tag = 'error-dev-' + Math.random().toString(36).slice(2, 8)
      const CompClass = createCoraliteClass(options)
      customElements.define(tag, CompClass)

      const el = document.createElement(tag)
      document.body.appendChild(el)

      // First run succeeds
      const _init = el._state.data
      await new Promise(r => setTimeout(r, 20))
      assert.strictEqual(el._state.data, 'ok-value')

      // Second run fails
      shouldFail = true
      window.__coralite__.mode = 'development'

      el._state.tick = 1
      await new Promise(r => setTimeout(r, 30))

      // Previous cached value retained
      assert.strictEqual(el._state.data, 'ok-value')
      assert.ok(errors.some(e => e.includes('Async failure')))
    } finally {
      console.error = origErr
    }
  })

  it('logs console.warn on error in production mode', async () => {
    window.__coralite__.mode = 'production'
    const warnings = []
    const origWarn = console.warn
    console.warn = (...args) => warnings.push(args.join(' '))

    try {
      const options = {
        componentId: 'error-prod-comp',
        getters: {
          async failing () {
            throw new Error('Prod failure')
          }
        }
      }

      const tag = 'error-prod-' + Math.random().toString(36).slice(2, 8)
      const CompClass = createCoraliteClass(options)
      customElements.define(tag, CompClass)

      const el = document.createElement(tag)
      document.body.appendChild(el)

      const _init = el._state.failing
      await new Promise(r => setTimeout(r, 20))

      assert.ok(warnings.some(w => w.includes('failing') && w.includes('Prod failure')))
      assert.strictEqual(el._state.failing, undefined)
    } finally {
      console.warn = origWarn
    }
  })

  it('state.<asyncGetterKey> = value throws CoraliteError in development mode', () => {
    window.__coralite__.mode = 'development'

    const options = {
      componentId: 'write-dev-comp',
      getters: {
        async gVal () {
          return 'g'
        }
      }
    }

    const tag = 'write-dev-' + Math.random().toString(36).slice(2, 8)
    const CompClass = createCoraliteClass(options)
    customElements.define(tag, CompClass)

    const el = document.createElement(tag)
    document.body.appendChild(el)

    assert.throws(() => {
      el._state.gVal = 'new-value'
    }, (err) => {
      return err instanceof CoraliteError && err.message.includes('read-only')
    })
  })

  it('state.<asyncGetterKey> = value is silent no-op in production mode', () => {
    window.__coralite__.mode = 'production'

    const options = {
      componentId: 'write-prod-comp',
      getters: {
        async gVal () {
          return 'g'
        }
      }
    }

    const tag = 'write-prod-' + Math.random().toString(36).slice(2, 8)
    const CompClass = createCoraliteClass(options)
    customElements.define(tag, CompClass)

    const el = document.createElement(tag)
    document.body.appendChild(el)

    assert.doesNotThrow(() => {
      el._state.gVal = 'new-value'
    })
  })

  it('fallback pattern (sibling sync getter) resolves preview on server and cached value on client', async () => {
    const options = {
      componentId: 'fallback-pattern-comp',
      defaultValues: { source: 'Coralite Codebase' },
      getters: {
        renderedBody: async ({ state }) => {
          await new Promise(r => setTimeout(r, 20))
          return state.source.toUpperCase()
        },
        bodyText: ({ state }) => {
          return state.renderedBody === undefined
            ? state.source.slice(0, 8)
            : state.renderedBody
        }
      }
    }

    const tag = 'fallback-pattern-' + Math.random().toString(36).slice(2, 8)
    const CompClass = createCoraliteClass(options)
    customElements.define(tag, CompClass)

    const el = document.createElement(tag)
    document.body.appendChild(el)

    // Before async getter resolves, bodyText returns fallback preview
    assert.strictEqual(el._state.bodyText, 'Coralite')

    // Wait for async getter to resolve
    await new Promise(r => setTimeout(r, 40))

    // After async getter resolves, bodyText returns resolved upper-case string
    assert.strictEqual(el._state.bodyText, 'CORALITE CODEBASE')
  })

  it('two sync getters reading same async getter both see resolved value', async () => {
    const options = {
      componentId: 'two-sync-getters-comp',
      defaultValues: { val: 'hello' },
      getters: {
        async uppercase ({ state }) {
          await new Promise(r => setTimeout(r, 20))
          return state.val.toUpperCase()
        },
        syncOne ({ state }) {
          return state.uppercase ? `One: ${state.uppercase}` : 'One: pending'
        },
        syncTwo ({ state }) {
          return state.uppercase ? `Two: ${state.uppercase}` : 'Two: pending'
        }
      }
    }

    const tag = 'two-sync-getters-' + Math.random().toString(36).slice(2, 8)
    const CompClass = createCoraliteClass(options)
    customElements.define(tag, CompClass)

    const el = document.createElement(tag)
    document.body.appendChild(el)

    assert.strictEqual(el._state.syncOne, 'One: pending')
    assert.strictEqual(el._state.syncTwo, 'Two: pending')

    await new Promise(r => setTimeout(r, 40))

    assert.strictEqual(el._state.syncOne, 'One: HELLO')
    assert.strictEqual(el._state.syncTwo, 'Two: HELLO')
  })

  it('sync getter returns server preview before async resolves, resolved value after', async () => {
    const options = {
      componentId: 'preview-transition-comp',
      defaultValues: { title: 'Coralite Framework' },
      getters: {
        async fetchedTitle ({ state }) {
          await new Promise(r => setTimeout(r, 20))
          return state.title.toUpperCase()
        },
        displayTitle ({ state }) {
          return state.fetchedTitle ?? state.title.slice(0, 8)
        }
      }
    }

    const tag = 'preview-transition-' + Math.random().toString(36).slice(2, 8)
    const CompClass = createCoraliteClass(options)
    customElements.define(tag, CompClass)

    const el = document.createElement(tag)
    document.body.appendChild(el)

    // Intermediate state check before resolution: fallback preview
    assert.strictEqual(el._state.displayTitle, 'Coralite')

    await new Promise(r => setTimeout(r, 40))

    // Final state check after resolution: resolved value
    assert.strictEqual(el._state.displayTitle, 'CORALITE FRAMEWORK')
  })
})
