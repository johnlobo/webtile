import { describe, expect, it } from 'vitest'
import { createPaletteRemap, decodePaletteBytes, parseJascPalette, remapFramesToPalette } from './paletteService'

const reportedPalette = `JASC-PAL\r
0100\r
16\r
0 0 0\r
128 128 128\r
0 0 255\r
128 0 0\r
255 0 0\r
255 128 0\r
255 255 0\r
128 128 0\r
255 128 128\r
0 128 0\r
0 128 128\r
128 128 255\r
0 128 255\r
0 255 255\r
0 0 128\r
255 255 255`

describe('parseJascPalette', () => {
  it('parses the reported 16-color Windows JASC palette', () => {
    const colors = parseJascPalette(reportedPalette)
    expect(colors).toHaveLength(16)
    expect(colors[0]).toEqual([0, 0, 0])
    expect(colors[15]).toEqual([255, 255, 255])
  })

  it('rejects incomplete and unsupported palettes with an actionable error', () => {
    expect(() => parseJascPalette('GIMP Palette\n0 0 0')).toThrow(/JASC-PAL/)
    expect(() => parseJascPalette('JASC-PAL\n0100\n2\n0 0 0')).toThrow(/declares 2/)
  })

  it('decodes UTF-16LE files with a BOM before parsing', () => {
    const encoded = new TextEncoder().encode(reportedPalette.split('').map(character => `${character}\0`).join(''))
    const bytes = new Uint8Array(encoded.length + 2)
    bytes.set([0xFF, 0xFE])
    bytes.set(encoded, 2)
    expect(parseJascPalette(decodePaletteBytes(bytes))).toHaveLength(16)
  })

  it('ignores HTML-encoded trailing spaces in the header', () => {
    expect(parseJascPalette(reportedPalette.replace('JASC-PAL', 'JASC-PAL&#x20;'))).toHaveLength(16)
  })
})

describe('palette remapping', () => {
  const hardwareColors = ['#000000', '#FF0000', '#00FF00', '#0000FF']

  it('preserves appearance when the same colors are imported in a different order', () => {
    const oldPalette = [0, 1, 2, 3]
    const newPalette = [3, 2, 1, 0]
    expect(createPaletteRemap(oldPalette, newPalette, hardwareColors)).toEqual([3, 2, 1, 0])
    expect(remapFramesToPalette([{ pixels: [0, 1, 2, 3] }], oldPalette, newPalette, hardwareColors))
      .toEqual([{ pixels: [3, 2, 1, 0] }])
  })

  it('uses the nearest available imported color when there is no exact match', () => {
    expect(createPaletteRemap([1], [0, 2], hardwareColors)).toEqual([0])
  })
})
