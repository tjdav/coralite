import { describe, it } from 'node:test'
import assert from 'node:assert'
import Coralite from 'coralite'
import myPlugin from '../src/index.js'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixtures = path.join(__dirname, 'fixtures')
const output = path.join(__dirname, 'output')

describe('Smoke Test', () => {
  it('should build the site with the plugin loaded', async () => {
    // Clean output
    if (fs.existsSync(output)) {
      fs.rmSync(output, {
        recursive: true,
        force: true
      })
    }

    const coralite = new Coralite({
      pages: path.join(fixtures, 'pages'),
      templates: path.join(fixtures, 'templates'),
      plugins: [myPlugin]
    })

    await coralite.initialise()
    await coralite.save(output)

    const indexPath = path.join(output, 'index.html')
    assert.ok(fs.existsSync(indexPath), 'index.html should exist')

    const content = fs.readFileSync(indexPath, 'utf-8')
    assert.ok(content.includes('Hello from My Plugin!'), 'Plugin message should be in output')
  })
})
