import { deepStrictEqual } from 'node:assert'
import { describe, it } from 'node:test'
import { getScriptFromString } from '../lib/index.js'

describe('getScriptFromString', function () {
  it('should eval computed tokens from script', async function () {
    const string = `
    <div id="coralite-author">
      <span>{{ name }}</span>
      <time datetime="{{ datetime }}">
        {{ localeDate }}
      </time>
    </div>

    <script type="module">
      import { computedTokens } from 'coralite:component'
      
      computedTokens({
        localeDate () {
          return new Date(this.datetime).toLocaleDateString('en-AU', {
            weekday: 'short',
            year: '2-digit',
            month: 'short',
            day: 'numeric'
          })
        }
      })
    </script>
    `
    const computedTokens = getScriptFromString(string)

    deepStrictEqual(await computedTokens({
      name: 'Thomas',
      datetime: '2025-01-08T20:23:07.645Z'
    }), {
      localeDate: 'Wed, 8 Jan 25'
    })
  })
})
