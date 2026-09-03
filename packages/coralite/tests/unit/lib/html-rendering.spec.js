import { describe, it } from 'node:test'
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

    const tagName = 'html-rendering-test-' + Math.random().toString(36).substring(2, 9)
    const TestComp = createCoraliteClass(options)
    customElements.define(tagName, TestComp)

    const el = document.createElement(tagName)
    document.body.appendChild(el)

    // Wait for microtask (updateDOM)
    await new Promise(resolve => queueMicrotask(resolve))

    const cToken = el.querySelector('c-token')
    assert.ok(cToken, 'c-token should exist')
    assert.strictEqual(cToken.innerHTML, '<span>HTML Content</span>', 'HTML should be rendered as elements, not escaped text')
  })

  it('should preserve and format core ARIA state attributes in client DOM rendering', async () => {
    const options = {
      componentId: 'aria-comp',
      templateHTML: '<button aria-expanded="{{ isExpanded }}" aria-pressed="{{ isPressed }}" aria-checked="{{ isChecked }}" aria-selected="{{ isSelected }}"></button>',
      hydrationMap: {
        attributes: [
          { name: 'aria-expanded', path: [0], template: '{{ isExpanded }}' },
          { name: 'aria-pressed', path: [0], template: '{{ isPressed }}' },
          { name: 'aria-checked', path: [0], template: '{{ isChecked }}' },
          { name: 'aria-selected', path: [0], template: '{{ isSelected }}' }
        ]
      },
      defaultValues: {
        isExpanded: false,
        isPressed: 'false',
        isChecked: 'mixed',
        isSelected: null
      }
    }

    const tagName = 'aria-rendering-test-' + Math.random().toString(36).substring(2, 9)
    const TestComp = createCoraliteClass(options)
    customElements.define(tagName, TestComp)

    const el = document.createElement(tagName)
    document.body.appendChild(el)

    await new Promise(resolve => queueMicrotask(resolve))

    const btn = el.querySelector('button')
    assert.ok(btn)
    assert.strictEqual(btn.getAttribute('aria-expanded'), 'false')
    assert.strictEqual(btn.getAttribute('aria-pressed'), 'false')
    assert.strictEqual(btn.getAttribute('aria-checked'), 'mixed')
    assert.strictEqual(btn.hasAttribute('aria-selected'), false)

    // State update test
    el._state.isExpanded = true
    el._state.isPressed = true
    el._state.isChecked = false
    el._state.isSelected = true

    await new Promise(resolve => queueMicrotask(resolve))

    assert.strictEqual(btn.getAttribute('aria-expanded'), 'true')
    assert.strictEqual(btn.getAttribute('aria-pressed'), 'true')
    assert.strictEqual(btn.getAttribute('aria-checked'), 'false')
    assert.strictEqual(btn.getAttribute('aria-selected'), 'true')

    // Nullish removal test
    el._state.isExpanded = null
    el._state.isPressed = undefined
    el._state.isChecked = ''

    await new Promise(resolve => queueMicrotask(resolve))

    assert.strictEqual(btn.hasAttribute('aria-expanded'), false)
    assert.strictEqual(btn.hasAttribute('aria-pressed'), false)
    assert.strictEqual(btn.hasAttribute('aria-checked'), false)
  })
})
