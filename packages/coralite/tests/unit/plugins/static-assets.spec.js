import { describe, it } from 'node:test'
import assert from 'node:assert'
import { staticAssetPlugin } from '../../../plugins/static-assets.js'

describe('staticAssetPlugin', () => {
  it('should throw an error if dest is missing', async () => {
    const plugin = staticAssetPlugin([{
      pkg: 'test-pkg',
      path: 'test-path'
    }])

    await assert.rejects(
      async () => {
        await plugin.onBeforeBuild.call({ options: { output: '/dist' } })
      },
      /staticAssetPlugin requires assets to have a dest property\./
    )
  })

  it('should throw an error if src is missing and pkg or path is missing', async () => {
    const plugin = staticAssetPlugin([{
      dest: 'test-dest',
      path: 'test-path'
    }])

    await assert.rejects(
      async () => {
        await plugin.onBeforeBuild.call({ options: { output: '/dist' } })
      },
      /staticAssetPlugin requires assets to have pkg and path properties when src is not provided\./
    )
  })

  // To test the rest without mocking built-in modules which are read-only namespaces,
  // we can use dependency injection or since we can't easily mock, we can rely on integration-style e2e testing,
  // OR use proxyquire/esmock. The codebase might not have esmock. Let's check package.json
})
