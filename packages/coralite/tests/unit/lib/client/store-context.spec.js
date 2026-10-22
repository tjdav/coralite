/* eslint-disable no-restricted-imports -- Node test runner spec; requires node:* builtins */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createStore, createServerStore } from '../../../../lib/utils/store.js'

describe('Store Context Wiring', () => {
  it('server context receives read-only store snapshot that throws on mutation', () => {
    const store = createServerStore({
      theme: 'light',
      user: null
    })
    assert.equal(store.theme, 'light')
    assert.throws(() => {
      store.theme = 'dark'
    }, /Cannot mutate store on the server/)
  })

  it('getters context receives reactive store', () => {
    const store = createStore({
      theme: 'light',
      user: 'Alice'
    })
    const gettersCtx = { store }
    const greeting = ({ store: s }) => (s.user ? `Hello ${s.user}` : 'Guest')

    assert.equal(greeting(gettersCtx), 'Hello Alice')
    store.user = 'Bob'
    assert.equal(greeting(gettersCtx), 'Hello Bob')
  })

  it('client context receives reactive store and can mutate it', () => {
    const store = createStore({
      theme: 'light',
      count: 0
    })
    const clientCtx = { store }

    assert.equal(clientCtx.store.theme, 'light')
    clientCtx.store.theme = 'dark'
    assert.equal(store.theme, 'dark')
  })

  it('when store is not declared in config, store in context is undefined', () => {
    const context = { store: undefined }
    assert.equal(context.store, undefined)
  })
})
