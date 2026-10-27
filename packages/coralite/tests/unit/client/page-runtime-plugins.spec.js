import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert'
import { setupPageRuntime } from '../../../lib/client/page-runtime.js'

describe('setupPageRuntime plugin context injection', () => {
  let originalWindow
  let originalDocument

  beforeEach(() => {
    originalWindow = globalThis.window
    originalDocument = globalThis.document

    globalThis.window = {
      location: { pathname: '/test' },
      CustomEvent: class CustomEvent {
        constructor (type, options = {}) {
          this.type = type
          this.detail = options.detail
        }
      }
    }

    globalThis.document = {
      documentElement: {
        style: {
          setProperty () {
          },
          removeProperty () {
          }
        },
        querySelector () {
          return null
        },
        dispatchEvent () {
          return true
        }
      }
    }
  })

  afterEach(() => {
    globalThis.window = originalWindow
    globalThis.document = originalDocument
  })

  it('page client receives router when globally available', async () => {
    const mockRouter = {
      beforeEach () {
      },
      navigate () {
      }
    }
    globalThis.window.__coralite_router__ = mockRouter

    let receivedCtx = null
    const pageConfig = {
      client (ctx) {
        receivedCtx = ctx
      }
    }

    await setupPageRuntime(pageConfig)

    assert.ok(receivedCtx, 'Context should be passed to client()')
    assert.strictEqual(receivedCtx.router, mockRouter, 'router should match window.__coralite_router__')
  })

  it('page client context does not throw when router is undefined', async () => {
    let receivedCtx = null
    const pageConfig = {
      client (ctx) {
        receivedCtx = ctx
      }
    }

    await setupPageRuntime(pageConfig)

    assert.ok(receivedCtx, 'Context should be passed to client()')
    assert.strictEqual(receivedCtx.router, undefined, 'router should be undefined when window.__coralite_router__ is absent')
  })

  it('page client receives plugin contexts', async () => {
    const mockPlugins = {
      customPlugin: { active: true },
      analytics: {
        track () {
        }
      }
    }
    globalThis.window.__coralite_plugins__ = mockPlugins

    let receivedCtx = null
    const pageConfig = {
      client (ctx) {
        receivedCtx = ctx
      }
    }

    await setupPageRuntime(pageConfig)

    assert.ok(receivedCtx, 'Context should be passed to client()')
    assert.strictEqual(receivedCtx.customPlugin, mockPlugins.customPlugin, 'customPlugin should be merged into context')
    assert.strictEqual(receivedCtx.analytics, mockPlugins.analytics, 'analytics should be merged into context')
  })
})
