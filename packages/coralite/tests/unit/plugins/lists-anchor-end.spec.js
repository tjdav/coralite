import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createStore } from '../../../plugins/lists/store.js'
import { bind } from '../../../plugins/lists/bind.js'

function createMockContainer (height = 300) {
  const children = []
  let scrollTopVal = 0

  const container = {
    clientHeight: height,
    style: {},
    get scrollTop () {
      return scrollTopVal
    },
    set scrollTop (val) {
      scrollTopVal = val
    },
    get scrollHeight () {
      return children.length * 50
    },
    replaceChildren (...nodes) {
      children.length = 0
      children.push(...nodes)
    },
    appendChild (node) {
      children.push(node)
    },
    insertBefore (node, refNode) {
      const idx = children.indexOf(refNode)
      if (idx !== -1) {
        children.splice(idx, 0, node)
      } else {
        children.push(node)
      }
    },
    removeChild (node) {
      const idx = children.indexOf(node)
      if (idx !== -1) {
        children.splice(idx, 1)
      }
    },
    addEventListener () {
    },
    removeEventListener () {
    },
    scrollTo (opts) {
      if (opts && typeof opts.top === 'number') {
        scrollTopVal = opts.top
      }
    },
    _children: children
  }

  return container
}

describe('lists - anchorTo: "end" & followOnAppend', () => {
  let store

  beforeEach(() => {
    store = createStore({
      key: (item) => item.id,
      initial: [
        {
          id: '1',
          text: 'Msg 1'
        },
        {
          id: '2',
          text: 'Msg 2'
        },
        {
          id: '3',
          text: 'Msg 3'
        },
        {
          id: '4',
          text: 'Msg 4'
        },
        {
          id: '5',
          text: 'Msg 5'
        },
        {
          id: '6',
          text: 'Msg 6'
        },
        {
          id: '7',
          text: 'Msg 7'
        },
        {
          id: '8',
          text: 'Msg 8'
        },
        {
          id: '9',
          text: 'Msg 9'
        },
        {
          id: '10',
          text: 'Msg 10'
        }
      ]
    })
  })

  it('positions initial scroll at the bottom when anchorTo: "end"', () => {
    const container = createMockContainer(200)
    const handle = bind({
      container,
      store,
      key: (item) => item.id,
      create: (item) => ({
        id: item.id,
        style: {}
      }),
      virtual: 'window',
      size: 50,
      anchorTo: 'end'
    })

    // 10 items * 50px = 500px total height. Viewport 200px. Max scroll = 300px.
    assert.equal(container.scrollTop, 300)
    const anchor = handle.getAnchor()
    assert.notEqual(anchor, null)
    assert.equal(anchor.key, '10')

    handle.destroy()
  })

  it('followOnAppend: false does not move view on append', () => {
    const container = createMockContainer(200)
    const handle = bind({
      container,
      store,
      key: (item) => item.id,
      create: (item) => ({
        id: item.id,
        style: {}
      }),
      virtual: 'window',
      size: 50,
      anchorTo: 'end',
      followOnAppend: false
    })

    const prevScrollTop = container.scrollTop
    store.append({
      id: '11',
      text: 'Msg 11'
    })

    assert.equal(container.scrollTop, prevScrollTop)
    handle.destroy()
  })

  it('followOnAppend: true pins to bottom when user is at the bottom', () => {
    const container = createMockContainer(200)
    const handle = bind({
      container,
      store,
      key: (item) => item.id,
      create: (item) => ({
        id: item.id,
        style: {}
      }),
      virtual: 'window',
      size: 50,
      anchorTo: 'end',
      followOnAppend: true,
      scrollEndThreshold: 80
    })

    // Initially at 300px. Append item 11 (new max scroll = 350px).
    store.append({
      id: '11',
      text: 'Msg 11'
    })
    assert.equal(container.scrollTop, 350)

    handle.destroy()
  })

  it('followOnAppend: true does not move view when user has scrolled up', () => {
    const container = createMockContainer(200)
    const handle = bind({
      container,
      store,
      key: (item) => item.id,
      create: (item) => ({
        id: item.id,
        style: {}
      }),
      virtual: 'window',
      size: 50,
      anchorTo: 'end',
      followOnAppend: true,
      scrollEndThreshold: 50
    })

    // User scrolls up to 100px (200px away from bottom 300px, which is > threshold 50)
    container.scrollTop = 100
    store.append({
      id: '11',
      text: 'Msg 11'
    })

    assert.equal(container.scrollTop, 100)
    handle.destroy()
  })

  it('followOnAppend: "smooth" calls scrollTo with behavior "smooth"', () => {
    const container = createMockContainer(200)
    let scrollToOpts = null
    container.scrollTo = (opts) => {
      scrollToOpts = opts
      container.scrollTop = opts.top
    }

    const handle = bind({
      container,
      store,
      key: (item) => item.id,
      create: (item) => ({
        id: item.id,
        style: {}
      }),
      virtual: 'window',
      size: 50,
      anchorTo: 'end',
      followOnAppend: 'smooth'
    })

    store.append({
      id: '11',
      text: 'Msg 11'
    })
    assert.notEqual(scrollToOpts, null)
    assert.equal(scrollToOpts.behavior, 'smooth')
    assert.equal(scrollToOpts.top, 350)

    handle.destroy()
  })

  it('logs dev warning if followOnAppend is set with anchorTo: "start"', () => {
    const warnings = []
    const origWarn = console.warn
    console.warn = (...args) => warnings.push(args.join(' '))

    const container = createMockContainer(200)
    const handle = bind({
      container,
      store,
      key: (item) => item.id,
      create: (item) => ({
        id: item.id,
        style: {}
      }),
      virtual: 'window',
      size: 50,
      anchorTo: 'start',
      followOnAppend: true
    })

    console.warn = origWarn
    assert.ok(warnings.some((w) => w.includes('followOnAppend is only meaningful when anchorTo is "end"')))
    handle.destroy()
  })
})
