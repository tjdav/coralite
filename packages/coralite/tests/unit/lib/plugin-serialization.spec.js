import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { ScriptManager } from '../../../lib/script-manager.js'
import { definePlugin } from '../../../lib/plugin.js'

describe('Plugin Serialization Boundary Verification', () => {
  it('should throw CoraliteError when client.context references outer closure variable', async () => {
    const outerHelper = (x) => x + 1

    const leakyPlugin = definePlugin({
      name: 'leaky-plugin',
      client: {
        context () {
          // @ts-ignore
          const res = outerHelper(10)
          return () => ({ res })
        }
      }
    })

    const scriptManager = new ScriptManager()

    await assert.rejects(
      async () => {
        await scriptManager.use(leakyPlugin)
      },
      (err) => {
        assert.ok(err.message.includes('[Coralite Serialization Error]'))
        assert.ok(err.message.includes('leaky-plugin'))
        assert.ok(err.message.includes('client.context'))
        assert.ok(err.message.includes('outerHelper'))
        return true
      }
    )
  })

  it('should throw CoraliteError when client lifecycle hook references outer closure variable', async () => {
    const outerLogger = console.log

    const leakyHookPlugin = definePlugin({
      name: 'leaky-hook-plugin',
      client: {
        onConnected () {
          // @ts-ignore
          outerLogger('connected')
        }
      }
    })

    const scriptManager = new ScriptManager()

    await assert.rejects(
      async () => {
        await scriptManager.use(leakyHookPlugin)
      },
      (err) => {
        assert.ok(err.message.includes('[Coralite Serialization Error]'))
        assert.ok(err.message.includes('leaky-hook-plugin'))
        assert.ok(err.message.includes('outerLogger'))
        return true
      }
    )
  })

  it('should register successfully when functions are inside client.context or passed via client.config', async () => {
    const cleanPlugin = definePlugin({
      name: 'clean-plugin',
      client: {
        config: {
          multiplier: 2
        },
        context ({ config }) {
          const innerHelper = (x) => x * config.multiplier
          return () => ({
            calculate: (val) => innerHelper(val)
          })
        }
      }
    })

    const scriptManager = new ScriptManager()
    await scriptManager.use(cleanPlugin)
    assert.equal(scriptManager.scriptModules.length, 1)
  })
})
