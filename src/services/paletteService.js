export function parseJascPalette(text) {
  const lines = String(text)
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map(line => line.replace(/(?:&#x20;|&#32;|&nbsp;)+$/gi, '').trim())
    .filter(Boolean)
  if (lines[0]?.toUpperCase() !== 'JASC-PAL' || lines[1] !== '0100') {
    throw new Error('Unsupported palette format. Expected a JASC-PAL 0100 file.')
  }

  const declaredCount = Number.parseInt(lines[2], 10)
  if (!Number.isInteger(declaredCount) || declaredCount < 1 || declaredCount > 256) {
    throw new Error('The palette contains an invalid color count.')
  }

  const colors = lines.slice(3, 3 + declaredCount).map((line, index) => {
    const parts = line.split(/\s+/).map(Number)
    if (parts.length < 3 || parts.slice(0, 3).some(value => !Number.isInteger(value) || value < 0 || value > 255)) {
      throw new Error(`Invalid RGB color at palette entry ${index + 1}.`)
    }
    return parts.slice(0, 3)
  })

  if (colors.length !== declaredCount) {
    throw new Error(`The palette declares ${declaredCount} colors but contains ${colors.length}.`)
  }
  return colors
}

export function decodePaletteBytes(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input)
  if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) {
    return new TextDecoder('utf-16le').decode(bytes.subarray(2))
  }
  if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) {
    const swapped = new Uint8Array(bytes.length - 2)
    for (let i = 2; i + 1 < bytes.length; i += 2) {
      swapped[i - 2] = bytes[i + 1]
      swapped[i - 1] = bytes[i]
    }
    return new TextDecoder('utf-16le').decode(swapped)
  }

  // Some UTF-16LE writers omit the BOM. ASCII-range text then has a NUL in
  // almost every odd byte, which is reliable for the JASC header.
  const sampleLength = Math.min(bytes.length, 64)
  let oddNuls = 0
  for (let i = 1; i < sampleLength; i += 2) if (bytes[i] === 0) oddNuls++
  if (sampleLength >= 8 && oddNuls >= Math.floor(sampleLength / 4)) {
    return new TextDecoder('utf-16le').decode(bytes)
  }
  return new TextDecoder('utf-8').decode(bytes)
}

function hexToRgb(hex) {
  const value = Number.parseInt(hex.slice(1), 16)
  return [(value >> 16) & 0xFF, (value >> 8) & 0xFF, value & 0xFF]
}

export function createPaletteRemap(oldPalette, newPalette, hardwareColors) {
  return oldPalette.map(oldColorIndex => {
    const [oldR, oldG, oldB] = hexToRgb(hardwareColors[oldColorIndex] ?? hardwareColors[0])
    let nearestInk = 0
    let nearestDistance = Infinity
    for (let ink = 0; ink < newPalette.length; ink++) {
      const [newR, newG, newB] = hexToRgb(hardwareColors[newPalette[ink]] ?? hardwareColors[0])
      const distance = (oldR - newR) ** 2 + (oldG - newG) ** 2 + (oldB - newB) ** 2
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestInk = ink
      }
    }
    return nearestInk
  })
}

export function remapFramesToPalette(frames, oldPalette, newPalette, hardwareColors) {
  const inkRemap = createPaletteRemap(oldPalette, newPalette, hardwareColors)
  return frames.map(frame => ({
    ...frame,
    pixels: frame.pixels.map(ink => inkRemap[ink] ?? 0),
    ...(frame.cels ? {
      cels: Object.fromEntries(Object.entries(frame.cels).map(([layerId, cel]) => [layerId, {
        ...cel,
        pixels: cel.pixels.map(ink => ink < 0 ? ink : (inkRemap[ink] ?? 0)),
      }])),
    } : {}),
  }))
}
