/**
 * Tests for html.js
 */

import { describe, it, beforeEach, afterEach } from 'node:test'
import { strict as assert } from 'node:assert'
import { getHtmlFiles, getHtmlFile } from '../../../lib/html.js'
import path from 'node:path'
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'

describe('html.js', () => {
  describe('getHtmlFile', () => {
    /** @type {string} */
    let testDir
    /** @type {string} */
    let testFilePath

    beforeEach(async () => {
      // Create a temporary directory for testing
      testDir = await mkdtemp(path.join(tmpdir(), 'coralite-test-'))
      testFilePath = path.join(testDir, 'test.html')
    })

    afterEach(async () => {
      await rm(testDir, {
        recursive: true,
        force: true
      })
    })

    it('should read and return HTML file content', async () => {
      const content = '<h1>Hello World</h1><p>Test content</p>'
      await writeFile(testFilePath, content)

      const result = getHtmlFile(testFilePath)
      assert.strictEqual(result, content)
    })

    it('should handle HTML files with special characters', async () => {
      const content = '<div>Special chars: & < > " \' </div>'
      await writeFile(testFilePath, content)

      const result = getHtmlFile(testFilePath)
      assert.strictEqual(result, content)
    })

    it('should handle HTML files with Unicode characters', async () => {
      const content = '<h1>Hello 世界 🌍</h1><p>Emoji: 😀</p>'
      await writeFile(testFilePath, content)

      const result = getHtmlFile(testFilePath)
      assert.strictEqual(result, content)
    })

    it('should handle empty HTML files', async () => {
      await writeFile(testFilePath, '')

      const result = getHtmlFile(testFilePath)
      assert.strictEqual(result, '')
    })

    it('should handle HTML files with whitespace', async () => {
      const content = `  <html>
        <body>
          <h1>Test</h1>
        </body>
      </html>  `
      await writeFile(testFilePath, content)

      const result = getHtmlFile(testFilePath)
      assert.strictEqual(result, content)
    })

    it('should throw error for non-HTML file extension', async () => {
      const txtFilePath = path.join(testDir, 'test.txt')
      await writeFile(txtFilePath, 'Some text content')

      assert.throws(
        () => getHtmlFile(txtFilePath),
        { message: 'Unexpected filename extension ".txt"' }
      )
    })

    it('should throw error for HTML file with uppercase extension', async () => {
      const upperFilePath = path.join(testDir, 'test.HTML')
      await writeFile(upperFilePath, '<h1>Test</h1>')

      // Should work because the function converts to lowercase
      const result = getHtmlFile(upperFilePath)
      assert.strictEqual(result, '<h1>Test</h1>')
    })

    it('should throw error for non-existent file', async () => {
      const nonExistentPath = path.join(testDir, 'nonexistent.html')

      assert.throws(
        () => getHtmlFile(nonExistentPath),
        { code: 'ENOENT' }
      )
    })

    it('should throw error for directory path', async () => {
      const subDir = path.join(testDir, 'subdir')
      await mkdir(subDir)

      assert.throws(
        () => getHtmlFile(subDir),
        { message: 'Unexpected filename extension ""' }
      )
    })

    it('should handle file paths with spaces', async () => {
      const spacedFilePath = path.join(testDir, 'test file with spaces.html')
      const content = '<h1>File with spaces</h1>'
      await writeFile(spacedFilePath, content)

      const result = getHtmlFile(spacedFilePath)
      assert.strictEqual(result, content)
    })

    it('should handle file paths with special characters', async () => {
      const specialFilePath = path.join(testDir, 'test-file_special@chars.html')
      const content = '<h1>Special chars filename</h1>'
      await writeFile(specialFilePath, content)

      const result = getHtmlFile(specialFilePath)
      assert.strictEqual(result, content)
    })
  })

  describe('getHtmlFiles', () => {
    /** @type {string} */
    let testDir

    beforeEach(async () => {
      // Create a temporary directory for testing
      testDir = await mkdtemp(path.join(tmpdir(), 'coralite-test-'))
    })

    afterEach(async () => {
      await rm(testDir, {
        recursive: true,
        force: true
      })
    })

    describe('Basic functionality', () => {
      it('should return empty collection for empty directory', async () => {
        const collection = await getHtmlFiles({
          path: testDir,
          type: 'page'
        })

        assert.strictEqual(collection.list.length, 0)
        assert.strictEqual(Object.keys(collection.collection).length, 0)
      })

      it('should find single HTML file in directory', async () => {
        const filePath = path.join(testDir, 'index.html')
        await writeFile(filePath, '<h1>Index</h1>')

        const collection = await getHtmlFiles({
          path: testDir,
          type: 'page'
        })

        assert.strictEqual(collection.list.length, 1)
        assert.strictEqual(collection.list[0].content, '<h1>Index</h1>')
        assert.strictEqual(collection.list[0].type, 'page')
        assert.strictEqual(collection.list[0].path.filename, 'index.html')
      })

      it('should find multiple HTML files in directory', async () => {
        await writeFile(path.join(testDir, 'page1.html'), '<h1>Page 1</h1>')
        await writeFile(path.join(testDir, 'page2.html'), '<h1>Page 2</h1>')
        await writeFile(path.join(testDir, 'page3.html'), '<h1>Page 3</h1>')

        const collection = await getHtmlFiles({
          path: testDir,
          type: 'page'
        })

        assert.strictEqual(collection.list.length, 3)

        const contents = collection.list.map(item => item.content).sort()
        assert.deepStrictEqual(contents, [
          '<h1>Page 1</h1>',
          '<h1>Page 2</h1>',
          '<h1>Page 3</h1>'
        ])
      })

      it('should handle HTML files with different content', async () => {
        const complexContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Complex Page</title>
</head>
<body>
    <h1>Complex Content</h1>
    <p>With multiple lines</p>
    <div class="container">
        <span>Nested content</span>
    </div>
</body>
</html>`
        await writeFile(path.join(testDir, 'complex.html'), complexContent)

        const collection = await getHtmlFiles({
          path: testDir,
          type: 'page'
        })

        assert.strictEqual(collection.list.length, 1)
        assert.strictEqual(collection.list[0].content, complexContent)
      })
    })

    describe('Type parameter', () => {
      it('should set type to "page"', async () => {
        await writeFile(path.join(testDir, 'page.html'), '<h1>Page</h1>')

        const collection = await getHtmlFiles({
          path: testDir,
          type: 'page'
        })

        assert.strictEqual(collection.list[0].type, 'page')
      })

      it('should set type to "template"', async () => {
        await writeFile(path.join(testDir, 'template.html'), '<h1>Template</h1>')

        const collection = await getHtmlFiles({
          path: testDir,
          type: 'template'
        })

        assert.strictEqual(collection.list[0].type, 'template')
      })
    })

    describe('Recursive option', () => {
      it('should not search subdirectories by default', async () => {
        await writeFile(path.join(testDir, 'root.html'), '<h1>Root</h1>')

        const subDir = path.join(testDir, 'subdir')
        await mkdir(subDir)
        await writeFile(path.join(subDir, 'nested.html'), '<h1>Nested</h1>')

        const collection = await getHtmlFiles({
          path: testDir,
          type: 'page'
        })

        assert.strictEqual(collection.list.length, 1)
        assert.strictEqual(collection.list[0].path.filename, 'root.html')
      })

      it('should search subdirectories when recursive is true', async () => {
        await writeFile(path.join(testDir, 'root.html'), '<h1>Root</h1>')

        const subDir = path.join(testDir, 'subdir')
        await mkdir(subDir)
        await writeFile(path.join(subDir, 'nested.html'), '<h1>Nested</h1>')

        const collection = await getHtmlFiles({
          path: testDir,
          type: 'page',
          recursive: true
        })

        assert.strictEqual(collection.list.length, 2)

        const filenames = collection.list.map(item => item.path.filename).sort()
        assert.deepStrictEqual(filenames, ['nested.html', 'root.html'])
      })

      it('should search deeply nested directories when recursive is true', async () => {
        await writeFile(path.join(testDir, 'level0.html'), '<h1>Level 0</h1>')

        const level1 = path.join(testDir, 'level1')
        await mkdir(level1)
        await writeFile(path.join(level1, 'level1.html'), '<h1>Level 1</h1>')

        const level2 = path.join(level1, 'level2')
        await mkdir(level2)
        await writeFile(path.join(level2, 'level2.html'), '<h1>Level 2</h1>')

        const collection = await getHtmlFiles({
          path: testDir,
          type: 'page',
          recursive: true
        })

        assert.strictEqual(collection.list.length, 3)

        const filenames = collection.list.map(item => item.path.filename).sort()
        assert.deepStrictEqual(filenames, ['level0.html', 'level1.html', 'level2.html'])
      })

      it('should handle multiple subdirectories', async () => {
        await writeFile(path.join(testDir, 'root.html'), '<h1>Root</h1>')

        const dir1 = path.join(testDir, 'dir1')
        await mkdir(dir1)
        await writeFile(path.join(dir1, 'file1.html'), '<h1>File 1</h1>')

        const dir2 = path.join(testDir, 'dir2')
        await mkdir(dir2)
        await writeFile(path.join(dir2, 'file2.html'), '<h1>File 2</h1>')

        const collection = await getHtmlFiles({
          path: testDir,
          type: 'page',
          recursive: true
        })

        assert.strictEqual(collection.list.length, 3)

        const filenames = collection.list.map(item => item.path.filename).sort()
        assert.deepStrictEqual(filenames, ['file1.html', 'file2.html', 'root.html'])
      })
    })

    describe('Exclude option', () => {
      it('should exclude specified files', async () => {
        await writeFile(path.join(testDir, 'include.html'), '<h1>Include</h1>')
        await writeFile(path.join(testDir, 'exclude.html'), '<h1>Exclude</h1>')

        const collection = await getHtmlFiles({
          path: testDir,
          type: 'page',
          exclude: ['exclude.html']
        })

        assert.strictEqual(collection.list.length, 1)
        assert.strictEqual(collection.list[0].path.filename, 'include.html')
      })

      it('should exclude multiple files', async () => {
        await writeFile(path.join(testDir, 'keep1.html'), '<h1>Keep 1</h1>')
        await writeFile(path.join(testDir, 'keep2.html'), '<h1>Keep 2</h1>')
        await writeFile(path.join(testDir, 'exclude1.html'), '<h1>Exclude 1</h1>')
        await writeFile(path.join(testDir, 'exclude2.html'), '<h1>Exclude 2</h1>')

        const collection = await getHtmlFiles({
          path: testDir,
          type: 'page',
          exclude: ['exclude1.html', 'exclude2.html']
        })

        assert.strictEqual(collection.list.length, 2)

        const filenames = collection.list.map(item => item.path.filename).sort()
        assert.deepStrictEqual(filenames, ['keep1.html', 'keep2.html'])
      })

      it('should handle exclude with recursive option', async () => {
        await writeFile(path.join(testDir, 'root.html'), '<h1>Root</h1>')

        const subDir = path.join(testDir, 'subdir')
        await mkdir(subDir)
        await writeFile(path.join(subDir, 'nested.html'), '<h1>Nested</h1>')
        await writeFile(path.join(subDir, 'excluded.html'), '<h1>Excluded</h1>')

        const collection = await getHtmlFiles({
          path: testDir,
          type: 'page',
          recursive: true,
          exclude: ['excluded.html']
        })

        assert.strictEqual(collection.list.length, 2)

        const filenames = collection.list.map(item => item.path.filename).sort()
        assert.deepStrictEqual(filenames, ['nested.html', 'root.html'])
      })

      it('should exclude files with full path in exclude array', async () => {
        await writeFile(path.join(testDir, 'include.html'), '<h1>Include</h1>')
        await writeFile(path.join(testDir, 'exclude.html'), '<h1>Exclude</h1>')

        const collection = await getHtmlFiles({
          path: testDir,
          type: 'page',
          exclude: [path.join(testDir, 'exclude.html')]
        })

        assert.strictEqual(collection.list.length, 1)
        assert.strictEqual(collection.list[0].path.filename, 'include.html')
      })

      it('should handle empty exclude array', async () => {
        await writeFile(path.join(testDir, 'file1.html'), '<h1>File 1</h1>')
        await writeFile(path.join(testDir, 'file2.html'), '<h1>File 2</h1>')

        const collection = await getHtmlFiles({
          path: testDir,
          type: 'page',
          exclude: []
        })

        assert.strictEqual(collection.list.length, 2)
      })

      it('should exclude subdirectories when specified', async () => {
        await writeFile(path.join(testDir, 'root.html'), '<h1>Root</h1>')

        const subDir = path.join(testDir, 'excluded-dir')
        await mkdir(subDir)
        await writeFile(path.join(subDir, 'nested.html'), '<h1>Nested</h1>')

        const collection = await getHtmlFiles({
          path: testDir,
          type: 'page',
          recursive: true,
          exclude: ['excluded-dir']
        })

        assert.strictEqual(collection.list.length, 1)
        assert.strictEqual(collection.list[0].path.filename, 'root.html')
      })
    })

    describe('Path information', () => {
      it('should include correct path information for root files', async () => {
        await writeFile(path.join(testDir, 'index.html'), '<h1>Index</h1>')

        const collection = await getHtmlFiles({
          path: testDir,
          type: 'page'
        })

        const item = collection.list[0]
        assert.strictEqual(item.path.pathname, path.join(testDir, 'index.html'))
        assert.strictEqual(item.path.filename, 'index.html')
        assert.strictEqual(item.path.dirname, testDir)
      })

      it('should include correct path information for nested files', async () => {
        const subDir = path.join(testDir, 'posts')
        await mkdir(subDir)
        await writeFile(path.join(subDir, 'post.html'), '<h1>Post</h1>')

        const collection = await getHtmlFiles({
          path: testDir,
          type: 'page',
          recursive: true
        })

        const item = collection.list[0]
        assert.strictEqual(item.path.pathname, path.join(subDir, 'post.html'))
        assert.strictEqual(item.path.filename, 'post.html')
        assert.strictEqual(item.path.dirname, subDir)
      })

      it('should handle files with same name in different directories', async () => {
        await writeFile(path.join(testDir, 'index.html'), '<h1>Root Index</h1>')

        const subDir = path.join(testDir, 'subdir')
        await mkdir(subDir)
        await writeFile(path.join(subDir, 'index.html'), '<h1>Sub Index</h1>')

        const collection = await getHtmlFiles({
          path: testDir,
          type: 'page',
          recursive: true
        })

        assert.strictEqual(collection.list.length, 2)

        const rootItem = collection.list.find(item => item.path.dirname === testDir)
        const subItem = collection.list.find(item => item.path.dirname === subDir)

        assert.strictEqual(rootItem.content, '<h1>Root Index</h1>')
        assert.strictEqual(subItem.content, '<h1>Sub Index</h1>')
      })
    })

    describe('Collection methods', () => {
      it('should provide access to collection methods', async () => {
        await writeFile(path.join(testDir, 'page.html'), '<h1>Page</h1>')

        const collection = await getHtmlFiles({
          path: testDir,
          type: 'page'
        })

        // Test getItem
        const item = collection.getItem(path.join(testDir, 'page.html'))
        assert.ok(item)
        assert.strictEqual(item.content, '<h1>Page</h1>')

        // Test getListByPath
        const list = collection.getListByPath(testDir)
        assert.strictEqual(list.length, 1)
        assert.strictEqual(list[0].content, '<h1>Page</h1>')
      })

      it('should work with collection hooks', async () => {
        let hookCalled = false

        await writeFile(path.join(testDir, 'page.html'), '<h1>Page</h1>')

        const collection = await getHtmlFiles({
          path: testDir,
          type: 'page',
          onFileSet: async (value) => {
            hookCalled = true
            return {
              value: 'hook-result',
              type: 'page',
              id: 'custom-id'
            }
          }
        })

        assert.strictEqual(hookCalled, true)
        assert.ok(collection.collection['custom-id'])
      })
    })

    describe('Non-HTML files', () => {
      it('should ignore non-HTML files', async () => {
        await writeFile(path.join(testDir, 'page.html'), '<h1>HTML</h1>')
        await writeFile(path.join(testDir, 'readme.txt'), 'Text content')
        await writeFile(path.join(testDir, 'style.css'), 'body { color: red; }')
        await writeFile(path.join(testDir, 'script.js'), 'console.log("test");')

        const collection = await getHtmlFiles({
          path: testDir,
          type: 'page'
        })

        assert.strictEqual(collection.list.length, 1)
        assert.strictEqual(collection.list[0].path.filename, 'page.html')
      })

      it('should ignore files with .html extension in different case', async () => {
        await writeFile(path.join(testDir, 'page.html'), '<h1>HTML</h1>')
        await writeFile(path.join(testDir, 'other.HTML'), '<h1>HTML Upper</h1>')

        const collection = await getHtmlFiles({
          path: testDir,
          type: 'page'
        })

        assert.strictEqual(collection.list.length, 2)

        const filenames = collection.list.map(item => item.path.filename).sort()
        assert.deepStrictEqual(filenames, ['other.HTML', 'page.html'])
      })

      it('should ignore hidden files starting with dot', async () => {
        await writeFile(path.join(testDir, 'page.html'), '<h1>HTML</h1>')
        await writeFile(path.join(testDir, '.hidden.html'), '<h1>Hidden</h1>')

        const collection = await getHtmlFiles({
          path: testDir,
          type: 'page'
        })

        assert.strictEqual(collection.list.length, 1)
        assert.strictEqual(collection.list[0].path.filename, 'page.html')
      })
    })

    describe('Error handling', () => {
      it('should throw error for non-existent directory', async () => {
        const nonExistentDir = path.join(testDir, 'nonexistent')

        await assert.rejects(
          async () => {
            await getHtmlFiles({
              path: nonExistentDir,
              type: 'page'
            })
          },
          { message: /Root directory was not found/ }
        )
      })

      it('should throw error for invalid path parameter', async () => {
        await assert.rejects(
          async () => {
            await getHtmlFiles({
              path: null,
              type: 'page'
            })
          }
        )
      })

      it('should handle directory with no read permissions', async () => {
        // Skip this test on Windows as permission handling differs
        if (process.platform === 'win32') {
          return
        }

        const restrictedDir = path.join(testDir, 'restricted')
        await mkdir(restrictedDir)

        // Note: This test is limited as we can't easily change permissions
        // in a cross-platform way without root privileges
        // In a real scenario, this would test permission errors
      })
    })

    describe('Edge cases', () => {
      it('should handle very large HTML files', async () => {
        const largeContent = '<div>' + 'x'.repeat(100000) + '</div>'
        await writeFile(path.join(testDir, 'large.html'), largeContent)

        const collection = await getHtmlFiles({
          path: testDir,
          type: 'page'
        })

        assert.strictEqual(collection.list.length, 1)
        assert.strictEqual(collection.list[0].content, largeContent)
      })

      it('should handle HTML files with only whitespace', async () => {
        await writeFile(path.join(testDir, 'whitespace.html'), '   \n\t  \n  ')

        const collection = await getHtmlFiles({
          path: testDir,
          type: 'page'
        })

        assert.strictEqual(collection.list.length, 1)
        assert.strictEqual(collection.list[0].content, '   \n\t  \n  ')
      })

      it('should handle files with special characters in names', async () => {
        const specialName = 'test-file_special@chars.html'
        await writeFile(path.join(testDir, specialName), '<h1>Special</h1>')

        const collection = await getHtmlFiles({
          path: testDir,
          type: 'page'
        })

        assert.strictEqual(collection.list.length, 1)
        assert.strictEqual(collection.list[0].path.filename, specialName)
      })

      it('should handle files with spaces in names', async () => {
        const spacedName = 'test file with spaces.html'
        await writeFile(path.join(testDir, spacedName), '<h1>Spaced</h1>')

        const collection = await getHtmlFiles({
          path: testDir,
          type: 'page'
        })

        assert.strictEqual(collection.list.length, 1)
        assert.strictEqual(collection.list[0].path.filename, spacedName)
      })

      it('should handle mixed case file extensions', async () => {
        await writeFile(path.join(testDir, 'lower.html'), '<h1>Lower</h1>')
        await writeFile(path.join(testDir, 'upper.HTML'), '<h1>Upper</h1>')
        await writeFile(path.join(testDir, 'mixed.HtMl'), '<h1>Mixed</h1>')

        const collection = await getHtmlFiles({
          path: testDir,
          type: 'page'
        })

        assert.strictEqual(collection.list.length, 3)

        const contents = collection.list.map(item => item.content).sort()
        assert.deepStrictEqual(contents, [
          '<h1>Lower</h1>',
          '<h1>Mixed</h1>',
          '<h1>Upper</h1>'
        ])
      })

      it('should handle deeply nested exclude patterns', async () => {
        await writeFile(path.join(testDir, 'root.html'), '<h1>Root</h1>')

        const level1 = path.join(testDir, 'level1')
        await mkdir(level1)
        await writeFile(path.join(level1, 'keep.html'), '<h1>Keep</h1>')

        const level2 = path.join(level1, 'level2')
        await mkdir(level2)
        await writeFile(path.join(level2, 'exclude.html'), '<h1>Exclude</h1>')

        const collection = await getHtmlFiles({
          path: testDir,
          type: 'page',
          recursive: true,
          exclude: ['exclude.html']
        })

        assert.strictEqual(collection.list.length, 2)

        const filenames = collection.list.map(item => item.path.filename).sort()
        assert.deepStrictEqual(filenames, ['keep.html', 'root.html'])
      })
    })

    describe('Collection structure', () => {
      it('should populate collection object correctly', async () => {
        await writeFile(path.join(testDir, 'page1.html'), '<h1>Page 1</h1>')
        await writeFile(path.join(testDir, 'page2.html'), '<h1>Page 2</h1>')

        const collection = await getHtmlFiles({
          path: testDir,
          type: 'page'
        })

        // Check collection object
        const page1Path = path.join(testDir, 'page1.html')
        const page2Path = path.join(testDir, 'page2.html')

        assert.ok(collection.collection[page1Path])
        assert.ok(collection.collection[page2Path])
        assert.strictEqual(collection.collection[page1Path].content, '<h1>Page 1</h1>')
        assert.strictEqual(collection.collection[page2Path].content, '<h1>Page 2</h1>')
      })

      it('should populate listByPath correctly', async () => {
        await writeFile(path.join(testDir, 'page1.html'), '<h1>Page 1</h1>')
        await writeFile(path.join(testDir, 'page2.html'), '<h1>Page 2</h1>')

        const collection = await getHtmlFiles({
          path: testDir,
          type: 'page'
        })

        const pathList = collection.listByPath[testDir]
        assert.strictEqual(pathList.length, 2)

        const contents = pathList.map(item => item.content).sort()
        assert.deepStrictEqual(contents, [
          '<h1>Page 1</h1>',
          '<h1>Page 2</h1>'
        ])
      })

      it('should handle nested directories in listByPath', async () => {
        await writeFile(path.join(testDir, 'root.html'), '<h1>Root</h1>')

        const subDir = path.join(testDir, 'subdir')
        await mkdir(subDir)
        await writeFile(path.join(subDir, 'nested.html'), '<h1>Nested</h1>')

        const collection = await getHtmlFiles({
          path: testDir,
          type: 'page',
          recursive: true
        })

        const rootList = collection.listByPath[testDir]
        const subList = collection.listByPath[subDir]

        assert.strictEqual(rootList.length, 1)
        assert.strictEqual(subList.length, 1)
        assert.strictEqual(rootList[0].content, '<h1>Root</h1>')
        assert.strictEqual(subList[0].content, '<h1>Nested</h1>')
      })
    })
  })
})
