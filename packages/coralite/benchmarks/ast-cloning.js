import { bench, run } from 'mitata'
import { cloneNode } from '../lib/utils.js'
import { parseHTML } from '../lib/parse.js'
import { massiveHTML } from './utils/dummy-data.js'

console.log('Generating AST for cloning benchmark...')
const parsed = parseHTML(massiveHTML)
// Extract the root component node (or first node) to clone
const rootNode = parsed.root

// Validate that we have a tree
if (!rootNode) {
  throw new Error('Failed to parse massive HTML tree')
}

console.log(`\nBenchmark: AST Node Cloning`)
console.log('--------------------------------------------------')

bench('cloneNode (Framework)', () => {
  // Use a fresh WeakMap or Map for nodeMap if needed, cloneNode requires a Map
  cloneNode(new Map(), rootNode, null)
})

// A naive copy algorithm avoiding circular references
function naiveCloneWithoutCircular (node) {
  const cloned = { ...node }
  if (cloned.parent) {
    // Break circular
    cloned.parent = null
  }
  if (Array.isArray(cloned.children)) {
    cloned.children = cloned.children.map(naiveCloneWithoutCircular)
  }
  return cloned
}

bench('Naive Recursive copy (Baseline - Without circulars)', () => {
  naiveCloneWithoutCircular(rootNode)
})

bench('structuredClone (Baseline - Fails on Circulars)', () => {
  try {
    structuredClone(rootNode)
  } catch (e) {
    // Ignore DataCloneError for circulars
  }
})

await run()
