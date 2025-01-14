import { strictEqual } from 'node:assert'
import { beforeEach, describe, it } from 'node:test'
import { render } from '../lib/component.js'
import { getComponentFromString, getHTML } from '#lib'

/**
 * @import {HTMLData} from '../lib/get-html.js'
 * @import {CoraliteComponent} from '../lib/component.js'
 */

describe('Component', function () {
  describe('Render', async function () {
    const path = {
      pages: './fixtures/pages',
      components: './fixtures/components'
    }
    /** @type {Object.<string, CoraliteComponent>} */
    const components = {}
    const document = {
      parentPath: 'test',
      name: 'component.spec.js',
      content: ''
    }

    beforeEach(async function () {
      const htmlComponents = await getHTML({ path: path.components })
      for (let i = 0; i < htmlComponents.length; i++) {
        const html = htmlComponents[i]
        const component = getComponentFromString(html.content)
        components[component.id] = component
      }
    })

    it('should process tokens', { skip: true }, async function () {
      const result = await render(components['coralite-title'], {
        values: {
          title: 'Heading'
        },
        path,
        components
      })

      strictEqual(result.trim(), '<h1>Heading</h1>')
    })

    it('should process tokens without values', { skip: true }, async function () {
      const result = await render(components['coralite-title'], {
        values: {},
        path,
        components,
        document
      })

      strictEqual(result.trim(), '<h1></h1>')
    })

    it('should process computed tokens', { skip: true }, async function () {
      const result = await render(components['coralite-author'], {
        values: {
          name: 'Nemo',
          datetime: '2025-01-08T20:23:07.645Z'
        },
        path,
        components
      })

      strictEqual(result, `
  <span>Nemo</span>
  <time datetime="2025-01-08T20:23:07.645Z">
    Wed, 8 Jan 25
  </time>
`)
    })

    it('should process computed tokens without values', { skip: true }, async function () {
      const result = await render(components['coralite-author'], {
        values: {},
        path,
        components,
        document
      })

      strictEqual(result, `
  <span></span>
  <time datetime="">
    Invalid Date
  </time>
`)
    })

    it('should process nested component computed tokens', async function () {
      const result = await render(components['coralite-post'], {
        values: {
          title: 'Hello world',
          author: 'Nemo',
          published_time: '2025-01-08T20:23:07.645Z',
          image: 'nemo.png',
          image_alt: 'Clownfish',
          description: 'Nemo is a clownfish, also known as an anemonefish.'
        },
        path,
        components,
        document
      })
      strictEqual(result, `
  <h2>Hello world</h2>
  
  <span>Nemo</span>
  <time datetime="2025-01-08T20:23:07.645Z">
    Wed, 8 Jan 25
  </time>

  <img src="nemo.png" alt="Clownfish">
  Nemo is a clownfish, also known as an anemonefish.
  
  <header>
    This is the mighty header
  </header>

`)
    })
  })
})
