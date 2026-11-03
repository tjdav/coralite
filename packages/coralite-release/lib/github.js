import { execSync } from 'child_process'
import { readFileSync, existsSync } from 'fs'
import path from 'path'
import semver from 'semver'

/**
 * Parses owner and repo slug from a GitHub URL or string.
 * @param {string} url - Git URL or slug (e.g., "git@github.com:owner/repo.git" or "https://github.com/owner/repo")
 * @returns {{ owner: string, repo: string } | null} Parsed slug or null if invalid
 */
export function parseRepoSlug (url) {
  if (!url || typeof url !== 'string') {
    return null
  }

  const cleanUrl = url.trim().replace(/\.git$/, '')
  const githubMatch = cleanUrl.match(/(?:github\.com[/:])([^/]+)\/([^/]+)$/)
  if (githubMatch) {
    return {
      owner: githubMatch[1],
      repo: githubMatch[2]
    }
  }

  const slashMatch = cleanUrl.match(/^([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)$/)
  if (slashMatch) {
    return {
      owner: slashMatch[1],
      repo: slashMatch[2]
    }
  }

  return null
}

/**
 * Resolves repository owner and repo name from package.json or git remote.
 * @param {string} [rootDir=process.cwd()] - Monorepo root directory
 * @returns {{ owner: string, repo: string }} Repository owner and repo name
 */
export function getRepoSlug (rootDir = process.cwd()) {
  const defaultSlug = {
    owner: 'tjdav',
    repo: 'coralite'
  }
  const pkgJsonPath = path.join(rootDir, 'package.json')

  if (existsSync(pkgJsonPath)) {
    try {
      const content = readFileSync(pkgJsonPath, 'utf8')
      const pkg = JSON.parse(content)
      const repoUrl = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url
      const parsed = parseRepoSlug(repoUrl)
      if (parsed) {
        return parsed
      }
    } catch {
      // Fallback to git remote
    }
  }

  try {
    const remoteUrl = execSync('git remote get-url origin', {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim()
    const parsed = parseRepoSlug(remoteUrl)
    if (parsed) {
      return parsed
    }
  } catch {
    // Return default slug
  }

  return defaultSlug
}

/**
 * Determines whether a version string or tag is a prerelease (e.g., contains -rc, -alpha, -beta).
 * @param {string} versionOrTag - Version string or git tag
 * @returns {boolean} True if prerelease, false otherwise
 */
export function isPrerelease (versionOrTag) {
  if (!versionOrTag || typeof versionOrTag !== 'string') {
    return false
  }

  const cleaned = versionOrTag.replace(/^.*-v/, '').replace(/^v/, '')
  const parsed = semver.clean(cleaned) || cleaned
  const pre = semver.prerelease(parsed)
  return Boolean(pre && pre.length > 0)
}

/**
 * Extracts a specific version section from a markdown changelog.
 * @param {string} changelogContent - Full text content of CHANGELOG.md
 * @param {string} version - Target version number (e.g., "1.0.0-rc.10" or "v1.0.0-rc.10")
 * @returns {string|null} Extracted markdown body or null if section not found
 */
export function extractChangelogSection (changelogContent, version) {
  if (!changelogContent || typeof changelogContent !== 'string' || !version) {
    return null
  }

  const cleanVer = version.replace(/^v/, '')
  const lines = changelogContent.split(/\r?\n/)
  const startIdx = lines.findIndex(line => {
    const trimmed = line.trim()
    return trimmed === `## v${cleanVer}` ||
      trimmed === `## ${cleanVer}` ||
      trimmed.startsWith(`## v${cleanVer} `) ||
      trimmed.startsWith(`## ${cleanVer} `)
  })

  if (startIdx === -1) {
    return null
  }

  const nextSectionIdx = lines.slice(startIdx + 1).findIndex(line => /^##\s+/.test(line.trim()))
  const endIdx = nextSectionIdx === -1 ? lines.length : startIdx + 1 + nextSectionIdx

  const sectionLines = lines.slice(startIdx + 1, endIdx)
  const result = sectionLines.join('\n').trim()
  return result.length > 0 ? result : null
}

/**
 * Strips a redundant leading heading (e.g. "# coralite v1.0.0", "## coralite v1.0.0", or top-level "# Title")
 * from release notes markdown so that duplicate headings are not displayed when the title is already entered.
 * @param {string} markdown - Release notes markdown text
 * @param {string} [version] - Version string (e.g. "1.0.0" or "v1.0.0")
 * @param {string} [packageName] - Package name (e.g. "coralite" or "create-coralite")
 * @returns {string} Cleaned markdown without leading duplicate heading
 */
export function stripLeadingHeading (markdown, version = '', packageName = '') {
  if (!markdown || typeof markdown !== 'string') {
    return ''
  }

  const cleanVer = version ? version.replace(/^.*-v/, '').replace(/^v/, '').trim().toLowerCase() : ''
  const pkg = packageName ? packageName.replace(/-v[\d].*$/, '').trim().toLowerCase() : ''
  const lines = markdown.split(/\r?\n/)
  let startIndex = 0

  while (startIndex < lines.length) {
    while (startIndex < lines.length && lines[startIndex].trim() === '') {
      startIndex++
    }

    if (startIndex >= lines.length) {
      break
    }

    const line = lines[startIndex].trim()

    // Strip top-level H1 heading (# Title)
    if (line.startsWith('# ')) {
      startIndex++
      continue
    }

    // Strip H2 heading if it matches the package name or version
    if (line.startsWith('## ')) {
      const headingText = line.slice(3).trim().toLowerCase()
      const matchesVer = cleanVer && (headingText === `v${cleanVer}` || headingText === cleanVer || headingText.includes(cleanVer))
      const matchesPkg = pkg && (headingText === pkg || headingText.includes(pkg))

      if (matchesVer || matchesPkg) {
        startIndex++
        continue
      }
    }

    break
  }

  return lines.slice(startIndex).join('\n')
}

/**
 * Checks whether release post markdown content matches a target version strictly.
 * @param {string} content - Markdown content of a release post.
 * @param {string} version - Target version number (e.g. "1.0.0").
 * @returns {boolean} True if the content heading explicitly matches the version.
 */
export function matchesReleaseVersion (content, version) {
  if (!content || typeof content !== 'string' || !version) {
    return false
  }
  const cleanVer = version.replace(/^v/, '')
  const escaped = cleanVer.replace(/\./g, '\\.')
  const regex = new RegExp(`^#+\\s+.*?\\bv?${escaped}(?:\\s|$)`, 'm')
  return regex.test(content)
}

/**
 * Check whether the GitHub CLI (gh) is installed and available in PATH.
 * @returns {boolean} True if gh is available
 */
export function isGhCliAvailable () {
  try {
    execSync('gh --version', { stdio: ['pipe', 'pipe', 'pipe'] })
    return true
  } catch {
    return false
  }
}

/**
 * Creates or updates a GitHub Release for a given tag.
 * @param {Object} options - Release options
 * @param {string} options.tag - Git tag name (e.g., "coralite-v1.0.0-rc.10")
 * @param {string} [options.title] - Release title (defaults to tag)
 * @param {string} [options.body] - Release description / notes markdown
 * @param {boolean} [options.prerelease] - Whether release is marked as prerelease
 * @param {boolean} [options.draft=false] - Whether release is created as draft
 * @param {{ owner: string, repo: string }} [options.repoSlug] - GitHub owner and repo
 * @param {string} [options.token] - GitHub Personal Access Token
 * @param {Function} [options.fetchFn] - Custom fetch implementation (defaults to global fetch)
 * @param {boolean} [options.allowGhCli=true] - Whether to allow gh CLI fallback when available
 * @returns {Promise<{ success: boolean, action?: 'created'|'updated', htmlUrl?: string, error?: string, webUrl?: string }>} Result of operation
 */
export async function createOrUpdateGitHubRelease ({
  tag,
  title = null,
  body = '',
  prerelease = null,
  draft = false,
  repoSlug = null,
  token = null,
  fetchFn = null,
  allowGhCli = true
}) {
  if (!tag) {
    throw new Error('A git tag is required to create a GitHub release.')
  }

  const repo = repoSlug || getRepoSlug()
  const releaseTitle = title || tag
  const isPre = prerelease !== null ? prerelease : isPrerelease(tag)
  const ghToken = token || process.env.GITHUB_TOKEN || process.env.GH_TOKEN
  const cleanedBody = stripLeadingHeading(body, tag, releaseTitle)

  const activeFetch = fetchFn || (typeof globalThis.fetch === 'function' ? globalThis.fetch : null)

  if (ghToken && activeFetch) {
    const apiBase = `https://api.github.com/repos/${repo.owner}/${repo.repo}/releases`
    const headers = {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${ghToken}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'coralite-release-automation'
    }

    const checkRes = await activeFetch(`${apiBase}/tags/${encodeURIComponent(tag)}`, {
      method: 'GET',
      headers
    })

    if (checkRes.status === 200) {
      const existingRelease = await checkRes.json()
      const patchRes = await activeFetch(`${apiBase}/${existingRelease.id}`, {
        method: 'PATCH',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: releaseTitle,
          body: cleanedBody,
          draft,
          prerelease: isPre
        })
      })

      if (!patchRes.ok) {
        const errorText = await patchRes.text()
        return {
          success: false,
          error: `GitHub API error updating release (${patchRes.status}): ${errorText}`
        }
      }

      const updated = await patchRes.json()
      return {
        success: true,
        action: 'updated',
        htmlUrl: updated.html_url
      }
    }

    if (checkRes.status === 404) {
      const createRes = await activeFetch(apiBase, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tag_name: tag,
          name: releaseTitle,
          body: cleanedBody,
          draft,
          prerelease: isPre
        })
      })

      if (!createRes.ok) {
        const errorText = await createRes.text()
        return {
          success: false,
          error: `GitHub API error creating release (${createRes.status}): ${errorText}`
        }
      }

      const created = await createRes.json()
      return {
        success: true,
        action: 'created',
        htmlUrl: created.html_url
      }
    }

    const checkErrorText = await checkRes.text()
    return {
      success: false,
      error: `GitHub API error checking release (${checkRes.status}): ${checkErrorText}`
    }
  }

  if (allowGhCli && isGhCliAvailable()) {
    try {
      const repoFlag = `--repo ${repo.owner}/${repo.repo}`
      const draftFlag = draft ? '--draft' : ''
      const preFlag = isPre ? '--prerelease' : ''

      const viewCmd = `gh release view "${tag}" ${repoFlag} --json url`
      let releaseExists = false
      try {
        execSync(viewCmd, { stdio: ['pipe', 'pipe', 'pipe'] })
        releaseExists = true
      } catch {
        releaseExists = false
      }

      if (releaseExists) {
        execSync(`gh release edit "${tag}" ${repoFlag} --title "${releaseTitle}" --notes-file - ${draftFlag} ${preFlag}`, {
          input: cleanedBody,
          stdio: ['pipe', 'pipe', 'pipe']
        })
        const url = `https://github.com/${repo.owner}/${repo.repo}/releases/tag/${tag}`
        return {
          success: true,
          action: 'updated',
          htmlUrl: url
        }
      }

      execSync(`gh release create "${tag}" ${repoFlag} --title "${releaseTitle}" --notes-file - ${draftFlag} ${preFlag}`, {
        input: cleanedBody,
        stdio: ['pipe', 'pipe', 'pipe']
      })
      const url = `https://github.com/${repo.owner}/${repo.repo}/releases/tag/${tag}`
      return {
        success: true,
        action: 'created',
        htmlUrl: url
      }
    } catch (cliErr) {
      return {
        success: false,
        error: `gh CLI execution failed: ${cliErr.message}`
      }
    }
  }

  const encodedTag = encodeURIComponent(tag)
  const encodedTitle = encodeURIComponent(releaseTitle)
  const encodedBody = encodeURIComponent(cleanedBody)
  const webUrl = `https://github.com/${repo.owner}/${repo.repo}/releases/new?tag=${encodedTag}&title=${encodedTitle}&body=${encodedBody}`

  return {
    success: false,
    error: 'No GITHUB_TOKEN or gh CLI found. Set GITHUB_TOKEN to enable automated posting.',
    webUrl
  }
}
