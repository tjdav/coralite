
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { transformCss } from '../../../lib/style-transform.js'
import { parseModule } from '../../../lib/parse.js'

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
})
