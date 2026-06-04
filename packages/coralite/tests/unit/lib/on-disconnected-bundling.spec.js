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

    const instances = {
      'inst-1': {
        componentId: 'test-comp',
        instanceId: 'inst-1',
        state: {}
      }
    }

    const result = await sm.compileAllInstances(instances, 'development')

    const chunkSharedHashName = result.manifest['chunk-shared']
    const compiledScript = result.outputFiles[chunkSharedHashName].text

    // Check if onDisconnected is present in globalClientHooks
    assert.ok(compiledScript.includes('onDisconnected:'), 'globalClientHooks should contain onDisconnected')
  })
})
