import { describe, it, beforeEach, afterEach } from 'node:test'
import { strict as assert } from 'node:assert'
import path from 'node:path'
import { readFile } from 'node:fs/promises'
import { createCLIProject } from '../utils/project.js'

describe('Manifest Decoupling Integration', () => {
  let project

  beforeEach(async () => {
    project = await createCLIProject()
  })

  afterEach(async () => {
    await project.cleanup()
  })

  it('should update the external manifest but skip the page when a deep component changes', async () => {
    // index.html -> parent-comp -> child-comp (DYNAMIC/UNTRACKED)
    await project.writePage('index.html', '<parent-comp></parent-comp>')
    await project.writeComponent('parent-comp.html', `
      <template id="parent-comp">
        <div id="container"></div>
      </template>
      <script type="module">
        import { defineComponent } from 'coralite';
        export default defineComponent({
          client({ root }) {
            const tagName = 'child-comp'; // Dynamic variable breaks tracking
            const el = document.createElement(tagName);
            root.querySelector('#container').appendChild(el);
          }
        });
      </script>
    `)
    await project.writeComponent('child-comp.html', `
      <template id="child-comp">
        <div>Initial Child Content</div>
      </template>
      <script type="module">
        import { defineComponent } from 'coralite';
        export default defineComponent({
          client() {
            console.log('child-comp');
          }
        });
      </script>
    `)

    // 1. Initial Build
    const build1 = await project.runBuild(['--verbose'])
    if (build1.exitCode !== 0) {
      console.error(build1.stdout)
      console.error(build1.stderr)
    }
    assert.strictEqual(build1.exitCode, 0, 'First build failed')
    assert.ok(build1.stdout.includes('index.html'), 'index.html should be built initially')

    const manifestPath = path.join(project.outputDir, 'assets', 'js', 'manifest.js')
    const manifestContent1 = await readFile(manifestPath, 'utf8')
    // child-comp is registered but untracked for index.html
    assert.ok(manifestContent1.includes('child-comp'), 'manifest should include child-comp')

    // Extract hash for child-comp
    const hashRegex = /"child-comp":\s*{\s*"js":\s*"child-comp-([A-Z0-9]+)\.js"/
    const match1 = manifestContent1.match(hashRegex)
    assert.ok(match1, 'Should find child-comp hash in manifest')
    const initialHash = match1[1]

    // 2. Modify deep component
    await project.writeComponent('child-comp.html', `
      <template id="child-comp">
        <div>Updated Child Content</div>
      </template>
      <script type="module">
        import { defineComponent } from 'coralite';
        export default defineComponent({
          client() {
            console.log('child-comp updated');
          }
        });
      </script>
    `)

    // 3. Incremental Build
    const build2 = await project.runBuild(['--verbose'])
    if (build2.exitCode !== 0) {
      console.error(build2.stdout)
      console.error(build2.stderr)
    }
    assert.strictEqual(build2.exitCode, 0, 'Incremental build failed')

    // Assert: Page is skipped (not re-rendered)
    assert.ok(!build2.stdout.includes('index.html'), `index.html should be SKIPPED in incremental build, but stdout was: ${build2.stdout}`)

    // Assert: Manifest is updated with new hash
    const manifestContent2 = await readFile(manifestPath, 'utf8')
    const match2 = manifestContent2.match(hashRegex)
    assert.ok(match2, 'Should find child-comp hash in updated manifest')
    const updatedHash = match2[1]

    assert.notStrictEqual(initialHash, updatedHash, 'Manifest hash should have changed')

    // The index.html refers directly to manifest.js, which is not hashed.
    // This allows page decoupling: updating a component changes the manifest contents but not the filename,
    // so index.html does not need to be re-written just to update the manifest file reference.

    const indexContent = await readFile(path.join(project.outputDir, 'index.html'), 'utf8')
    assert.ok(indexContent.includes('assets/js/manifest.js'), 'index.html should load the external manifest')
    // We expect NO component hashes in the HTML, only the manifest.js will have them.
    // The manifest.js itself is not hashed.
    // Note: coralite-runtime is still hashed and inlined in the script path, but component hashes should be gone.
    const componentHashInHTML = /child-comp-[A-Z0-9]+\.js/.test(indexContent)
    assert.ok(!componentHashInHTML, `index.html should NOT contain component hashes anymore, but found one. Content: ${indexContent}`)
  })

  it('should rebuild the page when a DIRECT component changes', async () => {
    await project.writePage('index.html', '<direct-comp></direct-comp>')
    await project.writeComponent('direct-comp.html', `
      <template id="direct-comp">
        <div>Initial Direct Content</div>
      </template>
      <script type="module">
        import { defineComponent } from 'coralite';
        export default defineComponent({
          client() {
            console.log('direct-comp');
          }
        });
      </script>
    `)

    const build1 = await project.runBuild(['--verbose'])
    if (build1.exitCode !== 0) {
      console.error(build1.stdout)
      console.error(build1.stderr)
    }
    assert.strictEqual(build1.exitCode, 0, 'First build failed')

    // Modify direct component
    await project.writeComponent('direct-comp.html', `
      <template id="direct-comp">
        <div>Updated Direct Content</div>
      </template>
      <script type="module">
        import { defineComponent } from 'coralite';
        export default defineComponent({
          client() {
            console.log('direct-comp updated');
          }
        });
      </script>
    `)

    const build2 = await project.runBuild(['--verbose'])
    if (build2.exitCode !== 0) {
      console.error(build2.stdout)
      console.error(build2.stderr)
    }
    assert.strictEqual(build2.exitCode, 0, 'Incremental build failed')
    assert.ok(build2.stdout.includes('index.html'), 'index.html SHOULD be rebuilt when its direct component changes')

    const indexContent = await readFile(path.join(project.outputDir, 'index.html'), 'utf8')
    assert.ok(indexContent.includes('Updated Direct Content'), 'index.html should have updated content')
  })
})
