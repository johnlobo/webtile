import { describe, expect, it } from 'vitest'
import { parseJascPalette } from './paletteService'

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
})
