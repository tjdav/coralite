import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createCoraliteElement, createVirtualWindow } from '../../../lib/utils/server/index.js'
import { cloneNode, isServer, isClient } from '../../../lib/utils/core.js'
import { evaluateProduction } from '../../../lib/compiler.js'

describe('Server-Client DOM Parity Hardening', () => {
  describe('Export Contract (isServer / isClient)', () => {
    it('exports isServer as true and isClient as false in Node environment', () => {
      assert.equal(isServer, true)
      assert.equal(isClient, false)
      assert.equal(typeof window, 'undefined')
    })
  })

  describe('Production Sandbox Isolation', () => {
    it('does not mutate globalThis.window or globalThis.document during evaluateProduction', async () => {
      assert.equal(globalThis.window, undefined)
      assert.equal(globalThis.document, undefined)

      const moduleMock = {
        id: 'test-mod',
        script: 'const { isServer, isClient, window, document } = require("coralite"); module.exports.default = { isServer, isClient, hasWin: !!window, hasDoc: !!document };',
        lineOffset: 0
      }

      const getComponent = () => ({
        path: { pathname: '/fake/path.js' },
        result: {}
      })

      const res = await evaluateProduction({
        module: moduleMock,
        state: {},
        page: {},
        root: null,
        contextId: 'test-id',
        session: { source: { contextInstances: {} } },
        noHydration: false,
        app: {},
        source: { plugins: [], utils: {} },
        bindPlugins: async () => ({}),
        defineComponent: (opts) => opts,
        createExecutionError: (err) => err,
        getComponent
      })

      assert.equal(globalThis.window, undefined)
      assert.equal(globalThis.document, undefined)
      assert.deepEqual(res, {
        isServer: true,
        isClient: false,
        hasWin: true,
        hasDoc: true
      })
    })
  })

  describe('Non-enumerable Proxies & cloneNode Sanitization', () => {
    it('keeps style, dataset, and listener proxies non-enumerable on element', () => {
      const el = createCoraliteElement({ type: 'tag', name: 'div' })
      el.style.color = 'red'
      el.dataset.foo = 'bar'
      el.addEventListener('click', () => {})

      const symKeys = Object.getOwnPropertySymbols(el)
      for (const sym of symKeys) {
        const desc = Object.getOwnPropertyDescriptor(el, sym)
        if (['styleProxy', 'datasetProxy', 'listeners'].includes(sym.description)) {
          assert.equal(desc.enumerable, false)
        }
      }
    })

    it('sanitizes proxy symbol caches during cloneNode', () => {
      const el = createCoraliteElement({ type: 'tag', name: 'div' })
      el.style.color = 'red'
      el.dataset.foo = 'bar'

      const nodeMap = new Map()
      const cloned = cloneNode(nodeMap, el, null)

      cloned.style.color = 'blue'
      cloned.dataset.foo = 'baz'

      assert.equal(el.style.color, 'red')
      assert.equal(el.dataset.foo, 'bar')
      assert.equal(cloned.style.color, 'blue')
      assert.equal(cloned.dataset.foo, 'baz')
    })
  })

  describe('B4: Exact getElementById & Fail-Loud Selectors', () => {
    it('matches exact ID with dots via getElementById', () => {
      const parent = createCoraliteElement({ type: 'tag', name: 'div' })
      const child = createCoraliteElement({ type: 'tag', name: 'span', attribs: { id: 'a.b.c' } })
      parent.appendChild(child)

      assert.equal(parent.getElementById('a.b.c'), child)
    })

    it('throws CoraliteError on unsupported combinators or pseudo-classes in server queries', () => {
      const el = createCoraliteElement({ type: 'tag', name: 'div' })
      const child = createCoraliteElement({ type: 'tag', name: 'span' })
      el.appendChild(child)

      assert.throws(() => el.querySelector('div > span'), /Unsupported CSS selector/)
      assert.throws(() => el.querySelector('div + span'), /Unsupported CSS selector/)
      assert.throws(() => el.querySelector('div ~ span'), /Unsupported CSS selector/)
      assert.throws(() => el.matches(':first-child'), /Unsupported CSS selector/)
    })

    it('supports valid tag, class, ID, compound, and descendant selectors', () => {
      const parent = createCoraliteElement({ type: 'tag', name: 'div', attribs: { class: 'container' } })
      const child = createCoraliteElement({ type: 'tag', name: 'span', attribs: { id: 'sub', 'data-active': 'true' } })
      parent.appendChild(child)

      assert.equal(parent.querySelector('span#sub[data-active=true]'), child)
      assert.equal(parent.querySelector('.container span'), child)
    })
  })

  describe('M1–M4 Surface Alignment', () => {
    it('virtual location and document.title reflect context page properties', () => {
      const context = {
        page: {
          url: { pathname: '/about', href: 'http://localhost/about' },
          meta: { title: 'About Us' }
        }
      }

      const win = createVirtualWindow(context)
      assert.equal(win.location.pathname, '/about')
      assert.equal(win.document.title, 'About Us')

      win.document.title = 'New Title'
      assert.equal(context.page.meta.title, 'New Title')
    })

    it('virtual document and window provide EventTarget interface', () => {
      const win = createVirtualWindow({})
      let winCount = 0
      let docCount = 0

      const fnWin = () => { winCount++ }
      const fnDoc = () => { docCount++ }

      win.addEventListener('custom', fnWin)
      win.document.addEventListener('custom', fnDoc)

      win.dispatchEvent({ type: 'custom' })
      win.document.dispatchEvent({ type: 'custom' })

      assert.equal(winCount, 1)
      assert.equal(docCount, 1)

      win.removeEventListener('custom', fnWin)
      win.dispatchEvent({ type: 'custom' })
      assert.equal(winCount, 1)
    })

    it('dispatchEvent resets currentTarget to null after execution', () => {
      const parent = createCoraliteElement({ type: 'tag', name: 'div' })
      const child = createCoraliteElement({ type: 'tag', name: 'span' })
      parent.appendChild(child)

      let capturedCurrentTarget = null
      child.addEventListener('click', (e) => {
        capturedCurrentTarget = e.currentTarget
      })

      const evt = { type: 'click', bubbles: true }
      child.dispatchEvent(evt)

      assert.equal(capturedCurrentTarget, child)
      assert.equal(evt.currentTarget, null)
    })
  })
})
