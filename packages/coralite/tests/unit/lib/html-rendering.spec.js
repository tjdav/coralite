import { describe, it, beforeEach, afterEach } from 'node:test'
import { strict as assert } from 'node:assert'
import '../setup.js'
import { createCoraliteClass } from '../../../lib/coralite-element.js'

describe('Coralite HTML Rendering', () => {
  it('should render HTML content when a token contains HTML', async () => {
    const options = {
      componentId: 'test-comp',
      templateHTML: '<c-token>{{ content }}</c-token>',
      hydrationMap: {
        texts: [
          {
            path: [0],
            template: '{{ content }}',
            type: 'html'
          }
        ]
      },
      defaultValues: {
        content: '<span>HTML Content</span>'
      }
    }

    const TestComp = createCoraliteClass(options)
    customElements.define('test-comp', TestComp)

    const el = document.createElement('test-comp')
    document.body.appendChild(el)

    // Wait for microtask (updateDOM)
    await new Promise(resolve => queueMicrotask(resolve))

    const cToken = el.querySelector('c-token')
    assert.ok(cToken, 'c-token should exist')
    assert.strictEqual(cToken.innerHTML, '<span>HTML Content</span>', 'HTML should be rendered as elements, not escaped text')
  })
})
