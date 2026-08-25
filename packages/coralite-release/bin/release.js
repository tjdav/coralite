#!/usr/bin/env node

import { program } from 'commander'
import * as prompts from '@clack/prompts'
import { readFileSync, writeFileSync, existsSync, copyFileSync, unlinkSync } from 'fs'
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
  .option('-p, --preid <identifier>', 'Identifier for prerelease version (e.g., "alpha", "beta")')
  .option('-m, --message <message>', 'Custom release commit message')
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

      // Check if current branch is main
      const branchStatus = await git.status()
      if (branchStatus.current !== 'main') {
        prompts.log.error(`Releases must be performed on the "main" branch. Current branch is: ${branchStatus.current}`)
        process.exit(1)
      }

      // Pre-release checks
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

      // Check if working directory is clean
      const status = await git.status()
      if (status.files.length > 0) {
        prompts.log.warn('You have uncommitted changes:')

        status.files.forEach(file => console.log(`  ${file.path}`))

        const proceed = await prompts.confirm({
          message: 'Continue anyway? (Changes won’t be committed)',
          initialValue: false
        })

        if (prompts.isCancel(proceed) || !proceed) {
          prompts.log.info('Release cancelled')
          process.exit(0)
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
      const selectedPackageName = await prompts.select({
        message: 'Select package to release:',
        options: releaseChoices
      })

      if (prompts.isCancel(selectedPackageName)) {
        prompts.log.info('Release cancelled')
        process.exit(0)
      }

      const selectedPkg = packages.find(p => p.name === selectedPackageName)
      const oldVersion = selectedPkg.version
      const newVersion = calculateNewVersion(oldVersion, type, options.preid || 'rc')

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
      const shouldPush = await prompts.confirm({
        message: 'Push changes and tags to remote?',
        initialValue: true
      })

      if (shouldPush && !prompts.isCancel(shouldPush)) {
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

// Helper function to calculate new version
/**
 *
 */
export function calculateNewVersion (currentVersion, releaseType, preid = 'rc', targetBase = 'preminor') {
  const cleanedVersion = semver.clean(currentVersion) || currentVersion
  let newVersion

  if (releaseType === 'rc') {
    if (semver.prerelease(cleanedVersion)) {
      newVersion = semver.inc(cleanedVersion, 'prerelease', preid)
    } else {
      newVersion = semver.inc(cleanedVersion, targetBase || 'preminor', preid)
    }
  } else {
    newVersion = semver.inc(cleanedVersion, releaseType, preid)
  }

  if (!newVersion) {
    throw new Error(`Failed to calculate new version for "${currentVersion}" with release type "${releaseType}"`)
  }

  return newVersion
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  prompts.log.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`)
  process.exit(1)
})

// Parse command line arguments if executed directly
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  program.parse(process.argv)

  // Show help if no arguments provided
  if (process.argv.length <= 2) {
    program.help()
  }
}
