import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import { createCoralite } from 'coralite'
import myPlugin from '../src/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixtures = path.join(__dirname, 'fixtures')
const output = path.join(__dirname, 'output')

describe('Plugin Smoke Test', () => {
  it('builds a site with the plugin loaded and renders plugin data', async () => {
    if (fs.existsSync(output)) {
      fs.rmSync(output, {
        recursive: true,
        force: true
      })
    }

    try {
      const coralite = await createCoralite({
        pages: path.join(fixtures, 'pages'),
        components: path.join(fixtures, 'components'),
        output,
        plugins: [myPlugin]
      })

      await coralite.save()

      const indexPath = path.join(output, 'index.html')
      assert.ok(fs.existsSync(indexPath), 'index.html should exist in output')

      const content = fs.readFileSync(indexPath, 'utf-8')
      assert.ok(content.includes('Hello from Coralite Plugin!'), 'Plugin message should be rendered in output HTML')
    } finally {
      if (fs.existsSync(output)) {
        fs.rmSync(output, {
          recursive: true,
          force: true
        })
      }
    }
  })
})
