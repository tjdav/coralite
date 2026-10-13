import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateComponentSource } from '../../../../../lib/server/component/validator.js'

test('validator pass - validateSlots', async (t) => {
  await t.test('detects slots signature violations and collects defined slots', () => {
    const code = `<template id="x-test-slots"><div><slot></slot></div></template>
<script>
import { defineComponent } from 'coralite'
export default defineComponent({
  slots: {
    a: (nodes, { state }) => state.hide ? [] : nodes,
    b: ({ nodes, state, isServer, signal }) => isServer ? nodes : state.title,
    c: () => undefined,
    d: (ctx) => ctx.nodes
  }
})
</script>`

    const res = validateComponentSource(code, 'x-test-slots.html')
    const e105s = res.diagnostics.filter(d => d.code === 'CORALITE-E105')

    assert.equal(e105s.length, 2)
    assert.match(e105s[0].message, /slots functions must receive a single destructured context/)
    assert.match(e105s[1].message, /slots functions must receive a single destructured context/)

    assert.deepEqual(res.defined.slots.sort(), ['a', 'b', 'c', 'd'])
  })
})
