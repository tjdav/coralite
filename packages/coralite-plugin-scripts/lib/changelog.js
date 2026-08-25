
import { simpleGit } from 'simple-git'
import * as prompts from '@clack/prompts'
import { writeFileSync, existsSync, readFileSync } from 'fs'
import semver from 'semver'

/**
 * Generates a changelog file based on git history.
 * @param {Object} [options={}] - Options for generating the changelog
 * @param {string} [options.nextVersion] - The next version string
 * @param {string} [options.from] - Start tag or commit
 * @param {string} [options.to] - End tag or commit
 * @param {string} [options.output] - Output file path, relative to process.cwd()
 * @param {boolean} [options.yes] - Auto-confirm prompts if true
 * @param {boolean} [options.stdout] - Output to stdout if true
 * @returns {Promise<void>} Resolves when the changelog is generated
 */
export async function changelog (options = {}) {
  let repoUrl = ''
  try {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
    if (pkg.repository) {
      const url = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository.url
      repoUrl = url.replace(/\.git$/, '').replace(/^git\+/, '')
    }
  } catch {
    // ignore
  }

  if (!options.yes && !options.nextVersion) {
    prompts.intro('📝 Generating Changelog')
  }

  try {
    const git = simpleGit()

    // Get all tags
    const tags = await git.tags()
    let sortedTags = tags.all
      .filter(tag => {
        const cleaned = tag.replace(/^v/, '')
        return Boolean(semver.valid(cleaned))
      })
      .sort((a, b) => {
        const cleanA = a.replace(/^v/, '')
        const cleanB = b.replace(/^v/, '')
        return semver.rcompare(cleanA, cleanB)
      })

    let fromTag = options.from
    const toRef = options.to || 'HEAD'

    const getCleanVersion = (tagOrVer) => {
      if (!tagOrVer) {
        return null
      }
      const cleaned = tagOrVer.replace(/^v/, '')
      return semver.clean(cleaned) || cleaned
    }

    let targetVersion = null
    if (options.nextVersion) {
      targetVersion = semver.clean(options.nextVersion) || options.nextVersion
    } else if (toRef !== 'HEAD') {
      targetVersion = getCleanVersion(toRef)
    }

    const isStableTarget = Boolean(targetVersion && semver.valid(targetVersion) && !semver.prerelease(targetVersion))

    if (!fromTag) {
      if (isStableTarget) {
        const previousStableTag = sortedTags.find(tag => {
          const cleaned = getCleanVersion(tag)
          return Boolean(semver.valid(cleaned) && !semver.prerelease(cleaned) && cleaned !== targetVersion)
        })
        if (previousStableTag) {
          fromTag = previousStableTag
        }
      }

      if (!fromTag && sortedTags.length > 0) {
        fromTag = sortedTags[0]
        // If we are at the latest tag commit, use the previous one
        try {
          const [toCommit, latestCommit] = await Promise.all([
            git.revparse([`${toRef}^{}`]),
            git.revparse([`${fromTag}^{}`])
          ])
          if (toCommit.trim() === latestCommit.trim()) {
            fromTag = sortedTags[1] || null
          }
        } catch {
          // ignore
        }
      }
    }

    // If no tags, start from first commit
    if (!fromTag) {
      // Fallback to first commit
      try {
        const firstCommit = await git.raw(['rev-list', '--max-parents=0', 'HEAD'])
        fromTag = firstCommit.trim()
      } catch {
        prompts.log.warn('Could not determine start commit. Changelog might be empty.')
      }
    }

    let logArgs
    if (fromTag) {
      logArgs = [`${fromTag}..${toRef}`]
    } else {
      logArgs = [toRef]
    }

    const log = await git.log(logArgs)

    if (!log.all.length) {
      prompts.log.warn(`No commits found`)
      return
    }

    const categories = {
      feat: '✨ Features',
      fix: '🐛 Bug Fixes',
      perf: '⚡ Performance Improvements',
      docs: '📚 Documentation',
      style: '🎨 Styles',
      refactor: '♻️ Code Refactoring',
      test: '✅ Tests',
      build: '📦 Build System',
      ci: '🔧 Continuous Integration',
      chore: '🧹 Chores',
      revert: '⏪ Reverts',
      breaking: '💥 Breaking Changes',
      other: '🔨 Other Changes'
    }

    let titleVersion = ''
    if (options.nextVersion) {
      titleVersion = `v${options.nextVersion.replace(/^v/, '')}`
    } else if (toRef === 'HEAD') {
      titleVersion = 'Unreleased'
    } else {
      titleVersion = toRef
    }

    const changelogData = {
      title: `## ${titleVersion}`,
      sections: {},
      pullRequests: new Set()
    }

    Object.keys(categories).forEach(key => changelogData.sections[key] = [])

    for (const commit of log.all) {
      const { message, hash, author_name } = commit
      const firstLine = message.split('\n')[0].trim()

      const prMatch = firstLine.match(/#(\d+)|Pull\s+Request\s+#(\d+)/i)
      const prNumber = prMatch ? prMatch[1] || prMatch[2] : null
      if (prNumber) {
        changelogData.pullRequests.add(prNumber)
      }

      let isBreaking = firstLine.includes('BREAKING CHANGE') || message.includes('BREAKING CHANGE')
      let type = 'other'
      let scope = ''
      let subject = firstLine

      const match = firstLine.match(/^(\w+)(?:\(([^)]+)\))?!?:\s*(.*)/)
      if (match) {
        type = match[1]
        scope = match[2] || ''
        subject = match[3]
        if (firstLine.includes('!')) {
          isBreaking = true
        }
      }

      const commitEntry = {
        hash,
        subject: subject || firstLine,
        scope,
        pr: prNumber,
        author: `${author_name}`,
        raw: message
      }

      if (isBreaking) {
        changelogData.sections.breaking.push(commitEntry)
      } else if (categories[type]) {
        changelogData.sections[type].push(commitEntry)
      } else {
        changelogData.sections.other.push(commitEntry)
      }
    }

    let markdown = `${changelogData.title}\n\n`
    markdown += `> Comparing \`${fromTag}\` to \`${toRef}\`\n\n`

    for (const [key, title] of Object.entries(categories)) {
      if (changelogData.sections[key].length === 0) {
        continue
      }
      markdown += `### ${title}\n\n`
      for (const commit of changelogData.sections[key]) {
        let line = `- ${commit.subject}`
        if (commit.scope) {
          line += ` (**${commit.scope}**)`
        }
        if (commit.pr && repoUrl) {
          line += ` ([#${commit.pr}](${repoUrl}/pull/${commit.pr}))`
        }
        if (repoUrl) {
          line += ` ([${commit.hash.slice(0, 7)}](${repoUrl}/commit/${commit.hash}))`
        }
        markdown += `${line}\n`
      }
      markdown += '\n'
    }

    if (options.stdout) {
      console.log(markdown)
      return
    }

    // Write to file
    const outputFile = options.output || 'CHANGELOG.md'
    let finalContent = markdown

    if (existsSync(outputFile)) {
      const existingContent = readFileSync(outputFile, 'utf8')
      const cleanExisting = existingContent.replace(/^# Changelog\s+/, '')
      // check if titleVersion already exists to avoid dupes?
      // simpler: just prepend.
      finalContent = `# Changelog\n\n${markdown}\n${cleanExisting}`
    } else {
      finalContent = `# Changelog\n\n${markdown}`
    }

    if (!options.yes) {
      prompts.log.info('Changelog Preview:')
      console.log(markdown.slice(0, 500) + '...')
      const confirmed = await prompts.confirm({
        message: 'Write to file?',
        initialValue: true
      })
      if (!confirmed) {
        return
      }
    }

    writeFileSync(outputFile, finalContent, 'utf8')
    prompts.log.success(`Changelog written to ${outputFile}`)

  } catch (error) {
    prompts.log.error(`Failed to generate changelog: ${error.message}`)
    process.exit(1)
  }
}
