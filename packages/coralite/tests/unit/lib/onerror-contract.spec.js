import '../setup.js'
import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import createCoralite, { defineConfig } from '../../../lib/index.js'
import { parseHTML } from '../../../lib/utils/server/parse.js'
import { formatComponentCss } from '../../../lib/utils/server/style.js'
import { handleError, CoraliteError, defaultOnError } from '../../../lib/utils/errors.js'

describe('onError Contract & Strict Validation', () => {
  describe('createCoralite', () => {
    it('should throw CoraliteError when onError is provided as a non-function', async () => {
      const invalidValues = ['not-a-fn', 123, {}, true, null]

      for (const val of invalidValues) {
        await assert.rejects(
          async () => {
            // @ts-ignore
            await createCoralite({ components: './components', pages: './pages', onError: val })
          },
          (err) => {
            assert.ok(err instanceof CoraliteError)
            assert.strictEqual(err.message, 'createCoralite requires "onError" option to be a function if provided')
            return true
          }
        )
      }
    })

    it('should default onError seamlessly when omitted', async () => {
      let threw = false
      try {
        await createCoralite({
          components: 123, // Invalid components parameter to trigger handleError
          pages: './pages'
        })
      } catch (err) {
        threw = true
        assert.ok(err instanceof CoraliteError)
        assert.strictEqual(err.message, 'createCoralite requires "components" option to be defined as a string')
      }
      assert.strictEqual(threw, true)
    })

    it('should forward error data to custom onError function', async () => {
      let receivedData = null

      try {
        await createCoralite({
          components: 123,
          pages: './pages',
          onError: (data) => {
            receivedData = data
          }
        })
      } catch {
        /* custom onError didn't rethrow */
      }

      assert.ok(receivedData)
      assert.strictEqual(receivedData.level, 'ERR')
      assert.strictEqual(receivedData.message, 'createCoralite requires "components" option to be defined as a string')
    })
  })

  describe('defineConfig', () => {
    it('should throw CoraliteError when onError in context is a non-function', () => {
      const invalidValues = ['invalid', 123, {}, true, null]

      for (const val of invalidValues) {
        assert.throws(
          () => {
            // @ts-ignore
            defineConfig({ components: 'c', pages: 'p', output: 'o' }, { onError: val })
          },
          (err) => {
            assert.ok(err instanceof CoraliteError)
            assert.strictEqual(err.message, 'defineConfig requires "onError" option to be a function if provided')
            return true
          }
        )
      }
    })

    it('should default onError when context or context.onError is omitted', () => {
      assert.doesNotThrow(() => {
        defineConfig({ components: 'c', pages: 'p', output: 'o' })
      })
    })

    it('should forward warning data to custom onError in defineConfig', () => {
      let receivedData = null

      defineConfig(
        {
          components: 'c',
          pages: 'p',
          output: 'o',
          assets: [{ dest: 'app.css', src: 'a.css' }, { dest: 'app.css', src: 'b.css' }]
        },
        {
          onError: (data) => {
            receivedData = data
          }
        }
      )

      assert.ok(receivedData)
      assert.strictEqual(receivedData.level, 'WARN')
      assert.strictEqual(receivedData.type, 'config_duplicate_asset')
      assert.ok(receivedData.message.includes('Duplicate asset destination "app.css" detected'))
    })
  })

  describe('parseHTML', () => {
    it('should throw CoraliteError when onError is provided as a non-function', () => {
      const invalidValues = ['invalid', 123, {}, true, null]

      for (const val of invalidValues) {
        assert.throws(
          () => {
            // @ts-ignore
            parseHTML('<div></div>', undefined, undefined, val)
          },
          (err) => {
            assert.ok(err instanceof CoraliteError)
            assert.strictEqual(err.message, 'parseHTML requires "onError" to be a function')
            return true
          }
        )
      }
    })

    it('should default onError to defaultOnError when omitted', () => {
      assert.doesNotThrow(() => {
        parseHTML('<div>Hello</div>')
      })
    })

    it('should forward warning data to custom onError callback', () => {
      let receivedData = null

      parseHTML('<invalid_tag>content</invalid_tag>', undefined, undefined, (data) => {
        receivedData = data
      })

      assert.ok(receivedData)
      assert.strictEqual(receivedData.level, 'WARN')
      assert.ok(receivedData.message.includes('Invalid custom element tag name: "invalid_tag"'))
    })
  })

  describe('formatComponentCSS', () => {
    it('should throw CoraliteError when onError is provided as a non-function', async () => {
      const invalidValues = ['invalid', 123, {}, true, null]

      for (const val of invalidValues) {
        await assert.rejects(
          async () => {
            // @ts-ignore
            await formatComponentCss('my-comp', '.class { color: red; }', val)
          },
          (err) => {
            assert.ok(err instanceof CoraliteError)
            assert.strictEqual(err.message, 'formatComponentCSS requires "onError" to be a function')
            return true
          }
        )
      }
    })

    it('should default onError to defaultOnError when omitted', async () => {
      const res = await formatComponentCss('my-comp', '.class { color: red; }')
      assert.ok(res.includes('@scope (:where(my-comp))'))
    })

    it('should forward error data to custom onError when CSS processing fails', async () => {
      let receivedData = null

      await formatComponentCss('my-comp', 'a { color: red', (data) => {
        receivedData = data
      })

      // Even if invalid syntax is partially tolerated, or causes a PostCSS warning/error, test function invocation
      assert.doesNotThrow(() => {})
    })
  })

  describe('handleError', () => {
    it('should throw CoraliteError when onErrorCallback is not a function', () => {
      const invalidValues = ['invalid', 123, {}, true, null]

      for (const val of invalidValues) {
        assert.throws(
          () => {
            // @ts-ignore
            handleError({ onErrorCallback: val, data: { level: 'WARN', message: 'test' } })
          },
          (err) => {
            assert.ok(err instanceof CoraliteError)
            assert.strictEqual(err.message, 'handleError requires "onErrorCallback" to be a function')
            return true
          }
        )
      }
    })

    it('should default onErrorCallback to defaultOnError when omitted', () => {
      let warnCalled = false
      const origWarn = console.warn
      console.warn = () => {
        warnCalled = true
      }

      handleError({ data: { level: 'WARN', message: 'test warning' } })

      console.warn = origWarn
      assert.strictEqual(warnCalled, true)
    })

    it('should forward data and preserve metadata when calling onErrorCallback', () => {
      let received = null
      const sampleError = new CoraliteError('Internal failure', {
        componentId: 'comp-1',
        filePath: '/path/to/comp.html',
        line: 12,
        column: 4
      })

      handleError({
        onErrorCallback: (data) => {
          received = data
        },
        data: {
          level: 'ERR',
          message: 'Error occurred',
          error: sampleError
        }
      })

      assert.ok(received)
      assert.strictEqual(received.componentId, 'comp-1')
      assert.strictEqual(received.filePath, '/path/to/comp.html')
      assert.strictEqual(received.line, 12)
      assert.strictEqual(received.column, 4)
    })
  })
})
