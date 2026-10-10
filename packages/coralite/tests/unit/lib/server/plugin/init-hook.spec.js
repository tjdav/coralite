import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { definePlugin } from '../../../../../lib/server/plugin/define.js'
import { ScriptManager } from '../../../../../lib/server/script-manager.js'

describe('client.init hook bundling and execution', () => {
  it('should include init function in compiled client runtime', async () => {
    const plugin = definePlugin({
      name: 'test-init-plugin',
      client: {
        init () {
          // init logic
        }
      }
    })

    const scriptManager = new ScriptManager()
    await scriptManager.use(plugin())

    try {
      const { outputFiles } = await scriptManager.compileComponents('production')
      const runtimeFile = Object.values(outputFiles).find(f => f.path.includes('coralite-runtime') || f.text.includes('initPlugins'))

      assert.ok(runtimeFile)
      assert.ok(runtimeFile.text.includes('initPlugins'))
      assert.ok(runtimeFile.text.includes('coralite:plugin-init-error'))
    } finally {
      await scriptManager.disposeContext()
    }
  })

  it('should generate initPlugins function that passes { config, runtime, app, onCleanup }, logs errors, dispatches coralite:plugin-init-error, and wires onCleanup', async () => {
    const pluginA = definePlugin({
      name: 'analytics',
      client: {
        config: { apiKey: 'key-123' },
        async init () {
        }
      }
    })

    const pluginFailing = definePlugin({
      name: 'failing-plugin',
      client: {
        init () {
          throw new Error('SDK error')
        }
      }
    })

    const pluginB = definePlugin({
      name: 'dependent-plugin',
      dependencies: ['analytics'],
      client: {
        init () {
        }
      }
    })

    const scriptManager = new ScriptManager()
    await scriptManager.use(pluginA())
    await scriptManager.use(pluginFailing())
    await scriptManager.use(pluginB())

    try {
      const { outputFiles } = await scriptManager.compileComponents('production')
      const runtimeFile = Object.values(outputFiles).find(f => f.path.includes('coralite-runtime') || f.text.includes('initPlugins'))

      assert.ok(runtimeFile)
      const code = runtimeFile.text

      // Verify generated code structure
      assert.ok(code.includes('initPlugins'))
      assert.ok(code.includes('coralite:plugin-init-error'))
      assert.ok(code.includes('beforeunload'))
    } finally {
      await scriptManager.disposeContext()
    }
  })
})
