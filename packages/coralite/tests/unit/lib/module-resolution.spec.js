import { describe, it, beforeEach, afterEach } from 'node:test'
import { strict as assert } from 'node:assert'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import Coralite from '#lib'

describe('Module Resolution', () => {
  let testDir
  let pagesDir
  let templatesDir
  let nodeModulesDir
  let pkgDir
  let coralite

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'coralite-resolution-'))
    pagesDir = join(testDir, 'pages')
    templatesDir = join(testDir, 'templates')
    nodeModulesDir = join(testDir, 'node_modules')
    pkgDir = join(nodeModulesDir, 'dummy-pkg')

    await mkdir(pagesDir, { recursive: true })
    await mkdir(templatesDir, { recursive: true })
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
    await writeFile(join(pagesDir, 'index.html'), `
      <my-component></my-component>
    `)

    // Create a component that imports the dummy package
    // This is the crucial part: it imports 'dummy-pkg' which is in the project's node_modules
    await writeFile(join(templatesDir, 'my-component.html'), `
      <template id="my-component">
        <div>{{ message }}</div>
      </template>
      <script type="module">
        import { defineComponent } from 'coralite'
        import dummy from 'dummy-pkg'

        export default defineComponent({
          client: {
            setup() {
              return {
                message: dummy
              }

            }
          }
        })
      </script>
    `)
  })

  afterEach(async () => {
    await rm(testDir, {
      recursive: true,
      force: true
    })
  })

  async function mkdtemp (prefix) {
    const fs = await import('node:fs/promises')
    return fs.mkdtemp(prefix)
  }

  it('should resolve imports from project node_modules in development mode', async () => {
    coralite = new Coralite({
      pages: pagesDir,
      templates: templatesDir,
      mode: 'development'
    })

    await coralite.initialise()

    // We expect this to fail currently because resolution is relative to coralite lib
    // but pass after the fix
    const results = await coralite.build()

    assert.ok(results.length > 0)
    assert.match(results[0].html, /Hello from Dummy Package/)
  })
})
