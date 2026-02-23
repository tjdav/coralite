import { describe, it } from 'node:test'
import assert from 'node:assert'
import { parseHTML } from '../../../lib/parse.js'
import render from 'dom-serializer'

describe('Entity Handling Reproduction', () => {
  it('should preserve entities through parseHTML and render manually', () => {
    const input = '<div>&copy; 2024 &lt;script&gt;</div>'
    const result = parseHTML(input)

    // Check Parser Output
    // @ts-ignore
    const div = result.root.children.find(node => node.name === 'div')
    // @ts-ignore
    const textNode = div.children[0]

    // This asserts the parser fix (step 2)
    // Current behavior: fails because it returns '© 2024 <script>'
    assert.strictEqual(textNode.data, '&copy; 2024 &lt;script&gt;', 'Entities should not be decoded by parser')

    // Check Serializer Output with expected fix options
    // Current behavior (if parser was fixed): render(node, {decodeEntities: false}) -> '&copy;...'
    // If parser is NOT fixed: render(node, {decodeEntities: false}) -> '©...' (no encoding happens)

    // @ts-ignore
    const outputFixed = render(result.root, { decodeEntities: false })
    assert.strictEqual(outputFixed, input, 'Entities should be preserved in output when serializer is configured correctly')
  })
})
