#!/usr/bin/env -S node --experimental-vm-modules --experimental-import-meta-resolve

import loadConfig from '../libs/load-config.js'
import { Command, Argument } from 'commander'
import server from '../libs/server.js'
import colours from 'kleur'
import buildHTML from '../libs/build-html.js'
import pkg from '../package.json' with { type: 'json'}
import buildSass from '../libs/build-sass.js'
import { join } from 'node:path'
import { deleteDirectoryRecursive, copyDirectory, toMS, toTime } from '../libs/build-utils.js'

// remove all Node warnings before doing anything else
process.removeAllListeners('warning')

const program = new Command()

program
  .name('Coralite scripts')
  .description(pkg.description)
  .version(pkg.version)
  .addArgument(new Argument('<mode>', 'Run mode: dev (development server) or build (production compilation)').choices(['dev', 'build']).default('dev'))
  .option('-v --verbose', 'Enable verbose logging output')

program.parse(process.argv)
program.on('error', (err) => {
  console.error(err)
})

const options = program.opts()
const mode = program.args[0]
const config = await loadConfig()

if (mode === 'dev') {
  await server(config, options)
} else if (mode === 'build') {
  const start = process.hrtime()
  const PAD = '  '
  const border = '─'.repeat(Math.min(process.stdout.columns, 36) / 2)

  // log the response time and status code
  process.stdout.write('\n' + PAD + colours.yellow('Compiling Coralite... \n\n'))
  process.stdout.write(border + colours.inverse(` LOGS `) + border + '\n\n')
  // delete old output files
  deleteDirectoryRecursive(config.output)

  const documents = await buildHTML(config)
  const dash = colours.gray(' ─ ')

  for (let i = 0; i < documents.length; i++) {
    const document = documents[i]

    process.stdout.write(toTime() + toMS(document.duration) + dash + document.item.path.pathname + '\n')
  }

  if (config.styles && (config.styles.type === 'sass' || config.styles.type === 'scss')) {
    const results = await buildSass({
      input: config.styles.input,
      options: config.sassOptions,
      output: join(config.output, 'css'),
      start
    })

    for (let i = 0; i < results.length; i++) {
      const result = results[i]

      process.stdout.write(toTime() + toMS(result.duration) + dash + result.output + '\n')
    }
  }
}
