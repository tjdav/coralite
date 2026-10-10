import { describe, it } from 'node:test'
import assert from 'node:assert'
import { generateClientRuntime } from '../../../lib/utils/client/runtime.js'

describe('Trusted Types Sink Compliance', () => {
  it('generateClientRuntime contains no innerHTML, outerHTML, or string style assignment sinks', () => {
    const code = generateClientRuntime({
      base: '/',
      sharedChunkPath: 'shared.js',
      declarativeTags: ['x-counter'],
      hydrationData: '{}',
      mode: 'production'
    })

    // Assert absence of unsafe DOM sink assignments
    assert.strictEqual(code.includes('.innerHTML'), false, 'client runtime should not contain innerHTML assignment')
    assert.strictEqual(code.includes('.outerHTML'), false, 'client runtime should not contain outerHTML assignment')
    assert.strictEqual(code.includes('.cssText'), false, 'client runtime should not contain cssText assignment')
    assert.strictEqual(/overlay\.style\s*=\s*/.test(code), false, 'client runtime should not assign style string directly')
  })
})
