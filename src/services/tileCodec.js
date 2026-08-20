export const TILE_COLUMN_BASE = 1000

export function encodeTiles(mapTiles) {
  return mapTiles.flat().map(tile => tile ? tile.row * TILE_COLUMN_BASE + tile.col : -1)
}

export function decodeTiles(flat, mapW, mapH, tilesetCols) {
  return Array.from({ length: mapH }, (_, row) =>
    Array.from({ length: mapW }, (_, col) => {
      const value = flat[row * mapW + col]
      if (value === -1 || value == null) return null
      const tileCol = value % TILE_COLUMN_BASE
      const tileRow = Math.floor(value / TILE_COLUMN_BASE)
      return { col: tileCol, row: tileRow, idx: tileRow * tilesetCols + tileCol }
    })
  )
}
