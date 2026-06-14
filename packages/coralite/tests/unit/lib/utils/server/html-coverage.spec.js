import { describe, it, beforeEach, afterEach } from 'node:test'
import { strict as assert } from 'node:assert'
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getHtmlFiles, discoverHtmlFiles, getHtmlFileSync, getHtmlFile } from '../../../../../lib/utils/server/html.js'

describe('html.js Coverage Gaps', () => {
  let testDir

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'html-test-'))
  })

  afterEach(async () => {
    await rm(testDir, {
      recursive: true,
      force: true
    })
  })

  describe('getHtmlFiles', () => {
    it('should skip hidden files', async () => {
      await writeFile(join(testDir, '.hidden.html'), 'hidden')
      const collection = await getHtmlFiles({
        path: testDir,
        type: 'page'
      })
      assert.strictEqual(collection.list.length, 0)
    })

    it('should handle directory-based exclusions', async () => {
      const subDir = join(testDir, 'subdir')
      await mkdir(subDir)
      await mkdir(join(subDir, 'excluded'))
      await writeFile(join(subDir, 'excluded', 'test.html'), 'excluded')
      await writeFile(join(subDir, 'keep.html'), 'kept')

      const collection = await getHtmlFiles({
        path: subDir,
        type: 'page',
        recursive: true,
        exclude: ['excluded/']
      })
      assert.strictEqual(collection.list.length, 1)
      assert.ok(collection.getItem(join(subDir, 'keep.html')))
    })

    it('should handle discoverOnly', async () => {
      await writeFile(join(testDir, 'test.html'), 'content')
      const collection = await getHtmlFiles({
        path: testDir,
        type: 'page',
        discoverOnly: true
      })
      const item = collection.getItem('test.html')
      assert.strictEqual(item.content, undefined)
    })
  })

  describe('discoverHtmlFiles', () => {
    it('should yield files', async () => {
      await writeFile(join(testDir, 'test.html'), 'content')
      const generator = discoverHtmlFiles({
        path: testDir,
        type: 'page'
      })
      const results = []
      for await (const file of generator) {
        results.push(file)
      }
      assert.strictEqual(results.length, 1)
      assert.strictEqual(results[0].path.filename, 'test.html')
    })

    it('should skip hidden files in generator', async () => {
      await writeFile(join(testDir, '.hidden.html'), 'hidden')
      const generator = discoverHtmlFiles({
        path: testDir,
        type: 'page'
      })
      const results = []
      for await (const file of generator) {
        results.push(file)
      }
      assert.strictEqual(results.length, 0)
    })

    it('should handle exclusions and recursion in generator', async () => {
      await mkdir(join(testDir, 'sub'))
      await writeFile(join(testDir, 'sub', 'test.html'), 'content')
      await mkdir(join(testDir, 'ex'))
      await writeFile(join(testDir, 'ex', 'test.html'), 'content')

      const generator = discoverHtmlFiles({
        path: testDir,
        type: 'page',
        recursive: true,
        exclude: ['ex']
      })
      const results = []
      for await (const file of generator) {
        results.push(file)
      }
      assert.strictEqual(results.length, 1)
    })
  })

  describe('getHtmlFileSync and getHtmlFile', () => {
    it('should throw on unexpected extension', async () => {
      const file = join(testDir, 'test.txt')
      await writeFile(file, 'txt')

      assert.throws(() => getHtmlFileSync(file), /Unexpected filename extension/)
      await assert.rejects(() => getHtmlFile(file), /Unexpected filename extension/)
    })
  })
})
