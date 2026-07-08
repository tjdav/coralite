import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { buildCommand } from '../../libs/commands/build.js'
import loadConfig from '../../libs/load-config.js'
import { parseAssetMapping, mergeAssets } from '../../libs/assets.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const coraliteScriptsLib = path.resolve(__dirname, '../../libs/config.js')

/**
 * Creates a temporary project directory with pages, components and public folders.
 * @returns {Promise<{
 *   testDir: string,
 *   pagesDir: string,
 *   componentsDir: string,
 *   publicDir: string,
 *   outputDir: string,
 *   cleanup: () => Promise<void>,
 *   writePage: (name: string, content: string) => Promise<string>,
 *   writeComponent: (name: string, content: string) => Promise<string>,
 *   deletePage: (name: string) => Promise<void>,
 *   writeConfig: (content: string) => Promise<string>,
 *   runBuild: (args?: string[]) => Promise<{ stdout: string, stderr: string, exitCode: number }>
 * }>}
 */
export async function createCLIProject () {
  const testDir = await mkdtemp(path.join(tmpdir(), 'coralite-cli-test-'))
  const pagesDir = path.join(testDir, 'src', 'pages')
  const componentsDir = path.join(testDir, 'src', 'components')
  const publicDir = path.join(testDir, 'public')
  const outputDir = path.join(testDir, 'dist')

  await mkdir(pagesDir, { recursive: true })
  await mkdir(componentsDir, { recursive: true })
  await mkdir(publicDir, { recursive: true })
  await mkdir(outputDir, { recursive: true })

  const project = {
    testDir,
    pagesDir,
    componentsDir,
    publicDir,
    outputDir,
    cleanup: async function () {
      return rm(testDir, {
        recursive: true,
        force: true
      })
    },
    writePage: (name, content) => {
      const filePath = path.join(pagesDir, name)
      return writeFile(filePath, content).then(() => filePath)
    },
    deletePage: (name) => {
      const filePath = path.join(pagesDir, name)
      return rm(filePath)
    },
    writeComponent: (name, content) => {
      const filePath = path.join(componentsDir, name)
      return writeFile(filePath, content).then(() => filePath)
    },
    writeConfig: (content) => {
      const filePath = path.join(testDir, 'coralite.config.js')
      return writeFile(filePath, content).then(() => filePath)
    },
    runBuild: async (args = []) => {
      const options = {
        verbose: args.includes('--verbose'),
        clean: args.includes('--clean')
      }

      const assetsIndex = args.indexOf('--assets') !== -1 ? args.indexOf('--assets') : args.indexOf('-a')
      let cliAssetsStrings = []
      if (assetsIndex !== -1) {
        for (let i = assetsIndex + 1; i < args.length; i++) {
          if (args[i].startsWith('-')) {
            break
          }
          cliAssetsStrings.push(args[i])
        }
      }

      let stdout = ''
      let stderr = ''

      const logger = {
        write: (msg) => {
          stdout += msg
        },
        spinner: (text) => {
          const s = {
            text,
            start: () => s,
            succeed: (msg) => {
              stdout += `✔ ${msg || s.text}\n`
            },
            fail: (msg) => {
              stderr += `✖ ${msg || s.text}\n`
            }
          }
          return s
        },
        info: (msg) => {
          stdout += msg + '\n'
        },
        warn: (msg) => {
          stdout += msg + '\n'
        },
        error: (msg, err) => {
          stderr += msg + (err ? ': ' + err.message : '') + '\n'
        }
      }

      const originalCwd = process.cwd()
      process.chdir(testDir)

      try {
        const config = await loadConfig(testDir)

        if (!config) {
          return {
            stdout,
            stderr,
            exitCode: 1
          }
        }

        if (cliAssetsStrings.length > 0) {
          const cliAssets = cliAssetsStrings.map(parseAssetMapping)
          config.assets = mergeAssets(config.assets, cliAssets)
        }

        await buildCommand(config, options, logger)
        return {
          stdout,
          stderr,
          exitCode: 0
        }
      } catch (err) {
        stderr += (err ? err.message : '') + '\n'
        return {
          stdout,
          stderr,
          exitCode: 1
        }
      } finally {
        process.chdir(originalCwd)
      }
    }
  }

  // Write a default config that imports from the local file instead of the package name
  // Use pathToFileURL for better cross-platform compatibility in ESM imports
  const libUrl = pathToFileURL(coraliteScriptsLib).href
  await project.writeConfig(`
    import { defineConfig } from '${libUrl}'
    export default defineConfig({
      output: './dist',
      components: './src/components',
      pages: './src/pages',
      public: './public'
    })
  `)

  return project
}
