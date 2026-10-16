import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  layoutLinear,
  layoutGrid,
  layoutMasonry,
  layoutTable,
  computeLaneCount
} from '../../../plugins/lists/layouts.js'

describe('lists plugin - layout engine', () => {
  const sampleItems = Array.from({ length: 6 }, (_, i) => ({ id: `item-${i}` }))
  const keyFn = (item) => item.id

  describe('layoutLinear', () => {
    it('layoutLinear produces vertical stacking positions', () => {
      const heights = [50, 60, 40, 50, 70, 30]
      const positions = layoutLinear(sampleItems, heights, 800, 10, keyFn)

      assert.equal(positions.length, 6)
      assert.deepEqual(positions[0], {
        key: 'item-0',
        x: 0,
        y: 0,
        width: 800,
        height: 50,
        lane: 0
      })
      assert.deepEqual(positions[1], {
        key: 'item-1',
        x: 0,
        y: 60,
        width: 800,
        height: 60,
        lane: 0
      })
      assert.deepEqual(positions[2], {
        key: 'item-2',
        x: 0,
        y: 130,
        width: 800,
        height: 40,
        lane: 0
      })
      assert.deepEqual(positions[5], {
        key: 'item-5',
        x: 0,
        y: 320,
        width: 800,
        height: 30,
        lane: 0
      })
    })
  })

  describe('layoutGrid', () => {
    it('layoutGrid with lanes: 3 positions items in 3 columns', () => {
      const heights = [50, 50, 50, 50, 50, 50]
      // containerWidth = 900, gap = 0, lanes = 3 -> laneWidth = 300
      const positions = layoutGrid(sampleItems, heights, 3, 900, 0, keyFn)

      assert.equal(positions.length, 6)
      // Row 0
      assert.deepEqual(positions[0], {
        key: 'item-0',
        x: 0,
        y: 0,
        width: 300,
        height: 50,
        lane: 0
      })
      assert.deepEqual(positions[1], {
        key: 'item-1',
        x: 300,
        y: 0,
        width: 300,
        height: 50,
        lane: 1
      })
      assert.deepEqual(positions[2], {
        key: 'item-2',
        x: 600,
        y: 0,
        width: 300,
        height: 50,
        lane: 2
      })
      // Row 1
      assert.deepEqual(positions[3], {
        key: 'item-3',
        x: 0,
        y: 50,
        width: 300,
        height: 50,
        lane: 0
      })
      assert.deepEqual(positions[4], {
        key: 'item-4',
        x: 300,
        y: 50,
        width: 300,
        height: 50,
        lane: 1
      })
      assert.deepEqual(positions[5], {
        key: 'item-5',
        x: 600,
        y: 50,
        width: 300,
        height: 50,
        lane: 2
      })
    })

    it('layoutGrid row height is the max of the items in that row', () => {
      const heights = [50, 100, 40, 30, 60, 20]
      // Row 0: heights [50, 100] -> max 100
      // Row 1: heights [40, 30] -> max 40
      // Row 2: heights [60, 20] -> max 60
      const positions = layoutGrid(sampleItems, heights, 2, 800, 10, keyFn)

      assert.equal(positions[0].height, 100)
      assert.equal(positions[1].height, 100)
      assert.equal(positions[0].y, 0)
      assert.equal(positions[1].y, 0)

      assert.equal(positions[2].height, 40)
      assert.equal(positions[3].height, 40)
      assert.equal(positions[2].y, 110)
      assert.equal(positions[3].y, 110)

      assert.equal(positions[4].height, 60)
      assert.equal(positions[5].height, 60)
      assert.equal(positions[4].y, 160)
      assert.equal(positions[5].y, 160)
    })
  })

  describe('layoutMasonry', () => {
    it('layoutMasonry places each item in the shortest lane', () => {
      const heights = [100, 50, 80, 40]
      const items = Array.from({ length: 4 }, (_, i) => ({ id: `item-${i}` }))
      const positions = layoutMasonry(items, heights, 2, 800, 0, keyFn)

      assert.deepEqual(positions[0], {
        key: 'item-0',
        x: 0,
        y: 0,
        width: 400,
        height: 100,
        lane: 0
      })
      assert.deepEqual(positions[1], {
        key: 'item-1',
        x: 400,
        y: 0,
        width: 400,
        height: 50,
        lane: 1
      })
      assert.deepEqual(positions[2], {
        key: 'item-2',
        x: 400,
        y: 50,
        width: 400,
        height: 80,
        lane: 1
      })
      assert.deepEqual(positions[3], {
        key: 'item-3',
        x: 0,
        y: 100,
        width: 400,
        height: 40,
        lane: 0
      })
    })

    it('layoutMasonry with equal heights produces the same positions as layoutGrid', () => {
      const heights = [50, 50, 50, 50, 50, 50]
      const gridPos = layoutGrid(sampleItems, heights, 3, 900, 10, keyFn)
      const masonryPos = layoutMasonry(sampleItems, heights, 3, 900, 10, keyFn)

      assert.deepEqual(gridPos, masonryPos)
    })
  })

  describe('layoutTable', () => {
    it('layoutTable positions rows at total column width', () => {
      const columns = [
        {
          key: 'col1',
          width: 200
        },
        {
          key: 'col2',
          width: 300
        },
        {
          key: 'col3',
          width: 100
        }
      ]
      const heights = [40, 50, 30]
      const items = Array.from({ length: 3 }, (_, i) => ({ id: `row-${i}` }))
      const positions = layoutTable(items, heights, columns, 1000, 10, keyFn)

      assert.equal(positions.length, 3)
      assert.deepEqual(positions[0], {
        key: 'row-0',
        x: 0,
        y: 0,
        width: 620,
        height: 40,
        lane: 0
      })
      assert.deepEqual(positions[1], {
        key: 'row-1',
        x: 0,
        y: 50,
        width: 620,
        height: 50,
        lane: 0
      })
      assert.deepEqual(positions[2], {
        key: 'row-2',
        x: 0,
        y: 110,
        width: 620,
        height: 30,
        lane: 0
      })
    })
  })

  describe('computeLaneCount', () => {
    it('computeLaneCount with lanes: "auto" returns the correct count for container width', () => {
      assert.equal(computeLaneCount(840, 280, 200, 6, 0), 3)
      assert.equal(computeLaneCount(560, 280, 200, 6, 0), 2)
      assert.equal(computeLaneCount(280, 280, 200, 6, 0), 1)
    })

    it('computeLaneCount respects minLaneWidth and maxLanes', () => {
      assert.equal(computeLaneCount(3000, 280, 200, 6, 0), 6)
      assert.equal(computeLaneCount(150, 280, 100, 6, 0), 1)
      assert.equal(computeLaneCount(0, 280, 200, 6, 0), 1)
    })
  })
})
