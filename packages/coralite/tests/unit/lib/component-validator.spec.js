import { describe, test } from 'node:test'
import assert from 'node:assert'
import {
  validateComponentSource,
  formatComponentValidationReport,
  analyseComponentSource,
  formatComponentAnalysis
} from '../../../lib/component-validator.js'

describe('Component Validator', () => {
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
    const result = validateComponentSource(code, 'test-component.html')
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
    const result = validateComponentSource(code, 'server-comp.html')
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
    const result = validateComponentSource(code, 'ref-comp.html')
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
    const result = validateComponentSource(code, 'perfect-comp.html')
    assert.strictEqual(result.unused.attributes.length, 0)
    assert.strictEqual(result.unused.refs.length, 0)
    assert.strictEqual(result.metrics.usageCoveragePercentage, 100)
  })

  test('formatComponentValidationReport generates formatted text', () => {
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
    const formatted = formatComponentValidationReport(mockReport, { coverage: true })
    assert(formatted.includes('Coralite Component Code Coverage'))
    assert(formatted.includes('unusedProp'))
    assert(formatted.includes('Runtime Test Coverage'))
  })

  test('detects top-level imports referenced in client block', () => {
    const code = `
<template>
  <div>Test</div>
</template>

<script>
  import { defineComponent } from 'coralite'
  import { formatDate } from './utils.js'
  import helper from './helper.js'

  export default defineComponent({
    client({ state }) {
      const a = formatDate(new Date())
      helper.doSomething()
    }
  })
</script>
`
    const result = validateComponentSource(code, 'import-comp.html')
    assert.deepStrictEqual(result.unused.invalidClientImports, ['formatDate', 'helper'])
    assert.strictEqual(result.metrics.totalUnused, 2)
  })

  test('does not flag top-level imports referenced only in server block or getters', () => {
    const code = `
<template>
  <div>Test</div>
</template>

<script>
  import { defineComponent } from 'coralite'
  import { serverCalc } from './server-math.js'

  export default defineComponent({
    server() {
      return {
        val: serverCalc(10)
      }
    },
    client({ state }) {
      console.log(state.val)
    }
  })
</script>
`
    const result = validateComponentSource(code, 'server-import-comp.html')
    assert.deepStrictEqual(result.unused.invalidClientImports, [])
  })

  test('does not flag dynamic imports inside client block', () => {
    const code = `
<template>
  <div>Test</div>
</template>

<script>
  import { defineComponent } from 'coralite'

  export default defineComponent({
    async client() {
      const { formatDate } = await import('./utils.js')
      console.log(formatDate(new Date()))
    }
  })
</script>
`
    const result = validateComponentSource(code, 'dynamic-import-comp.html')
    assert.deepStrictEqual(result.unused.invalidClientImports, [])
  })

  test('does not flag top-level import if shadowed by local declaration inside client block', () => {
    const code = `
<template>
  <div>Test</div>
</template>

<script>
  import { formatDate } from './utils.js'

  export default defineComponent({
    client() {
      const formatDate = (d) => String(d)
      console.log(formatDate(new Date()))
    }
  })
</script>
`
    const result = validateComponentSource(code, 'shadowed-import-comp.html')
    assert.deepStrictEqual(result.unused.invalidClientImports, [])
  })

  test('formatComponentValidationReport includes top-level import errors', () => {
    const mockReport = {
      components: [
        {
          filePath: 'comp-b.html',
          metrics: {
            totalUnused: 1,
            usageCoveragePercentage: 0
          },
          unused: {
            getters: [],
            serverProps: [],
            attributes: [],
            refs: [],
            missingRefs: [],
            invalidClientImports: ['formatDate']
          }
        }
      ],
      metrics: {
        totalComponents: 1,
        totalDefined: 0,
        totalUnused: 1,
        overallCoveragePercentage: 0
      }
    }
    const formatted = formatComponentValidationReport(mockReport)
    assert(formatted.includes('Top-level imports used in client block'))
    assert(formatted.includes('formatDate'))
  })

  test('reports valid=false and totalErrors > 0 when component has validation errors for CI compatibility', () => {
    const code = `
<template>
  <div>Test</div>
</template>

<script>
  import { defineComponent } from 'coralite'
  import fs from 'node:fs'

  export default defineComponent({
    client() {
      const data = fs.readFileSync('foo.txt')
    }
  })
</script>
`
    const result = validateComponentSource(code, 'ci-error-comp.html')
    assert.strictEqual(result.valid, false)
    assert.strictEqual(result.metrics.totalErrors, 1)
  })

  test('ignores symbols referenced via inline ignore pragmas (HTML, block, and line comments)', () => {
    // HTML comment pragma ignores a ref and an attribute
    const htmlCode = `\n<template>\n  <!-- coralite-ignore hook-result, unusedAttr -->\n  <div ref="hook-result">{{ myAttr }}</div>\n</template>\n\n<script>\n  import { defineComponent } from 'coralite'\n\n  export default defineComponent({\n    attributes: {\n      myAttr: { type: String, default: '' },\n      unusedAttr: { type: String, default: '' }\n    }\n  })\n</script>\n`
    const htmlResult = validateComponentSource(htmlCode, 'ignore-html.html')
    assert.deepStrictEqual(htmlResult.unused.refs, [])
    assert.deepStrictEqual(htmlResult.unused.attributes, [])

    // Block comment pragma ignores an unused getter
    const blockCode = `\n<template>\n  <div>Test</div>\n</template>\n\n<script>\n  import { defineComponent } from 'coralite'\n\n  /* coralite-ignore unusedGetter */\n  export default defineComponent({\n    getters: {\n      unusedGetter: (state) => 'x'\n    }\n  })\n</script>\n`
    const blockResult = validateComponentSource(blockCode, 'ignore-block.html')
    assert.deepStrictEqual(blockResult.unused.getters, [])

    // Line comment pragma ignores an unused attribute
    const lineCode = `\n<template>\n  <div>Test</div>\n</template>\n\n<script>\n  import { defineComponent } from 'coralite'\n\n  // coralite-ignore unusedAttr\n  export default defineComponent({\n    attributes: {\n      unusedAttr: { type: String, default: '' }\n    }\n  })\n</script>\n`
    const lineResult = validateComponentSource(lineCode, 'ignore-line.html')
    assert.deepStrictEqual(lineResult.unused.attributes, [])
  })

  test('extracts style/template/script sections safely on adversarial input', () => {
    // Attribute referenced only through the <style> block should count as used,
    // proving styleContent extraction (with attributes + case-insensitive tag) works.
    const styledCode = `\n<template>\n  <div>{{ message }}</div>\n</template>\n\n<style type="text/css">\n  [box] {\n    color: red;\n  }\n</style>\n\n<script>\n  import { defineComponent } from 'coralite'\n\n  export default defineComponent({\n    attributes: {\n      message: { type: String, default: '' },\n      box: { type: Boolean }\n    }\n  })\n</script>\n`
    const styledResult = validateComponentSource(styledCode, 'styled-comp.html')
    assert.strictEqual(styledResult.valid, true)
    assert.deepStrictEqual(styledResult.unused.attributes, [])

    // ReDoS-shaped input with many nested <style> and no closing tag must complete quickly
    const adversarial = '<style>' + '<style>a'.repeat(5000)
    const advResult = validateComponentSource(adversarial, 'adversarial.html')
    assert.strictEqual(advResult.valid, true)
  })

  test('linear token/ref/state extraction handles adversarial input without slowing', () => {
    // Mustache token extraction must complete quickly on ReDoS-shaped input
    const adversarialTemplate = '{{' + 'aaa.'.repeat(5000)
    const advTemplateResult = validateComponentSource(
      `<template><div>${adversarialTemplate}</div></template><script>import { defineComponent } from 'coralite'</script>`,
      'adv-template.html'
    )
    assert.strictEqual(advTemplateResult.valid, true)

    // refs() scanning on adversarial script with many opens and no close must complete
    const advScriptResult = validateComponentSource(
      `<template><div ref="box">{{ msg }}</div></template><script>import { defineComponent } from 'coralite'\nexport default defineComponent(${'refs("a'.repeat(2000)})</script>`,
      'adv-script.html'
    )
    assert.deepStrictEqual(advScriptResult.defined.refs, ['box'])
  })

  test('supports legacy aliases (analyseComponentSource, formatComponentAnalysis)', () => {
    assert.strictEqual(analyseComponentSource, validateComponentSource)
    assert.strictEqual(formatComponentAnalysis, formatComponentValidationReport)
  })
})
