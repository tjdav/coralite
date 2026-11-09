#!/usr/bin/env node

import { program } from 'commander'
import * as prompts from '@clack/prompts'
import { readFileSync, existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { simpleGit } from 'simple-git'
import semver from 'semver'
import { updateChangelogData } from '../lib/changelog-entry-generator.js'
import { extractChangelogSection, matchesReleaseVersion, stripLeadingHeading } from '../lib/github.js'
import { parseTagRef, getPackagePath } from './publish.js'

program
  .name('coralite-changelog-post')
  .description('Generate and add a release entry to the website changelog timeline (website/src/data/changelog.json)')
  .option('-t, --tag <tag>', 'Git tag name (e.g. coralite-v1.0.0-rc.10)')
  .option('-p, --package <name>', 'Package name (e.g. coralite, create-coralite)')
  .option('--notes <file>', 'Custom release notes file to parse')
  .option('-d, --dry-run', 'Show entry without updating changelog.json', false)
  .option('-y, --yes', 'Skip confirmation prompts', false)
  .option('--backfill', 'Backfill all releases into the changelog timeline', false)
  .action(async (options) => {
    prompts.intro('📰 Coralite Website Changelog Generator')

    const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
    const changelogJsonPath = path.resolve(rootDir, 'website/src/data/changelog.json')
    const git = simpleGit()

    try {
      if (options.backfill) {
        prompts.log.step('Scanning repository for release tags...')
        const allTags = (await git.tags()).all
        const targetTags = allTags
          .filter(t => {
            if (options.package) {
              return t.startsWith(`${options.package}-v`)
            }
            return t.startsWith('coralite-v') || t.startsWith('create-coralite-v')
          })
          .sort((a, b) => {
            const verA = a.replace(/^(coralite|create-coralite)-v/, '')
            const verB = b.replace(/^(coralite|create-coralite)-v/, '')
            const cleanA = semver.clean(verA) || verA
            const cleanB = semver.clean(verB) || verB
            if (semver.valid(cleanA) && semver.valid(cleanB)) {
              return semver.compare(cleanA, cleanB)
            }
            return a.localeCompare(b)
          })

        if (targetTags.length === 0) {
          prompts.log.warn('No release tags found.')
          process.exit(0)
        }

        prompts.log.info(`Found ${targetTags.length} tag(s) to process:\n  ${targetTags.join('\n  ')}`)

        if (!options.yes) {
          const confirmBackfill = await prompts.confirm({
            message: `Generate changelog timeline entries for these ${targetTags.length} release(s)?`,
            initialValue: true
          })
          if (prompts.isCancel(confirmBackfill) || !confirmBackfill) {
            prompts.log.info('Backfill cancelled')
            process.exit(0)
          }
        }

        for (const tag of targetTags) {
          await processTagEntry({
            tag,
            options,
            rootDir,
            changelogJsonPath,
            git
          })
        }

        prompts.outro('🎉 Website changelog backfill completed!')
        process.exit(0)
      }

      let targetTag = options.tag
      if (!targetTag) {
        const allTags = (await git.tags()).all
        const validTags = allTags
          .filter(t => t.startsWith('coralite-v') || t.startsWith('create-coralite-v'))
          .reverse()

        if (validTags.length === 0) {
          prompts.log.error('No git release tags found in repository.')
          process.exit(1)
        }

        if (options.yes) {
          targetTag = validTags[0]
        } else {
          const selected = await prompts.select({
            message: 'Select git tag to create changelog post for:',
            options: validTags.slice(0, 15).map(t => ({
              value: t,
              label: t
            }))
          })
          if (prompts.isCancel(selected)) {
            prompts.log.info('Operation cancelled')
            process.exit(0)
          }
          targetTag = selected
        }
      }

      await processTagEntry({
        tag: targetTag,
        options,
        rootDir,
        changelogJsonPath,
        git
      })

      prompts.outro('✅ Website changelog entry processed successfully!')
    } catch (err) {
      prompts.log.error(`Changelog post creation failed: ${err.message}`)
      process.exit(1)
    }
  })

/**
 * Processes and writes a single tag entry into changelog.json.
 * @param {Object} context - Execution context
 * @param {string} context.tag - Target tag
 * @param {Object} context.options - CLI options
 * @param {string} context.rootDir - Root directory
 * @param {string} context.changelogJsonPath - Path to changelog.json
 * @param {any} context.git - simple-git instance
 * @returns {Promise<void>}
 */
async function processTagEntry ({ tag, options, rootDir, changelogJsonPath, git }) {
  const parsed = parseTagRef(tag)
  const packageName = options.package || (parsed ? parsed.packageName : 'coralite')
  const version = parsed ? parsed.version : tag.replace(/^v/, '')

  // Get tag commit date from git
  let tagDate = new Date().toISOString()
  try {
    const rawDate = await git.raw(['log', '-1', '--format=%aI', tag])
    if (rawDate && rawDate.trim()) {
      tagDate = rawDate.trim()
    }
  } catch {
    // Keep current date
  }

  let markdownNotes = ''
  if (options.notes && existsSync(options.notes)) {
    markdownNotes = readFileSync(options.notes, 'utf8')
  } else {
    let pkgDir = rootDir
    try {
      pkgDir = getPackagePath(packageName, rootDir)
    } catch {
      pkgDir = path.resolve(rootDir, 'packages', packageName)
    }

    const archivePath = path.join(pkgDir, 'releases', `v${version}.md`)
    const tagArchivePath = path.join(pkgDir, 'releases', `${tag}.md`)
    const pkgReleasePost = path.join(pkgDir, 'RELEASE_POST.md')
    const rootReleasePost = path.join(rootDir, 'RELEASE_POST.md')

    if (existsSync(archivePath)) {
      markdownNotes = readFileSync(archivePath, 'utf8')
    } else if (existsSync(tagArchivePath)) {
      markdownNotes = readFileSync(tagArchivePath, 'utf8')
    } else if (existsSync(pkgReleasePost)) {
      const content = readFileSync(pkgReleasePost, 'utf8')
      if (matchesReleaseVersion(content, version)) {
        markdownNotes = content
      }
    }

    if (!markdownNotes && existsSync(rootReleasePost)) {
      const content = readFileSync(rootReleasePost, 'utf8')
      if (matchesReleaseVersion(content, version)) {
        markdownNotes = content
      }
    }

    if (!markdownNotes) {
      const pkgChangelog = path.join(pkgDir, 'CHANGELOG.md')
      const rootChangelog = path.join(rootDir, 'CHANGELOG.md')
      const targetChangelog = existsSync(pkgChangelog) ? pkgChangelog : rootChangelog

      if (existsSync(targetChangelog)) {
        const changelogContent = readFileSync(targetChangelog, 'utf8')
        const section = extractChangelogSection(changelogContent, version)
        if (section) {
          markdownNotes = `## Release Overview\nRelease ${version} for ${packageName}.\n\n---\n\n${section}`
        }
      }
    }

    if (!markdownNotes) {
      markdownNotes = `## Release Overview\nAutomated release for ${tag}.`
    }
  }

  markdownNotes = stripLeadingHeading(markdownNotes, version, packageName)

  if (options.dryRun) {
    prompts.log.info(`[dry-run] Would update ${path.relative(rootDir, changelogJsonPath)} for ${tag}`)
    return
  }

  updateChangelogData({
    version,
    packageName,
    date: tagDate,
    markdown: markdownNotes,
    jsonPath: changelogJsonPath
  })

  prompts.log.success(`✔ Updated website changelog for ${tag}`)
}

program.parse(process.argv)
