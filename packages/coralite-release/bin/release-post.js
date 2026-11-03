#!/usr/bin/env node

import * as prompts from '@clack/prompts'
import { simpleGit } from 'simple-git'
import { program } from 'commander'
import { writeFileSync, readFileSync, existsSync } from 'fs'
import path from 'path'
import { globSync } from 'glob'
import { execFileSync } from 'child_process'
import { sortTags, resolveBaselineTag, getCleanVersion } from '../lib/tags.js'
import { createOrUpdateGitHubRelease, getRepoSlug, isPrerelease } from '../lib/github.js'
import { updateChangelogData } from '../lib/changelog-entry-generator.js'

const SYSTEM_PROMPT = `You are a technical writer assisting a solo developer with Coralite project releases.
Your task is to generate a structured GitHub Release Post based on provided git commit messages and technical summaries.

### Architecture & Positioning:
- **Static-First Framing**: Always lead with compile-time static HTML output and zero runtime JavaScript by default. Treat client-side hydration, SPA navigation, and reactivity as progressive enhancements when dynamic behavior is needed.
- **Perspective**: Use a **Product-Centric** perspective (third-person/objective). Focus on what the release or the package does (e.g., "This release introduces...", "Coralite now supports..."). Avoid "I" or "we".
- **Tone**: Concise, direct, professional, understated, and factual.
- **Language**: Be ruthless with brevity. Write punchy, economical sentences. Strictly avoid passive voice, filler words ("specifically," "concurrently," "furthermore"), and marketing fluff or exaggerated claims ("actively fixing the most frustrating pain points", "O(1) precision", "revolutionary", "thrilled").
- **Formatting**: Strictly enforce the heading hierarchy (\`##\`, \`###\`, \`####\`). Do not use bolded bullet points for primary list items (e.g., \`* **Feature:** Description\`); instead, elevate them to \`####\` sub-headers for maximum scannability. Use horizontal rules (\`---\`) to visually separate major \`###\` sections.

### Content Structure:
1. **Title**: Direct H1 title with package name and version (e.g., \`# coralite vX.X.X\` or \`# create-coralite vX.X.X\`).
2. **## Release Overview**: A strict 1-2 sentence summary. Start directly with the impact or action. Frame static-first where applicable. Do not use preamble like "The goal of this release is to..." or "This release focuses on...". Just state exactly what changed.
3. **### Key Highlights**: Detailed breakdowns of the most important technical changes (features, major improvements).
    - Format each highlight with a \`#### [Highlight Title]\` header.
    - Write the primary description as standard paragraph text under the header, using standard bullet points (\`*\`) only for secondary details.
    - **Include code examples (before/after or API usage)** whenever a technical summary or diff provides enough information to do so.
4. **### Bug Fixes & Improvements**: A section for bug fixes and minor refinements.
    - Format each fix with a \`#### [Fix Title]\` header, followed by its description.
5. **### Internal Changes**: A section for refactors, internal utilities, and maintenance work.
    - Format each change with a \`#### [Change Title]\` header, followed by its description.

### Section Omission Rule:
- **Omit Empty Sections**: If a release has no commits for a category (e.g., no bug fixes, or no internal changes, or no key highlights), strictly omit that section and its surrounding horizontal rules (\`---\`). Do not emit empty headings or placeholder text.

### Rules:
- Base content strictly on the provided commit logs and technical summaries; do not hallucinate features.
- Group related commits into logical technical categories.
- Translate technical jargon into clear, concise explanations without losing precision.
- Ensure each release post feels unique by focusing on the specific changes of that version.`

