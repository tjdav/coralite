import { describe, it, beforeEach, afterEach } from 'node:test'
import { strict as assert } from 'node:assert'
import { definePlugin } from '#lib'
import { createTestProject } from '../utils/project.js'

describe('Plugin Two-Phase Pattern Enforcement', () => {
  let project

  beforeEach(async () => {
    project = await createTestProject()
  })

  afterEach(async () => {
    await project.cleanup()
  })

  it('should throw CoraliteError if server context does not return a function', async () => {
    const invalidPlugin = definePlugin({
      name: 'invalid-plugin',
      server: {
        context: () => {
          return { some: 'object' }
        }
      }
    })

    try {
      await project.createCoralite({
        plugins: [invalidPlugin]
      })
      assert.fail('Should have thrown an error')
    } catch (error) {
      assert.ok(error.message.includes('must return a function for the second phase'), `Error message mismatch: ${error.message}`)
      assert.strictEqual(error.name, 'CoraliteError')
    }
  })

  it('should throw Error if client context does not return a function (during compilation)', async () => {
    const invalidPlugin = definePlugin({
      name: 'invalid-client-plugin',
      client: {
        context: () => {
          return { some: 'object' }
        }
      }
    })

    await project.writeComponent('test-comp.html', `
<template id="test-comp"><div>Test</div></template>
<script type="module">
  import { defineComponent } from 'coralite'
  export default defineComponent({
    client: () => {}
  })
</script>
`)

    await project.writePage('index.html', '<test-comp></test-comp>')

    const coralite = await project.createCoralite({
      plugins: [invalidPlugin],
      mode: 'development'
    })

    try {
      await coralite.build()
      // We need to check if the generated code for runtime contains the error
      const runtimeFile = Object.values(coralite.outputFiles).find(f => f.hashedPath.includes('coralite-runtime'))
      assert.ok(runtimeFile, 'Runtime file should exist')
      assert.ok(runtimeFile.text.includes('must return a function for the second phase'), 'Runtime code should contain error check')
    } catch (error) {
      // If it fails during build (e.g. if we evaluate the runtime in some tests)
      assert.ok(error.message.includes('must return a function for the second phase'), `Error message mismatch: ${error.message}`)
    }
  })
})
