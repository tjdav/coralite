import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { ScriptManager } from '../../../lib/script-manager.js'

describe('Bundling Leak Prevention', () => {
  it('should not include server-side utilities in the client bundle', async () => {
    const sm = new ScriptManager()

    // Register a simple component
    sm.registerComponent({
      id: 'test-component',
      script: {
        content: '({ state }) => { console.log(state.message); }'
      },
      templateAST: [{
        type: 'tag',
        name: 'div',
        children: [],
        attribs: {}
      }],
      templateValues: {
        attributes: [],
        textNodes: [],
        refs: []
      },
      defaultValues: { message: 'hello' }
    })

    const instances = {
      'inst-1': {
        componentId: 'test-component',
        instanceId: 'inst-1',
        state: { message: 'hello' }
      }
    }

    const result = await sm.compileAllInstances(instances, 'production')

    // Check all output files for forbidden server-side strings
    const forbidden = [
      'acorn',
      'acorn-walk',
      'dom-serializer',
      'htmlparser2',
      'isomorphic-dompurify',
      'postcss',
      'postcss-selector-parser',
      'xxhash-wasm',
      'node:fs',
      'node:path',
      'node:vm',
      'node:crypto',
      'node:os'
    ]

    for (const [filename, file] of Object.entries(result.outputFiles)) {
      const content = file.text
      for (const pattern of forbidden) {
        // We use a regex to ensure we don't match substrings that might be legitimate
        // like a variable name 'myacorn' (though unlikely).
        // But for these packages, even their name appearing as a string in the bundle might be a sign of leakage.
        if (content.includes(pattern)) {
          // Double check if it's just a comment or something harmless
          // Actually, in production mode, there should be no comments.
          assert.fail(`Forbidden string "${pattern}" found in bundle file ${filename}`)
        }
      }
    }
  })
})
