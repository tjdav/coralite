import '../setup.js'
import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import createCoralite, { defineConfig } from '../../../lib/index.js'
import { parseHTML } from '../../../lib/utils/server/parse.js'
import { formatComponentCss } from '../../../lib/utils/server/style.js'
import { handleError, CoraliteError } from '../../../lib/utils/errors.js'

/**
 * Asserts that invoking `invoke` with any invalid onError value rejects/throws a
 * CoraliteError carrying the expected message.
 * @param {(value: any) => any} invoke
 * @param {string} expectedMessage
 */
async function assertRejectsInvalidOnError (invoke, expectedMessage) {
  for (const value of ['invalid', 123, {}, true, null]) {
    await assert.rejects(
      async () => {
        await invoke(value)
      },
      (err) => {
        assert.ok(err instanceof CoraliteError)
        assert.strictEqual(err.message, expectedMessage)
        return true
      }
    )
  }
}

describe('onError Contract & Strict Validation', () => {
  describe('createCoralite', () => {
    it('should throw CoraliteError when onError is provided as a non-function', async () => {
      await assertRejectsInvalidOnError(
        // @ts-ignore
        (onError) => createCoralite({ components: './components', pages: './pages', onError }),
        'createCoralite requires "onError" option to be a function if provided'
      )
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
    it('should throw CoraliteError when onError in context is a non-function', async () => {
      await assertRejectsInvalidOnError(
        // @ts-ignore
        (onError) => defineConfig({ components: 'c', pages: 'p', output: 'o' }, { onError }),
        'defineConfig requires "onError" option to be a function if provided'
      )
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
    it('should throw CoraliteError when onError is provided as a non-function', async () => {
      await assertRejectsInvalidOnError(
        // @ts-ignore
        (onError) => parseHTML('<div></div>', undefined, undefined, onError),
        'parseHTML requires "onError" to be a function'
      )
    })

    it('should default onError to defaultOnError when omitted', () => {
      assert.doesNotThrow(() => {
        parseHTML('<div>Hello</div>')
      })
    })
  })

  describe('formatComponentCSS', () => {
    it('should throw CoraliteError when onError is provided as a non-function', async () => {
      await assertRejectsInvalidOnError(
        // @ts-ignore
        (onError) => formatComponentCss('my-comp', '.class { color: red; }', onError),
        'formatComponentCSS requires "onError" to be a function'
      )
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

      assert.ok(receivedData, 'custom onError should be invoked when CSS processing fails')
      assert.strictEqual(receivedData.level, 'ERR')
      assert.ok(receivedData.message.includes('Error processing CSS'))
      assert.ok(receivedData.error instanceof Error)
      assert.strictEqual(receivedData.error.reason, 'Unclosed block')
    })
  })

  describe('handleError', () => {
    it('should throw CoraliteError when onErrorCallback is not a function', async () => {
      await assertRejectsInvalidOnError(
        // @ts-ignore
        (onErrorCallback) => handleError({ onErrorCallback, data: { level: 'WARN', message: 'test' } }),
        'handleError requires "onErrorCallback" to be a function'
      )
    })

    // NOTE: componentId/filePath enrichment is already covered by errors.spec.js.
    // Only the line/column forwarding assertion is unique to this file.
    it('should forward CoraliteError line/column metadata to a custom onErrorCallback', () => {
      let received = null
      const sampleError = new CoraliteError('Internal failure', {
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
      assert.strictEqual(received.line, 12)
      assert.strictEqual(received.column, 4)
    })
  })
})
