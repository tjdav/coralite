import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert'
import { staticAssetPlugin } from '../../../plugins/static-assets.js'
import { join } from 'node:path'
import { mkdir, writeFile, readFile, stat, utimes } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createTestProject } from '../utils/project.js'

describe('staticAssetPlugin', () => {
  let project
  let tmpDir
  let outputDir
  let srcDir

  beforeEach(async () => {
    project = await createTestProject()
    tmpDir = project.testDir
    outputDir = project.outputDir
    srcDir = join(tmpDir, 'src')

    await mkdir(srcDir, { recursive: true })
    await writeFile(join(srcDir, 'test.txt'), 'hello world')
  })

  afterEach(async () => {
    await project.cleanup()
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

    // Update source with future mtime to avoid waiting
    const future = new Date(Date.now() + 2000)
    await writeFile(srcFile, 'updated content')
    await utimes(srcFile, future, future)

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
    const future = new Date(Date.now() + 2000)
    await writeFile(nestedFile, 'v2')
    // We don't necessarily need to update mtime of the file here because
    // directories are always copied, but it helps if the plugin check was different.
    // The key is that we don't WAIT 1000ms.
    await utimes(nestedFile, future, future)

    // Directory mtime might not change, but we should copy anyway
    await plugin.server.onBeforeBuild(context)
    assert.strictEqual(await readFile(destFile, 'utf8'), 'v2')
  })
})
