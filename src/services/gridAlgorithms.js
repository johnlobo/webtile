export function floodFillCells(mapTiles, startCol, startRow, mapW, mapH) {
  if (startCol < 0 || startCol >= mapW || startRow < 0 || startRow >= mapH || !mapTiles[startRow]) return []
  const targetIdx = mapTiles[startRow][startCol]?.idx ?? null
  const visited = new Uint8Array(mapW * mapH)
  const result = []
  const queue = [startCol + startRow * mapW]
  visited[queue[0]] = 1
  while (queue.length) {
    const idx = queue.pop()
    const col = idx % mapW
    const row = (idx / mapW) | 0
    result.push({ col, row })
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nextCol = col + dc
      const nextRow = row + dr
      if (nextCol < 0 || nextCol >= mapW || nextRow < 0 || nextRow >= mapH) continue
      const nextIndex = nextCol + nextRow * mapW
      if (visited[nextIndex]) continue
      visited[nextIndex] = 1
      if ((mapTiles[nextRow]?.[nextCol]?.idx ?? null) === targetIdx) queue.push(nextIndex)
    }
  }
  return result
}
