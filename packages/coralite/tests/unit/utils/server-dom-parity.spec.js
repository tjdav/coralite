import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createCoraliteElement,
  createCoraliteTextNode,
  createCoraliteComment,
  createCoraliteComponent,
  relinkChildren,
  parseHTML,
  CoraliteDocument,
  createVirtualWindow
} from '#lib/utils/server/index.js'

test('Server DOM Parity - Pillar 1: Layout, Geometry & CSSOM Stubs', async (t) => {
  await t.test('getBoundingClientRect and getClientRects return standard rect structure', () => {
    const el = createCoraliteElement({
      type: 'tag',
      name: 'div',
      attribs: { width: '150', height: '300' },
      children: []
    })

    const rect = el.getBoundingClientRect()
    assert.equal(rect.x, 0)
    assert.equal(rect.y, 0)
    assert.equal(rect.top, 0)
    assert.equal(rect.bottom, 300)
    assert.equal(rect.left, 0)
    assert.equal(rect.right, 150)
    assert.equal(rect.width, 150)
    assert.equal(rect.height, 300)
    assert.deepEqual(rect.toJSON(), {
      x: 0,
      y: 0,
      top: 0,
      bottom: 300,
      left: 0,
      right: 150,
      width: 150,
      height: 300
    })

    const rects = el.getClientRects()
    assert.equal(rects.length, 1)
    assert.equal(rects[0].width, 150)
    assert.equal(rects[0].height, 300)
  })

  await t.test('dimension properties parse inline styles or fallback to zero', () => {
    const el = createCoraliteElement({
      type: 'tag',
      name: 'div',
      attribs: { style: 'width: 250px; height: 120.5px;' },
      children: []
    })

    assert.equal(el.offsetWidth, 250)
    assert.equal(el.offsetHeight, 120.5)
    assert.equal(el.clientWidth, 250)
    assert.equal(el.clientHeight, 120.5)
    assert.equal(el.scrollWidth, 250)
    assert.equal(el.scrollHeight, 120.5)
    assert.equal(el.clientTop, 0)
    assert.equal(el.clientLeft, 0)
    assert.equal(el.offsetTop, 0)
    assert.equal(el.offsetLeft, 0)
    assert.equal(el.scrollTop, 0)
    assert.equal(el.scrollLeft, 0)
    assert.equal(el.offsetParent, null)

    // Setter no-ops for scroll properties
    el.scrollTop = 100
    el.scrollLeft = 50
    assert.equal(el.scrollTop, 0)
    assert.equal(el.scrollLeft, 0)
  })

  await t.test('scrolling and focus no-op methods do not throw', () => {
    const el = createCoraliteElement({ type: 'tag', name: 'button', attribs: {}, children: [] })
    assert.doesNotThrow(() => {
      el.scrollIntoView()
      el.scrollTo(0, 0)
      el.scrollBy(0, 10)
      el.focus()
      el.blur()
    })
  })
})

test('Server DOM Parity - Pillar 2: EventTarget Interface & Propagation', async (t) => {
  await t.test('addEventListener, removeEventListener, and single target dispatchEvent', () => {
    const el = createCoraliteElement({ type: 'tag', name: 'div', attribs: {}, children: [] })
    let count = 0
    const handler = (evt) => {
      count++
      assert.equal(evt.target, el)
      assert.equal(evt.currentTarget, el)
    }

    el.addEventListener('click', handler)
    el.dispatchEvent({ type: 'click' })
    assert.equal(count, 1)

    // removeEventListener
    el.removeEventListener('click', handler)
    el.dispatchEvent({ type: 'click' })
    assert.equal(count, 1)
  })

  await t.test('options.once and options.signal options', () => {
    const el = createCoraliteElement({ type: 'tag', name: 'div', attribs: {}, children: [] })
    let onceCount = 0
    let signalCount = 0

    el.addEventListener('custom', () => { onceCount++ }, { once: true })

    const controller = new AbortController()
    el.addEventListener('custom', () => { signalCount++ }, { signal: controller.signal })

    el.dispatchEvent({ type: 'custom' })
    assert.equal(onceCount, 1)
    assert.equal(signalCount, 1)

    // Second dispatch: once listener was removed, signal listener remains
    el.dispatchEvent({ type: 'custom' })
    assert.equal(onceCount, 1)
    assert.equal(signalCount, 2)

    // Abort signal removes listener
    controller.abort()
    el.dispatchEvent({ type: 'custom' })
    assert.equal(signalCount, 2)
  })

  await t.test('event bubbling up ancestor hierarchy when bubbles === true', () => {
    const parent = createCoraliteElement({ type: 'tag', name: 'div', attribs: { id: 'parent' }, children: [] })
    const child = createCoraliteElement({ type: 'tag', name: 'button', attribs: { id: 'child' }, children: [] })
    parent.appendChild(child)

    const order = []
    parent.addEventListener('submit', (e) => {
      order.push(`parent:${e.currentTarget.id}`)
    })
    child.addEventListener('submit', (e) => {
      order.push(`child:${e.currentTarget.id}`)
    })

    child.dispatchEvent({ type: 'submit', bubbles: true })
    assert.deepEqual(order, ['child:child', 'parent:parent'])
  })

  await t.test('stopPropagation and stopImmediatePropagation', () => {
    const parent = createCoraliteElement({ type: 'tag', name: 'div', attribs: {}, children: [] })
    const child = createCoraliteElement({ type: 'tag', name: 'span', attribs: {}, children: [] })
    parent.appendChild(child)

    let parentFired = false
    let childFirstFired = false
    let childSecondFired = false

    parent.addEventListener('test', () => { parentFired = true })
    child.addEventListener('test', (e) => {
      childFirstFired = true
      e.stopImmediatePropagation()
    })
    child.addEventListener('test', () => { childSecondFired = true })

    child.dispatchEvent({ type: 'test', bubbles: true })

    assert.equal(childFirstFired, true)
    assert.equal(childSecondFired, false)
    assert.equal(parentFired, false)
  })
})

