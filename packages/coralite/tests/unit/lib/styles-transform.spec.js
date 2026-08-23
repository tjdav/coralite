
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { transformCss } from '../../../lib/utils/server/style.js'
import { parseModule } from '../../../lib/utils/server/parse.js'

test('Style Transformation Logic', async (t) => {
  await t.test('parseModule correctly identifies root and descendant classes', () => {
    const html = `
      <template id="test-component">
        <div class="root-class shared-class">
          <span class="descendant-class shared-class">Child</span>
          <div class="nested-root">
             <p class="deep-descendant">Deep</p>
          </div>
        </div>
      </template>
    `

    const module = parseModule(html, { ignoreByAttribute: [] })
    const { rootClasses, descendantClasses } = module

    assert.ok(rootClasses.has('root-class'))
    assert.ok(rootClasses.has('shared-class'))
    assert.ok(!rootClasses.has('descendant-class'))

    assert.ok(descendantClasses.has('descendant-class'))
    assert.ok(descendantClasses.has('shared-class'))
    assert.ok(descendantClasses.has('deep-descendant'))
    assert.ok(!descendantClasses.has('root-class'))
  })

  await t.test('transformCss unwraps top-level pure :host rules and preserves descendant element classes', async () => {
    const css = `
      :host { display: flex; justify-content: center; }
      .root-class { color: red; }
      .descendant-class { color: blue; }
      .card-body { padding: 1rem; }
    `

    const result = await transformCss(css)

    // Expected transformations:
    // Top-level :host is unwrapped directly into declarations
    assert.match(result, /display:\s*flex;/)
    assert.match(result, /justify-content:\s*center;/)
    assert.doesNotMatch(result, /:host/)
    assert.doesNotMatch(result, /&\s*\{/)

    // Internal classes remain standard descendant selectors without &. prefix
    assert.match(result, /\.root-class\s*\{\s*color:\s*red;?\s*\}/)
    assert.match(result, /\.descendant-class\s*\{\s*color:\s*blue;?\s*\}/)
    assert.match(result, /\.card-body\s*\{\s*padding:\s*1rem;?\s*\}/)
    assert.doesNotMatch(result, /&.root-class/)
    assert.doesNotMatch(result, /&.card-body/)
  })

  await t.test('transformCss transforms :host and :host-context pseudo-class selectors correctly', async () => {
    const css = `
      :host { display: block; }
      :host(.active) { color: blue; }
      :host([disabled]) { opacity: 0.5; }
      :host:hover { opacity: 0.8; }
      :host > .inner { padding: 10px; }
      :host-context(.dark) { color: white; }
      :host-context([dir="rtl"]) .title { font-size: 14px; }
      :host-context(body.dark):hover { color: yellow; }
      :host-context(.dark):host(.active) { color: green; }
      :host(.active):host-context(.dark) { color: red; }
      :host(.primary), :host(.secondary) { margin: 5px; }
      @media (min-width: 768px) {
        :host { display: flex; }
      }
    `

    const result = await transformCss(css)

    // Pure top-level :host is unwrapped directly into top-level declarations
    assert.match(result, /display:\s*block;?/)
    assert.match(result, /&\.active\s*\{\s*color:\s*blue;?\s*\}/)
    assert.match(result, /&\[disabled\]\s*\{\s*opacity:\s*0\.5;?\s*\}/)
    assert.match(result, /&:hover\s*\{\s*opacity:\s*0\.8;?\s*\}/)
    assert.match(result, /&\s*>\s*\.inner\s*\{\s*padding:\s*10px;?\s*\}/)
    assert.match(result, /\.dark\s+&\s*\{\s*color:\s*white;?\s*\}/)
    assert.match(result, /\[dir="rtl"\]\s+&\s+\.title\s*\{\s*font-size:\s*14px;?\s*\}/)
    assert.match(result, /body\.dark\s+&:hover\s*\{\s*color:\s*yellow;?\s*\}/)
    assert.match(result, /\.dark\s+&\.active\s*\{\s*color:\s*green;?\s*\}/)
    assert.match(result, /\.dark\s+&\.active\s*\{\s*color:\s*red;?\s*\}/)
    assert.match(result, /&\.primary,\s*&\.secondary\s*\{\s*margin:\s*5px;?\s*\}/)
    assert.match(result, /@media\s+\(min-width:\s*768px\)\s*\{\s*&\s*\{\s*display:\s*flex;?\s*\}\s*\}/)
  })
})
