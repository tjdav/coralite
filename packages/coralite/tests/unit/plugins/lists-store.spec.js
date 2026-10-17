import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createStore } from '../../../plugins/lists/store.js'
import { createEffect } from '../../../lib/shared/signals.js'

describe('lists plugin - createStore', () => {
  it('initializes with default options and initial items', () => {
    const store = createStore({
      key: (item) => item.id,
      initial: [
        {
          id: '1',
          title: 'First'
        },
        {
          id: '2',
          title: 'Second'
        }
      ]
    })

    assert.equal(store.size, 2)
    assert.deepEqual(store.all(), [
      {
        id: '1',
        title: 'First'
      },
      {
        id: '2',
        title: 'Second'
      }
    ])
    assert.deepEqual(store.get('1'), {
      id: '1',
      title: 'First'
    })
  })

  it('append adds item to end and notifies subscribers', () => {
    const store = createStore({ key: (i) => i.id })
    const events = []
    store.subscribe((event) => events.push(event))

    store.append({
      id: 'a',
      val: 10
    })
    store.append({
      id: 'b',
      val: 20
    })

    assert.equal(store.size, 2)
    assert.deepEqual(store.all(), [
      {
        id: 'a',
        val: 10
      },
      {
        id: 'b',
        val: 20
      }
    ])
    assert.deepEqual(events, [
      {
        type: 'append',
        items: [
          {
            id: 'a',
            val: 10
          }
        ]
      },
      {
        type: 'append',
        items: [
          {
            id: 'b',
            val: 20
          }
        ]
      }
    ])
  })

  it('prepend adds item to start and notifies subscribers', () => {
    const store = createStore({
      key: (i) => i.id,
      initial: [
        {
          id: '2',
          title: 'Two'
        }
      ]
    })
    const events = []
    store.subscribe((e) => events.push(e))

    store.prepend({
      id: '1',
      title: 'One'
    })

    assert.equal(store.size, 2)
    assert.deepEqual(store.all(), [
      {
        id: '1',
        title: 'One'
      },
      {
        id: '2',
        title: 'Two'
      }
    ])
    assert.deepEqual(events, [
      {
        type: 'prepend',
        items: [
          {
            id: '1',
            title: 'One'
          }
        ]
      }
    ])
  })

  it('appendMany and prependMany batch add items preserving order', () => {
    const store = createStore({ key: (i) => i.id })
    const events = []
    store.subscribe((e) => events.push(e))

    store.appendMany([
      {
        id: '2',
        val: 2
      },
      {
        id: '3',
        val: 3
      }
    ])

    store.prependMany([
      {
        id: '0',
        val: 0
      },
      {
        id: '1',
        val: 1
      }
    ])

    assert.deepEqual(store.all(), [
      {
        id: '0',
        val: 0
      },
      {
        id: '1',
        val: 1
      },
      {
        id: '2',
        val: 2
      },
      {
        id: '3',
        val: 3
      }
    ])
    assert.deepEqual(events, [
      {
        type: 'append',
        items: [
          {
            id: '2',
            val: 2
          },
          {
            id: '3',
            val: 3
          }
        ]
      },
      {
        type: 'prepend',
        items: [
          {
            id: '0',
            val: 0
          },
          {
            id: '1',
            val: 1
          }
        ]
      }
    ])
  })

  it('update merges patch by id and notifies subscribers', () => {
    const store = createStore({
      key: (i) => i.id,
      initial: [
        {
          id: 'x',
          title: 'Old Title',
          count: 1
        }
      ]
    })
    const events = []
    store.subscribe((e) => events.push(e))

    const updated = store.update('x', { title: 'New Title' })

    assert.deepEqual(updated, {
      id: 'x',
      title: 'New Title',
      count: 1
    })
    assert.deepEqual(store.get('x'), {
      id: 'x',
      title: 'New Title',
      count: 1
    })
    assert.deepEqual(events, [
      {
        type: 'update',
        id: 'x',
        patch: { title: 'New Title' }
      }
    ])

    // Update with function patch
    store.update('x', (item) => ({
      ...item,
      count: item.count + 1
    }))
    assert.equal(store.get('x').count, 2)
  })

  it('remove deletes item by id and notifies subscribers', () => {
    const store = createStore({
      key: (i) => i.id,
      initial: [
        {
          id: '1',
          v: 'a'
        },
        {
          id: '2',
          v: 'b'
        }
      ]
    })
    const events = []
    store.subscribe((e) => events.push(e))

    const removed = store.remove('1')
    assert.equal(removed, true)
    assert.equal(store.size, 1)
    assert.equal(store.get('1'), undefined)
    assert.deepEqual(events, [
      {
        type: 'remove',
        id: '1'
      }
    ])

    const nonExistent = store.remove('99')
    assert.equal(nonExistent, false)
  })

  it('set replaces all store items', () => {
    const store = createStore({
      key: (i) => i.id,
      initial: [{ id: '1' }]
    })
    const events = []
    store.subscribe((e) => events.push(e))

    store.set([
      {
        id: 'a',
        name: 'A'
      },
      {
        id: 'b',
        name: 'B'
      }
    ])

    assert.equal(store.size, 2)
    assert.deepEqual(store.all(), [
      {
        id: 'a',
        name: 'A'
      },
      {
        id: 'b',
        name: 'B'
      }
    ])
    assert.deepEqual(events, [
      {
        type: 'set',
        items: [
          {
            id: 'a',
            name: 'A'
          },
          {
            id: 'b',
            name: 'B'
          }
        ]
      }
    ])
  })

  it('clear empties the store and notifies subscribers', () => {
    const store = createStore({
      key: (i) => i.id,
      initial: [{ id: '1' }, { id: '2' }]
    })
    const events = []
    store.subscribe((e) => events.push(e))

    store.clear()
    assert.equal(store.size, 0)
    assert.deepEqual(store.all(), [])
    assert.deepEqual(events, [{ type: 'clear' }])

    // Secondary clear is a no-op
    store.clear()
    assert.equal(events.length, 1)
  })

  it('swap exchanges two items and notifies subscribers', () => {
    const store = createStore({
      initial: [
        {
          id: 1,
          label: 'a'
        },
        {
          id: 2,
          label: 'b'
        },
        {
          id: 3,
          label: 'c'
        }
      ]
    })
    const notifications = []
    store.subscribe((desc) => notifications.push(desc))

    const result = store.swap(1, 3)
    assert.strictEqual(result, true)
    assert.deepStrictEqual(
      store.all().map((it) => it.id),
      [3, 2, 1]
    )
    assert.strictEqual(notifications.length, 1)
    assert.deepStrictEqual(notifications[0], {
      type: 'swap',
      idA: 1,
      idB: 3
    })
  })

  it('provides signal reactivity on .all(), .get(), and .size', () => {
    const store = createStore({ key: (i) => i.id })

    let runCount = 0
    let lastSize = 0

    createEffect(() => {
      runCount++
      lastSize = store.size
    })

    assert.equal(runCount, 1)
    assert.equal(lastSize, 0)

    store.append({
      id: '1',
      title: 'Item 1'
    })
    assert.equal(runCount, 2)
    assert.equal(lastSize, 1)

    store.remove('1')
    assert.equal(runCount, 3)
    assert.equal(lastSize, 0)
  })

  it('allows string property for key configuration', () => {
    const store = createStore({
      key: 'uuid',
      initial: [
        {
          uuid: 'abc-123',
          name: 'Test'
        }
      ]
    })

    assert.deepEqual(store.get('abc-123'), {
      uuid: 'abc-123',
      name: 'Test'
    })
  })
})
