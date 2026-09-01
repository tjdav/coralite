import semver from 'semver'

/**
 * Normalizes a tag or version string by stripping package prefixes and 'v' prefixes.
 * @param {string} tagOrVer - The tag or version string to normalize
 * @param {string} [packageName] - Optional package name prefix to strip
 * @returns {string|null} The cleaned semver version or null if not provided
 */
export function getCleanVersion (tagOrVer, packageName) {
  if (!tagOrVer) {
    return null
  }

  const prefixRegex = packageName ? new RegExp(`^${packageName}-v`) : /^v/
  const cleaned = tagOrVer.replace(prefixRegex, '')
  return semver.clean(cleaned) || cleaned
}

/**
 * Filters valid semver tags matching the package prefix and sorts descending using semver.rcompare.
 * @param {string[]} tags - The list of tags to filter and sort
 * @param {string} [packageName] - Optional package name prefix to filter by
 * @returns {string[]} The sorted list of valid tags
 */
export function sortTags (tags, packageName) {
  const prefixRegex = packageName ? new RegExp(`^${packageName}-v`) : /^v/
  return tags
    .filter(tag => {
      if (packageName && !tag.startsWith(`${packageName}-v`)) {
        return false
      }
      const cleaned = tag.replace(prefixRegex, '')
      return Boolean(semver.valid(cleaned))
    })
    .sort((a, b) => {
      const cleanA = a.replace(prefixRegex, '')
      const cleanB = b.replace(prefixRegex, '')
      return semver.rcompare(cleanA, cleanB)
    })
}

/**
 * Resolves the comparison baseline tag (`fromTag`) based on target version, release type, and available tags.
 * @param {Object} options
 * @param {string[]} options.sortedTags - Descending list of sorted semver tag strings
 * @param {string} [options.packageName] - Package name for prefix cleaning
 * @param {string} [options.toRef='HEAD'] - Target ref or tag
 * @param {string} [options.nextVersion=null] - Optional next version string
 * @param {string} [options.fromTag=null] - Explicitly provided starting tag
 * @param {boolean} [options.isToSameAsLatest=false] - Whether toRef commit equals sortedTags[0] commit
 * @returns {string|null} The resolved baseline tag or null if no baseline exists
 */
export function resolveBaselineTag ({
  sortedTags,
  packageName,
  toRef = 'HEAD',
  nextVersion = null,
  fromTag = null,
  isToSameAsLatest = false
}) {
  if (fromTag) {
    return fromTag
  }
  if (!sortedTags || sortedTags.length === 0) {
    return null
  }

  let targetVersion = null
  if (nextVersion) {
    targetVersion = semver.clean(nextVersion) || nextVersion
  } else if (toRef && toRef !== 'HEAD') {
    targetVersion = getCleanVersion(toRef, packageName)
  }

  const isStableTarget = Boolean(targetVersion && semver.valid(targetVersion) && !semver.prerelease(targetVersion))

  if (toRef === 'HEAD') {
    if (isStableTarget) {
      const prevStable = sortedTags.find(tag => {
        const cleaned = getCleanVersion(tag, packageName)
        return Boolean(semver.valid(cleaned) && !semver.prerelease(cleaned) && semver.lt(cleaned, targetVersion))
      })
      if (prevStable) {
        return prevStable
      }
    }

    if (!nextVersion && isToSameAsLatest) {
      return sortedTags[1] || null
    }

    return sortedTags[0]
  }

  // Find index of toRef in sortedTags (exact match first, then semver match)
  let toIndex = sortedTags.indexOf(toRef)
  if (toIndex === -1 && targetVersion) {
    toIndex = sortedTags.findIndex(tag => {
      const cleaned = getCleanVersion(tag, packageName)
      return Boolean(cleaned && semver.valid(cleaned) && semver.eq(cleaned, targetVersion))
    })
  }

  const olderTags = toIndex !== -1
    ? sortedTags.slice(toIndex + 1)
    : sortedTags.filter(tag => {
      const cleaned = getCleanVersion(tag, packageName)
      return Boolean(cleaned && semver.valid(cleaned) && targetVersion && semver.lt(cleaned, targetVersion))
    })

  if (olderTags.length > 0) {
    if (isStableTarget) {
      const prevStable = olderTags.find(tag => {
        const cleaned = getCleanVersion(tag, packageName)
        return Boolean(semver.valid(cleaned) && !semver.prerelease(cleaned))
      })
      if (prevStable) {
        return prevStable
      }
    }
    return olderTags[0]
  }

  return null
}
