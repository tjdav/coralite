import { createCoraliteElement as optimizedCreate } from '../lib/dom.js'

// Legacy implementation (Object.defineProperties) for comparison
function legacyCreate (node) {
  // Simulate the enhancer logic (coraliteNode)
  Object.defineProperties(node, {
    nodeType: {
      get () {
        return 1
      }
    },
    parentNode: {
      get () {
        return this.parent
      },
      set (v) {
        this.parent = v
      }
    }
    // ... minimal properties to be fair
  })

  Object.defineProperties(node, {
    nodeName: {
      get () {
        return this.name.toUpperCase()
      }
    },
    tagName: {
      get () {
        return this.name.toUpperCase()
      },
      set (v) {
        this.name = v.toLowerCase()
      }
    },
    attributes: {
      get () {
        return this.attribs
      },
      set (v) {
        this.attribs = v
      }
    },
    childNodes: {
      get () {
        return this.children || []
      },
      set (v) {
        this.children = v
      }
    },
    // Simplified set of properties for benchmark fairness (key ones)
    textContent: {
      get () {
        return ''
      },
      set (v) {
        // no-op for bench
      }
    }
  })
  return node
}

const ITERATIONS = 100000

function runBenchmark (label, fn) {
  const start = performance.now()
  for (let i = 0; i < ITERATIONS; i++) {
    // Reset node state for fair comparison (create new object each time)
    fn({
      type: 'tag',
      name: 'div',
      attribs: { id: `item-${i}` },
      children: [],
      parent: null
    })
  }
  const end = performance.now()
  const duration = end - start
  console.log(`${label}: ${duration.toFixed(2)}ms`)
  return duration
}

console.log(`\nBenchmark: DOM Node Creation (${ITERATIONS.toLocaleString()} iterations)`)
console.log('--------------------------------------------------')

// Warmup
runBenchmark('Warmup (Legacy)', legacyCreate)
runBenchmark('Warmup (Optimized)', optimizedCreate)
console.log('--------------------------------------------------')

const legacyTime = runBenchmark('Legacy (Object.defineProperties)', legacyCreate)
const optimizedTime = runBenchmark('Optimized (Object.setPrototypeOf)', optimizedCreate)

console.log('--------------------------------------------------')
const improvement = legacyTime / optimizedTime
console.log(`Speedup: ${improvement.toFixed(1)}x faster`)
console.log(`Time saved per 100k nodes: ${(legacyTime - optimizedTime).toFixed(2)}ms`)
