#!/usr/bin/env node

import { getSubDirectory, getPkg, coralite } from '#lib'
import { Command } from 'commander'
import { join } from 'node:path'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import kleur from 'kleur'

const pkg = await getPkg()
const program = new Command()

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

for (let i = 0; i < options.ignoreAttribute.length; i++) {
  const pair = options.ignoreAttribute[i].split('=')

  if (pair.length !== 2) {
    throw new Error('Ignore attribute "' + pair[0] + '" expected a value but found none')
  }

  ignoreByAttribute.push(pair)
}

const documents = await coralite({
  templates: options.templates,
  pages,
  ignoreByAttribute
})

if (options.dryRun) {
  const PAD = '  '
  const border = '─'.repeat(Math.min(process.stdout.columns, 36) / 2)

  for (let i = 0; i < documents.length; i++) {
    const document = documents[i]

    process.stdout.write('\n' + PAD + kleur.green('Document is ready!\n\n'))
    process.stdout.write(PAD + `${kleur.bold('- Path:')}      ${join(document.item.parentPath, document.item.name)}\n`)
    process.stdout.write(PAD + `${kleur.bold('- Built in:')}      ${Math.floor(document.duration)}ms\n\n`)
    process.stdout.write(border + kleur.inverse(' Content start ') + border + '\n\n')
    process.stdout.write(document.html)
    process.stdout.write('\n\n' + border + kleur.inverse(' Content end ') + border + '\n')
  }
} else {
  for (let i = 0; i < documents.length; i++) {
    const document = documents[i]
    // get pages sub directory
    const subDir = getSubDirectory(pages, document.item.parentPath)
    const dir = join(output, subDir)

    if (!existsSync(dir)) {
    // create directory
      mkdirSync(dir)
    }

    writeFileSync(join(dir, document.item.name), document.html)
  }
}
