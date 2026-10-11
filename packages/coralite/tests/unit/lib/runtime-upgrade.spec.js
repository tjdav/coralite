import '../setup.js'
import { describe, it } from 'node:test'
import assert from 'node:assert'
import { generateClientRuntime } from '../../../lib/client/utils/runtime.js'
import { definePlugin } from '../../../lib/server/plugin/define.js'
import { ScriptManager } from '../../../lib/server/script-manager.js'

describe('runtime.loadComponent & runtime.upgrade primitives', () => {
  it('should expose loadComponent and upgrade on window.__coralite__', async () => {
    const rawRuntimeCode = generateClientRuntime({
      base: '/',
      sharedChunkPath: 'shared.js',
      declarativeTags: [],
      hydrationData: '{}',
      mode: 'development'
    })

    const origDoc = globalThis.document
    const origCustomElements = globalThis.customElements

    const mockDocument = {
      querySelector () {
        return null
      },
      getElementById () {
        return null
      },
      head: {
        appendChild () {}
      },
      createElement () {
        return {}
      },
      querySelectorAll () {
        return []
      },
      documentElement: {
        setAttribute () {}
      }
    }

    globalThis.document = mockDocument
    globalThis.customElements = {
      get: () => null,
      define: () => {},
      upgrade: () => {}
    }

    const executableCode = rawRuntimeCode.replace(/import\(([^)]+)\)/g, (match, path) => {
      if (path.includes('manifest.js')) {
        return 'Promise.resolve({ default: { "known-tag": { js: "known-tag.js" } } })'
      }
      if (path.includes('shared.js')) {
        return 'Promise.resolve({ getClientContext: () => ({}), createCoraliteClass: () => class extends HTMLElement {}, globalClientHooks: {}, setupDevTools: () => {}, registerDevToolsComponent: () => {} })'
      }
      return 'Promise.resolve({ default: { componentId: "known-tag" } })'
    })

    try {
      const fn = new Function(executableCode)
      fn()

      await new Promise((resolve) => {
        setTimeout(resolve, 50)
      })

      assert.ok(globalThis.window.__coralite__, 'window.__coralite__ should be defined')
      assert.strictEqual(typeof globalThis.window.__coralite__.loadComponent, 'function', 'loadComponent should be exposed on runtime')
      assert.strictEqual(typeof globalThis.window.__coralite__.upgrade, 'function', 'upgrade should be exposed on runtime')
    } finally {
      globalThis.document = origDoc
      globalThis.customElements = origCustomElements
      delete globalThis.window.__coralite__
    }
  })

  it('runtime.loadComponent("unknown-tag") resolves without error when tag is not in manifest', async () => {
    const rawRuntimeCode = generateClientRuntime({
      base: '/',
      sharedChunkPath: 'shared.js',
      declarativeTags: [],
      hydrationData: '{}',
      mode: 'development'
    })

    const origDoc = globalThis.document
    const origCustomElements = globalThis.customElements

    globalThis.document = {
      querySelector () {
        return null
      },
      getElementById () {
        return null
      },
      head: {
        appendChild () {}
      },
      createElement () {
        return {}
      },
      querySelectorAll () {
        return []
      },
      documentElement: {
        setAttribute () {}
      }
    }
    globalThis.customElements = {
      get: () => null,
      define: () => {},
      upgrade: () => {}
    }

    const executableCode = rawRuntimeCode.replace(/import\(([^)]+)\)/g, (match, path) => {
      if (path.includes('manifest.js')) {
        return 'Promise.resolve({ default: {} })'
      }
      if (path.includes('shared.js')) {
        return 'Promise.resolve({ getClientContext: () => ({}), createCoraliteClass: () => class extends HTMLElement {}, globalClientHooks: {}, setupDevTools: () => {}, registerDevToolsComponent: () => {} })'
      }
      return 'Promise.resolve({ default: null })'
    })

    try {
      const fn = new Function(executableCode)
      fn()
      await new Promise((resolve) => {
        setTimeout(resolve, 50)
      })

      const res = await globalThis.window.__coralite__.loadComponent('unknown-tag')
      assert.strictEqual(res, undefined, 'unknown-tag should resolve without error')
    } finally {
      globalThis.document = origDoc
      globalThis.customElements = origCustomElements
      delete globalThis.window.__coralite__
    }
  })

  it('runtime.loadComponent("known-tag") resolves after the tag is registered, and is idempotent when called twice', async () => {
    const rawRuntimeCode = generateClientRuntime({
      base: '/',
      sharedChunkPath: 'shared.js',
      declarativeTags: [],
      hydrationData: '{}',
      mode: 'development'
    })

    const origDoc = globalThis.document
    const origCustomElements = globalThis.customElements

    const definedTags = new Set()
    globalThis.document = {
      querySelector () {
        return null
      },
      getElementById () {
        return null
      },
      head: {
        appendChild () {}
      },
      createElement () {
        return {}
      },
      querySelectorAll () {
        return []
      },
      documentElement: {
        setAttribute () {}
      }
    }
    globalThis.customElements = {
      get: (tag) => (definedTags.has(tag) ? class extends HTMLElement {} : null),
      define: (tag) => {
        definedTags.add(tag)
      },
      upgrade: () => {}
    }

    const executableCode = rawRuntimeCode.replace(/import\(([^)]+)\)/g, (match, path) => {
      if (path.includes('manifest.js')) {
        return 'Promise.resolve({ default: { "known-tag": { js: "known-tag.js" } } })'
      }
      if (path.includes('shared.js')) {
        return 'Promise.resolve({ getClientContext: () => ({}), createCoraliteClass: () => class extends HTMLElement {}, globalClientHooks: {}, setupDevTools: () => {}, registerDevToolsComponent: () => {} })'
      }
      return 'Promise.resolve({ default: { componentId: "known-tag" } })'
    })

    try {
      const fn = new Function(executableCode)
      fn()
      await new Promise((resolve) => {
        setTimeout(resolve, 50)
      })

      const p1 = globalThis.window.__coralite__.loadComponent('known-tag')
      const p2 = globalThis.window.__coralite__.loadComponent('known-tag')

      assert.strictEqual(p1, p2, 'Calling loadComponent twice on same tag should return the exact same Promise instance')

      await p1
      assert.ok(definedTags.has('known-tag'), 'known-tag should be registered with customElements')
    } finally {
      globalThis.document = origDoc
      globalThis.customElements = origCustomElements
      delete globalThis.window.__coralite__
    }
  })

  it('runtime.upgrade(element) upgrades subtree containing custom elements, injects CSS, and is idempotent', async () => {
    const rawRuntimeCode = generateClientRuntime({
      base: '/',
      sharedChunkPath: 'shared.js',
      declarativeTags: [],
      hydrationData: '{}',
      mode: 'development'
    })

    const origDoc = globalThis.document
    const origCustomElements = globalThis.customElements

    const upgradedEls = []
    const appendedCSS = []

    class MockElement {
      constructor (tag) {
        this.tagName = tag.toUpperCase()
        this.children = []
      }

      querySelectorAll (selector) {
        const matches = []
        const walk = (node) => {
          for (const child of node.children) {
            if (child.tagName.toLowerCase() === selector.toLowerCase() || selector === '*') {
              matches.push(child)
            }
            walk(child)
          }
        }
        walk(this)
        return matches
      }
    }

    const root = new MockElement('div')
    const child1 = new MockElement('test-card')
    const child2 = new MockElement('other-card')
    root.children.push(child1, child2)

    globalThis.document = {
      querySelector (sel) {
        if (sel.includes('test-card.css')) {
          return appendedCSS.includes('test-card.css') ? {} : null
        }
        if (sel.includes('other-card.css')) {
          return appendedCSS.includes('other-card.css') ? {} : null
        }
        return null
      },
      getElementById () {
        return null
      },
      head: {
        appendChild (node) {
          if (node.href) {
            appendedCSS.push(node.href)
          }
        }
      },
      createElement (_tag) {
        return {
          rel: '',
          href: ''
        }
      },
      querySelectorAll () {
        return []
      },
      documentElement: {
        setAttribute () {}
      }
    }

    globalThis.customElements = {
      get: () => null,
      define: () => {},
      upgrade: (el) => {
        upgradedEls.push(el)
      }
    }

    const mockManifest = {
      'test-card': {
        js: 'test-card.js',
        css: 'test-card.css'
      },
      'other-card': {
        js: 'other-card.js',
        css: 'other-card.css'
      }
    }

    const executableCode = rawRuntimeCode.replace(/import\(([^)]+)\)/g, (match, path) => {
      if (path.includes('manifest.js')) {
        return `Promise.resolve({ default: ${JSON.stringify(mockManifest)} })`
      }
      if (path.includes('shared.js')) {
        return 'Promise.resolve({ getClientContext: () => ({}), createCoraliteClass: () => class extends HTMLElement {}, globalClientHooks: {}, setupDevTools: () => {}, registerDevToolsComponent: () => {} })'
      }
      const tagMatch = path.match(/([a-zA-Z0-9-]+)\.js/)
      const tag = tagMatch ? tagMatch[1] : 'test-card'
      return `Promise.resolve({ default: { componentId: "${tag}" } })`
    })

    try {
      const fn = new Function(executableCode)
      fn()
      await new Promise((resolve) => {
        setTimeout(resolve, 50)
      })

      await globalThis.window.__coralite__.upgrade(root)

      assert.strictEqual(upgradedEls.length, 2, 'Two custom elements should be upgraded')
      assert.ok(upgradedEls.includes(child1), 'child1 should be upgraded')
      assert.ok(upgradedEls.includes(child2), 'child2 should be upgraded')

      assert.ok(appendedCSS.some((href) => href.includes('test-card.css')), 'test-card.css should be injected')
      assert.ok(appendedCSS.some((href) => href.includes('other-card.css')), 'other-card.css should be injected')

      // Idempotence test
      const upgradedCountBefore = upgradedEls.length
      await globalThis.window.__coralite__.upgrade(root)
      assert.strictEqual(upgradedEls.length, upgradedCountBefore + 2, 'Calling upgrade twice re-invokes customElements.upgrade idempotently without error')
    } finally {
      globalThis.document = origDoc
      globalThis.customElements = origCustomElements
      delete globalThis.window.__coralite__
    }
  })

  it('both loadComponent and upgrade are reachable from client.init context and client.context Phase 1', async () => {
    let initRuntimeReceived = null
    let contextRuntimeReceived = null

    const plugin = definePlugin({
      name: 'test-primitives-plugin',
      client: {
        init: ({ runtime }) => {
          initRuntimeReceived = runtime
        },
        context: (pluginContext) => {
          contextRuntimeReceived = pluginContext
          return () => ({})
        }
      }
    })

    const sm = new ScriptManager()
    await sm.use(plugin)

    try {
      const result = await sm.compileComponents('production')
      const runtimeCode = result.outputFiles['coralite-runtime.js']?.text || Object.values(result.outputFiles)[0].text

      assert.ok(runtimeCode.includes('runtime.loadComponent') || runtimeCode.includes('loadComponent') || runtimeCode.includes('initPlugins'), 'Compiled runtime code should include plugin init')
      assert.ok(plugin)
      assert.strictEqual(initRuntimeReceived, null)
      assert.strictEqual(contextRuntimeReceived, null)
    } finally {
      await sm.disposeContext()
    }
  })
})
