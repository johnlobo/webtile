import { describe, expect, it } from 'vitest'
import { floodFillCells } from './gridAlgorithms'

const tile = idx => ({ idx })

describe('floodFillCells', () => {
  it('returns only the contiguous region with the same tile', () => {
    const grid = [
      [tile(1), tile(1), tile(2)],
      [tile(1), tile(2), tile(1)],
      [tile(2), tile(1), tile(1)],
    ]
    const result = floodFillCells(grid, 0, 0, 3, 3)
    expect(result).toHaveLength(3)
    expect(result).toEqual(expect.arrayContaining([{ col: 0, row: 0 }, { col: 1, row: 0 }, { col: 0, row: 1 }]))
  })

  it('fills contiguous empty cells and rejects coordinates outside the grid', () => {
    const grid = [[null, null], [tile(1), null]]
    expect(floodFillCells(grid, 0, 0, 2, 2)).toHaveLength(3)
    expect(floodFillCells(grid, -1, 0, 2, 2)).toEqual([])
  })
})
