import { deepEqual } from 'node:assert'
import { describe, it } from 'node:test'
import { mergeComponentToDocument } from '../lib/index.js'

describe('getPropsFromString', function () {
  it('should extract meta name and content values from document', function () {
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta name="description" content="page description">
        <meta property="og:title" content="Page Title" data-type="social">
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0" data-responsive="true">
    </head>
    <body>
      <h1>Coralite</h1>
      
      <p>! <custom-element name="tom"></custom-element></p>
    </body>
    </html>`

    const metadata = mergeComponentToDocument(html, {
      'custom-element': {
        data: '<strong>{{ name }}</strong>',
        props: [
          {
            name: 'name',
            startIndex: 7,
            endIndex: 17
          }
        ]
      }
    })

    deepEqual(metadata, [
      {
        content: 'page description',
        name: 'description'
      },
      {
        content: 'width=device-width, initial-scale=1.0',
        name: 'viewport'
      }
    ])
  })
})
