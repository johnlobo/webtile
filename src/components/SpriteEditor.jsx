import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { loadSprite, saveSprite } from '../services/spriteService'

// ── CPC color table ───────────────────────────────────────────────────────────

const CPC_COLORS = [
  '#000000', '#000080', '#0000FF', '#800000', '#800080', '#8000FF',
  '#FF0000', '#FF0080', '#FF00FF', '#008000', '#008080', '#0080FF',
  '#808000', '#808080', '#8080FF', '#FF8000', '#FF8080', '#FF80FF',
  '#00FF00', '#00FF80', '#00FFFF', '#80FF00', '#80FF80', '#80FFFF',
  '#FFFF00', '#FFFF80', '#FFFFFF',
]

const MODE_INK_COUNT      = [16, 4, 2]
const CELL_W_BASE         = [16, 8, 4]   // screen pixels per CPC pixel per mode
const CELL_H_BASE         = 8             // same for all modes
const SPRITE_ZOOM_LEVELS  = [1, 2, 4, 8]

// ── CPC encoding ──────────────────────────────────────────────────────────────

function encodeRow_Mode0(rowPixels) {
  // 2 CPC pixels per byte
  // Bit7=p0b0, Bit6=p1b0, Bit5=p0b1, Bit4=p1b1, Bit3=p0b2, Bit2=p1b2, Bit1=p0b3, Bit0=p1b3
  const bytes = []
  for (let i = 0; i < rowPixels.length; i += 2) {
    const p0 = rowPixels[i]     & 0xF
    const p1 = (rowPixels[i + 1] ?? 0) & 0xF
    let b = 0
    b |= ((p0 >> 0) & 1) << 7
    b |= ((p1 >> 0) & 1) << 6
    b |= ((p0 >> 1) & 1) << 5
    b |= ((p1 >> 1) & 1) << 4
    b |= ((p0 >> 2) & 1) << 3
    b |= ((p1 >> 2) & 1) << 2
    b |= ((p0 >> 3) & 1) << 1
    b |= ((p1 >> 3) & 1) << 0
    bytes.push(b)
  }
  return bytes
}

function encodeRow_Mode1(rowPixels) {
  // 4 CPC pixels per byte
  // Bit7=p0b0, Bit6=p2b0, Bit5=p1b0, Bit4=p3b0, Bit3=p0b1, Bit2=p2b1, Bit1=p1b1, Bit0=p3b1
  const bytes = []
  for (let i = 0; i < rowPixels.length; i += 4) {
    const p0 = rowPixels[i]     & 0x3
    const p1 = (rowPixels[i + 1] ?? 0) & 0x3
    const p2 = (rowPixels[i + 2] ?? 0) & 0x3
    const p3 = (rowPixels[i + 3] ?? 0) & 0x3
    let b = 0
    b |= ((p0 >> 0) & 1) << 7
    b |= ((p2 >> 0) & 1) << 6
    b |= ((p1 >> 0) & 1) << 5
    b |= ((p3 >> 0) & 1) << 4
    b |= ((p0 >> 1) & 1) << 3
    b |= ((p2 >> 1) & 1) << 2
    b |= ((p1 >> 1) & 1) << 1
    b |= ((p3 >> 1) & 1) << 0
    bytes.push(b)
  }
  return bytes
}

function encodeRow_Mode2(rowPixels) {
  // 8 CPC pixels per byte — simple 1-bit: Bit7=p0, Bit6=p1, ..., Bit0=p7
  const bytes = []
  for (let i = 0; i < rowPixels.length; i += 8) {
    let b = 0
    for (let bit = 0; bit < 8; bit++) {
      const p = (rowPixels[i + bit] ?? 0) & 0x1
      b |= p << (7 - bit)
    }
    bytes.push(b)
  }
  return bytes
}

function maskRow_Mode0(rowPixels) {
  // ink 0 = transparent → its bits in the mask = 1, else 0
  const bytes = []
  for (let i = 0; i < rowPixels.length; i += 2) {
    const t0 = rowPixels[i]     === 0 ? 1 : 0
    const t1 = (rowPixels[i + 1] ?? 0) === 0 ? 1 : 0
    let b = 0
    b |= t0 << 7
    b |= t1 << 6
    b |= t0 << 5
    b |= t1 << 4
    b |= t0 << 3
    b |= t1 << 2
    b |= t0 << 1
    b |= t1 << 0
    bytes.push(b)
  }
  return bytes
}

function maskRow_Mode1(rowPixels) {
  const bytes = []
  for (let i = 0; i < rowPixels.length; i += 4) {
    const t0 = rowPixels[i]     === 0 ? 1 : 0
    const t1 = (rowPixels[i + 1] ?? 0) === 0 ? 1 : 0
    const t2 = (rowPixels[i + 2] ?? 0) === 0 ? 1 : 0
    const t3 = (rowPixels[i + 3] ?? 0) === 0 ? 1 : 0
    let b = 0
    b |= t0 << 7
    b |= t2 << 6
    b |= t1 << 5
    b |= t3 << 4
    b |= t0 << 3
    b |= t2 << 2
    b |= t1 << 1
    b |= t3 << 0
    bytes.push(b)
  }
  return bytes
}

function maskRow_Mode2(rowPixels) {
  const bytes = []
  for (let i = 0; i < rowPixels.length; i += 8) {
    let b = 0
    for (let bit = 0; bit < 8; bit++) {
      const t = (rowPixels[i + bit] ?? 0) === 0 ? 1 : 0
      b |= t << (7 - bit)
    }
    bytes.push(b)
  }
  return bytes
}

function encodeFrame(pixels, width, height, videoMode, withMask) {
  const encodeRow = videoMode === 0 ? encodeRow_Mode0 : videoMode === 1 ? encodeRow_Mode1 : encodeRow_Mode2
  const maskRow   = videoMode === 0 ? maskRow_Mode0   : videoMode === 1 ? maskRow_Mode1   : maskRow_Mode2
  const rows = []
  for (let y = 0; y < height; y++) {
    const rowPixels = pixels.slice(y * width, (y + 1) * width)
    const sprBytes  = encodeRow(rowPixels)
    const mskBytes  = withMask ? maskRow(rowPixels) : []
    if (withMask) {
      // interleave: mask, sprite pairs per byte
      const interleaved = []
      for (let i = 0; i < sprBytes.length; i++) {
        interleaved.push(mskBytes[i] ?? 0)
        interleaved.push(sprBytes[i])
      }
      rows.push({ y, bytes: interleaved })
    } else {
      rows.push({ y, bytes: sprBytes })
    }
  }
  return rows
}

function interleavedOrder(height) {
  return Array.from({ length: height }, (_, y) => ({
    y,
    offset: (y % 8) * 2048 + Math.floor(y / 8) * 80,
  })).sort((a, b) => a.offset - b.offset).map(r => r.y)
}

function generateExport(sprite, opts) {
  const { format, interleaved, withMask } = opts
  const { name, videoMode, width, height, palette, frames } = sprite

  const safeName  = (name || 'sprite').toLowerCase().replace(/[^a-z0-9_]/g, '_')
  const bytesPerRow = videoMode === 0 ? width / 2 : videoMode === 1 ? width / 4 : width / 8
  const rowLen      = withMask ? bytesPerRow * 2 : bytesPerRow

  const formatByte = (b) =>
    format === 'hex'
      ? `#${b.toString(16).toUpperCase().padStart(2, '0')}`
      : String(b)

  const inkList = palette.map((cpcIdx, i) => `ink${i}=${cpcIdx}`).join(' ')

  if (format === 'basic') {
    let lineNum = 10
    const lines = []
    lines.push(`${lineNum} REM ${name || 'SPRITE'} | MODE ${videoMode} | ${width}x${height} px | ${frames.length} frame(s)`)
    lineNum += 10
    lines.push(`${lineNum} REM Palette: ${inkList}`)
    lineNum += 10

    frames.forEach((frame, fi) => {
      const rowOrder = interleaved ? interleavedOrder(height) : Array.from({ length: height }, (_, y) => y)
      const allRows  = encodeFrame(frame.pixels, width, height, videoMode, withMask)
      const rowMap   = Object.fromEntries(allRows.map(r => [r.y, r]))

      lines.push(`${lineNum} REM FRAME ${fi}`)
      lineNum += 10
      rowOrder.forEach(y => {
        const { bytes } = rowMap[y]
        const vals = bytes.map(b => String(b)).join(',')
        lines.push(`${lineNum} DATA ${vals}`)
        lineNum += 10
      })
    })

    lines.push(`${lineNum} REM WIDTH=${width} HEIGHT=${height}`)
    return lines.join('\n')
  }

  // ASM format (hex or dec)
  const lines = []
  lines.push(`; ${name || 'sprite'} | Mode ${videoMode} | ${width}x${height} CPC pixels | ${frames.length} frame(s)`)
  lines.push(`; Palette: ${inkList}`)
  lines.push(';')

  frames.forEach((frame, fi) => {
    lines.push(`; ── Frame ${fi} ${'─'.repeat(40 - fi.toString().length)}`)
    lines.push(`_${safeName}_f${fi}::`)

    const rowOrder = interleaved ? interleavedOrder(height) : Array.from({ length: height }, (_, y) => y)
    const allRows  = encodeFrame(frame.pixels, width, height, videoMode, withMask)
    const rowMap   = Object.fromEntries(allRows.map(r => [r.y, r]))

    rowOrder.forEach(y => {
      const { bytes } = rowMap[y]
      const formatted = bytes.map(formatByte).join(',')
      lines.push(`  .db ${formatted}  ; row ${y}`)
    })
    if (fi < frames.length - 1) lines.push('')
  })

  lines.push('')
  lines.push(`_${safeName}_width  EQU ${bytesPerRow}`)
  lines.push(`_${safeName}_height EQU ${height}`)

  return lines.join('\n')
}

