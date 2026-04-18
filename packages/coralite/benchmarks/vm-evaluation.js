import { bench, run } from 'mitata'
import { SourceTextModule, createContext } from 'node:vm'

const SCRIPT_COUNT = 5000
const SCRIPT_CONTENT = `
  const test = true;
  export default {
    setup() { return { test }; }
  };
`
// Dummy linker returning a synthetic module, no external resolution
const DUMMY_LINKER = async (specifier, referencingModule) => {
  const mod = new SourceTextModule('export default {}', { context: referencingModule.context })
  await mod.link(() => {
  })
  await mod.evaluate()
  return mod
}

const EXEC_SCRIPT_CONTENT = `
  let counter = 0;
  for (let i = 0; i < 1000; i++) {
    counter += i;
  }
  export const result = counter;
`

console.log(`\nBenchmark: VM Context Evaluation`)
console.log('--------------------------------------------------')

// Benchmark Instantiation Phase
bench('VM SourceTextModule Instantiation (Scale: 5000)', async () => {
  const context = createContext({})
  for (let i = 0; i < SCRIPT_COUNT; i++) {
    const mod = new SourceTextModule(SCRIPT_CONTENT, { context })
    await mod.link(DUMMY_LINKER)
    await mod.evaluate()
  }
})

bench('new Function Instantiation (Baseline) (Scale: 5000)', () => {
  for (let i = 0; i < SCRIPT_COUNT; i++) {
    new Function('context', 'return { setup() { return { test: true }; } };')
  }
})

// Benchmark Execution Phase
bench('VM SourceTextModule Execution (1000 loop)', async () => {
  const context = createContext({})
  const mod = new SourceTextModule(EXEC_SCRIPT_CONTENT, { context })
  await mod.link(DUMMY_LINKER)
  await mod.evaluate()
})

bench('new Function Execution (Baseline) (1000 loop)', () => {
  const fn = new Function('context', `
    let counter = 0;
    for (let i = 0; i < 1000; i++) {
      counter += i;
    }
    return counter;
  `)
  fn()
})

await run()
