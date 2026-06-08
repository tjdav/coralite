import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { createCoralite, definePlugin } from '#lib'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixtureRoot = join(__dirname, '../../fixtures')
const componentsDir = join(fixtureRoot, 'components/plugin-leak')
const pagesDir = join(fixtureRoot, 'pages/plugin-leak')

describe('Plugin Exports Leakage', async () => {
  it('should not leak plugin exports into component state', async () => {
    const myPlugin = definePlugin({
      name: 'my-plugin',
      server: {
        exports: {
          myFunc: () => {
            return () => () => 'secret'
          }
        }
      }
    })

    const app = await createCoralite({
      components: componentsDir,
      pages: pagesDir,
      plugins: [myPlugin]
    })

    const results = await app.build()
    console.log('BUILD RESULTS IS:', results)
    const indexResult = results.find(r => r.path.filename === 'index.html')

    // Check if leaked is false (we want it to be false)
    const hasLeak = indexResult.content.includes('<div id="leak"><c-token>true</c-token></div>')
    assert.strictEqual(hasLeak, false, 'Plugin exports SHOULD NOT be leaked into state')
    assert.ok(indexResult.content.includes('<div id="secret"><c-token>secret</c-token></div>'), 'Imported secret should be present')
  })

  it('should throw an error if two plugins have conflicting export names', async () => {
    const plugin1 = definePlugin({
      name: 'plugin1',
      server: {
        exports: {
          conflict: () => () => 'p1'
        }
      }
    })

    const plugin2 = definePlugin({
      name: 'plugin2',
      server: {
        exports: {
          conflict: () => () => 'p2'
        }
      }
    })

    try {
      await createCoralite({
        components: componentsDir,
        pages: pagesDir,
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
