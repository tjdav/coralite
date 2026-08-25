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

// Initialize commander
program
  .name('release')
  .description('Create a new git release tag and bump package versions')
  .version('1.0.0')
  .argument('<type>', `Release type: ${RELEASE_TYPES.join(', ')}`)
  .option('-d, --dry-run', 'Show what would be done without making changes')
  .option('-y, --yes', 'Skip confirmation prompts')
  .option('-p, --preid <identifier>', 'Identifier for prerelease version (e.g., "rc", "beta", "alpha")', 'rc')
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

      // Select package to release
      let selectedPackageName
      if (options.yes) {
        selectedPackageName = releaseChoices[0]?.value
      } else {
        selectedPackageName = await prompts.select({
          message: 'Select package to release:',
          options: releaseChoices
        })
      }

      if (!selectedPackageName || prompts.isCancel(selectedPackageName)) {
        prompts.log.info('Release cancelled')
        process.exit(0)
      }

      const selectedPkg = packages.find(p => p.name === selectedPackageName)
      const oldVersion = selectedPkg.version

      let targetBase = 'preminor'
      if (type === 'rc' && !semver.prerelease(oldVersion)) {
        if (!options.yes) {
          const preminorOption = calculateNewVersion(oldVersion, 'rc', options.preid || 'rc', 'preminor')
          const prepatchOption = calculateNewVersion(oldVersion, 'rc', options.preid || 'rc', 'prepatch')
          const premajorOption = calculateNewVersion(oldVersion, 'rc', options.preid || 'rc', 'premajor')

          const selectedBase = await prompts.select({
            message: `Select target release candidate type for ${selectedPkg.name}:`,
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

      const newVersion = calculateNewVersion(oldVersion, type, options.preid || 'rc', targetBase)

      // Display summary
      prompts.log.info('Release Plan:')
      console.log('')
      console.log(`  ${selectedPkg.name}: ${oldVersion} → ${newVersion}`)
      console.log('')

      // Get custom message or use default
      const defaultMessage = `release(${selectedPkg.name}): version ${newVersion}`
      const commitMessage = options.message || defaultMessage

      console.log(`Commit message: "${commitMessage}"`)
      console.log('')

      // Dry run pack
      const pkgDir = path.dirname(selectedPkg.path)

      if (selectedPackageName === 'coralite') {
        const sourceLlms = path.resolve(process.cwd(), 'website/public/llms.txt')
        copiedLlmsTarget = path.resolve(pkgDir, 'llms.txt')
        if (existsSync(sourceLlms)) {
          copyFileSync(sourceLlms, copiedLlmsTarget)
          prompts.log.success('📄 Copied website/public/llms.txt to packages/coralite/llms.txt')
        }
      }

      prompts.log.info(`📦 Verifying package content for ${selectedPackageName}...`)
      execSync('pnpm pack --dry-run', {
        cwd: pkgDir,
        stdio: 'inherit'
      })

      if (!options.yes) {
        const packConfirmed = await prompts.confirm({
          message: 'Does the package content look correct?',
          initialValue: true
        })

        if (prompts.isCancel(packConfirmed) || !packConfirmed) {
          prompts.log.info('Release cancelled')
          process.exit(0)
        }
      }

      // Skip confirmation if --yes flag is provided
      if (!options.yes) {
        const confirmed = await prompts.confirm({
          message: 'Continue with release?',
          initialValue: false
        })

        if (prompts.isCancel(confirmed) || !confirmed) {
          prompts.log.info('Release cancelled')
          process.exit(0)
        }
      }

      if (options.dryRun) {
        prompts.log.info('Dry run completed. No changes were made.')
        if (semver.prerelease(newVersion)) {
          prompts.log.info(`📦 To publish this release candidate to npm, run:\n   pnpm --filter ${selectedPackageName} publish --tag ${options.preid || 'rc'}`)
        } else {
          prompts.log.info(`📦 To publish this release to npm, run:\n   pnpm --filter ${selectedPackageName} publish`)
        }
        process.exit(0)
      }

      // Update package.json files
      const modifiedFiles = []
      for (const pkg of packages) {
        let updated = false

        // Update version if this is the selected package
        if (pkg.name === selectedPackageName) {
          pkg.data.version = newVersion
          updated = true
          prompts.log.success(`Updated ${pkg.name} version: ${oldVersion} → ${newVersion}`)
        }

        // Update dependencies
        if (pkg.data.dependencies && pkg.data.dependencies[selectedPackageName]) {
          if (!pkg.data.dependencies[selectedPackageName].startsWith('workspace:')) {
            pkg.data.dependencies[selectedPackageName] = '^' + newVersion
            updated = true
            prompts.log.info(`Updated dependency in ${pkg.name}`)
          }
        }

        // Update devDependencies
        if (pkg.data.devDependencies && pkg.data.devDependencies[selectedPackageName]) {
          if (!pkg.data.devDependencies[selectedPackageName].startsWith('workspace:')) {
            pkg.data.devDependencies[selectedPackageName] = '^' + newVersion
            updated = true
            prompts.log.info(`Updated devDependency in ${pkg.name}`)
          }
        }

        if (updated) {
          writeFileSync(pkg.path, JSON.stringify(pkg.data, null, 2) + '\n')
          modifiedFiles.push(pkg.path)
        }
      }

      // Generate Changelog
      prompts.log.step('Generating Changelog...')
      try {
        const __dirname = path.dirname(fileURLToPath(import.meta.url))
        const changelogScript = path.join(__dirname, 'changelog.js')

        execSync(`node ${changelogScript} --next-version ${newVersion} --package ${selectedPkg.name} --path ${pkgDir} -y --no-git`, { stdio: 'inherit' })
        prompts.log.success('✅ Generated Changelog')
      } catch (error) {
        prompts.log.error(`Failed to generate changelog: ${error.message}`)
        if (!options.yes) {
          const continueWithoutChangelog = await prompts.confirm({
            message: 'Continue without changelog?',
            initialValue: false
          })
          if (prompts.isCancel(continueWithoutChangelog) || !continueWithoutChangelog) {
            process.exit(1)
          }
        }
      }

      // Git commit if not disabled
      let commitSuccessful = false
      if (options.gitCommit) {
        try {
          // Track modified files to stage
          const filesToStage = [...modifiedFiles]

          // Add changelog
          const changelogPath = path.join(pkgDir, 'CHANGELOG.md')
          filesToStage.push(changelogPath)

          // Filter only files that exist on disk and were actually modified
          const existingFilesToStage = filesToStage.filter(f => existsSync(f))

          if (existingFilesToStage.length > 0) {
            prompts.log.step('Committing version changes...')
            await git.add(existingFilesToStage)
            const commitResult = await git.commit(commitMessage, { '--no-verify': null })

            if (commitResult.commit) {
              prompts.log.success(`✅ Committed version changes (${commitResult.commit})`)
              commitSuccessful = true
            } else {
              prompts.log.warn('No changes were committed (possibly already committed or no changes detected)')
              // We consider it successful if there was nothing to commit
              commitSuccessful = true
            }
          } else {
            prompts.log.warn('No modified files found to commit')
            commitSuccessful = true
          }
        } catch (error) {
          prompts.log.error('Failed to commit changes: ' + error.message)
          if (!options.yes) {
            const continueWithoutCommit = await prompts.confirm({
              message: 'Continue with tag creation anyway?',
              initialValue: false
            })
            if (prompts.isCancel(continueWithoutCommit) || !continueWithoutCommit) {
              process.exit(1)
            }
          }
        }
      }

      // Create git tag if not disabled
      if (options.gitTag && commitSuccessful) {
        const tagName = `${selectedPackageName}-v${newVersion}`

        try {
          await git.addAnnotatedTag(tagName, commitMessage)
          prompts.log.success(`🔖 Created git tag: ${tagName}`)
        } catch (error) {
          prompts.log.error(`Failed to create git tag: ${tagName} — ${error.message}`)
          process.exit(1)
        }
      }

      // Push changes and tags
      let shouldPush = true
      if (!options.yes) {
        const confirmPush = await prompts.confirm({
          message: 'Push changes and tags to remote?',
          initialValue: true
        })
        shouldPush = !prompts.isCancel(confirmPush) && Boolean(confirmPush)
      }

      if (shouldPush) {
        try {
          prompts.log.step('Pushing to remote...')

          await git.push('origin', 'main')

          if (options.gitTag) {
            await git.pushTags()
          }

          prompts.log.success('✅ Successfully pushed to remote')
        } catch (error) {
          prompts.log.error(`Failed to push to remote: ${error.message}`)
        }
      }

      prompts.log.success('Release completed successfully!')

      if (semver.prerelease(newVersion)) {
        prompts.log.info(`📦 To publish this release candidate to npm, run:\n   pnpm --filter ${selectedPackageName} publish --tag ${options.preid || 'rc'}`)
      } else {
        prompts.log.info(`📦 To publish this release to npm, run:\n   pnpm --filter ${selectedPackageName} publish`)
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
