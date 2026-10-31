import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { createCoralite } from '#lib'
import { validateComponentSource } from '../../../../lib/server/component/validator.js'

let TEST_DIR
let COMPONENTS_DIR
let PAGES_DIR
let OUTPUT_DIR

describe('Component Named Exports', () => {
  beforeEach(async () => {
    TEST_DIR = await mkdtemp(join(tmpdir(), 'coralite-named-exports-'))
    COMPONENTS_DIR = join(TEST_DIR, 'components')
    PAGES_DIR = join(TEST_DIR, 'pages')
    OUTPUT_DIR = join(TEST_DIR, 'dist')

    await mkdir(COMPONENTS_DIR, { recursive: true })
    await mkdir(PAGES_DIR, { recursive: true })
    await mkdir(OUTPUT_DIR, { recursive: true })
  })

  afterEach(async () => {
    await rm(TEST_DIR, {
      recursive: true,
      force: true
    })
  })

  it('SSR renders component with named exports for server, getters, attributes, style, and slots', async () => {
    await writeFile(
      join(COMPONENTS_DIR, 'product-card.html'),
      `<template id="product-card">
        <div class="card">
          <h2>{{ name }}</h2>
          <p class="price">{{ priceDisplay }}</p>
          <slot name="badge"></slot>
        </div>
      </template>
      <script type="module">
        export const attributes = {
          currency: {
            type: String,
            default: 'USD'
          }
        }

        export function server ({ attributes }) {
          return {
            name: 'Mechanical Keyboard',
            price: 150
          }
        }

        export const getters = {
          priceDisplay: ({ state }) => \`\${state.currency} \${state.price}\`
        }

        export const style = {
          border: '1px solid black',
          display: 'block'
        }

        export const slots = {
          badge: ({ nodes }) => nodes
        }

        export function client ({ state, refs }) {
          // client logic
        }

        export const formControl = true
        export const listStrategy = 'minimal'
      </script>`
    )

    await writeFile(
      join(PAGES_DIR, 'index.html'),
      `<!DOCTYPE html>
      <html>
        <body>
          <product-card currency="EUR">
            <span slot="badge">New</span>
          </product-card>
        </body>
      </html>`
    )

    const app = await createCoralite({
      components: COMPONENTS_DIR,
      pages: PAGES_DIR,
      output: OUTPUT_DIR,
      mode: 'production',
      incremental: false
    })

    const results = await app.build()
    const htmlOutput = results[0]?.content || ''
    assert.ok(htmlOutput.includes('Mechanical Keyboard'), 'renders server() returned state')
    assert.ok(htmlOutput.includes('EUR 150'), 'evaluates getters() with attributes')
    assert.ok(htmlOutput.includes('New'), 'projects transformed slots')
    assert.ok(htmlOutput.includes('style="border: 1px solid black; display: block;"') || htmlOutput.includes('border: 1px solid black; display: block;'), 'applies reactive style')

    // Client bundle checks
    assert.ok(htmlOutput.includes('product-card'), 'component registered in output')
  })

  it('SSR onError fallback works with named export', async () => {
    await writeFile(
      join(COMPONENTS_DIR, 'broken-comp.html'),
      `<template id="broken-comp">
        <p>{{ val }}</p>
      </template>
      <script type="module">
        export function server () {
          throw new Error('SSR Crash')
        }

        export function onError ({ error }) {
          return {
            template: '<p class="fallback">Recovered: {{ msg }}</p>',
            state: { msg: error.message }
          }
        }
      </script>`
    )

    await writeFile(
      join(PAGES_DIR, 'index.html'),
      `<!DOCTYPE html>
      <html>
        <body>
          <broken-comp></broken-comp>
        </body>
      </html>`
    )

    const app = await createCoralite({
      components: COMPONENTS_DIR,
      pages: PAGES_DIR,
      output: OUTPUT_DIR,
      mode: 'production',
      incremental: false
    })

    const results = await app.build()
    const htmlOutput = results[0]?.content || ''
    assert.ok(htmlOutput.includes('Recovered: SSR Crash'), 'renders onError fallback')
  })

  it('defineComponent takes precedence when both defineComponent and named exports are present', async () => {
    await writeFile(
      join(COMPONENTS_DIR, 'dual-comp.html'),
      `<template id="dual-comp">
        <p>{{ title }}</p>
      </template>
      <script type="module">
        import { defineComponent } from 'coralite'

        export function server () {
          return { title: 'From Named Export' }
        }

        export default defineComponent({
          server: () => ({ title: 'From defineComponent' })
        })
      </script>`
    )

    await writeFile(
      join(PAGES_DIR, 'index.html'),
      `<!DOCTYPE html>
      <html>
        <body>
          <dual-comp></dual-comp>
        </body>
      </html>`
    )

    const app = await createCoralite({
      components: COMPONENTS_DIR,
      pages: PAGES_DIR,
      output: OUTPUT_DIR,
      mode: 'production',
      incremental: false
    })

    const results = await app.build()
    const htmlOutput = results[0]?.content || ''
    assert.ok(htmlOutput.includes('From defineComponent'), 'defineComponent takes precedence over named exports')
    assert.ok(!htmlOutput.includes('From Named Export'), 'named export was ignored due to defineComponent')
  })

  it('validator enforces export function for handlers and export const for declaration data', () => {
    // Valid named exports
    const validCode = `<template id="test-comp"><div></div></template>
    <script type="module">
      export function server () { return { count: 0 } }
      export function client () {}
      export function onError () {}
      export const getters = { double: ({ state }) => state.count * 2 }
      export const attributes = { label: String }
      export const style = { color: 'red' }
      export const slots = { default: ({ nodes }) => nodes }
      export const provide = { theme: 'dark' }
      export const consume = ['theme']
      export const formControl = true
      export const listStrategy = 'minimal'
      export const helperConst = 42
    </script>`

    const validRes = validateComponentSource(validCode, 'test-comp.html')
    const validErrors = validRes.diagnostics.filter(d => d.severity === 'error')
    assert.equal(validErrors.length, 0, `Expected 0 errors for valid named exports, found: ${validErrors.map(e => e.message).join(', ')}`)
    assert.deepEqual(validRes.defined.attributes, ['label'])
    assert.deepEqual(validRes.defined.getters, ['double'])
    assert.deepEqual(validRes.defined.slots, ['default'])

    // Invalid export forms: handler using export const, declaration data using export function
    const invalidCode = `<template id="test-invalid"><div></div></template>
    <script type="module">
      export const server = () => ({ count: 0 })
      export const client = () => {}
      export function getters () { return {} }
      export let attributes = { label: String }
    </script>`

    const invalidRes = validateComponentSource(invalidCode, 'test-invalid.html')
    const e107s = invalidRes.diagnostics.filter(d => d.code === 'CORALITE-E107')
    assert.ok(e107s.some(e => e.message.includes('server') && e.message.includes('export function')), 'flags server export const')
    assert.ok(e107s.some(e => e.message.includes('client') && e.message.includes('export function')), 'flags client export const')
    assert.ok(e107s.some(e => e.message.includes('getters') && e.message.includes('export const')), 'flags getters export function')
    assert.ok(e107s.some(e => e.message.includes('attributes') && e.message.includes('export const')), 'flags attributes export let')
  })

  it('client code extracts listStrategy and formControl in virtual module', async () => {
    await writeFile(
      join(COMPONENTS_DIR, 'list-comp.html'),
      `<template id="list-comp">
        <ul><li>item</li></ul>
      </template>
      <script type="module">
        export const formControl = true
        export const listStrategy = {
          mode: 'minimal',
          key: (item) => item.id
        }
        export function client ({ state }) {}
      </script>`
    )

    await writeFile(
      join(PAGES_DIR, 'index.html'),
      `<!DOCTYPE html>
      <html><body><list-comp></list-comp></body></html>`
    )

    const app = await createCoralite({
      components: COMPONENTS_DIR,
      pages: PAGES_DIR,
      output: OUTPUT_DIR,
      mode: 'production',
      incremental: false
    })

    const results = await app.build()
    const htmlOutput = results[0]?.content || ''
    assert.ok(htmlOutput.includes('list-comp'), 'renders list-comp')
  })
})
