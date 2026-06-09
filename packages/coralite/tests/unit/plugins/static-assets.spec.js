import { describe, it, before, after } from 'node:test'
import assert from 'node:assert'
import { staticAssetPlugin } from '../../../plugins/static-assets.js'
import { join } from 'node:path'
import { rm, mkdir, writeFile, readFile, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'

describe('staticAssetPlugin', () => {
  const tmpDir = join(process.cwd(), 'packages/coralite/tests/unit/plugins/tmp-static-assets')
  const outputDir = join(tmpDir, 'dist')
  const srcDir = join(tmpDir, 'src')

  before(async () => {
    if (existsSync(tmpDir)) {
      await rm(tmpDir, {
        recursive: true,
        force: true
      })
    }
    await mkdir(srcDir, { recursive: true })
    await writeFile(join(srcDir, 'test.txt'), 'hello world')
  })

  after(async () => {
    if (existsSync(tmpDir)) {
      await rm(tmpDir, {
        recursive: true,
        force: true
      })
    }
  })

  it('should throw an error if dest is missing', async () => {
    const plugin = staticAssetPlugin([{
      pkg: 'test-pkg',
      path: 'test-path'
    }])

    await assert.rejects(
      async () => {
        await plugin.server.onBeforeBuild({ app: { options: { output: '/dist' } } })
      },
      /staticAssetPlugin requires assets to have a dest property\./
    )
  })

  it('should throw an error if src is missing and pkg or path is missing', async () => {
    const plugin = staticAssetPlugin([{
      dest: 'test-dest',
      path: 'test-path'
    }])

    await assert.rejects(
      async () => {
        await plugin.server.onBeforeBuild({ app: { options: { output: '/dist' } } })
      },
      /staticAssetPlugin requires assets to have pkg and path state when src is not provided\./
    )
  })

  it('should handle concurrent onBeforeBuild calls without race conditions', async () => {
    const srcFile = join(srcDir, 'test.txt')
    const destRelPath = 'assets/test.txt'
    const destFile = join(outputDir, destRelPath)

    const plugin = staticAssetPlugin([{
      src: srcFile,
      dest: destRelPath
    }])

    const context = {
      app: {
        options: {
          output: outputDir
        }
      }
    }

    // Run multiple concurrent calls
    await Promise.all([
      plugin.server.onBeforeBuild(context),
      plugin.server.onBeforeBuild(context),
      plugin.server.onBeforeBuild(context)
    ])

    assert.strictEqual(existsSync(destFile), true)
    const content = await readFile(destFile, 'utf8')
    assert.strictEqual(content, 'hello world')
  })

  it('should skip copy if mtime and size match', async () => {
    const srcFile = join(srcDir, 'test.txt')
    const destRelPath = 'assets/test-skip.txt'
    const destFile = join(outputDir, destRelPath)

    const plugin = staticAssetPlugin([{
      src: srcFile,
      dest: destRelPath
    }])

    const context = {
      app: {
        options: {
          output: outputDir
        }
      }
    }

    // First run to copy the file
    await plugin.server.onBeforeBuild(context)
    const firstStat = await stat(destFile)

    // Second run should skip
    await plugin.server.onBeforeBuild(context)
    const secondStat = await stat(destFile)

    assert.strictEqual(Math.floor(firstStat.mtimeMs), Math.floor(secondStat.mtimeMs))
    assert.strictEqual(firstStat.size, secondStat.size)
  })

  it('should update if source file changes', async () => {
    const srcFile = join(srcDir, 'test-update.txt')
    await writeFile(srcFile, 'initial')
    const destRelPath = 'assets/test-update.txt'
    const destFile = join(outputDir, destRelPath)

    const plugin = staticAssetPlugin([{
      src: srcFile,
      dest: destRelPath
    }])

    const context = {
      app: {
        options: {
          output: outputDir
        }
      }
    }

    await plugin.server.onBeforeBuild(context)
    assert.strictEqual(await readFile(destFile, 'utf8'), 'initial')

    // Update source
    await new Promise(resolve => setTimeout(resolve, 1000))
    await writeFile(srcFile, 'updated content')

    await plugin.server.onBeforeBuild(context)
    assert.strictEqual(await readFile(destFile, 'utf8'), 'updated content')
  })

  it('should warn on destination collision', async () => {
    const src1 = join(srcDir, 'test.txt')
    const src2 = join(srcDir, 'other.txt')
    await writeFile(src2, 'other')
    const destRelPath = 'assets/collision.txt'

    const plugin = staticAssetPlugin([
      {
        src: src1,
        dest: destRelPath
      },
      {
        src: src2,
        dest: destRelPath
      }
    ])

    const context = {
      app: { options: { output: outputDir } }
    }

    const warnings = []
    const originalWarn = console.warn
    console.warn = (msg) => warnings.push(msg)

    try {
      await plugin.server.onBeforeBuild(context)
    } finally {
      console.warn = originalWarn
    }

    assert.ok(warnings.some(w => w.includes('Destination collision')))
  })

  it('should warn if source is missing', async () => {
    const src = join(srcDir, 'missing.txt')
    const destRelPath = 'assets/missing.txt'

    const plugin = staticAssetPlugin([{
      src,
      dest: destRelPath
    }])
    const context = {
      app: { options: { output: outputDir } }
    }

    const warnings = []
    const originalWarn = console.warn
    console.warn = (msg) => warnings.push(msg)

    try {
      await plugin.server.onBeforeBuild(context)
    } finally {
      console.warn = originalWarn
    }

    assert.ok(warnings.some(w => w.includes('Source file not found')))
  })

  it('should always copy directories (no mtime skip)', async () => {
    const nestedDir = join(srcDir, 'nested')
    await mkdir(nestedDir, { recursive: true })
    const nestedFile = join(nestedDir, 'file.txt')
    await writeFile(nestedFile, 'v1')

    const destRelPath = 'assets/nested'
    const destFile = join(outputDir, 'assets/nested/file.txt')

    const plugin = staticAssetPlugin([{
      src: nestedDir,
      dest: destRelPath
    }])
    const context = {
      app: { options: { output: outputDir } }
    }

    await plugin.server.onBeforeBuild(context)
    assert.strictEqual(await readFile(destFile, 'utf8'), 'v1')

    // Update file deep inside directory
    await new Promise(resolve => setTimeout(resolve, 1000))
    await writeFile(nestedFile, 'v2')

    // Directory mtime might not change, but we should copy anyway
    await plugin.server.onBeforeBuild(context)
    assert.strictEqual(await readFile(destFile, 'utf8'), 'v2')
  })
})
