#!/usr/bin/env -S node --experimental-vm-modules --experimental-import-meta-resolve

import loadConfig from '../libs/load-config.js'
import { Command, Argument } from 'commander'
import server from '../libs/server.js'
import colours from 'kleur'
import pkg from '../package.json' with { type: 'json' }
import buildSass from '../libs/build-sass.js'
import { join, relative } from 'node:path'
import { deleteDirectoryRecursive, copyDirectory, toMS, toTime, displayError } from '../libs/build-utils.js'
import buildCSS from '../libs/build-css.js'
import { Coralite } from 'coralite'
import { mkdir, writeFile } from 'node:fs/promises'
import ora from 'ora'

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

if (!config) {
  process.exit(1)
}

if (mode === 'dev') {
  await server(config, options)
} else if (mode === 'build') {
  const PAD = '  '
  const border = '─'.repeat(Math.min(process.stdout.columns, 36) / 2)
  const dash = colours.gray(' ─ ')

  if (options.verbose) {
    // log the response time and status code
    process.stdout.write('\n' + PAD + colours.yellow('Compiling Coralite... \n\n'))
    process.stdout.write(border + colours.inverse(` LOGS `) + border + '\n\n')
  } else {
    process.stdout.write('\n' + PAD + colours.yellow('Compiling Coralite... \n\n'))
  }

  // delete old output files
  deleteDirectoryRecursive(config.output)

  const start = process.hrtime()
  // start coralite
  const coralite = new Coralite({
    templates: config.templates,
    pages: config.pages,
    plugins: config.plugins
  })
  await coralite.initialise()

  let spinner
  let pageCount = 0

  try {
    if (!options.verbose) {
      spinner = ora('Building pages...').start()
    }

    // compile website
    await coralite.build(async (result) => {
      const relDir = relative(config.pages, result.path.dirname)
      const outDir = join(config.output, relDir)
      const outFile = join(outDir, result.path.filename)

      await mkdir(outDir, { recursive: true })
      await writeFile(outFile, result.html)

      if (options.verbose) {
        process.stdout.write(toTime() + toMS(result.duration) + dash + result.path.pathname + '\n')
      } else {
        pageCount++
        spinner.text = `Building pages... (${pageCount} completed)`
      }

      return outFile
    })

    if (!options.verbose) {
      spinner.succeed(`Pages built (${pageCount} completed)`)
    }

    const publicDir = config.public

    if (publicDir) {
      if (!options.verbose) {
        spinner = ora('Copying public directory...').start()
      }
      await copyDirectory(publicDir, config.output)
      if (!options.verbose) {
        spinner.succeed('Public directory copied')
      }
    }

    if (config.styles) {
      if (!options.verbose) {
        spinner = ora('Building styles...').start()
      }

      if (config.styles.type === 'sass' || config.styles.type === 'scss') {
        const results = await buildSass({
          input: config.styles.input,
          output: join(config.output, 'css'),
          options: config.sassOptions,
          start
        })

        for (let i = 0; i < results.length; i++) {
          const result = results[i]

          if (options.verbose) {
            process.stdout.write(toTime() + toMS(result.duration) + dash + result.output + '\n')
          }
        }
      } else if (config.styles.type === 'css') {
        const results = await buildCSS({
          input: config.styles.input,
          output: join(config.output, 'css'),
          plugins: config.cssPlugins,
          start
        })

        for (let i = 0; i < results.length; i++) {
          const result = results[i]

          if (options.verbose) {
            process.stdout.write(toTime() + toMS(result.duration) + dash + result.output + '\n')
          }
        }
      }

      if (!options.verbose) {
        spinner.succeed('Styles built')
      }
    }
  } catch (error) {
    if (spinner) {
      spinner.fail('Build failed')
    }
    displayError('Build failed', error)
    process.exit(1)
  }
}
