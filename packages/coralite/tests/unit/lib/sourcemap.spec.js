
import { describe, test } from 'node:test'
import assert from 'node:assert'
import { Coralite } from '#lib'
import { join } from 'node:path'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'

describe('Source Map Generation', () => {

  test('defineComponent script sourcemap', async () => {
    const tmpDir = await mkdir(join(tmpdir(), 'coralite-sourcemap-test-' + Date.now()), { recursive: true })
    const templatesDir = join(tmpDir, 'templates')
    const pagesDir = join(tmpDir, 'pages')

    await mkdir(templatesDir, { recursive: true })
    await mkdir(pagesDir, { recursive: true })

    // Create a component with a script at a specific line
    const componentScriptContent = `(context) {

    console.log('Hello from my-component')
  }`
    const componentContent = `
<template id="my-component">
  <button>Click me</button>
</template>

<script type="module">
import { defineComponent } from 'coralite/plugins'

export default defineComponent({
  script${componentScriptContent}
})
</script>
`
    await writeFile(join(templatesDir, 'my-component.html'), componentContent)

    // Create a page using the component
    const pageContent = `
<my-component></my-component>
`
    await writeFile(join(pagesDir, 'index.html'), pageContent)

    const coralite = new Coralite({
      templates: templatesDir,
      pages: pagesDir
    })

    await coralite.initialise()
    const results = await coralite.build()

    assert.strictEqual(results.length, 1)
    const html = results[0].html

    // Extract the script content
    const scriptMatch = html.match(/<script type="module">([\s\S]*?)<\/script>/)
    assert.ok(scriptMatch, 'Script tag not found')
    const scriptContent = scriptMatch[1]

    // Find source map
    const sourceMapMatch = scriptContent.match(/\/\/# sourceMappingURL=data:application\/json;base64,(.+)/)
    assert.ok(sourceMapMatch, 'Source map not found')

    const sourceMapJson = Buffer.from(sourceMapMatch[1], 'base64').toString('utf-8')
    const sourceMap = JSON.parse(sourceMapJson)

    // Verify sources
    // The source path should be the file URL or path to my-component.html
    const hasSource = sourceMap.sources.some(s => s.includes('my-component.html'))
    assert.ok(hasSource, 'Source map does not contain my-component.html')

    // Verify script was normalised
    const hasNormalisedScript = sourceMap.sourcesContent[0].includes('export default function script' + componentScriptContent)
    assert.ok(hasNormalisedScript, 'Source map does not contain my-component.html')

    // Cleanup
    await rm(tmpDir, {
      recursive: true,
      force: true
    })
  })
})
