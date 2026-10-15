import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createStore, createServerStore } from '../../../../lib/shared/store.js'
import { createComputed } from '../../../../lib/shared/signals.js'

describe('Global Store Runtime (createStore)', () => {
  it('reads initial default values', () => {
    const store = createStore({
      user: 'Alice',
      theme: 'light',
      count: 0
    })
    assert.equal(store.user, 'Alice')
    assert.equal(store.theme, 'light')
    assert.equal(store.count, 0)
  })

  it('updates values and notifies key subscriber', () => {
    const store = createStore({ theme: 'light' })
    const calls = []
    const dispose = store.subscribe('theme', (next, old) => {
      calls.push({
        next,
        old
      })
    })

    store.theme = 'dark'
    assert.equal(store.theme, 'dark')
    assert.equal(calls.length, 1)
    assert.deepEqual(calls[0], {
      next: 'dark',
      old: 'light'
    })

    dispose()
    store.theme = 'dim'
    assert.equal(calls.length, 1)
  })

  it('key subscriber does not fire on other key changes', () => {
    const store = createStore({
      theme: 'light',
      user: 'Alice'
    })
    let fired = false
    store.subscribe('theme', () => {
      fired = true
    })

    store.user = 'Bob'
    assert.equal(fired, false)
  })

  it('all-keys subscriber fires on any key change', () => {
    const store = createStore({
      theme: 'light',
      user: 'Alice'
    })
    const changes = []
    const dispose = store.subscribe((next, old) => {
      changes.push({
        next,
        old
      })
    })

    store.theme = 'dark'
    store.user = 'Bob'

    assert.equal(changes.length, 2)
    assert.deepEqual(changes[0], {
      next: 'dark',
      old: 'light'
    })
    assert.deepEqual(changes[1], {
      next: 'Bob',
      old: 'Alice'
    })

    dispose()
    store.theme = 'dim'
    assert.equal(changes.length, 2)
  })

  it('throws error when subscribing to unknown key', () => {
    const store = createStore({ theme: 'light' })
    assert.throws(
      () => store.subscribe('unknownKey', () => {
      }),
      /store\.subscribe: unknown key "unknownKey"/
    )
  })

  it('createComputed tracking store values re-evaluates when key changes', () => {
    const store = createStore({
      user: 'Alice',
      count: 1
    })
    const computed = createComputed(() => `${store.user} has ${store.count}`)

    assert.equal(computed.value, 'Alice has 1')
    store.count = 2
    assert.equal(computed.value, 'Alice has 2')
    store.user = 'Bob'
    assert.equal(computed.value, 'Bob has 2')
  })

  it('batch coalesces multiple writes and returns fn result', () => {
    const store = createStore({
      theme: 'light',
      count: 0
    })
    const calls = []
    store.subscribe('count', (next, old) => {
      calls.push({
        next,
        old
      })
    })

    const res = store.batch(() => {
      store.count = 1
      store.count = 2
      store.count = 3
      return 'done'
    })

    assert.equal(res, 'done')
    assert.equal(store.count, 3)
    assert.equal(calls.length, 1)
    assert.deepEqual(calls[0], {
      next: 3,
      old: 0
    })
  })

  it('reset restores all keys to defaults', () => {
    const store = createStore({
      theme: 'light',
      user: null
    })
    store.theme = 'dark'
    store.user = 'Alice'

    assert.equal(store.theme, 'dark')
    assert.equal(store.user, 'Alice')

    store.reset()

    assert.equal(store.theme, 'light')
    assert.equal(store.user, null)
  })

  it('createServerStore allows reads and throws CoraliteError on writes', () => {
    const serverStore = createServerStore({
      theme: 'light',
      user: 'Admin'
    })
    assert.equal(serverStore.theme, 'light')
    assert.equal(serverStore.user, 'Admin')

    assert.throws(
      () => {
        serverStore.theme = 'dark'
      },
      /Cannot mutate store on the server/
    )
  })
})
