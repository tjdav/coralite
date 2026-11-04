import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  getNodeGlobalSurface,
  getBrowserGlobalSurface,
  isNodeGlobal,
  isNodeOnlyGlobal
} from '../../../../lib/utils/node-global-surface.js'

describe('node-global-surface', () => {
  it('returns a Set containing the core Node runtime globals', () => {
    const surface = getNodeGlobalSurface()
    assert.ok(surface instanceof Set)
    for (const name of ['process', 'Buffer', 'global', 'setImmediate', 'clearImmediate', 'setTimeout', 'structuredClone']) {
      assert.ok(surface.has(name), `expected surface to include ${name}`)
    }
  })

  it('memoizes the surface across calls', () => {
    assert.strictEqual(getNodeGlobalSurface(), getNodeGlobalSurface())
  })

  it('identifies Node globals and rejects unknown identifiers', () => {
    assert.strictEqual(isNodeGlobal('process'), true)
    assert.strictEqual(isNodeGlobal('Buffer'), true)
    assert.strictEqual(isNodeGlobal('processX'), false)
    assert.strictEqual(isNodeGlobal('foobro'), false)
  })

  it('does not treat CJS-realm identifiers (require, __dirname) as runtime globals in ESM', () => {
    assert.strictEqual(isNodeGlobal('require'), false)
    assert.strictEqual(isNodeGlobal('__dirname'), false)
    assert.strictEqual(isNodeGlobal('__filename'), false)
  })

  it('treats web-platform globals present in Node as shared, never node-only', () => {
    for (const name of ['fetch', 'URL', 'crypto', 'console', 'queueMicrotask', 'globalThis', 'AbortController', 'structuredClone']) {
      assert.strictEqual(isNodeOnlyGlobal(name), false, `${name} must not be flagged as node-only`)
    }
  })

  it('flags Node-only globals such as process and Buffer', () => {
    assert.strictEqual(isNodeOnlyGlobal('process'), true)
    assert.strictEqual(isNodeOnlyGlobal('Buffer'), true)
    assert.strictEqual(isNodeOnlyGlobal('global'), true)
    assert.strictEqual(isNodeOnlyGlobal('setImmediate'), true)
    assert.strictEqual(isNodeOnlyGlobal('clearImmediate'), true)
  })

  it('builds the browser surface from the globals package, ES built-ins, and shared extras', () => {
    const surface = getBrowserGlobalSurface()
    assert.ok(surface instanceof Set)
    for (const name of ['window', 'document', 'fetch', 'navigator', 'WebSocket']) {
      assert.ok(surface.has(name), `expected browser surface to include ${name}`)
    }
    for (const name of ['Promise', 'JSON', 'undefined', 'unescape']) {
      assert.ok(surface.has(name), `expected ES built-in ${name} in browser surface`)
    }
    for (const name of ['TransformStream', 'globalThis']) {
      assert.ok(surface.has(name), `expected shared extra ${name} in browser surface`)
    }
  })

  it('keeps Node-only globals out of the browser surface', () => {
    const surface = getBrowserGlobalSurface()
    for (const name of ['process', 'Buffer', 'global', 'setImmediate', 'clearImmediate', 'Deno']) {
      assert.ok(!surface.has(name), `Node-only ${name} must not be in browser surface`)
    }
  })
})
