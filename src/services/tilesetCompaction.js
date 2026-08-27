function extractTile(imageData, sourceWidth, x, y, tileW, tileH) {
  const tile = new Uint8ClampedArray(tileW * tileH * 4)
  for (let row = 0; row < tileH; row++) {
    const start = ((y + row) * sourceWidth + x) * 4
    tile.set(imageData.data.subarray(start, start + tileW * 4), row * tileW * 4)
  }
  return tile
}

function tileKey(data) {
  let key = ''
  for (let offset = 0; offset < data.length; offset += 4) {
    key += data[offset + 3] < 128
      ? 't;'
      : `${data[offset]},${data[offset + 1]},${data[offset + 2]},${data[offset + 3]};`
  }
  return key
}

export function analyzeTilesetCompaction({ imageData, tileW, tileH, cols, tileCount, maps }) {
  if (!imageData?.data || !tileW || !tileH || !cols) throw new Error('The page tileset is invalid.')
  const capacity = Math.floor(imageData.width / tileW) * Math.floor(imageData.height / tileH)
  const currentCount = Math.min(tileCount ?? capacity, capacity)
  const used = new Set()
  for (const map of maps) {
    for (const row of map.mapTiles ?? []) {
      for (const tile of row) if (tile && tile.idx >= 0 && tile.idx < currentCount) used.add(tile.idx)
    }
  }

  const oldToNew = new Map()
  const keys = new Map()
  const uniqueTiles = []
  for (const oldIndex of [...used].sort((a, b) => a - b)) {
    const data = extractTile(imageData, imageData.width, (oldIndex % cols) * tileW, Math.floor(oldIndex / cols) * tileH, tileW, tileH)
    const key = tileKey(data)
    let newIndex = keys.get(key)
    if (newIndex == null) {
      newIndex = uniqueTiles.length
      keys.set(key, newIndex)
      uniqueTiles.push(data)
    }
    oldToNew.set(oldIndex, newIndex)
  }

  const rows = Math.max(1, Math.ceil(uniqueTiles.length / cols))
  const remappedMaps = maps.map(map => ({
    ...map,
    mapTiles: (map.mapTiles ?? []).map(row => row.map(tile => {
      if (!tile) return null
      const idx = oldToNew.get(tile.idx)
      return idx == null ? null : { idx, col: idx % cols, row: Math.floor(idx / cols) }
    })),
  }))

  return {
    currentCount,
    usedCount: used.size,
    duplicateCount: used.size - uniqueTiles.length,
    unusedCount: currentCount - used.size,
    finalCount: uniqueTiles.length,
    cols,
    rows,
    uniqueTiles,
    oldToNew,
    remappedMaps,
  }
}

export function buildCompactedTilesetCanvas({ analysis, tileW, tileH }) {
  const canvas = document.createElement('canvas')
  canvas.width = analysis.cols * tileW
  canvas.height = analysis.rows * tileH
  const context = canvas.getContext('2d')
  analysis.uniqueTiles.forEach((data, index) => {
    context.putImageData(new ImageData(data, tileW, tileH), (index % analysis.cols) * tileW, Math.floor(index / analysis.cols) * tileH)
  })
  return canvas
}
