import { deepStrictEqual, strictEqual } from 'node:assert'
import { describe, it } from 'node:test'
import { getTokensFromString } from '#lib'

describe('Get tokens from string', function () {
  it('should extract name token', function () {
    const string = `<template id="template1">Hello {{ name }}! Wassup? <code>import { red } from 'lib.js'</code></template>`
    const tokens = getTokensFromString(string)

    strictEqual(tokens.length, 1)
    deepStrictEqual(tokens[0], {
      name: 'name',
      content: '{{ name }}'
    })
  })

  it('should extract name token', function () {
    const string = `<template id="template1">Hello {{ name }}! Wassup? <code>import { red } from 'lib.js'</code></template>`
    const tokens = getTokensFromString(string)

    strictEqual(tokens.length, 1)
    deepStrictEqual(tokens[0], {
      name: 'name',
      content: '{{ name }}'
    })
  })
})
