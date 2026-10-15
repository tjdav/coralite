import { describe, it, beforeEach, afterEach } from 'node:test'
import { strict as assert } from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { toTime, toMS, toCode, displayError, displaySuccess, displayInfo, displayWarning, deleteDirectoryRecursive, copyDirectory } from '../libs/build-utils.js'

describe('build-utils', () => {
  it('toTime should return formatted string', () => {
    const time = toTime()
    // CI environments might not support color
    assert.match(time, /\[(\u001b\[35m)?\d{2}:\d{2}:\d{2}\.\d{3}(\u001b\[39m)?\] /)
  })

  it('toMS should handle array and number', () => {
    assert.match(toMS([0, 1000000]), /(\u001b\[1m)?(\u001b\[37m)?1\.00ms(\u001b\[39m)?(\u001b\[22m)?/)
    assert.match(toMS(1.234), /(\u001b\[1m)?(\u001b\[37m)?1\.23ms(\u001b\[39m)?(\u001b\[22m)?/)
  })

  it('toCode should return colored status code', () => {
    assert.match(toCode(200), /(\u001b\[32m)?200(\u001b\[39m)?/)
    assert.match(toCode(301), /(\u001b\[33m)?301(\u001b\[39m)?/)
    assert.match(toCode(404), /(\u001b\[31m)?404(\u001b\[39m)?/)
  })

  describe('directory operations', () => {
    let tmpDir
    beforeEach(async () => {
      tmpDir = await mkdtemp(path.join(tmpdir(), 'scripts-test-'))
    })
    afterEach(async () => {
      await rm(tmpDir, {
        recursive: true,
        force: true
      })
    })

    it('copyDirectory and deleteDirectoryRecursive', async () => {
      const src = path.join(tmpDir, 'src')
      const dest = path.join(tmpDir, 'dest')
      await mkdir(src)
      await writeFile(path.join(src, 'file.txt'), 'hello')
      await mkdir(path.join(src, 'sub'))
      await writeFile(path.join(src, 'sub', 'inner.txt'), 'world')

      await copyDirectory(src, dest)
      assert.ok(fs.existsSync(path.join(dest, 'file.txt')))
      assert.ok(fs.existsSync(path.join(dest, 'sub', 'inner.txt')))

      deleteDirectoryRecursive(dest)
      assert.ok(!fs.existsSync(dest))

      // Test non-existent directory for deleteDirectoryRecursive
      deleteDirectoryRecursive(path.join(tmpDir, 'non-existent'))
    })
  })

  describe('display functions', () => {
    let originalWrite
    let output = ''

    beforeEach(() => {
      originalWrite = process.stdout.write
      output = ''
      process.stdout.write = (chunk) => {
        output += chunk
        return true
      }
    })

    afterEach(() => {
      process.stdout.write = originalWrite
    })

    it('displaySuccess, displayInfo, displayWarning', () => {
      displaySuccess('success')
      assert.ok(output.includes('SUCCESS'))
      assert.ok(output.includes('success'))
      output = ''

      displayInfo('info')
      assert.ok(output.includes('INFO'))
      assert.ok(output.includes('info'))
      output = ''

      displayWarning('warning')
      assert.ok(output.includes('WARNING'))
      assert.ok(output.includes('warning'))
    })

    it('displayError with basic error', () => {
      displayError('failed', new Error('raw error'))
      assert.ok(output.includes('ERROR'))
      assert.ok(output.includes('failed'))
      assert.ok(output.includes('raw error'))
    })

    it('displayError with CoraliteError', async () => {
      const tmpFile = path.join(tmpdir(), 'error-source.html')
      await writeFile(tmpFile, 'line 1\nline 2 (error)\nline 3')

      const coraliteError = {
        isCoraliteError: true,
        message: 'component fail',
        filePath: tmpFile,
        line: 2,
        column: 8,
        componentId: 'my-comp',
        instanceId: 'inst-1',
        pagePath: '/page.html',
        stack: 'Error: component fail\n    at context (/fake.js:1:1)'
      }

      displayError('Build failed', coraliteError)
      assert.ok(output.includes('Build failed'))
      assert.ok(output.includes('component fail'))
      assert.ok(output.includes('line 2 (error)'))
      assert.ok(output.includes('~'))
      // The output might have colors and formatting, so we check for the substring
      assert.ok(output.includes('ID:'))
      assert.ok(output.includes('my-comp'))

      await rm(tmpFile)
    })

    it('displayError with cause containing CoraliteError', () => {
      const coraliteError = {
        isCoraliteError: true,
        message: 'caused fail',
        filePath: '/path.html',
        line: 1
      }
      const wrapper = new Error('wrapper')
      wrapper.cause = coraliteError

      displayError('Wrapper failed', wrapper)
      assert.ok(output.includes('caused fail'))
    })

    it('displayError with string and object', () => {
      displayError('string error', 'just a string')
      assert.ok(output.includes('just a string'))

      output = ''
      displayError('object error', { foo: 'bar' })
      assert.ok(output.includes('"foo": "bar"'))
    })
  })
})
