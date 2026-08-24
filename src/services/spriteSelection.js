function colorDistance(a, b, paletteColors, palette) {
  if (a === b) return 0
  if (a < 0 || b < 0) return Number.POSITIVE_INFINITY
  const parse = ink => {
    const hex = paletteColors[palette[ink] ?? 0] ?? '#000000'
    return [1, 3, 5].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16))
  }
  const left = parse(a)
  const right = parse(b)
  return Math.sqrt(left.reduce((sum, value, index) => sum + (value - right[index]) ** 2, 0))
}

function selectionFromIndexes(indexes, width, height) {
  if (indexes.size === 0) return null
  const xs = [...indexes].map(index => index % width)
  const ys = [...indexes].map(index => Math.floor(index / width))
  const x = Math.min(...xs), y = Math.min(...ys)
  const maxX = Math.max(...xs), maxY = Math.max(...ys)
  const w = maxX - x + 1, h = maxY - y + 1
  const mask = Array(w * h).fill(false)
  for (const index of indexes) {
    const px = index % width, py = Math.floor(index / width)
    mask[(py - y) * w + px - x] = true
  }
  return { x, y, w, h, mask }
}

export function selectionContains(selection, x, y) {
  if (!selection) return true
  const rx = x - selection.x, ry = y - selection.y
  if (rx < 0 || ry < 0 || rx >= selection.w || ry >= selection.h) return false
  return !selection.mask || Boolean(selection.mask[ry * selection.w + rx])
}

export function selectPixelsByColor(pixels, width, height, startX, startY, mode, tolerance, paletteColors, palette) {
  if (startX < 0 || startY < 0 || startX >= width || startY >= height) return null
  const target = pixels[startY * width + startX]
  const matches = index => colorDistance(pixels[index], target, paletteColors, palette) <= tolerance
  const indexes = new Set()
  if (mode === 'matching') {
    for (let index = 0; index < width * height; index++) if (matches(index)) indexes.add(index)
  } else {
    const pending = [startY * width + startX]
    while (pending.length) {
      const index = pending.pop()
      if (indexes.has(index) || !matches(index)) continue
      indexes.add(index)
      const x = index % width, y = Math.floor(index / width)
      if (x > 0) pending.push(index - 1)
      if (x + 1 < width) pending.push(index + 1)
      if (y > 0) pending.push(index - width)
      if (y + 1 < height) pending.push(index + width)
    }
  }
  return selectionFromIndexes(indexes, width, height)
}

export function resizeSelectionMask(selection, width, height, amount) {
  if (!selection) return null
  const selected = new Set()
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const inside = selectionContains(selection, x, y)
    if (amount > 0 && (inside || [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => selectionContains(selection, x + dx, y + dy)))) selected.add(y * width + x)
    if (amount < 0 && inside && [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => selectionContains(selection, x + dx, y + dy))) selected.add(y * width + x)
  }
  return selectionFromIndexes(selected, width, height)
}

export function invertSelection(selection, width, height) {
  const indexes = new Set()
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (!selectionContains(selection, x, y)) indexes.add(y * width + x)
  }
  return selectionFromIndexes(indexes, width, height)
}
