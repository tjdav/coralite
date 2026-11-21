import { describe, it, beforeEach, afterEach } from 'node:test'
import { strict as assert } from 'node:assert'
import { join } from 'node:path'
import { mkdir } from 'node:fs/promises'
import { createTestProject } from '../utils/project.js'

function dynamicPage () {
  return `<!DOCTYPE html>
<html><body><h1>{{ id }}</h1></body></html>
<script type="module">
  export function paths () {
    return [{ id: 'one' }, { id: 'two' }, { id: 'three' }]
  }
  export function server ({ route }) {
    return { id: route.params.id }
  }
</script>`
}

describe('Dynamic path build filter', () => {
  let project
  let sourcePath

  beforeEach(async () => {
    project = await createTestProject()
    await project.writePage('index.html', '<h1>Home</h1>')
    await mkdir(join(project.pagesDir, 'posts'), { recursive: true })
    sourcePath = await project.writePage('posts/[id].html', dynamicPage())
  })

  afterEach(async () => {
    await project.cleanup()
  })

  it('renders no dynamic outputs when dynamicPaths is empty', async () => {
    const app = await project.createCoralite({ output: undefined })
    const results = await app.build(null, { dynamicPaths: [] })

    assert.equal(results.length, 1)
    assert.ok(results[0].path.pathname.endsWith('index.html'))
    assert.equal(results.some(result => result.route?.dynamic), false)
  })

  it('renders only the requested dynamic param set', async () => {
    const app = await project.createCoralite({ output: undefined })
    const results = await app.build(sourcePath, { dynamicPaths: [{ id: 'two' }] })

    assert.equal(results.length, 1)
    assert.deepEqual(results[0].route.params, { id: 'two' })
    assert.ok(results[0].content.includes('two'))
  })

  it('renders every dynamic output without a filter', async () => {
    const app = await project.createCoralite({ output: undefined })
    const results = await app.build()

    const dynamicResults = results.filter(result => result.route?.dynamic)
    assert.equal(dynamicResults.length, 3)
  })
})
