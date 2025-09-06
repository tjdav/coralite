#!/usr/bin/env node

import { program } from 'commander'
import * as prompts from '@clack/prompts'
import { readFileSync, writeFileSync } from 'fs'
import { globSync } from 'glob'
import { simpleGit } from 'simple-git'

// Define available release types
const RELEASE_TYPES = ['major', 'minor', 'patch', 'prerelease']

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

    try {
      // Validate release type
      if (!RELEASE_TYPES.includes(type)) {
        prompts.log.error(`Invalid release type: ${type}. Must be one of: ${RELEASE_TYPES.join(', ')}`)
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

      if (packageFiles.length === 0) {
        prompts.log.warn('No packages found in packages/ directory')
        process.exit(0)
      }

      // Read current versions
      const packages = []
      for (let i = 0; i < packageFiles.length; i++) {
        const filepath = packageFiles[i]
        const content = readFileSync(filepath, 'utf8')
        const pkg = JSON.parse(content)

        if (!pkg.private) {
          packages.push( {
            path: filepath,
            name: pkg.name,
            version: pkg.version,
            content,
            data: pkg,
            newVersion: calculateNewVersion(pkg.version, type, options.preid)
          })
        }
      }

      // Display summary
      prompts.log.info('Release Plan:')
      console.log('')
      packages.forEach(pkg => {
        console.log(`  ${pkg.name}: ${pkg.version} → ${pkg.newVersion}`)
      })
      console.log('')

      // Get custom message or use default
      const defaultMessage = `release: version ${packages[0].newVersion}`
      const commitMessage = options.message || defaultMessage

      console.log(`Commit message: "${commitMessage}"`)
      console.log('')

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
      for (const pkg of packages) {
        pkg.data.version = pkg.newVersion
        writeFileSync(pkg.path, JSON.stringify(pkg.data, null, 2) + '\n')
        prompts.log.success(`Updated ${pkg.path}: ${pkg.version} → ${pkg.newVersion}`)
      }

      // Git commit if not disabled
      if (!options.noGitCommit) {
        try {
          await git.add('packages/*/package.json')
          await git.commit(commitMessage)
          prompts.log.success('✅ Committed version changes')
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
      if (!options.noGitTag) {
        const tagName = `v${packages[0].newVersion}`
        try {
          await git.tag(['-a', tagName, '-m', commitMessage])
          prompts.log.success(`🔖 Created git tag: ${tagName}`)
        } catch (error) {
          prompts.log.error(`Failed to create git tag: ${tagName} — ${error.message}`)
          process.exit(1)
        }
      }

      prompts.log.success('Release completed successfully!')

      // Show next steps
      console.log('\nNext steps:')
      if (!options.noGitTag) {
        console.log('  git push && git push --tags')
      } else {
        console.log('  git push')
      }

    } catch (error) {
      prompts.log.error(`Release failed: ${error.message}`)
      process.exit(1)
    }
  })

// Helper function to calculate new version
function calculateNewVersion (currentVersion, releaseType, preid = 'alpha') {
  // Simple semver bumping logic
  const parts = currentVersion.replace(/^v/, '').split('-')
  const versionParts = parts[0].split('.').map(Number)

  let newVersion

  switch (releaseType) {
    case 'major':
      newVersion = `${versionParts[0] + 1}.0.0`
      break
    case 'minor':
      newVersion = `${versionParts[0]}.${versionParts[1] + 1}.0`
      break
    case 'patch':
      newVersion = `${versionParts[0]}.${versionParts[1]}.${versionParts[2] + 1}`
      break
    case 'prerelease':
      if (parts.length > 1 && parts[1].startsWith(preid)) {
        // Increment existing prerelease
        const prereleaseParts = parts[1].split('.')
        const num = parseInt(prereleaseParts[prereleaseParts.length - 1]) || 0
        newVersion = `${parts[0]}-${preid}.${num + 1}`
      } else {
        // Start new prerelease
        newVersion = `${parts[0]}-${preid}.0`
      }
      break
    default:
      throw new Error(`Unknown release type: ${releaseType}`)
  }

  return newVersion
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  prompts.log.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`)
  process.exit(1)
})

// Parse command line arguments
program.parse(process.argv)

// Show help if no arguments provided
if (process.argv.length <= 2) {
  program.help()
}