function callAgy (promptText, model) {
  const agyModel = (model && model !== 'local-model') ? model : 'gemini-3.8-flash-high'
  const args = [
    '--dangerously-skip-permissions',
    '--model',
    agyModel,
    '--print',
    promptText
  ]
  try {
    const output = execFileSync('agy', args, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 20 * 1024 * 1024
    }).trim()

    if (!output) {
      throw new Error('agy CLI produced empty output')
    }
    return output
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString() : err.message
    throw new Error(`agy CLI error: ${stderr}`)
  }
}

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
  .option('--agy', 'Use the agy CLI tool to generate the release post')
  .option('-y, --yes', 'Skip confirmation')
  .option('--stdout', 'Print to stdout only, ignore output file')
  .option('--no-git', 'Skip git commit and push')
  .option('--github-release', 'Publish release post directly to GitHub Releases', false)
  .option('--website-changelog', 'Update website changelog (website/src/data/changelog.json)', false)
  .option('--json', 'Output the gathered data in JSON format instead of calling OpenAI API')
  .action(async (options) => {
    let packageName = options.package
    let pkgPath = options.path
    let useAgy = Boolean(options.agy)

    let originalWrite
    if (options.json) {
      originalWrite = process.stdout.write
      // @ts-ignore
      process.stdout.write = function (chunk, encoding, callback) {
        return process.stderr.write(chunk, encoding, callback)
      }
      if (process.stderr.isTTY) {
        Object.defineProperty(process.stdout, 'isTTY', {
          value: true,
          configurable: true
        })
      }
    }

    prompts.intro('🤖 Generating AI Release Post')

    try {
      const git = simpleGit()

      // Load framework context
      let frameworkContext = ''
      const llmsFullPath = path.join(process.cwd(), 'website/public/llms-full.txt')
      const llmsPath = path.join(process.cwd(), 'website/public/llms.txt')
      if (existsSync(llmsFullPath)) {
        frameworkContext = readFileSync(llmsFullPath, 'utf8')
      } else if (existsSync(llmsPath)) {
        frameworkContext = readFileSync(llmsPath, 'utf8')
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
      } else if (!pkgPath) {
        // Auto-detect path when package is provided via CLI
        const packageFiles = globSync('packages/*/package.json', { cwd: process.cwd() })
        for (const filepath of packageFiles) {
          try {
            const content = readFileSync(filepath, 'utf8')
            const pkg = JSON.parse(content)
            if (pkg.name === packageName) {
              pkgPath = path.dirname(filepath)
              break
            }
          } catch {
            // ignore
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
      const sortedTags = sortTags(tags.all, packageName)

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
        fromTag = resolveBaselineTag({
          sortedTags,
          packageName,
          toRef,
          fromTag
        })

        if (!fromTag) {
          if (process.env.TEST_NON_INTERACTIVE || options.yes) {
            prompts.log.error('Could not automatically determine the baseline tag for comparison. Please specify --from <tag>.')
            process.exit(1)
          }

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

      let selectedHighlights = []
      if (!process.env.TEST_NON_INTERACTIVE && !options.yes) {
        // @ts-ignore
        selectedHighlights = await prompts.multiselect({
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
      } else if (options.yes) {
        // Automatically select feat and fix commits as highlights in non-interactive mode
        selectedHighlights = log.all
          .filter(commit => /^(feat|fix)(\(|:|!)/i.test(commit.message))
          .map(commit => commit.hash)
      }

      let extraContext = ''
      if (!process.env.TEST_NON_INTERACTIVE && !options.yes) {
        // @ts-ignore
        extraContext = await prompts.text({
          message: 'Add any additional context or focus for this release (optional):',
          placeholder: 'e.g. Focus on the new reactivity system and performance improvements'
        })

        if (prompts.isCancel(extraContext)) {
          prompts.log.info('Operation cancelled')
          process.exit(0)
        }
      }

      if (!process.env.TEST_NON_INTERACTIVE && !options.json && !options.agy && !options.yes) {
        // @ts-ignore
        const selectedProvider = await prompts.select({
          message: 'Select AI provider / generator:',
          options: [
            {
              value: 'http',
              label: 'HTTP API (LM Studio / OpenAI endpoint)'
            },
            {
              value: 'agy',
              label: 'agy CLI'
            }
          ]
        })

        if (prompts.isCancel(selectedProvider)) {
          prompts.log.info('Operation cancelled')
          process.exit(0)
        }

        if (selectedProvider === 'agy') {
          useAgy = true
        }
      }

      const s = prompts.spinner()

      // Fetch and summarize highlight diffs if any
      let highlightSummaries = ''
      if (selectedHighlights && selectedHighlights.length > 0) {
        if (options.json) {
          s.start('Fetching highlight diffs...')
        } else {
          s.start('Fetching and summarizing highlight diffs...')
        }

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

          if (options.json) {
            continue
          }

          if (useAgy) {
            try {
              const systemMsg = `You are a technical assistant helping to summarize git changes for the Coralite framework. Provide a concise technical summary of the changes and suggest a relevant code example (before/after or just new API usage) if applicable.

${frameworkContext ? `### Coralite Framework Context:\n${frameworkContext}` : ''}`
              const userMsg = `Please summarize these changes for a release highlight. Commit: ${commit.message}\n\nDiff:\n${commit.diff}`
              const promptText = `${systemMsg}\n\n${userMsg}`

              const summary = callAgy(promptText, options.model)
              highlightSummaries += `\n### Highlight: ${commit.message}\n${summary}\n`
            } catch (err) {
              prompts.log.warn(`Could not generate AI summary for commit ${hash}: ${err.message}`)
            }
          } else {
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
        }
        if (options.json) {
          s.stop('Highlights fetched.')
        } else {
          s.stop('Highlights summarized.')
        }
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
        titleVersion = packageName ? `${packageName} Unreleased` : 'Unreleased'
      } else {
        const cleanVer = getCleanVersion(toRef, packageName) || toRef.replace(/^v/, '')
        titleVersion = packageName ? `${packageName} v${cleanVer}` : `v${cleanVer}`
      }

      if (options.json) {
        const outputData = {
          systemPrompt: SYSTEM_PROMPT,
          frameworkContext,
          titleVersion,
          fromTag,
          toRef,
          extraContext,
          commits: log.all.map(commit => ({
            hash: commit.hash,
            date: commit.date,
            message: commit.message,
            body: commit.body,
            author_name: commit.author_name,
            author_email: commit.author_email
          })),
          highlights: (selectedHighlights || []).map(hash => {
            const commit = log.all.find(c => c.hash === hash)
            return {
              hash: commit.hash,
              message: commit.message,
              body: commit.body,
              diff: commit.diff
            }
          })
        }

        const jsonString = JSON.stringify(outputData, null, 2)

        if (options.output) {
          writeFileSync(options.output, jsonString + '\n', 'utf8')
          if (originalWrite) {
            process.stdout.write = originalWrite
          }
          prompts.log.success(`Release data written to ${options.output}`)
        } else {
          if (originalWrite) {
            process.stdout.write = originalWrite
          }
          console.log(jsonString)
        }
        process.exit(0)
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

      s.start(`Generating full release post via AI (${useAgy ? 'agy CLI' : 'HTTP API'})...`)

      try {
        let markdown = ''
        if (useAgy) {
          const combinedPrompt = `${SYSTEM_PROMPT}\n\n${userMessage}`
          markdown = callAgy(combinedPrompt, options.model)
        } else {
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
          markdown = data.choices[0].message.content
        }

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

          writeFileSync(outputFile, markdown.trimEnd() + '\n', 'utf8')
          prompts.log.success(`Release post written to ${outputFile}`)

          if (options.git) {
            let shouldCommit = Boolean(options.yes)
            if (!options.yes) {
              const confirmCommit = await prompts.confirm({
                message: 'Commit and push the release post?',
                initialValue: true
              })
              shouldCommit = Boolean(confirmCommit && !prompts.isCancel(confirmCommit))
            }

            if (shouldCommit) {
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

          if (toRef && toRef !== 'HEAD') {
            let shouldPostToGithub = Boolean(options.githubRelease)
            if (!options.githubRelease && !options.yes) {
              const confirmGh = await prompts.confirm({
                message: `Publish this release post to GitHub Releases for tag "${toRef}"?`,
                initialValue: true
              })
              shouldPostToGithub = Boolean(confirmGh && !prompts.isCancel(confirmGh))
            }

            if (shouldPostToGithub) {
              try {
                prompts.log.step(`Publishing GitHub release for ${toRef}...`)
                const repoSlug = getRepoSlug(process.cwd())
                const ghResult = await createOrUpdateGitHubRelease({
                  tag: toRef,
                  title: `${packageName} v${getCleanVersion(toRef, packageName)}`,
                  body: markdown,
                  prerelease: isPrerelease(toRef),
                  repoSlug
                })

                if (ghResult.success) {
                  prompts.log.success(`✅ Successfully published GitHub Release: ${ghResult.htmlUrl}`)
                } else if (ghResult.webUrl) {
                  prompts.log.warn(`⚠️ ${ghResult.error}`)
                  prompts.log.info(`🔗 Open this link to create the release manually:\n   ${ghResult.webUrl}`)
                } else {
                  prompts.log.error(`❌ Failed to publish GitHub Release: ${ghResult.error}`)
                }
              } catch (ghErr) {
                prompts.log.error(`GitHub release error: ${ghErr.message}`)
              }
            }

            let shouldUpdateChangelog = Boolean(options.websiteChangelog)
            if (!options.websiteChangelog && !options.yes) {
              const confirmWebsite = await prompts.confirm({
                message: 'Update website changelog (website/src/data/changelog.json) with this release?',
                initialValue: true
              })
              shouldUpdateChangelog = Boolean(confirmWebsite && !prompts.isCancel(confirmWebsite))
            }

            if (shouldUpdateChangelog) {
              try {
                prompts.log.step('Updating website changelog...')
                updateChangelogData({
                  version: getCleanVersion(toRef, packageName),
                  packageName,
                  markdown
                })
                prompts.log.success('✅ Successfully updated website changelog')
              } catch (clErr) {
                prompts.log.error(`Website changelog error: ${clErr.message}`)
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
      if (originalWrite) {
        process.stdout.write = originalWrite
      }
      prompts.log.error(`Failed to generate release post: ${error.message}`)
      process.exit(1)
    }
  })

process.on('unhandledRejection', (reason, promise) => {
  prompts.log.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`)
  process.exit(1)
})

program.parse(process.argv)
