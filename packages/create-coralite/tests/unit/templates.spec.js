import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const templatesDir = path.resolve(__dirname, '../../templates')

describe('create-coralite template package declarations', () => {
  const templates = readdirSync(templatesDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory() && dirent.name !== 'agent')
    .map(dirent => dirent.name)

  it('has valid template directories', () => {
    assert.ok(templates.length > 0, 'Templates directory should contain templates')
    assert.ok(templates.includes('css'), 'Must include css template')
    assert.ok(templates.includes('scss'), 'Must include scss template')
  })

  for (const templateName of templates) {
    describe(`template: ${templateName}`, () => {
      const templatePath = path.join(templatesDir, templateName)
      const pkgPath = path.join(templatePath, 'package.json')
      const jsconfigPath = path.join(templatePath, 'jsconfig.json')
      const configPath = path.join(templatePath, 'coralite.config.js')

      it('declares coralite in devDependencies of package.json', () => {
        assert.ok(existsSync(pkgPath), `package.json must exist in ${templateName}`)
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))

        assert.ok(pkg.devDependencies, `devDependencies must be defined in ${templateName}/package.json`)
        assert.ok(pkg.devDependencies.coralite, `coralite must be in devDependencies of ${templateName}`)
        assert.match(pkg.devDependencies.coralite, /^\^?1\./, 'coralite version must match current release series')
      })

      it('contains valid jsconfig.json with nodenext module resolution', () => {
        assert.ok(existsSync(jsconfigPath), `jsconfig.json must exist in ${templateName}`)
        const jsconfig = JSON.parse(readFileSync(jsconfigPath, 'utf8'))
        assert.strictEqual(jsconfig.compilerOptions?.moduleResolution, 'nodenext')
      })

      it('contains coralite.config.js configuration file', () => {
        assert.ok(existsSync(configPath), `coralite.config.js must exist in ${templateName}`)
      })

      it('contains AGENTS.md and README.md with deploying guidance', () => {
        const agentsPath = path.join(templatePath, 'AGENTS.md')
        const readmePath = path.join(templatePath, 'README.md')

        assert.ok(existsSync(agentsPath), `AGENTS.md must exist in ${templateName}`)
        assert.ok(existsSync(readmePath), `README.md must exist in ${templateName}`)

        const agents = readFileSync(agentsPath, 'utf8')
        assert.match(agents, /defineComponent/, 'AGENTS.md must mention defineComponent')
        assert.match(agents, /definePage/, 'AGENTS.md must mention definePage')
        assert.match(agents, /Serialization boundary/, 'AGENTS.md must mention Serialization boundary')

        const readme = readFileSync(readmePath, 'utf8')
        assert.match(readme, /# \{\{\s*name\s*\}\}/, 'README.md must contain project name placeholder')
        assert.match(readme, /## Deploying/, 'README.md must contain Deploying section')
        assert.match(readme, /clean by default/, 'README.md must describe cleanUrls behavior')
      })
    })
  }
})
