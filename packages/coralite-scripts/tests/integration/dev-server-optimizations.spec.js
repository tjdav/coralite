import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import server from '../../libs/server.js'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createCLIProject } from '../utils/project.js'
import loadConfig from '../../libs/load-config.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const coraliteScriptsLib = path.resolve(__dirname, '../../libs/config.js')
const libUrl = pathToFileURL(coraliteScriptsLib).href

describe('Dev Server Optimizations', () => {
  let project

  beforeEach(async () => {
    project = await createCLIProject()
  })

  afterEach(async () => {
    if (project) {
      await project.cleanup()
    }
  })

  it('setItem is called only when page item does not exist in coralite.pages', async () => {
    await project.writePage('index.html', `
      <!DOCTYPE html>
      <html>
        <head><title>Test Page</title></head>
        <body>
          <h1>Hello World</h1>
        </body>
      </html>
    `)

    let capturedCoralite = null
    const testPlugin = {
      name: 'test-capture-plugin',
      server (app, coralite) {
        capturedCoralite = coralite
      }
    }

    const testPort = 3890 + Math.floor(Math.random() * 1000)

    await project.writeConfig(`
      import { defineConfig } from '${libUrl}'
      export default defineConfig({
        output: './.coralite',
        components: './src/components',
        pages: './src/pages',
        public: './public',
        server: {
          port: ${testPort}
        }
      })
    `)

    const originalCwd = process.cwd()
    process.chdir(project.testDir)

    try {
      const config = await loadConfig(project.testDir)
      assert.ok(config, 'Config should load successfully')
      config.plugins = [testPlugin]

      const devServer = await server(config, { verbose: false }, 'test')

      try {
        assert.ok(capturedCoralite, 'Coralite instance should be captured by plugin')

        let setItemCallCount = 0
        const originalSetItem = capturedCoralite.pages.setItem.bind(capturedCoralite.pages)
        capturedCoralite.pages.setItem = async (...args) => {
          setItemCallCount++
          return originalSetItem(...args)
        }

        // First request - page index.html was already loaded during createCoralite initialization
        const res1 = await fetch(`http://127.0.0.1:${testPort}/`)
        assert.equal(res1.status, 200)
        await res1.text()
        assert.equal(setItemCallCount, 0, 'setItem should be skipped when page item already exists in collection')

        // Second request - page index.html remains in collection, setItem should still be skipped
        const res2 = await fetch(`http://127.0.0.1:${testPort}/`)
        assert.equal(res2.status, 200)
        await res2.text()
        assert.equal(setItemCallCount, 0, 'setItem should remain skipped on subsequent requests')
      } finally {
        if (devServer) {
          await new Promise(resolve => devServer.close(resolve))
        }
      }
    } finally {
      process.chdir(originalCwd)
    }
  })

  it('verifies runMode gating for background pre-warming', async () => {
    await project.writePage('index.html', `
      <!DOCTYPE html>
      <html>
        <head><title>Prewarm Test</title></head>
        <body><h1>Prewarm</h1></body>
      </html>
    `)

    const testPort = 3890 + Math.floor(Math.random() * 1000)

    await project.writeConfig(`
      import { defineConfig } from '${libUrl}'
      export default defineConfig({
        output: './.coralite',
        components: './src/components',
        pages: './src/pages',
        public: './public',
        server: {
          port: ${testPort}
        }
      })
    `)

    const originalCwd = process.cwd()
    process.chdir(project.testDir)

    try {
      const config = await loadConfig(project.testDir)
      assert.ok(config)

      let testBuildCount = 0
      config.plugins = [{
        name: 'test-plugin',
        server (app, coralite) {
          const origBuild = coralite.build.bind(coralite)
          coralite.build = (...args) => {
            testBuildCount++
            return origBuild(...args)
          }
        }
      }]

      const devServerTest = await server(config, { verbose: false }, 'test')
      try {
        await new Promise(resolve => setTimeout(resolve, 50))
        assert.equal(testBuildCount, 0, 'build should not be called on server boot in test mode')
      } finally {
        if (devServerTest) {
          await new Promise(resolve => devServerTest.close(resolve))
        }
      }
    } finally {
      process.chdir(originalCwd)
    }
  })
})
