import '../setup.js'
import { describe, it } from 'node:test'
import assert from 'node:assert'
import { generateClientRuntime } from '../../../lib/utils/client/runtime.js'
import serialize from 'serialize-javascript'

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

    const origDoc = globalThis.document
    const origCustomElements = globalThis.customElements
    const origHTMLElement = globalThis.HTMLElement
    const origHTMLUnknownElement = globalThis.HTMLUnknownElement

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
    globalThis.document = mockDocument

    // Replace dynamic import statements with mock function calls
    const executableCode = rawRuntimeCode.replace(/import\(([^)]+)\)/g, (match, path) => {
      if (path.includes('manifest.js')) {
        return 'Promise.resolve({ default: { "style-imperative-only": { js: "style-imperative-only.js", css: "style-imperative-only.css" } } })'
      }
      if (path.includes('shared.js')) {
        return 'Promise.resolve({ getClientContext: () => ({}), createCoraliteClass: () => class extends HTMLElement {}, globalClientHooks: {}, setupDevTools: () => {}, registerDevToolsComponent: () => {} })'
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
      globalThis.HTMLElement = origHTMLElement
      globalThis.HTMLUnknownElement = origHTMLUnknownElement
      globalThis.customElements = origCustomElements
      globalThis.document = origDoc
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

  it('should preserve CSS at-rules without component wrapper and scope standard rules', () => {
    const atRules = ['scope', 'layer', 'media', 'supports', 'keyframes', 'font-face', 'container']
    const regex = /^\s*@(scope|layer|media|supports|keyframes|font-face|container)\b/i

    for (const rule of atRules) {
      const sampleCss = `@${rule} (min-width: 600px) { .box { color: red; } }`
      assert.strictEqual(regex.test(sampleCss), true, `@${rule} should be detected as at-rule`)
    }

    const standardCss = '.box { color: red; }'
    assert.strictEqual(regex.test(standardCss), false, 'Standard CSS should not be detected as at-rule')

    const stringAtCss = 'content: "@";'
    assert.strictEqual(regex.test(stringAtCss), false, 'CSS with @ in property values should not be detected as at-rule')
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

describe('mode-restricted runtime DOM prototype patching', () => {
  it('should omit prototype patching code and leave native DOM pristine in production mode', () => {
    const runtimeCode = generateClientRuntime({
      base: '/',
      sharedChunkPath: 'shared.js',
      declarativeTags: [],
      hydrationData: '{}',
      mode: 'production'
    })

    assert.strictEqual(runtimeCode.includes('resolveInstanceId'), false)
    assert.strictEqual(runtimeCode.includes('upgradeMatchingElements'), false)
    assert.strictEqual(runtimeCode.includes('Object.defineProperty(Element.prototype, \'innerHTML\''), false)
    assert.strictEqual(runtimeCode.includes('document.createElement = function'), false)

    // Verify window.createCoraliteElement is defined in runtime string
    assert.strictEqual(runtimeCode.includes('window.createCoraliteElement ='), true)
  })

  it('should emit prototype patching code in development and testing mode', () => {
    for (const mode of ['development', 'testing']) {
      const runtimeCode = generateClientRuntime({
        base: '/',
        sharedChunkPath: 'shared.js',
        declarativeTags: [],
        hydrationData: '{}',
        mode
      })

      assert.strictEqual(runtimeCode.includes('resolveInstanceId'), true)
      assert.strictEqual(runtimeCode.includes('upgradeMatchingElements'), true)
      assert.strictEqual(runtimeCode.includes('Object.defineProperty(Element.prototype, \'innerHTML\''), true)
      assert.strictEqual(runtimeCode.includes('ShadowRoot.prototype, \'innerHTML\''), true)
      assert.strictEqual(runtimeCode.includes('Object.defineProperty(Element.prototype, \'outerHTML\''), true)
      assert.strictEqual(runtimeCode.includes('Element.prototype.insertAdjacentHTML ='), true)
      assert.strictEqual(runtimeCode.includes('document.createElement = function'), true)
    }
  })

  it('should intercept innerHTML, outerHTML, insertAdjacentHTML and createElement in testing/dev mode', async () => {
    const rawRuntimeCode = generateClientRuntime({
      base: '/',
      sharedChunkPath: 'shared.js',
      declarativeTags: [],
      hydrationData: '{}',
      mode: 'testing'
    })

    let upgradedElements = []

    const mockManifest = {
      'test-card': { js: 'test-card.js' },
      'parent-comp': { js: 'parent-comp.js' },
      'child-comp': { js: 'child-comp.js' }
    }

    // Save native methods/descriptors prior to running test execution
    const origCreateElement = document.createElement
    const origInnerHTMLDesc = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML')
    const origOuterHTMLDesc = Object.getOwnPropertyDescriptor(Element.prototype, 'outerHTML')
    const origInsertAdjacentHTML = Element.prototype.insertAdjacentHTML
    const origUpgrade = customElements.upgrade

    // Mock customElements.upgrade
    customElements.upgrade = (el) => {
      upgradedElements.push(el)
    }

    // Replace dynamic imports in generated runtime
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

      await new Promise(r => setTimeout(r, 50))

      // 1. Plain text innerHTML (fast path)
      const container = document.createElement('div')
      document.body.appendChild(container)
      container.innerHTML = 'Just plain text'
      assert.strictEqual(container.innerHTML, 'Just plain text')

      // 2. innerHTML with custom element tag
      upgradedElements = []
      container.innerHTML = '<test-card data-testid="my-card">Hello</test-card>'
      await new Promise(r => setTimeout(r, 50))

      assert.ok(container.querySelector('test-card'), 'Custom element should be in DOM')
      assert.ok(upgradedElements.some(el => el.tagName.toLowerCase() === 'test-card'), 'customElements.upgrade should have been called on test-card')

      // 3. Tag deduplication
      upgradedElements = []
      container.innerHTML = '<test-card></test-card><test-card></test-card>'
      await new Promise(r => setTimeout(r, 50))
      assert.strictEqual(container.querySelectorAll('test-card').length, 2)

      // 4. Detached element mounting
      upgradedElements = []
      const detached = document.createElement('div')
      detached.innerHTML = '<test-card></test-card>'
      await new Promise(r => setTimeout(r, 50))
      assert.ok(upgradedElements.some(el => el.tagName.toLowerCase() === 'test-card'))

      // 5. Nested compound components
      upgradedElements = []
      container.innerHTML = '<parent-comp><child-comp></child-comp></parent-comp>'
      await new Promise(r => setTimeout(r, 50))
      assert.ok(upgradedElements.some(el => el.tagName.toLowerCase() === 'parent-comp'))
      assert.ok(upgradedElements.some(el => el.tagName.toLowerCase() === 'child-comp'))

      // 6. insertAdjacentHTML
      upgradedElements = []
      container.insertAdjacentHTML('beforeend', '<test-card id="adjacent"></test-card>')
      await new Promise(r => setTimeout(r, 50))
      assert.ok(container.querySelector('#adjacent'))
      assert.ok(upgradedElements.some(el => el.id === 'adjacent'))

      // 7. outerHTML
      upgradedElements = []
      const targetEl = document.createElement('div')
      container.appendChild(targetEl)
      targetEl.outerHTML = '<test-card id="outer-test"></test-card>'
      await new Promise(r => setTimeout(r, 50))
      assert.ok(container.querySelector('#outer-test'))

      // 8. document.createElement
      upgradedElements = []
      const createdEl = document.createElement('test-card')
      await new Promise(r => setTimeout(r, 50))
      assert.ok(upgradedElements.includes(createdEl))

      document.body.removeChild(container)
    } finally {
      // Restore native elements
      document.createElement = origCreateElement
      if (origInnerHTMLDesc) Object.defineProperty(Element.prototype, 'innerHTML', origInnerHTMLDesc)
      if (origOuterHTMLDesc) Object.defineProperty(Element.prototype, 'outerHTML', origOuterHTMLDesc)
      if (origInsertAdjacentHTML) Element.prototype.insertAdjacentHTML = origInsertAdjacentHTML
      customElements.upgrade = origUpgrade
    }
  })

  it('should resolve instanceId across shadowRoot host hierarchy in development/testing mode', async () => {
    const rawRuntimeCode = generateClientRuntime({
      base: '/',
      sharedChunkPath: 'shared.js',
      declarativeTags: [],
      hydrationData: '{}',
      mode: 'testing'
    })

    const origCreateElement = document.createElement
    const origInnerHTMLDesc = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML')
    const origShadowInnerHTMLDesc = typeof ShadowRoot !== 'undefined' ? Object.getOwnPropertyDescriptor(ShadowRoot.prototype, 'innerHTML') : null

    const mockManifest = {
      'shadow-child': { js: 'shadow-child.js' }
    }

    const executableCode = rawRuntimeCode.replace(/import\(([^)]+)\)/g, (match, path) => {
      if (path.includes('manifest.js')) {
        return `Promise.resolve({ default: ${JSON.stringify(mockManifest)} })`
      }
      if (path.includes('shared.js')) {
        return 'Promise.resolve({ getClientContext: () => ({}), createCoraliteClass: () => class extends HTMLElement {}, globalClientHooks: {}, setupDevTools: () => {}, registerDevToolsComponent: () => {} })'
      }
      return 'Promise.resolve({ default: { componentId: "shadow-child" } })'
    })

    try {
      const fn = new Function(executableCode)
      fn()

      await new Promise(r => setTimeout(r, 50))

      const host = document.createElement('div')
      host.setAttribute('data-coralite-owner', 'host-comp-1')
      document.body.appendChild(host)

      if (typeof host.attachShadow === 'function') {
        const shadow = host.attachShadow({ mode: 'open' })
        shadow.innerHTML = '<shadow-child data-testid="inner-shadow">Shadow Content</shadow-child>'
        await new Promise(r => setTimeout(r, 50))

        const child = shadow.querySelector('shadow-child')
        assert.ok(child)
        assert.strictEqual(child.getAttribute('data-testid'), 'host-comp-1__inner-shadow')
      }

      document.body.removeChild(host)
    } finally {
      document.createElement = origCreateElement
      if (origInnerHTMLDesc) Object.defineProperty(Element.prototype, 'innerHTML', origInnerHTMLDesc)
      if (origShadowInnerHTMLDesc && typeof ShadowRoot !== 'undefined') {
        Object.defineProperty(ShadowRoot.prototype, 'innerHTML', origShadowInnerHTMLDesc)
      }
    }
  })
})
