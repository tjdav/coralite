#!/usr/bin/env node

import { program } from 'commander'
import * as prompts from '@clack/prompts'
import { readFileSync, existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { simpleGit } from 'simple-git'
import {
  createOrUpdateGitHubRelease,
  extractChangelogSection,
  getRepoSlug,
  isPrerelease,
  matchesReleaseVersion,
  stripLeadingHeading
} from '../lib/github.js'
import { parseTagRef, getPackagePath } from './publish.js'

program
  .name('coralite-github-release')
  .description('Create or update a GitHub Release for a published git tag')
  .option('-t, --tag <tag>', 'Git tag name (e.g. coralite-v1.0.0-rc.10)')
  .option('-p, --package <name>', 'Package name (e.g. coralite, create-coralite)')
  .option('--title <title>', 'Release title')
  .option('--notes <file>', 'Path to custom release notes markdown file')
  .option('--draft', 'Create release as draft', false)
  .option('-d, --dry-run', 'Show release details without creating on GitHub', false)
  .option('-y, --yes', 'Skip confirmation prompts', false)
  .option('--backfill', 'Find and release all published tags that do not have GitHub releases', false)
  .action(async (options) => {
    prompts.intro('🚀 Coralite GitHub Release Publisher')

    const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
    const repoSlug = getRepoSlug(rootDir)
    const git = simpleGit()

    try {
      if (options.backfill) {
        prompts.log.step('Scanning local tags and GitHub releases for missing entries...')

        const allTags = (await git.tags()).all
        const coraliteTags = allTags
          .filter(t => t.startsWith('coralite-v') || t.startsWith('create-coralite-v'))
          .sort()

        if (coraliteTags.length === 0) {
          prompts.log.warn('No coralite release tags found to backfill.')
          process.exit(0)
        }

        const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
        const apiBase = `https://api.github.com/repos/${repoSlug.owner}/${repoSlug.repo}/releases`
        const headers = {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'coralite-release-automation'
        }
        if (token) {
          headers.Authorization = `Bearer ${token}`
        }

        const existingReleaseTags = new Set()
        try {
          let page = 1
          let hasMore = true
          while (hasMore) {
            const res = await fetch(`${apiBase}?per_page=100&page=${page}`, { headers })
            if (res.ok) {
              const releases = await res.json()
              if (Array.isArray(releases) && releases.length > 0) {
                releases.forEach(r => existingReleaseTags.add(r.tag_name))
                if (releases.length < 100) {
                  hasMore = false
                } else {
                  page++
                }
              } else {
                hasMore = false
              }
            } else {
              hasMore = false
            }
          }
        } catch (fetchErr) {
          prompts.log.warn(`Could not fetch existing releases: ${fetchErr.message}`)
        }

        const missingTags = coraliteTags.filter(t => !existingReleaseTags.has(t))

        if (missingTags.length === 0) {
          prompts.log.success('✅ All git tags already have corresponding GitHub releases!')
          process.exit(0)
        }

        prompts.log.info(`Found ${missingTags.length} tag(s) without GitHub releases:\n  ${missingTags.join('\n  ')}`)

        const tagsToProcess = missingTags
        if (!options.yes) {
          const confirmBackfill = await prompts.confirm({
            message: `Publish GitHub releases for these ${missingTags.length} tag(s)?`,
            initialValue: true
          })
          if (prompts.isCancel(confirmBackfill) || !confirmBackfill) {
            prompts.log.info('Backfill cancelled')
            process.exit(0)
          }
        }

        for (const targetTag of tagsToProcess) {
          await processSingleTagRelease({
            tag: targetTag,
            options,
            rootDir,
            repoSlug
          })
        }

        prompts.outro('🎉 Backfill process completed!')
        process.exit(0)
      }

      let targetTag = options.tag
      if (!targetTag) {
        const allTags = (await git.tags()).all
        const validTags = allTags
          .filter(t => t.startsWith('coralite-v') || t.startsWith('create-coralite-v') || /^v\d/.test(t))
          .reverse()

        if (validTags.length === 0) {
          prompts.log.error('No git release tags found in repository.')
          process.exit(1)
        }

        if (options.yes) {
          targetTag = validTags[0]
        } else {
          const selected = await prompts.select({
            message: 'Select git tag to post to GitHub Releases:',
            options: validTags.slice(0, 15).map(t => ({
              value: t,
              label: t
            }))
          })
          if (prompts.isCancel(selected)) {
            prompts.log.info('Release cancelled')
            process.exit(0)
          }
          targetTag = selected
        }
      }

      await processSingleTagRelease({
        tag: targetTag,
        options,
        rootDir,
        repoSlug
      })

      prompts.outro('✅ GitHub release step completed!')
    } catch (err) {
      prompts.log.error(`GitHub release failed: ${err.message}`)
      process.exit(1)
    }
  })

/**
 * Resolves release notes and posts a single release to GitHub.
 * @param {Object} context - Execution context
 * @param {string} context.tag - Target git tag
 * @param {Object} context.options - CLI options
 * @param {string} context.rootDir - Repository root directory
 * @param {{ owner: string, repo: string }} context.repoSlug - GitHub owner and repo slug
 * @returns {Promise<void>}
 */
async function processSingleTagRelease ({ tag, options, rootDir, repoSlug }) {
  const parsed = parseTagRef(tag)
  const packageName = options.package || (parsed ? parsed.packageName : 'coralite')
  const version = parsed ? parsed.version : tag.replace(/^v/, '')
  const title = options.title || `${packageName} v${version}`
  const prerelease = isPrerelease(version)

  let releaseBody = ''

  if (options.notes && existsSync(options.notes)) {
    releaseBody = readFileSync(options.notes, 'utf8')
    prompts.log.info(`Using provided notes file: ${options.notes}`)
  } else {
    let pkgDir = rootDir
    try {
      pkgDir = getPackagePath(packageName, rootDir)
    } catch {
      pkgDir = path.resolve(rootDir, 'packages', packageName)
    }

    const pkgReleasePost = path.join(pkgDir, 'RELEASE_POST.md')
    const rootReleasePost = path.join(rootDir, 'RELEASE_POST.md')

    if (existsSync(pkgReleasePost)) {
      const content = readFileSync(pkgReleasePost, 'utf8')
      if (matchesReleaseVersion(content, version)) {
        releaseBody = content
        prompts.log.info(`Found existing release post in ${path.relative(rootDir, pkgReleasePost)}`)
      }
    }

    if (!releaseBody && existsSync(rootReleasePost)) {
      const content = readFileSync(rootReleasePost, 'utf8')
      if (matchesReleaseVersion(content, version)) {
        releaseBody = content
        prompts.log.info(`Found existing release post in ${path.relative(rootDir, rootReleasePost)}`)
      }
    }

    if (!releaseBody) {
      const pkgChangelog = path.join(pkgDir, 'CHANGELOG.md')
      const rootChangelog = path.join(rootDir, 'CHANGELOG.md')
      const targetChangelog = existsSync(pkgChangelog) ? pkgChangelog : rootChangelog

      if (existsSync(targetChangelog)) {
        const changelogContent = readFileSync(targetChangelog, 'utf8')
        const section = extractChangelogSection(changelogContent, version)
        if (section) {
          releaseBody = section
          prompts.log.info(`Extracted changelog notes from ${path.relative(rootDir, targetChangelog)}`)
        }
      }
    }

    if (!releaseBody) {
      releaseBody = `Automated release for \`${tag}\`.`
      prompts.log.warn(`No changelog or release post found for ${version}. Using fallback notes.`)
    }
  }

  releaseBody = stripLeadingHeading(releaseBody, version, packageName)

  prompts.log.info(`\nTarget Tag:   ${tag}`)
  prompts.log.info(`Release Name: ${title}`)
  prompts.log.info(`Prerelease:   ${prerelease ? 'Yes' : 'No'}`)
  prompts.log.info(`Draft:        ${options.draft ? 'Yes' : 'No'}`)
  console.log('\n--- Release Notes Preview ---\n' + releaseBody.slice(0, 500) + (releaseBody.length > 500 ? '\n... [truncated]' : '') + '\n-----------------------------\n')

  if (options.dryRun) {
    prompts.log.info(`🔍 [dry-run] Would post GitHub Release for "${tag}" to ${repoSlug.owner}/${repoSlug.repo}`)
    return
  }

  if (!options.yes) {
    const confirm = await prompts.confirm({
      message: `Post this release to GitHub for tag "${tag}"?`,
      initialValue: true
    })
    if (prompts.isCancel(confirm) || !confirm) {
      prompts.log.info(`Skipped posting release for ${tag}`)
      return
    }
  }

  const result = await createOrUpdateGitHubRelease({
    tag,
    title,
    body: releaseBody,
    prerelease,
    draft: options.draft,
    repoSlug
  })

  if (result.success) {
    prompts.log.success(`✅ Successfully ${result.action} GitHub Release: ${result.htmlUrl}`)
  } else if (result.webUrl) {
    prompts.log.warn(`⚠️ ${result.error}`)
    prompts.log.info(`🔗 Open this link in your browser to create the release directly:\n   ${result.webUrl}`)
  } else {
    prompts.log.error(`❌ Failed to post release: ${result.error}`)
    throw new Error(result.error)
  }
}

program.parse(process.argv)
