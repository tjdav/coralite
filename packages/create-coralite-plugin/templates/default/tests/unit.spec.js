import { describe, it } from 'node:test'
import assert from 'node:assert'
import myPlugin from '../src/index.js'

describe('Unit Test', () => {
  it('should add helloWorld to properties', () => {
    const properties = {}
    const result = myPlugin.onPageSet({ properties })
    assert.strictEqual(result.helloWorld, 'Hello from My Plugin!')
  })

  it('method should return a message', () => {
    const result = myPlugin.method({ message: 'Test Message' })
    assert.strictEqual(result.message, 'Test Message')
  })
})
