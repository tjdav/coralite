#!/usr/bin/env node

import * as prompts from '@clack/prompts'
import { simpleGit } from 'simple-git'
import { program } from 'commander'
import { writeFileSync, existsSync, readFileSync } from 'fs'
import path from 'path'
import { globSync } from 'glob'

const SYSTEM_PROMPT = `You are an expert technical writer and developer advocate for the Coralite project.
Your task is to generate an engaging, well-structured GitHub Release Post based on the provided git commit messages.
The tone should be professional, and accessible to both users and developers.
Include the following structure in Markdown format:
1. A catchy title (including the new version).
2. A brief introductory paragraph summarising the overall focus and impact of this release.
3. Key Highlights: Bullet points of the most impactful features or major changes.
4. Bug Fixes & Improvements: A section for notable fixes and minor tweaks.
5. Under the Hood: For refactors, chore tasks, and internal changes.

Rules:
- Base the content entirely on the provided commit logs. Do not invent or hallucinate features.
- Group related commits together intelligently.
- Extract valuable context from the multi-line commit descriptions.
- Keep the technical explanations clear.`

program
  .name('generate-release-post')
  .description('Generate an AI-powered release post based on commits between git tags')
  .option('-f, --from <tag>', 'Starting tag (defaults to previous tag)')
  .option('-t, --to <tag>', 'Ending tag (defaults to selected new tag)')
  .option('--package <name>', 'Package name (for tag filtering)')
  .option('--path <path>', 'Package path (for commit filtering and output)')
  .option('-o, --output <file>', 'Output file (defaults to package/RELEASE_POST.md or RELEASE_POST.md)')
  .option('--api-endpoint <url>', 'OpenAI API endpoint', 'http://localhost:1234/v1')
  .option('--api-key <key>', 'OpenAI API key', 'lm-studio')
  .option('--model <model>', 'OpenAI Model to use', 'local-model')
  .option('-y, --yes', 'Skip confirmation')
  .option('--stdout', 'Print to stdout only, ignore output file')
  .action(async (options) => {
    let packageName = options.package
    let pkgPath = options.path

    prompts.intro('🤖 Generating AI Release Post')

    try {
      const git = simpleGit()

      // Prompt for package if not provided
      if (!packageName) {
        // Find all packages
        const packageFiles = globSync('packages/*/package.json', { cwd: process.cwd() })

        if (packageFiles.length > 0) {
          const packageChoices = []
          for (const filepath of packageFiles) {
            try {
              const content = readFileSync(filepath, 'utf8')
              const pkg = JSON.parse(content)
              if (pkg.name) {
                packageChoices.push({
                  value: pkg.name,
                  label: pkg.name,
                  path: path.dirname(filepath)
                })
              }
            } catch (e) {
              // ignore
            }
          }

          if (packageChoices.length > 0) {
            const selected = await prompts.select({
              message: 'Select package to generate release post for:',
              options: packageChoices
            })

            if (prompts.isCancel(selected)) {
              prompts.log.info('Operation cancelled')
              process.exit(0)
            }

            packageName = selected
            // Auto-detect path based on selection
            const selectedPkgInfo = packageChoices.find(p => p.value === selected)
            if (selectedPkgInfo && !pkgPath) {
              pkgPath = selectedPkgInfo.path
            }
          }
        }
      }

      // Get all tags
      const tags = await git.tags()
      if (!tags.all.length) {
        prompts.log.warn('No git tags found. At least one tag is required.')
        prompts.outro('No tags found')
        process.exit(1)
      }

      // Sort tags by version
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
        prompts.log.warn(`No valid semantic version tags found for package ${packageName || 'all'}.`)
        prompts.outro('Invalid tags')
        process.exit(1)
      }

      let toRef = options.to
      let fromTag = options.from

      // Prompt for toRef (the new version we are writing the post for) if not provided
      if (!toRef) {
        const tagChoices = sortedTags.map(tag => ({
          value: tag,
          label: tag
        }))
        // Also allow choosing unreleased/HEAD changes
        tagChoices.unshift({
          value: 'HEAD',
          label: 'HEAD (Unreleased)'
        })

        const selectedTo = await prompts.select({
          message: 'Select the new tag (the version you are writing the release post for):',
          options: tagChoices
        })

        if (prompts.isCancel(selectedTo)) {
          prompts.log.info('Operation cancelled')
          process.exit(0)
        }
        toRef = selectedTo
      }

      // Automatically determine fromTag if not provided
      if (!fromTag) {
        // Find the index of toRef in sorted tags to get the previous version
        const toIndex = sortedTags.indexOf(toRef)

        if (toRef === 'HEAD') {
          fromTag = sortedTags[0]
        } else if (toIndex !== -1 && toIndex + 1 < sortedTags.length) {
          // toRef is found in tags, use the one right before it (older version)
          fromTag = sortedTags[toIndex + 1]
        } else {
          // toRef is either not a standard tag, or it is the oldest tag.
          prompts.log.warn('Could not automatically determine the previous tag.')

          const fromChoices = sortedTags.map(tag => ({
            value: tag,
            label: tag
          }))
          const selectedFrom = await prompts.select({
            message: 'Select the previous tag (to compare against):',
            options: fromChoices
          })

          if (prompts.isCancel(selectedFrom)) {
            prompts.log.info('Operation cancelled')
            process.exit(0)
          }
          fromTag = selectedFrom
        }
      }

      prompts.log.info(`Generating release post for changes between ${fromTag} and ${toRef}...`)

      if (!tags.all.includes(fromTag) && fromTag !== 'HEAD') {
        prompts.log.error(`Tag "${fromTag}" not found.`)
        process.exit(1)
      }

      const logArgs = [`${fromTag}..${toRef}`]
      if (pkgPath) {
        logArgs.push('--', pkgPath)
      }

      // We use a custom format to get the full body of the commit message
      const log = await git.log({
        from: fromTag,
        to: toRef,
        file: pkgPath,
        format: {
          hash: '%H',
          date: '%aI',
          message: '%s',
          body: '%b',
          author_name: '%an',
          author_email: '%ae'
        }
      })

      if (!log.all.length) {
        prompts.log.warn(`No commits found between ${fromTag} and ${toRef}`)
        process.exit(0)
      }

      const s = prompts.spinner()
      s.start('Generating release post via AI...')

      // Format commits for the AI
      const commitsText = log.all.map(commit => {
        let text = `- ${commit.message}`
        if (commit.body && commit.body.trim()) {
          text += `\n  Details: ${commit.body.trim().replace(/\n/g, '\n  ')}`
        }
        return text
      }).join('\n\n')

      let titleVersion = toRef
      if (toRef === 'HEAD') {
        titleVersion = 'Unreleased'
      } else {
        titleVersion = `v${toRef.replace(/^v/, '')}`
      }

      const userMessage = `Please generate a release post for version ${titleVersion} comparing changes from ${fromTag} to ${toRef}.

Here are the commits:

${commitsText}`

      try {
        const response = await fetch(`${options.apiEndpoint}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${options.apiKey}`
          },
          body: JSON.stringify({
            model: options.model,
            messages: [
              {
                role: 'system',
                content: SYSTEM_PROMPT
              },
              {
                role: 'user',
                content: userMessage
              }
            ],
            temperature: 0.7
          })
        })

        if (!response.ok) {
          throw new Error(`API returned ${response.status}: ${await response.text()}`)
        }

        const data = await response.json()
        const markdown = data.choices[0].message.content

        s.stop('Release post generated!')

        prompts.log.info('Release Post Preview:')
        console.log('\n' + markdown + '\n')

        if (!options.yes) {
          const confirmed = await prompts.confirm({
            message: 'Write this release post to file?',
            initialValue: true
          })

          if (prompts.isCancel(confirmed) || !confirmed) {
            prompts.log.info('Release post generation cancelled.')
            process.exit(0)
          }
        }

        if (!options.stdout) {
          let outputFile = options.output

          if (!outputFile && pkgPath) {
            outputFile = path.join(pkgPath, 'RELEASE_POST.md')
          } else if (!outputFile) {
            outputFile = 'RELEASE_POST.md'
          }

          writeFileSync(outputFile, markdown, 'utf8')
          prompts.log.success(`Release post written to ${outputFile}`)
        }

        prompts.outro('✅ Release post generated successfully!')
      } catch (error) {
        s.stop('Failed to generate release post')
        throw error
      }

    } catch (error) {
      prompts.log.error(`Failed to generate release post: ${error.message}`)
      process.exit(1)
    }
  })

process.on('unhandledRejection', (reason, promise) => {
  prompts.log.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`)
  process.exit(1)
})

program.parse(process.argv)
