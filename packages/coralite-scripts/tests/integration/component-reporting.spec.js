import { describe, it, beforeEach, afterEach } from 'node:test'
import { strict as assert } from 'node:assert'
import { createCLIProject } from '../utils/project.js'

describe('Component Reporting Integration', () => {
  let project

  beforeEach(async () => {
    project = await createCLIProject()
  })

  afterEach(async () => {
    await project.cleanup()
  })

  it('should report component build status accurately', async () => {
    await project.writePage('index.html', '<comp-a></comp-a>')
    await project.writeComponent('comp-a.html', `
      <template id="comp-a"><div>A</div></template>
      <script type="module">
        import { defineComponent } from 'coralite';
        export default defineComponent({ client() {} });
      </script>
    `)
    await project.writeComponent('comp-b.html', `
      <template id="comp-b"><div>B</div></template>
      <script type="module">
        import { defineComponent } from 'coralite';
        export default defineComponent({ client() {} });
      </script>
    `)

    // 1. Initial Build
    const build1 = await project.runBuild()
    if (build1.exitCode !== 0) {
      console.log(build1.stdout)
      console.log(build1.stderr)
    }
    assert.strictEqual(build1.exitCode, 0)
    assert.ok(build1.stdout.includes('Components built (2 completed)'), `Initial build should show 2 completed components, but stdout was: ${build1.stdout}`)

    // 2. Incremental Build (no changes)
    const build2 = await project.runBuild()
    assert.strictEqual(build2.exitCode, 0)
    assert.ok(build2.stdout.includes('Components built (0 completed, 2 skipped)'), 'Incremental build with no changes should show 2 skipped components')

    // 3. Modify one component
    await project.writeComponent('comp-a.html', `
      <template id="comp-a"><div>A modified</div></template>
      <script type="module">
        import { defineComponent } from 'coralite';
        export default defineComponent({ client() {} });
      </script>
    `)
    const build3 = await project.runBuild()
    assert.strictEqual(build3.exitCode, 0)
    assert.ok(build3.stdout.includes('Components built (1 completed, 1 skipped)'), 'Incremental build with one change should show 1 completed and 1 skipped')

    // 4. Verbose build
    const build4 = await project.runBuild(['--verbose'])
    assert.strictEqual(build4.exitCode, 0)
    assert.ok(build4.stdout.includes('[-] skipped: comp-a'), 'Verbose output should show skipped component')
    assert.ok(build4.stdout.includes('[-] skipped: comp-b'), 'Verbose output should show skipped component')
  })
})
