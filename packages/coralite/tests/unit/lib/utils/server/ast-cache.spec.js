import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  getAST,
  clearASTCache,
  findAndExtractScript,
  extractComponentProperty,
  findAndExtractImperativeComponents,
  extractGlobals
} from '../../../../../lib/utils/server/server.js'

describe('getAST() Cache Hardening & Validation', () => {
  beforeEach(() => {
    clearASTCache()
  })

  it('1. Reference Equality: returns strictly identical AST instances for identical code and location flags', () => {
    const code = 'const count = 42; export default count;'

    const astNoLoc1 = getAST(code, false)
    const astNoLoc2 = getAST(code, false)
    assert.strictEqual(astNoLoc1, astNoLoc2, 'getAST(code, false) must return exact same reference')

    const astLoc1 = getAST(code, true)
    const astLoc2 = getAST(code, true)
    assert.strictEqual(astLoc1, astLoc2, 'getAST(code, true) must return exact same reference')
  })

  it('2. Flag Segregation: segregates cached ASTs by locations flag and includes correct properties', () => {
    const code = 'const greeting = "hello";'

    const astNoLoc = getAST(code, false)
    const astLoc = getAST(code, true)

    assert.notStrictEqual(astNoLoc, astLoc, 'getAST(code, false) and getAST(code, true) must be separate instances')

    // Location node properties verification
    assert.strictEqual(astNoLoc.loc, undefined, '.loc must be undefined when locations=false')
    assert.notStrictEqual(astLoc.loc, undefined, '.loc must be defined when locations=true')

    // Offset byte properties present on both
    assert.strictEqual(typeof astNoLoc.start, 'number', '.start offset must be present on locations=false AST')
    assert.strictEqual(typeof astNoLoc.end, 'number', '.end offset must be present on locations=false AST')
    assert.strictEqual(typeof astLoc.start, 'number', '.start offset must be present on locations=true AST')
    assert.strictEqual(typeof astLoc.end, 'number', '.end offset must be present on locations=true AST')
  })

  it('3. clearASTCache() Functionality: resets cached AST instances for both location maps', () => {
    const code = 'function add(a, b) { return a + b; }'

    const initialNoLoc = getAST(code, false)
    const initialLoc = getAST(code, true)

    clearASTCache()

    const newNoLoc = getAST(code, false)
    const newLoc = getAST(code, true)

    assert.notStrictEqual(initialNoLoc, newNoLoc, 'getAST(code, false) must return a fresh AST reference after clearASTCache()')
    assert.notStrictEqual(initialLoc, newLoc, 'getAST(code, true) must return a fresh AST reference after clearASTCache()')
  })

  it('4. Syntax Error Handling: throws SyntaxError on invalid JS and leaves cache unpolluted', () => {
    const invalidCode = 'const foo = ;'

    assert.throws(
      () => getAST(invalidCode, false),
      (err) => err instanceof SyntaxError
    )

    assert.throws(
      () => getAST(invalidCode, true),
      (err) => err instanceof SyntaxError
    )

    // Valid code parsed afterward should function normally without corrupt entries interfering
    const validCode = 'const foo = 123;'
    const ast = getAST(validCode)
    assert.ok(ast && ast.type === 'Program')
  })

  it('5. Multi-Pass Extraction Safety: visitors process shared cached AST without mutating the AST structure', () => {
    const componentCode = `
      import { defineComponent } from 'coralite'

      export default defineComponent({
        props: {
          initialCount: Number,
          theme: String
        },
        state () {
          return { count: 0 }
        },
        async server () {
          const res = await fetch('/api/data')
          return res.json()
        },
        client ({ instanceId, state, root }) {
          const badge = document.createElement('c-badge')
          const card = createCoraliteElement('c-card')
          root.innerHTML = '<c-header></c-header>'
          console.log(badge, card, instanceId, state)
        }
      })
    `

    // Pre-get AST to hold reference and capture snapshot
    const cachedAST = getAST(componentCode, true)
    const astSnapshotBefore = JSON.stringify(cachedAST)

    // Run multi-pass extraction visitors in sequence on the exact same script
    const scriptResult = findAndExtractScript(componentCode)
    const serverProp = extractComponentProperty(componentCode, 'server')
    const clientProp = extractComponentProperty(componentCode, 'client')
    const stateProp = extractComponentProperty(componentCode, 'state')
    const imperativeComponents = findAndExtractImperativeComponents(componentCode)
    const globals = extractGlobals(componentCode)

    // Verify extraction outputs are valid
    assert.ok(scriptResult, 'findAndExtractScript should extract script content')
    assert.ok(serverProp, 'extractComponentProperty(server) should succeed')
    assert.ok(clientProp, 'extractComponentProperty(client) should succeed')
    assert.ok(stateProp, 'extractComponentProperty(state) should succeed')
    assert.ok(Array.isArray(imperativeComponents), 'findAndExtractImperativeComponents should return array')
    assert.ok(globals.includes('defineComponent'), 'extractGlobals should contain defineComponent')

    // Verify reference equality is maintained after multi-pass extraction
    const astAfterPasses = getAST(componentCode, true)
    assert.strictEqual(cachedAST, astAfterPasses, 'cached AST reference must remain identical after multi-pass extractions')

    // Verify deep structure was unmutated
    const astSnapshotAfter = JSON.stringify(cachedAST)
    assert.strictEqual(astSnapshotBefore, astSnapshotAfter, 'cached AST structure must not be mutated by extraction passes')
  })
})
