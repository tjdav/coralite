import { test } from 'node:test'
import assert from 'node:assert/strict'
import { transformCss, formatComponentCss } from '../../../lib/utils/server/style.js'
import { parseModule } from '../../../lib/utils/server/parse.js'
import { injectStyles } from '../../../lib/utils/server/render.js'
import { createCoraliteElement, createCoraliteComponent } from '../../../lib/utils/server/dom.js'

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

  await t.test('transformCss unwraps top-level pure :host rules and preserves descendant element classes in nesting mode', async () => {
    const css = `
      :host { display: flex; justify-content: center; }
      .root-class { color: red; }
      .descendant-class { color: blue; }
      .card-body { padding: 1rem; }
    `

    const result = await transformCss(css, null, { mode: 'nesting' })

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

  await t.test('transformCss converts :host to :scope in scope mode', async () => {
    const css = `
      :host { display: flex; justify-content: center; }
      :host(.active) { color: blue; }
      :host([disabled]) { opacity: 0.5; }
      :host:hover { opacity: 0.8; }
      .card-body { padding: 1rem; }
    `

    const result = await transformCss(css, null, { mode: 'scope' })

    assert.match(result, /:scope\s*\{\s*display:\s*flex;\s*justify-content:\s*center;?\s*\}/)
    assert.match(result, /:scope\.active\s*\{\s*color:\s*blue;?\s*\}/)
    assert.match(result, /:scope\[disabled\]\s*\{\s*opacity:\s*0\.5;?\s*\}/)
    assert.match(result, /:scope:hover\s*\{\s*opacity:\s*0\.8;?\s*\}/)
    assert.match(result, /\.card-body\s*\{\s*padding:\s*1rem;?\s*\}/)
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

  await t.test('transformCss transforms ::slotted(selector) into dual Light DOM slot projection branches', async () => {
    const css = `
      ::slotted(img) { border-radius: 4px; }
      ::slotted(img.avatar) { border: 2px solid blue; }
      :host(.active) ::slotted(a) { color: red; }
      .container ::slotted(span) { font-weight: bold; }
    `

    const nestingResult = await transformCss(css, null, { mode: 'nesting' })
    assert.match(nestingResult, /&\s*>\s*slot\s*>\s*img,\s*&\s*>\s*img\[slot\]\s*\{\s*border-radius:\s*4px;?\s*\}/)
    assert.match(nestingResult, /&\s*>\s*slot\s*>\s*img\.avatar,\s*&\s*>\s*img\.avatar\[slot\]\s*\{\s*border:\s*2px solid blue;?\s*\}/)
    assert.match(nestingResult, /&\.active\s*>\s*slot\s*>\s*a,\s*&\.active\s*>\s*a\[slot\]\s*\{\s*color:\s*red;?\s*\}/)
    assert.match(nestingResult, /\.container\s*>\s*slot\s*>\s*span,\s*\.container\s*>\s*span\[slot\]\s*\{\s*font-weight:\s*bold;?\s*\}/)

    const scopeResult = await transformCss(css, null, { mode: 'scope' })
    assert.match(scopeResult, /:scope\s*>\s*slot\s*>\s*img,\s*:scope\s*>\s*img\[slot\]\s*\{\s*border-radius:\s*4px;?\s*\}/)
    assert.match(scopeResult, /:scope\s*>\s*slot\s*>\s*img\.avatar,\s*:scope\s*>\s*img\.avatar\[slot\]\s*\{\s*border:\s*2px solid blue;?\s*\}/)
    assert.match(scopeResult, /:scope\.active\s*>\s*slot\s*>\s*a,\s*:scope\.active\s*>\s*a\[slot\]\s*\{\s*color:\s*red;?\s*\}/)
  })

  await t.test('transformCss unwraps and hoists :global(selector) rules', async () => {
    const css = `
      :global(.modal-backdrop) { opacity: 0.5; }
      .card {
        padding: 1rem;
        :global(.card-portal) { z-index: 100; }
      }
      @media (min-width: 768px) {
        :global(.toast) { opacity: 0.8; }
      }
    `

    const result = await transformCss(css)

    assert.match(result, /\.modal-backdrop\s*\{\s*opacity:\s*0\.5;?\s*\}/)
    assert.match(result, /\.card-portal\s*\{\s*z-index:\s*100;?\s*\}/)
    assert.match(result, /@media\s+\(min-width:\s*768px\)\s*\{\s*\.toast\s*\{\s*opacity:\s*0\.8;?\s*\}\s*\}/)
    assert.doesNotMatch(result, /:global/)
    assert.doesNotMatch(result, /&\s*\.modal-backdrop/)
  })

  await t.test('transformCss preserves @container queries and scopes internal component rules', async () => {
    const css = `
      @container (min-width: 400px) {
        :host { display: grid; }
        .inner { padding: 1rem; }
      }
    `

    const result = await transformCss(css)

    assert.match(result, /@container\s+\(min-width:\s*400px\)\s*\{\s*&\s*\{\s*display:\s*grid;?\s*\}\s*\.inner\s*\{\s*padding:\s*1rem;?\s*\}\s*\}/)
  })

  await t.test('transformCss preserves @keyframes definitions verbatim without mangling step selectors', async () => {
    const css = `
      @keyframes fade {
        0% { opacity: 0; }
        50% { opacity: 0.5; }
        100% { opacity: 1; }
      }
      @-webkit-keyframes slide {
        from { transform: translateX(0); }
        to { transform: translateX(100%); }
      }
    `

    const result = await transformCss(css)

    assert.match(result, /@keyframes\s+fade\s*\{\s*0%\s*\{\s*opacity:\s*0;?\s*\}\s*50%\s*\{\s*opacity:\s*0\.5;?\s*\}\s*100%\s*\{\s*opacity:\s*1;?\s*\}\s*\}/)
    assert.match(result, /@-webkit-keyframes\s+slide\s*\{\s*from\s*\{\s*transform:\s*translateX\(0\);?\s*\}\s*to\s*\{\s*transform:\s*translateX\(100%\);?\s*\}\s*\}/)
  })

  await t.test('formatComponentCss generates @supports (@scope) donut boundary and @supports not (@scope) fallback', async () => {
    const componentId = 'my-card'
    const css = `
      :host { display: block; border: 1px solid #ccc; }
      .title { color: primary; }
      ::slotted(p) { font-size: 1rem; }
    `

    const result = await formatComponentCss(componentId, css)

    // Verify @supports (@scope) structure with donut boundary
    assert.match(result, /@supports\s+\(@scope\)\s*\{/)
    assert.match(result, /@scope\s*\(:where\(my-card\)\)\s*to\s*\(slot,\s*\[data-cid\],\s*:is\(\[is\],\s*c-token\)\)\s*\{/)
    assert.match(result, /:scope\s*\{\s*display:\s*block;\s*border:\s*1px solid #ccc;?\s*\}/)
    assert.match(result, /\.title\s*\{\s*color:\s*primary;?\s*\}/)
    assert.match(result, /:scope\s*>\s*slot\s*>\s*p,\s*:scope\s*>\s*p\[slot\]\s*\{\s*font-size:\s*1rem;?\s*\}/)

    // Verify @supports not (@scope) fallback structure
    assert.match(result, /@supports not\s+\(@scope\)\s*\{/)
    assert.match(result, /:where\(my-card\)\s*\{/)
    assert.match(result, /display:\s*block;\s*border:\s*1px solid #ccc;?/)
    assert.match(result, /&\s*>\s*slot\s*>\s*p,\s*&\s*>\s*p\[slot\]\s*\{\s*font-size:\s*1rem;?\s*\}/)
  })

  await t.test('injectStyles wraps component CSS in @layer components, preserving c-token', async () => {
    const head = createCoraliteElement({ name: 'head', children: [] })
    const root = createCoraliteComponent({ children: [head] })

    const formattedCss = await formatComponentCss('my-comp', '.btn { color: red; }')
    const stylesMap = new Map([
      ['my-comp', formattedCss]
    ])

    const { content } = injectStyles(root, head, stylesMap)

    // Verify c-token is preserved at top
    assert.ok(content.startsWith('c-token { display: contents; }\n'))

    // Verify @layer components wrapping
    assert.match(content, /@layer components \{\s*@supports\s+\(@scope\)\s*\{/)
    assert.match(content, /@scope\s*\(:where\(my-comp\)\)\s*to\s*\(slot,\s*\[data-cid\],\s*:is\(\[is\],\s*c-token\)\)/)
    assert.match(content, /@supports not\s+\(@scope\)\s*\{\s*:where\(my-comp\)/)
  })
})
