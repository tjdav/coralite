import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import semver from 'semver'

function sortTags (tags, packageName) {
  const prefixRegex = packageName ? new RegExp(`^${packageName}-v`) : /^v/
  return tags
    .filter(tag => {
      if (packageName && !tag.startsWith(`${packageName}-v`)) return false
      const cleaned = tag.replace(prefixRegex, '')
      return Boolean(semver.valid(cleaned))
    })
    .sort((a, b) => {
      const cleanA = a.replace(prefixRegex, '')
      const cleanB = b.replace(prefixRegex, '')
      return semver.rcompare(cleanA, cleanB)
    })
}

function resolveFromTag (sortedTags, packageName, toRef, nextVersion, explicitFrom) {
  if (explicitFrom) return explicitFrom

  const getCleanVersion = (tagOrVer) => {
    if (!tagOrVer) return null
    const prefixRegex = packageName ? new RegExp(`^${packageName}-v`) : /^v/
    const cleaned = tagOrVer.replace(prefixRegex, '')
    return semver.clean(cleaned) || cleaned
  }

  let targetVersion = null
  if (nextVersion) {
    targetVersion = semver.clean(nextVersion) || nextVersion
  } else if (toRef && toRef !== 'HEAD') {
    targetVersion = getCleanVersion(toRef)
  }

  const isStableTarget = Boolean(targetVersion && semver.valid(targetVersion) && !semver.prerelease(targetVersion))

  if (isStableTarget) {
    const previousStableTag = sortedTags.find(tag => {
      const cleaned = getCleanVersion(tag)
      return Boolean(semver.valid(cleaned) && !semver.prerelease(cleaned) && cleaned !== targetVersion)
    })
    if (previousStableTag) {
      return previousStableTag
    }
  }

  // Fallback / default to previous immediate tag
  const toIndex = sortedTags.indexOf(toRef)
  if (toRef === 'HEAD') {
    return sortedTags[0]
  } else if (toIndex !== -1 && toIndex + 1 < sortedTags.length) {
    return sortedTags[toIndex + 1]
  }

  return sortedTags[0]
}

describe('Tag sorting and baseline resolution', () => {
  it('should correctly sort mixed tags using semver.rcompare', () => {
    const tags = [
      'coralite-v0.47.1',
      'coralite-v0.48.0-rc.0',
      'coralite-v0.48.0',
      'coralite-v0.48.0-rc.1'
    ]

    const sorted = sortTags(tags, 'coralite')

    assert.deepEqual(sorted, [
      'coralite-v0.48.0',
      'coralite-v0.48.0-rc.1',
      'coralite-v0.48.0-rc.0',
      'coralite-v0.47.1'
    ])
  })

  it('should filter out non-matching package prefixes and invalid semver tags', () => {
    const tags = [
      'coralite-v0.47.1',
      'otherpkg-v1.0.0',
      'coralite-vINVALID',
      'coralite-v0.48.0'
    ]

    const sorted = sortTags(tags, 'coralite')

    assert.deepEqual(sorted, [
      'coralite-v0.48.0',
      'coralite-v0.47.1'
    ])
  })

  it('should select previous stable tag as baseline for graduating stable releases', () => {
    const sortedTags = [
      'coralite-v0.48.0-rc.1',
      'coralite-v0.48.0-rc.0',
      'coralite-v0.47.1',
      'coralite-v0.47.0'
    ]

    // Graduating to stable 0.48.0
    const baseline = resolveFromTag(sortedTags, 'coralite', 'HEAD', '0.48.0')
    assert.equal(baseline, 'coralite-v0.47.1')
  })

  it('should select immediate previous tag as baseline for intermediate RC releases', () => {
    const sortedTags = [
      'coralite-v0.48.0-rc.0',
      'coralite-v0.47.1',
      'coralite-v0.47.0'
    ]

    // Generating release for RC 0.48.0-rc.1
    const baseline = resolveFromTag(sortedTags, 'coralite', 'HEAD', '0.48.0-rc.1')
    assert.equal(baseline, 'coralite-v0.48.0-rc.0')
  })
})
