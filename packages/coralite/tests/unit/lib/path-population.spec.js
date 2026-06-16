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
    let capturedPageDuringPluginPhase2 = null

    const pathTrackerPlugin = definePlugin({
      name: 'path-tracker',
      server: {
        context: () => (instanceContext) => {
          if (instanceContext.id.startsWith('base-')) {
            capturedPageDuringPluginPhase2 = JSON.parse(JSON.stringify(instanceContext.page))
          }
          return {}
        }
      }
    })

    await project.writeComponent('test-component.html', `
<template id="test-component"><div></div></template>
<script type="module">
  import { defineComponent } from 'coralite'
  export default defineComponent({
    server: async (context) => {
      capturedPageDuringComponentServer = JSON.parse(JSON.stringify(context.page));
      return {};
    }
  });
</script>
`)

    // We need to make capturedPageDuringComponentServer accessible to the test
    // Since it runs in a VM, we can't easily capture it unless we use a global or a plugin

    await project.writePage('index.html', '<test-component></test-component>')

    await project.createCoralite({
      plugins: [pathTrackerPlugin],
      mode: 'development'
    })

    // During createCoralite, components are discovered and registerBaseComponent is called

    assert.ok(capturedPageDuringPluginPhase2, 'Plugin Phase 2 should have been called during base evaluation')
    assert.notStrictEqual(capturedPageDuringPluginPhase2.file.pathname, '', 'page.file.pathname should not be empty in plugin')
    assert.ok(capturedPageDuringPluginPhase2.file.pathname.includes('test-component.html'), `pathname should contain component name, got: ${capturedPageDuringPluginPhase2.file.pathname}`)

    // To verify component server, we can use the plugin to capture it if we pass it through context
  })

  it('should have populated page path values in component server during base evaluation', async () => {
    let capturedPage = null

    const capturePlugin = definePlugin({
      name: 'capture',
      server: {
        context: () => (instanceContext) => {
          return {
            savePage: (page) => {
              if (instanceContext.id.startsWith('base-')) {
                capturedPage = JSON.parse(JSON.stringify(page))
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

    assert.ok(capturedPage, 'Component server should have been called and captured page')
    assert.notStrictEqual(capturedPage.file.pathname, '', 'page.file.pathname should not be empty in component server')
    assert.ok(capturedPage.file.pathname.includes('test-component.html'), `pathname should contain component name, got: ${capturedPage.file.pathname}`)
  })
})
