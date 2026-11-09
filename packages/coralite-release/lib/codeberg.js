import { execSync } from 'child_process'
import { readFileSync, existsSync } from 'fs'
import path from 'path'
import {
  isPrerelease,
  extractChangelogSection,
  stripLeadingHeading,
  matchesReleaseVersion
} from './github.js'

export {
  isPrerelease,
  extractChangelogSection,
  stripLeadingHeading,
  matchesReleaseVersion
}

/**
 * Parses owner and repo slug from a Codeberg URL or string.
 * @param {string} url - Git URL or slug (e.g., "git@codeberg.org:owner/repo.git" or "https://codeberg.org/owner/repo")
 * @returns {{ owner: string, repo: string } | null} Parsed slug or null if invalid
 */
export function parseCodebergRepoSlug (url) {
  if (!url || typeof url !== 'string') {
    return null
  }

  const cleanUrl = url.trim().replace(/\.git$/, '')
  const codebergMatch = cleanUrl.match(/(?:codeberg\.org[/:])([^/]+)\/([^/]+)$/)
  if (codebergMatch) {
    return {
      owner: codebergMatch[1],
      repo: codebergMatch[2]
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
 * Resolves Codeberg repository owner and repo name from git remote or package.json.
 * @param {string} [rootDir=process.cwd()] - Monorepo root directory
 * @returns {{ owner: string, repo: string }} Repository owner and repo name
 */
export function getCodebergRepoSlug (rootDir = process.cwd()) {
  const defaultSlug = {
    owner: 'tjdavid',
    repo: 'coralite'
  }

  // 1. Check git remote "codeberg"
  try {
    const remoteUrl = execSync('git remote get-url codeberg', {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim()
    const parsed = parseCodebergRepoSlug(remoteUrl)
    if (parsed) {
      return parsed
    }
  } catch {
    // Fallback to origin or package.json
  }

  // 2. Check package.json if it specifies codeberg
  const pkgJsonPath = path.join(rootDir, 'package.json')
  if (existsSync(pkgJsonPath)) {
    try {
      const content = readFileSync(pkgJsonPath, 'utf8')
      const pkg = JSON.parse(content)
      const repoUrl = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url
      if (repoUrl && repoUrl.includes('codeberg.org')) {
        const parsed = parseCodebergRepoSlug(repoUrl)
        if (parsed) {
          return parsed
        }
      }
    } catch {
      // Fallback
    }
  }

  return defaultSlug
}

/**
 * Creates or updates a release on Codeberg via its REST API.
 * @param {Object} options - Release options
 * @param {string} options.tag - Git tag name (required)
 * @param {string} [options.title] - Release title (defaults to tag)
 * @param {string} [options.body] - Release description / notes
 * @param {boolean} [options.prerelease] - Whether release is a prerelease
 * @param {boolean} [options.draft=false] - Whether release is a draft
 * @param {string} [options.token] - Codeberg access token (defaults to process.env.CODEBERG_TOKEN)
 * @param {{ owner: string, repo: string }} [options.repoSlug] - Target repo owner/name
 * @param {Function} [options.fetchFn] - Custom fetch function for testing
 * @returns {Promise<{ success: boolean, action?: 'created'|'updated', htmlUrl?: string, error?: string, webUrl?: string }>} Result
 */
export async function createOrUpdateCodebergRelease ({
  tag,
  title = '',
  body = '',
  prerelease = null,
  draft = false,
  token = null,
  repoSlug = null,
  fetchFn = null
}) {
  if (!tag) {
    throw new Error('createOrUpdateCodebergRelease requires a "tag" parameter')
  }

  const repo = repoSlug || getCodebergRepoSlug()
  const releaseTitle = title || tag
  const isPre = prerelease !== null ? prerelease : isPrerelease(tag)
  const cbToken = token || process.env.CODEBERG_TOKEN
  const cleanedBody = stripLeadingHeading(body, tag, releaseTitle)

  const activeFetch = fetchFn || (typeof globalThis.fetch === 'function' ? globalThis.fetch : null)

  if (cbToken && activeFetch) {
    const apiBase = `https://codeberg.org/api/v1/repos/${repo.owner}/${repo.repo}/releases`
    const headers = {
      Accept: 'application/json',
      Authorization: `token ${cbToken}`,
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
          error: `Codeberg API error updating release (${patchRes.status}): ${errorText}`
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
          error: `Codeberg API error creating release (${createRes.status}): ${errorText}`
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
      error: `Codeberg API error checking release (${checkRes.status}): ${checkErrorText}`
    }
  }

  const encodedTag = encodeURIComponent(tag)
  const encodedTitle = encodeURIComponent(releaseTitle)
  const encodedBody = encodeURIComponent(cleanedBody)
  const webUrl = `https://codeberg.org/${repo.owner}/${repo.repo}/releases/new?tag=${encodedTag}&title=${encodedTitle}&body=${encodedBody}`

  return {
    success: false,
    error: 'No CODEBERG_TOKEN found. Set CODEBERG_TOKEN to enable automated posting.',
    webUrl
  }
}
