import { test } from 'node:test'
import assert from 'node:assert'
import '../setup.js'
import { createCoralite } from '../../../lib/index.js'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'

test('strip custom elements with no-hydration attribute', async (t) => {
  const tmpDir = join(process.cwd(), 'tmp-test-no-hydration')
  const componentsDir = join(tmpDir, 'components')
  const pagesDir = join(tmpDir, 'pages')

  await mkdir(componentsDir, { recursive: true })
  await mkdir(pagesDir, { recursive: true })

  // Define a nested component
  await writeFile(join(componentsDir, 'nested-comp.html'), `
<template id="nested-comp">
  <span class="nested">Nested Content</span>
</template>
  `)

  // Define a component to be used with no-hydration
  await writeFile(join(componentsDir, 'coralite-meta.html'), `
<template id="coralite-meta">
  <title>{{ title }}</title>
  <meta name="description" content="{{ description }}">
  <nested-comp></nested-comp>
</template>
<script type="module">
  import { defineComponent } from 'coralite'
  export default defineComponent({
    attributes: {
      title: { type: String, default: 'Default Title' },
      description: { type: String, default: 'Default Description' }
    }
  })
</script>
  `)

  // Define a page using the component with no-hydration
  await writeFile(join(pagesDir, 'index.html'), `
<!DOCTYPE html>
<html>
<head>
  <coralite-meta no-hydration title="Hello World" description="Test description"></coralite-meta>
</head>
<body>
  <h1>Content</h1>
  <nested-comp></nested-comp>
</body>
</html>
  `)

  const coralite = await createCoralite({
    components: componentsDir,
    pages: pagesDir
  })

  const results = await coralite.build()

  const indexPage = results.find(r => r.path.filename === 'index.html')
  assert.ok(indexPage, 'Index page should be built')

  const content = indexPage.content
  document.documentElement.innerHTML = content

  // 1. Check if <coralite-meta> is removed but its children are present
  const coraliteMeta = document.querySelector('coralite-meta')
  assert.ok(!coraliteMeta, 'Should not contain <coralite-meta> tag')

  const title = document.querySelector('title')
  assert.ok(title, 'Should contain <title> tag')
  assert.strictEqual(title.textContent, 'Hello World', 'Title should have correct text')

  const meta = document.querySelector('meta[name="description"]')
  assert.ok(meta, 'Should contain <meta> tag')
  assert.strictEqual(meta.getAttribute('content'), 'Test description')

  // 2. Check if nested component inside no-hydration is also stripped
  const headNestedContent = document.head.querySelector('.nested')
  assert.ok(headNestedContent, 'Should contain nested content in head')
  assert.strictEqual(headNestedContent.parentElement.tagName, 'HEAD', 'Nested content should be direct child of head (stripped)')

  // The one in the body should NOT be stripped
  const bodyNestedComp = document.body.querySelector('nested-comp')
  assert.ok(bodyNestedComp, 'Should contain <nested-comp> tag from body')
  assert.ok(bodyNestedComp.hasAttribute('data-cid'), 'Body nested-comp should have a data-cid')

  // 3. Check for hydration data
  const hydrationTag = document.getElementById('__CORALITE_HYDRATION__')
  if (hydrationTag) {
    const hydrationData = JSON.parse(hydrationTag.textContent)
    const bodyNestedCid = bodyNestedComp.getAttribute('data-cid')

    // coralite-meta should not have hydration data because it's no-hydration
    const cids = Object.keys(hydrationData)
    assert.ok(!cids.some(cid => cid.startsWith('coralite-meta')), 'coralite-meta should not have hydration data')
  }

  // Clean up
  await rm(tmpDir, {
    recursive: true,
    force: true
  })
})