// ── PNG import helpers ────────────────────────────────────────────────────────

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}

function nearestCpcColor(r, g, b) {
  let best = 0, bestDist = Infinity
  for (let i = 0; i < CPC_COLORS.length; i++) {
    const [cr, cg, cb] = hexToRgb(CPC_COLORS[i])
    const d = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2
    if (d < bestDist) { bestDist = d; best = i }
  }
  return best
}

function nearestPaletteInk(r, g, b, palette) {
  let best = 1, bestDist = Infinity
  for (let ink = 1; ink < palette.length; ink++) {
    const [cr, cg, cb] = hexToRgb(CPC_COLORS[palette[ink] ?? 0])
    const d = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2
    if (d < bestDist) { bestDist = d; best = ink }
  }
  return best
}

// ── Canvas rendering helpers ──────────────────────────────────────────────────

function renderSpriteToCanvas(canvas, pixels, width, height, videoMode, palette, cellW, cellH, opts = {}) {
  const { showGrid, gridCellW = 1, gridCellH = 1 } = opts
  const ctx = canvas.getContext('2d')

  canvas.width  = width  * cellW
  canvas.height = height * cellH

  // Checkerboard background — one square per sprite pixel
  const dark1 = '#111820'
  const dark2 = '#0c1219'
  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      ctx.fillStyle = ((px + py) % 2 === 0) ? dark1 : dark2
      ctx.fillRect(px * cellW, py * cellH, cellW, cellH)
    }
  }

  // Pixels
  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const ink = pixels[py * width + px]
      if (ink === 0) continue  // transparent
      const color = CPC_COLORS[palette[ink] ?? 0]
      ctx.fillStyle = color
      ctx.fillRect(px * cellW, py * cellH, cellW, cellH)
    }
  }

  // Custom grid overlay (amber)
  if (showGrid) {
    ctx.strokeStyle = 'rgba(255,170,0,0.55)'
    ctx.lineWidth = 1
    for (let px = gridCellW; px < width; px += gridCellW) {
      ctx.beginPath()
      ctx.moveTo(px * cellW + 0.5, 0)
      ctx.lineTo(px * cellW + 0.5, canvas.height)
      ctx.stroke()
    }
    for (let py = gridCellH; py < height; py += gridCellH) {
      ctx.beginPath()
      ctx.moveTo(0, py * cellH + 0.5)
      ctx.lineTo(canvas.width, py * cellH + 0.5)
      ctx.stroke()
    }
  }
}

// ── SpriteCanvas ──────────────────────────────────────────────────────────────

function normalizeSelection(a, b) {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(b.x - a.x) + 1,
    h: Math.abs(b.y - a.y) + 1,
  }
}

function cellInSelection(x, y, sel) {
  if (!sel) return true
  return x >= sel.x && x < sel.x + sel.w && y >= sel.y && y < sel.y + sel.h
}

function spriteFill(pixels, startX, startY, width, height, fillInk, selection) {
  if (selection && !cellInSelection(startX, startY, selection)) return pixels
  const targetInk = pixels[startY * width + startX]
  if (targetInk === fillInk) return pixels
  const result = [...pixels]
  const visited = new Uint8Array(width * height)
  const queue = [[startX, startY]]
  visited[startY * width + startX] = 1
  while (queue.length) {
    const [x, y] = queue.shift()
    result[y * width + x] = fillInk
    for (const [nx, ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      if (visited[ny * width + nx]) continue
      if (pixels[ny * width + nx] !== targetInk) continue
      if (!cellInSelection(nx, ny, selection)) continue
      visited[ny * width + nx] = 1
      queue.push([nx, ny])
    }
  }
  return result
}

function bresenhamLine(x0, y0, x1, y1) {
  const cells = []
  let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0)
  let sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1
  let err = dx - dy
  while (true) {
    cells.push({ x: x0, y: y0 })
    if (x0 === x1 && y0 === y1) break
    const e2 = 2 * err
    if (e2 > -dy) { err -= dy; x0 += sx }
    if (e2 <  dx) { err += dx; y0 += sy }
  }
  return cells
}

