import { strictEqual, fail } from 'node:assert'
import { describe, it } from 'node:test'
import { getTemplateFromHTML } from '../lib/index.js'

describe('getTemplateFromHTML', function () {
  it('should correctly extract templates from HTML', function () {
    const html = `<template id="template1">Template 1</template>`;
    const templates = getTemplateFromHTML(html);
  
    strictEqual(templates['template1'], 'Template 1');
  })

  it('should throw an error when no id attribute is found on a template tag', function () {
    const html = '<template>Template Without ID</template>';

    try {
      getTemplateFromHTML(html)
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
      getTemplateFromHTML(html)
      fail('Expected an error')
    } catch (error) {
      strictEqual(error.message, 'Unexpected number of templates found, only one is permitted');
    }
  })
})