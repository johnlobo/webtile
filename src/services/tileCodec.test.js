import { describe, expect, it } from 'vitest'
import { decodeTiles, encodeTiles } from './tileCodec'

describe('tileCodec', () => {
  it('preserves empty cells and tile coordinates through a round trip', () => {
    const grid = [[null, { row: 2, col: 3 }], [{ row: 0, col: 7 }, null]]
    const encoded = encodeTiles(grid)
    expect(encoded).toEqual([-1, 2003, 7, -1])
    expect(decodeTiles(encoded, 2, 2, 16)).toEqual([
      [null, { row: 2, col: 3, idx: 35 }],
      [{ row: 0, col: 7, idx: 7 }, null],
    ])
  })

  it('treats missing legacy values as empty cells', () => {
    expect(decodeTiles([], 2, 1, 8)).toEqual([[null, null]])
  })
})
