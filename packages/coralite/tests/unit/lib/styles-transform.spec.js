
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

  await t.test('transformCss applies &. prefix correctly', async () => {
    const rootClasses = new Set(['root-class', 'shared-class'])
    const descendantClasses = new Set(['descendant-class', 'shared-class'])

    const css = `
      .root-class { color: red; }
      .descendant-class { color: blue; }
      .shared-class { color: green; }
      .other-class { color: black; }
    `

    const result = await transformCss(css, rootClasses, descendantClasses)

    // Expected transformations:
    // .root-class -> &.root-class (only on root)
    // .descendant-class -> .descendant-class (only on descendant)
    // .shared-class -> &.shared-class, .shared-class (on both)
    // .other-class -> .other-class (neither, standard selector)

    assert.match(result, /&.root-class\s*\{/)
    assert.match(result, /\.descendant-class\s*\{/)
    assert.doesNotMatch(result, /&.descendant-class/)

    assert.match(result, /&.shared-class/)
    assert.match(result, /\.shared-class\s*\{/)

    assert.match(result, /\.other-class\s*\{/)
  })

  await t.test('transformCss handles existing nesting correctly', async () => {
    const rootClasses = new Set(['root-class'])
    const descendantClasses = new Set([])

    const css = `
      &.root-class { color: red; }
      .root-class:hover { color: blue; }
    `

    const result = await transformCss(css, rootClasses, descendantClasses)

    // &.root-class should remain touched (maybe reformatted)
    assert.match(result, /&.root-class\s*\{/)

    // .root-class:hover -> &.root-class:hover
    assert.match(result, /&.root-class:hover\s*\{/)
  })

  await t.test('transformCss transforms :host and :host-context pseudo-class selectors', async () => {
    const emptySet = new Set()

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

    const result = await transformCss(css, emptySet, emptySet)

    assert.match(result, /&\s*\{\s*display:\s*block;?\s*\}/)
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
