export function encodeRowMode0(rowPixels) {
  const bytes = []
  for (let i = 0; i < rowPixels.length; i += 2) {
    const p0 = rowPixels[i] & 0xF
    const p1 = (rowPixels[i + 1] ?? 0) & 0xF
    bytes.push((((p0 >> 0) & 1) << 7) | (((p1 >> 0) & 1) << 6) |
      (((p0 >> 1) & 1) << 5) | (((p1 >> 1) & 1) << 4) |
      (((p0 >> 2) & 1) << 3) | (((p1 >> 2) & 1) << 2) |
      (((p0 >> 3) & 1) << 1) | ((p1 >> 3) & 1))
  }
  return bytes
}

export function encodeRowMode1(rowPixels) {
  const bytes = []
  for (let i = 0; i < rowPixels.length; i += 4) {
    const [p0, p1, p2, p3] = [rowPixels[i] & 3, (rowPixels[i + 1] ?? 0) & 3, (rowPixels[i + 2] ?? 0) & 3, (rowPixels[i + 3] ?? 0) & 3]
    bytes.push(((p0 & 1) << 7) | ((p2 & 1) << 6) | ((p1 & 1) << 5) | ((p3 & 1) << 4) |
      (((p0 >> 1) & 1) << 3) | (((p2 >> 1) & 1) << 2) | (((p1 >> 1) & 1) << 1) | ((p3 >> 1) & 1))
  }
  return bytes
}

export function encodeRowMode2(rowPixels) {
  const bytes = []
  for (let i = 0; i < rowPixels.length; i += 8) {
    let byte = 0
    for (let bit = 0; bit < 8; bit++) byte |= ((rowPixels[i + bit] ?? 0) & 1) << (7 - bit)
    bytes.push(byte)
  }
  return bytes
}

export function encodeFrame(pixels, width, height, videoMode) {
  const encoder = videoMode === 0 ? encodeRowMode0 : videoMode === 1 ? encodeRowMode1 : encodeRowMode2
  return Array.from({ length: height }, (_, y) => ({ y, bytes: encoder(pixels.slice(y * width, (y + 1) * width)) }))
}
