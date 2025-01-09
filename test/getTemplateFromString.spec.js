import { strictEqual, fail, deepStrictEqual } from 'node:assert'
import { describe, it } from 'node:test'
import { getTemplateFromString } from '../lib/index.js'

describe('getTemplateFromString', function () {
  it('should correctly extract templates from HTML', function () {
    const html = `<template id="template1">Template 1</template>`;
    const templates = getTemplateFromString(html);
  
    strictEqual(templates.template1.data, 'Template 1');
  })

  it('should correctly extract properties from template', function () {
    const html = `<template id="template1">Hello {{ name }}! <code>import { name } from 'lib.js'</code></template>`;
    const templates = getTemplateFromString(html);
  
    strictEqual(templates.template1.data, `Hello {{ name }}! <code>import { name } from 'lib.js'</code>`)
    deepStrictEqual(templates.template1.props, [
      {
        name: 'name',
        startIndex: 6,
        endIndex: 16
      }
    ]);
  })

  it('should throw an error when no id attribute is found on a template tag', function () {
    const html = '<template>Template Without ID</template>';

    try {
      getTemplateFromString(html)
      fail('Expected an error')
    } catch (error) {
      strictEqual(error.message, 'Template requires an id attribute but found none at index: 29');
    }
  })

  it('should throw an error when there are multiple templates found', function () {
    const html = `
      <template id="template1">Template 1</template>
      <template id="template2">Template 2</template>
    `;

    try {
      getTemplateFromString(html)
      fail('Expected an error')
    } catch (error) {
      strictEqual(error.message, 'Unexpected number of templates found, only one is permitted');
    }
  })

  it('should correctly extract script tag', { skip: true }, function () {
    const html = `
      <template id="template1">Template 1</template>
      <script>

      </script>
    `;

    try {
      getTemplateFromString(html)
      fail('Expected an error')
    } catch (error) {
      strictEqual(error.message, 'Unexpected number of templates found, only one is permitted');
    }
  })
})