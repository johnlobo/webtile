import { describe, expect, it } from 'vitest'
import { encodeFrame, encodeRowMode0, encodeRowMode1, encodeRowMode2 } from './cpcEncoding'

describe('CPC hardware encoding', () => {
  it('encodes mode 0 pixel bitplanes', () => {
    expect(encodeRowMode0([1, 2, 15, 0])).toEqual([0x90, 0xAA])
  })

  it('encodes mode 1 pixel bitplanes', () => {
    expect(encodeRowMode1([1, 2, 3, 0])).toEqual([0xC6])
  })

  it('encodes mode 2 pixels from most to least significant bit', () => {
    expect(encodeRowMode2([1, 0, 1, 0, 1, 0, 1, 0])).toEqual([0xAA])
  })

  it('splits frames into independently encoded rows', () => {
    expect(encodeFrame([1, 0, 0, 1], 2, 2, 0)).toEqual([
      { y: 0, bytes: [0x80] },
      { y: 1, bytes: [0x40] },
    ])
  })
})
