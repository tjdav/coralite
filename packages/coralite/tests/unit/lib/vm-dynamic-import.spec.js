import { describe, it, beforeEach, afterEach } from 'node:test'
import { strict as assert } from 'node:assert'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createCoralite } from '#lib'
import { createTestProject } from '../utils/project.js'

describe('VM Dynamic Import', () => {
  let project
  let coralite

  beforeEach(async () => {
    project = await createTestProject()

    // Create a page that uses a component
    await project.writePage('index.html', `
      <my-component></my-component>
    `)
  })

  afterEach(async () => {
    if (coralite) {
      await coralite.clearCache(true)
    }
    await project.cleanup()
  })

  it('should handle direct dynamic import in component script', async () => {
    await project.writeComponent('my-component.html', `
      <template id="my-component">
        <div>{{ message }}</div>
      </template>
      <script type="module">
        import { defineComponent } from 'coralite'

        export default defineComponent({
          getters: {
            message: async () => {
              const fs = await import('node:fs')
              return typeof fs.readFileSync === 'function' ? 'Success' : 'Failure'
            }
          }
        })
      </script>
    `)

    coralite = await createCoralite({
      pages: project.pagesDir,
      components: project.componentsDir,
      mode: 'development'
    })

    const results = await coralite.build()
    assert.ok(results.length > 0)
    assert.match(results[0].content, /Success/)
  })

  it('should handle dynamic import within an external package', async () => {
    // Create a dummy package
    const pkgDir = join(project.testDir, 'node_modules', 'dummy-pkg')
    await mkdir(pkgDir, { recursive: true })
    await writeFile(join(pkgDir, 'package.json'), JSON.stringify({
      name: 'dummy-pkg',
      type: 'module',
      main: 'index.js'
    }))
    await writeFile(join(pkgDir, 'index.js'), `
      export async function loadFs() {
        const fs = await import('node:fs');
        return typeof fs.readFileSync === 'function' ? 'Success' : 'Failure';
      }
    `)

    await project.writeComponent('my-component.html', `
      <template id="my-component">
        <div>{{ message }}</div>
      </template>
      <script type="module">
        import { defineComponent } from 'coralite'
        import { loadFs } from 'dummy-pkg'

        export default defineComponent({
          getters: {
            message: async () => {
              return await loadFs()
            }
          }
        })
      </script>
    `)

    coralite = await createCoralite({
      pages: project.pagesDir,
      components: project.componentsDir,
      mode: 'development'
    })

    const results = await coralite.build()
    assert.ok(results.length > 0)
    assert.match(results[0].content, /Success/)
  })
})
