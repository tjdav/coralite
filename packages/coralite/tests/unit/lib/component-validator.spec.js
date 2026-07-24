import { describe, test } from 'node:test'
import assert from 'node:assert'
import { analyseComponentSource, formatComponentAnalysis } from '../../../lib/analyser.js'

describe('Component Code Coverage & Usage Analyser', () => {
  test('detects unused getters when not referenced in template or client', () => {
    const code = `
<template>
  <div>{{ usedGetter }}</div>
</template>

<script>
  import { defineComponent } from 'coralite'

  export default defineComponent({
    getters: {
      usedGetter: (state) => 'used',
      unusedGetter: (state) => 'unused'
    }
  })
</script>
`
    const result = analyseComponentSource(code, 'test-component.html')
    assert.deepStrictEqual(result.defined.getters, ['usedGetter', 'unusedGetter'])
    assert.deepStrictEqual(result.unused.getters, ['unusedGetter'])
    assert.strictEqual(result.metrics.usageCoveragePercentage, 50)
  })

  test('detects unused server props when unreferenced', () => {
    const code = `
<template>
  <div>{{ activeProp }}</div>
</template>

<script>
  import { defineComponent } from 'coralite'

  export default defineComponent({
    async server() {
      return {
        activeProp: 'used',
        deadProp: 'never-read'
      }
    }
  })
</script>
`
    const result = analyseComponentSource(code, 'server-comp.html')
    assert.deepStrictEqual(result.defined.serverProps, ['activeProp', 'deadProp'])
    assert.deepStrictEqual(result.unused.serverProps, ['deadProp'])
  })

  test('detects unused element refs in template', () => {
    const code = `
<template>
  <button ref="used-btn">Click</button>
  <div ref="unused-box">Box</div>
</template>

<script>
  import { defineComponent } from 'coralite'

  export default defineComponent({
    client({ refs }) {
      const btn = refs('used-btn')
    }
  })
</script>
`
    const result = analyseComponentSource(code, 'ref-comp.html')
    assert.deepStrictEqual(result.defined.refs, ['used-btn', 'unused-box'])
    assert.deepStrictEqual(result.unused.refs, ['unused-box'])
  })

  test('reports 100% coverage when all properties are used', () => {
    const code = `
<template>
  <div ref="my-ref">{{ myVal }}</div>
</template>

<script>
  import { defineComponent } from 'coralite'

  export default defineComponent({
    attributes: {
      myVal: { type: String, default: 'hello' }
    },
    client({ state, refs }) {
      const el = refs('my-ref')
      console.log(state.myVal)
    }
  })
</script>
`
    const result = analyseComponentSource(code, 'perfect-comp.html')
    assert.strictEqual(result.unused.attributes.length, 0)
    assert.strictEqual(result.unused.refs.length, 0)
    assert.strictEqual(result.metrics.usageCoveragePercentage, 100)
  })

  test('formatComponentAnalysis generates formatted text', () => {
    const mockReport = {
      components: [
        {
          filePath: 'comp-a.html',
          metrics: {
            totalUnused: 1,
            usageCoveragePercentage: 50
          },
          unused: {
            getters: ['unusedProp'],
            serverProps: [],
            attributes: [],
            refs: [],
            missingRefs: []
          }
        }
      ],
      metrics: {
        totalComponents: 1,
        totalDefined: 2,
        totalUnused: 1,
        overallCoveragePercentage: 50
      }
    }
    const formatted = formatComponentAnalysis(mockReport, { coverage: true })
    assert(formatted.includes('Coralite Component Code Coverage'))
    assert(formatted.includes('unusedProp'))
    assert(formatted.includes('Runtime Test Coverage'))
  })
})
