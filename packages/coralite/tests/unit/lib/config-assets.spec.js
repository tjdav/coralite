import assert from 'node:assert/strict'
import { test, describe } from 'node:test'
import { defineConfig } from '../../../lib/config.js'
import { createCoralite } from '../../../lib/coralite.js'
import { CoraliteError } from '../../../lib/utils/errors.js'
import { rm, readFile } from 'node:fs/promises'
import { join } from 'node:path'

describe('Config Asset Validation & registerAsset', () => {
  const tmpDir = join(process.cwd(), 'tests/fixtures/.tmp-config-assets')

  test('validates assets schema in defineConfig', () => {
    assert.throws(() => {
      defineConfig({
        components: 'components',
        pages: 'pages',
        output: 'dist',
        assets: 'not-an-array'
      })
    }, /Config property "assets" must be an array/)

    assert.throws(() => {
      defineConfig({
        components: 'components',
        pages: 'pages',
        output: 'dist',
        assets: [{ dest: '' }]
      })
    }, /must have a non-empty string "dest" property/)

    assert.throws(() => {
      defineConfig({
        components: 'components',
        pages: 'pages',
        output: 'dist',
        assets: [{ dest: 'assets/app.js' }]
      })
    }, /must specify either "src", "content", or both "pkg" and "path"/)

    assert.throws(() => {
      defineConfig({
        components: 'components',
        pages: 'pages',
        output: 'dist',
        assets: [{
          dest: 'assets/data.woff2',
          content: 'binary',
          inject: true
        }]
      })
    }, /has an un-inferable file extension/)

    assert.throws(() => {
      defineConfig({
        components: 'components',
        pages: 'pages',
        output: 'dist',
        assets: [{
          dest: 'assets/styles.custom',
          content: 'color: red',
          inject: { type: 'link' }
        }]
      })
    }, /requires "rel" property/)

    assert.throws(() => {
      defineConfig({
        components: 'components',
        pages: 'pages',
        output: 'dist',
        assets: [{
          dest: 'assets/meta.json',
          content: 'meta',
          inject: { type: 'meta' }
        }]
      })
    }, /requires "name" or "http-equiv", and "content"/)

    assert.doesNotThrow(() => {
      defineConfig({
        components: 'components',
        pages: 'pages',
        output: 'dist',
        assets: [{
          dest: 'assets/app.js',
          content: 'console.log("hi")',
          inject: {
            type: 'script',
            placement: 'body-end',
            sri: true
          }
        }]
      })
    })
  })

  test('app.registerAsset writes content asset and registers injection', async () => {
    const app = await createCoralite({
      components: 'tests/fixtures/components',
      pages: 'tests/fixtures/pages',
      output: tmpDir
    })

    const fullPath = await app.registerAsset({
      dest: 'assets/custom.js',
      content: 'console.log("registered");',
      inject: {
        type: 'script',
        placement: 'head-start'
      }
    })

    const written = await readFile(fullPath, 'utf8')
    assert.equal(written, 'console.log("registered");')
    assert.ok(app.options.assets.some(a => a.dest === 'assets/custom.js'))

    await rm(tmpDir, { recursive: true, force: true })
  })

  test('app.registerAsset respects user config precedence on dest collision', async () => {
    let warningLogged = false
    const app = await createCoralite({
      components: 'tests/fixtures/components',
      pages: 'tests/fixtures/pages',
      output: tmpDir,
      assets: [{
        dest: 'assets/collision.js',
        content: 'user content',
        inject: true
      }],
      onError: (data) => {
        if (data.level === 'WARN' && data.message.includes('Asset destination collision')) {
          warningLogged = true
        }
      }
    })

    await app.registerAsset({
      dest: 'assets/collision.js',
      content: 'plugin content'
    })

    assert.ok(warningLogged)
    await rm(tmpDir, { recursive: true, force: true })
  })
})
