import { describe, it, beforeEach, afterEach } from 'node:test'
import { strict as assert } from 'node:assert'
import path from 'node:path'
import { readFile, access } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createCLIProject } from '../utils/project.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const coraliteScriptsLib = path.resolve(__dirname, '../../libs/config.js')
const libUrl = pathToFileURL(coraliteScriptsLib).href

describe('Incremental Assets Invalidation & Cleanup Whitelisting Integration', () => {
  let project

  beforeEach(async () => {
    project = await createCLIProject()
  })

  afterEach(async () => {
    await project.cleanup()
  })

  it('preserves page scripts and scoped styles on skipped pages across incremental builds', async () => {
    await project.writeConfig(`
      import { defineConfig } from '${libUrl}'
      export default defineConfig({
        output: './dist',
        components: './src/components',
        pages: './src/pages',
        public: './public',
        csp: {
          externalScripts: true,
          externalStyles: true
        }
      })
    `)

    await project.writePage('index.html', '<styled-comp></styled-comp>')
    await project.writeComponent('styled-comp.html', `
      <template id="styled-comp">
        <div class="box">Styled Box</div>
      </template>
      <style>
        .box { color: red; }
      </style>
      <script type="module">
        import { defineComponent } from 'coralite';
        export default defineComponent({
          client() {
            console.log('styled-comp mounted');
          }
        });
      </script>
    `)

    // 1. Initial Build
    const build1 = await project.runBuild(['--verbose'])
    assert.strictEqual(build1.exitCode, 0, 'Initial build failed')

    const manifestPath = path.join(project.testDir, '.coralite', 'manifest.json')
    const manifest1 = JSON.parse(await readFile(manifestPath, 'utf8'))
    const pageKey = Object.keys(manifest1.physical).find(k => k.endsWith('index.html'))
    const pageMeta1 = manifest1.physical[pageKey]

    assert.ok(pageMeta1.pageScript, 'pageScript should be recorded in manifest')
    assert.ok(pageMeta1.pageStyle, 'pageStyle should be recorded in manifest')

    const pageScriptDiskPath = path.join(project.outputDir, pageMeta1.pageScript)
    const pageStyleDiskPath = path.join(project.outputDir, pageMeta1.pageStyle)

    await access(pageScriptDiskPath)
    await access(pageStyleDiskPath)

    // 2. Unchanged Incremental Build
    const build2 = await project.runBuild(['--verbose'])
    assert.strictEqual(build2.exitCode, 0, 'Incremental build failed')
    assert.ok(!build2.stdout.includes('src/pages/index.html'), 'index.html should be skipped on build 2')

    // Verify assets survived cleanupStaleFiles
    await access(pageScriptDiskPath)
    await access(pageStyleDiskPath)

    // 3. Direct component modification
    await project.writeComponent('styled-comp.html', `
      <template id="styled-comp">
        <div class="box">Updated Styled Box</div>
      </template>
      <style>
        .box { color: blue; }
      </style>
      <script type="module">
        import { defineComponent } from 'coralite';
        export default defineComponent({
          client() {
            console.log('styled-comp updated');
          }
        });
      </script>
    `)

    const build3 = await project.runBuild(['--verbose'])
    assert.strictEqual(build3.exitCode, 0, 'Rebuild failed')
    assert.ok(build3.stdout.includes('src/pages/index.html'), 'index.html should rebuild when styled-comp changes')

    const manifest3 = JSON.parse(await readFile(manifestPath, 'utf8'))
    const pageMeta3 = manifest3.physical[pageKey]

    const newPageScriptDiskPath = path.join(project.outputDir, pageMeta3.pageScript)
    const newPageStyleDiskPath = path.join(project.outputDir, pageMeta3.pageStyle)

    await access(newPageScriptDiskPath)
    await access(newPageStyleDiskPath)
  })
})
