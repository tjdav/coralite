/* eslint-disable no-restricted-imports -- Node test runner spec; requires node:* builtins */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { generateClientRuntime } from '../../../../lib/client/utils/runtime.js'

describe('runtime.loadComponent & runtime.upgrade', () => {
  it('should expose loadComponent and upgrade on window.__coralite__', () => {
    const fnCode = generateClientRuntime({
      base: '/',
      sharedChunkPath: 'chunk.js',
      declarativeTags: []
    })

    assert.ok(fnCode.includes('window.__coralite__.loadComponent = loadComponent;'), 'loadComponent should be attached to window.__coralite__')
    assert.ok(fnCode.includes('window.__coralite__.upgrade = upgrade;'), 'upgrade should be attached to window.__coralite__')
  })

  it('runtime.loadComponent should resolve immediately for unknown tags and already defined tags', async () => {
    let definedTag = null
    const windowMock = {
      location: { pathname: '/' },
      __coralite__: {}
    }

    const customElementsMock = {
      get (id) {
        return id === 'already-defined' ? class {
        } : undefined
      },
      define (id) {
        definedTag = id
      }
    }

    const componentManifestMock = {
      'known-tag': {
        js: 'known-tag.js',
        css: 'known-tag.css'
      }
    }

    const origWindow = globalThis.window
    const origCustomElements = globalThis.customElements
    const origDoc = globalThis.document
    const origElement = globalThis.Element

    class MockElement {
    }
    class MockHTMLElement extends MockElement {
    }

    globalThis.window = windowMock
    globalThis.customElements = customElementsMock
    globalThis.Element = MockElement
    globalThis.HTMLElement = MockHTMLElement
    globalThis.document = {
      querySelector () {
        return null
      },
      createElement () {
        return {
          rel: '',
          href: ''
        }
      },
      head: {
        appendChild () {
        }
      },
      querySelectorAll () {
        return []
      },
      documentElement: {
        setAttribute () {
        }
      }
    }

    const rawRuntimeCode = generateClientRuntime({
      base: '/',
      sharedChunkPath: 'shared.js',
      declarativeTags: [],
      mode: 'development'
    })

    const executableCode = rawRuntimeCode.replace(/import\(([^)]+)\)/g, (match, path) => {
      if (path.includes('manifest.js')) {
        return `Promise.resolve({ default: ${JSON.stringify(componentManifestMock)} })`
      }
      if (path.includes('shared.js')) {
        return 'Promise.resolve({ getClientContext: () => ({}), createCoraliteClass: () => class extends HTMLElement {}, globalClientHooks: {}, setupDevTools: () => {}, registerDevToolsComponent: () => {} })'
      }
      return 'Promise.resolve({ default: { componentId: "known-tag" } })'
    })

    try {
      const fn = new Function(executableCode)
      fn()

      await new Promise(r => setTimeout(r, 50))

      const loadComponent = windowMock.__coralite__.loadComponent

      // 1. Unknown tag resolves without error
      await loadComponent('unknown-tag')
      assert.equal(definedTag, null)

      // 2. Known tag loads module and registers element
      await loadComponent('known-tag')
      assert.equal(definedTag, 'known-tag')

      // 3. Already defined tag resolves immediately
      await loadComponent('already-defined')
    } finally {
      globalThis.window = origWindow
      globalThis.customElements = origCustomElements
      globalThis.document = origDoc
      globalThis.Element = origElement
      delete globalThis.HTMLElement
    }
  })

  it('runtime.upgrade should walk subtree, load missing component modules, inject CSS, call customElements.upgrade and await updateComplete', async () => {
    const upgradedRoots = []
    const injectedStyles = []

    const componentManifestMock = {
      'card-comp': {
        js: 'card.js',
        css: 'card.css'
      }
    }

    const windowMock = {
      location: { pathname: '/' },
      __coralite__: {},
      __coralite_styles_loaded__: new Set()
    }

    const customElementsMock = {
      _defined: new Set(),
      get (tag) {
        return this._defined.has(tag) ? class {
        } : undefined
      },
      define (id) {
        this._defined.add(id)
      },
      upgrade (el) {
        upgradedRoots.push(el)
        if (el.tagName && el.tagName.toLowerCase() === 'card-comp') {
          el.updateComplete = Promise.resolve(true)
        }
      }
    }

    const docMock = {
      querySelector (sel) {
        if (sel.includes('card.css') && injectedStyles.includes('/assets/css/card.css')) {
          return {}
        }
        return null
      },
      createElement () {
        return {
          rel: '',
          href: ''
        }
      },
      head: {
        appendChild (node) {
          if (node.href) {
            injectedStyles.push(node.href)
          }
        }
      },
      querySelectorAll () {
        return []
      },
      documentElement: {
        setAttribute () {
        }
      }
    }

    const origWindow = globalThis.window
    const origCustomElements = globalThis.customElements
    const origDoc = globalThis.document
    const origElement = globalThis.Element

    class MockElement {
    }
    class MockHTMLElement extends MockElement {
    }

    globalThis.window = windowMock
    globalThis.customElements = customElementsMock
    globalThis.document = docMock
    globalThis.Element = MockElement
    globalThis.HTMLElement = MockHTMLElement

    const rawRuntimeCode = generateClientRuntime({
      base: '/',
      sharedChunkPath: 'shared.js',
      declarativeTags: [],
      mode: 'development'
    })

    const executableCode = rawRuntimeCode.replace(/import\(([^)]+)\)/g, (match, path) => {
      if (path.includes('manifest.js')) {
        return `Promise.resolve({ default: ${JSON.stringify(componentManifestMock)} })`
      }
      if (path.includes('shared.js')) {
        return 'Promise.resolve({ getClientContext: () => ({}), createCoraliteClass: () => class extends HTMLElement {}, globalClientHooks: {}, setupDevTools: () => {}, registerDevToolsComponent: () => {} })'
      }
      return 'Promise.resolve({ default: { componentId: "card-comp" } })'
    })

    try {
      const fn = new Function(executableCode)
      fn()

      await new Promise(r => setTimeout(r, 50))

      const upgrade = windowMock.__coralite__.upgrade

      const cardEl = {
        nodeType: 1,
        tagName: 'CARD-COMP',
        querySelectorAll: () => []
      }
      const rootEl = {
        nodeType: 1,
        tagName: 'DIV',
        querySelectorAll: () => [cardEl]
      }

      // First upgrade call
      await upgrade(rootEl)

      assert.ok(injectedStyles.some(s => s.includes('card.css')), 'CSS should be injected')
      assert.ok(upgradedRoots.includes(cardEl), 'cardEl should be upgraded')

      // Second upgrade call for already loaded component (idempotent)
      await upgrade(rootEl)

      // Null root or element with no custom elements
      await upgrade(null)
      await upgrade({
        nodeType: 1,
        tagName: 'DIV',
        querySelectorAll: () => []
      })
    } finally {
      globalThis.window = origWindow
      globalThis.customElements = origCustomElements
      globalThis.document = origDoc
      globalThis.Element = origElement
      delete globalThis.HTMLElement
    }
  })

  it('runtime.upgrade should handle load errors by aggregating and rejecting with the first error', async () => {
    const componentManifestMock = {
      'good-comp': { js: 'good.js' },
      'bad-comp': { js: 'bad.js' }
    }

    const windowMock = {
      location: { pathname: '/' },
      __coralite__: {}
    }

    const customElementsMock = {
      get () {
        return undefined
      },
      define () {
      },
      upgrade () {
      }
    }

    const docMock = {
      querySelector () {
        return null
      },
      createElement () {
        return {
          rel: '',
          href: ''
        }
      },
      head: {
        appendChild () {
        }
      },
      querySelectorAll () {
        return []
      },
      documentElement: {
        setAttribute () {
        }
      }
    }

    const origWindow = globalThis.window
    const origCustomElements = globalThis.customElements
    const origDoc = globalThis.document
    const origElement = globalThis.Element

    class MockElement {
    }
    class MockHTMLElement extends MockElement {
    }

    globalThis.window = windowMock
    globalThis.customElements = customElementsMock
    globalThis.document = docMock
    globalThis.Element = MockElement
    globalThis.HTMLElement = MockHTMLElement

    const rawRuntimeCode = generateClientRuntime({
      base: '/',
      sharedChunkPath: 'shared.js',
      declarativeTags: [],
      mode: 'development'
    })

    windowMock.__mockImport = (path) => {
      if (path.includes('bad.js')) {
        return Promise.reject(new Error('Failed to load bad.js'))
      }
      return Promise.resolve({ default: { componentId: 'good-comp' } })
    }

    const executableCode = rawRuntimeCode.replace(/import\(([^)]+)\)/g, (match, path) => {
      if (path.includes('manifest.js')) {
        return `Promise.resolve({ default: ${JSON.stringify(componentManifestMock)} })`
      }
      if (path.includes('shared.js')) {
        return 'Promise.resolve({ getClientContext: () => ({}), createCoraliteClass: () => class extends HTMLElement {}, globalClientHooks: {}, setupDevTools: () => {}, registerDevToolsComponent: () => {} })'
      }
      return `window.__mockImport(${path})`
    })

    try {
      const fn = new Function(executableCode)
      fn()

      await new Promise(r => setTimeout(r, 50))

      const upgrade = windowMock.__coralite__.upgrade

      const rootEl = {
        nodeType: 1,
        tagName: 'DIV',
        querySelectorAll: () => [
          {
            nodeType: 1,
            tagName: 'GOOD-COMP'
          },
          {
            nodeType: 1,
            tagName: 'BAD-COMP'
          }
        ]
      }

      await assert.rejects(
        async () => {
          await upgrade(rootEl)
        },
        {
          message: 'Failed to load bad.js'
        }
      )
    } finally {
      globalThis.window = origWindow
      globalThis.customElements = origCustomElements
      globalThis.document = origDoc
      globalThis.Element = origElement
      delete globalThis.HTMLElement
    }
  })
})
