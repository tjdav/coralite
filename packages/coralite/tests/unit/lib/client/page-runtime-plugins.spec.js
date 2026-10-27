/* eslint-disable no-restricted-imports -- Node test runner spec; requires node:* builtins */
import '../../setup.js'
import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { setupPageRuntime } from '#lib/client/page-runtime.js'

describe('setupPageRuntime plugin contexts', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    /** @type {any} */
    const win = window
    delete win.__coralite_router__
  })

  it('page client receives router context when active', async () => {
    const mockRouter = {
      navigate: () => {},
      current: () => ({ path: '/' }),
      beforeEach: () => {}
    }

    /** @type {any} */
    const win = window
    win.__coralite_router__ = mockRouter

    let receivedCtx = null

    await setupPageRuntime({
      client ({ router, state }) {
        receivedCtx = { router, state }
      }
    })

    assert.ok(receivedCtx, 'client controller executed')
    assert.strictEqual(receivedCtx.router, mockRouter, 'router context was injected')
  })

  it('page client does not throw when router context absent', async () => {
    /** @type {any} */
    const win = window
    delete win.__coralite_router__

    let receivedRouter = 'NOT_CALLED'

    await setupPageRuntime({
      client ({ router }) {
        receivedRouter = router
      }
    })

    assert.strictEqual(receivedRouter, undefined, 'router context is undefined when absent')
  })
})
