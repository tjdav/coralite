import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { definePlugin } from '../../../lib/plugin.js'

describe('definePlugin Coverage Gaps', () => {
  it('should throw for empty name', () => {
    assert.throws(() => definePlugin({ name: '' }), /must be a non-empty string/)
  })

  it('should throw for non-string name', () => {
    assert.throws(() => definePlugin({ name: 123 }), /must be a non-empty string/)
  })

  it('should throw if server is not an object', () => {
    assert.throws(() => definePlugin({
      name: 'test',
      server: 'invalid'
    }), /"server" must be an object/)
  })

  it('should throw if server.context is not a function', () => {
    assert.throws(() => definePlugin({
      name: 'test',
      server: { context: 'invalid' }
    }), /"server.context" must be a function/)
  })

  it('should throw if server.components is not an array', () => {
    assert.throws(() => definePlugin({
      name: 'test',
      server: { components: 'invalid' }
    }), /"server.components" must be an array/)
  })

  it('should throw if server.components contains non-string', () => {
    assert.throws(() => definePlugin({
      name: 'test',
      server: { components: ['valid', 123] }
    }), /"server.components\[1\]" must be a string/)
  })

  it('should process server components', () => {
    const plugin = definePlugin({
      name: 'test',
      server: { components: ['/path/to/comp.html'] }
    })
    assert.strictEqual(plugin.server.components.length, 1)
    assert.strictEqual(plugin.server.components[0].path.filename, 'comp.html')
  })

  it('should throw if client is not an object', () => {
    assert.throws(() => definePlugin({
      name: 'test',
      client: 'invalid'
    }), /"client" must be an object/)
  })

  it('should throw if client.context is not a function', () => {
    assert.throws(() => definePlugin({
      name: 'test',
      client: { context: 'invalid' }
    }), /"client.context" must be a function/)
  })

  it('should throw if client.setup is not a function', () => {
    assert.throws(() => definePlugin({
      name: 'test',
      client: { setup: 'invalid' }
    }), /"client.setup" must be a function/)
  })

  it('should throw if client.config is not an object', () => {
    assert.throws(() => definePlugin({
      name: 'test',
      client: { config: 'invalid' }
    }), /"client.config" must be an object/)
  })

  it('should set rootDir automatically for client plugin', () => {
    const plugin = definePlugin({
      name: 'test',
      client: {
        setup: () => {
        }
      }
    })
    assert.ok(plugin.client.rootDir)
  })
})
