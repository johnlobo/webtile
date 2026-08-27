export const CPC_COLORS = [
  '#000000', '#000080', '#0000FF', '#800000', '#800080', '#8000FF',
  '#FF0000', '#FF0080', '#FF00FF', '#008000', '#008080', '#0080FF',
  '#808000', '#808080', '#8080FF', '#FF8000', '#FF8080', '#FF80FF',
  '#00FF00', '#00FF80', '#00FFFF', '#80FF00', '#80FF80', '#80FFFF',
  '#FFFF00', '#FFFF80', '#FFFFFF',
]

export const DEFAULT_MAP_PALETTE = [0, 13, 26, 2, 6, 18, 24, 9, 20, 4, 8, 10, 12, 14, 16, 22]

function hexToRgb(hex) {
  const value = Number.parseInt(hex.slice(1), 16)
  return [(value >> 16) & 0xFF, (value >> 8) & 0xFF, value & 0xFF]
}

export function nearestCpcColor(r, g, b) {
  let best = 0
  let bestDistance = Infinity
  for (let index = 0; index < CPC_COLORS.length; index++) {
    const [cr, cg, cb] = hexToRgb(CPC_COLORS[index])
    const distance = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2
    if (distance < bestDistance) {
      best = index
      bestDistance = distance
    }
  }
  return best
}

export function paletteRgbToCpc(colors, limit = 16) {
  const palette = []
  for (const [r, g, b] of colors) {
    const color = nearestCpcColor(r, g, b)
    if (!palette.includes(color)) palette.push(color)
    if (palette.length >= limit) break
  }
  if (!palette.length) palette.push(0)
  return palette
}

export function inferCpcPalette(imageData, limit = 16) {
  if (!imageData?.data) return [...DEFAULT_MAP_PALETTE].slice(0, limit)
  const counts = new Map()
  for (let offset = 0; offset < imageData.data.length; offset += 4) {
    if (imageData.data[offset + 3] < 128) continue
    const color = nearestCpcColor(imageData.data[offset], imageData.data[offset + 1], imageData.data[offset + 2])
    counts.set(color, (counts.get(color) ?? 0) + 1)
  }
  const palette = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([color]) => color)
  return palette.length ? palette : [0]
}

function paletteRgb(palette) {
  return palette.map(color => hexToRgb(CPC_COLORS[color] ?? CPC_COLORS[0]))
}

export function quantizeToPalette(imageData, palette) {
  const output = new Uint8ClampedArray(imageData.data.length)
  const colors = paletteRgb(palette)
  for (let offset = 0; offset < imageData.data.length; offset += 4) {
    const alpha = imageData.data[offset + 3]
    if (alpha < 128) {
      output[offset + 3] = 0
      continue
    }
    let best = 0
    let bestDistance = Infinity
    for (let ink = 0; ink < colors.length; ink++) {
      const [r, g, b] = colors[ink]
      const distance = (imageData.data[offset] - r) ** 2 + (imageData.data[offset + 1] - g) ** 2 + (imageData.data[offset + 2] - b) ** 2
      if (distance < bestDistance) {
        best = ink
        bestDistance = distance
      }
    }
    const [r, g, b] = colors[best]
    output[offset] = r
    output[offset + 1] = g
    output[offset + 2] = b
    output[offset + 3] = 255
  }
  return { width: imageData.width, height: imageData.height, data: output }
}

function tileKey(data) {
  let key = ''
  for (let index = 0; index < data.length; index += 4) {
    key += data[index + 3] < 128
      ? 't;'
      : `${data[index]},${data[index + 1]},${data[index + 2]};`
  }
  return key
}

function extractTile(imageData, sourceWidth, x, y, tileW, tileH) {
  const tile = new Uint8ClampedArray(tileW * tileH * 4)
  for (let row = 0; row < tileH; row++) {
    const sourceStart = ((y + row) * sourceWidth + x) * 4
    tile.set(imageData.data.subarray(sourceStart, sourceStart + tileW * 4), row * tileW * 4)
  }
  return tile
}

function isTransparent(data) {
  for (let offset = 3; offset < data.length; offset += 4) if (data[offset] >= 128) return false
  return true
}

export function analyzeMapImage({ imageData, tileW, tileH, mapW, mapH, marginX = 0, marginY = 0, spacingX = 0, spacingY = 0, palette, emptyTransparent = true, existingImageData = null, existingCols = 0, existingRows = 0 }) {
  const requiredW = marginX + mapW * tileW + Math.max(0, mapW - 1) * spacingX
  const requiredH = marginY + mapH * tileH + Math.max(0, mapH - 1) * spacingY
  if (requiredW > imageData.width || requiredH > imageData.height) throw new Error('The configured grid does not fit inside the PNG.')

  const quantized = quantizeToPalette(imageData, palette)
  const keys = new Map()
  const tiles = []
  const existingCount = existingImageData ? existingCols * existingRows : 0
  if (existingImageData) {
    const normalizedExisting = quantizeToPalette(existingImageData, palette)
    for (let index = 0; index < existingCount; index++) {
      const col = index % existingCols
      const row = Math.floor(index / existingCols)
      keys.set(tileKey(extractTile(normalizedExisting, normalizedExisting.width, col * tileW, row * tileH, tileW, tileH)), index)
    }
  }

  let reusedCount = 0
  let emptyCount = 0
  const mapTiles = Array.from({ length: mapH }, () => Array(mapW).fill(null))
  for (let row = 0; row < mapH; row++) {
    for (let col = 0; col < mapW; col++) {
      const x = marginX + col * (tileW + spacingX)
      const y = marginY + row * (tileH + spacingY)
      const data = extractTile(quantized, quantized.width, x, y, tileW, tileH)
      if (emptyTransparent && isTransparent(data)) {
        emptyCount++
        continue
      }
      const key = tileKey(data)
      let index = keys.get(key)
      if (index == null) {
        index = existingCount + tiles.length
        keys.set(key, index)
        tiles.push(data)
      } else {
        reusedCount++
      }
      mapTiles[row][col] = { idx: index }
    }
  }

  const cols = existingImageData ? existingCols : Math.min(16, Math.max(1, Math.ceil(Math.sqrt(tiles.length))))
  const totalCount = existingCount + tiles.length
  const rows = Math.max(existingRows, Math.ceil(totalCount / cols), 1)
  for (const row of mapTiles) {
    for (const tile of row) {
      if (!tile) continue
      tile.col = tile.idx % cols
      tile.row = Math.floor(tile.idx / cols)
    }
  }
  return { quantized, mapTiles, newTiles: tiles, newTileCount: tiles.length, reusedCount, emptyCount, existingCount, cols, rows, totalCount, requiredW, requiredH }
}

export function buildCombinedTilesetCanvas({ existingCanvas = null, analysis, tileW, tileH }) {
  const canvas = document.createElement('canvas')
  canvas.width = analysis.cols * tileW
  canvas.height = analysis.rows * tileH
  const context = canvas.getContext('2d')
  context.imageSmoothingEnabled = false
  if (existingCanvas) context.drawImage(existingCanvas, 0, 0)
  analysis.newTiles.forEach((data, offset) => {
    const index = analysis.existingCount + offset
    const imageData = new ImageData(data, tileW, tileH)
    context.putImageData(imageData, (index % analysis.cols) * tileW, Math.floor(index / analysis.cols) * tileH)
  })
  return canvas
}
