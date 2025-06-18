#!/usr/bin/env -S node --experimental-vm-modules --experimental-import-meta-resolve

import { getPkg, Coralite } from '#lib'
import { Command } from 'commander'
import kleur from 'kleur'
import { loadConfig } from '../lib/loader.js'

// remove all Node warnings before doing anything else
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

// process ignore-attribute key=value pairs
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

// merge plugins from config file into coraliteOptions
if (config && config.plugins) {
  coraliteOptions.plugins = coraliteOptions.plugins.concat(config.plugins)
}

// initializes Coralite with the provided options and compiles documents
const coralite = new Coralite(coraliteOptions)
// compiles all pages using Coralite
const documents = await coralite.compile()

if (options.dryRun) {
  // print document details without saving files
  const PAD = '  '
  const border = '─'.repeat(Math.min(process.stdout.columns, 36) / 2)

  for (let i = 0; i < documents.length; i++) {
    const document = documents[i]

    process.stdout.write('\n' + PAD + kleur.green('Document is ready!\n\n'))
    process.stdout.write(PAD + `${kleur.bold('- Path:')}      ${document.item.path.pathname}\n`)
    process.stdout.write(PAD + `${kleur.bold('- Built in:')}  ${Math.floor(document.duration)}ms\n\n`)
    process.stdout.write(border + kleur.inverse(' Content start ') + border + '\n\n')
    process.stdout.write(document.html)
    process.stdout.write('\n\n' + border + kleur.inverse(' Content end ') + border + '\n')
  }
} else {
  // save the generated documents to output directory
  await coralite.save(documents, output)
}
