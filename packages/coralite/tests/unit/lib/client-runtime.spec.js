import { describe, it } from 'node:test'
import assert from 'node:assert'
import { generateClientRuntime } from '../../../lib/utils/client/runtime.js'

function getProcessHTML (mode) {
  const runtimeCode = generateClientRuntime({
    base: '/',
    sharedChunkPath: 'shared.js',
    declarativeTags: [],
    hydrationData: '{}',
    mode
  })

  // Extract window.processHTML definition
  const startIdx = runtimeCode.indexOf('window.processHTML = ')
  if (startIdx === -1) {
    throw new Error('Could not find window.processHTML in generated client runtime')
  }
  const endIdx = runtimeCode.lastIndexOf('})();')
  if (endIdx === -1) {
    throw new Error('Could not find end of IIFE in generated client runtime')
  }
  const fnCode = runtimeCode.substring(startIdx, endIdx).trim()

  // Evaluate function in a mocked context
  const windowMock = {
    __coralite__: { mode }
  }
  const componentManifestMock = {}
  const loadComponentMock = () => {
  }

  const run = new Function('window', 'componentManifest', 'loadComponent', `${fnCode}\nreturn window.processHTML;`)
  return run(windowMock, componentManifestMock, loadComponentMock)
}

import serialize from 'serialize-javascript'

describe('generateClientRuntime inlinedStyles initialization', () => {
  it('should initialize window.__coralite_styles_loaded__ Set with realistic serialized inlinedStyles', () => {
    const serializedStyles = serialize(['my-card', 'header-comp'])
    const runtimeCode = generateClientRuntime({
      base: '/',
      sharedChunkPath: 'shared.js',
      declarativeTags: ['my-card'],
      hydrationData: '{}',
      mode: 'production',
      instanceCounters: '{}',
      inlinedStyles: serializedStyles
    })

    assert.ok(runtimeCode.includes(`window.__coralite_styles_loaded__ = window.__coralite_styles_loaded__ || new Set(${serializedStyles});`))
    assert.ok(runtimeCode.includes('window.__coralite_styles_loaded__.has(componentId)'))
    assert.ok(runtimeCode.includes('window.__coralite_styles_loaded__.has(id)'))
    assert.ok(!runtimeCode.includes('inlineStyles.textContent.includes'))
  })

  it('should inject dynamic stylesheet even if #coralite-inline-styles contains matching selector text when ID is not in __coralite_styles_loaded__', async () => {
    const rawRuntimeCode = generateClientRuntime({
      base: '/',
      sharedChunkPath: 'shared.js',
      declarativeTags: [],
      hydrationData: '{}',
      mode: 'production',
      instanceCounters: '{}',
      inlinedStyles: serialize(['other-comp'])
    })

    // Mock DOM environment for evaluating loadComponent behavior
    let appendedLinkHref = null
    const mockDocument = {
      getElementById (id) {
        if (id === 'coralite-inline-styles') {
          // Inline styles element containing a global CSS rule matching target component ID
          return { textContent: '.style-imperative-only { color: red; }' }
        }
        return null
      },
      querySelector (selector) {
        return null
      },
      head: {
        appendChild (node) {
          if (node.rel === 'stylesheet') {
            appendedLinkHref = node.href
          }
        }
      },
      createElement (tag) {
        return { tag, rel: '', href: '' }
      },
      querySelectorAll () {
        return []
      },
      documentElement: {
        setAttribute () {}
      }
    }

    class MockHTMLElement {}
    class MockHTMLUnknownElement {}

    globalThis.HTMLElement = MockHTMLElement
    globalThis.HTMLUnknownElement = MockHTMLUnknownElement
    globalThis.customElements = { get: () => null, define: () => {} }
    globalThis.window = globalThis.window || {}
    globalThis.document = mockDocument

    // Replace dynamic import statements with mock function calls
    const executableCode = rawRuntimeCode.replace(/import\(([^)]+)\)/g, (match, path) => {
      if (path.includes('manifest.js')) {
        return 'Promise.resolve({ default: { "style-imperative-only": { js: "style-imperative-only.js", css: "style-imperative-only.css" } } })'
      }
      if (path.includes('shared.js')) {
        return 'Promise.resolve({ getClientContext: () => ({}), createCoraliteClass: () => class {}, globalClientHooks: {}, setupDevTools: () => {}, registerDevToolsComponent: () => {} })'
      }
      return 'Promise.resolve({ default: { componentId: "style-imperative-only" } })'
    })

    try {
      const fn = new Function(executableCode)
      fn()

      // Wait for async execution
      await new Promise(r => setTimeout(r, 50))

      // Manually trigger loadComponent via window.createElement or processHTML
      if (typeof globalThis.window.createCoraliteElement === 'function') {
        globalThis.window.createCoraliteElement('style-imperative-only')
      }

      await new Promise(r => setTimeout(r, 50))

      // Assert that <link rel="stylesheet"> was appended despite textContent collision
      assert.strictEqual(appendedLinkHref, '/assets/css/style-imperative-only.css')
      assert.strictEqual(globalThis.window.__coralite_styles_loaded__.has('style-imperative-only'), true)
    } finally {
      delete globalThis.HTMLElement
      delete globalThis.HTMLUnknownElement
      delete globalThis.customElements
      delete globalThis.document
      delete globalThis.window.__coralite_styles_loaded__
      delete globalThis.window.createCoraliteElement
      delete globalThis.window.processHTML
    }
  })
})

