import { describe, it, afterEach } from 'node:test'
import { strict as assert } from 'node:assert'
// @ts-ignore
import { ScriptManager as OriginalScriptManager } from '../../../coralite/lib/script-manager.js'

const activeManagers = []
class ScriptManager extends OriginalScriptManager {
  constructor (...args) {
    super(...args)
    activeManagers.push(this)
  }
}

describe('Development Incremental Bundling', () => {
  afterEach(async () => {
    for (const sm of activeManagers) {
      await sm.disposeContext()
    }
    activeManagers.length = 0
  })

  it('should include newly added components in the bundle by resetting esbuild context', async () => {
    const sm = new ScriptManager()

    // 1. Register first component
    sm.registerComponent({
      id: 'comp-1',
      script: { content: '() => { console.log("comp-1") }' }
    })

    // 2. Initial compilation in development mode
    const result1 = await sm.compileAllInstances({}, 'development')
    assert.ok(result1.manifest['comp-1'], 'comp-1 should be in initial manifest')
    assert.ok(!result1.manifest['comp-2'], 'comp-2 should NOT be in initial manifest')

    const firstContext = sm.context
    assert.ok(firstContext, 'esbuild context should be created')

    // 3. Register a second component
    sm.registerComponent({
      id: 'comp-2',
      script: { content: '() => { console.log("comp-2") }' }
    })

    // 4. Second compilation in development mode
    const result2 = await sm.compileAllInstances({}, 'development')

    // 5. Verify the context was reset and new component is included
    assert.notStrictEqual(sm.context, firstContext, 'esbuild context should have been reset')
    assert.ok(result2.manifest['comp-1'], 'comp-1 should still be in manifest')
    assert.ok(result2.manifest['comp-2'], 'comp-2 should now be in manifest')

    // 6. Verify output files
    const comp2Entry = result2.manifest['comp-2']
    assert.ok(result2.outputFiles[comp2Entry.js], 'comp-2 JS file should be in outputFiles')
    assert.match(result2.outputFiles[comp2Entry.js].text, /comp-2/, 'comp-2 content should be present')
  })
})
