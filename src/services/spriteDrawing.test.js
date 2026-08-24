import { describe, expect, it } from 'vitest'
import { fillPixels, scalePixelBlock, shapeCells, transformPixelBlock } from './spriteDrawing'

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

describe('pixel block transformations', () => {
  const block = { w: 3, h: 2, pixels: [1, 2, 3, 4, 5, 6] }

  it('flips blocks without changing their dimensions', () => {
    expect(transformPixelBlock(block, 'flipH')).toEqual({ w: 3, h: 2, pixels: [3, 2, 1, 6, 5, 4] })
    expect(transformPixelBlock(block, 'flipV')).toEqual({ w: 3, h: 2, pixels: [4, 5, 6, 1, 2, 3] })
  })

  it('rotates blocks and swaps their dimensions', () => {
    expect(transformPixelBlock(block, 'rotateRight')).toEqual({ w: 2, h: 3, pixels: [4, 1, 5, 2, 6, 3] })
    expect(transformPixelBlock(block, 'rotateLeft')).toEqual({ w: 2, h: 3, pixels: [3, 6, 2, 5, 1, 4] })
  })

  it('scales blocks using nearest-neighbour pixels', () => {
    expect(scalePixelBlock({ w: 2, h: 1, pixels: [1, 2] }, 4, 2)).toEqual({
      w: 4, h: 2, pixels: [1, 1, 2, 2, 1, 1, 2, 2],
    })
  })

  it('keeps clipboard palette metadata through transforms and scaling', () => {
    const clipboard = { w: 2, h: 1, pixels: [1, 2], palette: [0, 6, 20] }
    expect(transformPixelBlock(clipboard, 'flipH').palette).toEqual(clipboard.palette)
    expect(scalePixelBlock(clipboard, 4, 2).palette).toEqual(clipboard.palette)
  })
})
