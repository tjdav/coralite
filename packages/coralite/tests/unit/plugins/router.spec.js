
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import routerPlugin, { routerPlugin as namedRouterPlugin } from '#plugins/router'

describe('Router Plugin Skeleton', () => {
  it('exports plugin instance with correct name and defaults', () => {
    assert.strictEqual(routerPlugin.name, 'router')
    assert.strictEqual(namedRouterPlugin, routerPlugin)

    const instance = routerPlugin()
    assert.strictEqual(instance.name, 'router')
    assert.strictEqual(instance.config.base, '/')
    assert.strictEqual(instance.config.outlet, 'data-router-outlet')
  })

  it('validates config schema for base and outlet', () => {
    const configured = routerPlugin({
      base: '/app',
      outlet: 'data-custom-outlet'
    })

    assert.strictEqual(configured.config.base, '/app')
    assert.strictEqual(configured.config.outlet, 'data-custom-outlet')
  })

  it('throws error when config receives invalid types', () => {
    assert.throws(() => {
      routerPlugin({
        base: 123
      })
    }, /Invalid config value for "base"/)

    assert.throws(() => {
      routerPlugin({
        outlet: true
      })
    }, /Invalid config value for "outlet"/)
  })

  it('registers the outlet component in server.components', () => {
    assert.ok(Array.isArray(routerPlugin.server.components))
    assert.strictEqual(routerPlugin.server.components.length, 1)
    const componentItem = routerPlugin.server.components[0]
    assert.ok(componentItem && componentItem.path)
    assert.strictEqual(componentItem.virtual, true)
    assert.strictEqual(componentItem.content, '<template id="router-outlet"><slot></slot></template>')
    assert.strictEqual(componentItem.path.filename, 'outlet.html')
  })
})
