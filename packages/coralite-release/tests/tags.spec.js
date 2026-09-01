import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { sortTags, resolveBaselineTag } from '../lib/tags.js'

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

  it('1. Selecting an existing historical stable release (e.g. toRef = "coralite-v0.46.2" -> baseline "coralite-v0.46.1")', () => {
    const sortedTags = [
      'coralite-v0.47.1',
      'coralite-v0.47.0',
      'coralite-v0.46.2',
      'coralite-v0.46.1',
      'coralite-v0.46.0'
    ]

    const baseline = resolveBaselineTag({
      sortedTags,
      packageName: 'coralite',
      toRef: 'coralite-v0.46.2'
    })

    assert.equal(baseline, 'coralite-v0.46.1')
  })

  it('2. Selecting a graduating stable release with intermediate RCs (e.g. toRef = "coralite-v0.48.0" with RCs -> baseline "coralite-v0.47.1")', () => {
    const sortedTags = [
      'coralite-v0.48.0',
      'coralite-v0.48.0-rc.1',
      'coralite-v0.48.0-rc.0',
      'coralite-v0.47.1',
      'coralite-v0.47.0'
    ]

    const baseline = resolveBaselineTag({
      sortedTags,
      packageName: 'coralite',
      toRef: 'coralite-v0.48.0'
    })

    assert.equal(baseline, 'coralite-v0.47.1')
  })

  it('3. Selecting a historical RC release (e.g. toRef = "coralite-v0.48.0-rc.1" -> baseline "coralite-v0.48.0-rc.0")', () => {
    const sortedTags = [
      'coralite-v0.48.0',
      'coralite-v0.48.0-rc.1',
      'coralite-v0.48.0-rc.0',
      'coralite-v0.47.1'
    ]

    const baseline = resolveBaselineTag({
      sortedTags,
      packageName: 'coralite',
      toRef: 'coralite-v0.48.0-rc.1'
    })

    assert.equal(baseline, 'coralite-v0.48.0-rc.0')
  })

  it('4. Resolving baseline for graduating stable release on HEAD with nextVersion', () => {
    const sortedTags = [
      'coralite-v0.48.0-rc.1',
      'coralite-v0.48.0-rc.0',
      'coralite-v0.47.1',
      'coralite-v0.47.0'
    ]

    const baseline = resolveBaselineTag({
      sortedTags,
      packageName: 'coralite',
      toRef: 'HEAD',
      nextVersion: '0.48.0'
    })

    assert.equal(baseline, 'coralite-v0.47.1')
  })

  it('5. Resolving baseline for unreleased HEAD changes', () => {
    const sortedTags = [
      'coralite-v0.47.1',
      'coralite-v0.47.0'
    ]

    const baseline = resolveBaselineTag({
      sortedTags,
      packageName: 'coralite',
      toRef: 'HEAD'
    })

    assert.equal(baseline, 'coralite-v0.47.1')
  })

  it('6. Handling oldest tag with no preceding tags (returns null)', () => {
    const sortedTags = [
      'coralite-v0.46.0'
    ]

    const baseline = resolveBaselineTag({
      sortedTags,
      packageName: 'coralite',
      toRef: 'coralite-v0.46.0'
    })

    assert.equal(baseline, null)
  })

  it('7. Respects explicit fromTag when provided', () => {
    const sortedTags = [
      'coralite-v0.47.1',
      'coralite-v0.47.0'
    ]

    const baseline = resolveBaselineTag({
      sortedTags,
      packageName: 'coralite',
      toRef: 'coralite-v0.47.1',
      fromTag: 'coralite-v0.46.0'
    })

    assert.equal(baseline, 'coralite-v0.46.0')
  })

  it('8. Fallback to semver matching when toRef string has no package prefix', () => {
    const sortedTags = [
      'coralite-v0.47.1',
      'coralite-v0.46.2',
      'coralite-v0.46.1'
    ]

    const baseline = resolveBaselineTag({
      sortedTags,
      packageName: 'coralite',
      toRef: '0.46.2'
    })

    assert.equal(baseline, 'coralite-v0.46.1')
  })

  it('9. Resolves HEAD when sitting directly on latest tag commit (isToSameAsLatest = true)', () => {
    const sortedTags = [
      'coralite-v0.47.1',
      'coralite-v0.47.0'
    ]

    const baseline = resolveBaselineTag({
      sortedTags,
      packageName: 'coralite',
      toRef: 'HEAD',
      isToSameAsLatest: true
    })

    assert.equal(baseline, 'coralite-v0.47.0')
  })
})
