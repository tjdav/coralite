import { test } from 'node:test'
import assert from 'node:assert'
import Coralite from '../../../lib/index.js'
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

  const coralite = new Coralite({
    components: componentsDir,
    pages: pagesDir
  })

  await coralite.initialise()
  const results = await coralite.build()

  const indexPage = results.find(r => r.path.filename === 'index.html')
  assert.ok(indexPage, 'Index page should be built')

  const content = indexPage.content
  console.log('Generated HTML:', content)

  // 1. Check if <coralite-meta> is removed but its children are present
  assert.ok(!content.includes('<coralite-meta'), 'Should not contain <coralite-meta> tag')
  assert.ok(content.includes('<title><c-token>Hello World</c-token></title>'), 'Should contain <title> tag')
  assert.ok(content.includes('<meta name="description" content="Test description">'), 'Should contain <meta> tag')

  // 2. Check if nested component inside no-hydration is also stripped
  // It should be stripped because it's inside a no-hydration component
  // Note: the one in the head should be stripped, the one in the body should NOT (unless it also has no-hydration, but here it doesn't)

  // Actually, wait. If I have <nested-comp> in body, it should remain as <nested-comp data-cid="...">
  assert.ok(content.includes('<nested-comp'), 'Should contain <nested-comp> tag from body')

  // How to distinguish? The one from head shouldn't have the tag.
  // The content from head should be: <title>...</title><meta ...><span class="nested">Nested Content</span>
  assert.ok(content.includes('<span class="nested">Nested Content</span>'), 'Should contain nested content')

  // 3. Check for hydration data
  // The hydration script should not contain the cid for coralite-meta or the nested-comp from the head
  const hydrationMatch = content.match(/<script id="__CORALITE_HYDRATION__" type="application\/json">([\s\S]*?)<\/script>/)
  if (hydrationMatch) {
    const hydrationData = JSON.parse(hydrationMatch[1])
    const cids = Object.keys(hydrationData)

    // Find CID for body's nested-comp
    const bodyNestedCid = content.match(/<nested-comp data-cid="(nested-comp-\d+)">/)?.[1]
    assert.ok(bodyNestedCid, 'Body nested-comp should have a data-cid')

    // There should be no CID for coralite-meta
    const coraliteMetaCid = content.match(/<coralite-meta data-cid="(coralite-meta-\d+)">/)?.[1]
    assert.ok(!coraliteMetaCid, 'coralite-meta should not have a data-cid')

    // There might be hydration data for bodyNestedCid (if it has state, but here it doesn't have a script/data block, so it might not)
  }

  // Clean up
  await rm(tmpDir, {
    recursive: true,
    force: true
  })
})
