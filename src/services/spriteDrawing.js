function insideSelection(x, y, selection) {
  return !selection || (
    x >= selection.x && x < selection.x + selection.w &&
    y >= selection.y && y < selection.y + selection.h
  )
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
        if (pixels[y * width + x] === targetInk) result[y * width + x] = fillInk
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
