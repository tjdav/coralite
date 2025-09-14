#!/usr/bin/env -S node --experimental-vm-modules --experimental-import-meta-resolve

import { Coralite } from '../dist/lib/index.js'
import { Command } from 'commander'
import kleur from 'kleur'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { existsSync } from 'node:fs'

// remove all Node warnings before doing anything else
process.removeAllListeners('warning')

const program = new Command()

program
  .name('Coralite')
  .description('HTML modules static site generator CLI tool')
  .version('0.18.1')
  .requiredOption('-t, --templates <path>', 'Path to templates directory')
  .requiredOption('-p, --pages <path>', 'Path to pages directory')
  .requiredOption('-o, --output <path>', 'Output directory for the generated site')
  .option('-i, --ignore-attribute <key=value...>', 'Ignore elements by attribute name value pair', [])
  .option('-d, --dry-run', 'Run in dry-run mode')

program.parse(process.argv)
program.on('error', (err) => {
  console.error(err)
})

const configPath = pathToFileURL(join(process.cwd(), 'coralite.config.js'))
let config

// check if the configuration file exists at the specified path
if (existsSync(configPath)) {
  const data = await import(configPath.href)

  if (data.default) {
    config = data.default
  }
}

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

// Create coralite instance
const coralite = new Coralite(coraliteOptions)
// initializes Coralite with the provided options and compiles documents
await coralite.initialise()
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
