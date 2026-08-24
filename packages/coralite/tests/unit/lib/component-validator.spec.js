import { describe, test } from 'node:test'
import assert from 'node:assert'
import {
  validateComponentSource,
  formatComponentValidationReport,
  analyseComponentSource,
  formatComponentAnalysis
} from '../../../lib/component-validator.js'

describe('Component Validator Diagnostics & AST Analysis', () => {
  // 1. Template Expression Parsing (CORALITE-E201)
  test('CORALITE-E201: detects non-pure identifier mustache expressions in template and derives getter + defensive code', () => {
    const code = `
<template>
  <div>{{ user.profile.name }}</div>
  <div>{{ item.price * taxRate }}</div>
  <div>{{ items[0] }}</div>
</template>

<script>
  import { defineComponent } from 'coralite'
  export default defineComponent({})
</script>
`
    const result = validateComponentSource(code, 'test-e201.html')
    assert.strictEqual(result.valid, false)

    const e201s = result.diagnostics.filter(d => d.code === 'CORALITE-E201')
    assert.strictEqual(e201s.length, 3)

    // user.profile.name
    assert.strictEqual(e201s[0].severity, 'error')
    assert.strictEqual(e201s[0].fix.action, 'lift_to_getter')
    assert.strictEqual(e201s[0].fix.getter.name, 'userProfileName')
    assert.strictEqual(e201s[0].fix.getter.code, "userProfileName: (state) => state.user?.profile?.name ?? ''")
    assert.ok(e201s[0].codeframe.includes('user.profile.name'))

    // item.price * taxRate
    assert.strictEqual(e201s[1].fix.getter.name, 'itemPriceTimesTaxRate')
    assert.strictEqual(e201s[1].fix.getter.code, 'itemPriceTimesTaxRate: (state) => (state.item?.price * state.taxRate) ?? 0')

    // items[0]
    assert.strictEqual(e201s[2].fix.getter.name, 'itemsZero')
    assert.strictEqual(e201s[2].fix.getter.code, "itemsZero: (state) => state.items?.[0] ?? ''")
  })

  // 2. Inline Event Listeners (CORALITE-E203)
  test('CORALITE-E203: detects inline event listener attributes in template', () => {
    const code = `
<template>
  <button onclick="handleClick()">Click</button>
</template>

<script>
  import { defineComponent } from 'coralite'
  export default defineComponent({})
</script>
`
    const result = validateComponentSource(code, 'test-e203.html')
    assert.strictEqual(result.valid, false)

    const e203s = result.diagnostics.filter(d => d.code === 'CORALITE-E203')
    assert.strictEqual(e203s.length, 1)
    assert.strictEqual(e203s[0].severity, 'error')
    assert.strictEqual(e203s[0].fix.action, 'remove_attribute')
    assert.ok(e203s[0].codeframe.includes('onclick'))
  })

  // 3. Missing Element Ref (CORALITE-E202)
  test('CORALITE-E202: detects called refs missing from template and checks candidate matching', () => {
    // Case 1: Exactly 1 matching candidate tag
    const code1 = `
<template>
  <button id="submit">Submit</button>
  <div>Text</div>
</template>

<script>
  import { defineComponent } from 'coralite'
  export default defineComponent({
    client({ refs }) {
      const btn = refs('submit-btn')
    }
  })
</script>
`
    const res1 = validateComponentSource(code1, 'test-e202-single.html')
    const e202Single = res1.diagnostics.find(d => d.code === 'CORALITE-E202')
    assert.ok(e202Single)
    assert.strictEqual(e202Single.message, 'Missing ref "submit-btn" in template')
    assert.strictEqual(e202Single.cause, 'Found 1 matching candidate element (<button>) in template for ref "submit-btn".')
    assert.strictEqual(e202Single.fix.action, 'inject_ref')
    assert.strictEqual(e202Single.fix.description, 'Add ref="submit-btn" to matching <button> element')

    // Case 2: Ambiguous multiple candidate tags
    const code2 = `
<template>
  <button>One</button>
  <button>Two</button>
</template>

<script>
  import { defineComponent } from 'coralite'
  export default defineComponent({
    client({ refs }) {
      const btn = refs('submit-btn')
    }
  })
</script>
`
    const res2 = validateComponentSource(code2, 'test-e202-multi.html')
    const e202Multi = res2.diagnostics.find(d => d.code === 'CORALITE-E202')
    assert.ok(e202Multi)
    assert.strictEqual(e202Multi.cause, 'Found 2 candidate elements in template for ref "submit-btn". Auto-injection skipped due to ambiguity.')
    assert.strictEqual(e202Multi.fix.action, undefined)
    assert.strictEqual(e202Multi.fix.description, 'Manually add ref="submit-btn" to target element in template')
  })

  test('CORALITE-E201: handles complex template expressions (ternary, template literal, comparison)', () => {
    const code = `
<template>
  <div>{{ isActive ? 'Online' : 'Offline' }}</div>
  <div>{{ \`ID: \${id}\` }}</div>
  <div>{{ count > 0 }}</div>
</template>

<script>
  import { defineComponent } from 'coralite'
  export default defineComponent({})
</script>
`
    const result = validateComponentSource(code, 'test-e201-complex.html')
    const e201s = result.diagnostics.filter(d => d.code === 'CORALITE-E201')
    assert.strictEqual(e201s.length, 3)

    // Ternary
    assert.strictEqual(e201s[0].fix.getter.name, 'isActiveOnlineOffline')
    assert.strictEqual(e201s[0].fix.getter.code, "isActiveOnlineOffline: (state) => state.isActive ? 'Online' : 'Offline'")

    // Template Literal
    assert.strictEqual(e201s[1].fix.getter.name, 'iDId')
    assert.strictEqual(e201s[1].fix.getter.code, "iDId: (state) => `ID: ${state.id ?? ''}`")

    // Comparison
    assert.strictEqual(e201s[2].fix.getter.name, 'countGreaterThanZero')
    assert.strictEqual(e201s[2].fix.getter.code, 'countGreaterThanZero: (state) => (state.count > 0)')
  })

  // 4. Attribute Blocked Types (CORALITE-E101)
  test('CORALITE-E101: detects blocked attribute types Array and Object', () => {
    const code = `
<template>
  <div>Test</div>
</template>

<script>
  import { defineComponent } from 'coralite'
  export default defineComponent({
    attributes: {
      items: { type: Array },
      user: { type: Object }
    }
  })
</script>
`
    const result = validateComponentSource(code, 'test-e101.html')
    assert.strictEqual(result.valid, false)

    const e101s = result.diagnostics.filter(d => d.code === 'CORALITE-E101')
    assert.strictEqual(e101s.length, 2)
    assert.strictEqual(e101s[0].severity, 'error')
    assert.ok(e101s[0].fix.description.includes('Move Array/Object initialization'))
  })

  // 5. Attribute Mutex (CORALITE-E102)
  test('CORALITE-E102: detects attribute defining both required: true and default', () => {
    const code = `
<template>
  <div>Test</div>
</template>

<script>
  import { defineComponent } from 'coralite'
  export default defineComponent({
    attributes: {
      title: { type: String, required: true, default: 'Untitled' }
    }
  })
</script>
`
    const result = validateComponentSource(code, 'test-e102.html')
    assert.strictEqual(result.valid, false)

    const e102s = result.diagnostics.filter(d => d.code === 'CORALITE-E102')
    assert.strictEqual(e102s.length, 1)
    assert.strictEqual(e102s[0].severity, 'error')
    assert.strictEqual(e102s[0].fix.action, 'strip_default')
  })

  // 6. Async Attribute Validate/Transform (CORALITE-E103)
  test('CORALITE-E103: detects async validate or transform functions in attribute schema', () => {
    const code = `
<template>
  <div>Test</div>
</template>

<script>
  import { defineComponent } from 'coralite'
  export default defineComponent({
    attributes: {
      email: {
        type: String,
        async validate(val) { return true }
      }
    }
  })
</script>
`
    const result = validateComponentSource(code, 'test-e103.html')
    assert.strictEqual(result.valid, false)

    const e103s = result.diagnostics.filter(d => d.code === 'CORALITE-E103')
    assert.strictEqual(e103s.length, 1)
    assert.strictEqual(e103s[0].severity, 'error')
  })

  // 7. Reserved Context Collision (CORALITE-E104)
  test('CORALITE-E104: detects attributes or server properties colliding with reserved context keys', () => {
    const code = `
<template>
  <div>Test</div>
</template>

<script>
  import { defineComponent } from 'coralite'
  export default defineComponent({
    attributes: {
      signal: { type: String }
    },
    async server() {
      return {
        emit: 'foo'
      }
    }
  })
</script>
`
    const result = validateComponentSource(code, 'test-e104.html')
    assert.strictEqual(result.valid, false)

    const e104s = result.diagnostics.filter(d => d.code === 'CORALITE-E104')
    assert.strictEqual(e104s.length, 2)
    assert.strictEqual(e104s[0].severity, 'error')
  })

  // 8. Serialization Boundary Leaks (CORALITE-E301)
  test('CORALITE-E301: detects top-level imports and local variables referenced inside client() block with deduplication', () => {
    const code = `
<template>
  <div>Test</div>
</template>

<script>
  import { defineComponent } from 'coralite'
  import { formatDate } from './utils.js'

  const LOCAL_CONFIG = { theme: 'dark' }

  export default defineComponent({
    client() {
      const d1 = formatDate(new Date())
      const d2 = formatDate(new Date())
      const theme = LOCAL_CONFIG.theme
    }
  })
</script>
`
    const result = validateComponentSource(code, 'test-e301.html')
    assert.strictEqual(result.valid, false)

    const e301s = result.diagnostics.filter(d => d.code === 'CORALITE-E301')
    assert.strictEqual(e301s.length, 2)

    // Deduplicated import reference
    assert.strictEqual(e301s[0].severity, 'error')
    assert.strictEqual(e301s[0].message, "Top-level import 'formatDate' referenced inside client() block.")
    assert.strictEqual(e301s[0].fix.action, 'dynamic_import')

    // Top-level local variable reference
    assert.strictEqual(e301s[1].severity, 'error')
    assert.strictEqual(e301s[1].message, "Top-level variable 'LOCAL_CONFIG' referenced inside client() block.")
    assert.strictEqual(e301s[1].cause, 'Variables declared in the top-level script scope cannot be serialized to the browser client() block.')
    assert.strictEqual(e301s[1].fix.description, 'Move variable inside client() or initialize via server()')
  })

  // 9. Reactivity Loops in observe() (CORALITE-E302)
  test('CORALITE-E302: detects state assignment and update expressions inside observe() callback', () => {
    const code = `
<template>
  <div>Test</div>
</template>

<script>
  import { defineComponent } from 'coralite'
  export default defineComponent({
    client({ observe, state }) {
      observe('count', (state) => {
        state.doubleCount = state.count * 2
        state.count++
        state.count += 1
      })
    }
  })
</script>
`
    const result = validateComponentSource(code, 'test-e302.html')
    assert.strictEqual(result.valid, true)

    const e302s = result.diagnostics.filter(d => d.code === 'CORALITE-E302')
    assert.strictEqual(e302s.length, 3)
    assert.strictEqual(e302s[0].severity, 'warning')
    assert.strictEqual(e302s[1].severity, 'warning')
    assert.strictEqual(e302s[2].severity, 'warning')
  })

  // 10. Async Style Getters (CORALITE-E303)
  test('CORALITE-E303: detects async functions inside style block', () => {
    const code = `
<template>
  <div>Test</div>
</template>

<script>
  import { defineComponent } from 'coralite'
  export default defineComponent({
    style: {
      color: async (state) => 'red'
    }
  })
</script>
`
    const result = validateComponentSource(code, 'test-e303.html')
    assert.strictEqual(result.valid, false)

    const e303s = result.diagnostics.filter(d => d.code === 'CORALITE-E303')
    assert.strictEqual(e303s.length, 1)
    assert.strictEqual(e303s[0].severity, 'error')
  })

  // 11. Unused Symbols Warnings (CORALITE-W401)
  test('CORALITE-W401: emits warning for unused getters, serverProps, and attributes', () => {
    const code = `
<template>
  <div>Test</div>
</template>

<script>
  import { defineComponent } from 'coralite'
  export default defineComponent({
    attributes: {
      unusedAttr: { type: String }
    },
    getters: {
      unusedGetter: (state) => 'unused'
    },
    async server() {
      return {
        unusedServerProp: 'dead'
      }
    }
  })
</script>
`
    const result = validateComponentSource(code, 'test-w401.html')
    assert.strictEqual(result.valid, false)

    const w401s = result.diagnostics.filter(d => d.code === 'CORALITE-W401')
    assert.strictEqual(w401s.length, 3)
    assert.strictEqual(w401s[0].severity, 'warning')
  })

  // 12. Unused Element Ref Warning (CORALITE-W402)
  test('CORALITE-W402: emits warning for element ref defined in template but never accessed', () => {
    const code = `
<template>
  <div ref="unused-box">Box</div>
</template>

<script>
  import { defineComponent } from 'coralite'
  export default defineComponent({})
</script>
`
    const result = validateComponentSource(code, 'test-w402.html')
    assert.strictEqual(result.valid, false)

    const w402s = result.diagnostics.filter(d => d.code === 'CORALITE-W402')
    assert.strictEqual(w402s.length, 1)
    assert.strictEqual(w402s[0].severity, 'warning')
  })

  // 13. Component Validity Policy (result.valid)
  test('evaluates result.valid based on errorCount === 0 && totalUnused === 0', () => {
    // Valid component: 0 errors, 0 unused
    const validCode = `
<template>
  <div>{{ title }}</div>
</template>

<script>
  import { defineComponent } from 'coralite'
  export default defineComponent({
    attributes: {
      title: { type: String }
    }
  })
</script>
`
    const resValid = validateComponentSource(validCode, 'valid.html')
    assert.strictEqual(resValid.valid, true)

    // Invalid component due to unused attribute
    const unusedCode = `
<template>
  <div>Hello</div>
</template>

<script>
  import { defineComponent } from 'coralite'
  export default defineComponent({
    attributes: {
      unusedAttr: { type: String }
    }
  })
</script>
`
    const resUnused = validateComponentSource(unusedCode, 'unused.html')
    assert.strictEqual(resUnused.valid, false)

    // Invalid component due to error diagnostic
    const errorCode = `
<template>
  <button onclick="doAction()">Click</button>
</template>

<script>
  import { defineComponent } from 'coralite'
  export default defineComponent({})
</script>
`
    const resError = validateComponentSource(errorCode, 'error.html')
    assert.strictEqual(resError.valid, false)
  })

  // 14. Backwards Compatibility Aliases
  test('supports legacy aliases (analyseComponentSource, formatComponentAnalysis)', () => {
    assert.strictEqual(analyseComponentSource, validateComponentSource)
    assert.strictEqual(formatComponentAnalysis, formatComponentValidationReport)
  })
})
