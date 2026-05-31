import { createRegistry } from '../../../lib/registry.js'
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

describe('createRegistry', () => {
  it('should register and resolve a service synchronously', async () => {
    const registry = createRegistry()
    const service = { foo: 'bar' }
    registry.register('test', service)
    const resolved = await registry.resolve('test')
    assert.strictEqual(resolved, service)
  })

  it('should resolve a service asynchronously', async () => {
    const registry = createRegistry()
    const service = { foo: 'bar' }

    const promise = registry.resolve('test')
    registry.register('test', service)

    const resolved = await promise
    assert.strictEqual(resolved, service)
  })

  it('should ignore if service is already registered', async () => {
    const registry = createRegistry()
    const s1 = { a: 1 }
    const s2 = { a: 2 }

    registry.register('test', s1)
    registry.register('test', s2)

    const resolved = await registry.resolve('test')
    assert.strictEqual(resolved, s1)
  })

  it('should handle multiple resolvers for the same service', async () => {
    const registry = createRegistry()
    const service = { foo: 'bar' }

    const p1 = registry.resolve('test')
    const p2 = registry.resolve('test')

    registry.register('test', service)

    const [r1, r2] = await Promise.all([p1, p2])
    assert.strictEqual(r1, service)
    assert.strictEqual(r2, service)
  })
})
