import { describe, it, beforeEach, afterEach } from 'node:test'
import { strict as assert } from 'node:assert'
import path from 'node:path'
import { mkdir, writeFile, readFile, utimes } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createCLIProject } from '../utils/project.js'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const coraliteScriptsLib = path.resolve(__dirname, '../../libs/config.js')

describe('Coralite Assets Integration', () => {
  let project

  beforeEach(async () => {
    project = await createCLIProject()
  })

  afterEach(async () => {
    await project.cleanup()
  })

  it('should copy local file assets', async () => {
    const assetContent = 'local asset content'
    const assetPath = path.join(project.testDir, 'extra.txt')
    await writeFile(assetPath, assetContent)

    await project.writeConfig(`
      import { defineConfig } from '${path.toNamespacedPath(coraliteScriptsLib)}'
      export default defineConfig({
        output: './dist',
        components: './src/components',
        pages: './src/pages',
        public: './public',
        assets: [
          { src: './extra.txt', dest: 'assets/extra.txt' }
        ]
      })
    `)

    await project.writePage('index.html', '<h1>Home</h1>')
    await project.runBuild()

    const destPath = path.join(project.outputDir, 'assets/extra.txt')
    assert.ok(existsSync(destPath), 'Asset should be copied to destination')
    assert.strictEqual(await readFile(destPath, 'utf8'), assetContent)
  })

  it('should copy local directory assets', async () => {
    const assetDir = path.join(project.testDir, 'extra-dir')
    await mkdir(assetDir)
    await writeFile(path.join(assetDir, 'file1.txt'), 'content 1')
    await writeFile(path.join(assetDir, 'file2.txt'), 'content 2')

    await project.writeConfig(`
      import { defineConfig } from '${path.toNamespacedPath(coraliteScriptsLib)}'
      export default defineConfig({
        output: './dist',
        components: './src/components',
        pages: './src/pages',
        public: './public',
        assets: [
          { src: './extra-dir', dest: 'assets/extra-dir' }
        ]
      })
    `)

    await project.writePage('index.html', '<h1>Home</h1>')
    await project.runBuild()

    assert.ok(existsSync(path.join(project.outputDir, 'assets/extra-dir/file1.txt')))
    assert.ok(existsSync(path.join(project.outputDir, 'assets/extra-dir/file2.txt')))
  })

  it('should copy assets from node_modules', async () => {
    // Setup mock package in node_modules
    const nodeModules = path.join(project.testDir, 'node_modules')
    const pkgDir = path.join(nodeModules, 'fake-pkg')
    await mkdir(pkgDir, { recursive: true })
    await writeFile(path.join(project.testDir, 'package.json'), JSON.stringify({
      name: 'test-project',
      type: 'module'
    }))
    await writeFile(path.join(pkgDir, 'package.json'), JSON.stringify({
      name: 'fake-pkg',
      version: '1.0.0'
    }))
    const assetContent = 'package asset content'
    await mkdir(path.join(pkgDir, 'dist'), { recursive: true })
    await writeFile(path.join(pkgDir, 'dist/style.css'), assetContent)

    await project.writeConfig(`
      import { defineConfig } from '${path.toNamespacedPath(coraliteScriptsLib)}'
      export default defineConfig({
        output: './dist',
        components: './src/components',
        pages: './src/pages',
        public: './public',
        assets: [
          { pkg: 'fake-pkg', path: 'dist/style.css', dest: 'assets/pkg-style.css' }
        ]
      })
    `)

    await project.writePage('index.html', '<h1>Home</h1>')
    const { stderr } = await project.runBuild()
    if (stderr) {
      console.error(stderr)
    }

    const destPath = path.join(project.outputDir, 'assets/pkg-style.css')
    assert.ok(existsSync(destPath), 'Package asset should be copied')
    assert.strictEqual(await readFile(destPath, 'utf8'), assetContent)
  })

  it('should support CLI assets flag and selective override', async () => {
    const configAssetPath = path.join(project.testDir, 'config-asset.txt')
    await writeFile(configAssetPath, 'config content')

    const cliAssetPath = path.join(project.testDir, 'cli-asset.txt')
    await writeFile(cliAssetPath, 'cli content')

    const overrideAssetPath = path.join(project.testDir, 'override-asset.txt')
    await writeFile(overrideAssetPath, 'override content')

    await project.writeConfig(`
      import { defineConfig } from '${path.toNamespacedPath(coraliteScriptsLib)}'
      export default defineConfig({
        output: './dist',
        components: './src/components',
        pages: './src/pages',
        public: './public',
        assets: [
          { src: './config-asset.txt', dest: 'assets/config.txt' },
          { src: './config-asset.txt', dest: 'assets/shared.txt' }
        ]
      })
    `)

    await project.writePage('index.html', '<h1>Home</h1>')

    // -a ./cli-asset.txt:assets/cli.txt  (New asset)
    // -a ./override-asset.txt:assets/shared.txt (Override)
    await project.runBuild(['-a', './cli-asset.txt:assets/cli.txt', './override-asset.txt:assets/shared.txt'])

    assert.strictEqual(await readFile(path.join(project.outputDir, 'assets/config.txt'), 'utf8'), 'config content')
    assert.strictEqual(await readFile(path.join(project.outputDir, 'assets/cli.txt'), 'utf8'), 'cli content')
    assert.strictEqual(await readFile(path.join(project.outputDir, 'assets/shared.txt'), 'utf8'), 'override content')
  })

  it('should detect mtime changes in incremental build', async () => {
    const assetPath = path.join(project.testDir, 'change.txt')
    await writeFile(assetPath, 'v1')

    await project.writeConfig(`
      import { defineConfig } from '${path.toNamespacedPath(coraliteScriptsLib)}'
      export default defineConfig({
        output: './dist',
        components: './src/components',
        pages: './src/pages',
        public: './public',
        assets: [
          { src: './change.txt', dest: 'assets/change.txt' }
        ]
      })
    `)

    await project.writePage('index.html', '<h1>Home</h1>')

    // First build
    await project.runBuild()
    assert.strictEqual(await readFile(path.join(project.outputDir, 'assets/change.txt'), 'utf8'), 'v1')

    // Modify asset
    const future = new Date(Date.now() + 5000)
    await writeFile(assetPath, 'v2')
    await utimes(assetPath, future, future)

    // Incremental build
    await project.runBuild()
    assert.strictEqual(await readFile(path.join(project.outputDir, 'assets/change.txt'), 'utf8'), 'v2')
  })

  it('should survive stale file cleanup (whitelist)', async () => {
    await project.writeConfig(`
      import { defineConfig } from '${path.toNamespacedPath(coraliteScriptsLib)}'
      export default defineConfig({
        output: './dist',
        components: './src/components',
        pages: './src/pages',
        public: './public',
        assets: [
          { src: './preserved.txt', dest: 'assets/preserved.txt' }
        ]
      })
    `)

    await writeFile(path.join(project.testDir, 'preserved.txt'), 'preserved')
    await project.writePage('index.html', '<h1>Home</h1>')

    // Initial build
    await project.runBuild()
    const preservedPath = path.join(project.outputDir, 'assets/preserved.txt')
    assert.ok(existsSync(preservedPath))

    // Second build (incremental)
    // Manually create a "stale" file in output
    const staleFile = path.join(project.outputDir, 'stale.txt')
    await writeFile(staleFile, 'stale')

    await project.runBuild()

    assert.ok(existsSync(preservedPath), 'Asset should be preserved')
    assert.ok(!existsSync(staleFile), 'Unrelated file should be deleted')
  })

  it('should fail fast on invalid CLI asset format', async () => {
    await project.writePage('index.html', '<h1>Home</h1>')
    const { exitCode, stderr } = await project.runBuild(['-a', 'invalid-format'])
    assert.strictEqual(exitCode, 1)
    assert.ok(stderr.includes('Invalid asset mapping'), 'Should show error message')
  })

  it('should fail fast on invalid local path in CLI', async () => {
    await project.writePage('index.html', '<h1>Home</h1>')
    const { exitCode, stderr } = await project.runBuild(['-a', 'not/starting/with/dot:dest'])
    assert.strictEqual(exitCode, 1)
    assert.ok(stderr.includes('Local paths must start with "."'), 'Should show error message')
  })

  it('should fail fast on invalid config (defineConfig validation)', async () => {
    await project.writeConfig(`
      import { defineConfig } from '${path.toNamespacedPath(coraliteScriptsLib)}'
      export default defineConfig({
        output: './dist',
        components: './src/components',
        pages: './src/pages',
        public: './public',
        assets: [
          { src: './missing-dest' }
        ]
      })
    `)
    const { exitCode, stderr } = await project.runBuild()
    assert.strictEqual(exitCode, 1)
    assert.ok(stderr.includes('dest'), 'Should show error about missing dest')
  })
})
