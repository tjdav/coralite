import { deepEqual } from 'node:assert'
import { describe, it } from 'node:test'
import { getMetadataFromDocument } from '../lib/index.js'

describe('getPropsFromString', function () {
  it('should extract meta name and content values from document', function () {
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta name="description" content="page description">
        <meta property="og:title" content="Page Title" data-type="social">
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" data-responsive="true">
    </head>
    <body>
    </body>
    </html>`

    const metadata = getMetadataFromDocument(html);
    
    deepEqual(metadata, [
      {
        content: 'page description',
        name: 'description'
      },
      {
        content: 'width=device-width, initial-scale=1.0',
        name: 'viewport'
      }
    ]);
  })

  it('should extract only meta name and content values within the head tag', function () {
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta name="description" content="page description">
        <meta property="og:title" content="Page Title" data-type="social">
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" data-responsive="true">
    </head>
    <body>
        <meta name="ignored" content="outside head">
    </body>
    </html>`

    const metadata = getMetadataFromDocument(html);
    
    deepEqual(metadata, [
      {
        content: 'page description',
        name: 'description'
      },
      {
        content: 'width=device-width, initial-scale=1.0',
        name: 'viewport'
      }
    ]);
  })
})