describe('client-side processHTML', () => {
  it('should prefix data-testid in development and testing mode', () => {
    for (const mode of ['development', 'testing']) {
      const processHTML = getProcessHTML(mode)

      // Test with instance ID (imperative component scope)
      const input1 = '<div class="item" data-testid="my-item">Hello</div>'
      const output1 = processHTML(input1, 'comp-0')
      assert.strictEqual(output1, '<div class="item" data-testid="comp-0__my-item">Hello</div>')

      // Test with no instance ID (no prefixing should occur since no prefix exists)
      const input2 = '<button data-testid="btn">Click</button>'
      const output2 = processHTML(input2, '')
      assert.strictEqual(output2, '<button data-testid="btn">Click</button>')

      // Test element with existing prefix (should not double-prefix)
      const input3 = '<div data-testid="comp-0__my-item">Hello</div>'
      const output3 = processHTML(input3, 'comp-0')
      assert.strictEqual(output3, '<div data-testid="comp-0__my-item">Hello</div>')
    }
  })

  it('should strip data-testid in production mode', () => {
    const processHTML = getProcessHTML('production')

    const input = '<div class="item" data-testid="my-item">Hello</div>'
    const output = processHTML(input, 'comp-0')
    assert.strictEqual(output, '<div class="item">Hello</div>')
  })

  it('should strip deprecated test attribute in all modes', () => {
    for (const mode of ['development', 'testing', 'production']) {
      const processHTML = getProcessHTML(mode)

      const input = '<div test="old-test-attr" class="item">Hello</div>'
      const output = processHTML(input, 'comp-0')
      assert.strictEqual(output, '<div class="item">Hello</div>')
    }
  })

  it('should prefix ref attributes and add data-coralite-owner in all modes', () => {
    for (const mode of ['development', 'testing', 'production']) {
      const processHTML = getProcessHTML(mode)

      // Test with instance ID (imperative component scope)
      const input1 = '<button ref="myBtn" class="btn">Click</button>'
      const output1 = processHTML(input1, 'comp-0')
      assert.strictEqual(output1, '<button ref="comp-0__myBtn" data-coralite-owner="comp-0" class="btn">Click</button>')

      // Test with no instance ID
      const input2 = '<button ref="myBtn">Click</button>'
      const output2 = processHTML(input2, '')
      assert.strictEqual(output2, '<button ref="myBtn">Click</button>')

      // Test element with existing prefix
      const input3 = '<button ref="comp-0__myBtn">Click</button>'
      const output3 = processHTML(input3, 'comp-0')
      assert.strictEqual(output3, '<button ref="comp-0__myBtn" data-coralite-owner="comp-0">Click</button>')
    }
  })
})
