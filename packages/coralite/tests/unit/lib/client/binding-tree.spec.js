/* eslint-disable no-restricted-imports -- Node test runner spec; requires node:* builtins */
import '../../setup.js'
import { describe, it } from 'node:test'
import assert from 'node:assert'
import { createCoraliteClass } from '../../../../lib/client/element.js'

describe('Client Runtime - Single-Pass Binding Resolution via _bindingTree', () => {
  it('populates _bindings in index order using _bindingTree', async () => {
    const ComponentClass = createCoraliteClass({
      componentId: 'binding-tree-test-1',
      defaultValues: {
        title: 'Title',
        attrVal: 'attr'
      },
      hydrationMap: {
        texts: [
          {
            path: [0, 0],
            template: '{{ title }}',
            tokens: ['title'],
            isSingleToken: true,
            singleTokenKey: 'title'
          }
        ],
        attributes: [
          {
            path: [0],
            name: 'data-test',
            template: '{{ attrVal }}',
            tokens: ['attrVal'],
            isSingleToken: true,
            singleTokenKey: 'attrVal'
          }
        ],
        requiredTokens: ['title', 'attrVal']
      },
      _bindingTree: {
        children: {
          0: {
            match: [
              {
                index: 1,
                type: 'attribute',
                name: 'data-test',
                template: '{{ attrVal }}',
                tokens: ['attrVal'],
                isSingleToken: true,
                singleTokenKey: 'attrVal'
              }
            ],
            children: {
              0: {
                match: [
                  {
                    index: 0,
                    type: 'text',
                    template: '{{ title }}',
                    tokens: ['title'],
                    isSingleToken: true,
                    singleTokenKey: 'title'
                  }
                ]
              }
            }
          }
        }
      }
    })

    const tagName = 'binding-tree-test-' + Math.random().toString(36).slice(2)
    customElements.define(tagName, ComponentClass)

    const el = document.createElement(tagName)
    const span = document.createElement('span')
    const text = document.createTextNode('Title')
    span.appendChild(text)
    el.appendChild(span)
    document.body.appendChild(el)

    await el.updateComplete

    assert.strictEqual(el._bindings.length, 2)
    assert.strictEqual(el._bindings[0].type, 'text')
    assert.strictEqual(el._bindings[0].node, text)
    assert.strictEqual(el._bindings[1].type, 'attribute')
    assert.strictEqual(el._bindings[1].node, span)

    document.body.removeChild(el)
  })

  it('resolves text, attribute, and ref bindings at various depths', async () => {
    const ComponentClass = createCoraliteClass({
      componentId: 'binding-tree-test-2',
      defaultValues: {
        heading: 'Header',
        activeClass: 'active',
        label: 'Label'
      },
      hydrationMap: {
        texts: [
          {
            path: [0, 0, 0],
            template: '{{ heading }}',
            tokens: ['heading'],
            isSingleToken: true,
            singleTokenKey: 'heading'
          },
          {
            path: [1, 0],
            template: '{{ label }}',
            tokens: ['label'],
            isSingleToken: true,
            singleTokenKey: 'label'
          }
        ],
        attributes: [
          {
            path: [0],
            name: 'class',
            template: '{{ activeClass }}',
            tokens: ['activeClass'],
            isSingleToken: true,
            singleTokenKey: 'activeClass'
          }
        ],
        refs: [
          {
            path: [1],
            name: 'myRef'
          }
        ]
      },
      _bindingTree: {
        children: {
          0: {
            match: [{
              index: 2,
              type: 'attribute',
              name: 'class',
              template: '{{ activeClass }}',
              tokens: ['activeClass'],
              isSingleToken: true,
              singleTokenKey: 'activeClass'
            }],
            children: {
              0: {
                children: {
                  0: {
                    match: [{
                      index: 0,
                      type: 'text',
                      template: '{{ heading }}',
                      tokens: ['heading'],
                      isSingleToken: true,
                      singleTokenKey: 'heading'
                    }]
                  }
                }
              }
            }
          },
          1: {
            match: [{
              type: 'ref',
              name: 'myRef'
            }],
            children: {
              0: {
                match: [{
                  index: 1,
                  type: 'text',
                  template: '{{ label }}',
                  tokens: ['label'],
                  isSingleToken: true,
                  singleTokenKey: 'label'
                }]
              }
            }
          }
        }
      }
    })

    const tagName = 'binding-tree-test-' + Math.random().toString(36).slice(2)
    customElements.define(tagName, ComponentClass)

    const el = document.createElement(tagName)
    const header = document.createElement('header')
    const h1 = document.createElement('h1')
    const h1Text = document.createTextNode('Header')
    h1.appendChild(h1Text)
    header.appendChild(h1)

    const section = document.createElement('section')
    const secText = document.createTextNode('Label')
    section.appendChild(secText)

    el.appendChild(header)
    el.appendChild(section)
    document.body.appendChild(el)

    await el.updateComplete

    assert.strictEqual(el._bindings[0].node, h1Text)
    assert.strictEqual(el._bindings[1].node, secText)
    assert.strictEqual(el._bindings[2].node, header)
    assert.ok(section.hasAttribute('ref'))

    document.body.removeChild(el)
  })

  it('resolves multiple bindings on the same node correctly', async () => {
    const ComponentClass = createCoraliteClass({
      componentId: 'binding-tree-test-3',
      defaultValues: {
        cName: 'btn',
        titleVal: 'Click'
      },
      hydrationMap: {
        attributes: [
          {
            path: [0],
            name: 'class',
            template: '{{ cName }}',
            tokens: ['cName'],
            isSingleToken: true,
            singleTokenKey: 'cName'
          },
          {
            path: [0],
            name: 'title',
            template: '{{ titleVal }}',
            tokens: ['titleVal'],
            isSingleToken: true,
            singleTokenKey: 'titleVal'
          }
        ]
      },
      _bindingTree: {
        children: {
          0: {
            match: [
              {
                index: 0,
                type: 'attribute',
                name: 'class',
                template: '{{ cName }}',
                tokens: ['cName'],
                isSingleToken: true,
                singleTokenKey: 'cName'
              },
              {
                index: 1,
                type: 'attribute',
                name: 'title',
                template: '{{ titleVal }}',
                tokens: ['titleVal'],
                isSingleToken: true,
                singleTokenKey: 'titleVal'
              }
            ]
          }
        }
      }
    })

    const tagName = 'binding-tree-test-' + Math.random().toString(36).slice(2)
    customElements.define(tagName, ComponentClass)

    const el = document.createElement(tagName)
    const btn = document.createElement('button')
    el.appendChild(btn)
    document.body.appendChild(el)

    await el.updateComplete

    assert.strictEqual(el._bindings[0].node, btn)
    assert.strictEqual(el._bindings[1].node, btn)

    document.body.removeChild(el)
  })

  it('falls back to per-binding walk when compilerOptimizations is "none"', async () => {
    const ComponentClass = createCoraliteClass({
      componentId: 'binding-tree-test-4',
      compilerOptimizations: 'none',
      defaultValues: { count: 1 },
      hydrationMap: {
        texts: [
          {
            path: [0, 0],
            template: '{{ count }}',
            tokens: ['count'],
            isSingleToken: true,
            singleTokenKey: 'count'
          }
        ]
      },
      _bindingTree: {
        children: {
          0: {
            children: {
              0: {
                match: [{
                  index: 0,
                  type: 'text',
                  template: '{{ count }}',
                  tokens: ['count'],
                  isSingleToken: true,
                  singleTokenKey: 'count'
                }]
              }
            }
          }
        }
      }
    })

    const tagName = 'binding-tree-test-' + Math.random().toString(36).slice(2)
    customElements.define(tagName, ComponentClass)

    const el = document.createElement(tagName)
    const textNode = document.createTextNode('1')
    const div = document.createElement('div')
    div.appendChild(textNode)
    el.appendChild(div)
    document.body.appendChild(el)

    await el.updateComplete

    assert.strictEqual(el._bindings[0].node, textNode)

    document.body.removeChild(el)
  })

  it('reads childNodes fewer times during single-pass walk compared to per-binding walk on deep fixture', async () => {
    let singlePassReads = 0
    let perBindingReads = 0

    // Measure reads for single pass
    const SinglePassClass = createCoraliteClass({
      componentId: 'binding-tree-test-5a',
      compilerOptimizations: 'all',
      defaultValues: {
        v1: 'a',
        v2: 'b',
        v3: 'c'
      },
      hydrationMap: {
        texts: [
          {
            path: [0, 0, 0, 0, 0, 0],
            template: '{{ v1 }}',
            tokens: ['v1']
          },
          {
            path: [0, 0, 0, 0, 0, 1],
            template: '{{ v2 }}',
            tokens: ['v2']
          },
          {
            path: [0, 0, 0, 0, 0, 2],
            template: '{{ v3 }}',
            tokens: ['v3']
          }
        ]
      },
      _bindingTree: {
        children: {
          0: {
            children: {
              0: {
                children: {
                  0: {
                    children: {
                      0: {
                        children: {
                          0: {
                            match: [{
                              index: 0,
                              type: 'text',
                              template: '{{ v1 }}',
                              tokens: ['v1']
                            }]
                          },
                          1: {
                            match: [{
                              index: 1,
                              type: 'text',
                              template: '{{ v2 }}',
                              tokens: ['v2']
                            }]
                          },
                          2: {
                            match: [{
                              index: 2,
                              type: 'text',
                              template: '{{ v3 }}',
                              tokens: ['v3']
                            }]
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    })

    const tagA = 'binding-tree-test-5a'
    customElements.define(tagA, SinglePassClass)

    const elA = document.createElement(tagA)
    let curA = elA
    for (let i = 0; i < 5; i++) {
      const child = document.createElement('div')
      curA.appendChild(child)
      curA = child
    }
    const t1 = document.createTextNode('a')
    const t2 = document.createTextNode('b')
    const t3 = document.createTextNode('c')
    curA.appendChild(t1)
    curA.appendChild(t2)
    curA.appendChild(t3)

    // Instrument childNodes getter on deep node
    const originalChildNodesGetter = Object.getOwnPropertyDescriptor(Node.prototype, 'childNodes').get

    Object.defineProperty(elA, 'childNodes', {
      get () {
        singlePassReads++
        return originalChildNodesGetter.call(this)
      },
      configurable: true
    })

    document.body.appendChild(elA)
    await elA.updateComplete

    // Measure reads for per-binding walk
    const PerBindingClass = createCoraliteClass({
      componentId: 'binding-tree-test-5b',
      compilerOptimizations: 'none',
      defaultValues: {
        v1: 'a',
        v2: 'b',
        v3: 'c'
      },
      hydrationMap: {
        texts: [
          {
            path: [0, 0, 0, 0, 0, 0],
            template: '{{ v1 }}',
            tokens: ['v1']
          },
          {
            path: [0, 0, 0, 0, 0, 1],
            template: '{{ v2 }}',
            tokens: ['v2']
          },
          {
            path: [0, 0, 0, 0, 0, 2],
            template: '{{ v3 }}',
            tokens: ['v3']
          }
        ]
      }
    })

    const tagB = 'binding-tree-test-5b'
    customElements.define(tagB, PerBindingClass)

    const elB = document.createElement(tagB)
    let curB = elB
    for (let i = 0; i < 5; i++) {
      const child = document.createElement('div')
      curB.appendChild(child)
      curB = child
    }
    curB.appendChild(document.createTextNode('a'))
    curB.appendChild(document.createTextNode('b'))
    curB.appendChild(document.createTextNode('c'))

    Object.defineProperty(elB, 'childNodes', {
      get () {
        perBindingReads++
        return originalChildNodesGetter.call(this)
      },
      configurable: true
    })

    document.body.appendChild(elB)
    await elB.updateComplete

    assert.ok(singlePassReads < perBindingReads, `singlePassReads (${singlePassReads}) should be less than perBindingReads (${perBindingReads})`)

    document.body.removeChild(elA)
    document.body.removeChild(elB)
  })

  it('works with P3.04 updaters using the resolved _bindings', async () => {
    const ComponentClass = createCoraliteClass({
      componentId: 'binding-tree-test-6',
      defaultValues: { val: 'initial' },
      hydrationMap: {
        texts: [
          {
            path: [0, 0],
            template: '{{ val }}',
            tokens: ['val'],
            isSingleToken: true,
            singleTokenKey: 'val'
          }
        ]
      },
      _bindingTree: {
        children: {
          0: {
            children: {
              0: {
                match: [{
                  index: 0,
                  type: 'text',
                  template: '{{ val }}',
                  tokens: ['val'],
                  isSingleToken: true,
                  singleTokenKey: 'val'
                }]
              }
            }
          }
        }
      },
      _updaters: {
        val () {
          const value = this._stateRaw.val
          const binding = this._bindings[0]
          const node = binding.node
          node.nodeValue = value
        }
      }
    })

    const tagName = 'binding-tree-test-' + Math.random().toString(36).slice(2)
    customElements.define(tagName, ComponentClass)

    const el = document.createElement(tagName)
    const textNode = document.createTextNode('initial')
    const div = document.createElement('div')
    div.appendChild(textNode)
    el.appendChild(div)
    document.body.appendChild(el)

    await el.updateComplete

    el._state.val = 'updated'
    await el.updateComplete

    assert.strictEqual(textNode.nodeValue, 'updated')

    document.body.removeChild(el)
  })
})