function SpriteCanvas({ pixels, width, height, videoMode, palette, zoom, doubleWidth, activeTool, activeInk, bgInk, onPaint, onZoomChange,
  gridCellW, gridCellH, selection, onSelectionChange, clipboard, isPasting, onPasteCommit, onFill, onStrokeStart, onPaintLine, onEraseSelection, onMoveStart, onMoveCommit, onCursorPos }) {
  const canvasRef   = useRef(null)
  const painting    = useRef(false)
  const erasing     = useRef(false)
  const lastCell    = useRef(null)
  const selAnchor   = useRef(null)
  const lineAnchor  = useRef(null)
  const moveAnchor  = useRef(null)
  const moveSel     = useRef(null)
  const movePixels  = useRef(null)
  const [pastePos,  setPastePos]  = useState(null)
  const [movePos,   setMovePos]   = useState(null)

  useEffect(() => {
    if (activeTool !== 'move') { moveAnchor.current = null; setMovePos(null) }
  }, [activeTool])

  useEffect(() => { lineAnchor.current = null }, [activeTool])

  const cellW = CELL_W_BASE[videoMode] * zoom * (doubleWidth ? 2 : 1)
  const cellH = CELL_H_BASE * zoom

  // Global mouse listeners so selection drag keeps working outside the canvas
  useEffect(() => {
    const onGlobalMove = (e) => {
      if (!selAnchor.current) return
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const x = Math.max(0, Math.min(width - 1, Math.floor((e.clientX - rect.left) / cellW)))
      const y = Math.max(0, Math.min(height - 1, Math.floor((e.clientY - rect.top)  / cellH)))
      onSelectionChange(normalizeSelection(selAnchor.current, { x, y }))
    }
    const onGlobalUp = () => {
      if (!selAnchor.current) return
      selAnchor.current = null
      painting.current  = false
      erasing.current   = false
      lastCell.current  = null
    }
    window.addEventListener('mousemove', onGlobalMove)
    window.addEventListener('mouseup',   onGlobalUp)
    return () => {
      window.removeEventListener('mousemove', onGlobalMove)
      window.removeEventListener('mouseup',   onGlobalUp)
    }
  }, [cellW, cellH, width, height, onSelectionChange])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    renderSpriteToCanvas(canvas, pixels, width, height, videoMode, palette, cellW, cellH, {
      showGrid: true, gridCellW, gridCellH,
    })
  }, [pixels, width, height, videoMode, palette, cellW, cellH, gridCellW, gridCellH])

  const getCellFromEvent = useCallback((e) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const x = Math.floor((e.clientX - rect.left) / cellW)
    const y = Math.floor((e.clientY - rect.top)  / cellH)
    if (x < 0 || y < 0 || x >= width || y >= height) return null
    return { x, y }
  }, [cellW, cellH, width, height])

  const paintCell = useCallback((e, cell) => {
    if (!cell) return
    const key = `${cell.x},${cell.y}`
    if (key === lastCell.current && activeTool !== 'picker') return
    lastCell.current = key
    if (activeTool === 'picker') { onPaint(cell.x, cell.y, pixels[cell.y * width + cell.x], true); return }
    if (activeTool === 'eraser' && !cellInSelection(cell.x, cell.y, selection)) return
    onPaint(cell.x, cell.y, activeTool === 'eraser' ? 0 : activeInk, false)
  }, [activeTool, activeInk, pixels, width, onPaint, selection])

  const eraseCell = useCallback((cell) => {
    if (!cell) return
    if (!cellInSelection(cell.x, cell.y, selection)) return
    const key = `${cell.x},${cell.y}`
    if (key === lastCell.current) return
    lastCell.current = key
    onPaint(cell.x, cell.y, bgInk, false)
  }, [onPaint, selection, bgInk])

  const handleMouseDown = useCallback((e) => {
    e.preventDefault()
    lastCell.current = null
    const cell = getCellFromEvent(e)

    if (isPasting && cell) { onPasteCommit(cell.x, cell.y); return }

    if (activeTool === 'fill' && cell) { onFill(cell.x, cell.y, e.button === 2 ? bgInk : activeInk); return }

    if (activeTool === 'select') {
      if (cell) { selAnchor.current = cell; onSelectionChange(normalizeSelection(cell, cell)) }
      return
    }

    if (activeTool === 'move' && selection && cell) {
      const { x, y, w, h } = selection
      const captured = []
      for (let py = 0; py < h; py++)
        for (let px = 0; px < w; px++)
          captured.push(pixels[(y + py) * width + (x + px)] ?? 0)
      moveAnchor.current = cell
      moveSel.current    = selection
      movePixels.current = captured
      setMovePos({ x: selection.x, y: selection.y })
      onMoveStart(selection, captured)
      return
    }

    onStrokeStart?.()
    if (activeTool === 'eraser' && selection) { onEraseSelection(); return }
    if (e.button === 2) { erasing.current = true; eraseCell(cell); return }
    painting.current = true
    if (cell) {
      if (activeTool === 'pencil' && e.shiftKey && lineAnchor.current) {
        const cells = bresenhamLine(lineAnchor.current.x, lineAnchor.current.y, cell.x, cell.y)
        onPaintLine(cells, activeInk)
        lineAnchor.current = cell
      } else {
        paintCell(e, cell)
        lineAnchor.current = cell
      }
    }
  }, [getCellFromEvent, paintCell, eraseCell, activeTool, activeInk, bgInk, isPasting, onPasteCommit, onSelectionChange, onStrokeStart, onPaintLine, onEraseSelection, onMoveStart, selection, pixels, width])

  const handleMouseMove = useCallback((e) => {
    const cell = getCellFromEvent(e)
    onCursorPos?.(cell)
    if (isPasting) { setPastePos(cell); return }
    if (moveAnchor.current && cell) {
      const dx = cell.x - moveAnchor.current.x
      const dy = cell.y - moveAnchor.current.y
      setMovePos({ x: moveSel.current.x + dx, y: moveSel.current.y + dy })
      return
    }
    if (activeTool === 'select') {
      if (selAnchor.current && cell) onSelectionChange(normalizeSelection(selAnchor.current, cell))
      return
    }
    if (erasing.current) { eraseCell(cell); return }
    if (!painting.current || activeTool === 'picker') return
    if (cell) paintCell(e, cell)
  }, [getCellFromEvent, paintCell, eraseCell, activeTool, isPasting, onSelectionChange, onCursorPos])

  const handleMouseUp = useCallback(() => {
    selAnchor.current = null
    painting.current = false
    erasing.current  = false
    lastCell.current = null
    if (moveAnchor.current) {
      onMoveCommit(movePos, movePixels.current, moveSel.current)
      moveAnchor.current = null
      setMovePos(null)
    }
  }, [movePos, onMoveCommit])

  const handleWheel = useCallback((e) => {
    e.preventDefault()
    const idx = SPRITE_ZOOM_LEVELS.indexOf(zoom)
    if (e.deltaY < 0 && idx < SPRITE_ZOOM_LEVELS.length - 1) onZoomChange(SPRITE_ZOOM_LEVELS[idx + 1])
    if (e.deltaY > 0 && idx > 0)                             onZoomChange(SPRITE_ZOOM_LEVELS[idx - 1])
  }, [zoom, onZoomChange])

  const paintCursor = useMemo(() => {
    if (activeTool !== 'pencil' && activeTool !== 'eraser') return null
    const w = Math.min(cellW, 128)
    const h = Math.min(cellH, 128)
    const canvas = document.createElement('canvas')
    canvas.width  = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (activeTool === 'eraser' || activeInk === 0) {
      // Checkerboard to signal transparency
      const s = Math.max(2, Math.floor(Math.min(w, h) / 4))
      for (let py = 0; py < h; py += s)
        for (let px = 0; px < w; px += s) {
          ctx.fillStyle = ((Math.floor(px / s) + Math.floor(py / s)) % 2 === 0) ? '#555' : '#888'
          ctx.fillRect(px, py, s, s)
        }
    } else {
      ctx.fillStyle = CPC_COLORS[palette[activeInk] ?? 0]
      ctx.fillRect(0, 0, w, h)
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'
    ctx.lineWidth = 1
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1)
    const hx = Math.floor(w / 2)
    const hy = Math.floor(h / 2)
    return `url(${canvas.toDataURL()}) ${hx} ${hy}, crosshair`
  }, [activeTool, activeInk, palette, cellW, cellH])

  const cursor = isPasting                    ? 'copy'
    : movePos !== null                        ? 'grabbing'
    : activeTool === 'move'                   ? (selection ? 'grab' : 'default')
    : activeTool === 'select'                 ? 'crosshair'
    : activeTool === 'picker'                 ? 'crosshair'
    : activeTool === 'fill'                   ? 'crosshair'
    : paintCursor                             ?? 'default'

  return (
    <div style={{ overflow: 'auto', flex: 1, padding: '16px', background: 'var(--bg)' }} onWheel={handleWheel}>
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <canvas
          ref={canvasRef}
          style={{ display: 'block', imageRendering: 'pixelated', cursor }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => { if (!selAnchor.current) handleMouseUp(); setPastePos(null); onCursorPos?.(null) }}
          onContextMenu={e => e.preventDefault()}
        />
        {/* Selection overlay */}
        {selection && !movePos && (
          <div style={{
            position: 'absolute',
            left: selection.x * cellW, top: selection.y * cellH,
            width: selection.w * cellW, height: selection.h * cellH,
            border: '2px dashed rgba(0,232,122,0.9)',
            boxSizing: 'border-box', pointerEvents: 'none', zIndex: 5,
          }} />
        )}
        {/* Move preview */}
        {movePos && movePixels.current && moveSel.current && (
          <>
            <div style={{
              position: 'absolute',
              left: movePos.x * cellW, top: movePos.y * cellH,
              width: moveSel.current.w * cellW, height: moveSel.current.h * cellH,
              border: '2px dashed rgba(0,232,122,0.9)',
              boxSizing: 'border-box', pointerEvents: 'none', zIndex: 5,
            }} />
            <PasteOverlay
              x={movePos.x * cellW} y={movePos.y * cellH}
              clipboard={{ w: moveSel.current.w, h: moveSel.current.h, pixels: movePixels.current }}
              palette={palette} cellW={cellW} cellH={cellH}
            />
          </>
        )}
        {/* Paste preview */}
        {isPasting && pastePos && clipboard && (
          <PasteOverlay
            x={pastePos.x * cellW} y={pastePos.y * cellH}
            clipboard={clipboard} palette={palette} cellW={cellW} cellH={cellH}
          />
        )}
      </div>
    </div>
  )
}

// ── PasteOverlay ──────────────────────────────────────────────────────────────

function PasteOverlay({ x, y, clipboard, palette, cellW, cellH }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width  = clipboard.w * cellW
    canvas.height = clipboard.h * cellH
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    for (let py = 0; py < clipboard.h; py++) {
      for (let px = 0; px < clipboard.w; px++) {
        const ink = clipboard.pixels[py * clipboard.w + px]
        if (ink === 0) continue
        ctx.fillStyle = CPC_COLORS[palette[ink] ?? 0]
        ctx.fillRect(px * cellW, py * cellH, cellW, cellH)
      }
    }
  }, [clipboard, palette, cellW, cellH])

  return (
    <div style={{
      position: 'absolute', left: x, top: y,
      pointerEvents: 'none', zIndex: 10, opacity: 0.78,
      outline: '1px dashed var(--amber)',
    }}>
      <canvas ref={canvasRef} style={{ display: 'block', imageRendering: 'pixelated' }} />
    </div>
  )
}

// ── FrameThumb ────────────────────────────────────────────────────────────────

function FrameThumb({ pixels, width, height, videoMode, palette, active, onClick, onDelete, canDelete }) {
  const canvasRef = useRef(null)
  const [hovered, setHovered] = useState(false)

  const scale  = Math.max(1, Math.floor(48 / height))
  const cellW  = CELL_W_BASE[videoMode] * scale
  const cellH  = CELL_H_BASE * scale

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    renderSpriteToCanvas(canvas, pixels, width, height, videoMode, palette, cellW, cellH)
  }, [pixels, width, height, videoMode, palette, cellW, cellH])

  return (
    <div
      style={{ position: 'relative', flexShrink: 0, cursor: 'pointer' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          imageRendering: 'pixelated',
          border: active ? '2px solid var(--green)' : '2px solid var(--border)',
          transition: 'border-color 0.15s',
        }}
      />
      {hovered && canDelete && (
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          style={{
            position: 'absolute', top: '2px', right: '2px',
            width: '14px', height: '14px',
            background: 'rgba(0,0,0,0.8)',
            border: '1px solid var(--red)',
            color: 'var(--red)', cursor: 'pointer',
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '5px', lineHeight: '12px',
            textAlign: 'center', padding: 0,
          }}
        >✕</button>
      )}
    </div>
  )
}

// ── AnimPreview ───────────────────────────────────────────────────────────────

function AnimPreview({ frames, width, height, videoMode, palette, fps }) {
  const canvasRef   = useRef(null)
  const frameIdxRef = useRef(0)

  const scale = Math.max(1, Math.floor(64 / height))
  const cellW = CELL_W_BASE[videoMode] * scale
  const cellH = CELL_H_BASE * scale

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !frames.length) return

    let frameIdx = frameIdxRef.current % frames.length

    const draw = () => {
      renderSpriteToCanvas(canvas, frames[frameIdx].pixels, width, height, videoMode, palette, cellW, cellH)
    }

    draw()

    const interval = setInterval(() => {
      frameIdx = (frameIdx + 1) % frames.length
      frameIdxRef.current = frameIdx
      draw()
    }, Math.max(1, Math.round(1000 / fps)))

    return () => clearInterval(interval)
  }, [frames, width, height, videoMode, palette, cellW, cellH, fps])

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', imageRendering: 'pixelated', border: '1px solid var(--border)' }}
    />
  )
}

// ── ExportModal ───────────────────────────────────────────────────────────────

