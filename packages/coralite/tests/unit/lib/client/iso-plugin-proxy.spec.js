/* eslint-disable no-restricted-imports -- Node test runner spec; requires node:* builtins */
import '../../setup.js'
import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createIsoPluginProxy } from '#lib/client/utils/iso-plugin-proxy.js'

describe('createIsoPluginProxy', () => {
  /** @type {any} */
  const win = window
  let resolveCount = 0

  beforeEach(() => {
    resolveCount = 0
    win.__coralite__ = {
      isomorphicPlugins: {
        $t: () => {
          resolveCount++
          return (key) => `translated:${key}`
        }
      }
    }
  })

  it('returns an enumerable own property descriptor for isomorphic plugin keys', () => {
    const proxy = createIsoPluginProxy({ a: 1 })
    const descriptor = Object.getOwnPropertyDescriptor(proxy, '$t')

    assert.ok(descriptor, 'descriptor must be defined for isomorphic key')
    assert.strictEqual(descriptor.enumerable, true)
    assert.strictEqual(descriptor.configurable, true)
  })

  it('includes isomorphic plugin keys in Object.keys', () => {
    const proxy = createIsoPluginProxy({ a: 1 })

    assert.deepStrictEqual(Object.keys(proxy).sort(), ['$t', 'a'])
  })

  it('preserves isomorphic plugins through object spread', () => {
    const proxy = createIsoPluginProxy({ a: 1 })
    const spread = { ...proxy }

    assert.strictEqual(spread.a, 1)
    assert.strictEqual(typeof spread.$t, 'function')
    assert.strictEqual(spread.$t('hello'), 'translated:hello')
  })

  it('lets own context keys shadow isomorphic plugin keys', () => {
    const own = () => 'own'
    const proxy = createIsoPluginProxy({ $t: own })

    assert.strictEqual(proxy.$t, own)
    assert.strictEqual({ ...proxy }.$t, own)
    assert.strictEqual(resolveCount, 0)
  })

  it('resolves each isomorphic plugin once per proxy instance', () => {
    const proxy = createIsoPluginProxy({})
    const first = proxy.$t
    const second = proxy.$t
    const spread = { ...proxy }

    assert.strictEqual(first, second)
    assert.strictEqual(spread.$t, first)
    assert.strictEqual(resolveCount, 1)
  })

  it('returns undefined descriptor for unknown keys', () => {
    const proxy = createIsoPluginProxy({})

    assert.strictEqual(Object.getOwnPropertyDescriptor(proxy, 'missing'), undefined)
    assert.strictEqual('missing' in proxy, false)
  })
})
