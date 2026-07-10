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
})
