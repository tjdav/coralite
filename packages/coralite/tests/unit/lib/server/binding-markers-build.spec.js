import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createCoralite } from '#lib'

describe('binding marker build output', () => {
  let testDir
  let componentsDir
  let pagesDir
  let outputDir

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'coralite-binding-markers-'))
    componentsDir = join(testDir, 'components')
    pagesDir = join(testDir, 'pages')
    outputDir = join(testDir, 'dist')

    await mkdir(componentsDir, { recursive: true })
    await mkdir(pagesDir, { recursive: true })
  })

  afterEach(async () => {
    await rm(testDir, {
      recursive: true,
      force: true
    })
  })

  it('stamps binding markers in SSR and matching IDs in the component hydration map', async () => {
    await writeFile(join(componentsDir, 'marker-slot-parent.html'), `<template id="marker-slot-parent">
      <div class="marker-parent">
        <button ref="toggle" aria-pressed="{{ pressed }}">{{ label }}</button>
        <p hidden="{{ hidden }}">{{ status }}</p>
        <slot name="extra"></slot>
      </div>
    </template>
    <script type="module">
      export function server () {
        return { pressed: false, label: 'off', hidden: true, status: 'idle' }
      }
    </script>`)

    await writeFile(join(componentsDir, 'marker-slot-child.html'), `<template id="marker-slot-child">
      <span>{{ childText }}</span>
    </template>
    <script type="module">
      export const getters = {
        childText: () => 'child'
      }
    </script>`)

    await writeFile(join(pagesDir, 'index.html'), '<!DOCTYPE html><html><body><marker-slot-parent data-testid="parent"><marker-slot-child slot="extra"></marker-slot-child></marker-slot-parent></body></html>')

    const app = await createCoralite({
      components: componentsDir,
      pages: pagesDir,
      output: outputDir,
      mode: 'testing',
      incremental: false
    })

    const results = await app.build()
    const html = results[0].content

    assert.match(html, /<marker-slot-parent[^>]+data-cid="marker-slot-parent-0"/)
    assert.match(html, /<button[^>]+data-coralite-bind="[^"]*b[^"]*"[^>]+data-coralite-bind-owner="marker-slot-parent-0"/)
    assert.match(html, /<c-token[^>]+data-coralite-bind="b[^"]*"[^>]+data-coralite-bind-owner="marker-slot-parent-0"/)
    assert.match(html, /<slot name="extra"[^>]+data-coralite-bind="s[^"]*"[^>]+data-coralite-bind-owner="marker-slot-parent-0"/)
    assert.match(html, /<marker-slot-child[^>]+data-cid="marker-slot-child-0"/)
    assert.match(html, /data-coralite-bind-owner="marker-slot-child-0"/)

    const componentBundle = Object.values(app.outputFiles).find(file => {
      return file.text && file.text.includes('"marker-slot-parent"') && file.text.includes('hydrationMap')
    })

    assert.ok(componentBundle, 'component bundle should contain the hydration map')
    assert.match(componentBundle.text, /"version": 2/)
    assert.match(componentBundle.text, /"id": "b\d+"/)
    assert.match(componentBundle.text, /"id": "s\d+"/)
  })
})
