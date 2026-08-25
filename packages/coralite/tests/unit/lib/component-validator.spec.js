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
    assert.strictEqual(e101s[0].fix.action, undefined)
    assert.ok(e101s[0].fix.description.includes('cannot be Array or Object'))
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
    assert.strictEqual(e301s[0].fix.isSharedWithOtherBlocks, false)

    // Top-level local variable reference
    assert.strictEqual(e301s[1].severity, 'error')
    assert.strictEqual(e301s[1].message, "Top-level variable 'LOCAL_CONFIG' referenced inside client() block.")
    assert.strictEqual(e301s[1].cause, 'Variables declared in the top-level script scope cannot be serialized to the browser client() block.')
    assert.strictEqual(e301s[1].fix.action, undefined)
    assert.strictEqual(
      e301s[1].fix.description,
      "Variable 'LOCAL_CONFIG' declared in top-level script scope cannot be serialized to client(). Move inside client() or initialize via server()."
    )
  })

  test('CORALITE-E301: tracks isSharedWithOtherBlocks when import is used in server()/getters/slots/style', () => {
    const code = `
<template>
  <div>Test</div>
</template>

<script>
  import { defineComponent } from 'coralite'
  import { formatDate } from './utils.js'

  export default defineComponent({
    async server() {
      const formatted = formatDate(new Date())
      return { formatted }
    },
    client() {
      const clientFormatted = formatDate(new Date())
    }
  })
</script>
`
    const result = validateComponentSource(code, 'test-e301-shared.html')
    const e301s = result.diagnostics.filter(d => d.code === 'CORALITE-E301')
    assert.strictEqual(e301s.length, 1)
    assert.strictEqual(e301s[0].fix.action, 'dynamic_import')
    assert.strictEqual(e301s[0].fix.isSharedWithOtherBlocks, true)
  })

  test('Template Scoping: ignores mustache expressions and event handlers outside <template>', () => {
    const code = `
<!-- {{ item.price * taxRate }} -->
<!-- <button onclick="handleClick()">Outside</button> -->
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
    const result = validateComponentSource(code, 'test-template-scoping.html')
    const e201s = result.diagnostics.filter(d => d.code === 'CORALITE-E201')
    const e203s = result.diagnostics.filter(d => d.code === 'CORALITE-E203')

    assert.strictEqual(e201s.length, 0)
    assert.strictEqual(e203s.length, 0)
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

  // 14. AST Ref Determinism Verification (CORALITE-W204)
  test('CORALITE-W204: emits warning for top-level if (btn) and if (refs("btn")) existence checks', () => {
    const code1 = `
<template>
  <button ref="submit-btn">Submit</button>
</template>

<script>
  import { defineComponent } from 'coralite'
  export default defineComponent({
    client({ refs }) {
      const btn = refs('submit-btn')
      if (btn) {
        btn.addEventListener('click', () => {})
      }
    }
  })
</script>
`
    const res1 = validateComponentSource(code1, 'w204-1.html')
    const w204s1 = res1.diagnostics.filter(d => d.code === 'CORALITE-W204')
    assert.strictEqual(w204s1.length, 1)
    assert.strictEqual(w204s1[0].severity, 'warning')
    assert.strictEqual(w204s1[0].fix.action, 'unwrap_ref_guard')
    assert.ok(w204s1[0].message.includes('Redundant existence check on ref "submit-btn"'))

    const code2 = `
<template>
  <button ref="submit-btn">Submit</button>
</template>

<script>
  import { defineComponent } from 'coralite'
  export default defineComponent({
    client({ refs }) {
      if (refs('submit-btn')) {
        refs('submit-btn').addEventListener('click', () => {})
      }
    }
  })
</script>
`
    const res2 = validateComponentSource(code2, 'w204-2.html')
    const w204s2 = res2.diagnostics.filter(d => d.code === 'CORALITE-W204')
    assert.strictEqual(w204s2.length, 1)
    assert.strictEqual(w204s2[0].severity, 'warning')
    assert.strictEqual(w204s2[0].fix.action, 'unwrap_ref_guard')
  })

  test('CORALITE-W204: does NOT emit warning inside observe(), async callbacks, or direct access', () => {
    const code = `
<template>
  <div ref="panel">Panel</div>
  <button ref="btn">Button</button>
</template>

<script>
  import { defineComponent } from 'coralite'
  export default defineComponent({
    client({ refs, observe, signal }) {
      const panel = refs('panel')
      const btn = refs('btn')

      btn.addEventListener('click', () => {}, { signal })

      observe('tab', () => {
        if (panel) {
          panel.classList.toggle('active')
        }
      })
    }
  })
</script>
`
    const result = validateComponentSource(code, 'w204-nested.html')
    const w204s = result.diagnostics.filter(d => d.code === 'CORALITE-W204')
    assert.strictEqual(w204s.length, 0)
  })

  // 15. CORALITE-E105 Diagnostic Rule Test
  test('CORALITE-E105: emits diagnostic when context.attributes is accessed in server() or client()', () => {
    const code = `
<template>
  <div>Test</div>
</template>

<script>
  import { defineComponent } from 'coralite'
  export default defineComponent({
    attributes: {
      lang: { type: String, default: 'en' }
    },
    async server(context) {
      const l = context.attributes.lang
      return { l }
    },
    async client({ attributes }) {
      console.log(attributes)
    }
  })
</script>
`
    const result = validateComponentSource(code, 'test-e105.html')
    assert.strictEqual(result.valid, false)

    const e105s = result.diagnostics.filter(d => d.code === 'CORALITE-E105')
    assert.strictEqual(e105s.length, 2)
    assert.strictEqual(e105s[0].severity, 'error')
    assert.strictEqual(e105s[0].fix.action, 'rewrite_context_attributes')
    assert.strictEqual(e105s[1].severity, 'error')
    assert.strictEqual(e105s[1].fix.action, 'rewrite_context_attributes')
  })

  // 16. state.errors.<prop> Attribute Usage Tracking Test
  test('state.errors.<prop>: components consuming attributes solely via state.errors.myProp achieve 100% usage coverage', () => {
    const code = `
<template>
  <div>{{ isAgeValid }}</div>
</template>

<script>
  import { defineComponent } from 'coralite'
  export default defineComponent({
    attributes: {
      userAge: { type: Number }
    },
    getters: {
      isAgeValid: (state) => !state.errors.userAge
    }
  })
</script>
`
    const result = validateComponentSource(code, 'test-errors-usage.html')
    assert.strictEqual(result.unused.attributes.length, 0)
    assert.strictEqual(result.metrics.usageCoveragePercentage, 100)
    assert.strictEqual(result.valid, true)
  })

  // 17. Single-File HTML Script Offset Accuracy
  test('Single-File HTML Script Offset Accuracy: reports file-relative line coordinates and codeframe previews', () => {
    const templateLines = Array.from({ length: 50 }, (_, i) => `  <div>Template line ${i + 1}</div>`).join('\n')
    const code = `<template>
${templateLines}
  <button ref="my-btn">Click</button>
</template>

<script>
  import { defineComponent } from 'coralite'
  export default defineComponent({
    client({ refs }) {
      const btn = refs('my-btn')
      if (btn) {
        btn.focus()
      }
    }
  })
</script>
`
    const result = validateComponentSource(code, 'offset-test.html')
    const w204 = result.diagnostics.find(d => d.code === 'CORALITE-W204')
    assert.ok(w204)
    // scriptContent starts at line 56, if (btn) is line 5 of scriptContent => 55 + 5 = line 60 of file
    assert.strictEqual(w204.line, 60)
    assert.ok(w204.codeframe.includes('60 |       if (btn) {'))
  })

  // 18. Precision Ref Selectors (Positive Test Cases)
  test('Precision Ref Selectors: recognizes ref selectors in JS strings, template literals, and <style>', () => {
    // 1. DOM Event Delegation (closest)
    const code1 = `
<template><button ref="btnApply">Apply</button></template>
<script>
  import { defineComponent } from 'coralite'
  export default defineComponent({
    client: ({ root }) => {
      root.addEventListener('click', e => {
        if (e.target.closest('[ref="btnApply"]') || e.target.closest('[ref$="btnApply"]')) {}
      })
    }
  })
</script>
`
    const res1 = validateComponentSource(code1, 'test-selector-closest.html')
    const w402s1 = res1.diagnostics.filter(d => d.code === 'CORALITE-W402')
    assert.strictEqual(w402s1.length, 0)

    // 2. Query Selector (querySelector)
    const code2 = `
<template><img ref="avatarImage" src="avatar.png"></template>
<script>
  import { defineComponent } from 'coralite'
  export default defineComponent({
    client: ({ root }) => {
      const img = root.querySelector('img[ref="avatarImage"]')
    }
  })
</script>
`
    const res2 = validateComponentSource(code2, 'test-selector-query.html')
    const w402s2 = res2.diagnostics.filter(d => d.code === 'CORALITE-W402')
    assert.strictEqual(w402s2.length, 0)

    // 3. Module-level CSS-in-JS Selector Constant
    const code3 = `
<template><div ref="container"></div></template>
<script>
  import { defineComponent } from 'coralite'
  const CONTAINER_SEL = '[ref="container"]'
  export default defineComponent({ client: () => {} })
</script>
`
    const res3 = validateComponentSource(code3, 'test-selector-const.html')
    const w402s3 = res3.diagnostics.filter(d => d.code === 'CORALITE-W402')
    assert.strictEqual(w402s3.length, 0)

    // 4. <style> Ref Selector
    const code4 = `
<template><div ref="banner"></div></template>
<style>[ref="banner"] { display: block; }</style>
<script>
  import { defineComponent } from 'coralite'
  export default defineComponent({})
</script>
`
    const res4 = validateComponentSource(code4, 'test-selector-style.html')
    const w402s4 = res4.diagnostics.filter(d => d.code === 'CORALITE-W402')
    assert.strictEqual(w402s4.length, 0)

    // 5. Object Map Keys (subItemBtns pattern)
    const code5 = `<template>
  <button ref="btnMusic">Music</button>
  <button ref="btnPictures">Pictures</button>
  <button ref="btnVideo">Video</button>
</template>

<script>
  import { defineComponent } from 'coralite'
  export default defineComponent({
    client({ refs }) {
      const subItemBtns = {
        btnMusic: 'music',
        btnPictures: 'pictures',
        btnVideo: 'video'
      }
      Object.entries(subItemBtns).forEach(([refName, viewName]) => {
        const btn = refs(refName)
      })
    }
  })
</script>
`
    const res5 = validateComponentSource(code5, 'test-lookup-map.html')
    const w402s5 = res5.diagnostics.filter(d => d.code === 'CORALITE-W402')
    assert.strictEqual(w402s5.length, 0)
  })

  // 19. Precision Ref Selectors (Negative Test Cases - Must Emit CORALITE-W402)
  test('Precision Ref Selectors: continues to warn CORALITE-W402 for non-ref selectors, comments, and invalid accesses', () => {
    // 1. Coincidental getElementById / data-ref
    const code1 = `
<template><button ref="btnApply">Apply</button></template>
<script>
  import { defineComponent } from 'coralite'
  export default defineComponent({
    client: () => {
      document.getElementById('btnApply')
      document.querySelector('[data-ref="btnApply"]')
    }
  })
</script>
`
    const res1 = validateComponentSource(code1, 'test-neg-getelem.html')
    const w402s1 = res1.diagnostics.filter(d => d.code === 'CORALITE-W402')
    assert.strictEqual(w402s1.length, 1)

    // 2. Plain CSS Class / ID (no ref=)
    const code2 = `
<template><button ref="btnApply">Apply</button></template>
<style>.btnApply { color: red; } #btnApply { color: blue; }</style>
<script>
  import { defineComponent } from 'coralite'
  export default defineComponent({})
</script>
`
    const res2 = validateComponentSource(code2, 'test-neg-plaincss.html')
    const w402s2 = res2.diagnostics.filter(d => d.code === 'CORALITE-W402')
    assert.strictEqual(w402s2.length, 1)

    // 3. Comment Mention Only
    const code3 = `
<template><button ref="btnApply">Apply</button></template>
<style>/* [ref="btnApply"] */</style>
<script>
  // [ref="btnApply"]
  import { defineComponent } from 'coralite'
  export default defineComponent({ client: () => {} })
</script>
`
    const res3 = validateComponentSource(code3, 'test-neg-comments.html')
    const w402s3 = res3.diagnostics.filter(d => d.code === 'CORALITE-W402')
    assert.strictEqual(w402s3.length, 1)

    // 4. Invalid Property Access refs.btnApply
    const code4 = `
<template><button ref="btnApply">Apply</button></template>
<script>
  import { defineComponent } from 'coralite'
  export default defineComponent({
    client: ({ refs }) => {
      const b = refs.btnApply
    }
  })
</script>
`
    const res4 = validateComponentSource(code4, 'test-neg-refs-member.html')
    const w402s4 = res4.diagnostics.filter(d => d.code === 'CORALITE-W402')
    assert.strictEqual(w402s4.length, 1)
  })

  // 20. Inter-Getter Dependencies & Observer Tracking & Coordinates
  test('should recognize inter-getter state dependencies and suppress CORALITE-W401', () => {
    const componentSource = `
<template>
  <div aria-expanded="{{ isAriaExpanded }}">Header</div>
</template>
<script type="module">
  import { defineComponent } from 'coralite'
  export default defineComponent({
    attributes: {
      variant: String,
      expanded: Boolean
    },
    getters: {
      isAccordion: (state) => state.variant === 'accordion',
      isAriaExpanded: (state) => {
        if (!state.isAccordion) return null
        return state.expanded ? 'true' : 'false'
      }
    }
  })
</script>
`
    const result = validateComponentSource(componentSource, 'test-inter-getter.html')
    const w401s = result.diagnostics.filter(d => d.code === 'CORALITE-W401')
    assert.strictEqual(w401s.length, 0, 'Getter consumed by another getter should not emit CORALITE-W401')
  })

  test('should report accurate line and column numbers for unused getters and server properties', () => {
    const componentSource = `
<template>
  <div>Simple Component</div>
</template>
<script type="module">
  import { defineComponent } from 'coralite'
  export default defineComponent({
    async server() {
      return {
        unusedServerProp: 42
      }
    },
    getters: {
      unusedGetter: (state) => state.unknown
    }
  })
</script>
`
    const result = validateComponentSource(componentSource, 'test-coords.html')
    const w401s = result.diagnostics.filter(d => d.code === 'CORALITE-W401')
    assert.strictEqual(w401s.length, 2)

    const serverPropDiag = w401s.find(d => d.message.includes('unusedServerProp'))
    const getterDiag = w401s.find(d => d.message.includes('unusedGetter'))

    assert.ok(serverPropDiag, 'Server prop diagnostic should exist')
    assert.strictEqual(serverPropDiag.line, 10, 'Server prop should point to line 10')

    assert.ok(getterDiag, 'Getter diagnostic should exist')
    assert.strictEqual(getterDiag.line, 14, 'Getter should point to line 14')
  })

  test('should recognize properties observed via observe() and suppress CORALITE-W401', () => {
    const componentSource = `
<template>
  <div>Observer Component</div>
</template>
<script type="module">
  import { defineComponent } from 'coralite'
  export default defineComponent({
    attributes: {
      activeTab: String,
      sidebarOpen: Boolean
    },
    client: ({ observe }) => {
      observe('activeTab', (val) => {})
      observe(['sidebarOpen'], (val) => {})
    }
  })
</script>
`
    const result = validateComponentSource(componentSource, 'test-observer.html')
    const w401s = result.diagnostics.filter(d => d.code === 'CORALITE-W401')
    assert.strictEqual(w401s.length, 0, 'Attributes observed via observe() should not emit CORALITE-W401')
  })

  // 21. Backwards Compatibility Aliases
  test('supports legacy aliases (analyseComponentSource, formatComponentAnalysis)', () => {
    assert.strictEqual(analyseComponentSource, validateComponentSource)
    assert.strictEqual(formatComponentAnalysis, formatComponentValidationReport)
  })
})
