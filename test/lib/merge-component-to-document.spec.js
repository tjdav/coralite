import { strictEqual } from 'node:assert'
import { beforeEach, describe, it } from 'node:test'
import { getComponentFromString, getHTML, mergeComponentToDocument } from '../lib/index.js'

/**
 * @import {HTMLData} from '../lib/get-html.js'
 * @import {CoraliteComponent} from '../lib/component.js'
 */

describe('Merge components into document', async function () {
  const path = {
    pages: './fixtures/pages',
    components: './fixtures/components'
  }
  /** @type {Object.<string, CoraliteComponent>} */
  const components = {}
  /** @type {HTMLData[]} */
  let htmlPages

  beforeEach(async function () {
    const htmlComponents = await getHTML({ path: path.components })
    for (let i = 0; i < htmlComponents.length; i++) {
      const html = htmlComponents[i]
      const component = getComponentFromString(html.content)
      components[component.id] = component
    }
    htmlPages = await getHTML({
      path: path.pages,
      recursive: true
    })
  })

  it('should insert component into document', async function () {
    const html = htmlPages.find(page => page.name === 'index.html')
    const document = await mergeComponentToDocument(html, components, path)
    const customHeaderElement = document.match(/<header>(?<content>[\w+\W+]*)<\/header>/)
    // search for custom elements
    const customElements = document.search(/<[\w]+-[\w]+\s*[\s\S]*?>/)

    strictEqual(customHeaderElement.groups.content.trim(), 'This is the mighty header')
    strictEqual(customElements, -1)
  })

  it('should insert component and nested into document', async function () {
    const html = htmlPages.find(page => page.name === 'post-1.html')
    const document = await mergeComponentToDocument(html, components, path)

    strictEqual(document, '')
  })
})
