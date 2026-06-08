import { describe, it, beforeEach, afterEach } from 'node:test'
import { strict as assert } from 'node:assert'
import { mkdir, writeFile, rm, mkdtemp } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createCoralite } from '#lib'

describe('VM Dynamic Import', () => {
  let testDir
  let pagesDir
  let componentDir

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'coralite-vm-dynamic-'))
    pagesDir = join(testDir, 'pages')
    componentDir = join(testDir, 'components')

    await mkdir(pagesDir, { recursive: true })
    await mkdir(componentDir, { recursive: true })

    // Create a page that uses a component
    await writeFile(join(pagesDir, 'index.html'), `
      <my-component></my-component>
    `)
  })

  afterEach(async () => {
    await rm(testDir, {
      recursive: true,
      force: true
    })
  })

  it('should handle direct dynamic import in component script', async () => {
    await writeFile(join(componentDir, 'my-component.html'), `
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

    const coralite = await createCoralite({
      pages: pagesDir,
      components: componentDir,
      mode: 'development'
    })

    const results = await coralite.build()
    assert.ok(results.length > 0)
    assert.match(results[0].content, /Success/)
  })

  it('should handle dynamic import within an external package', async () => {
    // Create a dummy package
    const pkgDir = join(testDir, 'node_modules', 'dummy-pkg')
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

    await writeFile(join(componentDir, 'my-component.html'), `
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

    const coralite = await createCoralite({
      pages: pagesDir,
      components: componentDir,
      mode: 'development'
    })

    const results = await coralite.build()
    assert.ok(results.length > 0)
    assert.match(results[0].content, /Success/)
  })

})
