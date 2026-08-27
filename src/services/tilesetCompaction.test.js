import { describe, expect, it } from 'vitest'
import { analyzeTilesetCompaction } from './tilesetCompaction'

const pixel = (r, g, b, a = 255) => [r, g, b, a]
const image = pixels => ({ width: pixels.length, height: 1, data: new Uint8ClampedArray(pixels.flat()) })
const tile = idx => ({ idx, col: idx, row: 0 })

describe('tileset compaction', () => {
  it('merges duplicate used tiles and reindexes every map', () => {
    const result = analyzeTilesetCompaction({
      imageData: image([pixel(255, 0, 0), pixel(0, 0, 0), pixel(255, 0, 0)]),
      tileW: 1, tileH: 1, cols: 3, tileCount: 3,
      maps: [
        { id: 'a', mapTiles: [[tile(0), tile(1)]] },
        { id: 'b', mapTiles: [[tile(2)]] },
      ],
    })
    expect(result.duplicateCount).toBe(1)
    expect(result.finalCount).toBe(2)
    expect(result.remappedMaps[0].mapTiles[0].map(cell => cell.idx)).toEqual([0, 1])
    expect(result.remappedMaps[1].mapTiles[0][0].idx).toBe(0)
  })

  it('removes unused tiles and keeps empty cells', () => {
    const result = analyzeTilesetCompaction({
      imageData: image([pixel(1, 1, 1), pixel(2, 2, 2), pixel(3, 3, 3)]),
      tileW: 1, tileH: 1, cols: 3, tileCount: 3,
      maps: [{ id: 'a', mapTiles: [[null, tile(2)]] }],
    })
    expect(result.unusedCount).toBe(2)
    expect(result.finalCount).toBe(1)
    expect(result.remappedMaps[0].mapTiles).toEqual([[null, { idx: 0, col: 0, row: 0 }]])
  })
})
