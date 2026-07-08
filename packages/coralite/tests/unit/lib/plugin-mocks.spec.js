
import { describe, it, beforeEach, afterEach } from 'node:test'
import { strict as assert } from 'node:assert'
import { createTestProject } from '../utils/project.js'

describe('Plugin Mocking System', () => {
  let project

  beforeEach(async () => {
    project = await createTestProject()
  })

  afterEach(async () => {
    await project.cleanup()
  })

  it('should shallow merge server-side plugin context mocks', async () => {
    const plugin = {
      name: 'test-plugin',
      server: {
        context: () => {
          return () => ({
            realMethod: () => 'real',
            methodToMock: () => 'real'
          })
        }
      }
    }

    await project.writePage('test-plugin.html', '<mock-test></mock-test>')
    await project.writeComponent('mock-test.html', `
      <template id="mock-test">
        <div><span id="real">{{ realResult }}</span>|<span id="mocked">{{ mockedResult }}</span></div>
      </template>
      <script type="module">
        import { defineComponent } from 'coralite';
        export default defineComponent({
          async server({ 'test-plugin': plugin }) {
            return {
              realResult: plugin.realMethod(),
              mockedResult: plugin.methodToMock()
            }
          }
        })
      </script>
    `)

    const coralite = await project.createCoralite({
      mode: 'testing',
      plugins: [plugin],
      testing: {
        mocks: {
          plugins: {
            'test-plugin': {
              server: {
                context: {
                  methodToMock: () => 'mocked'
                }
              }
            }
          }
        }
      }
    })

    const results = await coralite.build('test-plugin.html')
    const html = results[0].content
    assert.ok(html.includes('real'), `Content should include "real". Got: ${html}`)
    assert.ok(html.includes('mocked'), `Content should include "mocked". Got: ${html}`)
  })

  it('should ignore plugin mocks when a component mock takes precedence', async () => {
    const plugin = {
      name: 'test-plugin',
      server: {
        context: () => {
          return () => ({
            method: () => 'real'
          })
        }
      }
    }

    await project.writePage('precedence.html', '<prec-test></prec-test>')
    await project.writeComponent('prec-test.html', `
      <template id="prec-test">
        <div>{{ result }}</div>
      </template>
      <script type="module">
        import { defineComponent } from 'coralite';
        export default defineComponent({
          async server({ 'test-plugin': plugin }) {
            return { result: plugin.method() }
          }
        })
      </script>
    `)

    const coralite = await project.createCoralite({
      mode: 'testing',
      plugins: [plugin],
      testing: {
        mocks: {
          components: {
            'prec-test': {
              server: async () => ({ result: 'component-mocked' })
            }
          },
          plugins: {
            'test-plugin': {
              server: {
                context: {
                  method: () => 'plugin-mocked'
                }
              }
            }
          }
        }
      }
    })

    const results = await coralite.build('precedence.html')
    assert.ok(results[0].content.includes('component-mocked'))
    assert.ok(!results[0].content.includes('plugin-mocked'))
  })

  it('should apply client-side plugin context mocks', async () => {
    const plugin = {
      name: 'client-plugin',
      client: {
        context: () => {
          return () => ({
            method: () => 'real-client'
          })
        }
      }
    }

    await project.writePage('client-mock.html', '<client-test></client-test>')
    await project.writeComponent('client-test.html', `
      <template id="client-test">
        <div>Client Test</div>
      </template>
    `)

    const coralite = await project.createCoralite({
      mode: 'testing',
      plugins: [plugin],
      testing: {
        mocks: {
          plugins: {
            'client-plugin': {
              client: {
                context: {
                  method: () => 'mocked-client'
                }
              }
            }
          }
        }
      },
      output: project.outputDir
    })

    await coralite.build('client-mock.html')
    // We check the generated runtime script for the mock
    const runtime = Object.values(coralite.outputFiles).find(f => f.hashedPath.includes('coralite-runtime'))
    assert.ok(runtime, 'Should find runtime bundle')
    assert.ok(runtime.text.includes('mocked-client'), 'Runtime should contain the mocked client method')
  })
})
