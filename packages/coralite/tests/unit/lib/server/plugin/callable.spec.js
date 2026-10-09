import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { definePlugin } from '../../../../../lib/server/plugin/define.js'

describe('definePlugin callable form and call-time validation', () => {
  it('should return a callable function that creates a configured instance', () => {
    const plugin = definePlugin({
      name: 'router',
      config: {
        base: {
          type: String,
          default: '/'
        },
        mode: {
          type: String,
          values: ['history', 'hash'],
          default: 'history'
        }
      }
    })

    assert.strictEqual(typeof plugin, 'function')
    assert.strictEqual(plugin.name, 'router')

    const instance = plugin({
      base: '/app',
      mode: 'hash'
    })
    assert.strictEqual(instance._isConfiguredInstance, true)
    assert.strictEqual(instance.name, 'router')
    assert.strictEqual(instance.config.base, '/app')
    assert.strictEqual(instance.config.mode, 'hash')
  })

  it('should apply defaults for unprovided optional keys at call time', () => {
    const plugin = definePlugin({
      name: 'router',
      config: {
        base: {
          type: String,
          default: '/'
        },
        timeout: {
          type: Number,
          default: 5000
        }
      }
    })

    const instance = plugin({ base: '/admin' })
    assert.strictEqual(instance.config.base, '/admin')
    assert.strictEqual(instance.config.timeout, 5000)
  })

  it('should throw CORALITE-P101 if required key is missing at call time', () => {
    const plugin = definePlugin({
      name: 'auth',
      server: {
        config: {
          secretKey: {
            type: String,
            required: true
          }
        }
      }
    })

    assert.throws(
      () => plugin({}),
      (err) => {
        assert.strictEqual(err.code, 'CORALITE-P101')
        assert.match(err.message, /secretKey/)
        return true
      }
    )
  })

  it('should throw CORALITE-P207 for unknown config key in values object', () => {
    const plugin = definePlugin({
      name: 'analytics',
      config: {
        trackingId: String
      }
    })

    assert.throws(
      () => plugin({
        trackingId: 'UA-123',
        unknownKey: 123
      }),
      (err) => {
        assert.strictEqual(err.code, 'CORALITE-P207')
        assert.match(err.message, /unknownKey/)
        return true
      }
    )
  })

  it('should throw CORALITE-P207 when value type fails validation', () => {
    const plugin = definePlugin({
      name: 'cache',
      config: {
        ttl: Number
      }
    })

    assert.throws(
      () => plugin({ ttl: '5000' }),
      (err) => {
        assert.strictEqual(err.code, 'CORALITE-P207')
        assert.match(err.message, /ttl/)
        return true
      }
    )
  })

  it('should throw CORALITE-P207 when enum values check fails', () => {
    const plugin = definePlugin({
      name: 'router',
      config: {
        mode: ['history', 'hash']
      }
    })

    assert.throws(
      () => plugin({ mode: 'memory' }),
      (err) => {
        assert.strictEqual(err.code, 'CORALITE-P207')
        assert.match(err.message, /mode/)
        return true
      }
    )
  })

  it('should throw CORALITE-P207 when custom validate function fails or throws', () => {
    const plugin = definePlugin({
      name: 'port-plugin',
      config: {
        port: {
          type: Number,
          validate: (val) => val > 1024 && val < 65535
        }
      }
    })

    assert.throws(
      () => plugin({ port: 80 }),
      (err) => {
        assert.strictEqual(err.code, 'CORALITE-P207')
        assert.match(err.message, /port/)
        return true
      }
    )
  })

  it('should execute transform function on validated values', () => {
    const plugin = definePlugin({
      name: 'transform-plugin',
      config: {
        prefix: {
          type: String,
          transform: (val) => val.trim().toLowerCase()
        }
      }
    })

    const instance = plugin({ prefix: '  MY-PREFIX  ' })
    assert.strictEqual(instance.config.prefix, 'my-prefix')
  })

  it('should override plugin name when name property is passed in values object', () => {
    const plugin = definePlugin({
      name: 'router',
      config: {
        base: {
          type: String,
          default: '/'
        }
      },
      server: {
        context: () => () => ({})
      },
      client: {
        context: () => () => ({})
      }
    })

    const instance = plugin({
      base: '/admin',
      name: 'admin-router'
    })
    assert.strictEqual(instance.name, 'admin-router')
    assert.strictEqual(instance.server.name, 'admin-router')
    assert.strictEqual(instance.client.name, 'admin-router')
  })
})
