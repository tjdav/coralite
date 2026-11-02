import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { rm, writeFile, mkdir } from 'node:fs/promises'
import createCoralite from '../../../../lib/server/create.js'
import { isCoraliteNode, isCoraliteTextNode } from '../../../../lib/shared/types.js'

describe('AST Type Guard State Safety', () => {
  it('correctly distinguishes between DOM AST nodes and state objects with type="text"', () => {
    const textNode = {
      type: 'text',
      data: 'valid text'
    }
    const stateObject = {
      type: 'text',
      name: 'email',
      value: 'user@example.com'
    }

    assert.strictEqual(isCoraliteTextNode(textNode), true)
    assert.strictEqual(isCoraliteTextNode(stateObject), false)
    assert.strictEqual(isCoraliteNode(textNode), true)
    assert.strictEqual(isCoraliteNode(stateObject), false)
  })

  it('renders components with slots and state objects without blank text filtering collision', async () => {
    const tmpDir = path.resolve('packages/coralite/tests/unit/lib/server/tmp-ast-slot-test')
    const pagesDir = path.join(tmpDir, 'pages')
    const componentsDir = path.join(tmpDir, 'components')

    await rm(tmpDir, {
      recursive: true,
      force: true
    })
    await mkdir(pagesDir, { recursive: true })
    await mkdir(componentsDir, { recursive: true })

    const componentHtml = `<template id="custom-form">
  <form>
    <slot></slot>
  </form>
</template>
<script type="module">
  export const slots = {
    default: ({ nodes }) => nodes
  }
</script>`

    const pageHtml = `<template>
  <custom-form>
    <input type="text" name="email" value="user@test.com" />
  </custom-form>
</template>`

    await writeFile(path.join(componentsDir, 'custom-form.html'), componentHtml, 'utf8')
    await writeFile(path.join(pagesDir, 'index.html'), pageHtml, 'utf8')

    const app = await createCoralite({
      pages: pagesDir,
      components: componentsDir,
      mode: 'production',
      cleanUrls: false
    })

    const results = await app.build()
    await app.clearCache(true)
    assert.strictEqual(results.length, 1)
    const content = results[0].content
    assert.ok(content.includes('type="text"'), 'Slotted input rendered')
    assert.ok(content.includes('name="email"'), 'Slotted input name rendered')

    await rm(tmpDir, {
      recursive: true,
      force: true
    })
  })

  it('renders components with state and attribute properties named type="text" without AST collision', async () => {
    const tmpDir = path.resolve('packages/coralite/tests/unit/lib/server/tmp-ast-state-test')
    const pagesDir = path.join(tmpDir, 'pages')
    const componentsDir = path.join(tmpDir, 'components')

    await rm(tmpDir, {
      recursive: true,
      force: true
    })
    await mkdir(pagesDir, { recursive: true })
    await mkdir(componentsDir, { recursive: true })

    const componentHtml = `<template id="ui-input">
  <div class="input-wrap">
    <input type="{{ type }}" value="{{ value }}" />
    <span class="type-display">{{ inputType }}</span>
  </div>
</template>
<script type="module">
  export const attributes = {
    type: { type: String, default: 'text' },
    value: { type: String, default: '' }
  }

  export const getters = {
    inputType: ({ state }) => 'input:' + state.type
  }
</script>`

    const pageHtml = `<template>
  <ui-input type="text" value="hello"></ui-input>
</template>`

    await writeFile(path.join(componentsDir, 'ui-input.html'), componentHtml, 'utf8')
    await writeFile(path.join(pagesDir, 'index.html'), pageHtml, 'utf8')

    const app = await createCoralite({
      pages: pagesDir,
      components: componentsDir,
      mode: 'production',
      cleanUrls: false
    })

    const results = await app.build()
    await app.clearCache(true)
    assert.strictEqual(results.length, 1)
    const content = results[0].content
    assert.ok(content.includes('type="text"'), 'Attribute type="text" rendered')
    assert.ok(content.includes('value="hello"'), 'Attribute value="hello" rendered')
    assert.ok(content.includes('input:text'), 'Getter inputType rendered state.type without collapse')

    await rm(tmpDir, {
      recursive: true,
      force: true
    })
  })
})
