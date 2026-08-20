export function parseJascPalette(text) {
  const lines = String(text).replace(/^\uFEFF/, '').split(/\r?\n/).map(line => line.trim()).filter(Boolean)
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
