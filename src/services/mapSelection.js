export function normalizeMapSelection(start, end) {
  const x = Math.min(start.col, end.col)
  const y = Math.min(start.row, end.row)
  return { x, y, w: Math.abs(end.col - start.col) + 1, h: Math.abs(end.row - start.row) + 1 }
}

export function copyMapSelection(mapTiles, selection) {
  if (!mapTiles || !selection) return null
  const cells = Array.from({ length: selection.h }, (_, row) =>
    Array.from({ length: selection.w }, (_, col) => {
      const tile = mapTiles[selection.y + row]?.[selection.x + col]
      return tile ? { ...tile } : null
    }))
  return { w: selection.w, h: selection.h, cells }
}

export function clearMapSelection(mapTiles, selection) {
  const next = mapTiles.map(row => [...row])
  if (!selection) return next
  for (let row = 0; row < selection.h; row++) {
    for (let col = 0; col < selection.w; col++) {
      const y = selection.y + row
      const x = selection.x + col
      if (next[y]?.[x] !== undefined) next[y][x] = null
    }
  }
  return next
}

export function pasteMapClipboard(mapTiles, clipboard, x, y) {
  const next = mapTiles.map(row => [...row])
  if (!clipboard) return next
  for (let row = 0; row < clipboard.h; row++) {
    for (let col = 0; col < clipboard.w; col++) {
      const targetY = y + row
      const targetX = x + col
      if (targetY < 0 || targetY >= next.length || targetX < 0 || targetX >= (next[targetY]?.length ?? 0)) continue
      const tile = clipboard.cells[row][col]
      next[targetY][targetX] = tile ? { ...tile } : null
    }
  }
  return next
}
