import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  computePositions,
  computeVisibleRange,
  computeScrollTopFromAnchor,
  reanchorOnRemove
} from '../../../plugins/lists/anchor.js'

describe('lists plugin - anchor model', () => {
  const keyFn = (item) => item.id
  const sampleItems = Array.from({ length: 10 }, (_, i) => ({ id: `item-${i}` }))

  it('computes positions using default item height', () => {
    const positions = computePositions(sampleItems, keyFn, null, 50)
    assert.equal(positions.length, 10)
    assert.deepEqual(positions[0], {
      key: 'item-0',
      y: 0,
      height: 50
    })
    assert.deepEqual(positions[1], {
      key: 'item-1',
      y: 50,
      height: 50
    })
    assert.deepEqual(positions[9], {
      key: 'item-9',
      y: 450,
      height: 50
    })
  })

  it('computes positions incorporating measurement cache values', () => {
    const measurements = new Map([
      ['item-1', 100],
      ['item-3', 75]
    ])
    const positions = computePositions(sampleItems, keyFn, measurements, 50)

    assert.equal(positions[0].height, 50)
    assert.equal(positions[1].height, 100)
    assert.equal(positions[1].y, 50)
    assert.equal(positions[2].y, 150)
    assert.equal(positions[3].height, 75)
    assert.equal(positions[3].y, 200)
    assert.equal(positions[4].y, 275)
  })

  it('computes visible range with binary search and overscan padding', () => {
    // 100 items, 10px each
    const positions = computePositions(
      Array.from({ length: 100 }, (_, i) => ({ id: `item-${i}` })),
      keyFn,
      null,
      10
    )

    // scrollTop = 250 (item-25 is at y=250), viewport = 100
    const range = computeVisibleRange(positions, 250, 100, 2)
    assert.equal(range.startIndex, 23)
    assert.equal(range.endIndex, 37)
  })

  it('clamps visible range at array boundaries', () => {
    // 10 items, 500px total
    const positions = computePositions(sampleItems, keyFn, null, 50)

    const topRange = computeVisibleRange(positions, 0, 100, 5)
    assert.equal(topRange.startIndex, 0)
    assert.equal(topRange.endIndex, 7)

    const bottomRange = computeVisibleRange(positions, 400, 100, 5)
    assert.equal(bottomRange.startIndex, 3)
    assert.equal(bottomRange.endIndex, 9)
  })

  it('derives virtual scrollTop from an anchor point', () => {
    const positions = computePositions(sampleItems, keyFn, null, 50)
    const anchor = {
      key: 'item-4',
      offset: 12.5
    }

    const scrollTop = computeScrollTopFromAnchor(anchor, positions)
    assert.equal(scrollTop, 212.5)
  })

  it('handles reanchorOnRemove by selecting the successor item', () => {
    const positions = computePositions(sampleItems, keyFn, null, 50)
    const anchor = {
      key: 'item-3',
      offset: 10
    }

    const newAnchor = reanchorOnRemove('item-3', anchor, positions)
    assert.deepEqual(newAnchor, {
      key: 'item-4',
      offset: 0
    })
  })

  it('resets anchor to top when removed anchor item has no successor', () => {
    const positions = computePositions([{ id: 'item-0' }], keyFn, null, 50)
    const anchor = {
      key: 'item-0',
      offset: 5
    }

    const newAnchor = reanchorOnRemove('item-0', anchor, positions)
    assert.deepEqual(newAnchor, {
      key: 'item-0',
      offset: 0
    })
  })

  it('returns unchanged anchor when non-anchor item is removed', () => {
    const positions = computePositions(sampleItems, keyFn, null, 50)
    const anchor = {
      key: 'item-3',
      offset: 10
    }

    const newAnchor = reanchorOnRemove('item-1', anchor, positions)
    assert.deepEqual(newAnchor, anchor)
  })
})
