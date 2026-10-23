import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { createCoralite } from '#lib'

let TEST_DIR
let COMPONENTS_DIR
let PAGES_DIR
let OUTPUT_DIR

function parseHydrationPayload (html) {
  const prefix = 'window.__coralite_hydration__ = window.__coralite_hydration__ || '
  const startIdx = html.indexOf(prefix)
  assert.notEqual(startIdx, -1, 'Hydration payload assignment should be found in HTML')
  const jsonStart = startIdx + prefix.length
  const jsonEnd = html.indexOf(';\n  window.__coralite_page_config__', jsonStart)
  const jsonStr = html.slice(jsonStart, jsonEnd !== -1 ? jsonEnd : html.indexOf(';', jsonStart))
  return Function(`return ${jsonStr}`)()
}

describe('Hydration Payload viewTransitions Serialization', () => {
  beforeEach(async () => {
    TEST_DIR = await mkdtemp(join(tmpdir(), 'coralite-vt-serialization-'))
    COMPONENTS_DIR = join(TEST_DIR, 'components')
    PAGES_DIR = join(TEST_DIR, 'pages')
    OUTPUT_DIR = join(TEST_DIR, 'dist')

    await mkdir(COMPONENTS_DIR, { recursive: true })
    await mkdir(PAGES_DIR, { recursive: true })
    await mkdir(OUTPUT_DIR, { recursive: true })

    await writeFile(
      join(COMPONENTS_DIR, 'dummy-comp.html'),
      `<template id="dummy-comp">
        <div>Dummy</div>
      </template>
      <script type="module">
        import { defineComponent } from 'coralite'
        export default defineComponent({
          client: ({ state }) => {}
        })
      </script>`
    )

    await writeFile(
      join(PAGES_DIR, 'index.html'),
      `<!DOCTYPE html>
<html>
<head><title>Test Page</title></head>
<body>
  <dummy-comp></dummy-comp>
</body>
</html>`
    )
  })

  afterEach(async () => {
    await rm(TEST_DIR, {
      recursive: true,
      force: true
    })
  })

  it('serializes viewTransitions: true', async () => {
    const coralite = await createCoralite({
      components: COMPONENTS_DIR,
      pages: PAGES_DIR,
      output: OUTPUT_DIR,
      mode: 'production',
      incremental: false,
      viewTransitions: true
    })

    const results = await coralite.build()
    assert.equal(results.length, 1)

    const payload = parseHydrationPayload(results[0].content)
    assert.strictEqual(payload.viewTransitions, true)
  })

  it('serializes viewTransitions: false', async () => {
    const coralite = await createCoralite({
      components: COMPONENTS_DIR,
      pages: PAGES_DIR,
      output: OUTPUT_DIR,
      mode: 'production',
      incremental: false,
      viewTransitions: false
    })

    const results = await coralite.build()
    assert.equal(results.length, 1)

    const payload = parseHydrationPayload(results[0].content)
    assert.strictEqual(payload.viewTransitions, false)
  })

  it('defaults viewTransitions to true', async () => {
    const coralite = await createCoralite({
      components: COMPONENTS_DIR,
      pages: PAGES_DIR,
      output: OUTPUT_DIR,
      mode: 'production',
      incremental: false
    })

    const results = await coralite.build()
    assert.equal(results.length, 1)

    const payload = parseHydrationPayload(results[0].content)
    assert.strictEqual(payload.viewTransitions, true)
  })
})
