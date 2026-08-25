
import * as prompts from '@clack/prompts'
import { readFileSync, writeFileSync } from 'fs'
import { simpleGit } from 'simple-git'
import { execSync } from 'child_process'
import path from 'path'
import semver from 'semver'

export const RELEASE_TYPES = ['major', 'minor', 'patch', 'premajor', 'preminor', 'prepatch', 'prerelease', 'rc']

/**
 * Executes the package release process.
 * @param {string} type - The release type ('major', 'minor', 'patch', etc.)
 * @param {Object} options - Configuration options for the release
 * @returns {Promise<void>} Resolves when the release process is complete
 */
export async function release (type, options) {
  const git = simpleGit()

  try {
    // If type is not provided, prompt for it
    if (!type) {
      const selectedType = await prompts.select({
        message: 'Select release type:',
        options: RELEASE_TYPES.map(t => ({
          value: t,
          label: t
        }))
      })
      if (prompts.isCancel(selectedType)) {
        prompts.log.info('Release cancelled')
        process.exit(0)
      }
      // @ts-ignore
      type = selectedType
    } else if (!RELEASE_TYPES.includes(type)) {
      prompts.log.error(`Invalid release type: ${type}. Must be one of: ${RELEASE_TYPES.join(', ')}`)
      process.exit(1)
    }

    // Pre-release checks (Run test script if exists)
    prompts.log.info('🔍 Running pre-release checks...')
    try {
      const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
      if (pkg.scripts && pkg.scripts.test) {
        prompts.log.step('Running Tests...')
        execSync('npm test', { stdio: 'inherit' })
      }
      if (pkg.scripts && pkg.scripts.build) {
        prompts.log.step('Building...')
        execSync('npm run build', { stdio: 'inherit' })
      }
      prompts.log.success('✅ All checks passed!')
    } catch {
      prompts.log.error('❌ Pre-release checks failed. Fix errors before releasing.')
      process.exit(1)
    }

    // Check clean working directory
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

    // Read package.json
    const pkgPath = path.resolve('package.json')
    const pkgContent = readFileSync(pkgPath, 'utf8')
    const pkg = JSON.parse(pkgContent)
    const oldVersion = pkg.version
    const newVersion = calculateNewVersion(oldVersion, type, options.preid || 'rc')

    prompts.log.info('Release Plan:')
    console.log(`  ${pkg.name}: ${oldVersion} → ${newVersion}`)

    const defaultMessage = `release: version ${newVersion}`
    const commitMessage = options.message || defaultMessage
    console.log(`  Commit message: "${commitMessage}"`)

    // Dry run pack
    prompts.log.info(`📦 Verifying package content...`)
    execSync('npm pack --dry-run', { stdio: 'inherit' })

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

    // Update package.json
    pkg.version = newVersion
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
    prompts.log.success(`Updated package.json version: ${oldVersion} → ${newVersion}`)

    // Generate Changelog
    // Import changelog function dynamically to avoid circular dependency issues if any, or just import it
    const { changelog } = await import('./changelog.js')
    await changelog({
      nextVersion: newVersion,
      yes: true,
      output: 'CHANGELOG.md'
    })

    // Git commit
    if (!options.noGitCommit) {
      try {
        await git.add(['package.json', 'CHANGELOG.md'])
        await git.commit(commitMessage)
        prompts.log.success('✅ Committed version changes')
      } catch (error) {
        prompts.log.error('Failed to commit changes: ' + error.message)
        if (!options.yes) {
          const cont = await prompts.confirm({
            message: 'Continue anyway?',
            initialValue: false
          })
          if (!cont) {
            process.exit(1)
          }
        }
      }
    }

    // Git tag
    if (!options.noGitTag) {
      const tagName = `v${newVersion}`
      try {
        await git.tag(['-a', tagName, '-m', commitMessage])
        prompts.log.success(`🔖 Created git tag: ${tagName}`)
      } catch (error) {
        prompts.log.error(`Failed to create git tag: ${tagName} — ${error.message}`)
        process.exit(1)
      }
    }

    prompts.log.success('Release completed successfully!')
    console.log('\nNext steps:')
    console.log('  git push && git push --tags')
    console.log('  npm publish')

  } catch (error) {
    prompts.log.error(`Release failed: ${error.message}`)
    process.exit(1)
  }
}

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
