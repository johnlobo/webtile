import { describe, expect, it } from 'vitest'
import { clearMapSelection, copyMapSelection, moveMapSelection, normalizeMapSelection, pasteMapClipboard, transformMapSelection } from './mapSelection'

const tile = idx => ({ idx, col: idx, row: 0 })

describe('map selection operations', () => {
  it('normalizes selections dragged in any direction', () => {
    expect(normalizeMapSelection({ col: 4, row: 3 }, { col: 2, row: 1 })).toEqual({ x: 2, y: 1, w: 3, h: 3 })
  })

  it('copies and clears rectangular tile regions including empty cells', () => {
    const map = [[tile(0), null], [tile(1), tile(2)]]
    const selection = { x: 0, y: 0, w: 2, h: 1 }
    expect(copyMapSelection(map, selection).cells).toEqual([[tile(0), null]])
    expect(clearMapSelection(map, selection)).toEqual([[null, null], [tile(1), tile(2)]])
    expect(map[0][0]).toEqual(tile(0))
  })

  it('pastes with clipping at map edges', () => {
    const map = [[null, null], [null, null]]
    const clipboard = { w: 2, h: 2, cells: [[tile(0), tile(1)], [tile(2), tile(3)]] }
    expect(pasteMapClipboard(map, clipboard, 1, 1)).toEqual([[null, null], [null, tile(0)]])
  })

  it('moves overlapping selections without losing source tiles', () => {
    const map = [[tile(0), tile(1), tile(2)]]
    const selection = { x: 0, y: 0, w: 2, h: 1 }
    const clipboard = copyMapSelection(map, selection)
    expect(moveMapSelection(map, selection, clipboard, 1, 0)).toEqual([[null, tile(0), tile(1)]])
  })

  it('flips and rotates selections in place', () => {
    const map = [[tile(0), tile(1)], [tile(2), tile(3)], [null, null]]
    const selection = { x: 0, y: 0, w: 2, h: 2 }
    expect(transformMapSelection(map, selection, 'flipH').mapTiles.slice(0, 2)).toEqual([[tile(1), tile(0)], [tile(3), tile(2)]])
    const rotated = transformMapSelection(map, { x: 0, y: 0, w: 2, h: 1 }, 'rotateRight')
    expect(rotated.selection).toEqual({ x: 0, y: 0, w: 1, h: 2 })
    expect(rotated.mapTiles.slice(0, 2).map(row => row[0])).toEqual([tile(0), tile(1)])
  })

  it('rejects rotations that do not fit at the current origin', () => {
    const map = [[null, tile(0)], [null, tile(1)]]
    expect(transformMapSelection(map, { x: 1, y: 0, w: 1, h: 2 }, 'rotateRight')).toBeNull()
  })
})
