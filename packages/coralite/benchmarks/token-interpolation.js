import { bench, run } from 'mitata'
import { replaceToken } from '../lib/utils.js'

const TOKEN_COUNT = 5000

// Set up massive tree of AST string contents
const contentBase = Array.from({ length: TOKEN_COUNT }, (_, i) => `Prefix {{ user.name_${i} }} Suffix`).join(' ')

// Dummy framework nodes simulation
const dummyNodes = Array.from({ length: TOKEN_COUNT }, (_, i) => ({
  type: 'text',
  data: `{{ user.name_${i} }}`,
  parent: { children: [] }
}))
// set the children properly to avoid undefined indexing inside replaceToken
dummyNodes.forEach(node => {
  node.parent.children.push(node)
})

const computedValues = {}
for (let i = 0; i < TOKEN_COUNT; i++) {
  computedValues[`user.name_${i}`] = `John Doe ${i}`
}

console.log(`\nBenchmark: Token Interpolation (${TOKEN_COUNT} tokens)`)
console.log('--------------------------------------------------')

bench('replaceToken (Framework) (Simulating iterating AST nodes)', () => {
  for (let i = 0; i < dummyNodes.length; i++) {
    // replaceToken modifies the node in place
    // Reset it per iteration to test regex replacement fair and square
    const node = { ...dummyNodes[i] }
    replaceToken({
      type: 'text',
      node: node,
      content: node.data,
      value: computedValues[`user.name_${i}`]
    })
  }
})

// A native string replace loop over a big string containing all tokens
bench('Native String.prototype.replace (Baseline over massive string)', () => {
  let str = contentBase
  for (let i = 0; i < TOKEN_COUNT; i++) {
    str = str.replace(`{{ user.name_${i} }}`, computedValues[`user.name_${i}`])
  }
})

await run()
