#!/usr/bin/env node

import { program } from 'commander'
import * as prompts from '@clack/prompts'
import { readFileSync, writeFileSync, existsSync, copyFileSync, unlinkSync, realpathSync } from 'fs'
import { globSync } from 'glob'
import { simpleGit } from 'simple-git'
import { execSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import semver from 'semver'

// Define available release types
export const RELEASE_TYPES = ['major', 'minor', 'patch', 'premajor', 'preminor', 'prepatch', 'prerelease', 'rc']

// Define topological dependency order for monorepo packages
export const TOPOLOGICAL_ORDER = [
  'coralite',
  'coralite-scripts',
  'create-coralite',
  'coralite-plugin-scripts',
  'create-coralite-plugin'
]

/**
 * Helper to sort packages or package names according to TOPOLOGICAL_ORDER.
 * Packages not listed in TOPOLOGICAL_ORDER are placed at the end.
 * @param {Array<object|string>} packages - List of package objects or string names
 * @returns {Array<object|string>} Sorted copy of packages
 */
export function sortPackagesInTopologicalOrder (packages) {
  return [...packages].sort((a, b) => {
    const nameA = typeof a === 'string' ? a : (a.name || a.value)
    const nameB = typeof b === 'string' ? b : (b.name || b.value)
    const idxA = TOPOLOGICAL_ORDER.indexOf(nameA)
    const idxB = TOPOLOGICAL_ORDER.indexOf(nameB)
    const posA = idxA === -1 ? TOPOLOGICAL_ORDER.length : idxA
    const posB = idxB === -1 ? TOPOLOGICAL_ORDER.length : idxB
    return posA - posB
  })
}

/**
 * Helper to parse comma- or space-separated package input options.
 * @param {string|string[]} input - Package option input
 * @returns {string[]} Array of trimmed package names
 */
export function parsePackageOption (input) {
  if (!input) {
    return []
  }
  const list = Array.isArray(input) ? input : [input]
  return list
    .flatMap(item => String(item).split(','))
    .map(name => name.trim())
    .filter(Boolean)
}

// Initialize commander
program
  .name('release')
  .description('Create a new git release tag and bump package versions')
  .version('1.0.0')
  .argument('<type>', `Release type: ${RELEASE_TYPES.join(', ')}`)
  .option('-d, --dry-run', 'Show what would be done without making changes')
  .option('-y, --yes', 'Skip confirmation prompts')
  .option('-p, --package <packages...>', 'Specific package(s) to release (comma or space separated)')
  .option('-a, --all', 'Release all packages in topological order')
  .option('--preid <identifier>', 'Identifier for prerelease version (e.g., "rc", "beta", "alpha")', 'rc')
  .option('-m, --message <message>', 'Custom release commit message')
  .option('--allow-any-branch', 'Allow release from branches other than main/master/release/rc')
  .option('--no-git-tag', 'Skip creating git tag')
  .option('--no-git-commit', 'Skip git commit (only update package.json files)')
  .action(async (type, options) => {
    const git = simpleGit()
    let copiedLlmsTarget = null

    try {
      // Validate release type
      if (!RELEASE_TYPES.includes(type)) {
        prompts.log.error(`Invalid release type: ${type}. Must be one of: ${RELEASE_TYPES.join(', ')}`)
        process.exit(1)
      }

      // Branch verification
      const branchStatus = await git.status()
      const allowedBranchPatterns = [/^main$/, /^master$/, /^release\/.+$/, /^rc\/.+$/]
      const isAllowedBranch = allowedBranchPatterns.some(pattern => pattern.test(branchStatus.current))
      if (!isAllowedBranch && !options.allowAnyBranch) {
        if (options.yes) {
          prompts.log.error(`Releases must be performed on "main", "master", or "release/*" / "rc/*" branches. Current branch: ${branchStatus.current}. Use --allow-any-branch to override.`)
          process.exit(1)
        }
        const proceedBranch = await prompts.confirm({
          message: `Current branch is "${branchStatus.current}". Releases are typically done on main or release/* branches. Continue anyway?`,
          initialValue: false
        })
        if (prompts.isCancel(proceedBranch) || !proceedBranch) {
          prompts.log.info('Release cancelled')
          process.exit(0)
        }
      }

      // Pre-flight remote sync check
      const currentBranch = branchStatus.current || 'main'
      try {
        await git.fetch('origin')
        const localHead = (await git.revparse(['HEAD'])).trim()
        const remoteHead = (await git.revparse([`origin/${currentBranch}`])).trim()

        if (localHead !== remoteHead) {
          const behindCountStr = (await git.raw(['rev-list', '--count', `HEAD..origin/${currentBranch}`])).trim()
          const behindCount = parseInt(behindCountStr, 10)
          if (!isNaN(behindCount) && behindCount > 0) {
            prompts.log.error(`Your local branch is behind origin/${currentBranch} by ${behindCount} commit(s). Please pull latest changes before releasing.`)
            process.exit(1)
          }
        }
      } catch (remoteErr) {
        if (options.dryRun) {
          prompts.log.warn(`🔍 [dry-run] Remote sync check skipped or failed: ${remoteErr.message}`)
        } else {
          prompts.log.warn(`⚠️ Could not check remote sync with origin/${currentBranch}: ${remoteErr.message}`)
        }
      }

      // Pre-release checks
      if (!options.dryRun && !process.env.SKIP_PRE_RELEASE_CHECKS) {
        prompts.log.info('🔍 Running pre-release checks...')

        try {
          prompts.log.step('Running Lint...')
          execSync('pnpm lint', { stdio: 'inherit' })

          prompts.log.step('Verifying Build...')
          execSync('pnpm run build:scripts', { stdio: 'inherit' })

          prompts.log.step('Running Unit Tests...')
          execSync('pnpm test:unit', { stdio: 'inherit' })

          prompts.log.step('Verifying E2E Tests...')
          execSync('pnpm run test:e2e', { stdio: 'inherit' })

          prompts.log.success('✅ All checks passed!')
        } catch {
          prompts.log.error('❌ Pre-release checks failed. Fix errors before releasing.')
          process.exit(1)
        }
      } else if (options.dryRun) {
        prompts.log.info('🔍 [dry-run] Pre-release checks skipped')
      }

      // Check if working directory is clean
      const status = await git.status()
      if (status.files.length > 0) {
        prompts.log.warn('You have uncommitted changes:')

        status.files.forEach(file => console.log(`  ${file.path}`))

        if (!options.yes) {
          const proceed = await prompts.confirm({
            message: 'Continue anyway? (Changes won’t be committed)',
            initialValue: false
          })

          if (prompts.isCancel(proceed) || !proceed) {
            prompts.log.info('Release cancelled')
            process.exit(0)
          }
        }
      }

      // Get all package.json files
      const packageFiles = globSync('packages/*/package.json')
      const packageTemplateFiles = globSync('packages/create-coralite/templates/*/package.json')
      const pluginTemplateFiles = globSync('packages/create-coralite-plugin/templates/*/package.json')
      const packageJsonFiles = packageFiles.concat(packageTemplateFiles, pluginTemplateFiles)

      if (packageJsonFiles.length === 0) {
        prompts.log.warn('No packages found in packages/ directory')
        process.exit(0)
      }

      // Read all packages
      const packages = []
      const releaseChoices = []

      for (const filepath of packageJsonFiles) {
        const content = readFileSync(filepath, 'utf8')
        const pkg = JSON.parse(content)

        // Only add to choices if it's in packages/ directory (not templates)
        // and it has a version field
        if (packageFiles.includes(filepath) && pkg.version) {
          releaseChoices.push({
            value: pkg.name,
            label: `${pkg.name} (${pkg.version})`,
            version: pkg.version
          })
        }

        packages.push({
          private: pkg.private,
          path: filepath,
          name: pkg.name,
          version: pkg.version,
          content,
          data: pkg
        })
      }

      const publishablePackages = packages.filter(p => packageFiles.includes(p.path) && p.version)
      const sortedPublishable = sortPackagesInTopologicalOrder(publishablePackages)

      // Determine selected package names
      const cliPackageNames = parsePackageOption(options.package)
      let selectedNames = []

      if (options.all) {
        selectedNames = sortedPublishable.map(p => p.name)
      } else if (cliPackageNames.length > 0) {
        selectedNames = cliPackageNames
      } else if (options.yes) {
        // Default to coralite or first available package for backwards compatibility
        const defaultPkg = sortedPublishable.find(p => p.name === 'coralite') || sortedPublishable[0]
        selectedNames = defaultPkg ? [defaultPkg.name] : []
      } else {
        const selectionType = await prompts.select({
          message: 'Select package(s) to release:',
          options: [
            {
              value: '__ALL__',
              label: '🚀 All packages (in topological order)'
            },
            {
              value: '__CORE_STACK__',
              label: '📦 Core stack (coralite → coralite-scripts → create-coralite)'
            },
            {
              value: '__MULTISELECT__',
              label: '☑️  Custom multi-select...'
            },
            ...releaseChoices
          ]
        })

        if (!selectionType || prompts.isCancel(selectionType)) {
          prompts.log.info('Release cancelled')
          process.exit(0)
        }

        if (selectionType === '__ALL__') {
          selectedNames = sortedPublishable.map(p => p.name)
        } else if (selectionType === '__CORE_STACK__') {
          selectedNames = ['coralite', 'coralite-scripts', 'create-coralite']
        } else if (selectionType === '__MULTISELECT__') {
          const chosen = await prompts.multiselect({
            message: 'Select packages to release:',
            options: releaseChoices.map(c => ({
              value: c.value,
              label: c.label
            }))
          })

          if (!chosen || prompts.isCancel(chosen) || chosen.length === 0) {
            prompts.log.info('Release cancelled')
            process.exit(0)
          }

          selectedNames = chosen
        } else {
          selectedNames = [selectionType]
        }
      }

      if (selectedNames.length === 0) {
        prompts.log.error('No packages selected for release.')
        process.exit(1)
      }

      // Map selected names to package objects and sort in topological order
      const selectedPackages = sortPackagesInTopologicalOrder(
        selectedNames.map(name => {
          const found = publishablePackages.find(p => p.name === name)
          if (!found) {
            prompts.log.error(`Package "${name}" not found in monorepo packages.`)
            process.exit(1)
          }
          return found
        })
      )

      // Target base selection for RC bump if any selected package is stable
      let targetBase = 'preminor'
      const hasStablePackage = selectedPackages.some(pkg => !semver.prerelease(pkg.version))

      if (type === 'rc' && hasStablePackage) {
        if (!options.yes) {
          const samplePkg = selectedPackages.find(pkg => !semver.prerelease(pkg.version)) || selectedPackages[0]
          const preminorOption = calculateNewVersion(samplePkg.version, 'rc', options.preid || 'rc', 'preminor')
          const prepatchOption = calculateNewVersion(samplePkg.version, 'rc', options.preid || 'rc', 'prepatch')
          const premajorOption = calculateNewVersion(samplePkg.version, 'rc', options.preid || 'rc', 'premajor')

          const selectedBase = await prompts.select({
            message: `Select target release candidate type for stable packages (e.g. ${samplePkg.name}):`,
            options: [
              {
                value: 'preminor',
                label: `preminor (e.g. ${preminorOption}) (recommended)`
              },
              {
                value: 'prepatch',
                label: `prepatch (e.g. ${prepatchOption})`
              },
              {
                value: 'premajor',
                label: `premajor (e.g. ${premajorOption})`
              }
            ],
            initialValue: 'preminor'
          })

          if (prompts.isCancel(selectedBase)) {
            prompts.log.info('Release cancelled')
            process.exit(0)
          }
          targetBase = selectedBase
        }
      }

      // Calculate new versions for each selected package
      const plannedReleases = selectedPackages.map(pkg => {
        const oldVersion = pkg.version
        const newVersion = calculateNewVersion(oldVersion, type, options.preid || 'rc', targetBase)
        const commitMessage = options.message || `release(${pkg.name}): version ${newVersion}`
        const tagName = `${pkg.name}-v${newVersion}`
        return {
          pkg,
          name: pkg.name,
          oldVersion,
          newVersion,
          commitMessage,
          tagName
        }
      })

      // Display consolidated Release Plan summary
      prompts.log.info('Release Plan:')
      console.log('')
      for (const rel of plannedReleases) {
        console.log(`  ${rel.name}: ${rel.oldVersion} → ${rel.newVersion}`)
        console.log(`    Commit: "${rel.commitMessage}"`)
        console.log(`    Tag:    "${rel.tagName}"`)
      }
      console.log('')

      // Dry run pack for all selected packages upfront
      const restoreOriginalPkgs = () => {
        for (const rel of plannedReleases) {
          try {
            writeFileSync(rel.pkg.path, rel.pkg.content)
          } catch {
          }
        }
        if (copiedLlmsTarget && existsSync(copiedLlmsTarget)) {
          try {
            unlinkSync(copiedLlmsTarget)
            copiedLlmsTarget = null
          } catch {
          }
        }
      }

      const onSignal = () => {
        restoreOriginalPkgs()
        process.exit(1)
      }

      const cleanupSignalHandlers = () => {
        process.removeListener('SIGINT', onSignal)
        process.removeListener('SIGTERM', onSignal)
        process.removeListener('exit', restoreOriginalPkgs)
      }

      process.on('SIGINT', onSignal)
      process.on('SIGTERM', onSignal)
      process.on('exit', restoreOriginalPkgs)

      try {
        for (const rel of plannedReleases) {
          const pkgDir = path.dirname(rel.pkg.path)
          if (rel.name === 'coralite') {
            const sourceLlms = path.resolve(process.cwd(), 'website/public/llms.txt')
            copiedLlmsTarget = path.resolve(pkgDir, 'llms.txt')
            if (existsSync(sourceLlms)) {
              copyFileSync(sourceLlms, copiedLlmsTarget)
              prompts.log.success('📄 Copied website/public/llms.txt to packages/coralite/llms.txt')
            }
          }

          const tempPkgData = {
            ...rel.pkg.data,
            version: rel.newVersion
          }
          writeFileSync(rel.pkg.path, JSON.stringify(tempPkgData, null, 2) + '\n')

          prompts.log.info(`📦 Verifying package content for ${rel.name}...`)
          execSync('pnpm pack --dry-run', {
            cwd: pkgDir,
            stdio: 'inherit'
          })
        }

        if (!options.yes) {
          const packConfirmed = await prompts.confirm({
            message: 'Does the package content look correct for all selected packages?',
            initialValue: true
          })

          if (prompts.isCancel(packConfirmed) || !packConfirmed) {
            restoreOriginalPkgs()
            cleanupSignalHandlers()
            prompts.log.info('Release cancelled')
            process.exit(0)
          }
        }

        if (!options.yes) {
          const confirmed = await prompts.confirm({
            message: `Continue with release of ${plannedReleases.length} package(s)?`,
            initialValue: false
          })

          if (prompts.isCancel(confirmed) || !confirmed) {
            restoreOriginalPkgs()
            cleanupSignalHandlers()
            prompts.log.info('Release cancelled')
            process.exit(0)
          }
        }

        if (options.dryRun) {
          restoreOriginalPkgs()
          cleanupSignalHandlers()
          prompts.log.info('Dry run completed. No changes were made.')
          console.log('')
          for (const rel of plannedReleases) {
            console.log(`  [dry-run] Planned steps for ${rel.name} (${rel.oldVersion} → ${rel.newVersion}):`)
            console.log(`    1. Update version in ${rel.pkg.path}`)
            console.log(`    2. Update dependent package.json files across monorepo to ^${rel.newVersion}`)
            console.log(`    3. Generate CHANGELOG.md for ${rel.name}`)
            console.log(`    4. Git commit: "${rel.commitMessage}"`)
            console.log(`    5. Git tag: "${rel.tagName}"`)
            console.log(`    6. Git push origin ${currentBranch} & tag "${rel.tagName}"`)
            console.log('')
          }

          for (const rel of plannedReleases) {
            if (semver.prerelease(rel.newVersion)) {
              prompts.log.info(`📦 To publish ${rel.name} to npm, run:\n   pnpm --filter ${rel.name} publish --tag ${options.preid || 'rc'}`)
            } else {
              prompts.log.info(`📦 To publish ${rel.name} to npm, run:\n   pnpm --filter ${rel.name} publish`)
            }
          }
          process.exit(0)
        }

        // Restore original packages before sequential execution loop
        restoreOriginalPkgs()
        cleanupSignalHandlers()
      } catch (packErr) {
        restoreOriginalPkgs()
        cleanupSignalHandlers()
        throw packErr
      }

      // Sequential Execution Loop per Package P_i
      const succeededPackages = []
      const skippedPackages = [...plannedReleases]
      let failedPackage = null

      let shouldPush = true
      if (!options.yes) {
        const confirmPush = await prompts.confirm({
          message: 'Push changes and tags to remote during sequential release?',
          initialValue: true
        })
        shouldPush = !prompts.isCancel(confirmPush) && Boolean(confirmPush)
      }

      for (let i = 0; i < plannedReleases.length; i++) {
        const rel = plannedReleases[i]
        skippedPackages.shift()

        prompts.log.info(`\n🚀 [${i + 1}/${plannedReleases.length}] Releasing package: ${rel.name} (${rel.oldVersion} → ${rel.newVersion})`)

        try {
          const modifiedFiles = []

          // 1. Update version in P_i's package.json & update dependencies across all packages/templates
          for (const pkg of packages) {
            let updated = false

            if (pkg.name === rel.name) {
              pkg.data.version = rel.newVersion
              updated = true
              prompts.log.success(`Updated ${pkg.name} version: ${rel.oldVersion} → ${rel.newVersion}`)
            }

            if (pkg.data.dependencies && pkg.data.dependencies[rel.name]) {
              if (!pkg.data.dependencies[rel.name].startsWith('workspace:')) {
                pkg.data.dependencies[rel.name] = '^' + rel.newVersion
                updated = true
                prompts.log.info(`Updated dependency on ${rel.name} in ${pkg.name}`)
              }
            }

            if (pkg.data.devDependencies && pkg.data.devDependencies[rel.name]) {
              if (!pkg.data.devDependencies[rel.name].startsWith('workspace:')) {
                pkg.data.devDependencies[rel.name] = '^' + rel.newVersion
                updated = true
                prompts.log.info(`Updated devDependency on ${rel.name} in ${pkg.name}`)
              }
            }

            if (updated) {
              writeFileSync(pkg.path, JSON.stringify(pkg.data, null, 2) + '\n')
              modifiedFiles.push(pkg.path)
            }
          }

          // 2. Generate Changelog for P_i
          const pkgDir = path.dirname(rel.pkg.path)
          prompts.log.step(`Generating Changelog for ${rel.name}...`)
          try {
            const __dirname = path.dirname(fileURLToPath(import.meta.url))
            const changelogScript = path.join(__dirname, 'changelog.js')

            execSync(`node ${changelogScript} --next-version ${rel.newVersion} --package ${rel.name} --path ${pkgDir} -y --no-git`, { stdio: 'inherit' })
            prompts.log.success(`✅ Generated Changelog for ${rel.name}`)
          } catch (error) {
            prompts.log.error(`Failed to generate changelog for ${rel.name}: ${error.message}`)
            if (!options.yes) {
              const continueWithoutChangelog = await prompts.confirm({
                message: `Continue ${rel.name} release without changelog?`,
                initialValue: false
              })
              if (prompts.isCancel(continueWithoutChangelog) || !continueWithoutChangelog) {
                throw error
              }
            }
          }

          // 3. Git commit P_i
          let commitSuccessful = false
          if (options.gitCommit) {
            const filesToStage = [...modifiedFiles]
            const changelogPath = path.join(pkgDir, 'CHANGELOG.md')
            filesToStage.push(changelogPath)

            const existingFilesToStage = filesToStage.filter(f => existsSync(f))

            if (existingFilesToStage.length > 0) {
              prompts.log.step(`Committing version changes for ${rel.name}...`)
              await git.add(existingFilesToStage)
              const commitResult = await git.commit(rel.commitMessage, { '--no-verify': null })

              if (commitResult.commit) {
                prompts.log.success(`✅ Committed version changes for ${rel.name} (${commitResult.commit})`)
                commitSuccessful = true
              } else {
                prompts.log.warn(`No changes were committed for ${rel.name}`)
                commitSuccessful = true
              }
            } else {
              prompts.log.warn(`No modified files found to commit for ${rel.name}`)
              commitSuccessful = true
            }
          }

          // 4. Create git tag for P_i
          if (options.gitTag && commitSuccessful) {
            try {
              await git.addAnnotatedTag(rel.tagName, rel.commitMessage)
              prompts.log.success(`🔖 Created git tag: ${rel.tagName}`)
            } catch (error) {
              prompts.log.error(`Failed to create git tag ${rel.tagName}: ${error.message}`)
              throw error
            }
          }

          // 5. Push commit and tag for P_i
          if (shouldPush) {
            prompts.log.step(`Pushing changes and tag for ${rel.name} to remote...`)
            await git.push('origin', currentBranch)
            if (options.gitTag) {
              await git.push('origin', rel.tagName)
            }
            prompts.log.success(`✅ Successfully pushed ${rel.name} (${rel.tagName}) to remote`)
          }

          succeededPackages.push(rel)

          // 6. Settlement delay (1.5s) before next package P_{i+1}
          if (i < plannedReleases.length - 1) {
            prompts.log.info('⏳ Settlement pause (1.5s) before processing next package...')
            await new Promise(resolve => setTimeout(resolve, 1500))
          }
        } catch (stepErr) {
          failedPackage = rel
          prompts.log.error(`\n❌ Sequential release failed at package: ${rel.name}`)
          prompts.log.error(`  Succeeded: ${succeededPackages.map(p => p.name).join(', ') || 'None'}`)
          prompts.log.error(`  Failed:    ${failedPackage.name} (${stepErr.message})`)
          prompts.log.error(`  Skipped:   ${skippedPackages.map(p => p.name).join(', ') || 'None'}`)
          process.exit(1)
        }
      }

      prompts.log.success('\n🎉 Multi-package sequential release completed successfully!')
      console.log('')
      for (const rel of succeededPackages) {
        if (semver.prerelease(rel.newVersion)) {
          prompts.log.info(`📦 To publish ${rel.name} to npm, run:\n   pnpm --filter ${rel.name} publish --tag ${options.preid || 'rc'}`)
        } else {
          prompts.log.info(`📦 To publish ${rel.name} to npm, run:\n   pnpm --filter ${rel.name} publish`)
        }
      }

    } catch (error) {
      prompts.log.error(`Release failed: ${error.message}`)
      process.exit(1)
    } finally {
      if (copiedLlmsTarget && existsSync(copiedLlmsTarget)) {
        try {
          unlinkSync(copiedLlmsTarget)
          prompts.log.info('🧹 Cleaned up temporary packages/coralite/llms.txt')
        } catch {
          /* Ignore cleanup errors */
        }
      }
    }
  })

/**
 * Helper function to calculate new version using semver.
 * @param {string} currentVersion - The current version string
 * @param {string} releaseType - The release type ('major', 'minor', 'patch', 'premajor', 'preminor', 'prepatch', 'prerelease', 'rc')
 * @param {string} [preid='rc'] - Identifier for prerelease version
 * @param {string} [targetBase='preminor'] - Target release type base when bumping a stable version to an RC
 * @returns {string} The calculated new version string
 */
export function calculateNewVersion (currentVersion, releaseType, preid = 'rc', targetBase = 'preminor') {
  const isPrerelease = Boolean(semver.prerelease(currentVersion))
  let result = null

  if (releaseType === 'rc') {
    if (isPrerelease) {
      result = semver.inc(currentVersion, 'prerelease', preid)
    } else {
      result = semver.inc(currentVersion, targetBase, preid)
    }
  } else if (releaseType === 'prerelease') {
    result = semver.inc(currentVersion, 'prerelease', preid)
  } else if (['premajor', 'preminor', 'prepatch'].includes(releaseType)) {
    result = semver.inc(currentVersion, releaseType, preid)
  } else if (['major', 'minor', 'patch'].includes(releaseType)) {
    result = semver.inc(currentVersion, releaseType)
  } else {
    throw new Error(`Unknown release type: ${releaseType}`)
  }

  if (!result) {
    throw new Error(`Failed to calculate new version for "${currentVersion}" with release type "${releaseType}"`)
  }

  return result
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  prompts.log.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`)
  process.exit(1)
})

// Parse command line arguments when executed directly
function isMainModule () {
  if (!process.argv[1]) {
    return false
  }

  try {
    const realArgv = realpathSync(process.argv[1])
    const realMeta = realpathSync(fileURLToPath(import.meta.url))
    return realArgv === realMeta
  } catch {
    return false
  }
}

if (isMainModule()) {
  program.parse(process.argv)

  // Show help if no arguments provided
  if (process.argv.length <= 2) {
    program.help()
  }
}
