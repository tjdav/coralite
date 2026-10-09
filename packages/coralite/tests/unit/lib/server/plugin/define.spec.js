import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { definePlugin } from '../../../../../lib/server/plugin/define.js'

describe('definePlugin specification and backward compatibility', () => {
  it('should return a callable function with all plugin properties attached', () => {
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

    assert.strictEqual(typeof plugin, 'function')
    assert.strictEqual(plugin.name, 'router')
    assert.ok(plugin.rootDir)
    assert.ok(plugin.filePath)
    assert.ok(plugin.config)
    assert.ok(plugin.server)
    assert.ok(plugin.client)
    assert.strictEqual(plugin._isPluginCallable, true)
  })

  it('should allow bare plugin registration when no required keys exist', () => {
    const plugin = definePlugin({
      name: 'bare-plugin',
      config: {
        verbose: {
          type: Boolean,
          default: false
        }
      }
    })

    assert.strictEqual(typeof plugin, 'function')
    assert.strictEqual(plugin.name, 'bare-plugin')
  })

  it('should preserve backward compatibility for plain object configs without explicit schemas', () => {
    const plugin = definePlugin({
      name: 'legacy-plugin',
      server: {
        config: {
          host: 'localhost',
          port: 8080
        }
      }
    })

    assert.strictEqual(typeof plugin, 'function')
    const instance = plugin({ host: '0.0.0.0' })
    assert.strictEqual(instance.server.config.host, '0.0.0.0')
    assert.strictEqual(instance.server.config.port, 8080)
  })
})
