import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  EMPTY_FUNCTION_SIGNATURE,
  isWhitespace,
  isEmptyFunction
} from '../../../lib/script-manager.js'

describe('script-manager: isEmptyFunction & isWhitespace', () => {
  describe('EMPTY_FUNCTION_SIGNATURE', () => {
    it('should be defined as canonical function(){}', () => {
      assert.strictEqual(EMPTY_FUNCTION_SIGNATURE, 'function(){}')
    })
  })

  describe('isWhitespace', () => {
    it('should identify ASCII whitespace characters correctly', () => {
      assert.strictEqual(isWhitespace('\t'), true)
      assert.strictEqual(isWhitespace('\n'), true)
      assert.strictEqual(isWhitespace('\v'), true)
      assert.strictEqual(isWhitespace('\f'), true)
      assert.strictEqual(isWhitespace('\r'), true)
      assert.strictEqual(isWhitespace(' '), true)
    })

    it('should identify non-ASCII Unicode whitespace characters correctly', () => {
      // NBSP (0x00A0), Ogham Space Mark (0x1680)
      assert.strictEqual(isWhitespace('\u00A0'), true)
      assert.strictEqual(isWhitespace('\u1680'), true)
      // En space through Hair space (0x2000 - 0x200A)
      assert.strictEqual(isWhitespace('\u2000'), true)
      assert.strictEqual(isWhitespace('\u2005'), true)
      assert.strictEqual(isWhitespace('\u200A'), true)
      // Line separator (0x2028), Paragraph separator (0x2029)
      assert.strictEqual(isWhitespace('\u2028'), true)
      assert.strictEqual(isWhitespace('\u2029'), true)
      // Narrow No-Break Space (0x202F), Medium Mathematical Space (0x205F)
      assert.strictEqual(isWhitespace('\u202F'), true)
      assert.strictEqual(isWhitespace('\u205F'), true)
      // Ideographic Space (0x3000), Byte Order Mark (0xFEFF)
      assert.strictEqual(isWhitespace('\u3000'), true)
      assert.strictEqual(isWhitespace('\uFEFF'), true)
    })

    it('should return false for non-whitespace characters', () => {
      assert.strictEqual(isWhitespace('a'), false)
      assert.strictEqual(isWhitespace('f'), false)
      assert.strictEqual(isWhitespace('('), false)
      assert.strictEqual(isWhitespace(')'), false)
      assert.strictEqual(isWhitespace('{'), false)
      assert.strictEqual(isWhitespace('}'), false)
      assert.strictEqual(isWhitespace('0'), false)
    })
  })

  describe('isEmptyFunction', () => {
    it('should handle falsy and nullish inputs', () => {
      assert.strictEqual(isEmptyFunction(null), true)
      assert.strictEqual(isEmptyFunction(undefined), true)
      assert.strictEqual(isEmptyFunction(''), true)
    })

    it('should return false for whitespace-only inputs (matching regex parity)', () => {
      assert.strictEqual(isEmptyFunction(' '), false)
      assert.strictEqual(isEmptyFunction('\t\n\r '), false)
      assert.strictEqual(isEmptyFunction('\u00A0\u3000'), false)
    })

    it('should return true for exact signature match', () => {
      assert.strictEqual(isEmptyFunction('function(){}'), true)
    })

    it('should return true for signature with ASCII whitespace permutations', () => {
      assert.strictEqual(isEmptyFunction(' function ( ) { } '), true)
      assert.strictEqual(isEmptyFunction('\n\tfunction\n(\t)\n{\r}\n'), true)
      assert.strictEqual(isEmptyFunction('\r\n  function\t\t(\r\n)\t{\n}\r\n'), true)
    })

    it('should return true for signature with Unicode whitespace permutations', () => {
      assert.strictEqual(isEmptyFunction('\u00A0function\u2003()\uFEFF{}\u3000'), true)
      assert.strictEqual(isEmptyFunction('\u1680function\u2028(\u2029)\u202F{\u205F}'), true)
    })

    it('should return false for non-matching prefixes, real scripts, or code', () => {
      assert.strictEqual(isEmptyFunction('import { defineComponent } from "coralite";\nexport default defineComponent({});'), false)
      assert.strictEqual(isEmptyFunction('function(){ console.log("hi"); }'), false)
      assert.strictEqual(isEmptyFunction('function(){ return 123; }'), false)
    })

    it('should return false for trailing code or semicolons', () => {
      assert.strictEqual(isEmptyFunction('function(){};'), false)
      assert.strictEqual(isEmptyFunction('function(){} extra'), false)
      assert.strictEqual(isEmptyFunction('function(){}\n// comment'), false)
    })

    it('should return false for incomplete signatures', () => {
      assert.strictEqual(isEmptyFunction('function()'), false)
      assert.strictEqual(isEmptyFunction('function(){'), false)
      assert.strictEqual(isEmptyFunction('func'), false)
    })

    it('should return false for named functions, arrow functions, or different signatures', () => {
      assert.strictEqual(isEmptyFunction('function foo(){}'), false)
      assert.strictEqual(isEmptyFunction('() => {}'), false)
      assert.strictEqual(isEmptyFunction('async function(){}'), false)
    })

    describe('Generative Parity Battery against legacy Regex', () => {
      // Legacy regex check: (!content || content.replace(/\s+/g, '') === 'function(){}')
      const legacyRegexCheck = (content) => {
        return !content || content.replace(/\s+/g, '') === 'function(){}'
      }

      it('should match legacy regex parity across 150 randomized test cases', () => {
        const unicodeSpaces = [
          ' ', '\t', '\n', '\r', '\v', '\f',
          '\u00A0', '\u1680', '\u2000', '\u2001', '\u2002', '\u2003',
          '\u2004', '\u2005', '\u2006', '\u2007', '\u2008', '\u2009',
          '\u200A', '\u2028', '\u2029', '\u202F', '\u205F', '\u3000', '\uFEFF'
        ]

        const getRandomSpace = () => unicodeSpaces[Math.floor(Math.random() * unicodeSpaces.length)]
        const getRandomSpaces = (max = 4) => {
          const count = Math.floor(Math.random() * max)
          let res = ''
          for (let i = 0; i < count; i++) {
            res += getRandomSpace()
          }
          return res
        }

        const testCases = []

        // 1. Valid empty function permutations with random spaces
        for (let i = 0; i < 40; i++) {
          const s = `${getRandomSpaces()}function${getRandomSpaces()}(${getRandomSpaces()})${getRandomSpaces()}{${getRandomSpaces()}}${getRandomSpaces()}`
          testCases.push(s)
        }

        // 2. Incomplete or corrupted signatures
        const baseSig = 'function(){}'
        for (let i = 0; i < 40; i++) {
          const len = Math.floor(Math.random() * baseSig.length)
          const truncated = baseSig.slice(0, len)
          testCases.push(`${getRandomSpaces()}${truncated}${getRandomSpaces()}`)
        }

        // 3. Valid signatures with unexpected injected chars
        const noiseChars = [';', 'x', '1', '/', '*', 'a', '0', '{', '}']
        for (let i = 0; i < 40; i++) {
          const noise = noiseChars[Math.floor(Math.random() * noiseChars.length)]
          const pos = Math.floor(Math.random() * (baseSig.length + 1))
          const corrupted = baseSig.slice(0, pos) + noise + baseSig.slice(pos)
          testCases.push(`${getRandomSpaces()}${corrupted}${getRandomSpaces()}`)
        }

        // 4. Real-world snippets, edge cases
        const edgeCases = [
          null, undefined, '', ' ', ' \t\n ',
          'function(){}', 'function ( ) { }', 'function\n(\n)\n{\n}',
          'function foo(){}', '() => {}', 'function(){};',
          'function(){ console.log(1); }', 'function(){ return true; }',
          'const f = () => {}', '/* empty */ function(){}'
        ]
        testCases.push(...edgeCases)

        for (const input of testCases) {
          const actual = isEmptyFunction(input)
          const expected = legacyRegexCheck(input)
          assert.strictEqual(
            actual,
            expected,
            `Parity mismatch for input: ${JSON.stringify(input)} (expected ${expected}, got ${actual})`
          )
        }
      })
    })
  })
})
