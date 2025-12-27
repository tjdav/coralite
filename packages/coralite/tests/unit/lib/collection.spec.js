import { describe, it, beforeEach, afterEach } from 'node:test'
import { strict as assert } from 'node:assert'
import CoraliteCollection from '../../../lib/collection.js'
import path from 'node:path'
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'

describe('CoraliteCollection', () => {
  /** @type {string} */
  let testDir
  /** @type {CoraliteCollection} */
  let collection

  beforeEach(async () => {
    // Create a temporary directory for testing
    testDir = await mkdtemp(path.join(tmpdir(), 'coralite-test-'))

    // Create some test files
    await writeFile(path.join(testDir, 'page1.html'), '<h1>Page 1</h1>')
    await writeFile(path.join(testDir, 'page2.html'), '<h1>Page 2</h1>')

    // Create subdirectory
    const subDir = path.join(testDir, 'posts')
    await mkdir(subDir, { recursive: true })
    await writeFile(path.join(subDir, 'post1.html'), '<h1>Post 1</h1>')

    collection = new CoraliteCollection({ rootDir: testDir })
  })

  afterEach(async () => {
    await rm(testDir, {
      recursive: true,
      force: true
    })
  })

  describe('setItem', () => {
    it('should add a new item to the collection', async () => {
      const item = {
        type: 'page',
        content: '<h1>Test</h1>',
        path: {
          pathname: path.join(testDir, 'test.html'),
          dirname: testDir,
          filename: 'test.html'
        }
      }

      const result = await collection.setItem(item)

      assert.deepStrictEqual(result, item)
      assert.strictEqual(collection.collection[item.path.pathname], item)
      assert.ok(collection.list.includes(item))
      assert.ok(collection.listByPath[testDir].includes(item))
    })

    it('should handle string path input', async () => {
      const result = await collection.setItem(path.join(testDir, 'page1.html'))

      assert.strictEqual(result.content, '<h1>Page 1</h1>')
      assert.strictEqual(collection.list.length, 1)
    })

    it('should call onSet hook and handle result', async () => {
      let hookCalled = false
      const collectionWithHook = new CoraliteCollection({
        rootDir: testDir,
        onSet: async (value) => {
          hookCalled = true
          return {
            value: 'hook-result',
            type: 'page',
            id: 'custom-id'
          }
        }
      })

      const item = {
        type: 'page',
        content: '<h1>Test</h1>',
        path: {
          pathname: path.join(testDir, 'test.html'),
          dirname: testDir,
          filename: 'test.html'
        }
      }

      const result = await collectionWithHook.setItem(item)

      assert.strictEqual(hookCalled, true)
      assert.strictEqual(result.result, 'hook-result')
      assert.strictEqual(result.type, 'page')
      assert.strictEqual(collectionWithHook.collection['custom-id'], result)
      assert.strictEqual(collectionWithHook.collection[item.path.pathname], result)
    })

    it('should abort if onSet returns falsy', async () => {
      const collectionWithHook = new CoraliteCollection({
        rootDir: testDir,
        onSet: async () => false
      })

      const item = {
        type: 'page',
        content: '<h1>Test</h1>',
        path: {
          pathname: path.join(testDir, 'test.html'),
          dirname: testDir,
          filename: 'test.html'
        }
      }

      const result = await collectionWithHook.setItem(item)

      assert.strictEqual(result, undefined)
      assert.strictEqual(collectionWithHook.list.length, 0)
    })

    it('should update existing item instead of adding duplicate', async () => {
      const item = {
        type: 'page',
        content: '<h1>Test</h1>',
        path: {
          pathname: path.join(testDir, 'test.html'),
          dirname: testDir,
          filename: 'test.html'
        }
      }

      await collection.setItem(item)
      const initialLength = collection.list.length

      // Try to add same item again
      const updatedItem = {
        ...item,
        content: '<h1>Updated</h1>'
      }
      const result = await collection.setItem(updatedItem)

      assert.strictEqual(collection.list.length, initialLength)
      assert.strictEqual(collection.collection[item.path.pathname].content, '<h1>Updated</h1>')
    })

    it('should prevent duplicate entries in lists', async () => {
      const item = {
        type: 'page',
        content: '<h1>Test</h1>',
        path: {
          pathname: path.join(testDir, 'test.html'),
          dirname: testDir,
          filename: 'test.html'
        }
      }

      await collection.setItem(item)
      const initialListLength = collection.list.length
      const initialPathListLength = collection.listByPath[testDir].length

      // Try to add the same item again
      await collection.setItem(item)

      assert.strictEqual(collection.list.length, initialListLength)
      assert.strictEqual(collection.listByPath[testDir].length, initialPathListLength)
    })

    it('should throw error for invalid input', async () => {
      await assert.rejects(
        () => collection.setItem(null),
        { message: 'Valid HTMLData object must be provided' }
      )
      await assert.rejects(
        () => collection.setItem({}),
        { message: 'Valid HTMLData object must be provided' }
      )
    })
  })

  describe('updateItem', () => {
    it('should update existing item properties', async () => {
      const item = {
        type: 'page',
        content: '<h1>Original</h1>',
        values: { key: 'value1' },
        path: {
          pathname: path.join(testDir, 'test.html'),
          dirname: testDir,
          filename: 'test.html'
        }
      }

      await collection.setItem(item)

      const updatedItem = {
        ...item,
        content: '<h1>Updated</h1>',
        values: { key: 'value2' },
        type: 'template'
      }

      const result = await collection.updateItem(updatedItem)

      assert.strictEqual(result.content, '<h1>Updated</h1>')
      assert.deepStrictEqual(result.values, { key: 'value2' })
      assert.strictEqual(result.type, 'template')
    })

    it('should call onUpdate hook and handle result', async () => {
      let hookCalled = false
      const collectionWithHook = new CoraliteCollection({
        rootDir: testDir,
        onUpdate: async (newValue, oldValue) => {
          hookCalled = true
          return 'update-result'
        }
      })

      const item = {
        type: 'page',
        content: '<h1>Original</h1>',
        path: {
          pathname: path.join(testDir, 'test.html'),
          dirname: testDir,
          filename: 'test.html'
        }
      }

      await collectionWithHook.setItem(item)

      const updatedItem = {
        ...item,
        content: '<h1>Updated</h1>'
      }
      const result = await collectionWithHook.updateItem(updatedItem)

      assert.strictEqual(hookCalled, true)
      assert.strictEqual(result.result, 'update-result')
    })

    it('should abort update if hook returns falsy', async () => {
      const collectionWithHook = new CoraliteCollection({
        rootDir: testDir,
        onUpdate: async () => false
      })

      const item = {
        type: 'page',
        content: '<h1>Original</h1>',
        path: {
          pathname: path.join(testDir, 'test.html'),
          dirname: testDir,
          filename: 'test.html'
        }
      }

      await collectionWithHook.setItem(item)
      const originalContent = collectionWithHook.collection[item.path.pathname].content

      const updatedItem = {
        ...item,
        content: '<h1>Updated</h1>'
      }
      await collectionWithHook.updateItem(updatedItem)

      assert.strictEqual(collectionWithHook.collection[item.path.pathname].content, originalContent)
    })

    it('should add item if it does not exist', async () => {
      const item = {
        type: 'page',
        content: '<h1>New</h1>',
        path: {
          pathname: path.join(testDir, 'new.html'),
          dirname: testDir,
          filename: 'new.html'
        }
      }

      const result = await collection.updateItem(item)

      assert.strictEqual(collection.list.length, 1)
      assert.strictEqual(collection.collection[item.path.pathname], result)
    })

    it('should throw error for invalid input', async () => {
      await assert.rejects(
        () => collection.updateItem(null),
        { message: 'Valid HTMLData object must be provided' }
      )
      await assert.rejects(
        () => collection.updateItem({}),
        { message: 'Valid HTMLData object must be provided' }
      )
    })
  })

  describe('deleteItem', () => {
    it('should remove item from collection by HTMLData object', async () => {
      const item = {
        type: 'page',
        content: '<h1>Test</h1>',
        path: {
          pathname: path.join(testDir, 'test.html'),
          dirname: testDir,
          filename: 'test.html'
        }
      }

      await collection.setItem(item)
      assert.strictEqual(collection.list.length, 1)

      await collection.deleteItem(item)

      assert.strictEqual(collection.list.length, 0)
      assert.strictEqual(collection.collection[item.path.pathname], undefined)
      assert.strictEqual(collection.listByPath[testDir], undefined)
    })

    it('should remove item from collection by pathname string', async () => {
      const item = {
        type: 'page',
        content: '<h1>Test</h1>',
        path: {
          pathname: path.join(testDir, 'test.html'),
          dirname: testDir,
          filename: 'test.html'
        }
      }

      await collection.setItem(item)
      await collection.deleteItem(item.path.pathname)

      assert.strictEqual(collection.list.length, 0)
      assert.strictEqual(collection.collection[item.path.pathname], undefined)
    })

    it('should call onDelete hook', async () => {
      let hookCalled = false
      let hookValue = null
      const collectionWithHook = new CoraliteCollection({
        rootDir: testDir,
        onDelete: async (value) => {
          hookCalled = true
          hookValue = value
        }
      })

      const item = {
        type: 'page',
        content: '<h1>Test</h1>',
        path: {
          pathname: path.join(testDir, 'test.html'),
          dirname: testDir,
          filename: 'test.html'
        }
      }

      await collectionWithHook.setItem(item)
      await collectionWithHook.deleteItem(item)

      assert.strictEqual(hookCalled, true)
      assert.strictEqual(hookValue, item)
    })

    it('should handle items stored under different IDs', async () => {
      const collectionWithHook = new CoraliteCollection({
        rootDir: testDir,
        onSet: async () => ({
          value: 'result',
          id: 'custom-id'
        })
      })

      const item = {
        type: 'page',
        content: '<h1>Test</h1>',
        path: {
          pathname: path.join(testDir, 'test.html'),
          dirname: testDir,
          filename: 'test.html'
        }
      }

      await collectionWithHook.setItem(item)
      assert.ok(collectionWithHook.collection['custom-id'])
      assert.ok(collectionWithHook.collection[item.path.pathname])

      await collectionWithHook.deleteItem(item)

      assert.strictEqual(collectionWithHook.collection['custom-id'], undefined)
      assert.strictEqual(collectionWithHook.collection[item.path.pathname], undefined)
      assert.strictEqual(collectionWithHook.list.length, 0)
    })

    it('should clean up empty directory arrays', async () => {
      const item = {
        type: 'page',
        content: '<h1>Test</h1>',
        path: {
          pathname: path.join(testDir, 'test.html'),
          dirname: testDir,
          filename: 'test.html'
        }
      }

      await collection.setItem(item)
      assert.ok(collection.listByPath[testDir])

      await collection.deleteItem(item)
      assert.strictEqual(collection.listByPath[testDir], undefined)
    })

    it('should handle non-existent items gracefully', async () => {
      const item = {
        type: 'page',
        content: '<h1>Test</h1>',
        path: {
          pathname: path.join(testDir, 'nonexistent.html'),
          dirname: testDir,
          filename: 'nonexistent.html'
        }
      }

      // Should not throw
      await collection.deleteItem(item)
      // No assertion needed, just checking it doesn't throw
    })

    it('should throw error for invalid input', async () => {
      await assert.rejects(
        () => collection.deleteItem(null),
        { message: 'Valid pathname must be provided' }
      )
      await assert.rejects(
        () => collection.deleteItem({}),
        { message: 'Valid pathname must be provided' }
      )
    })
  })

  describe('getItem', () => {
    it('should retrieve item by pathname', async () => {
      const item = {
        type: 'page',
        content: '<h1>Test</h1>',
        path: {
          pathname: path.join(testDir, 'test.html'),
          dirname: testDir,
          filename: 'test.html'
        }
      }

      await collection.setItem(item)
      const retrieved = collection.getItem(item.path.pathname)

      assert.strictEqual(retrieved, item)
    })

    it('should retrieve item by custom ID', async () => {
      const collectionWithHook = new CoraliteCollection({
        rootDir: testDir,
        onSet: async () => ({
          value: 'result',
          id: 'custom-id'
        })
      })

      const item = {
        type: 'page',
        content: '<h1>Test</h1>',
        path: {
          pathname: path.join(testDir, 'test.html'),
          dirname: testDir,
          filename: 'test.html'
        }
      }

      await collectionWithHook.setItem(item)
      const retrieved = collectionWithHook.getItem('custom-id')

      assert.strictEqual(retrieved, collectionWithHook.collection['custom-id'])
    })

    it('should handle HTML extension for relative paths', async () => {
      const item = {
        type: 'page',
        content: '<h1>Test</h1>',
        path: {
          pathname: path.join(testDir, 'test.html'),
          dirname: testDir,
          filename: 'test.html'
        }
      }

      await collection.setItem(item)
      const retrieved = collection.getItem('test.html')

      assert.strictEqual(retrieved, item)
    })
  })

  describe('getListByPath', () => {
    it('should return a copy of the directory list', async () => {
      const item1 = {
        type: 'page',
        content: '<h1>Test 1</h1>',
        path: {
          pathname: path.join(testDir, 'test1.html'),
          dirname: testDir,
          filename: 'test1.html'
        }
      }

      const item2 = {
        type: 'page',
        content: '<h1>Test 2</h1>',
        path: {
          pathname: path.join(testDir, 'test2.html'),
          dirname: testDir,
          filename: 'test2.html'
        }
      }

      await collection.setItem(item1)
      await collection.setItem(item2)

      const list = collection.getListByPath(testDir)
      assert.deepStrictEqual(list, [item1, item2])

      // Verify it's a copy
      list.push({ test: 'item' })
      assert.strictEqual(collection.listByPath[testDir].length, 2)
    })

    it('should return undefined for non-existent directory', () => {
      const result = collection.getListByPath('/non/existent')
      assert.strictEqual(result, undefined)
    })
  })
})
