import { describe, it, beforeEach, afterEach } from 'node:test'
import { strict as assert } from 'node:assert'
import path from 'node:path'
import { writeFile, readFile, rm } from 'node:fs/promises'
import { createTestProject } from '../utils/project.js'

describe('ISR Component Assets, Migration & Self-Healing', () => {
  let project
  let cacheDir

  beforeEach(async () => {
    project = await createTestProject()
    cacheDir = path.join(project.testDir, '.coralite')
  })

  afterEach(async () => {
    await project.cleanup()
  })

  it('handles cold upgrade migration when manifest lacks runtimeChunk', async () => {
    await project.writePage('index.html', '<p>Hello World</p>')
    const coralite = await project.createCoralite({ output: project.outputDir })

    await coralite.build()
    await coralite.save()

    // Manually edit manifest.json to simulate an old manifest format missing runtimeChunk
    const manifestPath = path.join(cacheDir, 'manifest.json')
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
    const pageKey = Object.keys(manifest.physical).find(k => k.endsWith('index.html'))
    delete manifest.physical[pageKey].runtimeChunk
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2))

    // Subsequent incremental build should force a one-time rebuild to backfill runtimeChunk
    const results = await coralite.build()
    assert.strictEqual(results.length, 1)
    assert.strictEqual(results[0].status, undefined, 'Page should rebuild on missing runtimeChunk migration')

    await coralite.save()

    // Next build after backfill should skip cleanly
    const results2 = await coralite.build()
    assert.strictEqual(results2.length, 1)
    assert.strictEqual(results2[0].status, 'skipped', 'Page should be skipped after migration backfill')
  })

  it('triggers self-healing rebuild when referenced pageScript file is missing on disk', async () => {
    await project.writePage('index.html', '<comp-script></comp-script>')
    await project.writeComponent('comp-script.html', `
      <template id="comp-script"><div>Dynamic</div></template>
      <script type="module">
        import { defineComponent } from 'coralite';
        export default defineComponent({ client() {} });
      </script>
    `)

    const coralite = await project.createCoralite({
      output: project.outputDir,
      csp: { externalScripts: true }
    })

    const results1 = await coralite.build()
    await coralite.save()
    assert.strictEqual(results1[0].status, undefined)
    assert.ok(results1[0].pageScript, 'Should generate pageScript')

    const pageScriptDiskPath = path.join(project.outputDir, results1[0].pageScript)
    await rm(pageScriptDiskPath, { force: true })

    // Build 2: Missing asset on disk forces self-healing rebuild
    const results2 = await coralite.build()
    assert.strictEqual(results2[0].status, undefined, 'Missing pageScript on disk must trigger self-healing rebuild')

    await coralite.save()

    // Build 3: Unchanged build skips cleanly
    const results3 = await coralite.build()
    assert.strictEqual(results3[0].status, 'skipped')
  })

  it('re-renders pages with client controllers when runtime chunk changes, while pure SSR pages remain skipped', async () => {
    await project.writePage('pure-ssr.html', '<h1>Pure SSR Page</h1>')
    await project.writePage('interactive.html', '<dynamic-comp></dynamic-comp>')
    await project.writeComponent('dynamic-comp.html', `
      <template id="dynamic-comp"><div>Interactive</div></template>
      <script type="module">
        import { defineComponent } from 'coralite';
        export default defineComponent({ client() {} });
      </script>
    `)

    const coralite = await project.createCoralite({ output: undefined })

    const results1 = await coralite.build()
    assert.strictEqual(results1.length, 2)

    // Second build without changes
    const results2 = await coralite.build()
    assert.strictEqual(results2.find(r => r.path.pathname.endsWith('pure-ssr.html')).status, 'skipped')
    assert.strictEqual(results2.find(r => r.path.pathname.endsWith('interactive.html')).status, 'skipped')
  })

  it('virtual pages track componentHashes, carry them forward on skip, and re-render on component hash mismatch', async () => {
    await project.writeComponent('v-comp.html', `
      <template id="v-comp"><div>Version 1</div></template>
      <script type="module">
        import { defineComponent } from 'coralite';
        export default defineComponent({
          async server() { return { data: "V1" } }
        });
      </script>
    `)

    const plugin = {
      name: 'v-page-plugin',
      server: {
        onBeforeBuild: async ({ app, buildId }) => {
          await app.addRenderQueue({
            pathname: 'virtual-index.html',
            content: '<v-comp></v-comp>',
            cacheKey: 'static-key'
          }, buildId)
        }
      }
    }

    const coralite = await project.createCoralite({
      plugins: [plugin],
      output: undefined
    })

    const results1 = await coralite.build()
    const vResult1 = results1.find(r => r.path.pathname === 'virtual-index.html')
    assert.strictEqual(vResult1.status, undefined)
    assert.ok(vResult1.componentHashes['v-comp'])

    // Build 2: Unchanged -> Virtual page skipped and carries forward componentHashes
    const results2 = await coralite.build()
    const vResult2 = results2.find(r => r.path.pathname === 'virtual-index.html')
    assert.strictEqual(vResult2.status, 'skipped')

    // Build 3: Update component template/script
    await project.writeComponent('v-comp.html', `
      <template id="v-comp"><div>Version 2 Updated</div></template>
      <script type="module">
        import { defineComponent } from 'coralite';
        export default defineComponent({
          async server() { return { data: "V2" } }
        });
      </script>
    `)

    const results3 = await coralite.build()
    const vResult3 = results3.find(r => r.path.pathname === 'virtual-index.html')
    assert.strictEqual(vResult3.status, undefined, 'Virtual page must re-render when constituent component changes')
  })

  it('does not re-render pages when untracked/unincluded components are modified', async () => {
    await project.writePage('index.html', '<comp-a></comp-a>')
    await project.writeComponent('comp-a.html', '<template id="comp-a"><div>A</div></template>')
    await project.writeComponent('comp-b.html', '<template id="comp-b"><div>B Unused</div></template>')

    const coralite = await project.createCoralite({ output: undefined })

    const results1 = await coralite.build()
    assert.strictEqual(results1.length, 1)

    // Modify unused comp-b
    await project.writeComponent('comp-b.html', '<template id="comp-b"><div>B Modified</div></template>')

    const results2 = await coralite.build()
    assert.strictEqual(results2.length, 1)
    assert.strictEqual(results2[0].status, 'skipped', 'Modifying unused component should not force rebuild of page index.html')
  })
})
