#!/usr/bin/env node

import * as prompts from '@clack/prompts'
import { simpleGit } from 'simple-git'
import { program } from 'commander'
import { writeFileSync, existsSync, readFileSync } from 'fs'
import path from 'path'

program
  .name('generate-changelog')
  .description('Generate a changelog based on commits between git tags')
  .option('-f, --from <tag>', 'Starting tag (defaults to last tag)')
  .option('-t, --to <tag>', 'Ending tag (defaults to HEAD)')
  .option('--package <name>', 'Package name (for tag filtering)')
  .option('--path <path>', 'Package path (for commit filtering and output)')
  .option('--next-version <version>', 'Version number for the new release')
  .option('-o, --output <file>', 'Output file (defaults to package/CHANGELOG.md or stdout)')
  .option('-y, --yes', 'Skip confirmation')
  .option('--stdout', 'Print to stdout only, ignore output file')
  .action(async (options) => {
    const REPO = 'https://codeberg.org/tjdavid/coralite'
    const packageName = options.package
    const pkgPath = options.path

    prompts.intro('📝 Generating Changelog')

    try {
      const git = simpleGit()

      // Get all tags
      const tags = await git.tags()
      if (!tags.all.length) {
        prompts.log.warn('No git tags found. At least one tag is required.')
        prompts.outro('No tags found')
        process.exit(1)
      }

      // Sort tags by version (assuming semantic versioning)
      // Filter by package prefix if packageName is provided
      const sortedTags = tags.all
        .filter(tag => {
          if (packageName) {
            return tag.startsWith(`${packageName}-v`)
          }
          return tag.startsWith('v') || /^\d+\.\d+\.\d+/.test(tag)
        })
        .sort((a, b) => {
          const prefixRegex = packageName ? new RegExp(`^${packageName}-v`) : /^v/
          const cleanA = a.replace(prefixRegex, '')
          const cleanB = b.replace(prefixRegex, '')
          return cleanB.localeCompare(cleanA, undefined, {
            numeric: true,
            sensitivity: 'base'
          })
        })

      if (sortedTags.length < 1) {
        prompts.log.warn('No valid semantic version tags found.')
        prompts.outro('Invalid tags')
        process.exit(1)
      }

      // Determine from/to refs
      const latestTag = sortedTags[0]
      let fromTag = options.from
      const toRef = options.to || 'HEAD'

      if (!fromTag) {
        try {
          // Check if toRef points to the same commit as latestTag
          // Use ^{} to peel tags to their commits
          const [toCommit, latestCommit] = await Promise.all([
            git.revparse([`${toRef}^{}`]),
            git.revparse([`${latestTag}^{}`])
          ])

          if (toCommit.trim() === latestCommit.trim()) {
            // We are generating changelog for the latest tag itself
            fromTag = sortedTags[1] || latestTag
          } else {
            // We are generating changelog for new changes since latest tag
            fromTag = latestTag
          }
        } catch (error) {
          // Fallback if git commands fail (e.g. invalid ref)
          fromTag = sortedTags[1] || latestTag
        }
      }

      // Validate from tag exists
      if (!tags.all.includes(fromTag)) {
        prompts.log.error(`Tag "${fromTag}" not found.`)
        process.exit(1)
      }

      // Get commit history between fromTag and toRef
      const logArgs = [`${fromTag}..${toRef}`]

      if (pkgPath) {
        logArgs.push('--', pkgPath)
      }

      const log = await git.log(logArgs)

      if (!log.all.length) {
        prompts.log.warn(`No commits found between ${fromTag} and ${toRef}`)
        process.exit(0)
      }

      // Parse commits into categories
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

      let titleVersion = toRef
      if (toRef === 'HEAD') {
        titleVersion = options.nextVersion ? `v${options.nextVersion.replace(/^v/, '')}` : 'Unreleased'
      } else {
        titleVersion = `v${toRef.replace(/^v/, '')}`
      }

      const changelog = {
        title: `## ${titleVersion}`,
        sections: {},
        pullRequests: new Set()
      }

      // Initialize sections
      Object.keys(categories).forEach(key => {
        changelog.sections[key] = []
      })

      // Process each commit
      for (const commit of log.all) {
        const { message, hash, author_name, author_email } = commit
        const firstLine = message.split('\n')[0].trim()

        // Extract PR number if present (GitHub-style: #123 or Pull Request #123)
        const prMatch = firstLine.match(/#(\d+)|Pull\s+Request\s+#(\d+)/i)
        const prNumber = prMatch ? prMatch[1] || prMatch[2] : null
        if (prNumber) changelog.pullRequests.add(prNumber)

        // Detect breaking changes
        let isBreaking = firstLine.includes('BREAKING CHANGE') || message.includes('BREAKING CHANGE')

        // Parse conventional commit
        let type = 'other'
        let scope = ''
        let subject = firstLine

        const match = firstLine.match(/^(\w+)(?:\(([^)]+)\))?!?:\s*(.*)/)
        if (match) {
          type = match[1]
          scope = match[2] || ''
          subject = match[3]

          // If has !, mark as breaking
          if (firstLine.includes('!')) {
            isBreaking = true
          }
        }

        // Add to breaking section if applicable
        if (isBreaking) {
          changelog.sections.breaking.push({
            hash,
            subject: subject || firstLine,
            pr: prNumber,
            author: `${author_name} <${author_email}>`,
            raw: message
          })
        } else if (categories[type]) {
          changelog.sections[type].push({
            hash,
            subject: subject || firstLine,
            scope,
            pr: prNumber,
            author: `${author_name} <${author_email}>`,
            raw: message
          })
        } else {
          changelog.sections.other.push({
            hash,
            subject: firstLine,
            pr: prNumber,
            author: `${author_name} <${author_email}>`,
            raw: message
          })
        }
      }

      // Generate markdown
      let markdown = `${changelog.title}\n\n`
      markdown += `> Comparing \`${fromTag}\` to \`${toRef}\`\n\n`

      // Add summary
      const totalCommits = log.all.length
      const totalPRs = changelog.pullRequests.size
      markdown += `**Summary:** ${totalCommits} commit${totalCommits !== 1 ? 's' : ''}`
      if (totalPRs > 0) {
        markdown += `, ${totalPRs} pull request${totalPRs !== 1 ? 's' : ''}`
      }
      markdown += '\n\n'

      // Render sections
      for (const [key, title] of Object.entries(categories)) {
        if (changelog.sections[key].length === 0) continue

        markdown += `### ${title}\n\n`
        for (const commit of changelog.sections[key]) {
          let line = `- ${commit.subject}`
          if (commit.scope) line += ` (${commit.scope})`
          if (commit.pr) line += ` ([#${commit.pr}](${REPO}/pulls/${commit.pr}))`
          line += ` ([${commit.hash.slice(0, 7)}](${REPO}/commit/${commit.hash}))`
          markdown += `${line}\n`
        }
        markdown += '\n'
      }

      // Add PR list section
      if (changelog.pullRequests.size > 0) {
        markdown += `### 🔗 Pull Requests\n\n`
        Array.from(changelog.pullRequests)
          .sort((a, b) => Number(a) - Number(b))
          .forEach(pr => {
            markdown += `- [#${pr}](${REPO}/pull/${pr})\n`
          })
        markdown += '\n'
      }

      // Show preview
      prompts.log.info('Changelog Preview:')
      console.log('\n' + markdown + '\n')

      if (!options.yes) {
        const confirmed = await prompts.confirm({
          message: 'Write this changelog to file?',
          initialValue: true
        })

        if (prompts.isCancel(confirmed) || !confirmed) {
          prompts.log.info('Changelog generation cancelled.')
          process.exit(0)
        }
      }

      if (!options.stdout) {
        let finalContent = markdown
        let outputFile = options.output

        // Determine output file if not explicitly provided
        if (!outputFile && pkgPath) {
          outputFile = path.join(pkgPath, 'CHANGELOG.md')
        } else if (!outputFile) {
          outputFile = 'CHANGELOG.md'
        }

        if (existsSync(outputFile)) {
          const existingContent = readFileSync(outputFile, 'utf8')
          // Remove existing # Changelog header if present to avoid duplication
          const cleanExisting = existingContent.replace(/^# Changelog\s+/, '')
          finalContent = `# Changelog\n\n${markdown}\n${cleanExisting}`
        } else {
          finalContent = `# Changelog\n\n${markdown}`
        }

        // Write to file
        writeFileSync(outputFile, finalContent, 'utf8')
        prompts.log.success(`Changelog written to ${outputFile}`)
      }

      prompts.outro('✅ Changelog generated successfully!')

    } catch (error) {
      prompts.log.error(`Failed to generate changelog: ${error.message}`)
      process.exit(1)
    }
  })

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  prompts.log.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`)
  process.exit(1)
})

program.parse(process.argv)

if (process.argv.length <= 2) {
  program.help()
}
