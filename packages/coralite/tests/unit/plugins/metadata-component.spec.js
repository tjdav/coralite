import test from 'node:test'
import assert from 'node:assert'
import { createTestProject } from '../utils/project.js'

test('metadata plugin extracts metadata from components in head', async () => {
  const project = await createTestProject()

  await project.writeComponent('coralite-meta.html', `
<template id="coralite-meta">
  <meta name="pageTitle" content="{{ title }}">
  <meta name="pageDescription" content="{{ description }}">
  <title>{{ title }} | Coralite</title>
</template>
<script type="module">
  import { defineComponent } from 'coralite'
  export default defineComponent({
    attributes: {
      title: { type: String, default: 'Default Title' },
      description: { type: String, default: '' }
    },
    async server(context) {
      return {
        title: context.state.title,
        description: context.state.description
      }
    }
  })
</script>
  `)

  await project.writePage('index.html', `
<!DOCTYPE html>
<html>
<head>
  <coralite-meta title="Hello World" description="This is a test page"></coralite-meta>
  <meta name="author" content="Thomas David">
</head>
<body>
  <h1>Test</h1>
</body>
</html>
  `)

  const app = await project.createCoralite()
  const page = app.pages.getItem('index.html')

  assert.ok(page, 'Page should be in collection')
  assert.ok(page.result, 'Page should have a result')
  assert.ok(page.result.page, 'Page result should have a page object')
  assert.ok(page.result.page.meta, 'Page result page should have a meta object')

  // These should be extracted by the metadata plugin
  assert.strictEqual(page.result.page.meta.pageTitle, 'Hello World', 'pageTitle should be extracted from component')
  assert.strictEqual(page.result.page.meta.pageDescription, 'This is a test page', 'pageDescription should be extracted from component')
  assert.strictEqual(page.result.page.meta.title, 'Hello World | Coralite', 'title should be extracted from title tag in component')
  assert.strictEqual(page.result.page.meta.author, 'Thomas David', 'Direct meta tags should still be extracted')

  await project.cleanup()
})
