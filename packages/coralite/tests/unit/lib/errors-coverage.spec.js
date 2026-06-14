import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { CoraliteError, defaultOnError, handleError } from '../../../lib/utils/errors.js'

describe('CoraliteError Coverage Gaps', () => {
  it('should polyfill cause if missing', () => {
    const cause = new Error('original')
    const err = new CoraliteError('wrapped', { cause })
    assert.strictEqual(err.cause, cause)
  })

  it('defaultOnError should throw CoraliteError if no error object provided for level ERR', () => {
    assert.throws(() => {
      defaultOnError({
        level: 'ERR',
        message: 'Something went wrong'
      })
    }, {
      name: 'CoraliteError',
      message: 'Something went wrong'
    })
  })

  it('defaultOnError should log message for unknown levels', () => {
    const originalLog = console.log
    let logged = ''
    console.log = (m) => {
      logged = m
    }
    try {
      defaultOnError({
        level: 'INFO',
        message: 'hello'
      })
      assert.strictEqual(logged, 'hello')
    } finally {
      console.log = originalLog
    }
  })

  it('handleError should populate data from CoraliteError', () => {
    const coraliteError = new CoraliteError('fail', {
      componentId: 'comp-1',
      filePath: '/file.html',
      instanceId: 'inst-1',
      pagePath: '/page.html',
      line: 10,
      column: 5,
      stackFile: '/file.js'
    })

    const data = {
      level: 'ERR',
      message: 'fail',
      error: coraliteError
    }
    let capturedData = null
    handleError({
      onErrorCallback: (d) => {
        capturedData = d
      },
      data
    })

    assert.strictEqual(capturedData.componentId, 'comp-1')
    assert.strictEqual(capturedData.filePath, '/file.html')
    assert.strictEqual(capturedData.instanceId, 'inst-1')
    assert.strictEqual(capturedData.pagePath, '/page.html')
    assert.strictEqual(capturedData.line, 10)
    assert.strictEqual(capturedData.column, 5)
    assert.strictEqual(capturedData.stackFile, '/file.js')
  })

  it('handleError should use provided data even if CoraliteError has values', () => {
    const coraliteError = new CoraliteError('fail', { componentId: 'comp-1' })
    const data = {
      level: 'ERR',
      message: 'fail',
      error: coraliteError,
      componentId: 'override'
    }
    let capturedData = null
    handleError({
      onErrorCallback: (d) => {
        capturedData = d
      },
      data
    })
    assert.strictEqual(capturedData.componentId, 'override')
  })
})
