import { strictEqual } from 'node:assert'
import { describe, it } from 'node:test'
import { render } from '../lib/component.js'

describe('Component', function () {
  describe('Render', function () {
    it('should process tokens', function () {
      const result = render({
        id: 'custom-element',
        customElements: [],
        content: 'Hello {{ firstname }} {{ lastname }}!',
        tokens: [
          {
            name: 'firstname',
            startIndex: 6,
            endIndex: 21
          },
          {
            name: 'lastname',
            startIndex: 22,
            endIndex: 36
          }
        ],
        computedTokens: () => ({})
      }, {
        firstname: 'Thomas',
        lastname: 'david'
      })

      strictEqual(result, 'Hello Thomas david!')
    })

    it('should process computed tokens', function () {
      const result = render({
        id: 'custom-element',
        customElements: [],
        content: 'Hello {{ firstname }} {{ lastname }}! [{{ date }}]',
        tokens: [
          {
            name: 'firstname',
            startIndex: 6,
            endIndex: 21
          },
          {
            name: 'lastname',
            startIndex: 22,
            endIndex: 36
          },
          {
            name: 'date',
            startIndex: 39,
            endIndex: 49
          }
        ],
        computedTokens: () => ({
          date: 'today'
        })
      }, {
        firstname: 'Thomas',
        lastname: 'david'
      })

      strictEqual(result, 'Hello Thomas david! [today]')
    })
  })
})
