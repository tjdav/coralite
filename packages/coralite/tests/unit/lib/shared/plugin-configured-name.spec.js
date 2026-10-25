import test from 'node:test'
import assert from 'node:assert/strict'
import { definePlugin } from '../../../../lib/shared/define-plugin.js'

test('configured instance preserves explicit server.name', () => {
  const basePlugin = definePlugin({
    name: 'p',
    server: { name: 'custom' }
  })

  const configured = basePlugin({})
  assert.equal(configured.server?.name, 'custom')
})

test('configured instance falls back to plugin name when server.name absent', () => {
  const basePlugin = definePlugin({
    name: 'p',
    server: {}
  })

  const configured = basePlugin({})
  assert.equal(configured.server?.name, 'p')
})

test('configured instance preserves server.name even when config name override present', () => {
  const basePlugin = definePlugin({
    name: 'p',
    server: { name: 'custom' }
  })

  const configured = basePlugin({ name: 'override' })
  assert.equal(configured.name, 'override')
  assert.equal(configured.server?.name, 'custom')
})

test('base plugin path unaffected', () => {
  const basePlugin = definePlugin({
    name: 'p',
    server: { name: 'custom' }
  })

  assert.equal(basePlugin.server?.name, 'custom')
  const configured = basePlugin({})
  assert.equal(basePlugin.server?.name, 'custom')
  assert.equal(configured.server?.name, 'custom')
})

test('no server block still returns undefined server', () => {
  const basePlugin = definePlugin({
    name: 'p'
  })

  const configured = basePlugin({})
  assert.equal(configured.server, undefined)
})

test('call-time name override sets server.name when server block lacks explicit name', () => {
  const basePlugin = definePlugin({
    name: 'p',
    server: {}
  })

  const configured = basePlugin({ name: 'override' })
  assert.equal(configured.name, 'override')
  assert.equal(configured.server?.name, 'override')
})
