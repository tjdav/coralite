import { describe, it, beforeEach, afterEach } from 'node:test'
import { strict as assert } from 'node:assert'
import { definePlugin } from '#lib'
import { createTestProject } from '../utils/project.js'

describe('Symmetrical API Integration', () => {
  let project

  beforeEach(async () => {
    project = await createTestProject()
  })

  afterEach(async () => {
    await project.cleanup()
  })

  it('should support symmetrical access to plugin context in server and client', async () => {
    const i18nPlugin = definePlugin({
      name: 'i18n',
      server: {
        context: () => {
          return () => ({
            t: (key) => (key === 'greeting' ? 'Greetings from Server' : key)
          })
        }
      },
      client: {
        context: () => {
          return () => ({
            t: (key) => (key === 'greeting' ? 'Hello from Client' : key)
          })
        }
      }
    })

    await project.writeComponent('greeting-banner.html', `
<template id="greeting-banner">
  <div class="banner">
    <h2 ref="heading">{{ headingText }}</h2>
  </div>
</template>

<script type="module">
  import { defineComponent } from 'coralite'

  export default defineComponent({
    server: async (context) => {
      const { t } = context.i18n;
      return {
        headingText: t('greeting')
      };
    },

    client: (context) => {
      const { t } = context.i18n;
      const heading = context.refs('heading');
      heading.innerText = t('greeting');
    }
  });
</script>
`)

    await project.writePage('index.html', '<greeting-banner></greeting-banner>')

    const coralite = await project.createCoralite({
      plugins: [i18nPlugin],
      mode: 'development'
    })

    const results = await coralite.build()
    const html = results[0].content

    // Verify SSR output
    assert.ok(html.includes('Greetings from Server'), 'Should include server-side translation')

    // Verify Client-side bundle
    const outputFiles = coralite.outputFiles
    const bannerChunk = Object.values(outputFiles).find(f => f.path.includes('greeting-banner'))
    assert.ok(bannerChunk, 'Component chunk file not found')

    // Check if any chunk contains the client-side translation string
    const allScripts = Object.values(outputFiles).map(f => f.text).join('\n')
    assert.ok(allScripts.includes('Hello from Client'), 'Should include client-side translation logic in bundle')

    // Server-side greeting should NOT be in any client chunk
    assert.ok(!allScripts.includes('Greetings from Server'), 'Should NOT include server-side translation string in client bundle')

    // The component script logic should reference i18n.
    // Since esbuild might split it into a chunk, we search all chunks.
    assert.ok(allScripts.includes('i18n'), 'Should reference i18n context in client bundle')
  })
})
