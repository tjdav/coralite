import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { defineConfig } from '../../../../lib/server/config.js'
import { createCoralite } from '../../../../lib/server/create.js'
import { mkdtemp, rm, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

describe('config-schema.spec.js - Unified config schema validation', () => {
  it('validates required keys output, components, pages', () => {
    assert.throws(
      () => defineConfig({
        components: 'c',
        pages: 'p'
      }),
      /Missing required config property: "output"/
    )
    assert.throws(
      () => defineConfig({
        output: 'o',
        pages: 'p'
      }),
      /Missing required config property: "components"/
    )
    assert.throws(
      () => defineConfig({
        output: 'o',
        components: 'c'
      }),
      /Missing required config property: "pages"/
    )

    assert.throws(
      () => defineConfig({
        output: 123,
        components: 'c',
        pages: 'p'
      }),
      /Config property "output" must be a string, received number/
    )
    assert.throws(
      () => defineConfig({
        output: 'o',
        components: true,
        pages: 'p'
      }),
      /Config property "components" must be a string, received boolean/
    )
    assert.throws(
      () => defineConfig({
        output: 'o',
        components: 'c',
        pages: null
      }),
      /Config property "pages" must be a string, received object/
    )
  })

  it('defaults public to "public" and populates all optional defaults when omitted', () => {
    const raw = {
      output: 'dist',
      components: 'components',
      pages: 'pages'
    }
    const config = defineConfig(raw)

    assert.strictEqual(config.output, 'dist')
    assert.strictEqual(config.components, 'components')
    assert.strictEqual(config.pages, 'pages')
    assert.strictEqual(config.public, 'public')
    assert.strictEqual(config.baseURL, '/')
    assert.strictEqual(config.mode, 'production')
    assert.strictEqual(config.cleanUrls, true)
    assert.strictEqual(config.viewTransitions, true)
    assert.strictEqual(config.incremental, true)
    assert.strictEqual(config.reactivity, 'signal')
    assert.strictEqual(config.compilerOptimizations, 'all')
    assert.strictEqual(config.reconcile, 'full')
    assert.deepStrictEqual(config.plugins, [])
    assert.deepStrictEqual(config.assets, [])
    assert.deepStrictEqual(config.csp, { enabled: false })
    assert.deepStrictEqual(config.testing, {})
    assert.deepStrictEqual(config.externalStyles, [])
    assert.deepStrictEqual(config.ignoreByAttribute, [])
    assert.deepStrictEqual(config.skipRenderByAttribute, [])
    assert.deepStrictEqual(config.ignoreTags, [])
    assert.strictEqual(config.preserveTestId, false)
    assert.strictEqual(config.suppressValidationWarnings, false)
  })

  it('accepts explicit public value when provided', () => {
    const config = defineConfig({
      output: 'dist',
      components: 'components',
      pages: 'pages',
      public: 'static'
    })
    assert.strictEqual(config.public, 'static')
  })

  it('rejects invalid type for public property', () => {
    assert.throws(
      () => defineConfig({
        output: 'dist',
        components: 'components',
        pages: 'pages',
        public: 42
      }),
      /Config property "public" must be a string, received number/
    )
  })

  it('validates mode enum values and rejects invalid values', () => {
    assert.doesNotThrow(() => defineConfig({
      output: 'dist',
      components: 'components',
      pages: 'pages',
      mode: 'development'
    }))
    assert.doesNotThrow(() => defineConfig({
      output: 'dist',
      components: 'components',
      pages: 'pages',
      mode: 'testing'
    }))

    assert.throws(
      () => defineConfig({
        output: 'dist',
        components: 'components',
        pages: 'pages',
        mode: 'invalid-mode'
      }),
      /Invalid mode: "invalid-mode"\. Valid modes are: production, development, testing/
    )
  })

  it('rejects non-boolean cleanUrls', () => {
    assert.throws(
      () => defineConfig({
        output: 'dist',
        components: 'components',
        pages: 'pages',
        cleanUrls: 'yes'
      }),
      /Config property "cleanUrls" must be a boolean/
    )
  })

  it('throws migration error when urlStyle is present', () => {
    assert.throws(
      () => defineConfig({
        output: 'dist',
        components: 'components',
        pages: 'pages',
        urlStyle: 'directory'
      }),
      /Config property "urlStyle" has been replaced by "cleanUrls"\.\nUse cleanUrls: true for directory-style URLs, or cleanUrls: false for file-style\./
    )
  })

  it('validates ignoreByAttribute array containing strings or objects', () => {
    const valid = defineConfig({
      output: 'dist',
      components: 'components',
      pages: 'pages',
      ignoreByAttribute: ['data-ignore', {
        name: 'data-test',
        value: 'skip'
      }]
    })
    assert.deepStrictEqual(valid.ignoreByAttribute, [
      'data-ignore',
      {
        name: 'data-test',
        value: 'skip'
      }
    ])

    assert.throws(
      () => defineConfig({
        output: 'dist',
        components: 'components',
        pages: 'pages',
        ignoreByAttribute: 'not-an-array'
      }),
      /Config property "ignoreByAttribute" must be an array/
    )

    assert.throws(
      () => defineConfig({
        output: 'dist',
        components: 'components',
        pages: 'pages',
        ignoreByAttribute: [42]
      }),
      /Config property "ignoreByAttribute" items must be strings or objects with string "name" and "value" properties/
    )

    assert.throws(
      () => defineConfig({
        output: 'dist',
        components: 'components',
        pages: 'pages',
        ignoreByAttribute: [{ name: 'a' }]
      }),
      /Config property "ignoreByAttribute" items must be strings or objects with string "name" and "value" properties/
    )
  })

  it('validates skipRenderByAttribute array containing strings or objects', () => {
    const valid = defineConfig({
      output: 'dist',
      components: 'components',
      pages: 'pages',
      skipRenderByAttribute: ['data-skip', {
        name: 'role',
        value: 'presentation'
      }]
    })
    assert.deepStrictEqual(valid.skipRenderByAttribute, [
      'data-skip',
      {
        name: 'role',
        value: 'presentation'
      }
    ])

    assert.throws(
      () => defineConfig({
        output: 'dist',
        components: 'components',
        pages: 'pages',
        skipRenderByAttribute: 123
      }),
      /Config property "skipRenderByAttribute" must be an array/
    )

    assert.throws(
      () => defineConfig({
        output: 'dist',
        components: 'components',
        pages: 'pages',
        skipRenderByAttribute: [null]
      }),
      /Config property "skipRenderByAttribute" items must be strings or objects with string "name" and "value" properties/
    )

    assert.throws(
      () => defineConfig({
        output: 'dist',
        components: 'components',
        pages: 'pages',
        skipRenderByAttribute: [{
          name: 'a',
          value: 123
        }]
      }),
      /Config property "skipRenderByAttribute" items must be strings or objects with string "name" and "value" properties/
    )
  })

  it('accepts and validates script-specific keys server, styles, and build', () => {
    const valid = defineConfig({
      output: 'dist',
      components: 'components',
      pages: 'pages',
      server: {
        port: 3000,
        host: 'localhost'
      },
      styles: {
        input: ['./src/styles/app.css', './src/styles/admin.css'],
        processors: {}
      },
      build: {
        concurrency: 4
      }
    })

    assert.strictEqual(valid.server.port, 3000)
    assert.strictEqual(valid.server.host, 'localhost')
    assert.deepStrictEqual(valid.styles.input, ['./src/styles/app.css', './src/styles/admin.css'])
    assert.strictEqual(valid.build.concurrency, 4)

    assert.throws(
      () => defineConfig({
        output: 'dist',
        components: 'components',
        pages: 'pages',
        server: 'not-an-object'
      }),
      /Config property "server" must be an object/
    )

    assert.throws(
      () => defineConfig({
        output: 'dist',
        components: 'components',
        pages: 'pages',
        server: { port: -1 }
      }),
      /Config property "server\.port" must be a positive number/
    )

    assert.throws(
      () => defineConfig({
        output: 'dist',
        components: 'components',
        pages: 'pages',
        styles: { input: './src/styles/main.scss' }
      }),
      /Coralite Config Error: The "styles" configuration has been upgraded\./
    )

    assert.throws(
      () => defineConfig({
        output: 'dist',
        components: 'components',
        pages: 'pages',
        styles: {
          input: ['./src/styles/a.css', './src/other/a.css']
        }
      }),
      /Coralite Build Error: Filename collision detected in styles\.input\./
    )

    assert.throws(
      () => defineConfig({
        output: 'dist',
        components: 'components',
        pages: 'pages',
        build: { concurrency: 0 }
      }),
      /Config property "build\.concurrency" must be a positive number/
    )
  })

  it('script-specific keys are ignored when passed to createCoralite without throwing', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'coralite-config-schema-test-'))
    const compDir = join(tmpDir, 'components')
    const pageDir = join(tmpDir, 'pages')
    await mkdir(compDir, { recursive: true })
    await mkdir(pageDir, { recursive: true })

    const config = defineConfig({
      output: join(tmpDir, 'dist'),
      components: compDir,
      pages: pageDir,
      server: {
        port: 8080
      },
      styles: {
        input: ['./src/app.css']
      },
      build: {
        concurrency: 2
      }
    })

    let app
    try {
      app = await createCoralite(config)
      assert.ok(app)
      assert.strictEqual(app.options.components, compDir)
      assert.strictEqual(app.options.pages, pageDir)
    } finally {
      await rm(tmpDir, {
        recursive: true,
        force: true
      })
    }
  })
})
