import { describe, it, beforeEach, afterEach } from 'node:test'
import { strict as assert } from 'node:assert'
import { createCoralite, definePlugin } from '#lib'
import { createTestProject } from '../utils/project.js'

describe('Plugin Exports Leakage', () => {
  let project

  beforeEach(async () => {
    project = await createTestProject()
  })

  afterEach(async () => {
    await project.cleanup()
  })

  it('should not leak plugin exports into component state', async () => {
    const myPlugin = definePlugin({
      name: 'my-plugin',
      server: {
        context: () => {
          return {
            myFunc: () => 'secret'
          }
        }
      }
    })

    await project.writePage('index.html', '<test-comp></test-comp>')
    await project.writeComponent('test-comp.html', `
<template id="test-comp">
  <div id="leak">{{ leaked }}</div>
  <div id="secret">{{ importedSecret }}</div>
</template>
<script type="module">
  import { defineComponent } from 'coralite'

  export default defineComponent({
    server (context) {
      return {
        leaked: context.myFunc !== undefined,
        importedSecret: context['my-plugin'].myFunc()
      }
    }
  })
</script>
    `)

    const app = await project.createCoralite({
      plugins: [myPlugin]
    })

    const results = await app.build()
    const indexResult = results.find(r => r.path && r.path.filename === 'index.html')

    assert.ok(indexResult, 'index.html should be in results')

    const content = indexResult.content || ''

    // Check if leaked is false (we want it to be false)
    assert.ok(content.includes('false'), 'Plugin exports SHOULD NOT be leaked into state')
    assert.ok(content.includes('secret'), 'Imported secret should be present')
  })

  it('should fail to import plugin via virtual module', async () => {
    const myPlugin = definePlugin({
      name: 'my-plugin',
      server: {
        context: () => {
          return {
            myFunc: () => 'secret'
          }
        }
      }
    })

    const app = await project.createCoralite({
      plugins: [myPlugin]
    })

    const failingComponent = `
<template id="failing-comp"><div></div></template>
<script type="module">
  import { defineComponent } from 'coralite'
  import * as myPlugin from 'my-plugin'
  export default defineComponent({
    server() { return {} }
  })
</script>`

    const failingPage = '<failing-comp></failing-comp>'

    const compPath = await project.writeComponent('failing-comp.html', failingComponent)
    await app.components.setItem(compPath)

    const pagePath = await project.writePage('failing-page.html', failingPage)
    await app.pages.setItem(pagePath)

    try {
      await app.build()
      assert.fail('Should have failed to build due to missing virtual module')
    } catch (error) {
      const msg = error.message
      const isResolutionError = msg.includes('Cannot find module') ||
                               msg.includes('failed to resolve') ||
                               msg.includes('Module not found') ||
                               msg.includes('is not defined') ||
                               msg.includes('Cannot find package') ||
                               msg.includes('ERR_MODULE_NOT_FOUND')

      assert.ok(isResolutionError, 'Error should be about module resolution, got: ' + msg)
    }
  })

  it('should throw an error if two plugins have conflicting export names', async () => {
    const plugin1 = definePlugin({
      name: 'plugin1',
      server: {
        name: 'conflict',
        context: () => {
          return { conflict: () => 'p1' }
        }
      }
    })

    const plugin2 = definePlugin({
      name: 'plugin2',
      server: {
        name: 'conflict',
        context: () => {
          return { conflict: () => 'p2' }
        }
      }
    })

    try {
      await createCoralite({
        components: project.componentsDir,
        pages: project.pagesDir,
        plugins: [plugin1, plugin2]
      })
      assert.fail('Should have thrown an error due to conflicting export names')
    } catch (error) {
      assert.ok(error.message.includes('Plugin export name conflict'), 'Error message should mention conflict')
      assert.ok(error.message.includes('conflict'), 'Error message should mention the conflicting name')
      assert.ok(error.message.includes('plugin2'), 'Error message should mention the conflicting plugin')
    }
  })
})
