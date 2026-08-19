import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { ScriptManager } from '../../../lib/script-manager.js'
import { definePlugin } from '../../../lib/plugin.js'

describe('Plugin Serialization Boundary Verification', () => {
  it('should register client plugins successfully in ScriptManager', async () => {
    const plugin = definePlugin({
      name: 'valid-plugin',
      client: {
        config: { theme: 'dark' },
        context () {
          return () => ({ theme: 'dark' })
        }
      }
    })

    const scriptManager = new ScriptManager()
    await scriptManager.use(plugin)
    assert.equal(scriptManager.scriptModules.length, 1)
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
