import { describe, it } from 'node:test'
import assert from 'node:assert'
import myPlugin from '../src/index.js'

describe('Unit Test', () => {
  it('should add site.hello to values', () => {
    const values = {}
    myPlugin.onPageSet({ values })
    assert.strictEqual(values.helloWorld, 'Hello from My Plugin!')
  })

  it('method should return a message', () => {
    const result = myPlugin.method({ message: 'Test Message' })
    assert.strictEqual(result.message, 'Test Message')
  })
})
