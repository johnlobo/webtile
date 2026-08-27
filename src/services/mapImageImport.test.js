import { describe, expect, it } from 'vitest'
import { analyzeMapImage, paletteRgbToCpc, quantizeToPalette } from './mapImageImport'

function image(width, height, pixels) {
  return { width, height, data: new Uint8ClampedArray(pixels.flat()) }
}

describe('map image import', () => {
  it('quantizes before deduplicating tiles', () => {
    const source = image(2, 1, [[250, 0, 0, 255], [255, 8, 8, 255]])
    const result = analyzeMapImage({ imageData: source, tileW: 1, tileH: 1, mapW: 2, mapH: 1, palette: [0, 6] })
    expect(result.newTileCount).toBe(1)
    expect(result.reusedCount).toBe(1)
    expect(result.mapTiles[0].map(tile => tile.idx)).toEqual([0, 0])
  })

  it('reuses tiles already present in the page tileset and appends new ones', () => {
    const existing = image(2, 1, [[255, 0, 0, 255], [0, 0, 0, 255]])
    const source = image(2, 1, [[250, 0, 0, 255], [255, 255, 255, 255]])
    const result = analyzeMapImage({ imageData: source, tileW: 1, tileH: 1, mapW: 2, mapH: 1, palette: [0, 6, 26], existingImageData: existing, existingCols: 2, existingRows: 1 })
    expect(result.existingCount).toBe(2)
    expect(result.newTileCount).toBe(1)
    expect(result.mapTiles[0].map(tile => tile.idx)).toEqual([0, 2])
  })

  it('keeps transparent cells empty', () => {
    const source = image(1, 1, [[0, 0, 0, 0]])
    const result = analyzeMapImage({ imageData: source, tileW: 1, tileH: 1, mapW: 1, mapH: 1, palette: [0] })
    expect(result.emptyCount).toBe(1)
    expect(result.mapTiles).toEqual([[null]])
  })

  it('maps loaded RGB palettes to unique CPC hardware colors', () => {
    expect(paletteRgbToCpc([[255, 0, 0], [250, 5, 5], [0, 0, 255]], 16)).toEqual([6, 2])
  })

  it('preserves transparency while quantizing', () => {
    const result = quantizeToPalette(image(2, 1, [[2, 2, 2, 0], [250, 0, 0, 255]]), [0, 6])
    expect([...result.data]).toEqual([0, 0, 0, 0, 255, 0, 0, 255])
  })
})
