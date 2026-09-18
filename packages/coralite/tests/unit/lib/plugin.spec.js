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

  it('should infer rootDir for a client plugin with only a setup hook', () => {
    const plugin = definePlugin({
      name: 'setup-only-plugin',
      client: {
        setup: () => {
        }
      }
    })

    assert.ok(plugin.client.rootDir)
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

describe('definePlugin argument validation', () => {
  it('should throw for empty name', () => {
    assert.throws(() => definePlugin({ name: '' }), /must be a non-empty string/)
  })

  it('should throw for non-string name', () => {
    assert.throws(() => definePlugin({ name: 123 }), /must be a non-empty string/)
  })

  it('should throw if server is not an object', () => {
    assert.throws(() => definePlugin({
      name: 'test',
      server: 'invalid'
    }), /"server" must be an object/)
  })

  it('should throw if server.context is not a function', () => {
    assert.throws(() => definePlugin({
      name: 'test',
      server: { context: 'invalid' }
    }), /"server.context" must be a function/)
  })

  it('should throw if server.components is not an array', () => {
    assert.throws(() => definePlugin({
      name: 'test',
      server: { components: 'invalid' }
    }), /"server.components" must be an array/)
  })

  it('should throw if server.components contains non-string', () => {
    assert.throws(() => definePlugin({
      name: 'test',
      server: { components: ['valid', 123] }
    }), /"server.components\[1\]" must be a string/)
  })

  it('should process server components', () => {
    const plugin = definePlugin({
      name: 'test',
      server: { components: ['/path/to/comp.html'] }
    })

    assert.strictEqual(plugin.server.components.length, 1)
    assert.strictEqual(plugin.server.components[0].path.filename, 'comp.html')
  })

  it('should throw if client is not an object', () => {
    assert.throws(() => definePlugin({
      name: 'test',
      client: 'invalid'
    }), /"client" must be an object/)
  })

  it('should throw if client.context is not a function', () => {
    assert.throws(() => definePlugin({
      name: 'test',
      client: { context: 'invalid' }
    }), /"client.context" must be a function/)
  })

  it('should throw if client.config is not an object', () => {
    assert.throws(() => definePlugin({
      name: 'test',
      client: { config: 'invalid' }
    }), /"client.config" must be an object/)
  })
})

