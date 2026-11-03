#!/usr/bin/env node

import { existsSync, copyFileSync, unlinkSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'
import semver from 'semver'
import { parseArgs } from 'node:util'
import {
  createOrUpdateGitHubRelease,
  extractChangelogSection,
  getRepoSlug,
  isPrerelease
} from '../lib/github.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '../../..')

/**
 * Print CLI help documentation.
 */
function printHelp () {
  console.log(`
Usage: coralite-publish [options]

Options:
  --package <name>    Specify package to publish (e.g. coralite, coralite-scripts)
  --registry <name>   Registry to publish to: "npmjs" (default) or "codeberg"
  --tag <tag>         Override dist-tag (e.g. latest, rc, beta)
  --tag-ref <ref>     Git tag reference (e.g. coralite-v0.48.0-rc.0)
  --skip-build        Skip package build step
  --dry-run           Simulate publish process without uploading
  --github-release    Publish release to GitHub Releases after npm publish
  --no-github-release Skip publishing to GitHub Releases
  --notes <path>      Path to release notes file for GitHub release
  --help              Show this help message
`)
}

/**
 * Parse package name and version from a git tag reference.
 * @param {string} tagRef - Git tag ref string.
 * @returns {{ packageName: string, version: string } | null} Parsed package and version.
 */
export function parseTagRef (tagRef) {
  if (!tagRef) {
    return null
  }
  const cleanedRef = tagRef.replace(/^refs\/tags\//, '')
  const match = cleanedRef.match(/^(.+?)-v(\d+\.\d+\.\d+.*)$/)
  if (!match) {
    return null
  }
  return {
    packageName: match[1],
    version: match[2]
  }
}

/**
 * Determine the npm dist-tag from semver version string or explicit tag override.
 * @param {string} version - Semver version string.
 * @param {string} [overrideTag] - Explicit tag override.
 * @returns {string} Target dist-tag.
 */
export function determineTag (version, overrideTag = null) {
  if (overrideTag) {
    return overrideTag
  }
  const prerelease = semver.prerelease(version)
  if (prerelease && prerelease.length > 0) {
    const preId = String(prerelease[0])
    return preId
  }
  return 'latest'
}

/**
 * Get the absolute directory path of a workspace package.
 * @param {string} packageName - Name of the package.
 * @param {string} [root] - Root directory of the repository.
 * @returns {string} Absolute path to package directory.
 */
export function getPackagePath (packageName, root = rootDir) {
  try {
    const pnpmOutput = execSync(`pnpm list --filter "${packageName}" --depth -1 --json`, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    })
    const parsed = JSON.parse(pnpmOutput)
    if (parsed && parsed[0] && parsed[0].path) {
      return parsed[0].path
    }
  } catch {
    // Fallback to scanning packages/
  }

  const candidate = resolve(root, 'packages', packageName)
  if (existsSync(resolve(candidate, 'package.json'))) {
    return candidate
  }

  throw new Error(`Could not locate workspace package "${packageName}".`)
}

/**
 * Verify that all entries in package.json files array exist on disk.
 * @param {string} pkgDir - Directory of the package.
 * @param {string[]} filesList - List of files/directories declared in package.json.
 * @returns {boolean} True if all files exist.
 */
export function verifyPackageFiles (pkgDir, filesList) {
  if (!Array.isArray(filesList) || filesList.length === 0) {
    return true
  }
  const missing = []
  for (const item of filesList) {
    const itemPath = resolve(pkgDir, item)
    if (!existsSync(itemPath)) {
      missing.push(item)
    }
  }
  if (missing.length > 0) {
    throw new Error(`Pre-flight assertion failed: Missing expected package files/directories: ${missing.join(', ')}`)
  }
  return true
}

/**
 * Main publishing workflow entry point.
 */
async function main () {
  const { values } = parseArgs({
    options: {
      package: { type: 'string' },
      registry: {
        type: 'string',
        default: 'npmjs'
      },
      tag: { type: 'string' },
      'tag-ref': { type: 'string' },
      'dry-run': {
        type: 'boolean',
        default: false
      },
      'skip-build': {
        type: 'boolean',
        default: false
      },
      'github-release': {
        type: 'boolean',
        default: false
      },
      'no-github-release': {
        type: 'boolean',
        default: false
      },
      notes: {
        type: 'string'
      },
      help: {
        type: 'boolean',
        default: false
      }
    },
    allowPositionals: true
  })

  if (values.help) {
    printHelp()
    process.exit(0)
  }

  const tagRefEnv = values['tag-ref'] || process.env.TAG_REF || process.env.GITHUB_REF_NAME || ''
  const parsedTagRef = parseTagRef(tagRefEnv)

  let packageName = values.package || (parsedTagRef ? parsedTagRef.packageName : null)

  if (!packageName) {
    if (process.stdout.isTTY) {
      const { select } = await import('@clack/prompts')
      const chosen = await select({
        message: 'Select package to publish:',
        options: [
          {
            value: 'coralite',
            label: 'coralite'
          },
          {
            value: 'coralite-scripts',
            label: 'coralite-scripts'
          },
          {
            value: 'create-coralite',
            label: 'create-coralite'
          }
        ]
      })
      if (typeof chosen === 'symbol') {
        console.log('Cancelled.')
        process.exit(0)
      }
      packageName = chosen
    } else {
      console.error('Error: --package or TAG_REF environment variable is required.')
      process.exit(1)
    }
  }

  const pkgDir = getPackagePath(packageName, rootDir)
  const pkgJsonPath = resolve(pkgDir, 'package.json')
  const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf8'))

  if (pkgJson.private === true || pkgJson.private === 'true') {
    console.log(`::notice::Skipping publish for ${packageName} (Private package).`)
    process.exit(0)
  }

  const version = (parsedTagRef && parsedTagRef.packageName === packageName)
    ? parsedTagRef.version
    : pkgJson.version

  const distTag = determineTag(version, values.tag)
  const registry = values.registry || 'npmjs'
  const isDryRun = values['dry-run']

  const copiedLlmsFiles = []
  const createdNpmrcFiles = []

  const cleanup = () => {
    for (const target of copiedLlmsFiles) {
      if (existsSync(target)) {
        try {
          unlinkSync(target)
          console.log(`✔ Cleaned up temporary asset: ${target}`)
        } catch (err) {
          console.warn(`⚠️ Failed to cleanup ${target}: ${err.message}`)
        }
      }
    }
    copiedLlmsFiles.length = 0
    for (const npmrcPath of createdNpmrcFiles) {
      if (existsSync(npmrcPath)) {
        try {
          unlinkSync(npmrcPath)
          console.log(`✔ Cleaned up temporary npmrc: ${npmrcPath}`)
        } catch (err) {
          console.warn(`⚠️ Failed to cleanup ${npmrcPath}: ${err.message}`)
        }
      }
    }
  }

  process.on('SIGINT', () => {
    cleanup()
    process.exit(1)
  })
  process.on('SIGTERM', () => {
    cleanup()
    process.exit(1)
  })

  try {
    if (packageName === 'coralite') {
      for (const file of ['llms.txt', 'llms-full.txt']) {
        const source = resolve(rootDir, `website/public/${file}`)
        const target = resolve(pkgDir, file)
        if (existsSync(source)) {
          copyFileSync(source, target)
          copiedLlmsFiles.push(target)
          console.log(`✔ Copied website/public/${file} -> ${target}`)
        }
      }
    }

    if (!values['skip-build']) {
      console.log(`🔨 Building ${packageName}...`)
      execSync(`pnpm --filter "${packageName}..." run --if-present build`, {
        cwd: rootDir,
        stdio: 'inherit'
      })
    } else {
      console.log(`⏩ Skipping build for ${packageName} (--skip-build)`)
    }

    console.log(`🔍 Verifying package contents for ${packageName}...`)
    verifyPackageFiles(pkgDir, pkgJson.files)

    const npmToken = process.env.NPM_TOKEN || process.env.NODE_AUTH_TOKEN
    const codebergToken = process.env.CODEBERG_TOKEN

    if (registry === 'npmjs') {
      if (!isDryRun) {
        if (!npmToken) {
          throw new Error('NPM_TOKEN or NODE_AUTH_TOKEN environment variable is required to publish to npmjs.')
        }
        const npmrcContent = `//registry.npmjs.org/:_authToken=${npmToken}\nregistry=https://registry.npmjs.org/\n`
        const pkgNpmrc = resolve(pkgDir, '.npmrc')
        const rootNpmrc = resolve(rootDir, '.npmrc')
        if (!existsSync(pkgNpmrc)) {
          writeFileSync(pkgNpmrc, npmrcContent, 'utf8')
          createdNpmrcFiles.push(pkgNpmrc)
        }
        if (!existsSync(rootNpmrc)) {
          writeFileSync(rootNpmrc, npmrcContent, 'utf8')
          createdNpmrcFiles.push(rootNpmrc)
        }
        try {
          execSync(`pnpm config set //registry.npmjs.org/:_authToken "${npmToken}"`, { stdio: 'inherit' })
          execSync(`npm config set //registry.npmjs.org/:_authToken "${npmToken}"`, { stdio: 'inherit' })
        } catch {
          // ignore config set errors if .npmrc is placed
        }
      }
    } else if (registry === 'codeberg') {
      if (!isDryRun) {
        if (!codebergToken) {
          throw new Error('CODEBERG_TOKEN environment variable is required to publish to Codeberg.')
        }
        const npmrcContent = `//codeberg.org/api/packages/tjdavid/npm/:_authToken=${codebergToken}\nregistry=https://codeberg.org/api/packages/tjdavid/npm/\nfetch-retries=0\nfetch-timeout=600000\n`
        const pkgNpmrc = resolve(pkgDir, '.npmrc')
        const rootNpmrc = resolve(rootDir, '.npmrc')
        if (!existsSync(pkgNpmrc)) {
          writeFileSync(pkgNpmrc, npmrcContent, 'utf8')
          createdNpmrcFiles.push(pkgNpmrc)
        }
        if (!existsSync(rootNpmrc)) {
          writeFileSync(rootNpmrc, npmrcContent, 'utf8')
          createdNpmrcFiles.push(rootNpmrc)
        }
        try {
          execSync('npm config set registry https://codeberg.org/api/packages/tjdavid/npm/', { stdio: 'inherit' })
          execSync(`npm config set //codeberg.org/api/packages/tjdavid/npm/:_authToken "${codebergToken}"`, { stdio: 'inherit' })
          execSync('npm config set fetch-retries 0', { stdio: 'inherit' })
          execSync('npm config set fetch-timeout 600000', { stdio: 'inherit' })
        } catch {
          // ignore config set errors if .npmrc is placed
        }
      }
    } else {
      throw new Error(`Unsupported registry: ${registry}. Allowed options: "npmjs", "codeberg".`)
    }

    if (isDryRun) {
      console.log(`\n[DRY RUN] Would publish ${packageName}@${version} to ${registry} with tag "${distTag}"`)
      console.log(`[DRY RUN] Package directory: ${pkgDir}`)
      console.log(`[DRY RUN] Declared files verified: ${JSON.stringify(pkgJson.files || [])}`)
    } else {
      console.log(`🚀 Publishing ${packageName}@${version} to ${registry} (tag: ${distTag})...`)

      if (registry === 'npmjs') {
        execSync(`pnpm publish --registry https://registry.npmjs.org/ --tag ${distTag} --access public --no-git-checks --no-provenance`, {
          cwd: pkgDir,
          stdio: 'inherit',
          env: {
            ...process.env,
            NODE_AUTH_TOKEN: npmToken,
            NPM_TOKEN: npmToken
          }
        })
      } else if (registry === 'codeberg') {
        try {
          execSync(`npm publish --registry https://codeberg.org/api/packages/tjdavid/npm/ --tag ${distTag}`, {
            cwd: pkgDir,
            stdio: 'inherit'
          })
          console.log(`::notice::Successfully published ${packageName}@${version} to Codeberg.`)
        } catch {
          console.log('⚠️ npm publish reported a failure (Likely a Codeberg E500 false-negative). Polling registry...')
          const maxRetries = 4
          const sleepSec = 5
          let verified = false

          for (let attempt = 1; attempt <= maxRetries; attempt++) {
            console.log(`Attempt ${attempt} of ${maxRetries}: Waiting ${sleepSec} seconds for Codeberg to settle...`)
            execSync(`node -e "setTimeout(() => {}, ${sleepSec * 1000})"`)

            try {
              execSync(`npm view "${packageName}@${version}" version --registry https://codeberg.org/api/packages/tjdavid/npm/`, { stdio: 'ignore' })
              console.log(`::notice::Verified! ${packageName}@${version} is live on Codeberg despite the initial E500.`)
              verified = true
              break
            } catch {
              // Retry loop continues
            }
          }

          if (!verified) {
            throw new Error(`Publish failed permanently. Version ${packageName}@${version} not found on Codeberg after retries.`)
          }
        }
      }
    }

    const targetTag = (parsedTagRef && parsedTagRef.packageName === packageName)
      ? tagRefEnv
      : `${packageName}-v${version}`

    let shouldPostGitHub = values['github-release']
    if (!shouldPostGitHub && !values['no-github-release'] && process.stdout.isTTY && registry === 'npmjs') {
      const { confirm } = await import('@clack/prompts')
      const chosenConfirm = await confirm({
        message: `Post GitHub Release for "${targetTag}"?`,
        initialValue: true
      })
      shouldPostGitHub = Boolean(chosenConfirm && typeof chosenConfirm !== 'symbol')
    }

    if (shouldPostGitHub) {
      const repoSlug = getRepoSlug(rootDir)
      if (isDryRun) {
        console.log(`\n[DRY RUN] Would create GitHub Release for "${targetTag}" on ${repoSlug.owner}/${repoSlug.repo}`)
      } else {
        console.log(`\n📦 Preparing GitHub Release for ${targetTag}...`)
        let releaseBody = ''

        if (values.notes && existsSync(values.notes)) {
          releaseBody = readFileSync(values.notes, 'utf8')
        } else {
          const pkgReleasePost = resolve(pkgDir, 'RELEASE_POST.md')
          const rootReleasePost = resolve(rootDir, 'RELEASE_POST.md')

          if (existsSync(pkgReleasePost)) {
            const content = readFileSync(pkgReleasePost, 'utf8')
            if (content.includes(`v${version}`)) {
              releaseBody = content
            }
          }

          if (!releaseBody && existsSync(rootReleasePost)) {
            const content = readFileSync(rootReleasePost, 'utf8')
            if (content.includes(`v${version}`)) {
              releaseBody = content
            }
          }

          if (!releaseBody) {
            const pkgChangelog = resolve(pkgDir, 'CHANGELOG.md')
            const rootChangelog = resolve(rootDir, 'CHANGELOG.md')
            const targetChangelog = existsSync(pkgChangelog) ? pkgChangelog : rootChangelog

            if (existsSync(targetChangelog)) {
              const changelogContent = readFileSync(targetChangelog, 'utf8')
              const section = extractChangelogSection(changelogContent, version)
              if (section) {
                releaseBody = `## ${packageName} v${version}\n\n${section}`
              }
            }
          }

          if (!releaseBody) {
            releaseBody = `## ${packageName} v${version}\n\nAutomated release for \`${targetTag}\`.`
          }
        }

        const ghResult = await createOrUpdateGitHubRelease({
          tag: targetTag,
          title: `${packageName} v${version}`,
          body: releaseBody,
          prerelease: isPrerelease(version),
          repoSlug
        })

        if (ghResult.success) {
          console.log(`✔ Successfully ${ghResult.action} GitHub Release: ${ghResult.htmlUrl}`)
        } else if (ghResult.webUrl) {
          console.warn(`⚠️ ${ghResult.error}`)
          console.log(`🔗 Create release manually: ${ghResult.webUrl}`)
        } else {
          console.error(`❌ Failed to publish GitHub Release: ${ghResult.error}`)
        }
      }
    }
  } finally {
    cleanup()
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((err) => {
    console.error(`❌ Publish failed: ${err.message}`)
    process.exit(1)
  })
}
