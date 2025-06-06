#!/usr/bin/env node --experimental-vm-modules --experimental-import-meta-resolve

import { getPkg, Coralite } from '#lib'
import { Command } from 'commander'
import { join } from 'node:path'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import kleur from 'kleur'
import { loadConfig } from '../lib/loader.js'

// Remove all Node warnings before doing anything else
process.removeAllListeners('warning')

const pkg = await getPkg()
const program = new Command()
const config = await loadConfig()

program
  .name(pkg.name)
  .description(pkg.description)
  .version(pkg.version)
  .requiredOption('-t, --templates <path>', 'Path to templates directory')
  .requiredOption('-p, --pages <path>', 'Path to pages directory')
  .requiredOption('-o, --output <path>', 'Output directory for the generated site')
  .option('-i, --ignore-attribute <key=value...>', 'Ignore elements by attribute name value pair', [])
  .option('-d, --dry-run', 'Run in dry-run mode')

program.parse(process.argv)
program.on('error', (err) => {
  console.error(err)
})

const options = program.opts()
const pages = options.pages
const output = options.output
const ignoreByAttribute = []

const coraliteOptions = {
  templates: options.templates,
  pages,
  ignoreByAttribute,
  plugins: []
}

for (let i = 0; i < options.ignoreAttribute.length; i++) {
  const pair = options.ignoreAttribute[i].split('=')

  if (pair.length !== 2) {
    throw new Error('Ignore attribute "' + pair[0] + '" expected a value but found none')
  }

  ignoreByAttribute.push({
    name: pair[0],
    value: pair[1]
  })
}

if (config && config.plugins) {
  coraliteOptions.plugins = coraliteOptions.plugins.concat(config.plugins)
}

const coralite = new Coralite(coraliteOptions)
const collection = await coralite.compile()

if (options.dryRun) {
  const PAD = '  '
  const border = '─'.repeat(Math.min(process.stdout.columns, 36) / 2)

  for (let i = 0; i < collection.length; i++) {
    const document = collection[i]

    process.stdout.write('\n' + PAD + kleur.green('Document is ready!\n\n'))
    process.stdout.write(PAD + `${kleur.bold('- Path:')}      ${document.item.path.pathname}\n`)
    process.stdout.write(PAD + `${kleur.bold('- Built in:')}  ${Math.floor(document.duration)}ms\n\n`)
    process.stdout.write(border + kleur.inverse(' Content start ') + border + '\n\n')
    process.stdout.write(document.html)
    process.stdout.write('\n\n' + border + kleur.inverse(' Content end ') + border + '\n')
  }
} else {
  for (let i = 0; i < collection.length; i++) {
    const document = collection[i]
    const dir = join(output, document.item.path.dirname)

    if (!existsSync(dir)) {
      // create directory
      mkdirSync(dir, {
        recursive: true
      })
    }

    writeFileSync(join(output, document.item.path.pathname), document.html)
  }
}