test('Server DOM Parity - Pillar 3: Globals (window & document)', async (t) => {
  await t.test('CoraliteDocument instantiates default document structure and element creation', () => {
    const doc = new CoraliteDocument()
    assert.equal(doc.documentElement.name, 'html')
    assert.equal(doc.head.name, 'head')
    assert.equal(doc.body.name, 'body')

    const el = doc.createElement('SECTION')
    assert.equal(el.name, 'section')
    assert.equal(el.nodeType, 1)

    const text = doc.createTextNode('Hello Coralite')
    assert.equal(text.data, 'Hello Coralite')
    assert.equal(text.nodeType, 3)

    const comment = doc.createComment('Server Comment')
    assert.equal(comment.data, 'Server Comment')
    assert.equal(comment.nodeType, 8)

    const frag = doc.createDocumentFragment()
    assert.equal(frag.type, 'root')
  })

  await t.test('createVirtualWindow constructs isomorphic global environment', () => {
    const win = createVirtualWindow({ page: { route: '/about' } })
    assert.equal(win.window, win)
    assert.equal(win.self, win)
    assert.equal(win.location.pathname, '/about')
    assert.equal(typeof win.requestAnimationFrame, 'function')

    const media = win.matchMedia('(min-width: 768px)')
    assert.equal(media.matches, false)
    assert.equal(media.media, '(min-width: 768px)')

    const customEvent = new win.CustomEvent('build', { detail: { ok: true } })
    assert.equal(customEvent.type, 'build')
    assert.deepEqual(customEvent.detail, { ok: true })
  })
})

