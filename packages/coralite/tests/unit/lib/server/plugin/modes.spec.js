import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { setupPlugins } from '../../../../../lib/server/plugin/setup.js'
import modesPlugin from '../../../../fixtures/plugins/modes-plugin.js'

function createMockApp (mode, pluginsList = []) {
  return {
    options: {
      mode,
      plugins: pluginsList
    }
  }
}

describe('End-to-end plugin mode gating (modes.spec.js)', () => {
  it('should include modes-plugin when mode is testing', async () => {
    let hookFired = false
    let clientUsed = false

    const pluginInstance = modesPlugin()
    pluginInstance.server.onBeforeBuild = () => {
      hookFired = true
    }

    const app = createMockApp('testing', [pluginInstance])
    const plugins = {
      components: [],
      hooks: {}
    }
    const scriptManager = {
      use: () => {
        clientUsed = true
      }
    }

    await setupPlugins({
      app,
      serverGlobalContext: {},
      plugins,
      scriptManager,
      source: { plugins: {} }
    })

    assert.ok(plugins.hooks.onBeforeBuild)
    await plugins.hooks.onBeforeBuild[0]({})
    assert.strictEqual(hookFired, true)
    assert.strictEqual(clientUsed, true)
  })

  it('should skip modes-plugin when mode is production', async () => {
    let hookFired = false
    let clientUsed = false

    const pluginInstance = modesPlugin()
    pluginInstance.server.onBeforeBuild = () => {
      hookFired = true
    }

    const app = createMockApp('production', [pluginInstance])
    const plugins = {
      components: [],
      hooks: {}
    }
    const scriptManager = {
      use: () => {
        clientUsed = true
      }
    }

    await setupPlugins({
      app,
      serverGlobalContext: {},
      plugins,
      scriptManager,
      source: { plugins: {} }
    })

    assert.strictEqual(plugins.hooks.onBeforeBuild, undefined)
    assert.strictEqual(hookFired, false)
    assert.strictEqual(clientUsed, false)
  })

  it('should skip modes-plugin when mode is development', async () => {
    let hookFired = false
    let clientUsed = false

    const pluginInstance = modesPlugin()
    pluginInstance.server.onBeforeBuild = () => {
      hookFired = true
    }

    const app = createMockApp('development', [pluginInstance])
    const plugins = {
      components: [],
      hooks: {}
    }
    const scriptManager = {
      use: () => {
        clientUsed = true
      }
    }

    await setupPlugins({
      app,
      serverGlobalContext: {},
      plugins,
      scriptManager,
      source: { plugins: {} }
    })

    assert.strictEqual(plugins.hooks.onBeforeBuild, undefined)
    assert.strictEqual(hookFired, false)
    assert.strictEqual(clientUsed, false)
  })
})
