import { deepStrictEqual } from 'node:assert'
import { describe, it } from 'node:test'
import { evalComputedTokens } from '#lib'

describe('Eval computed attributes', function () {
  it('should process locateDate attribute', async function () {
    const script = `{
      localeDate () {
        return new Date(this.dateTime).toLocaleDateString('en-AU', {
          weekday: 'short',
          year: '2-digit',
          month: 'short',
          day: 'numeric'
        })
      }
    }`

    const props = await evalComputedTokens(script, {
      dateTime: '2025-01-08T20:23:07.645Z'
    })

    deepStrictEqual(props, {
      localeDate: 'Wed, 8 Jan 25'
    })
  })
})
