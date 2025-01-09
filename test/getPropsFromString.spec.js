import { deepStrictEqual, strictEqual } from 'node:assert'
import { describe, it } from 'node:test'
import { getPropsFromString } from '../lib/index.js'

describe('getPropsFromString', function () {
  it('should extract name property from string', function () {
    const string = `<template id="template1">Hello {{ name }}! Wassup? <code>import { red } from 'lib.js'</code></template>`
    const props = getPropsFromString(string);
    
    strictEqual(props.length, 1)
    deepStrictEqual(props[0], {
      name: 'name',
      startIndex: 31,
      endIndex: 41
    });
  })
})