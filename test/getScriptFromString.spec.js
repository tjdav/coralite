import { deepStrictEqual, strictEqual } from 'node:assert'
import { describe, it } from 'node:test'
import { getScriptFromString } from '../lib/index.js'

describe('getScriptFromString', function () {
  it('should parse defineProps from script', function () {
    const string = `
    <template id="template1">Hello {{ name }} Wassup? <code>import { red } from 'lib.js'</code></template>
    <script>
      defineProps({
        name () {
          return this.name + '!!!!!'
        }
      })
    </script>
    `
    const result = getScriptFromString(string, {
      name: 'Thomas'
    });
    
    deepStrictEqual(result.name, 'Thomas!!!!!');
  })
})