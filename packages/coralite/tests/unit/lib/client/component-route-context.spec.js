import '../../setup.js'
import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createCoraliteClass } from '#lib/client/element.js'

describe('Client-side Route Context in Component Blocks (lib/client)', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    delete window.__coralite_hydration__
  })

  it('component client receives route read from window.__coralite_hydration__.__route__', async () => {
    window.__coralite_hydration__ = {
      __route__: {
        path: '/posts/42.html',
        pattern: '/posts/[id].html',
        params: { id: '42' },
        dynamic: true
      }
    }

    let receivedRoute = null
    const tag = 'client-route-comp-' + Math.random().toString(36).substring(2, 9)

    const CompClass = createCoraliteClass({
      componentId: 'client-route-comp',
      client: ({ route, root }) => {
        receivedRoute = route
        root.dataset.routePath = route.path
        root.dataset.postId = route.params.id
      }
    })

    customElements.define(tag, CompClass)
    const el = document.createElement(tag)
    document.body.appendChild(el)

    await new Promise(resolve => setTimeout(resolve, 10))

    assert.ok(receivedRoute, 'Component client context should receive route')
    assert.equal(receivedRoute.path, '/posts/42.html')
    assert.equal(receivedRoute.pattern, '/posts/[id].html')
    assert.equal(receivedRoute.params.id, '42')
    assert.equal(receivedRoute.dynamic, true)
    assert.equal(el.dataset.routePath, '/posts/42.html')
    assert.equal(el.dataset.postId, '42')
  })

  it('component getters on client receives route read from window.__coralite_hydration__.__route__', async () => {
    window.__coralite_hydration__ = {
      __route__: {
        path: '/dashboard.html',
        pattern: '/dashboard.html',
        params: {},
        dynamic: false
      }
    }

    let getterRoute = null
    const tag = 'getter-client-route-comp-' + Math.random().toString(36).substring(2, 9)

    const CompClass = createCoraliteClass({
      componentId: 'getter-client-route-comp',
      getters: {
        info: ({ route }) => {
          getterRoute = route
          return route.path
        }
      }
    })

    customElements.define(tag, CompClass)
    const el = document.createElement(tag)
    document.body.appendChild(el)

    assert.equal(el._state.info, '/dashboard.html')
    assert.ok(getterRoute)
    assert.equal(getterRoute.path, '/dashboard.html')
  })

  it('component slots on client receives route', async () => {
    window.__coralite_hydration__ = {
      __route__: {
        path: '/slot-test.html',
        pattern: '/slot-test.html',
        params: {},
        dynamic: false
      }
    }

    let slotRoute = null
    const tag = 'slot-client-route-comp-' + Math.random().toString(36).substring(2, 9)

    const CompClass = createCoraliteClass({
      componentId: 'slot-client-route-comp',
      templateHTML: '<div><slot></slot></div>',
      slots: {
        default: (nodes, { route }) => {
          slotRoute = route
          return nodes
        }
      }
    })

    customElements.define(tag, CompClass)
    const el = document.createElement(tag)
    el.innerHTML = '<p>Child</p>'
    document.body.appendChild(el)

    await new Promise(resolve => setTimeout(resolve, 10))

    assert.ok(slotRoute)
    assert.equal(slotRoute.path, '/slot-test.html')
  })

  it('component provide on client receives route and passes it to context subscribers', async () => {
    window.__coralite_hydration__ = {
      __route__: {
        path: '/provide-client.html',
        pattern: '/provide-client.html',
        params: {},
        dynamic: false
      }
    }

    let provideRoute = null
    const tag = 'provider-client-route-comp-' + Math.random().toString(36).substring(2, 9)

    const ProviderClass = createCoraliteClass({
      componentId: 'provider-client-route-comp',
      provide: {
        'test-key': ({ route }) => {
          provideRoute = route
          return route.path
        }
      }
    })

    customElements.define(tag, ProviderClass)
    const providerEl = document.createElement(tag)
    const childEl = document.createElement('div')
    providerEl.appendChild(childEl)
    document.body.appendChild(providerEl)

    let requestedValue = null
    const event = new CustomEvent('context-request', {
      bubbles: true,
      composed: true,
      detail: {
        context: 'test-key',
        callback: (val) => {
          requestedValue = val
        }
      }
    })
    childEl.dispatchEvent(event)

    assert.ok(provideRoute)
    assert.equal(provideRoute.path, '/provide-client.html')
    assert.equal(requestedValue, '/provide-client.html')
  })
})
