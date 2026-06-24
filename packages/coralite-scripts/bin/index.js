#!/usr/bin/env -S node --experimental-vm-modules --experimental-import-meta-resolve

import loadConfig from '../libs/load-config.js'
import { Command, Argument } from 'commander'
import server from '../libs/server.js'
import pkg from '../package.json' with { type: 'json' }
import { join } from 'node:path'
import { mkdir } from 'node:fs/promises'
import { buildCommand } from '../libs/commands/build.js'
import { parseAssetMapping, mergeAssets } from '../libs/assets.js'

// remove all Node warnings before doing anything else
process.removeAllListeners('warning')

const program = new Command()

program
  .name('Coralite scripts')
  .description(pkg.description)
  .version(pkg.version)
  .addArgument(new Argument('<mode>', 'Run mode: dev (development server) or build (production compilation)').choices(['dev', 'build']).default('dev'))
  .option('-v, --verbose', 'Enable verbose logging output')
  .option('-c, --clean', 'Clear the output directory before building')
  .option('-a, --assets <mapping...>', 'Static assets to copy during build. Format: pkg:path:dest or src:dest')

program.parse(process.argv)
program.on('error', (err) => {
  console.error(err)
})

const options = program.opts()
const mode = program.args[0]
const config = await loadConfig(process.cwd())

if (!config) {
  process.exit(1)
}

if (options.assets) {
  try {
    const cliAssets = options.assets.map(parseAssetMapping)
    config.assets = mergeAssets(config.assets, cliAssets)
  } catch (err) {
    console.error(`\n  Error: ${err.message}\n`)
    process.exit(1)
  }
}

if (mode === 'dev') {
  config.output = join(process.cwd(), '.coralite')
  await mkdir(config.output, { recursive: true })

  await server(config, options)
} else if (mode === 'build') {
  try {
    await buildCommand(config, options)
  } catch {
    process.exit(1)
  }
}
