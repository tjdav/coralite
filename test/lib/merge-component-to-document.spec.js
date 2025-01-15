import { strictEqual } from 'node:assert'
import { beforeEach, describe, it } from 'node:test'
import { getComponentFromString, getHTML, mergeComponentToDocument } from '#lib'

/**
 * @import { HTMLData, CoraliteComponent } from '#types'
 */

describe('Merge components into document', async function () {
  const path = {
    pages: './test/fixtures/pages',
    components: './test/fixtures/components'
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

    strictEqual(document, `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document</title>
  <meta name="title" content="Post 1">
  <meta name="author" content="Nemo">
  <meta name="image" content="image.png">
  <meta name="image_alt" content="Photo of a cat">
  <meta name="description" content="short description">
  <meta name="published_time" content="2025-01-08T20:23:07.645Z">
</head>
<body>
  Hello

  
  <header>
    This is the mighty header
  </header>

  
  <span>Nemo</span>
  <time datetime="2025-01-08T20:23:07.645Z">
    Wed, 8 Jan 25
  </time>


  world
</body>
</html>`)
  })
})
