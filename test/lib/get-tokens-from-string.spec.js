import { deepStrictEqual, strictEqual } from 'node:assert'
import { describe, it } from 'node:test'
import { getTokensFromString } from '../lib/index.js'

describe('Get tokens from string', function () {
  it('should extract name token', function () {
    const string = `<template id="template1">Hello {{ name }}! Wassup? <code>import { red } from 'lib.js'</code></template>`
    const props = getTokensFromString(string)

    strictEqual(props.length, 1)
    deepStrictEqual(props[0], {
      name: 'name',
      startIndex: 31,
      endIndex: 41
    })
  })

  it('should extract name token', function () {
    const string = `<template id="template1">Hello {{ name }}! Wassup? <code>import { red } from 'lib.js'</code></template>`
    const props = getTokensFromString(string)

    strictEqual(props.length, 1)
    deepStrictEqual(props[0], {
      name: 'name',
      startIndex: 31,
      endIndex: 41
    })
  })
})
