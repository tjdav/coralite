import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { calculateNewVersion, RELEASE_TYPES } from '../bin/release.js'

describe('calculateNewVersion', () => {
  it('should include all required release types', () => {
    assert.deepEqual(RELEASE_TYPES, [
      'major',
      'minor',
      'patch',
      'premajor',
      'preminor',
      'prepatch',
      'prerelease',
      'rc'
    ])
  })

  it('should correctly bump major, minor, patch on stable versions', () => {
    assert.equal(calculateNewVersion('0.47.1', 'patch'), '0.47.2')
    assert.equal(calculateNewVersion('0.47.1', 'minor'), '0.48.0')
    assert.equal(calculateNewVersion('0.47.1', 'major'), '1.0.0')
  })

  it('should correctly bump preminor with preid rc', () => {
    assert.equal(calculateNewVersion('0.47.1', 'preminor', 'rc'), '0.48.0-rc.0')
  })

  it('should correctly bump prepatch with preid rc', () => {
    assert.equal(calculateNewVersion('0.47.1', 'prepatch', 'rc'), '0.47.2-rc.0')
  })

  it('should correctly bump premajor with preid rc', () => {
    assert.equal(calculateNewVersion('0.47.1', 'premajor', 'rc'), '1.0.0-rc.0')
  })

  it('should correctly bump prerelease on existing RC', () => {
    assert.equal(calculateNewVersion('0.48.0-rc.0', 'prerelease', 'rc'), '0.48.0-rc.1')
  })

  it('should handle rc smart alias on stable versions and existing RCs', () => {
    // Stable version -> preminor with rc identifier
    assert.equal(calculateNewVersion('0.47.1', 'rc', 'rc'), '0.48.0-rc.0')
    // Existing RC -> increment prerelease component
    assert.equal(calculateNewVersion('0.48.0-rc.0', 'rc', 'rc'), '0.48.0-rc.1')
  })

  it('should correctly graduate from RC to stable', () => {
    assert.equal(calculateNewVersion('0.48.0-rc.1', 'minor'), '0.48.0')
    assert.equal(calculateNewVersion('0.48.0-rc.1', 'patch'), '0.48.0')
    assert.equal(calculateNewVersion('0.48.0-rc.1', 'major'), '1.0.0')
  })

  it('should throw error for invalid release type', () => {
    assert.throws(
      () => calculateNewVersion('0.47.1', 'invalid-type'),
      /Unknown release type/
    )
  })

  it('should throw error when semver returns null for invalid version', () => {
    assert.throws(
      () => calculateNewVersion('invalid-version', 'minor'),
      /Failed to calculate new version/
    )
  })
})
