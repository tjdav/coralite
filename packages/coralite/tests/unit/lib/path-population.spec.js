import { describe, it, beforeEach, afterEach } from 'node:test'
import { strict as assert } from 'node:assert'
import { definePlugin } from '#lib'
import { createTestProject } from '../utils/project.js'

describe('Path Population during Base Evaluation', () => {
  let project

  beforeEach(async () => {
    project = await createTestProject()
  })

  afterEach(async () => {
    await project.cleanup()
  })

  it('should have populated page path values during base evaluation', async () => {
    let capturedPageDuringPluginContext = null
    let capturedPageDuringComponentServer = null

    const capturePlugin = definePlugin({
      name: 'capture',
      server: {
        context: () => (instanceContext) => {
          if (instanceContext.id.startsWith('base-')) {
            capturedPageDuringPluginContext = JSON.parse(JSON.stringify(instanceContext.page))
          }
          return {
            savePage: (page) => {
              if (instanceContext.id.startsWith('base-')) {
                capturedPageDuringComponentServer = JSON.parse(JSON.stringify(page))
              }
            }
          }
        }
      }
    })

    await project.writeComponent('test-component.html', `
<template id="test-component"><div></div></template>
<script type="module">
  import { defineComponent } from 'coralite'
  export default defineComponent({
    server: async ({ page, capture }) => {
      capture.savePage(page);
      return {};
    }
  });
</script>
`)

    await project.writePage('index.html', '<test-component></test-component>')

    await project.createCoralite({
      plugins: [capturePlugin],
      mode: 'development'
    })

    // During createCoralite, components are discovered and registerBaseComponent is called

    // Capture mechanism 1: plugin context hook sees the page during base evaluation
    assert.ok(capturedPageDuringPluginContext, 'Plugin context should have been called during base evaluation')
    assert.notStrictEqual(capturedPageDuringPluginContext.file.pathname, '', 'page.file.pathname should not be empty in plugin context')
    assert.ok(capturedPageDuringPluginContext.file.pathname.includes('test-component.html'), `pathname should contain component name, got: ${capturedPageDuringPluginContext.file.pathname}`)

    // Capture mechanism 2: component server receives the populated page via plugin context
    assert.ok(capturedPageDuringComponentServer, 'Component server should have been called and captured page')
    assert.notStrictEqual(capturedPageDuringComponentServer.file.pathname, '', 'page.file.pathname should not be empty in component server')
    assert.ok(capturedPageDuringComponentServer.file.pathname.includes('test-component.html'), `pathname should contain component name, got: ${capturedPageDuringComponentServer.file.pathname}`)
  })
})
