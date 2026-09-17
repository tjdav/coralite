import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { definePlugin } from '#lib'

describe('definePlugin', () => {
  it('should support explicit top-level rootDir and filePath', () => {
    const plugin = definePlugin({
      name: 'explicit-plugin',
      rootDir: '/explicit/dir',
      filePath: '/explicit/dir/plugin.js',
      client: {
        context: () => () => ({})
      }
    })

    assert.strictEqual(plugin.rootDir, '/explicit/dir')
    assert.strictEqual(plugin.filePath, '/explicit/dir/plugin.js')
    assert.strictEqual(plugin.client.rootDir, '/explicit/dir')
    assert.strictEqual(plugin.client.filePath, '/explicit/dir/plugin.js')
  })

  it('should validate basic plugin state', () => {
    const plugin = definePlugin({
      name: 'test-plugin',
      server: {
        context: () => {
          return () => ({
            test: () => {
            }
          })
        }
      }
    })

    assert.strictEqual(plugin.name, 'test-plugin')
    assert.strictEqual(typeof plugin.server.context, 'function')
  })

  it('should receive context and config in server.context', async () => {
    let capturedContext = null
    const plugin = definePlugin({
      name: 'test-plugin',
      server: {
        config: { foo: 'bar' },
        context: (context) => {
          capturedContext = context
          return () => ({
            test: () => {
            }
          })
        }
      }
    })

    const { setupPlugins } = await import('../../../lib/plugin-setup.js')
    const app = { options: { plugins: [plugin] } }
    const serverGlobalContext = { global: true }
    const source = { plugins: {} }

    await setupPlugins({
      app,
      serverGlobalContext,
      plugins: {
        components: [],
        hooks: {}
      },
      scriptManager: {
        use: () => {
        }
      },
      source
    })

    assert.ok(capturedContext)
    assert.strictEqual(capturedContext.global, true)
    assert.strictEqual(capturedContext.config.foo, 'bar')
    // Protocol updated to snapshot instead of prototype to avoid pollution
    assert.notStrictEqual(Object.getPrototypeOf(capturedContext), serverGlobalContext)
  })

  it('should infer caller filePath and rootDir from stack trace when omitted', async () => {
    const { fileURLToPath } = await import('node:url')
    const { dirname } = await import('node:path')
    const plugin = definePlugin({
      name: 'stack-inferred-plugin',
      client: {
        context: () => () => ({})
      }
    })

    const expectedFile = fileURLToPath(import.meta.url)
    const expectedDir = dirname(expectedFile)
    assert.strictEqual(plugin.filePath, expectedFile)
    assert.strictEqual(plugin.rootDir, expectedDir)
    assert.strictEqual(plugin.client.filePath, expectedFile)
    assert.strictEqual(plugin.client.rootDir, expectedDir)
  })

  it('should correctly parse simulated caller stack formats', async () => {
    const { fileURLToPath } = await import('node:url')
    const selfFile = fileURLToPath(import.meta.resolve('../../../lib/plugin.js'))
    const origError = Error

    try {
      // Test Windows drive letter stack
      globalThis.Error = class extends origError {
        constructor () {
          super()
          this.stack = `Error\n    at definePlugin (${selfFile}:128:19)\n    at Object.<anonymous> (C:\\projects\\app\\plugins\\win-plugin.js:10:15)`
        }
      }
      const winPlugin = definePlugin({
        name: 'win-plugin',
        client: { context: () => () => ({}) }
      })
      assert.strictEqual(winPlugin.filePath, 'C:\\projects\\app\\plugins\\win-plugin.js')

      // Test URL-encoded file:// URL with spaces
      globalThis.Error = class extends origError {
        constructor () {
          super()
          this.stack = `Error\n    at definePlugin (${selfFile}:128:19)\n    at file:///home/user/my%20projects/app/plugin.js:15:20`
        }
      }
      const urlPlugin = definePlugin({
        name: 'url-plugin',
        client: { context: () => () => ({}) }
      })
      assert.strictEqual(urlPlugin.filePath, '/home/user/my projects/app/plugin.js')
      assert.strictEqual(urlPlugin.rootDir, '/home/user/my projects/app')

      // Test Windows file:// URL
      globalThis.Error = class extends origError {
        constructor () {
          super()
          this.stack = `Error\n    at definePlugin (${selfFile}:128:19)\n    at Object.<anonymous> (file:///C:/projects/app/plugins/win-file-plugin.js:10:15)`
        }
      }
      const winFilePlugin = definePlugin({
        name: 'win-file-plugin',
        client: { context: () => () => ({}) }
      })
      assert.ok(winFilePlugin.filePath.includes('projects/app/plugins/win-file-plugin.js'))
    } finally {
      globalThis.Error = origError
    }
  })
})