function ExportModal({ sprite, onClose }) {
  const [format,      setFormat]      = useState('hex')
  const [interleaved, setInterleaved] = useState(false)
  const [withMask,    setWithMask]    = useState(false)
  const [copied,      setCopied]      = useState(false)

  const code = sprite ? generateExport(sprite, { format, interleaved, withMask }) : ''

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const btnStyle = (active) => ({
    padding: '6px 14px', cursor: 'pointer',
    fontFamily: "'Press Start 2P', monospace", fontSize: '7px',
    letterSpacing: '1px',
    background: active ? 'var(--green)' : 'transparent',
    color: active ? '#000' : 'var(--text-dim)',
    border: `1px solid ${active ? 'var(--green)' : 'var(--border)'}`,
    transition: 'all 0.15s',
  })

  const chkStyle = (active) => ({
    display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
    padding: '6px 10px',
    background: active ? 'rgba(0,232,122,0.08)' : 'transparent',
    border: `1px solid ${active ? 'var(--green-dim)' : 'var(--border)'}`,
    transition: 'all 0.15s',
  })

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div className="pixel-panel" style={{ width: '100%', maxWidth: '640px', padding: '32px', position: 'relative', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>

        {/* Title */}
        <div style={{ marginBottom: '20px', flexShrink: 0 }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '9px', color: 'var(--green)', letterSpacing: '2px' }}>
            EXPORT CODE
          </div>
          <div style={{ width: '32px', height: '2px', background: 'var(--green)', marginTop: '10px' }} />
        </div>

        {/* Options row */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', flexShrink: 0 }}>
          {/* Format buttons */}
          <div style={{ display: 'flex', gap: '4px' }}>
            {['hex', 'dec', 'basic'].map(f => (
              <button key={f} style={btnStyle(format === f)} onClick={() => setFormat(f)}>
                {f === 'basic' ? 'BASIC DATA' : f.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Checkboxes */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={chkStyle(interleaved)} onClick={() => setInterleaved(v => !v)}>
              <span style={{
                width: '12px', height: '12px', flexShrink: 0, display: 'inline-block',
                border: `2px solid ${interleaved ? 'var(--green)' : 'var(--text-dim)'}`,
                background: interleaved ? 'var(--green)' : 'transparent',
                transition: 'all 0.15s',
              }} />
              <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '6px', color: interleaved ? 'var(--green)' : 'var(--text-dim)', letterSpacing: '0.5px' }}>
                INTERLEAVED
              </span>
            </div>
            <div style={chkStyle(withMask)} onClick={() => setWithMask(v => !v)}>
              <span style={{
                width: '12px', height: '12px', flexShrink: 0, display: 'inline-block',
                border: `2px solid ${withMask ? 'var(--green)' : 'var(--text-dim)'}`,
                background: withMask ? 'var(--green)' : 'transparent',
                transition: 'all 0.15s',
              }} />
              <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '6px', color: withMask ? 'var(--green)' : 'var(--text-dim)', letterSpacing: '0.5px' }}>
                WITH MASK
              </span>
            </div>
          </div>
        </div>

        {/* Code area */}
        <textarea
          readOnly
          value={code}
          style={{
            flex: 1, minHeight: '300px',
            background: '#020508',
            border: '1px solid var(--border)',
            color: 'var(--green)',
            fontFamily: "'VT323', monospace",
            fontSize: '15px',
            letterSpacing: '1px',
            lineHeight: 1.5,
            padding: '14px',
            resize: 'none',
            outline: 'none',
            overflow: 'auto',
          }}
        />

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '16px', flexShrink: 0 }}>
          <button
            onClick={handleCopy}
            style={{
              flex: 1, padding: '12px',
              background: copied ? 'var(--green)' : 'transparent',
              border: `1px solid ${copied ? 'var(--green)' : 'var(--border)'}`,
              color: copied ? '#000' : 'var(--text-dim)',
              fontFamily: "'Press Start 2P', monospace",
              fontSize: '8px', letterSpacing: '1px',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            {copied ? '✓ COPIED' : 'COPY'}
          </button>
          <button
            className="btn-ghost"
            onClick={onClose}
            style={{ flex: 1 }}
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  )
}

// ── PropertiesModal ───────────────────────────────────────────────────────────

function resizeFrames(frames, oldW, oldH, newW, newH, anchorCol, anchorRow, bgInk) {
  const offsetX = anchorCol === 0 ? 0 : anchorCol === 1 ? Math.round((newW - oldW) / 2) : newW - oldW
  const offsetY = anchorRow === 0 ? 0 : anchorRow === 1 ? Math.round((newH - oldH) / 2) : newH - oldH
  return frames.map(frame => {
    const pixels = Array(newW * newH).fill(bgInk)
    for (let y = 0; y < oldH; y++) {
      for (let x = 0; x < oldW; x++) {
        const nx = x + offsetX
        const ny = y + offsetY
        if (nx >= 0 && nx < newW && ny >= 0 && ny < newH) {
          pixels[ny * newW + nx] = frame.pixels[y * oldW + x]
        }
      }
    }
    return { ...frame, pixels }
  })
}

function PropertiesModal({ sprite, videoMode, inkCount, doubleWidth, onApply, onCancel }) {
  const multiple = videoMode === 0 ? 2 : videoMode === 1 ? 4 : 8

  const snapW = (v) => {
    const n = Math.max(multiple, parseInt(v, 10) || multiple)
    return Math.round(n / multiple) * multiple
  }

  const [name,     setName]     = useState(sprite.name || '')
  const [newW,     setNewW]     = useState(sprite.width)
  const [newH,     setNewH]     = useState(sprite.height)
  const [wDraft,   setWDraft]   = useState(null)
  const [hDraft,   setHDraft]   = useState(null)
  const [anchor,   setAnchor]   = useState({ col: 0, row: 0 })
  const [bgInk,    setBgInk]    = useState(0)
  const [dblWidth, setDblWidth] = useState(doubleWidth)

  const sizeChanged = newW !== sprite.width || newH !== sprite.height

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
      <div className="pixel-panel fade-up" style={{ width: '100%', maxWidth: '380px', padding: '32px', position: 'relative' }}>

        {/* Close */}
        <button onClick={onCancel} style={{ position: 'absolute', top: '12px', right: '12px', width: '24px', height: '24px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-dim)', cursor: 'pointer', fontFamily: "'Press Start 2P', monospace", fontSize: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'border-color 0.15s, color 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--red)'; e.currentTarget.style.color = 'var(--red)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-dim)' }}
        >✕</button>

        {/* Title */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '10px', color: 'var(--green)', letterSpacing: '2px' }}>PROPERTIES</div>
          <div style={{ width: '36px', height: '2px', background: 'var(--green)', marginTop: '10px' }} />
        </div>

        {/* Name */}
        <div style={{ marginBottom: '18px' }}>
          <label className="pixel-label">NAME</label>
          <input className="pixel-input" type="text" value={name} onChange={e => setName(e.target.value)} style={{ width: '100%' }} />
        </div>

        {/* Current size */}
        <div style={{ marginBottom: '18px' }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '6px', color: 'var(--text-dim)', letterSpacing: '2px', marginBottom: '6px' }}>CURRENT SIZE</div>
          <div style={{ fontFamily: "'VT323', monospace", fontSize: '20px', color: 'var(--amber)', letterSpacing: '2px' }}>
            {sprite.width} × {sprite.height} px
          </div>
        </div>

        {/* Canvas size */}
        <div style={{ marginBottom: '18px' }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '6px', color: 'var(--amber)', letterSpacing: '2px', marginBottom: '10px' }}>CANVAS SIZE</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label className="pixel-label">WIDTH</label>
              <input className="pixel-input" type="number" min={multiple} step={multiple}
                value={wDraft !== null ? wDraft : String(newW)}
                onChange={e => setWDraft(e.target.value)}
                onBlur={e => { setWDraft(null); setNewW(snapW(e.target.value)) }}
                onKeyDown={e => { if (e.key === 'Enter') { setWDraft(null); setNewW(snapW(e.target.value)) } }}
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label className="pixel-label">HEIGHT</label>
              <input className="pixel-input" type="number" min={1}
                value={hDraft !== null ? hDraft : String(newH)}
                onChange={e => setHDraft(e.target.value)}
                onBlur={e => { setHDraft(null); setNewH(Math.max(1, parseInt(e.target.value) || 1)) }}
                onKeyDown={e => { if (e.key === 'Enter') { setHDraft(null); setNewH(Math.max(1, parseInt(e.target.value) || 1)) } }}
                style={{ width: '100%' }}
              />
            </div>
          </div>
        </div>

        {/* Anchor + Background */}
        <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', marginBottom: '18px' }}>

          {/* Anchor grid */}
          <div style={{ opacity: sizeChanged ? 1 : 0.35, pointerEvents: sizeChanged ? 'auto' : 'none' }}>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '6px', color: 'var(--amber)', letterSpacing: '2px', marginBottom: '10px' }}>ANCHOR</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 28px)', gap: '3px' }}>
              {[0, 1, 2].flatMap(row => [0, 1, 2].map(col => {
                const isActive = anchor.col === col && anchor.row === row
                return (
                  <button key={`${row}-${col}`} onClick={() => setAnchor({ col, row })} style={{
                    width: '28px', height: '28px', cursor: 'pointer',
                    background: isActive ? 'var(--green)' : 'var(--bg2)',
                    border: `1px solid ${isActive ? 'var(--green)' : 'var(--border)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.1s',
                  }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.borderColor = 'var(--green-dim)' }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.borderColor = 'var(--border)' }}
                  >
                    <div style={{ width: '8px', height: '8px', background: isActive ? '#000' : 'var(--text-dim)', borderRadius: '1px' }} />
                  </button>
                )
              }))}
            </div>
          </div>

          {/* Background ink */}
          <div style={{ flex: 1, opacity: sizeChanged ? 1 : 0.35, pointerEvents: sizeChanged ? 'auto' : 'none' }}>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '6px', color: 'var(--amber)', letterSpacing: '2px', marginBottom: '10px' }}>BACKGROUND</div>
            <div style={{ fontFamily: "'VT323', monospace", fontSize: '13px', color: 'var(--text-dim)', marginBottom: '6px', letterSpacing: '1px' }}>
              New space ink:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
              {Array.from({ length: inkCount }, (_, i) => {
                const isActive = bgInk === i
                const hex = CPC_COLORS[sprite.palette[i] ?? 0]
                return (
                  <div key={i} onClick={() => setBgInk(i)} title={`Ink ${i}${i === 0 ? ' (transparent)' : ''}`} style={{
                    width: '22px', height: '22px', cursor: 'pointer', flexShrink: 0, boxSizing: 'border-box',
                    border: isActive ? '2px solid var(--green)' : '1px solid var(--border)',
                    background: i === 0
                      ? 'repeating-conic-gradient(#111820 0% 25%, #0c1219 0% 50%) 0 0 / 8px 8px'
                      : hex,
                  }} />
                )
              })}
            </div>
          </div>
        </div>

        {/* Double-width view */}
        <div style={{ marginBottom: '26px' }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '6px', color: 'var(--amber)', letterSpacing: '2px', marginBottom: '10px' }}>VIEW</div>
          <div onClick={() => setDblWidth(v => !v)} style={{
            display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer',
            padding: '8px 10px',
            background: dblWidth ? 'rgba(0,232,122,0.08)' : 'transparent',
            border: `1px solid ${dblWidth ? 'var(--green-dim)' : 'var(--border)'}`,
            transition: 'all 0.15s',
          }}>
            <span style={{
              width: '14px', height: '14px', flexShrink: 0,
              border: `2px solid ${dblWidth ? 'var(--green)' : 'var(--text-dim)'}`,
              background: dblWidth ? 'var(--green)' : 'transparent',
              transition: 'all 0.15s', display: 'inline-block',
            }} />
            <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '6px', color: dblWidth ? 'var(--green)' : 'var(--text-dim)', letterSpacing: '1px' }}>
              DOUBLE WIDTH PIXELS [D]
            </span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-pixel" onClick={() => onApply({ name, newW, newH, anchorCol: anchor.col, anchorRow: anchor.row, bgInk, doubleWidth: dblWidth })} style={{ flex: 1 }}>APPLY</button>
          <button className="btn-ghost" onClick={onCancel} style={{ flex: 1 }}>CANCEL</button>
        </div>
      </div>
    </div>
  )
}

// ── SpriteMinimap ─────────────────────────────────────────────────────────────

function SpriteMinimap({ pixels, width, height, videoMode, palette }) {
  const canvasRef = useRef(null)

  const maxSize  = 172
  const miniZoom = Math.min(1, maxSize / (width * CELL_W_BASE[videoMode]), maxSize / (height * CELL_H_BASE))
  const cellW    = CELL_W_BASE[videoMode] * miniZoom
  const cellH    = CELL_H_BASE * miniZoom

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    renderSpriteToCanvas(canvas, pixels, width, height, videoMode, palette, cellW, cellH, { showGrid: false })
  }, [pixels, width, height, videoMode, palette, cellW, cellH])

  return (
    <div>
      <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '6px', color: 'var(--text-dim)', letterSpacing: '1px', marginBottom: '8px' }}>
        PREVIEW
      </div>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', imageRendering: 'pixelated', border: '1px solid var(--border)' }}
      />
    </div>
  )
}

// ── SettingsModal ─────────────────────────────────────────────────────────────

function SettingsModal({ doubleWidth, gridCellW, gridCellH, onApply, onCancel }) {
  const [dblWidth,  setDblWidth]  = useState(doubleWidth)
  const [cellW,     setCellW]     = useState(gridCellW)
  const [cellH,     setCellH]     = useState(gridCellH)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
      <div className="pixel-panel fade-up" style={{ width: '100%', maxWidth: '340px', padding: '32px', position: 'relative' }}>

        {/* Close */}
        <button onClick={onCancel} style={{ position: 'absolute', top: '12px', right: '12px', width: '24px', height: '24px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-dim)', cursor: 'pointer', fontFamily: "'Press Start 2P', monospace", fontSize: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'border-color 0.15s, color 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--red)'; e.currentTarget.style.color = 'var(--red)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-dim)' }}
        >✕</button>

        {/* Title */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '10px', color: 'var(--green)', letterSpacing: '2px' }}>VIEW SETTINGS</div>
          <div style={{ width: '36px', height: '2px', background: 'var(--green)', marginTop: '10px' }} />
        </div>

        {/* Double-width */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '6px', color: 'var(--amber)', letterSpacing: '2px', marginBottom: '10px' }}>PIXEL VIEW</div>
          <div onClick={() => setDblWidth(v => !v)} style={{
            display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer',
            padding: '8px 10px',
            background: dblWidth ? 'rgba(0,232,122,0.08)' : 'transparent',
            border: `1px solid ${dblWidth ? 'var(--green-dim)' : 'var(--border)'}`,
            transition: 'all 0.15s',
          }}>
            <span style={{
              width: '14px', height: '14px', flexShrink: 0,
              border: `2px solid ${dblWidth ? 'var(--green)' : 'var(--text-dim)'}`,
              background: dblWidth ? 'var(--green)' : 'transparent',
              transition: 'all 0.15s', display: 'inline-block',
            }} />
            <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '6px', color: dblWidth ? 'var(--green)' : 'var(--text-dim)', letterSpacing: '1px' }}>
              DOUBLE WIDTH PIXELS [D]
            </span>
          </div>
        </div>

        {/* Grid */}
        <div style={{ marginBottom: '26px' }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '6px', color: 'var(--amber)', letterSpacing: '2px', marginBottom: '10px' }}>GRID CELL SIZE</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label className="pixel-label">WIDTH</label>
              <input className="pixel-input" type="number" min={1} value={cellW}
                onChange={e => setCellW(Math.max(1, parseInt(e.target.value) || 1))}
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label className="pixel-label">HEIGHT</label>
              <input className="pixel-input" type="number" min={1} value={cellH}
                onChange={e => setCellH(Math.max(1, parseInt(e.target.value) || 1))}
                style={{ width: '100%' }}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-pixel" onClick={() => onApply({ doubleWidth: dblWidth, gridCellW: cellW, gridCellH: cellH })} style={{ flex: 1 }}>APPLY</button>
          <button className="btn-ghost" onClick={onCancel} style={{ flex: 1 }}>CANCEL</button>
        </div>
      </div>
    </div>
  )
}

// ── ToolBtn ───────────────────────────────────────────────────────────────────

function ToolBtn({ label, name, title, active, onClick, disabled }) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%', cursor: disabled ? 'default' : 'pointer',
        background: active ? 'var(--green)' : 'transparent',
        border: `1px solid ${active ? 'var(--green)' : 'var(--border)'}`,
        color: active ? '#000' : 'var(--text-dim)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: '4px', padding: '8px 4px',
        transition: 'all 0.15s', flexShrink: 0,
        opacity: disabled ? 0.35 : 1,
      }}
      onMouseEnter={e => { if (!active && !disabled) { e.currentTarget.style.borderColor = 'var(--green-dim)'; e.currentTarget.style.color = 'var(--text)' } }}
      onMouseLeave={e => { if (!active && !disabled) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-dim)' } }}
    >
      <span style={{ fontFamily: "'VT323', monospace", fontSize: '28px', lineHeight: 1 }}>{label}</span>
      {name && <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '6px', letterSpacing: '0.5px', lineHeight: 1, opacity: active ? 0.7 : 0.6 }}>{name}</span>}
    </button>
  )
}

// ── SpriteEditor ──────────────────────────────────────────────────────────────

export default function SpriteEditor({ userId, projectId, spriteId, setSaveStatus, onDeleted }) {
  const [sprite,       setSprite]       = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [currentFrame, setCurrentFrame] = useState(0)
  const [activeTool,   setActiveTool]   = useState('pencil')
  const [activeInk,    setActiveInk]    = useState(1)
  const [bgInk,        setBgInk]        = useState(0)
  const [doubleWidth,  setDoubleWidth]  = useState(false)
  const [zoom,         setZoom]         = useState(2)
  const [playFps,      setPlayFps]      = useState(6)
  const [showExport,      setShowExport]      = useState(false)
  const [showProperties,  setShowProperties]  = useState(false)
  const [showSettings,    setShowSettings]    = useState(false)
  const [gridCellW,    setGridCellW]    = useState(8)
  const [gridCellH,    setGridCellH]    = useState(8)
  const [selection,    setSelection]    = useState(null)
  const [clipboard,    setClipboard]    = useState(null)
  const [isPasting,    setIsPasting]    = useState(false)
  const [cursorPos,    setCursorPos]    = useState(null)

  const saveTimer   = useRef(null)
  const spriteRef   = useRef(null)
  const historyRef  = useRef([])
  const [canUndo,  setCanUndo]  = useState(false)

  // Keep ref in sync for autosave
  useEffect(() => { spriteRef.current = sprite }, [sprite])

  // Load sprite on mount / spriteId change
  useEffect(() => {
    if (!spriteId) return
    setLoading(true)
    setCurrentFrame(0)
    loadSprite(userId, projectId, spriteId)
      .then(data => {
        setSprite(data)
        setLoading(false)
        historyRef.current = []
        setCanUndo(false)
      })
      .catch(err => {
        console.error('Failed to load sprite:', err)
        setLoading(false)
      })
  }, [spriteId, userId, projectId])

  // Auto-save
  const scheduleAutoSave = useCallback((updatedSprite) => {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaveStatus('saving')
      try {
        await saveSprite(userId, projectId, spriteId, {
          name:      updatedSprite.name,
          videoMode: updatedSprite.videoMode,
          width:     updatedSprite.width,
          height:    updatedSprite.height,
          palette:   updatedSprite.palette,
          frames:    updatedSprite.frames,
        })
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus(null), 2000)
      } catch (err) {
        console.error('Failed to save sprite:', err)
        setSaveStatus('error')
        setTimeout(() => setSaveStatus(null), 4000)
      }
    }, 1500)
  }, [userId, projectId, spriteId, setSaveStatus])

  const updateSprite = useCallback((updaterFn) => {
    setSprite(prev => {
      if (!prev) return prev
      const next = updaterFn(prev)
      scheduleAutoSave(next)
      return next
    })
  }, [scheduleAutoSave])

  const pushHistory = useCallback(() => {
    const current = spriteRef.current
    if (!current) return
    historyRef.current.push(current)
    if (historyRef.current.length > 50) historyRef.current.shift()
    setCanUndo(true)
  }, [])

  const handleUndo = useCallback(() => {
    const prev = historyRef.current.pop()
    if (!prev) return
    setSprite(prev)
    scheduleAutoSave(prev)
    setCanUndo(historyRef.current.length > 0)
  }, [scheduleAutoSave])

  const handleUndoRef = useRef(null)
  useEffect(() => { handleUndoRef.current = handleUndo }, [handleUndo])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT') return
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); handleUndoRef.current?.(); return }
      if (e.key === 'd' || e.key === 'D') { setDoubleWidth(v => !v); return }
      if (e.key === 'f' || e.key === 'F') { setActiveTool('fill'); setIsPasting(false); return }
      if (e.key === 'r' || e.key === 'R') { setActiveTool('select'); setIsPasting(false); return }
      if (e.key === 'm' || e.key === 'M') { setActiveTool('move');   setIsPasting(false); return }
      if (e.key === 'Escape') { setSelection(null); setIsPasting(false); setActiveTool(t => t === 'select' ? 'pencil' : t); return }
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault()
        handleCopyRef.current?.()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
        e.preventDefault()
        handleCutRef.current?.()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault()
        setIsPasting(true)
        setActiveTool('select')
        return
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Paint handler
  const handlePaint = useCallback((cx, cy, ink, isPick) => {
    if (isPick) {
      setActiveInk(ink)
      return
    }
    updateSprite(prev => {
      const frames = prev.frames.map((f, fi) => {
        if (fi !== currentFrame) return f
        const pixels = [...f.pixels]
        pixels[cy * prev.width + cx] = ink
        return { ...f, pixels }
      })
      return { ...prev, frames }
    })
  }, [currentFrame, updateSprite])

  // Paint line handler (Shift+click)
  const handlePaintLine = useCallback((cells, ink) => {
    updateSprite(prev => {
      const frames = prev.frames.map((f, fi) => {
        if (fi !== currentFrame) return f
        const pixels = [...f.pixels]
        for (const { x, y } of cells) {
          if (x >= 0 && x < prev.width && y >= 0 && y < prev.height)
            pixels[y * prev.width + x] = ink
        }
        return { ...f, pixels }
      })
      return { ...prev, frames }
    })
  }, [currentFrame, updateSprite])

  // Flip H
  const flipH = useCallback(() => {
    pushHistory()
    updateSprite(prev => {
      const { width, height } = prev
      const frames = prev.frames.map((f, fi) => {
        if (fi !== currentFrame) return f
        const pixels = Array(width * height)
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            pixels[y * width + x] = f.pixels[y * width + (width - 1 - x)]
          }
        }
        return { ...f, pixels }
      })
      return { ...prev, frames }
    })
  }, [currentFrame, updateSprite, pushHistory])

  // Flip V
  const flipV = useCallback(() => {
    pushHistory()
    updateSprite(prev => {
      const { width, height } = prev
      const frames = prev.frames.map((f, fi) => {
        if (fi !== currentFrame) return f
        const pixels = Array(width * height)
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            pixels[y * width + x] = f.pixels[(height - 1 - y) * width + x]
          }
        }
        return { ...f, pixels }
      })
      return { ...prev, frames }
    })
  }, [currentFrame, updateSprite, pushHistory])

  // Add frame (clone current)
  const addFrame = useCallback(() => {
    pushHistory()
    updateSprite(prev => {
      const clone = { pixels: [...prev.frames[currentFrame].pixels] }
      const frames = [
        ...prev.frames.slice(0, currentFrame + 1),
        clone,
        ...prev.frames.slice(currentFrame + 1),
      ]
      return { ...prev, frames }
    })
    setCurrentFrame(fi => fi + 1)
  }, [currentFrame, updateSprite, pushHistory])

  // Delete frame
  const deleteFrame = useCallback((idx) => {
    if (!sprite || sprite.frames.length <= 1) return
    pushHistory()
    updateSprite(prev => {
      const frames = prev.frames.filter((_, fi) => fi !== idx)
      return { ...prev, frames }
    })
    setCurrentFrame(fi => Math.min(fi, sprite.frames.length - 2))
  }, [sprite, updateSprite, pushHistory])

  // Assign palette color
  const assignPaletteColor = useCallback((inkSlot, cpcColorIdx) => {
    pushHistory()
    updateSprite(prev => {
      const palette = [...prev.palette]
      palette[inkSlot] = cpcColorIdx
      return { ...prev, palette }
    })
  }, [updateSprite, pushHistory])

  // ── Copy / Paste ────────────────────────────────────────────────────────────

  const handleCopyRef = useRef(null)

  const handleCopy = useCallback(() => {
    if (!selection || !sprite) return
    const { x, y, w, h } = selection
    const srcPixels = sprite.frames[currentFrame]?.pixels ?? []
    const copied = []
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        copied.push(srcPixels[(y + py) * sprite.width + (x + px)] ?? 0)
      }
    }
    setClipboard({ w, h, pixels: copied })
  }, [selection, sprite, currentFrame])

  useEffect(() => { handleCopyRef.current = handleCopy }, [handleCopy])

  const handleCutRef = useRef(null)

  const handleCut = useCallback(() => {
    if (!selection || !sprite) return
    handleCopyRef.current?.()
    // eraseSelection runs its own pushHistory — skip a second push here
    const { x, y, w, h } = selection
    updateSprite(prev => {
      const frames = prev.frames.map((f, fi) => {
        if (fi !== currentFrame) return f
        const pixels = [...f.pixels]
        for (let py = y; py < y + h; py++)
          for (let px = x; px < x + w; px++)
            if (px >= 0 && px < prev.width && py >= 0 && py < prev.height)
              pixels[py * prev.width + px] = 0
        return { ...f, pixels }
      })
      return { ...prev, frames }
    })
  }, [selection, sprite, currentFrame, updateSprite])

  useEffect(() => { handleCutRef.current = handleCut }, [handleCut])

  const handlePasteCommit = useCallback((px, py) => {
    if (!clipboard) return
    pushHistory()
    updateSprite(prev => {
      const frames = prev.frames.map((f, fi) => {
        if (fi !== currentFrame) return f
        const pixels = [...f.pixels]
        for (let cy = 0; cy < clipboard.h; cy++) {
          for (let cx = 0; cx < clipboard.w; cx++) {
            const nx = px + cx
            const ny = py + cy
            if (nx >= 0 && nx < prev.width && ny >= 0 && ny < prev.height) {
              const ink = clipboard.pixels[cy * clipboard.w + cx]
              if (ink !== 0) pixels[ny * prev.width + nx] = ink
            }
          }
        }
        return { ...f, pixels }
      })
      return { ...prev, frames }
    })
    setIsPasting(false)
    setSelection(null)
  }, [clipboard, currentFrame, updateSprite, pushHistory])

  // ── Fill ────────────────────────────────────────────────────────────────────

  const handleFill = useCallback((cx, cy, ink) => {
    pushHistory()
    const fillInk = ink ?? activeInk
    updateSprite(prev => {
      const frames = prev.frames.map((f, fi) => {
        if (fi !== currentFrame) return f
        const pixels = spriteFill(f.pixels, cx, cy, prev.width, prev.height, fillInk, selection)
        return { ...f, pixels }
      })
      return { ...prev, frames }
    })
  }, [currentFrame, activeInk, selection, updateSprite, pushHistory])

  // ── Erase selection ─────────────────────────────────────────────────────────

  const handleEraseSelection = useCallback(() => {
    if (!selection) return
    pushHistory()
    updateSprite(prev => {
      const { x, y, w, h } = selection
      const frames = prev.frames.map((f, fi) => {
        if (fi !== currentFrame) return f
        const pixels = [...f.pixels]
        for (let py = y; py < y + h; py++)
          for (let px = x; px < x + w; px++)
            if (px >= 0 && px < prev.width && py >= 0 && py < prev.height)
              pixels[py * prev.width + px] = 0
        return { ...f, pixels }
      })
      return { ...prev, frames }
    })
  }, [selection, currentFrame, updateSprite, pushHistory])

  // ── Move ─────────────────────────────────────────────────────────────────────

  const handleMoveStart = useCallback((sel, _capturedPixels) => {
    pushHistory()
    updateSprite(prev => {
      const { x, y, w, h } = sel
      const frames = prev.frames.map((f, fi) => {
        if (fi !== currentFrame) return f
        const pixels = [...f.pixels]
        for (let py = y; py < y + h; py++)
          for (let px = x; px < x + w; px++)
            if (px >= 0 && px < prev.width && py >= 0 && py < prev.height)
              pixels[py * prev.width + px] = bgInk
        return { ...f, pixels }
      })
      return { ...prev, frames }
    })
  }, [bgInk, currentFrame, updateSprite, pushHistory])

  const handleMoveCommit = useCallback((newPos, capturedPixels, origSel) => {
    if (!newPos || !capturedPixels || !origSel) return
    const { w, h } = origSel
    updateSprite(prev => {
      const frames = prev.frames.map((f, fi) => {
        if (fi !== currentFrame) return f
        const pixels = [...f.pixels]
        for (let py = 0; py < h; py++)
          for (let px = 0; px < w; px++) {
            const nx = newPos.x + px
            const ny = newPos.y + py
            if (nx >= 0 && nx < prev.width && ny >= 0 && ny < prev.height)
              pixels[ny * prev.width + nx] = capturedPixels[py * w + px]
          }
        return { ...f, pixels }
      })
      return { ...prev, frames }
    })
    setSelection({ x: newPos.x, y: newPos.y, w: origSel.w, h: origSel.h })
  }, [currentFrame, updateSprite])

  // ── Properties apply ───────────────────────────────────────────────────────

  const handleApplyProperties = useCallback(({ name, newW, newH, anchorCol, anchorRow, bgInk, doubleWidth: dw }) => {
    pushHistory()
    setShowProperties(false)
    setDoubleWidth(dw)
    updateSprite(prev => {
      const next = { ...prev, name: name.trim() || prev.name }
      if (newW === prev.width && newH === prev.height) return next
      const resized = resizeFrames(prev.frames, prev.width, prev.height, newW, newH, anchorCol, anchorRow, bgInk)
      return { ...next, width: newW, height: newH, frames: resized }
    })
    setCurrentFrame(f => 0)
  }, [updateSprite, pushHistory])

  // ── PNG export ──────────────────────────────────────────────────────────────

  const exportPNG = useCallback(() => {
    if (!sprite) return
    const { videoMode, width, height, palette, frames, name } = sprite
    const pixels = frames[currentFrame]?.pixels ?? []
    const canvas = document.createElement('canvas')
    canvas.width  = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, width, height)
    for (let py = 0; py < height; py++) {
      for (let px = 0; px < width; px++) {
        const ink = pixels[py * width + px]
        if (ink === 0) continue
        ctx.fillStyle = CPC_COLORS[palette[ink] ?? 0]
        ctx.fillRect(px, py, 1, 1)
      }
    }
    const link = document.createElement('a')
    link.download = `${name || 'sprite'}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }, [sprite, currentFrame])

  // ── PNG import ──────────────────────────────────────────────────────────────

  const importPngRef = useRef(null)

  const importPNG = useCallback((file) => {
    if (!file || !sprite) return
    const { width, height, palette } = sprite
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)
      const imageData = ctx.getImageData(0, 0, width, height).data
      pushHistory()
      updateSprite(prev => {
        const frames = prev.frames.map((f, fi) => {
          if (fi !== currentFrame) return f
          const pixels = Array(width * height)
          for (let i = 0; i < width * height; i++) {
            const r = imageData[i * 4]
            const g = imageData[i * 4 + 1]
            const b = imageData[i * 4 + 2]
            const a = imageData[i * 4 + 3]
            pixels[i] = a < 128 ? 0 : nearestPaletteInk(r, g, b, prev.palette)
          }
          return { ...f, pixels }
        })
        return { ...prev, frames }
      })
    }
    img.onerror = () => URL.revokeObjectURL(url)
    img.src = url
  }, [sprite, currentFrame, updateSprite, pushHistory])

  // ── Palette import / export (JASC-PAL) ──────────────────────────────────────

  const exportPalette = useCallback(() => {
    if (!sprite) return
    const count = MODE_INK_COUNT[sprite.videoMode]
    const lines = ['JASC-PAL', '0100', String(count)]
    for (let i = 0; i < count; i++) {
      const [r, g, b] = hexToRgb(CPC_COLORS[sprite.palette[i] ?? 0])
      lines.push(`${r} ${g} ${b}`)
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const link = document.createElement('a')
    link.download = `${sprite.name || 'palette'}.pal`
    link.href = URL.createObjectURL(blob)
    link.click()
    URL.revokeObjectURL(link.href)
  }, [sprite])

  const importPaletteRef = useRef(null)

  const importPalette = useCallback((file) => {
    if (!file || !sprite) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const lines = e.target.result.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
      const rgb = []
      let countExpected = 0, countSeen = 0
      for (const line of lines) {
        if (line === 'JASC-PAL' || line === '0100') continue
        if (countExpected === 0 && /^\d+$/.test(line)) { countExpected = parseInt(line); continue }
        const m = line.match(/^(\d+)\s+(\d+)\s+(\d+)/)
        if (m) { rgb.push([parseInt(m[1]), parseInt(m[2]), parseInt(m[3])]); countSeen++ }
        if (countExpected > 0 && countSeen >= countExpected) break
      }
      if (rgb.length === 0) return
      pushHistory()
      updateSprite(prev => {
        const palette = [...prev.palette]
        const count = MODE_INK_COUNT[prev.videoMode]
        for (let i = 0; i < Math.min(rgb.length, count); i++) {
          palette[i] = nearestCpcColor(...rgb[i])
        }
        return { ...prev, palette }
      })
    }
    reader.readAsText(file)
  }, [sprite, updateSprite, pushHistory])

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '8px', color: 'var(--green)', letterSpacing: '2px' }}>
          LOADING SPRITE<span className="blink">_</span>
        </div>
      </div>
    )
  }

  if (!sprite) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '8px', color: 'var(--red)', letterSpacing: '2px' }}>
          SPRITE NOT FOUND
        </div>
      </div>
    )
  }

  const { videoMode, width, height, palette, frames } = sprite
  const inkCount    = MODE_INK_COUNT[videoMode]
  const currentPixels = frames[currentFrame]?.pixels ?? []

  const dividerStyle = { height: '1px', background: 'var(--border)', margin: '2px 0', gridColumn: '1 / -1' }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>

      {/* TOP AREA */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* LEFT TOOLBAR */}
        <div style={{
          width: '196px', flexShrink: 0,
          background: 'var(--panel)',
          borderRight: '1px solid var(--border)',
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          alignContent: 'start', padding: '10px 6px', gap: '6px',
          overflowY: 'auto',
        }}>
          <ToolBtn label="✏" name="PENCIL" title="Pencil (draw)"       active={activeTool === 'pencil'}  onClick={() => { setActiveTool('pencil'); setIsPasting(false) }} />
          <ToolBtn label="⌫" name="ERASE"  title="Eraser"              active={activeTool === 'eraser'}  onClick={() => { setActiveTool('eraser'); setIsPasting(false) }} />
          <ToolBtn label="⊕" name="PICK"   title="Color Picker"        active={activeTool === 'picker'}  onClick={() => { setActiveTool('picker'); setIsPasting(false) }} />
          <ToolBtn label="⬚" name="SELECT" title="Select [R]"           active={activeTool === 'select'}  onClick={() => { setActiveTool('select'); setIsPasting(false) }} />
          <ToolBtn label="▪" name="FILL"   title="Fill [F]"             active={activeTool === 'fill'}    onClick={() => { setActiveTool('fill');   setIsPasting(false) }} />
          <ToolBtn label="✥" name="MOVE"   title="Move selection [M]"  active={activeTool === 'move'}    disabled={!selection} onClick={() => { setActiveTool('move');   setIsPasting(false) }} />

          <div style={dividerStyle} />

          <ToolBtn label="⎘" name="COPY"  title="Copy selection [Ctrl+C]"  active={false}     disabled={!selection} onClick={handleCopy} />
          <ToolBtn label="✂" name="CUT"   title="Cut selection [Ctrl+X]"   active={false}     disabled={!selection} onClick={handleCut} />
          <ToolBtn label="⎗" name="PASTE" title="Paste [Ctrl+V]"            active={isPasting} disabled={!clipboard} onClick={() => { setIsPasting(true); setActiveTool('select') }} />

          <div style={dividerStyle} />

          <ToolBtn label="↔" name="FLIP H" title="Flip Horizontal" active={false} onClick={flipH} />
          <ToolBtn label="↕" name="FLIP V" title="Flip Vertical"   active={false} onClick={flipV} />
          <ToolBtn label="↩" name="UNDO"   title="Undo [Ctrl+Z]"   active={false} onClick={handleUndo} disabled={!canUndo} />

          <div style={dividerStyle} />

          {/* Zoom */}
          <ToolBtn label="⊞" name="ZOOM IN"  title="Zoom In"  active={false} disabled={SPRITE_ZOOM_LEVELS.indexOf(zoom) === SPRITE_ZOOM_LEVELS.length - 1} onClick={() => { const i = SPRITE_ZOOM_LEVELS.indexOf(zoom); if (i < SPRITE_ZOOM_LEVELS.length - 1) setZoom(SPRITE_ZOOM_LEVELS[i + 1]) }} />
          <ToolBtn label="⊟" name="ZOOM OUT" title="Zoom Out" active={false} disabled={SPRITE_ZOOM_LEVELS.indexOf(zoom) === 0} onClick={() => { const i = SPRITE_ZOOM_LEVELS.indexOf(zoom); if (i > 0) setZoom(SPRITE_ZOOM_LEVELS[i - 1]) }} />

          <div style={dividerStyle} />

          <ToolBtn label="☰" name="SETTINGS" title="View Settings"    active={showSettings}   onClick={() => setShowSettings(true)} />
          <ToolBtn label="⚙" name="PROPS"    title="Sprite Properties" active={showProperties} onClick={() => setShowProperties(true)} />

          <div style={dividerStyle} />

          <ToolBtn label="⬇" name="EXPORT"  title="Export sprite data" active={false} onClick={() => setShowExport(true)} />
          <ToolBtn label="⬇" name="EXP PNG" title="Export PNG"          active={false} onClick={exportPNG} />
          <ToolBtn label="⬆" name="IMP PNG" title="Import PNG"          active={false} onClick={() => importPngRef.current?.click()} />
          <input
            ref={importPngRef}
            type="file"
            accept="image/png,image/*"
            style={{ display: 'none' }}
            onChange={e => { importPNG(e.target.files?.[0]); e.target.value = '' }}
          />

          {/* Color swatches */}
          <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '6px 0 2px' }}>
            <div style={{ position: 'relative', width: '50px', height: '46px', flexShrink: 0 }}>
              {/* Background ink (bottom-right) */}
              <div
                title={`Background ink ${bgInk} — right-click ink slot to set`}
                style={{
                  position: 'absolute', right: 0, bottom: 0,
                  width: '28px', height: '28px',
                  background: bgInk === 0
                    ? 'repeating-conic-gradient(#111820 0% 25%, #0c1219 0% 50%) 0 0 / 8px 8px'
                    : CPC_COLORS[palette[bgInk] ?? 0],
                  border: '2px solid var(--border)',
                }}
              />
              {/* Foreground ink (top-left) */}
              <div
                title={`Foreground ink ${activeInk} — left-click ink slot to set`}
                style={{
                  position: 'absolute', left: 0, top: 0,
                  width: '28px', height: '28px',
                  background: activeInk === 0
                    ? 'repeating-conic-gradient(#111820 0% 25%, #0c1219 0% 50%) 0 0 / 8px 8px'
                    : CPC_COLORS[palette[activeInk] ?? 0],
                  border: '2px solid var(--green)',
                }}
              />
            </div>
            <button
              title="Swap foreground / background"
              onClick={() => { const tmp = activeInk; setActiveInk(bgInk); setBgInk(tmp) }}
              style={{
                background: 'transparent', border: '1px solid var(--border)',
                color: 'var(--text-dim)', cursor: 'pointer',
                fontFamily: "'VT323', monospace", fontSize: '18px', lineHeight: 1,
                padding: '2px 4px',
              }}
            >⇄</button>
          </div>
        </div>

        {/* CANVAS */}
        <SpriteCanvas
          pixels={currentPixels}
          width={width}
          height={height}
          videoMode={videoMode}
          palette={palette}
          zoom={zoom}
          doubleWidth={doubleWidth}
          activeTool={activeTool}
          activeInk={activeInk}
          bgInk={bgInk}
          onPaint={handlePaint}
          onZoomChange={setZoom}
          gridCellW={gridCellW}
          gridCellH={gridCellH}
          selection={selection}
          onSelectionChange={setSelection}
          clipboard={clipboard}
          isPasting={isPasting}
          onPasteCommit={handlePasteCommit}
          onFill={handleFill}
          onStrokeStart={pushHistory}
          onPaintLine={handlePaintLine}
          onEraseSelection={handleEraseSelection}
          onMoveStart={handleMoveStart}
          onMoveCommit={handleMoveCommit}
          onCursorPos={setCursorPos}
        />

        {/* RIGHT PANEL */}
        <div style={{
          width: '200px', flexShrink: 0,
          background: 'var(--panel)',
          borderLeft: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column',
          overflowY: 'auto',
          padding: '12px',
          gap: '14px',
        }}>
          {/* Minimap */}
          <SpriteMinimap
            pixels={currentPixels}
            width={width}
            height={height}
            videoMode={videoMode}
            palette={palette}
          />

          <div style={dividerStyle} />

          {/* Info */}
          <div>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '6px', color: 'var(--text-dim)', letterSpacing: '1px', marginBottom: '6px' }}>
              {sprite.name}
            </div>
            <div style={{ fontFamily: "'VT323', monospace", fontSize: '14px', color: 'var(--text-dim)', letterSpacing: '1px', lineHeight: 1.6 }}>
              MODE {videoMode} · {width}×{height}<br />
              {frames.length} FRAME{frames.length !== 1 ? 'S' : ''} · ZOOM {zoom}X
            </div>
          </div>

          <div style={dividerStyle} />

          {/* Ink slots */}
          <div>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '6px', color: 'var(--text-dim)', letterSpacing: '1px', marginBottom: '8px' }}>
              INK SLOTS
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
              {palette.slice(0, inkCount).map((cpcIdx, inkIdx) => {
                const isInk0    = inkIdx === 0
                const isActive  = inkIdx === activeInk
                const isBg      = inkIdx === bgInk
                const colorHex  = CPC_COLORS[cpcIdx] ?? '#000'
                return (
                  <div
                    key={inkIdx}
                    onClick={() => setActiveInk(inkIdx)}
                    onContextMenu={e => { e.preventDefault(); setBgInk(inkIdx) }}
                    title={`Ink ${inkIdx} = CPC ${cpcIdx} (${colorHex})\nLeft-click → set as foreground\nRight-click → set as background`}
                    style={{
                      width: '24px', height: '24px', cursor: 'pointer',
                      border: isActive ? '2px solid var(--green)' : isBg ? '2px solid var(--amber)' : '1px solid var(--border)',
                      position: 'relative', flexShrink: 0,
                      background: isInk0
                        ? 'repeating-conic-gradient(#111820 0% 25%, #0c1219 0% 50%) 0 0 / 8px 8px'
                        : colorHex,
                      transition: 'border-color 0.1s',
                    }}
                  >
                    <span style={{
                      position: 'absolute', bottom: '1px', right: '2px',
                      fontFamily: "'Press Start 2P', monospace",
                      fontSize: '4px', lineHeight: 1,
                      color: isInk0 ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.6)',
                      pointerEvents: 'none',
                    }}>
                      {inkIdx}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Palette import / export */}
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              title="Import palette (.pal)"
              onClick={() => importPaletteRef.current?.click()}
              style={{
                flex: 1, padding: '4px 0', cursor: 'pointer',
                background: 'transparent', border: '1px solid var(--border)',
                color: 'var(--text-dim)', fontFamily: "'Press Start 2P', monospace",
                fontSize: '5px', letterSpacing: '0.5px', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--amber)'; e.currentTarget.style.color = 'var(--amber)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-dim)' }}
            >IMPORT PAL</button>
            <button
              title="Export palette (.pal)"
              onClick={exportPalette}
              style={{
                flex: 1, padding: '4px 0', cursor: 'pointer',
                background: 'transparent', border: '1px solid var(--border)',
                color: 'var(--text-dim)', fontFamily: "'Press Start 2P', monospace",
                fontSize: '5px', letterSpacing: '0.5px', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--amber)'; e.currentTarget.style.color = 'var(--amber)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-dim)' }}
            >EXPORT PAL</button>
            <input
              ref={importPaletteRef}
              type="file"
              accept=".pal"
              style={{ display: 'none' }}
              onChange={e => { importPalette(e.target.files?.[0]); e.target.value = '' }}
            />
          </div>

          <div style={dividerStyle} />

          {/* CPC Palette */}
          <div>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '5px', color: 'var(--text-dim)', letterSpacing: '1px', marginBottom: '8px' }}>
              CPC PALETTE → INK {activeInk}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: '1px' }}>
              {CPC_COLORS.map((hex, cpcIdx) => {
                const isCurrentInkColor = palette[activeInk] === cpcIdx
                return (
                  <div
                    key={cpcIdx}
                    title={`CPC ${cpcIdx}: ${hex}`}
                    onClick={() => assignPaletteColor(activeInk, cpcIdx)}
                    style={{
                      width: '100%', aspectRatio: '1',
                      background: hex, cursor: 'pointer',
                      border: isCurrentInkColor ? '2px solid var(--green)' : '1px solid transparent',
                      boxSizing: 'border-box',
                      transition: 'border-color 0.1s',
                    }}
                  />
                )
              })}
            </div>
          </div>

        </div>
      </div>

      {/* Status bar */}
      <div style={{
        height: '28px', flexShrink: 0,
        borderTop: '1px solid var(--border)',
        background: 'var(--panel)',
        display: 'flex', alignItems: 'center',
        padding: '0 16px', gap: '24px',
        fontFamily: "'Roboto Mono', 'Roboto', monospace", fontSize: '11px', fontWeight: 400,
        color: 'var(--text-dim)',
      }}>
        {cursorPos
          ? <span>px <span style={{ color: 'var(--text)', fontWeight: 600 }}>{cursorPos.x}, {cursorPos.y}</span></span>
          : <span style={{ opacity: 0.4 }}>—</span>
        }
        {selection && (
          <span>
            sel <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{selection.x}, {selection.y}</span>
            <span style={{ opacity: 0.5 }}> + </span>
            <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{selection.w} × {selection.h}</span>
          </span>
        )}
      </div>

      {/* Export Modal */}
      {showExport && (
        <ExportModal
          sprite={sprite}
          onClose={() => setShowExport(false)}
        />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          doubleWidth={doubleWidth}
          gridCellW={gridCellW}
          gridCellH={gridCellH}
          onApply={({ doubleWidth: dw, gridCellW: cw, gridCellH: ch }) => {
            setDoubleWidth(dw)
            setGridCellW(cw)
            setGridCellH(ch)
            setShowSettings(false)
          }}
          onCancel={() => setShowSettings(false)}
        />
      )}

      {/* Properties Modal */}
      {showProperties && (
        <PropertiesModal
          sprite={sprite}
          videoMode={videoMode}
          inkCount={inkCount}
          doubleWidth={doubleWidth}
          onApply={handleApplyProperties}
          onCancel={() => setShowProperties(false)}
        />
      )}
    </div>
  )
}
