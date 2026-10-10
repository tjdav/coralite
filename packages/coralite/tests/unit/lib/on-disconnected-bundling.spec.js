import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { ScriptManager } from '../../../lib/script-manager.js'

describe('ScriptManager onDisconnected bundling', () => {
  it('should include onDisconnected in the compiled shared chunk', async () => {
    const sm = new ScriptManager()

    const plugin = {
      name: 'test-plugin',
      onDisconnected: (payload) => {
        console.log('disconnected', payload.instanceId)
      }
    }

    await sm.use(plugin)

    sm.registerComponent({
      id: 'test-comp',
      script: { content: '() => {}' }
    })

    const result = await sm.compileComponents('development')

    const runtimeHashName = result.manifest['coralite-runtime']
    const compiledScript = result.outputFiles[runtimeHashName].text

    // Check if onDisconnected is present in globalClientHooks
    assert.ok(compiledScript.includes('onDisconnected:'), 'globalClientHooks should contain onDisconnected')

    await sm.disposeContext()
  })
})
