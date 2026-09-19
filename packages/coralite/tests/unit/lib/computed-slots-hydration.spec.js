import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Window } from 'happy-dom'
import { assertSameNodes } from '../helpers.js'

let window
let document
let customElements
let HTMLElement

function setupDOM () {
  const dom = new Window()
  window = dom.window
  document = dom.document
  customElements = window.customElements
  HTMLElement = window.HTMLElement

  globalThis.window = window
  globalThis.document = document
  globalThis.customElements = customElements
  globalThis.HTMLElement = HTMLElement
  globalThis.Node = window.Node
  globalThis.MutationObserver = window.MutationObserver
  globalThis.CustomEvent = window.CustomEvent
}

test('Computed Slots Hydration & Input Parity', async (t) => {
  setupDOM()

  const { CoraliteElement, createCoraliteClass } = await import('../../../lib/coralite-element.js')

  await t.test('1. Double Transformation Prevention: Non-idempotent slot function preserves SSR output on hydration', async () => {
    const componentId = 'non-idempotent-comp'
    const options = {
      componentId,
      defaultValues: {},
      slots: {
        default: (nodes) => {
          const text = nodes.map(n => n.textContent || n.data || '').join('')
          return text + '!'
        }
      }
    }

    const CompClass = createCoraliteClass(options)
    if (!customElements.get(componentId)) {
      customElements.define(componentId, CompClass)
    }

    // SSR rendered container with data-coralite-slot-computed
    const host = document.createElement(componentId)
    host.setAttribute('data-cid', `${componentId}-0`)
    host.setAttribute('data-coralite-initial', '')

    const slotEl = document.createElement('slot')
    slotEl.setAttribute('data-coralite-owner', `${componentId}-0`)
    slotEl.setAttribute('data-coralite-slot-computed', '')
    slotEl.textContent = 'Hello!' // Server output of transform('Hello')

    host.appendChild(slotEl)
    document.body.appendChild(host)

    // Post-hydration assertion: slot content should remain 'Hello!', not 'Hello!!'
    assert.equal(slotEl.textContent, 'Hello!')
    assert.equal(slotEl._slotEvaluated, true)

    document.body.removeChild(host)
  })

  await t.test('2. Fallback Branch Selection Parity: Fallback computed slot uses [] on client hydration and re-evaluation', async () => {
    const componentId = 'fallback-check-comp'
    let lastNodesLength = null

    const options = {
      componentId,
      defaultValues: { count: 0 },
      slots: {
        default: (nodes) => {
          lastNodesLength = nodes.length
          return (!nodes || nodes.length === 0) ? 'Computed Fallback' : 'Light DOM Content'
        }
      }
    }

    const CompClass = createCoraliteClass(options)
    if (!customElements.get(componentId)) {
      customElements.define(componentId, CompClass)
    }

    // SSR output for fallback slot (no light DOM)
    const host = document.createElement(componentId)
    host.setAttribute('data-cid', `${componentId}-0`)

    const slotEl = document.createElement('slot')
    slotEl.setAttribute('data-coralite-owner', `${componentId}-0`)
    slotEl.setAttribute('data-coralite-slot-computed', '')
    slotEl.setAttribute('data-coralite-fallback', '')
    slotEl.textContent = 'Computed Fallback'

    host.appendChild(slotEl)
    document.body.appendChild(host)

    // Initial hydration bypass check
    assert.equal(slotEl.textContent, 'Computed Fallback')
    assertSameNodes(slotEl._originalNodes, [])

    // Trigger reactive mutation to force slot re-evaluation
    host._state.count++
    await new Promise(resolve => queueMicrotask(resolve))

    assert.equal(lastNodesLength, 0)
    assert.equal(slotEl.textContent, 'Computed Fallback')

    document.body.removeChild(host)
  })

  await t.test('3. Client State Mutation: Re-evaluates slot function using pristine _originalNodes', async () => {
    const componentId = 'reactive-slot-comp'
    const options = {
      componentId,
      defaultValues: { prefix: 'Item' },
      slots: {
        default: (nodes, { state }) => {
          const raw = nodes.map(n => n.textContent || '').join('').trim()
          return `${state.prefix}: ${raw}`
        }
      }
    }

    const CompClass = createCoraliteClass(options)
    if (!customElements.get(componentId)) {
      customElements.define(componentId, CompClass)
    }

    const host = document.createElement(componentId)
    host.setAttribute('data-cid', `${componentId}-0`)

    const slotEl = document.createElement('slot')
    slotEl.setAttribute('data-coralite-owner', `${componentId}-0`)
    slotEl.setAttribute('data-coralite-slot-computed', '')

    const lightChild = document.createElement('span')
    lightChild.setAttribute('data-coralite-slot-index', '0')
    lightChild.textContent = 'Apple'
    slotEl.appendChild(lightChild)

    host.appendChild(slotEl)
    document.body.appendChild(host)

    // SSR initial state output is 'Item: Apple'
    // On hydration, initial execution is bypassed
    assert.equal(slotEl.childNodes.length, 1)

    // Mutate state
    host._state.prefix = 'Fruit'
    await new Promise(resolve => queueMicrotask(resolve))

    // Re-evaluated with pristine lightChild input ('Apple')
    assert.equal(slotEl.textContent, 'Fruit: Apple')

    document.body.removeChild(host)
  })

  await t.test('4. Multi-Slot Isolation: Mixed computed slots (fallback, transformed, bypassed) execute independently without bleed', async () => {
    const componentId = 'multi-slot-comp'
    const options = {
      componentId,
      defaultValues: { tag: 'BADGE' },
      slots: {
        header: (nodes) => {
          return (!nodes || nodes.length === 0) ? 'Default Header' : nodes
        },
        body: (nodes, { state }) => {
          const content = nodes.map(n => n.textContent || '').join('')
          return `[${state.tag}] ${content}`
        }
      }
    }

    const CompClass = createCoraliteClass(options)
    if (!customElements.get(componentId)) {
      customElements.define(componentId, CompClass)
    }

    const host = document.createElement(componentId)
    host.setAttribute('data-cid', `${componentId}-0`)

    // Slot 1: header (fallback)
    const headerSlot = document.createElement('slot')
    headerSlot.setAttribute('name', 'header')
    headerSlot.setAttribute('data-coralite-owner', `${componentId}-0`)
    headerSlot.setAttribute('data-coralite-slot-computed', '')
    headerSlot.setAttribute('data-coralite-fallback', '')
    headerSlot.textContent = 'Default Header'

    // Slot 2: body (transformed)
    const bodySlot = document.createElement('slot')
    bodySlot.setAttribute('name', 'body')
    bodySlot.setAttribute('data-coralite-owner', `${componentId}-0`)
    bodySlot.setAttribute('data-coralite-slot-computed', '')

    const bodyChild = document.createElement('span')
    bodyChild.setAttribute('data-coralite-slot-index', '0')
    bodyChild.textContent = 'Main Content'
    bodySlot.appendChild(bodyChild)

    host.appendChild(headerSlot)
    host.appendChild(bodySlot)
    document.body.appendChild(host)

    // Verify initial hydration bypass and originalNodes isolation
    assertSameNodes(headerSlot._originalNodes, [])
    assert.equal(headerSlot.textContent, 'Default Header')
    assert.equal(bodySlot.textContent, 'Main Content')

    // Mutate state to re-evaluate
    host._state.tag = 'INFO'
    await new Promise(resolve => queueMicrotask(resolve))

    assert.equal(headerSlot.textContent, 'Default Header')
    assert.equal(bodySlot.textContent, '[INFO] Main Content')

    document.body.removeChild(host)
  })
})
