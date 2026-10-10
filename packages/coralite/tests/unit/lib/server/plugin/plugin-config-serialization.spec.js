import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { ScriptManager } from '../../../../../lib/server/script-manager.js'
import { setupPlugins } from '../../../../../lib/server/plugin/setup.js'
import { definePlugin } from '../../../../../lib/server/plugin/define.js'

describe('plugin-config-serialization.spec.js', () => {
  const initPlugin = async (sm, plugin) => {
    const app = {
      options: {
        mode: 'development',
        plugins: [plugin]
      }
    }
    const source = { plugins: {} }
    await setupPlugins({
      app,
      serverGlobalContext: {},
      plugins: {
        hooks: {},
        components: []
      },
      scriptManager: sm,
      source
    })
  }

  const initPlugins = async (sm, plugins) => {
    const app = {
      options: {
        mode: 'development',
        plugins
      }
    }
    const source = { plugins: {} }
    await setupPlugins({
      app,
      serverGlobalContext: {},
      plugins: {
        hooks: {},
        components: []
      },
      scriptManager: sm,
      source
    })
  }

  it('should serialize frozen client.config into the runtime bundle and pass to Phase 1 resolver', async () => {
    const sm = new ScriptManager()
    try {
      const plugin = definePlugin({
        name: 'router',
        client: {
          config: {
            base: '/',
            mode: 'history'
          },
          context: (pluginContext) => {
            const cfg = pluginContext.config
            return (_instanceContext) => {
              return {
                base: cfg.base,
                mode: cfg.mode
              }
            }
          }
        }
      })

      await initPlugin(sm, plugin)

      const compiled = await sm.compileComponents('production')
      const runtimeChunk = Object.values(compiled.outputFiles).find(f => f.path.includes('coralite-runtime') || f.text.includes('clientPluginConfigs'))

      assert.ok(runtimeChunk, 'Runtime bundle must contain output files')
      assert.ok(runtimeChunk.text.includes('clientPluginConfigs'))
      assert.ok(runtimeChunk.text.includes('router:'))
      assert.ok(runtimeChunk.text.includes('mode:"history"'))
    } finally {
      await sm.disposeContext()
    }
  })

  it('should throw CORALITE-P210 when client.config contains non-serializable values', async () => {
    const sm = new ScriptManager()
    try {
      const plugin = {
        name: 'bad-plugin',
        client: {
          config: {
            fn: () => {
            }
          },
          context: (pluginContext) => () => ({})
        }
      }

      await initPlugin(sm, plugin)

      await assert.rejects(
        () => sm.compileComponents('production'),
        (err) => {
          return err.code === 'CORALITE-P210' && err.message.includes('Non-serializable value in client.config')
        }
      )
    } finally {
      await sm.disposeContext()
    }
  })

  it('should provide distinct configs for multiple plugin instances with name overrides', async () => {
    const sm = new ScriptManager()
    try {
      const plugin1 = definePlugin({
        name: 'router-main',
        client: {
          config: { base: '/app' },
          context: (ctx) => () => ({ base: ctx.config.base })
        }
      })

      const plugin2 = definePlugin({
        name: 'router-admin',
        client: {
          config: { base: '/admin' },
          context: (ctx) => () => ({ base: ctx.config.base })
        }
      })

      await initPlugins(sm, [plugin1, plugin2])

      const compiled = await sm.compileComponents('production')
      const runtimeChunk = Object.values(compiled.outputFiles).find(f => f.text.includes('clientPluginConfigs'))

      assert.ok(runtimeChunk)
      assert.ok(runtimeChunk.text.includes('"router-main"'))
      assert.ok(runtimeChunk.text.includes('"router-admin"'))
      assert.ok(runtimeChunk.text.includes('"/app"'))
      assert.ok(runtimeChunk.text.includes('"/admin"'))
    } finally {
      await sm.disposeContext()
    }
  })

  it('should default to empty object {} when a plugin declares no client.config', async () => {
    const sm = new ScriptManager()
    try {
      const plugin = definePlugin({
        name: 'no-config-plugin',
        client: {
          context: (ctx) => () => ({ configKeys: Object.keys(ctx.config) })
        }
      })

      await initPlugin(sm, plugin)

      const compiled = await sm.compileComponents('production')
      const runtimeChunk = Object.values(compiled.outputFiles).find(f => f.text.includes('clientPluginConfigs'))

      assert.ok(runtimeChunk)
      assert.ok(runtimeChunk.text.includes('"no-config-plugin":{}'))
    } finally {
      await sm.disposeContext()
    }
  })
})
