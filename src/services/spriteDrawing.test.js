import { describe, expect, it } from 'vitest'
import { fillPixels, shapeCells } from './spriteDrawing'

describe('fillPixels', () => {
  const pixels = [1, 1, 2, 1, 2, 1, 2, 1, 1]

  it('fills only a contiguous region by default', () => {
    expect(fillPixels(pixels, 0, 0, 3, 3, 3)).toEqual([3, 3, 2, 3, 2, 1, 2, 1, 1])
  })

  it('replaces every matching pixel in the image or active selection', () => {
    expect(fillPixels(pixels, 0, 0, 3, 3, 3, null, 'matching')).toEqual([3, 3, 2, 3, 2, 3, 2, 3, 3])
    expect(fillPixels(pixels, 0, 0, 3, 3, 3, { x: 0, y: 0, w: 2, h: 2 }, 'matching'))
      .toEqual([3, 3, 2, 3, 2, 1, 2, 1, 1])
  })
})

describe('shapeCells', () => {
  it('creates outlined and filled rectangles', () => {
    expect(shapeCells('rectangle', { x: 0, y: 0 }, { x: 2, y: 2 })).toHaveLength(8)
    expect(shapeCells('rectangle', { x: 0, y: 0 }, { x: 2, y: 2 }, true)).toHaveLength(9)
  })

  it('includes the center only in a filled ellipse', () => {
    expect(shapeCells('ellipse', { x: 0, y: 0 }, { x: 4, y: 4 })).not.toContainEqual({ x: 2, y: 2 })
    expect(shapeCells('ellipse', { x: 0, y: 0 }, { x: 4, y: 4 }, true)).toContainEqual({ x: 2, y: 2 })
  })
})
