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

  describe('modes validation', () => {
    it('should accept valid modes array and attach modes to callable and instance', () => {
      const plugin = definePlugin({
        name: 'mode-gated',
        modes: ['testing', 'development']
      })

      assert.deepStrictEqual(plugin.modes, ['testing', 'development'])
      const instance = plugin()
      assert.deepStrictEqual(instance.modes, ['testing', 'development'])
    })

    it('should throw CORALITE-P204 if modes is empty array', () => {
      assert.throws(
        () => definePlugin({
          name: 'bad-modes',
          modes: []
        }),
        (err) => {
          assert.strictEqual(err.code, 'CORALITE-P204')
          return true
        }
      )
    })

    it('should throw CORALITE-P204 if modes is a non-array value', () => {
      assert.throws(
        // @ts-ignore
        () => definePlugin({
          name: 'bad-modes',
          modes: 'testing'
        }),
        (err) => {
          assert.strictEqual(err.code, 'CORALITE-P204')
          return true
        }
      )
    })

    it('should throw CORALITE-P204 if modes contains an unknown mode name', () => {
      assert.throws(
        () => definePlugin({
          name: 'bad-modes',
          modes: ['testing', 'staging']
        }),
        (err) => {
          assert.strictEqual(err.code, 'CORALITE-P204')
          assert.match(err.message, /staging/)
          return true
        }
      )
    })
  })

  describe('depends validation', () => {
    it('should accept valid depends array and attach depends to callable and instance', () => {
      const plugin = definePlugin({
        name: 'dependent-plugin',
        depends: ['storage', 'i18n']
      })

      assert.deepStrictEqual(plugin.depends, ['storage', 'i18n'])
      const instance = plugin()
      assert.deepStrictEqual(instance.depends, ['storage', 'i18n'])
    })

    it('should throw CORALITE-P205 if depends is not an array', () => {
      assert.throws(
        // @ts-ignore
        () => definePlugin({
          name: 'bad-depends',
          depends: 'storage'
        }),
        (err) => {
          assert.strictEqual(err.code, 'CORALITE-P205')
          return true
        }
      )
    })

    it('should throw CORALITE-P205 if depends contains non-string elements', () => {
      assert.throws(
        // @ts-ignore
        () => definePlugin({
          name: 'bad-depends',
          depends: ['storage', 123]
        }),
        (err) => {
          assert.strictEqual(err.code, 'CORALITE-P205')
          return true
        }
      )
    })
  })

  describe('client.init validation', () => {
    it('should accept valid client.init function', () => {
      const plugin = definePlugin({
        name: 'init-plugin',
        client: {
          init () {
          }
        }
      })

      assert.strictEqual(typeof plugin.client.init, 'function')
    })

    it('should throw error if client.init is defined and not a function', () => {
      assert.throws(
        // @ts-ignore
        () => definePlugin({
          name: 'bad-init',
          client: { init: 'not-a-fn' }
        }),
        (err) => {
          assert.match(err.message, /client\.init.*must be a function/)
          return true
        }
      )
    })
  })
})
