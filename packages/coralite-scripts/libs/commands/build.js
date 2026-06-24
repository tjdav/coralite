import colours from 'kleur'
import buildStyles from '../build-styles.js'
import { join, relative, dirname } from 'node:path'
import { existsSync, readdirSync, rmdirSync, statSync, unlinkSync } from 'node:fs'
import { deleteDirectoryRecursive, copyDirectory, toMS, toTime, displayError, displayWarning, displayInfo } from '../build-utils.js'
import { createCoralite } from 'coralite'
import { mkdir, writeFile } from 'node:fs/promises'
import ora from 'ora'

/**
 * @param {import('../../types/index.js').CoraliteScriptConfig} config - The configuration object.
 * @param {any} options - The CLI options.
 * @param {any} logger - The logger object.
 */
export async function buildCommand (config, options, logger = null) {
  const mode = 'build'
  const PAD = '  '
  const border = '─'.repeat(Math.min(process.stdout.columns || 36, 36) / 2)
  const dash = colours.gray(' ─ ')

  const log = (msg) => {
    if (logger && logger.write) {
      logger.write(msg)
    } else {
      process.stdout.write(msg)
    }
  }

  const createSpinner = (text) => {
    if (logger && logger.spinner) {
      return logger.spinner(text)
    }
    return ora(text)
  }

  const internalLogger = {
    info: (msg) => {
      return logger && logger.info ? logger.info(msg) : displayInfo(msg)
    },
    warn: (msg) => {
      return logger && logger.warn ? logger.warn(msg) : displayWarning(msg)
    },
    error: (msg, err) => {
      return logger && logger.error ? logger.error(msg, err) : displayError(msg, err)
    }
  }

  if (options.verbose) {
    log('\n' + PAD + colours.yellow('Compiling Coralite... \n\n'))
    log(border + colours.inverse(` LOGS `) + border + '\n\n')
  } else {
    log('\n' + PAD + colours.yellow('Compiling Coralite... \n\n'))
  }

  if (options.clean) {
    deleteDirectoryRecursive(config.output)
  }

  const validFiles = new Set()

  const coralite = await createCoralite({
    components: config.components,
    pages: config.pages,
    plugins: config.plugins,
    assets: config.assets,
    externalStyles: config.styles?.input?.map(input => {
      const ext = input.split('.').pop()
      return '/assets/css/' + input.split('/').pop().replace(`.${ext}`, '.css')
    }),
    baseURL: config.baseURL,
    output: config.output,
    mode: 'production',
    onError: ({ level, message, error }) => {
      if (level === 'ERR') {
        internalLogger.error(message, error)
      } else if (level === 'WARN') {
        internalLogger.warn(message)
      } else {
        internalLogger.info(message)
      }
    }
  })

  let spinner
  let pageCount = 0
  let skippedCount = 0

  try {
    const componentCount = 0

    if (!options.verbose) {
      spinner = createSpinner('Building pages...').start()
    }

    const updateSpinnerText = () => {
      if (skippedCount > 0) {
        spinner.text = `Building pages... (${pageCount} completed, ${skippedCount} skipped)`
      } else {
        spinner.text = `Building pages... (${pageCount} completed)`
      }
    }

    await coralite.build(async (result) => {
      const relativeDir = relative(config.pages, result.path.dirname)
      const outDir = join(config.output, relativeDir)
      const outFile = join(outDir, result.path.filename)

      validFiles.add(outFile)

      if (result.status === 'skipped') {
        skippedCount++
        if (!options.verbose) {
          updateSpinnerText()
        }
        return
      }

      await mkdir(outDir, { recursive: true })
      await writeFile(outFile, result.content)

      if (options.verbose) {
        log(toTime() + toMS(result.duration) + dash + result.path.pathname + '\n')
      } else {
        pageCount++
        updateSpinnerText()
      }
    })

    if (coralite.outputFiles) {
      const assetsJsDir = join(config.output, 'assets', 'js')
      const assetsCssDir = join(config.output, 'assets', 'css')

      const assetWrites = Object.values(coralite.outputFiles).map(async (file) => {
        const isCSS = (file.path || file.hashedPath)?.endsWith('.css')
        const baseAssetsDir = isCSS ? assetsCssDir : assetsJsDir
        const outFile = join(baseAssetsDir, file.hashedPath)

        validFiles.add(outFile)

        await mkdir(dirname(outFile), { recursive: true })
        await writeFile(outFile, file.text)
        if (options.verbose) {
          const dash = colours.gray(' ─ ')
          log(toTime() + toMS(0) + dash + outFile + '\n')
        }
      })

      await Promise.all(assetWrites)
    }

    if (!options.verbose) {
      if (skippedCount > 0) {
        spinner.succeed(`Pages built (${pageCount} completed, ${skippedCount} skipped)`)
      } else {
        spinner.succeed(`Pages built (${pageCount} completed)`)
      }
      if (componentCount > 0) {
        createSpinner(`Components built (${componentCount} completed)`).succeed()
      }
    }

    const publicDir = config.public

    if (publicDir) {
      if (!options.verbose) {
        spinner = createSpinner('Copying public directory...').start()
      }
      await copyDirectory(publicDir, config.output)

      const trackPublicFiles = (dir, baseDir) => {
        const files = readdirSync(dir)
        for (const file of files) {
          const fullPath = join(dir, file)
          const stat = statSync(fullPath)

          if (stat.isDirectory()) {
            trackPublicFiles(fullPath, baseDir)
          } else {
            const relativePath = relative(baseDir, fullPath)
            validFiles.add(join(config.output, relativePath))
          }
        }
      }
      trackPublicFiles(publicDir, publicDir)

      if (!options.verbose) {
        spinner.succeed('Public directory copied')
      }
    }

    if (config.styles && config.styles.input) {
      if (!options.verbose) {
        spinner = createSpinner('Building styles...').start()
      }

      const results = await buildStyles({
        input: config.styles.input,
        output: join(config.output, 'assets', 'css'),
        processors: config.styles.processors,
        minify: mode === 'build',
        sourcemap: mode !== 'build'
      })

      for (let i = 0; i < results.length; i++) {
        const result = results[i]
        validFiles.add(result.output)

        if (options.verbose) {
          log(toTime() + toMS(result.duration) + dash + result.output + '\n')
        }
      }

      if (!options.verbose) {
        spinner.succeed('Styles built')
      }
    }

    if (!options.clean) {
      if (!options.verbose) {
        spinner = createSpinner('Cleaning up stale files...').start()
      }

      const cleanupStaleFiles = (dir) => {
        if (!existsSync(dir)) {
          return
        }

        const files = readdirSync(dir)
        for (const file of files) {
          const fullPath = join(dir, file)
          const stat = statSync(fullPath)

          if (stat.isDirectory()) {
            cleanupStaleFiles(fullPath)
            if (readdirSync(fullPath).length === 0) {
              rmdirSync(fullPath)
            }
          } else if (!validFiles.has(fullPath)) {
            unlinkSync(fullPath)

            if (options.verbose) {
              log(toTime() + colours.gray('Deleted stale file: ') + fullPath + '\n')
            }
          }
        }
      }
      cleanupStaleFiles(config.output)

      if (!options.verbose) {
        spinner.succeed('Cleanup complete')
      }
    }
  } catch (error) {
    if (spinner) {
      spinner.fail('Build failed')
    }
    internalLogger.error('Build failed', error)
    throw error
  }
}
