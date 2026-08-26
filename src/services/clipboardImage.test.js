import { describe, expect, it } from 'vitest'
import { clipboardImageFile, positionClipboardOverCanvas, quantizeClipboardImage } from './clipboardImage'

describe('clipboard images', () => {
  it('finds images in clipboard items or the files fallback', () => {
    const image = { type: 'image/png' }
    expect(clipboardImageFile({ items: [{ kind: 'file', type: 'image/png', getAsFile: () => image }] })).toBe(image)
    expect(clipboardImageFile({ items: [], files: [image] })).toBe(image)
  })

  it('maps opaque RGB pixels to the closest active palette ink and preserves transparency', () => {
    const imageData = {
      width: 3,
      height: 1,
      data: new Uint8ClampedArray([250, 5, 5, 255, 5, 5, 250, 255, 0, 0, 0, 20]),
    }
    expect(quantizeClipboardImage(imageData, [0, 1], ['#ff0000', '#0000ff'])).toEqual({
      w: 3,
      h: 1,
      pixels: [0, 1, -1],
      palette: [0, 1],
    })
  })

  it('moves an oversized clipboard image across its complete crop range', () => {
    expect(positionClipboardOverCanvas({ x: 0, y: 0 }, 20, 12, 8, 6)).toEqual({ x: 0, y: 0 })
    expect(positionClipboardOverCanvas({ x: 7, y: 5 }, 20, 12, 8, 6)).toEqual({ x: -12, y: -6 })
    expect(positionClipboardOverCanvas({ x: 3, y: 2 }, 4, 3, 8, 6)).toEqual({ x: 3, y: 2 })
  })
})
