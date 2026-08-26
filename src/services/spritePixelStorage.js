const PACKED_ENCODING = 'packed5'
const FILL_ENCODING = 'fill'

export function packSpritePixels(pixels) {
  const output = []
  let buffer = 0
  let bits = 0
  for (const pixel of pixels) {
    const value = pixel === -1 ? 16 : pixel
    buffer = (buffer << 5) | (value & 31)
    bits += 5
    while (bits >= 8) {
      bits -= 8
      output.push((buffer >> bits) & 255)
      buffer &= (1 << bits) - 1
    }
  }
  if (bits) output.push((buffer << (8 - bits)) & 255)
  return Uint8Array.from(output)
}

export function unpackSpritePixels(bytes, pixelCount) {
  const pixels = []
  let buffer = 0
  let bits = 0
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte
    bits += 8
    while (bits >= 5 && pixels.length < pixelCount) {
      bits -= 5
      const value = (buffer >> bits) & 31
      pixels.push(value === 16 ? -1 : value)
      buffer &= (1 << bits) - 1
    }
  }
  return pixels
}

export function encodeSpritePixelData(sprite, createBytes = value => value) {
  return {
    ...sprite,
    frames: (sprite.frames ?? []).map(frame => ({
      ...frame,
      cels: Object.fromEntries(Object.entries(frame.cels ?? {}).map(([layerId, cel]) => {
        const pixels = cel.pixels ?? []
        const uniform = pixels.length > 0 && pixels.every(pixel => pixel === pixels[0])
        const encoded = uniform
          ? { pixelEncoding: FILL_ENCODING, pixelCount: pixels.length, fill: pixels[0] }
          : { pixelEncoding: PACKED_ENCODING, pixelCount: pixels.length, pixelData: createBytes(packSpritePixels(pixels)) }
        const { pixels: _pixels, ...celData } = cel
        return [layerId, { ...celData, ...encoded }]
      })),
    })),
  }
}

export function decodeSpritePixelData(sprite, readBytes = value => value) {
  return {
    ...sprite,
    frames: (sprite.frames ?? []).map(frame => ({
      ...frame,
      cels: Object.fromEntries(Object.entries(frame.cels ?? {}).map(([layerId, cel]) => {
        if (Array.isArray(cel.pixels)) return [layerId, cel]
        let pixels = []
        if (cel.pixelEncoding === FILL_ENCODING) pixels = Array(cel.pixelCount).fill(cel.fill)
        if (cel.pixelEncoding === PACKED_ENCODING) pixels = unpackSpritePixels(readBytes(cel.pixelData), cel.pixelCount)
        const { pixelEncoding: _encoding, pixelCount: _count, pixelData: _data, fill: _fill, ...celData } = cel
        return [layerId, { ...celData, pixels }]
      })),
    })),
  }
}
