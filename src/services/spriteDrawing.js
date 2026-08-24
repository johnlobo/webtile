function insideSelection(x, y, selection) {
  if (!selection) return true
  const rx = x - selection.x, ry = y - selection.y
  return rx >= 0 && rx < selection.w && ry >= 0 && ry < selection.h && (!selection.mask || Boolean(selection.mask[ry * selection.w + rx]))
}

export function fillPixels(pixels, startX, startY, width, height, fillInk, selection, mode = 'contiguous') {
  if (!insideSelection(startX, startY, selection)) return pixels
  const targetInk = pixels[startY * width + startX]
  if (targetInk === fillInk) return pixels
  const result = [...pixels]

  if (mode === 'matching') {
    const area = selection ?? { x: 0, y: 0, w: width, h: height }
    for (let y = area.y; y < area.y + area.h; y++) {
      for (let x = area.x; x < area.x + area.w; x++) {
        if (insideSelection(x, y, selection) && pixels[y * width + x] === targetInk) result[y * width + x] = fillInk
      }
    }
    return result
  }

  const visited = new Uint8Array(width * height)
  const queue = [[startX, startY]]
  visited[startY * width + startX] = 1
  while (queue.length) {
    const [x, y] = queue.pop()
    result[y * width + x] = fillInk
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      if (!insideSelection(nx, ny, selection)) continue
      const index = ny * width + nx
      if (visited[index] || pixels[index] !== targetInk) continue
      visited[index] = 1
      queue.push([nx, ny])
    }
  }
  return result
}

export function bresenhamLine(x0, y0, x1, y1) {
  const cells = []
  let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1
  let error = dx - dy
  while (true) {
    cells.push({ x: x0, y: y0 })
    if (x0 === x1 && y0 === y1) break
    const doubled = 2 * error
    if (doubled > -dy) { error -= dy; x0 += sx }
    if (doubled < dx) { error += dx; y0 += sy }
  }
  return cells
}

function rectangleCells(a, b, filled) {
  const left = Math.min(a.x, b.x), right = Math.max(a.x, b.x)
  const top = Math.min(a.y, b.y), bottom = Math.max(a.y, b.y)
  const cells = []
  for (let y = top; y <= bottom; y++) {
    for (let x = left; x <= right; x++) {
      if (filled || x === left || x === right || y === top || y === bottom) cells.push({ x, y })
    }
  }
  return cells
}

function ellipseCells(a, b, filled) {
  const left = Math.min(a.x, b.x), right = Math.max(a.x, b.x)
  const top = Math.min(a.y, b.y), bottom = Math.max(a.y, b.y)
  if (left === right || top === bottom) return bresenhamLine(left, top, right, bottom)
  const cx = (left + right) / 2, cy = (top + bottom) / 2
  const rx = (right - left) / 2, ry = (bottom - top) / 2

  if (filled) {
    const cells = []
    for (let y = top; y <= bottom; y++) {
      const normalizedY = (y - cy) / ry
      const halfWidth = rx * Math.sqrt(Math.max(0, 1 - normalizedY * normalizedY))
      const rowLeft = Math.ceil(cx - halfWidth)
      const rowRight = Math.floor(cx + halfWidth)
      for (let x = rowLeft; x <= rowRight; x++) cells.push({ x, y })
    }
    return cells
  }

  const steps = Math.max(24, Math.ceil(4 * Math.PI * Math.max(rx, ry)))
  const unique = new Map()
  for (let i = 0; i < steps; i++) {
    const angle = i * Math.PI * 2 / steps
    const cell = { x: Math.round(cx + rx * Math.cos(angle)), y: Math.round(cy + ry * Math.sin(angle)) }
    unique.set(`${cell.x},${cell.y}`, cell)
  }
  return [...unique.values()]
}

export function shapeCells(tool, start, end, filled = false) {
  if (tool === 'line') return bresenhamLine(start.x, start.y, end.x, end.y)
  if (tool === 'rectangle') return rectangleCells(start, end, filled)
  if (tool === 'ellipse') return ellipseCells(start, end, filled)
  return []
}

export function transformPixelBlock(block, operation) {
  if (!block) return block
  const { w, h, pixels } = block
  if (operation === 'flipH') {
    return { ...block, w, h, pixels: Array.from({ length: h }, (_, y) =>
      Array.from({ length: w }, (_, x) => pixels[y * w + (w - 1 - x)])).flat() }
  }
  if (operation === 'flipV') {
    return { ...block, w, h, pixels: Array.from({ length: h }, (_, y) =>
      pixels.slice((h - 1 - y) * w, (h - y) * w)).flat() }
  }
  if (operation === 'rotateLeft' || operation === 'rotateRight') {
    const newW = h, newH = w
    const rotated = Array(newW * newH)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const newX = operation === 'rotateRight' ? h - 1 - y : y
        const newY = operation === 'rotateRight' ? x : w - 1 - x
        rotated[newY * newW + newX] = pixels[y * w + x]
      }
    }
    return { ...block, w: newW, h: newH, pixels: rotated }
  }
  return block
}

export function scalePixelBlock(block, newW, newH) {
  if (!block) return block
  const width = Math.max(1, Math.round(newW))
  const height = Math.max(1, Math.round(newH))
  const pixels = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => {
      const sourceX = Math.min(block.w - 1, Math.floor(x * block.w / width))
      const sourceY = Math.min(block.h - 1, Math.floor(y * block.h / height))
      return block.pixels[sourceY * block.w + sourceX]
    })).flat()
  return { ...block, w: width, h: height, pixels }
}
