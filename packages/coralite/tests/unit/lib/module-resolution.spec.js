import { describe, it, beforeEach, afterEach } from 'node:test'
import { strict as assert } from 'node:assert'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createTestProject } from '../utils/project.js'

describe('Module Resolution', () => {
  let project

  beforeEach(async () => {
    project = await createTestProject()

    const nodeModulesDir = join(project.testDir, 'node_modules')
    const pkgDir = join(nodeModulesDir, 'dummy-pkg')

    await mkdir(pkgDir, { recursive: true })

    // Create a dummy package in node_modules
    await writeFile(join(pkgDir, 'package.json'), JSON.stringify({
      name: 'dummy-pkg',
      version: '1.0.0',
      main: 'index.js',
      type: 'module'
    }))
    await writeFile(join(pkgDir, 'index.js'), 'export default "Hello from Dummy Package"')

    // Create a page that uses a component
    await project.writePage('index.html', `
      <my-component></my-component>
    `)

    // Create a component that imports the dummy package
    // This is the crucial part: it imports 'dummy-pkg' which is in the project's node_modules
    await project.writeComponent('my-component.html', `
      <template id="my-component">
        <div>{{ message }}</div>
      </template>
      <script type="module">
        import { defineComponent } from 'coralite'
        import dummy from 'dummy-pkg'

        export default defineComponent({
          getters: {
            message: () => dummy
          }
        })
      </script>
    `)
  })

  afterEach(async () => {
    await project.cleanup()
  })

  it('should resolve imports from project node_modules in development mode', async () => {
    const coralite = await project.createCoralite({
      mode: 'development'
    })


    // We expect this to fail currently because resolution is relative to coralite lib
    // but pass after the fix
    const results = await coralite.build()

    assert.ok(results.length > 0)
    assert.match(results[0].content, /Hello from Dummy Package/)
  })
})
