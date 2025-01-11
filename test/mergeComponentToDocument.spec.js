import { deepEqual, strictEqual } from 'node:assert'
import { describe, it } from 'node:test'
import { mergeComponentToDocument } from '../lib/index.js'

describe('Merge components into document', function () {
  it('should insert component into document', { skip: true }, function () {
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

    const document = mergeComponentToDocument(html, {
      'custom-element': {
        id: 'custom-element',
        content: '<strong>{{ name }}</strong>',
        tokens: [
          {
            name: 'name',
            startIndex: 8,
            endIndex: 18
          }
        ],
        computedTokens: () => {
        },
        customElements: []
      }
    })

    strictEqual(document, `
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
      
      <p>! <strong>tom</strong></p>
    </body>
    </html>`)
  })

  it('should insert component and nested into document', function () {
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

    const document = mergeComponentToDocument(html, {
      'custom-element': {
        id: 'custom-element',
        content: '<strong>{{ name }} and </strong>',
        tokens: [
          {
            name: 'name',
            startIndex: 8,
            endIndex: 18
          }
        ],
        computedTokens: () => {
        },
        customElements: [
          {
            id: 'nested-custom-element',
            attributes: {
              name: '{{ name }}'
            },
            index: 23
          }
        ]
      },
      'nested-custom-element': {
        id: 'custom-element',
        content: '<em>{{ name }}</em>',
        tokens: [
          {
            name: 'name',
            startIndex: 4,
            endIndex: 14
          }
        ],
        computedTokens: () => {
        },
        customElements: []
      }
    })

    strictEqual(document, `
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
      
      <p>! <strong>tom and <em>tom</em></strong></p>
    </body>
    </html>`)
  })
})
