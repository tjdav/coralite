#!/usr/bin/env node

import * as prompts from '@clack/prompts'
import { simpleGit } from 'simple-git'
import { program } from 'commander'
import { writeFileSync, readFileSync } from 'fs'
import path from 'path'
import { globSync } from 'glob'

const SYSTEM_PROMPT = `You are a technical writer assisting a solo developer with Coralite project releases.
Your task is to generate a structured GitHub Release Post based on provided git commit messages and technical summaries.

### Style Guidelines:
- **Perspective**: Use "I" (first person singular), never "we." Coralite is a one-person project.
- **Tone**: Direct, professional, and understated (European style).
- **Language**: Avoid "hyper" or "marketing" language. Do not use words like "thrilled," "huge," "significant," "game-changer," or "pioneering." Stick to the technical facts.
- **Formatting**: Use Markdown with clear headers and bullet points for scannability.

### Content Structure:
1. **Title**: Direct title including the version number.
2. **Introduction**: A concise paragraph (2-3 sentences) summarizing the focus of the release. If a specific focus is provided in the context, emphasize it here.
3. **Key Highlights**: Detailed bullet points for the most important technical changes. **Include code examples (before/after or API usage)** whenever a technical summary for a highlight provides enough information to do so. This is crucial for making the release useful.
4. **Bug Fixes & Improvements**: A section for fixes and minor refinements.
5. **Internal Changes**: A section for refactors, utility migrations, and maintenance work (avoiding "Under the Hood").

### Rules:
- Base content strictly on the provided commit logs and technical summaries; do not hallucinate features.
- Group related commits into logical technical categories.
- Translate technical jargon into clear, concise explanations without losing precision.
- Use the original context from commit descriptions and technical summaries to explain *why* a change was made if it improves clarity.
- Ensure each release post feels unique by focusing on the specific "star" features of that version.`

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
  .option('--no-git', 'Skip git commit and push')
  .action(async (options) => {
    let packageName = options.package
    let pkgPath = options.path

    prompts.intro('🤖 Generating AI Release Post')

    try {
      const git = simpleGit()

      // Load framework context if available
      let frameworkContext = ''
      try {
        const llmsPath = path.join(process.cwd(), 'packages/coralite/llms.txt')
        frameworkContext = readFileSync(llmsPath, 'utf8')
      } catch {
        // ignore if not found
      }

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
            } catch {
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

      const selectedHighlights = await prompts.multiselect({
        message: 'Select commits to highlight with extra detail/code examples (optional):',
        options: log.all.map(commit => ({
          value: commit.hash,
          label: commit.message,
          hint: commit.body ? commit.body.trim().split('\n')[0].slice(0, 60) : ''
        })),
        required: false
      })

      if (prompts.isCancel(selectedHighlights)) {
        prompts.log.info('Operation cancelled')
        process.exit(0)
      }

      const extraContext = await prompts.text({
        message: 'Add any additional context or focus for this release (optional):',
        placeholder: 'e.g. Focus on the new reactivity system and performance improvements'
      })

      if (prompts.isCancel(extraContext)) {
        prompts.log.info('Operation cancelled')
        process.exit(0)
      }

      const s = prompts.spinner()

      // Fetch and summarize highlight diffs if any
      let highlightSummaries = ''
      if (selectedHighlights && selectedHighlights.length > 0) {
        s.start('Fetching and summarizing highlight diffs...')

        for (const hash of selectedHighlights) {
          const commit = log.all.find(c => c.hash === hash)
          const diff = await git.show([hash, '--', pkgPath || '.'])

          // Filter diff to exclude noise (e.g. package-lock.json, assets)
          const filteredDiff = diff
            .split('diff --git')
            .filter(part => {
              if (!part.trim()) {
                return false
              }
              const firstLine = part.split('\n')[0]
              const isNoise = /package-lock\.json|pnpm-lock\.yaml|yarn\.lock|\.png|\.jpg|\.jpeg|\.gif|\.svg|\.pdf/.test(firstLine)
              return !isNoise
            })
            .map(part => 'diff --git' + part)
            .join('\n')
            .slice(0, 5000)

          // We'll summarize this later in the next step, for now just collect
          // @ts-ignore
          commit.diff = filteredDiff

          try {
            const summaryResponse = await fetch(`${options.apiEndpoint}/chat/completions`, {
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
                    content: `You are a technical assistant helping to summarize git changes for the Coralite framework. Provide a concise technical summary of the changes and suggest a relevant code example (before/after or just new API usage) if applicable.

${frameworkContext ? `### Coralite Framework Context:\n${frameworkContext}` : ''}`
                  },
                  {
                    role: 'user',
                    content: `Please summarize these changes for a release highlight. Commit: ${commit.message}\n\nDiff:\n${commit.diff}`
                  }
                ],
                temperature: 0.3
              })
            })

            if (summaryResponse.ok) {
              const summaryData = await summaryResponse.json()
              const summary = summaryData.choices[0].message.content
              highlightSummaries += `\n### Highlight: ${commit.message}\n${summary}\n`
            }
          } catch (err) {
            prompts.log.warn(`Could not generate AI summary for commit ${hash}: ${err.message}`)
          }
        }
        s.stop('Highlights summarized.')
      }

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

      let userMessage = `Please generate a release post for version ${titleVersion} comparing changes from ${fromTag} to ${toRef}.`

      if (extraContext) {
        userMessage += `\n\nAdditional Context/Focus: ${extraContext}`
      }

      if (highlightSummaries) {
        userMessage += `\n\nTechnical Summaries for Key Highlights:\n${highlightSummaries}`
      }

      if (frameworkContext) {
        userMessage += `\n\nCoralite Framework Reference:\n${frameworkContext}`
      }

      userMessage += `\n\nFull Commit List:\n${commitsText}`

      s.start('Generating full release post via AI...')

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

          if (options.git) {
            const shouldCommit = await prompts.confirm({
              message: 'Commit and push the release post?',
              initialValue: true
            })

            if (shouldCommit && !prompts.isCancel(shouldCommit)) {
              try {
                prompts.log.step('Committing release post...')
                await git.add(outputFile)
                const commitResult = await git.commit(`docs: add release post for ${titleVersion}`)

                if (commitResult.commit) {
                  prompts.log.success(`✅ Committed release post (${commitResult.commit})`)
                } else {
                  prompts.log.info('Release post already up to date in git')
                }

                prompts.log.step('Pushing to remote...')
                const status = await git.status()
                await git.push('origin', status.current)

                prompts.log.success('✅ Successfully pushed release post')
              } catch (error) {
                prompts.log.error(`Failed to commit/push release post: ${error.message}`)
              }
            }
          }
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
