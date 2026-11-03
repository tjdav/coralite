import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import myPlugin from '../src/index.js'

describe('Plugin Unit Tests', () => {
  it('exports a valid CoralitePlugin object', () => {
    assert.strictEqual(myPlugin.name, 'myPlugin')
    assert.strictEqual(typeof myPlugin.context, 'function')
    assert.strictEqual(typeof myPlugin.server?.onPageSet, 'function')
  })

  it('evaluates ubiquitous context with configured message', () => {
    const factory = myPlugin.context({ config: { message: 'Custom Message' } })
    assert.strictEqual(typeof factory, 'function')

    const context = factory({})
    assert.strictEqual(context.message, 'Custom Message')
  })

  it('runs onPageSet server hook and sets metadata', () => {
    const mockPage = { meta: {} }
    myPlugin.server.onPageSet({ page: mockPage })
    assert.strictEqual(mockPage.meta['x-plugin-powered'], 'coralite-plugin')
  })
})
