import { describe, it, beforeEach, afterEach } from 'node:test'
import { strict as assert } from 'node:assert'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { createTestProject } from '../utils/project.js'
import { definePlugin } from '../../../lib/server/plugin/define.js'

const pageSource = `<!DOCTYPE html>
<html lang="en"><head><title>{{ title }}</title></head><body><h1>{{ title }}</h1></body></html>
<script type="module">
  export async function paths () {
    return [{ lang: 'en' }, { lang: 'fr' }]
  }

  export function server ({ route }) {
    return { title: route.params.lang }
  }
</script>`

describe('Locale config chunks', () => {
  let project

  beforeEach(async () => {
    project = await createTestProject()
    await mkdir(join(project.pagesDir, '[lang]'), { recursive: true })
    await project.writePage('[lang]/index.html', pageSource)
  })

  afterEach(async () => {
    await project.cleanup()
  })

  it('isolates dictionary edits to the affected locale', async () => {
    const locales = {
      en: { welcome: 'Welcome' },
      fr: { welcome: 'Bienvenue' }
    }
    const plugin = definePlugin({
      name: 'i18n-test',
      client: {
        config: { locales },
        init: () => {
        }
      }
    })
    const coralite = await project.createCoralite({
      plugins: [plugin],
      output: undefined,
      i18n: {
        locales: ['en', 'fr'],
        defaultLocale: 'en'
      }
    })

    const first = await coralite.build()
    assert.equal(first.length, 2)
    const enChunk = first.find(result => result.route.params.lang === 'en').localeChunk
    const frChunk = first.find(result => result.route.params.lang === 'fr').localeChunk
    assert.ok(enChunk && frChunk)
    assert.notEqual(enChunk, frChunk)
    assert.ok(Object.keys(coralite.outputFiles).some(path => path.endsWith(enChunk)))
    assert.ok(first[0].content.includes(`assets/js/${enChunk}`))
    assert.ok(first[0].content.includes('localePluginConfig'))

    const warm = await coralite.build()
    assert.ok(warm.every(result => result.status === 'skipped'))

    locales.fr.welcome = 'Bienvenue !'
    const changed = await coralite.build()
    const en = changed.find(result => result.route.params.lang === 'en')
    const fr = changed.find(result => result.route.params.lang === 'fr')
    assert.equal(en.status, 'skipped')
    assert.ok(Object.keys(coralite.outputFiles).some(path => path.endsWith(enChunk)))
    assert.equal(fr.status, undefined)
    assert.notEqual(fr.localeChunk, frChunk)
  })

  it('leaves the runtime config untouched when i18n is not enabled', async () => {
    const plugin = definePlugin({
      name: 'i18n-test',
      client: {
        config: { welcome: 'Welcome' },
        init: () => {
        }
      }
    })
    const coralite = await project.createCoralite({
      plugins: [plugin],
      output: undefined
    })
    const results = await coralite.build()

    assert.ok(results.every(result => !result.localeChunk))
    assert.ok(Object.keys(coralite.outputFiles).every(path => !path.includes('/locale-')))
  })
})
