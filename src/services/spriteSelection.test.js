import { describe, expect, it } from 'vitest'
import { combineSelections, invertSelection, resizeSelectionMask, selectPixelsByColor, selectionContains } from './spriteSelection'

const colors = ['#000000', '#101010', '#ffffff']
const palette = [0, 1, 2]

describe('sprite selections', () => {
  it('selects contiguous or every matching color without including enclosed colors', () => {
    const pixels = [0, 0, 1, 0, 1, 0]
    const contiguous = selectPixelsByColor(pixels, 3, 2, 0, 0, 'contiguous', 0, colors, palette)
    const matching = selectPixelsByColor(pixels, 3, 2, 0, 0, 'matching', 0, colors, palette)
    expect(contiguous.mask.filter(Boolean)).toHaveLength(3)
    expect(matching.mask.filter(Boolean)).toHaveLength(4)
    expect(selectionContains(matching, 1, 1)).toBe(false)
  })

  it('applies RGB tolerance and expands, contracts, and inverts masks', () => {
    const selected = selectPixelsByColor([0, 1, 2], 3, 1, 0, 0, 'matching', 30, colors, palette)
    expect(selected.mask.filter(Boolean)).toHaveLength(2)
    const expanded = resizeSelectionMask({ x: 1, y: 1, w: 1, h: 1 }, 3, 3, 1)
    expect(expanded.mask.filter(Boolean)).toHaveLength(5)
    expect(resizeSelectionMask(expanded, 3, 3, -1).mask.filter(Boolean)).toHaveLength(1)
    expect(invertSelection({ x: 0, y: 0, w: 1, h: 1 }, 2, 2).mask.filter(Boolean)).toHaveLength(3)
  })

  it('adds a new rectangular or irregular area to the current selection', () => {
    const combined = combineSelections(
      { x: 0, y: 0, w: 2, h: 1 },
      { x: 2, y: 1, w: 2, h: 1, mask: [true, false] },
    )
    expect(combined).toEqual({ x: 0, y: 0, w: 4, h: 2, mask: [true, true, false, false, false, false, true, false] })
  })
})
