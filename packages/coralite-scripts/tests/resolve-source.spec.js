import { test, describe } from 'node:test'
import assert from 'node:assert'
import { resolveSource } from '../libs/server.js'
import { join } from 'node:path'
import { writeFile, mkdir, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'

describe('resolveSource', () => {
  const pagesDir = join(process.cwd(), 'temp-pages')
  const config = { pages: pagesDir }
  const memoryPageSource = new Map()

  test.before(async () => {
    if (!existsSync(pagesDir)) {
      await mkdir(pagesDir)
    }
    await writeFile(join(pagesDir, 'index.html'), 'home')
    await writeFile(join(pagesDir, 'about.html'), 'about')
  })

  test.after(async () => {
    await rm(pagesDir, {
      recursive: true,
      force: true
    })
  })

  test('should resolve index.html for root path', async () => {
    const coralite = { pages: { getItem: () => null } }
    const result = await resolveSource('/', '', config, coralite, memoryPageSource)
    assert.strictEqual(result.key, 'index.html')
    assert.strictEqual(result.pathname, join(pagesDir, 'index.html'))
  })

  test('should resolve about.html for extension-less path', async () => {
    const coralite = { pages: { getItem: () => null } }
    const result = await resolveSource('/about', '', config, coralite, memoryPageSource)
    assert.strictEqual(result.key, 'about.html')
    assert.strictEqual(result.pathname, join(pagesDir, 'about.html'))
  })

  test('should resolve virtual page when file is missing on disk', async () => {
    const virtualPath = join(pagesDir, 'virtual.html')
    const coralite = {
      pages: {
        getItem: (path) => {
          if (path === virtualPath) {
            return { virtual: true }
          }
          return null
        }
      }
    }
    const result = await resolveSource('/virtual', '', config, coralite, memoryPageSource)
    assert.ok(result)
    assert.strictEqual(result.key, 'virtual.html')
    assert.strictEqual(result.pathname, virtualPath)
  })

  test('should return null if neither file nor virtual page exists', async () => {
    const coralite = { pages: { getItem: () => null } }
    const result = await resolveSource('/non-existent', '', config, coralite, memoryPageSource)
    assert.strictEqual(result, null)
  })

  test('should resolve from memoryPageSource as last resort', async () => {
    const coralite = { pages: { getItem: () => null } }
    const customKey = 'custom-memory-page.html'
    const customPath = join(pagesDir, 'hidden-source.html')
    memoryPageSource.set(customKey, customPath)

    const result = await resolveSource('/custom-memory-page', '', config, coralite, memoryPageSource)
    assert.ok(result)
    assert.strictEqual(result.key, customKey)
    assert.strictEqual(result.pathname, customPath)
  })
})
