import colours from 'kleur'
import { join } from 'node:path'
import { existsSync, readFileSync, writeFileSync, statSync, readdirSync } from 'node:fs'
import {
  validateComponentsDir,
  applyComponentFixes,
  validatePluginSource,
  applyPluginFixes
} from 'coralite'
import { checkCommand } from './check.js'

function resolvePath (explicitPath, configProp, defaultCandidates, config, cwd = process.cwd()) {
  if (explicitPath) {
    return explicitPath
  }
  if (config && config[configProp]) {
    return config[configProp]
  }
  for (const cand of defaultCandidates) {
    if (existsSync(join(cwd, cand))) {
      return cand
    }
  }
  return null
}

function resolveTargetDir (targetPath, cwd) {
  if (!targetPath) {
    return null
  }
  const relativePath = join(cwd, targetPath)
  if (existsSync(relativePath)) {
    return relativePath
  }
  if (existsSync(targetPath)) {
    return targetPath
  }
  return null
}

/**
 * Executes AST auto-fixers across components and plugins.
 *
 * @param {import('../../types/index.js').CoraliteScriptConfig|null} config - The configuration object.
 * @param {any} [options={}] - The CLI and command options.
 * @param {any} [logger=null] - Optional custom logger output stream.
 */
export async function fixCommand (config, options = {}, logger = null) {
  const cwd = options.cwd || process.cwd()
  const log = (msg) => {
    if (logger && typeof logger.write === 'function') {
      logger.write(msg)
    } else if (logger && typeof logger.log === 'function') {
      logger.log(msg)
    } else {
      process.stdout.write(msg)
    }
  }

  const compDir = resolvePath(options.components, 'components', ['src/components', 'tests/fixtures/components', 'components'], config, cwd)
  const pluginTarget = resolvePath(options.plugins, 'plugins', ['src/plugins', 'tests/fixtures/plugins', 'plugins'], config, cwd)

  let totalFixesCount = 0
  const modifiedFiles = []
  const diffs = []

  const fullCompDir = resolveTargetDir(compDir, cwd)

  if (fullCompDir) {
    const compReport = validateComponentsDir(fullCompDir)
    for (const compRes of compReport.components) {
      if (!compRes.filePath) {
        continue
      }
      const rawCode = readFileSync(compRes.filePath, 'utf8')
      const fixResult = applyComponentFixes(rawCode, compRes.diagnostics || [], {
        filePath: compRes.filePath,
        dryRun: Boolean(options.dryRun)
      })

      if (fixResult.modified) {
        totalFixesCount += fixResult.fixesApplied.length
        modifiedFiles.push(compRes.filePath)
        if (fixResult.diff) {
          diffs.push(fixResult.diff)
        }

        if (options.dryRun) {
          log(fixResult.diff + '\n')
        } else {
          writeFileSync(compRes.filePath, fixResult.outputCode, 'utf8')
        }
      }
    }
  }

  const fullPluginTarget = resolveTargetDir(pluginTarget, cwd)

  if (fullPluginTarget) {
    const pluginFiles = []
    if (statSync(fullPluginTarget).isFile()) {
      pluginFiles.push(fullPluginTarget)
    } else {
      const scan = (d) => {
        for (const entry of readdirSync(d)) {
          const full = join(d, entry)
          if (statSync(full).isDirectory()) {
            scan(full)
          } else if (entry.endsWith('.js') || entry.endsWith('.mjs')) {
            pluginFiles.push(full)
          }
        }
      }
      scan(fullPluginTarget)
    }

    for (const pFile of pluginFiles) {
      const rawCode = readFileSync(pFile, 'utf8')
      const pResult = validatePluginSource(rawCode, pFile)
      const fixResult = applyPluginFixes(rawCode, pResult.diagnostics || [], {
        filePath: pFile,
        dryRun: Boolean(options.dryRun)
      })

      if (fixResult.modified) {
        totalFixesCount += fixResult.fixesApplied.length
        modifiedFiles.push(pFile)
        if (fixResult.diff) {
          diffs.push(fixResult.diff)
        }

        if (options.dryRun) {
          log(fixResult.diff + '\n')
        } else {
          writeFileSync(pFile, fixResult.outputCode, 'utf8')
        }
      }
    }
  }

  if (options.dryRun) {
    log(
      colours.bold().cyan(
        `Dry-run complete: ${totalFixesCount} fix(es) would be applied across ${modifiedFiles.length} file(s). No files modified on disk.\n\n`
      )
    )
    return {
      totalFixesCount,
      modifiedFiles,
      diffs,
      checkResult: null,
      hasFailures: false
    }
  } else {
    if (modifiedFiles.length > 0) {
      log(
        colours.bold().green(
          `✔ Auto-fixed ${totalFixesCount} issue(s) across ${modifiedFiles.length} file(s).\n\n`
        )
      )
    } else {
      log(colours.bold().cyan('No fixable issues found.\n\n'))
    }

    const checkResult = await checkCommand(config, options, logger)
    return {
      totalFixesCount,
      modifiedFiles,
      diffs,
      checkResult,
      hasFailures: checkResult.hasFailures
    }
  }
}