test('Server DOM Parity - Pillar 4: Core DOM Tree & Manipulation APIs', async (t) => {
  await t.test('innerHTML getter and setter AST synchronization', () => {
    const el = createCoraliteElement({ type: 'tag', name: 'div', attribs: {}, children: [] })
    el.innerHTML = '<p class="lead">Isomorphic <span>Content</span></p>'

    assert.equal(el.children.length, 1)
    const p = el.children[0]
    assert.equal(p.name, 'p')
    assert.equal(p.attribs.class, 'lead')
    assert.equal(p.children.length, 2)
    assert.equal(p.children[0].data, 'Isomorphic ')
    assert.equal(p.children[1].name, 'span')
    assert.equal(p.children[1].textContent, 'Content')

    assert.equal(el.innerHTML, '<p class="lead">Isomorphic <span>Content</span></p>')
  })

  await t.test('outerHTML getter and setter AST synchronization', () => {
    const parent = createCoraliteElement({ type: 'tag', name: 'div', attribs: { id: 'container' }, children: [] })
    const oldChild = createCoraliteElement({ type: 'tag', name: 'span', attribs: { id: 'target' }, children: [] })
    parent.appendChild(oldChild)

    assert.equal(oldChild.outerHTML, '<span id="target"></span>')

    oldChild.outerHTML = '<h2>Headline</h2><p>Paragraph</p>'

    assert.equal(parent.children.length, 2)
    assert.equal(parent.children[0].name, 'h2')
    assert.equal(parent.children[1].name, 'p')
    assert.equal(parent.innerHTML, '<h2>Headline</h2><p>Paragraph</p>')
  })

  await t.test('dataset 2-way camelCase proxy', () => {
    const el = createCoraliteElement({ type: 'tag', name: 'div', attribs: { 'data-user-id': '42' }, children: [] })

    assert.equal(el.dataset.userId, '42')

    el.dataset.userRole = 'admin'
    assert.equal(el.getAttribute('data-user-role'), 'admin')

    delete el.dataset.userId
    assert.equal(el.hasAttribute('data-user-id'), false)
    assert.equal(el.dataset.userId, undefined)
  })

  await t.test('style object 2-way proxy with setProperty/getPropertyValue/removeProperty/cssText', () => {
    const el = createCoraliteElement({ type: 'tag', name: 'div', attribs: { style: 'color: red; margin-top: 10px;' }, children: [] })

    assert.equal(el.style.color, 'red')
    assert.equal(el.style.marginTop, '10px')
    assert.equal(el.style.getPropertyValue('margin-top'), '10px')

    el.style.backgroundColor = 'blue'
    assert.equal(el.getAttribute('style'), 'color: red; margin-top: 10px; background-color: blue;')

    el.style.removeProperty('color')
    assert.equal(el.getAttribute('style'), 'margin-top: 10px; background-color: blue;')

    el.style.cssText = 'padding: 5px;'
    assert.equal(el.getAttribute('style'), 'padding: 5px;')
    assert.equal(el.style.padding, '5px')
  })

  await t.test('element-only child and sibling traversal', () => {
    const root = createCoraliteElement({ type: 'tag', name: 'div', attribs: {}, children: [] })
    const text1 = createCoraliteTextNode({ type: 'text', data: 'Head text' })
    const child1 = createCoraliteElement({ type: 'tag', name: 'h1', attribs: { id: 'c1' }, children: [] })
    const text2 = createCoraliteTextNode({ type: 'text', data: 'Middle text' })
    const child2 = createCoraliteElement({ type: 'tag', name: 'p', attribs: { id: 'c2' }, children: [] })

    root.appendChild(text1)
    root.appendChild(child1)
    root.appendChild(text2)
    root.appendChild(child2)

    assert.equal(root.children.length, 4) // childNodes contain all nodes
    assert.equal(root.childElementCount, 2)
    assert.equal(root.firstElementChild.id, 'c1')
    assert.equal(root.lastElementChild.id, 'c2')

    assert.equal(child1.nextElementSibling.id, 'c2')
    assert.equal(child2.previousElementSibling.id, 'c1')
  })

  await t.test('replaceChildren, replaceWith, before, after, prepend, contains, cloneNode', () => {
    const parent = createCoraliteElement({ type: 'tag', name: 'ul', attribs: {}, children: [] })
    const li1 = createCoraliteElement({ type: 'tag', name: 'li', attribs: { id: 'l1' }, children: [] })
    const li2 = createCoraliteElement({ type: 'tag', name: 'li', attribs: { id: 'l2' }, children: [] })
    parent.appendChild(li1)
    parent.appendChild(li2)

    // prepend
    parent.prepend('First String', createCoraliteElement({ type: 'tag', name: 'li', attribs: { id: 'l0' }, children: [] }))
    assert.equal(parent.firstElementChild.id, 'l0')

    // contains
    assert.equal(parent.contains(li2), true)

    // before / after
    const extra = createCoraliteElement({ type: 'tag', name: 'li', attribs: { id: 'l1.5' }, children: [] })
    li1.after(extra)
    assert.equal(li1.nextElementSibling.id, 'l1.5')

    // replaceWith
    const replacement = createCoraliteElement({ type: 'tag', name: 'li', attribs: { id: 'replaced' }, children: [] })
    extra.replaceWith(replacement)
    assert.equal(li1.nextElementSibling.id, 'replaced')

    // replaceChildren
    parent.replaceChildren(createCoraliteElement({ type: 'tag', name: 'li', attribs: { id: 'only' }, children: [] }))
    assert.equal(parent.childElementCount, 1)
    assert.equal(parent.firstElementChild.id, 'only')

    // cloneNode
    const clone = parent.cloneNode(true)
    assert.equal(clone.name, 'ul')
    assert.equal(clone.firstElementChild.id, 'only')
    assert.notEqual(clone, parent)
  })

  await t.test('form control properties (value, checked, disabled)', () => {
    const input = createCoraliteElement({ type: 'tag', name: 'input', attribs: { type: 'checkbox', value: 'on' }, children: [] })
    assert.equal(input.value, 'on')
    assert.equal(input.checked, false)
    assert.equal(input.disabled, false)

    input.checked = true
    input.disabled = true
    assert.equal(input.hasAttribute('checked'), true)
    assert.equal(input.hasAttribute('disabled'), true)
    assert.equal(input.checked, true)

    input.checked = false
    assert.equal(input.hasAttribute('checked'), false)
  })

  await t.test('selector matching query methods (querySelector, querySelectorAll, matches, closest)', () => {
    const root = parseHTML(`
      <main id="app" class="wrapper">
        <section class="card active" data-role="primary">
          <h1 id="title" class="head">Welcome</h1>
          <button class="btn btn-submit" disabled>Submit</button>
        </section>
      </main>
    `).root

    const title = root.querySelector('#title')
    assert.equal(title.name, 'h1')
    assert.equal(title.textContent, 'Welcome')

    const card = title.closest('.card')
    assert.equal(card.getAttribute('data-role'), 'primary')

    assert.equal(title.matches('h1.head#title'), true)
    assert.equal(title.matches('h1.wrong'), false)

    const buttons = root.querySelectorAll('button[disabled]')
    assert.equal(buttons.length, 1)
    assert.equal(buttons[0].getAttribute('class'), 'btn btn-submit')

    const byClass = root.getElementsByClassName('card active')
    assert.equal(byClass.length, 1)

    const byTag = root.getElementsByTagName('button')
    assert.equal(byTag.length, 1)

    const byId = root.getElementById('app')
    assert.equal(byId.name, 'main')
  })
})
