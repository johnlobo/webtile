import { describe, expect, it } from 'vitest'
import { clearMapSelection, copyMapSelection, normalizeMapSelection, pasteMapClipboard } from './mapSelection'

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
})
