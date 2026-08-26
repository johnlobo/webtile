import { describe, expect, it } from 'vitest'
import { decodeSpritePixelData, encodeSpritePixelData, packSpritePixels, unpackSpritePixels } from './spritePixelStorage'

describe('sprite pixel storage', () => {
  it('round-trips inks and transparency through five-bit packing', () => {
    const pixels = [-1, 0, 1, 15, 2, 14, 7, 3, -1]
    expect(unpackSpritePixels(packSpritePixels(pixels), pixels.length)).toEqual(pixels)
    expect(packSpritePixels(pixels).length).toBe(Math.ceil(pixels.length * 5 / 8))
  })

  it('stores uniform cels without a pixel array and decodes legacy arrays unchanged', () => {
    const sprite = { frames: [{ cels: { base: { pixels: Array(1000).fill(0) }, legacy: { pixels: [1, 2] } } }] }
    const encoded = encodeSpritePixelData(sprite)
    expect(encoded.frames[0].cels.base).toEqual({ pixelEncoding: 'fill', pixelCount: 1000, fill: 0 })
    expect(decodeSpritePixelData(encoded)).toEqual(sprite)
    expect(decodeSpritePixelData(sprite)).toEqual(sprite)
  })
})
