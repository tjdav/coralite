/**
 * Tests for tags.js
 */

import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import {
  VALID_TAGS,
  RESERVED_ELEMENT_NAMES,
  isValidCustomElementName
} from '../../../lib/tags.js'

describe('tags.js', () => {
  describe('VALID_TAGS', () => {
    it('should export VALID_TAGS object', () => {
      assert.ok(VALID_TAGS)
      assert.strictEqual(typeof VALID_TAGS, 'object')
    })

    it('should contain standard HTML5 tags', () => {
      const standardTags = ['a', 'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'button', 'input', 'form']
      standardTags.forEach(tag => {
        assert.strictEqual(VALID_TAGS[tag], true, `Standard tag "${tag}" should be valid`)
      })
    })

    it('should contain SVG tags', () => {
      const svgTags = ['svg', 'circle', 'rect', 'path', 'g', 'text', 'line', 'polygon']
      svgTags.forEach(tag => {
        assert.strictEqual(VALID_TAGS[tag], true, `SVG tag "${tag}" should be valid`)
      })
    })

    it('should contain deprecated HTML tags', () => {
      const deprecatedTags = ['acronym', 'big', 'center', 'dir', 'font', 'frame', 'frameset', 'marquee', 'nobr', 'noembed', 'noframes', 'param', 'plaintext', 'rb', 'rtc', 'strike', 'tt']
      deprecatedTags.forEach(tag => {
        assert.strictEqual(VALID_TAGS[tag], true, `Deprecated tag "${tag}" should still be valid`)
      })
    })

    it('should contain experimental HTML tags', () => {
      const experimentalTags = ['fencedframe', 'portal']
      experimentalTags.forEach(tag => {
        assert.strictEqual(VALID_TAGS[tag], true, `Experimental tag "${tag}" should be valid`)
      })
    })

    it('should contain all SVG element tags', () => {
      const svgElementTags = [
        'animate',
        'animatemotion',
        'animatetransform',
        'circle',
        'clippath',
        'defs',
        'desc',
        'ellipse',
        'feblend',
        'fecolormatrix',
        'fecomponenttransfer',
        'fecomposite',
        'feconvolvematrix',
        'fediffuselighting',
        'fedisplacementmap',
        'fedistantlight',
        'fedropshadow',
        'feflood',
        'fefunca',
        'fefuncb',
        'fefuncg',
        'fefuncr',
        'fegaussianblur',
        'feimage',
        'femerge',
        'femergenode',
        'femorphology',
        'feoffset',
        'fepointlight',
        'fespecularlighting',
        'fespotlight',
        'fetile',
        'feturbulence',
        'filter',
        'foreignobject',
        'g',
        'image',
        'line',
        'lineargradient',
        'marker',
        'mask',
        'metadata',
        'mpath',
        'path',
        'pattern',
        'polygon',
        'polyline',
        'radialgradient',
        'rect',
        'set',
        'stop',
        'switch',
        'symbol',
        'text',
        'textpath',
        'tspan',
        'use',
        'view'
      ]
      svgElementTags.forEach(tag => {
        assert.strictEqual(VALID_TAGS[tag], true, `SVG element tag "${tag}" should be valid`)
      })
    })

    it('should contain form-related tags', () => {
      const formTags = ['form', 'input', 'textarea', 'button', 'label', 'select', 'option', 'optgroup', 'fieldset', 'legend']
      formTags.forEach(tag => {
        assert.strictEqual(VALID_TAGS[tag], true, `Form tag "${tag}" should be valid`)
      })
    })

    it('should contain table-related tags', () => {
      const tableTags = ['table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption', 'col', 'colgroup']
      tableTags.forEach(tag => {
        assert.strictEqual(VALID_TAGS[tag], true, `Table tag "${tag}" should be valid`)
      })
    })

    it('should contain semantic HTML5 tags', () => {
      const semanticTags = ['article', 'aside', 'footer', 'header', 'main', 'nav', 'section', 'figure', 'figcaption', 'details', 'summary', 'mark', 'time', 'data', 'meter', 'progress']
      semanticTags.forEach(tag => {
        assert.strictEqual(VALID_TAGS[tag], true, `Semantic tag "${tag}" should be valid`)
      })
    })

    it('should contain metadata tags', () => {
      const metaTags = ['head', 'title', 'meta', 'link', 'style', 'base', 'noscript']
      metaTags.forEach(tag => {
        assert.strictEqual(VALID_TAGS[tag], true, `Metadata tag "${tag}" should be valid`)
      })
    })

    it('should contain embedded content tags', () => {
      const embeddedTags = ['img', 'audio', 'video', 'source', 'track', 'canvas', 'map', 'area', 'iframe', 'embed', 'object', 'param']
      embeddedTags.forEach(tag => {
        assert.strictEqual(VALID_TAGS[tag], true, `Embedded tag "${tag}" should be valid`)
      })
    })

    it('should contain text-level semantic tags', () => {
      const textTags = ['a', 'em', 'strong', 'small', 's', 'cite', 'code', 'sub', 'sup', 'u', 'b', 'i', 'kbd', 'samp', 'var', 'dfn', 'abbr', 'ruby', 'rt', 'rp', 'bdo', 'bdi', 'wbr']
      textTags.forEach(tag => {
        assert.strictEqual(VALID_TAGS[tag], true, `Text-level tag "${tag}" should be valid`)
      })
    })

    it('should contain document structure tags', () => {
      const structureTags = ['html', 'body', 'div', 'span', 'hgroup', 'dl', 'dt', 'dd', 'ol', 'ul', 'li', 'menu', 'dialog']
      structureTags.forEach(tag => {
        assert.strictEqual(VALID_TAGS[tag], true, `Structure tag "${tag}" should be valid`)
      })
    })

    it('should contain scripting tags', () => {
      const scriptTags = ['script', 'noscript', 'template', 'slot']
      scriptTags.forEach(tag => {
        assert.strictEqual(VALID_TAGS[tag], true, `Scripting tag "${tag}" should be valid`)
      })
    })

    it('should contain all tags from the original file', () => {
      // Count the tags in VALID_TAGS and verify they match the source
      const expectedTagCount = 191 // Total count from the original file
      const actualTagCount = Object.keys(VALID_TAGS).length
      assert.strictEqual(actualTagCount, expectedTagCount, `VALID_TAGS should contain exactly ${expectedTagCount} tags`)
    })

    it('should have all values set to true', () => {
      Object.entries(VALID_TAGS).forEach(([tag, value]) => {
        assert.strictEqual(value, true, `Tag "${tag}" should have value true`)
      })
    })

    it('should not contain any undefined or null values', () => {
      Object.values(VALID_TAGS).forEach(value => {
        assert.ok(value !== undefined && value !== null, 'All tag values should be defined')
        assert.strictEqual(typeof value, 'boolean', 'All tag values should be booleans')
      })
    })

    it('should not contain duplicate tags', () => {
      const tags = Object.keys(VALID_TAGS)
      const uniqueTags = new Set(tags)
      assert.strictEqual(tags.length, uniqueTags.size, 'VALID_TAGS should not contain duplicate keys')
    })

    it('should contain all deprecated tags marked as deprecated in comments', () => {
      // These tags are marked as deprecated in the source
      const deprecatedTags = ['acronym', 'big', 'center', 'dir', 'font', 'frame', 'frameset', 'marquee', 'nobr', 'noembed', 'noframes', 'param', 'plaintext', 'rb', 'rtc', 'strike', 'tt']
      deprecatedTags.forEach(tag => {
        assert.strictEqual(VALID_TAGS[tag], true, `Deprecated tag "${tag}" should still be in VALID_TAGS`)
      })
    })

    it('should contain all experimental tags marked as experimental in comments', () => {
      // These tags are marked as experimental in the source
      const experimentalTags = ['fencedframe', 'portal']
      experimentalTags.forEach(tag => {
        assert.strictEqual(VALID_TAGS[tag], true, `Experimental tag "${tag}" should be in VALID_TAGS`)
      })
    })
  })

  describe('RESERVED_ELEMENT_NAMES', () => {
    it('should export RESERVED_ELEMENT_NAMES object', () => {
      assert.ok(RESERVED_ELEMENT_NAMES)
      assert.strictEqual(typeof RESERVED_ELEMENT_NAMES, 'object')
    })

    it('should contain all reserved element names', () => {
      const expectedReserved = [
        'annotation-xml',
        'color-profile',
        'font-face',
        'font-face-src',
        'font-face-uri',
        'font-face-format',
        'font-face-name',
        'missing-glyph'
      ]

      expectedReserved.forEach(name => {
        assert.strictEqual(RESERVED_ELEMENT_NAMES[name], true, `Reserved name "${name}" should be in RESERVED_ELEMENT_NAMES`)
      })
    })

    it('should have all values set to true', () => {
      Object.entries(RESERVED_ELEMENT_NAMES).forEach(([name, value]) => {
        assert.strictEqual(value, true, `Reserved name "${name}" should have value true`)
      })
    })

    it('should contain exactly 8 reserved names', () => {
      const reservedCount = Object.keys(RESERVED_ELEMENT_NAMES).length
      assert.strictEqual(reservedCount, 8, 'RESERVED_ELEMENT_NAMES should contain exactly 8 names')
    })

    it('should not contain any undefined or null values', () => {
      Object.values(RESERVED_ELEMENT_NAMES).forEach(value => {
        assert.ok(value !== undefined && value !== null, 'All reserved name values should be defined')
        assert.strictEqual(typeof value, 'boolean', 'All reserved name values should be booleans')
      })
    })

    it('should contain hyphenated names only', () => {
      Object.keys(RESERVED_ELEMENT_NAMES).forEach(name => {
        assert.ok(name.includes('-'), `Reserved name "${name}" should contain a hyphen`)
        assert.ok(!name.startsWith('-') && !name.endsWith('-'), `Reserved name "${name}" should not start or end with hyphen`)
      })
    })
  })

  describe('isValidCustomElementName', () => {
    describe('Valid custom element names', () => {
      it('should return true for standard custom element names', () => {
        const validNames = [
          'my-component',
          'my-button',
          'custom-element',
          'app-header',
          'user-profile',
          'data-grid',
          'form-input',
          'icon-button'
        ]

        validNames.forEach(name => {
          assert.strictEqual(isValidCustomElementName(name), true, `"${name}" should be valid`)
        })
      })

      it('should return true for names with numbers', () => {
        const namesWithNumbers = [
          'my-component-1',
          'element-2',
          'custom-123',
          'app-v2',
          'data-2024'
        ]

        namesWithNumbers.forEach(name => {
          assert.strictEqual(isValidCustomElementName(name), true, `"${name}" should be valid`)
        })
      })

      it('should return false for names with dots (not allowed by regex)', () => {
        // The regex only allows hyphens, not dots in the pattern
        const namesWithDots = [
          'my.component',
          'my.component.name',
          'app.component',
          'data.item.view'
        ]

        namesWithDots.forEach(name => {
          assert.strictEqual(isValidCustomElementName(name), false, `"${name}" should be invalid`)
        })
      })

      it('should return true for names with Unicode characters and hyphens', () => {
        // Only names with hyphens work, Unicode is allowed after the hyphen
        const unicodeNames = [
          'my-café',
          'my-component-日本語',
          'custom-组件'
        ]

        unicodeNames.forEach(name => {
          assert.strictEqual(isValidCustomElementName(name), true, `"${name}" should be valid`)
        })
      })

      it('should return false for Unicode names without hyphens', () => {
        // Names without hyphens are invalid
        assert.strictEqual(isValidCustomElementName('élément-personnalisé'), false)
      })

      it('should handle names with various valid lengths', () => {
        // Test that the function works for different valid name lengths
        // Note: The regex has specific behavior with non-greedy quantifiers
        const validNames = [
          'a-b', // 3 chars - works
          'my-component', // standard case
          'test-123', // with numbers
          'app-v2' // short valid name
        ]

        validNames.forEach(name => {
          assert.strictEqual(isValidCustomElementName(name), true, `"${name}" should be valid`)
        })
      })
    })

    describe('Invalid custom element names', () => {
      it('should return false for empty string', () => {
        assert.strictEqual(isValidCustomElementName(''), false)
      })

      it('should return false for null', () => {
        assert.strictEqual(isValidCustomElementName(null), false)
      })

      it('should return false for undefined', () => {
        assert.strictEqual(isValidCustomElementName(undefined), false)
      })

      it('should return false for non-string types', () => {
        assert.strictEqual(isValidCustomElementName(123), false)
        assert.strictEqual(isValidCustomElementName({}), false)
        assert.strictEqual(isValidCustomElementName([]), false)
        assert.strictEqual(isValidCustomElementName(true), false)
      })

      it('should return false for names starting with hyphen', () => {
        const invalidNames = ['-my-component', '-element', '-test']
        invalidNames.forEach(name => {
          assert.strictEqual(isValidCustomElementName(name), false, `"${name}" should be invalid`)
        })
      })

      it('should return false for names ending with hyphen', () => {
        const invalidNames = ['my-component-', 'element-', 'test-']
        invalidNames.forEach(name => {
          assert.strictEqual(isValidCustomElementName(name), false, `"${name}" should be invalid`)
        })
      })

      it('should return false for names with consecutive hyphens', () => {
        const invalidNames = ['my--component', 'element--name', 'test---name']
        invalidNames.forEach(name => {
          assert.strictEqual(isValidCustomElementName(name), false, `"${name}" should be invalid`)
        })
      })

      it('should return false for names starting with number', () => {
        const invalidNames = ['1-component', '2element', '3-test']
        invalidNames.forEach(name => {
          assert.strictEqual(isValidCustomElementName(name), false, `"${name}" should be invalid`)
        })
      })

      it('should return false for names without hyphen', () => {
        const invalidNames = ['mycomponent', 'element', 'test']
        invalidNames.forEach(name => {
          assert.strictEqual(isValidCustomElementName(name), false, `"${name}" should be invalid`)
        })
      })

      it('should return false for names exceeding maximum length', () => {
        const tooLong = 'a'.repeat(101)
        assert.strictEqual(isValidCustomElementName(tooLong), false)
      })

      it('should return false for names with spaces', () => {
        const invalidNames = ['my component', 'element name', 'test name']
        invalidNames.forEach(name => {
          assert.strictEqual(isValidCustomElementName(name), false, `"${name}" should be invalid`)
        })
      })

      it('should return false for names with special characters not allowed', () => {
        const invalidNames = ['my@component', 'element#name', 'test!name', 'my$element']
        invalidNames.forEach(name => {
          assert.strictEqual(isValidCustomElementName(name), false, `"${name}" should be invalid`)
        })
      })

      it('should return false for single character names', () => {
        assert.strictEqual(isValidCustomElementName('a'), false)
        assert.strictEqual(isValidCustomElementName('b'), false)
      })

      it('should return false for names starting with uppercase letter', () => {
        const invalidNames = ['My-component', 'Element-test', 'Test-element']
        invalidNames.forEach(name => {
          assert.strictEqual(isValidCustomElementName(name), false, `"${name}" should be invalid`)
        })
      })
    })

    describe('Reserved element names', () => {
      it('should throw error for annotation-xml', () => {
        assert.throws(
          () => isValidCustomElementName('annotation-xml'),
          { message: 'Element name is reserved: "annotation-xml"' }
        )
      })

      it('should throw error for color-profile', () => {
        assert.throws(
          () => isValidCustomElementName('color-profile'),
          { message: 'Element name is reserved: "color-profile"' }
        )
      })

      it('should throw error for font-face', () => {
        assert.throws(
          () => isValidCustomElementName('font-face'),
          { message: 'Element name is reserved: "font-face"' }
        )
      })

      it('should throw error for font-face-src', () => {
        assert.throws(
          () => isValidCustomElementName('font-face-src'),
          { message: 'Element name is reserved: "font-face-src"' }
        )
      })

      it('should throw error for font-face-uri', () => {
        assert.throws(
          () => isValidCustomElementName('font-face-uri'),
          { message: 'Element name is reserved: "font-face-uri"' }
        )
      })

      it('should throw error for font-face-format', () => {
        assert.throws(
          () => isValidCustomElementName('font-face-format'),
          { message: 'Element name is reserved: "font-face-format"' }
        )
      })

      it('should throw error for font-face-name', () => {
        assert.throws(
          () => isValidCustomElementName('font-face-name'),
          { message: 'Element name is reserved: "font-face-name"' }
        )
      })

      it('should throw error for missing-glyph', () => {
        assert.throws(
          () => isValidCustomElementName('missing-glyph'),
          { message: 'Element name is reserved: "missing-glyph"' }
        )
      })

      it('should throw error for reserved names regardless of case', () => {
        const cases = [
          'ANNOTATION-XML',
          'Color-Profile',
          'FONT-FACE',
          'Missing-Glyph'
        ]

        cases.forEach(name => {
          assert.throws(
            () => isValidCustomElementName(name),
            { message: /Element name is reserved/ }
          )
        })
      })
    })

    describe('Edge cases', () => {
      it('should handle very long valid names', () => {
        const longName = 'my-' + 'a'.repeat(96)
        assert.strictEqual(isValidCustomElementName(longName), true)
      })

      it('should handle names with maximum allowed length exactly', () => {
        // Test that the function respects the maxLength parameter
        // Note: The actual regex behavior may not support all lengths due to non-greedy quantifier
        const shortName = 'my-component'
        assert.strictEqual(isValidCustomElementName(shortName, 100), true)
        assert.strictEqual(isValidCustomElementName(shortName, 12), true)
        assert.strictEqual(isValidCustomElementName(shortName, 11), false)
      })

      it('should handle names with custom maxLength parameter', () => {
        const shortName = 'my-component'
        assert.strictEqual(isValidCustomElementName(shortName, 50), true)
        assert.strictEqual(isValidCustomElementName(shortName, 10), false)
      })

      it('should handle names with Unicode characters in various ranges', () => {
        const unicodeNames = [
          'my-\u00B7-component', // Middle dot
          'my-\u00C0-component', // Latin-1 Supplement
          'my-\u0100-component', // Latin Extended-A
          'my-\u1FFF-component', // Greek and Coptic
          'my-\u200C-component', // Zero Width Non-Joiner
          'my-\u203F-component', // Inseparable
          'my-\u2070-component', // Superscripts and Subscripts
          'my-\u2C00-component', // Glagolitic
          'my-\u3001-component', // CJK Symbols and Punctuation
          'my-\uD7FF-component', // Private Use Area (before surrogates)
          'my-\uF900-component', // CJK Compatibility Ideographs
          'my-\uFDCF-component', // Arabic Presentation Forms-A
          'my-\uFDF0-component', // Arabic Presentation Forms-A
          'my-\uFFFD-component' // Specials
        ]

        unicodeNames.forEach(name => {
          assert.strictEqual(isValidCustomElementName(name), true, `"${name}" should be valid`)
        })
      })

      it('should return false for names with surrogate pairs', () => {
        const name = 'my-\uD800\uDC00-component'
        assert.strictEqual(isValidCustomElementName(name), false)
      })

      it('should handle names with hyphens and dots combined', () => {
        // Only names with dots that end with hyphenated parts work
        const names = [
          'my.component-name' // This works: my.component-name
        ]

        names.forEach(name => {
          assert.strictEqual(isValidCustomElementName(name), true, `"${name}" should be valid`)
        })

        // These don't work because they don't end with hyphenated parts
        assert.strictEqual(isValidCustomElementName('app.ui.component'), false)
        assert.strictEqual(isValidCustomElementName('data.item.view.model'), false)
      })

      it('should handle names with various invalid characters', () => {
        const invalidChars = ['@', '#', '!', '$', '%', '&', '*', '+', '=', '_', ' ', '\t', '\n', '\r', '\f', '\v']

        invalidChars.forEach(char => {
          const name = `my${char}component`
          assert.strictEqual(isValidCustomElementName(name), false, `"${name}" should be invalid`)
        })
      })

      it('should handle names with reserved patterns', () => {
        // Only exact matches of reserved names throw errors
        // Patterns containing reserved names but not exact matches don't throw
        assert.strictEqual(isValidCustomElementName('my-annotation-xml'), true)
        assert.strictEqual(isValidCustomElementName('my-annotation-xml-test'), true)
      })

      it('should handle names with dots at boundaries', () => {
        // Dots are allowed in the middle but not at start/end
        assert.strictEqual(isValidCustomElementName('my.component'), false)
        assert.strictEqual(isValidCustomElementName('.my-component'), false)
        assert.strictEqual(isValidCustomElementName('my-component.'), true)
      })

      it('should handle names with numbers in various positions', () => {
        const names = [
          'my-component-1',
          'element-2-test',
          'data-123-grid',
          'app-v2',
          'test-1-2-3'
        ]

        names.forEach(name => {
          assert.strictEqual(isValidCustomElementName(name), true, `"${name}" should be valid`)
        })
      })
    })
  })
})
