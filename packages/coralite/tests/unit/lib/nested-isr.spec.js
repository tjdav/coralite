import { describe, it, beforeEach, afterEach } from 'node:test'
import { strict as assert } from 'node:assert'
import { createTestProject } from '../utils/project.js'

describe('Nested Incremental Static Regeneration (Nested ISR)', () => {
  let project

  beforeEach(async () => {
    project = await createTestProject()
  })

  afterEach(async () => {
    await project.cleanup()
  })

  it('should rebuild page when a deep nested imperative component changes', async () => {
    // index.html -> <root-comp>
    await project.writePage('index.html', '<root-comp></root-comp>')

    // <root-comp> -> imperatively creates <deep-comp>
    await project.writeComponent('root-comp.html', `
<template id="root-comp">
  <div id="root"></div>
</template>
<script type="module">
  import { defineComponent } from 'coralite';
  export default defineComponent({
    client: async ({ root }) => {
      const el = document.createElement('deep-comp');
      root.appendChild(el);
    }
  });
</script>
`)

    // <deep-comp>
    await project.writeComponent('deep-comp.html', `
<template id="deep-comp">
  <div>Deep Original</div>
</template>
`)

    const coralite = await project.createCoralite()

    // 1. Initial save (writes to disk)
    const results1 = await coralite.save()
    assert.strictEqual(results1.filter(r => r.path.endsWith('index.html')).length, 1)

    // 2. Second save (no changes) - should skip index.html
    const results2 = await coralite.save()
    assert.strictEqual(results2.filter(r => r.path.endsWith('index.html')).length, 0, 'Unchanged page should be skipped in save()')

    // 3. Change <deep-comp> - should trigger rebuild of index.html
    await project.writeComponent('deep-comp.html', `
<template id="deep-comp">
  <div>Deep Updated</div>
</template>
`)

    const results3 = await coralite.save()
    assert.strictEqual(results3.filter(r => r.path.endsWith('index.html')).length, 1, 'Page should NOT be skipped when deep dependency changes')
  })

  it('should handle circular dependencies without infinite loops', async () => {
    // index.html -> <comp-a>
    await project.writePage('index.html', '<comp-a></comp-a>')

    // <comp-a> -> imperatively creates <comp-b>
    await project.writeComponent('comp-a.html', `
<template id="comp-a">
  <div id="a"></div>
</template>
<script type="module">
  import { defineComponent } from 'coralite';
  export default defineComponent({
    client: async ({ root }) => {
      const el = document.createElement('comp-b');
      root.appendChild(el);
    }
  });
</script>
`)

    // <comp-b> -> imperatively creates <comp-a>
    await project.writeComponent('comp-b.html', `
<template id="comp-b">
  <div id="b"></div>
</template>
<script type="module">
  import { defineComponent } from 'coralite';
  export default defineComponent({
    client: async ({ root }) => {
      const el = document.createElement('comp-a');
      root.appendChild(el);
    }
  });
</script>
`)

    const coralite = await project.createCoralite()

    // If there's an infinite loop in dependency resolution, this will throw/hang
    await coralite.build({ mode: 'production' })

    // Verify dependencies are tracked
    const pce = coralite._dependencyGraph.pageCustomElements

    // Check by tag name directly since we improved getPagePathsUsingCustomElement
    assert.ok(pce['comp-a'], 'comp-a should be in graph')
    assert.ok(pce['comp-b'], 'comp-b should be in graph')
  })
})
