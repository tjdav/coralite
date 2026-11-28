import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { listsPlugin } from '../../../plugins/lists.js'

describe('lists.createStore', () => {
  let createStore

  before(async () => {
    const phase1 = await listsPlugin.client.context({})
    ;({ createStore } = phase1({}))
  })

  it('keeps all() as a defensive copy', async () => {
    const store = createStore({ initial: [{ id: 1 }, { id: 2 }] })
    const snapshot = store.all()
    snapshot.pop()
    assert.equal(store.all().length, 2)
  })

  it('updates, removes and swaps items by key', () => {
    const store = createStore({
      initial: [{
        id: 1,
        label: 'a'
      }, {
        id: 2,
        label: 'b'
      }]
    })

    store.update(1, { label: 'A' })
    assert.deepEqual(store.all().map(item => item.label), ['A', 'b'])

    store.update(2, item => ({
      ...item,
      label: 'B'
    }))
    assert.deepEqual(store.all().map(item => item.label), ['A', 'B'])

    assert.equal(store.swap(1, 2), true)
    assert.deepEqual(store.all().map(item => item.id), [2, 1])

    assert.equal(store.remove(1), true)
    assert.deepEqual(store.all().map(item => item.id), [2])
  })

  it('replaces an existing key when the same item is appended again', () => {
    const store = createStore({
      initial: [{
        id: 1,
        label: 'old'
      }]
    })
    store.append({
      id: 1,
      label: 'new'
    })
    assert.deepEqual(store.all(), [{
      id: 1,
      label: 'new'
    }])
  })
})
