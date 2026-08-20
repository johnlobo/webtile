import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { loadSprite, saveSprite } from '../services/spriteService'
import { loadFont, stampText, GLYPH_W, GLYPH_H, CHAR_MAP, glyphs } from '../services/fontService'
import { encodeFrame } from '../services/cpcEncoding'
import { bresenhamLine, fillPixels, scalePixelBlock, shapeCells, transformPixelBlock } from '../services/spriteDrawing'

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
const SPRITE_ZOOM_LEVELS  = [0.25, 0.5, 1, 2, 4, 8]

// ── CPC encoding ──────────────────────────────────────────────────────────────

function interleavedOrder(height) {
  return Array.from({ length: height }, (_, y) => ({
    y,
    offset: (y % 8) * 2048 + Math.floor(y / 8) * 80,
  })).sort((a, b) => a.offset - b.offset).map(r => r.y)
}

function generateExport(sprite, opts) {
  const { format, interleaved } = opts
  const { name, videoMode, width, height, palette, frames } = sprite

  const safeName  = (name || 'sprite').toLowerCase().replace(/[^a-z0-9_]/g, '_')
  const bytesPerRow = videoMode === 0 ? width / 2 : videoMode === 1 ? width / 4 : width / 8

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
      const allRows  = encodeFrame(frame.pixels, width, height, videoMode)
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
    const allRows  = encodeFrame(frame.pixels, width, height, videoMode)
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
  let best = 0, bestDist = Infinity
  for (let ink = 0; ink < palette.length; ink++) {
    const [cr, cg, cb] = hexToRgb(CPC_COLORS[palette[ink] ?? 0])
    const d = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2
    if (d < bestDist) { bestDist = d; best = ink }
  }
  return best
}

// ── Canvas rendering helpers ──────────────────────────────────────────────────

function renderSpriteToCanvas(canvas, pixels, width, height, videoMode, palette, cellW, cellH, opts = {}) {
  const { showGrid, gridCellW = 1, gridCellH = 1, gridColor = '#ffaa00', gridOpacity = 0.55, guidesX = [], guidesY = [], onionLayers = [] } = opts
  const ctx = canvas.getContext('2d')

  canvas.width  = width  * cellW
  canvas.height = height * cellH

  // Pixels
  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const ink = pixels[py * width + px]
      const color = CPC_COLORS[palette[ink] ?? 0]
      ctx.fillStyle = color
      ctx.fillRect(px * cellW, py * cellH, cellW, cellH)
    }
  }

  // With no transparent ink, onion skin highlights only pixels that differ.
  for (const layer of onionLayers) {
    if (!layer?.pixels) continue
    ctx.fillStyle = layer.color
    for (let py = 0; py < height; py++) {
      for (let px = 0; px < width; px++) {
        const index = py * width + px
        if (layer.pixels[index] !== pixels[index]) ctx.fillRect(px * cellW, py * cellH, cellW, cellH)
      }
    }
  }

  // Configurable grid overlay.
  if (showGrid) {
    ctx.strokeStyle = gridColor
    ctx.globalAlpha = gridOpacity
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
    ctx.globalAlpha = 1
  }

  // Pixel-coordinate guides are independent from the regular grid.
  ctx.strokeStyle = '#00e87a'
  ctx.globalAlpha = 0.9
  ctx.lineWidth = 1
  for (const x of guidesX) {
    ctx.beginPath()
    ctx.moveTo(x * cellW + 0.5, 0)
    ctx.lineTo(x * cellW + 0.5, canvas.height)
    ctx.stroke()
  }
  for (const y of guidesY) {
    ctx.beginPath()
    ctx.moveTo(0, y * cellH + 0.5)
    ctx.lineTo(canvas.width, y * cellH + 0.5)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
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

function SpriteCanvas({ pixels, width, height, videoMode, palette, zoom, doubleWidth, activeTool, activeInk, bgInk, onPaint, onZoomChange,
  showGrid, gridCellW, gridCellH, gridColor, gridOpacity, guidesX, guidesY, selection, onSelectionChange, clipboard, isPasting, onPasteCommit, onFill, onStrokeStart, onPaintLine, onEraseSelection, onMoveStart, onMoveCommit, onCursorPos, textOverlay, onTextClick, onionLayers, shapeFilled }) {
  const canvasRef   = useRef(null)
  const scrollRef   = useRef(null)
  const painting    = useRef(false)
  const erasing     = useRef(false)
  const lastCell    = useRef(null)
  const selAnchor   = useRef(null)
  const lineAnchor  = useRef(null)
  const moveAnchor  = useRef(null)
  const moveSel     = useRef(null)
  const movePixels  = useRef(null)
  const shapeAnchor = useRef(null)
  const shapeEnd    = useRef(null)
  const shapeInk    = useRef(activeInk)
  const shapeTool   = useRef(null)
  const shapeFill   = useRef(false)
  const [pastePos,  setPastePos]  = useState(null)
  const [movePos,   setMovePos]   = useState(null)
  const [shapePreview, setShapePreview] = useState(null)
  const [blink,     setBlink]     = useState(true)
  const [altPressed, setAltPressed] = useState(false)

  useEffect(() => {
    const onKeyDown = (e) => { if (e.key === 'Alt') setAltPressed(true) }
    const onKeyUp = (e) => { if (e.key === 'Alt') setAltPressed(false) }
    const onBlur = () => setAltPressed(false)
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('keyup', onKeyUp, true)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('keyup', onKeyUp, true)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  useEffect(() => {
    if (!textOverlay) return
    const id = setInterval(() => setBlink(v => !v), 500)
    return () => clearInterval(id)
  }, [textOverlay])

  useEffect(() => {
    if (activeTool !== 'move') { moveAnchor.current = null; setMovePos(null) }
  }, [activeTool])

  useEffect(() => { lineAnchor.current = null }, [activeTool])

  useEffect(() => {
    shapeAnchor.current = null
    shapeEnd.current = null
    shapeTool.current = null
    setShapePreview(null)
  }, [activeTool])

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
      showGrid, gridCellW, gridCellH, gridColor, gridOpacity, guidesX, guidesY, onionLayers,
    })

    if (textOverlay) {
      const ctx = canvas.getContext('2d')
      const upper = textOverlay.text.toUpperCase()
      let cx = textOverlay.startX * cellW
      const cy = textOverlay.startY * cellH
      for (let i = 0; i < upper.length; i++) {
        const code = upper.charCodeAt(i)
        if (code === 32) {
          cx += cellW * (GLYPH_W + 1)
          continue
        }
        const charIdx = CHAR_MAP[code]
        if (charIdx === undefined || !glyphs) {
          cx += cellW * (GLYPH_W + 1)
          continue
        }
        const glyph = glyphs[charIdx]
        if (!glyph) {
          cx += cellW * (GLYPH_W + 1)
          continue
        }
        const color = CPC_COLORS[palette[textOverlay.ink] ?? 0]
        ctx.fillStyle = color
        for (let gy = 0; gy < GLYPH_H; gy++) {
          for (let gx = 0; gx < GLYPH_W; gx++) {
            const val = glyph[gy * GLYPH_W + gx]
            if (val !== 0) {
              ctx.fillRect(cx + gx * cellW, cy + gy * cellH, cellW, cellH)
            }
          }
        }
        cx += cellW * (GLYPH_W + 1)
      }

      if (blink) {
        ctx.fillStyle = CPC_COLORS[palette[textOverlay.ink] ?? 0]
        ctx.fillRect(cx, cy, cellW, cellH * GLYPH_H)
      }
    }

    if (shapePreview) {
      const ctx = canvas.getContext('2d')
      const cells = shapeCells(shapePreview.tool, shapePreview.start, shapePreview.end, shapePreview.filled)
      ctx.globalAlpha = 0.72
      ctx.fillStyle = CPC_COLORS[palette[shapePreview.ink] ?? 0]
      for (const { x, y } of cells) ctx.fillRect(x * cellW, y * cellH, cellW, cellH)
      ctx.globalAlpha = 1
    }
  }, [pixels, width, height, videoMode, palette, cellW, cellH, showGrid, gridCellW, gridCellH, gridColor, gridOpacity, guidesX, guidesY, textOverlay, doubleWidth, blink, onionLayers, shapePreview])

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
    if (activeTool === 'picker') { onPaint(cell.x, cell.y, pixels[cell.y * width + cell.x], true, e.button === 2); return }
    if (activeTool === 'eraser' && !cellInSelection(cell.x, cell.y, selection)) return
    onPaint(cell.x, cell.y, activeTool === 'eraser' ? bgInk : activeInk, false)
  }, [activeTool, activeInk, bgInk, pixels, width, onPaint, selection])

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
    setAltPressed(e.altKey)
    lastCell.current = null
    const cell = getCellFromEvent(e)

    if (isPasting && cell) { onPasteCommit(cell.x, cell.y); return }

    const canAltPick = activeTool === 'pencil' || activeTool === 'fill' || activeTool === 'eraser'
    if ((activeTool === 'picker' || (e.altKey && canAltPick)) && cell) {
      onPaint(cell.x, cell.y, pixels[cell.y * width + cell.x], true, e.button === 2)
      return
    }

    if (activeTool === 'fill' && cell) {
      onFill(cell.x, cell.y, e.button === 2 ? bgInk : activeInk)
      return
    }

    if (activeTool === 'text' && cell) {
      onTextClick?.(cell.x, cell.y)
      return
    }

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

    if (['line', 'rectangle', 'ellipse'].includes(activeTool) && cell) {
      onStrokeStart?.()
      const ink = e.button === 2 ? bgInk : activeInk
      shapeAnchor.current = cell
      shapeEnd.current = cell
      shapeInk.current = ink
      shapeTool.current = activeTool
      shapeFill.current = shapeFilled && activeTool !== 'line'
      setShapePreview({ tool: activeTool, start: cell, end: cell, ink, filled: shapeFill.current })
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
  }, [getCellFromEvent, paintCell, eraseCell, activeTool, activeInk, bgInk, isPasting, onPasteCommit, onSelectionChange, onStrokeStart, onPaintLine, onEraseSelection, onMoveStart, selection, pixels, width, shapeFilled])

  const handleMouseMove = useCallback((e) => {
    setAltPressed(e.altKey)
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
    if (shapeAnchor.current && cell) {
      shapeEnd.current = cell
      setShapePreview({ tool: shapeTool.current, start: shapeAnchor.current, end: cell, ink: shapeInk.current, filled: shapeFill.current })
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
    if (shapeAnchor.current && shapeEnd.current && shapeTool.current) {
      onPaintLine(shapeCells(shapeTool.current, shapeAnchor.current, shapeEnd.current, shapeFill.current), shapeInk.current)
      shapeAnchor.current = null
      shapeEnd.current = null
      shapeTool.current = null
      setShapePreview(null)
    }
    if (moveAnchor.current) {
      onMoveCommit(movePos, movePixels.current, moveSel.current)
      moveAnchor.current = null
      setMovePos(null)
    }
  }, [movePos, onMoveCommit, onPaintLine])

  const handleWheel = useCallback((e) => {
    e.preventDefault()
    if (e.deltaY === 0) return
    const idx = SPRITE_ZOOM_LEVELS.indexOf(zoom)
    const nextZoom = e.deltaY < 0
      ? SPRITE_ZOOM_LEVELS[Math.min(SPRITE_ZOOM_LEVELS.length - 1, idx + 1)]
      : SPRITE_ZOOM_LEVELS[Math.max(0, idx - 1)]
    if (nextZoom === zoom) return

    const canvas = canvasRef.current
    const scroller = scrollRef.current
    if (!canvas || !scroller) { onZoomChange(nextZoom); return }

    const canvasRect = canvas.getBoundingClientRect()
    const logicalX = (e.clientX - canvasRect.left) / cellW
    const logicalY = (e.clientY - canvasRect.top) / cellH
    const pointerX = e.clientX
    const pointerY = e.clientY
    const nextCellW = CELL_W_BASE[videoMode] * nextZoom * (doubleWidth ? 2 : 1)
    const nextCellH = CELL_H_BASE * nextZoom

    onZoomChange(nextZoom)
    requestAnimationFrame(() => {
      const nextCanvas = canvasRef.current
      const nextScroller = scrollRef.current
      if (!nextCanvas || !nextScroller) return
      const nextRect = nextCanvas.getBoundingClientRect()
      nextScroller.scrollLeft += nextRect.left + logicalX * nextCellW - pointerX
      nextScroller.scrollTop += nextRect.top + logicalY * nextCellH - pointerY
    })
  }, [zoom, onZoomChange, cellW, cellH, videoMode, doubleWidth])

  const paintCursor = useMemo(() => {
    if (activeTool !== 'pencil' && activeTool !== 'eraser') return null
    const w = Math.min(cellW, 128)
    const h = Math.min(cellH, 128)
    const canvas = document.createElement('canvas')
    canvas.width  = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    const cursorInk = activeTool === 'eraser' ? bgInk : activeInk
    ctx.fillStyle = CPC_COLORS[palette[cursorInk] ?? 0]
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'
    ctx.lineWidth = 1
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1)
    const hx = Math.floor(w / 2)
    const hy = Math.floor(h / 2)
    return `url(${canvas.toDataURL()}) ${hx} ${hy}, crosshair`
  }, [activeTool, activeInk, bgInk, palette, cellW, cellH])

  const temporaryPicker = altPressed && (activeTool === 'pencil' || activeTool === 'fill' || activeTool === 'eraser')
  const cursor = isPasting                    ? 'copy'
    : movePos !== null                        ? 'grabbing'
    : temporaryPicker                         ? 'crosshair'
    : activeTool === 'move'                   ? (selection ? 'grab' : 'default')
    : activeTool === 'select'                 ? 'crosshair'
    : activeTool === 'picker'                 ? 'crosshair'
    : activeTool === 'fill'                   ? 'crosshair'
    : ['line', 'rectangle', 'ellipse'].includes(activeTool) ? 'crosshair'
    : activeTool === 'text'                   ? 'text'
    : paintCursor                             ?? 'default'

  return (
    <div ref={scrollRef} style={{ overflow: 'auto', flex: 1, padding: '16px', background: 'var(--bg)' }} onWheel={handleWheel}>
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <canvas
          ref={canvasRef}
          style={{ display: 'block', imageRendering: 'pixelated', cursor }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseEnter={e => setAltPressed(e.altKey)}
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

function FrameThumb({ pixels, width, height, videoMode, palette, active, index, onClick, onDelete, canDelete, onDragStart, onDragOver, onDrop, onDragEnd, dragging }) {
  const canvasRef = useRef(null)
  const [hovered, setHovered] = useState(false)

  // Fit the complete CPC-rendered frame inside the timeline. The logical
  // sprite height alone is not enough here: each CPC pixel is 8 px tall.
  const scale  = Math.min(1, 84 / (width * CELL_W_BASE[videoMode]), 52 / (height * CELL_H_BASE))
  const cellW  = CELL_W_BASE[videoMode] * scale
  const cellH  = CELL_H_BASE * scale

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    renderSpriteToCanvas(canvas, pixels, width, height, videoMode, palette, cellW, cellH)
  }, [pixels, width, height, videoMode, palette, cellW, cellH])

  return (
    <div
      className={`sprite-frame-thumb${active ? ' active' : ''}${dragging ? ' dragging' : ''}`}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
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
      <span className="sprite-frame-number">{index + 1}</span>
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

  const scale = Math.min(1, 172 / (width * CELL_W_BASE[videoMode]), 112 / (height * CELL_H_BASE))
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
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: 'var(--text-dim)', fontFamily: "'Press Start 2P', monospace", fontSize: '6px', letterSpacing: '1px' }}>
        <span>ANIMATION</span>
        <span>{fps} FPS</span>
      </div>
      <div style={{ minHeight: '64px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px', background: 'var(--bg)', border: '1px solid var(--border)' }}>
        <canvas
          ref={canvasRef}
          style={{ display: 'block', maxWidth: '100%', imageRendering: 'pixelated' }}
        />
      </div>
    </div>
  )
}

// ── ExportModal ───────────────────────────────────────────────────────────────

function ExportModal({ sprite, onClose }) {
  const [format,      setFormat]      = useState('hex')
  const [interleaved, setInterleaved] = useState(false)
  const [copied,      setCopied]      = useState(false)

  const code = sprite ? generateExport(sprite, { format, interleaved }) : ''

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

// ── Sprite sheet import ──────────────────────────────────────────────────────

function SpriteSheetImportModal({ file, sprite, onConfirm, onCancel }) {
  const [direction, setDirection] = useState('horizontal')
  const [spacing, setSpacing] = useState(0)
  const [image, setImage] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { setImage(img); URL.revokeObjectURL(url) }
    img.onerror = () => { setError('Could not load the sprite sheet.'); URL.revokeObjectURL(url) }
    img.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  const step = direction === 'horizontal' ? sprite.width + spacing : sprite.height + spacing
  const sheetSize = image ? (direction === 'horizontal' ? image.naturalWidth : image.naturalHeight) : 0
  const crossSize = image ? (direction === 'horizontal' ? image.naturalHeight : image.naturalWidth) : 0
  const requiredCrossSize = direction === 'horizontal' ? sprite.height : sprite.width
  const frameCount = image && step > 0 && crossSize >= requiredCrossSize
    ? Math.floor((sheetSize + spacing) / step)
    : 0
  const usedSize = frameCount > 0 ? frameCount * step - spacing : 0
  const hasRemainder = image && usedSize !== sheetSize

  const importFrames = () => {
    if (!image || frameCount < 1) return
    const frames = []
    const canvas = document.createElement('canvas')
    canvas.width = sprite.width
    canvas.height = sprite.height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.imageSmoothingEnabled = false

    for (let fi = 0; fi < frameCount; fi++) {
      const sx = direction === 'horizontal' ? fi * step : 0
      const sy = direction === 'vertical' ? fi * step : 0
      ctx.clearRect(0, 0, sprite.width, sprite.height)
      ctx.drawImage(image, sx, sy, sprite.width, sprite.height, 0, 0, sprite.width, sprite.height)
      const data = ctx.getImageData(0, 0, sprite.width, sprite.height).data
      const pixels = Array(sprite.width * sprite.height)
      for (let i = 0; i < pixels.length; i++) {
        const a = data[i * 4 + 3]
        pixels[i] = a < 128 ? 0 : nearestPaletteInk(data[i * 4], data[i * 4 + 1], data[i * 4 + 2], sprite.palette)
      }
      frames.push({ pixels })
    }
    onConfirm(frames)
  }

  const optionStyle = active => ({
    flex: 1, padding: '10px', cursor: 'pointer', borderRadius: '6px',
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
    background: active ? 'var(--green-glow)' : 'transparent',
    color: active ? 'var(--accent)' : 'var(--text-dim)',
  })

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(0,0,0,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="pixel-panel fade-up" style={{ width: '100%', maxWidth: '460px', padding: '30px' }}>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '9px', color: 'var(--accent)', letterSpacing: '1px', marginBottom: '22px' }}>IMPORT SPRITESHEET</div>

        <div style={{ color: 'var(--text-dim)', fontSize: '12px', lineHeight: 1.6, marginBottom: '16px' }}>
          Each frame is <strong style={{ color: 'var(--text)' }}>{sprite.width} × {sprite.height}</strong> pixels. Frames are read from left to right or from top to bottom.
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <button style={optionStyle(direction === 'horizontal')} onClick={() => setDirection('horizontal')}>Horizontal →</button>
          <button style={optionStyle(direction === 'vertical')} onClick={() => setDirection('vertical')}>Vertical ↓</button>
        </div>

        <label className="pixel-label">Spacing between frames</label>
        <input className="pixel-input" type="number" min="0" max="128" value={spacing} onChange={e => setSpacing(Math.max(0, Math.min(128, Number(e.target.value) || 0)))} style={{ width: '100%', marginBottom: '16px' }} />

        {image && (
          <div style={{ padding: '12px', background: 'var(--bg)', border: '1px solid var(--border)', color: frameCount ? 'var(--text)' : 'var(--red)', fontSize: '12px', lineHeight: 1.6 }}>
            Sheet: {image.naturalWidth} × {image.naturalHeight}px<br />
            Detected: <strong>{frameCount} frame{frameCount === 1 ? '' : 's'}</strong>
            {hasRemainder && frameCount > 0 && <><br /><span style={{ color: 'var(--amber)' }}>Unused pixels remain at the end of the sheet.</span></>}
          </div>
        )}
        {error && <div style={{ color: 'var(--red)', marginTop: '12px' }}>{error}</div>}

        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          <button className="btn-pixel" disabled={frameCount < 1} onClick={importFrames} style={{ flex: 1 }}>IMPORT {frameCount || ''} FRAME{frameCount === 1 ? '' : 'S'}</button>
          <button className="btn-ghost" onClick={onCancel} style={{ flex: 1 }}>CANCEL</button>
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
                  <div key={i} onClick={() => setBgInk(i)} title={`Ink ${i}`} style={{
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

function SettingsModal({ doubleWidth, showGrid, gridCellW, gridCellH, gridColor, gridOpacity, guidesX, guidesY, width, height, onApply, onCancel }) {
  const [dblWidth,  setDblWidth]  = useState(doubleWidth)
  const [gridVisible, setGridVisible] = useState(showGrid)
  const [cellW, setCellW] = useState(String(gridCellW))
  const [cellH, setCellH] = useState(String(gridCellH))
  const [color, setColor] = useState(gridColor)
  const [opacity, setOpacity] = useState(gridOpacity)
  const [verticalGuides, setVerticalGuides] = useState(guidesX.join(', '))
  const [horizontalGuides, setHorizontalGuides] = useState(guidesY.join(', '))

  const parseGuides = (value, limit) => [...new Set(value.split(',').map(v => parseInt(v.trim())).filter(v => Number.isInteger(v) && v > 0 && v < limit))].sort((a, b) => a - b)
  const apply = () => onApply({
    doubleWidth: dblWidth,
    showGrid: gridVisible,
    gridCellW: Math.max(1, parseInt(cellW) || 1),
    gridCellH: Math.max(1, parseInt(cellH) || 1),
    gridColor: color,
    gridOpacity: opacity,
    guidesX: parseGuides(verticalGuides, width),
    guidesY: parseGuides(horizontalGuides, height),
  })

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
      <div className="pixel-panel fade-up" style={{ width: '100%', maxWidth: '440px', maxHeight: '90vh', overflowY: 'auto', padding: '32px', position: 'relative' }}>

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
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '6px', color: 'var(--amber)', letterSpacing: '2px', marginBottom: '10px' }}>GRID</div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-dim)', fontSize: '12px', marginBottom: '10px', cursor: 'pointer' }}><input type="checkbox" checked={gridVisible} onChange={e => setGridVisible(e.target.checked)} /> Show grid [G]</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label className="pixel-label">WIDTH</label>
              <input className="pixel-input" type="number" min={1} value={cellW}
                onChange={e => setCellW(e.target.value)} onBlur={() => setCellW(String(Math.max(1, parseInt(cellW) || 1)))}
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label className="pixel-label">HEIGHT</label>
              <input className="pixel-input" type="number" min={1} value={cellH}
                onChange={e => setCellH(e.target.value)} onBlur={() => setCellH(String(Math.max(1, parseInt(cellH) || 1)))}
                style={{ width: '100%' }}
              />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '10px', alignItems: 'end', marginTop: '10px' }}>
            <div><label className="pixel-label">COLOR</label><input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ width: '100%', height: '34px', border: '1px solid var(--border)', background: 'var(--bg)' }} /></div>
            <div><label className="pixel-label">OPACITY {Math.round(opacity * 100)}%</label><input type="range" min="0.1" max="1" step="0.05" value={opacity} onChange={e => setOpacity(Number(e.target.value))} style={{ width: '100%' }} /></div>
          </div>
        </div>

        <div style={{ marginBottom: '26px' }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '6px', color: 'var(--amber)', letterSpacing: '2px', marginBottom: '10px' }}>GUIDES</div>
          <label className="pixel-label">VERTICAL X COORDINATES</label>
          <input className="pixel-input" value={verticalGuides} placeholder="e.g. 8, 16, 24" onChange={e => setVerticalGuides(e.target.value)} style={{ width: '100%', marginBottom: '10px' }} />
          <label className="pixel-label">HORIZONTAL Y COORDINATES</label>
          <input className="pixel-input" value={horizontalGuides} placeholder="e.g. 8, 16" onChange={e => setHorizontalGuides(e.target.value)} style={{ width: '100%' }} />
          <div style={{ color: 'var(--text-dim)', fontSize: '10px', marginTop: '7px' }}>Comma-separated pixel coordinates. Invalid or out-of-range guides are ignored.</div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-pixel" onClick={apply} style={{ flex: 1 }}>APPLY</button>
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
      className={`sprite-tool-btn${active ? ' active' : ''}`}
      title={title}
      aria-label={name || title}
      onClick={onClick}
      disabled={disabled}
    >
      <span>{label}</span>
    </button>
  )
}

function FillBucketIcon() {
  return (
    <svg className="sprite-fill-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4.2 13.1 12 5.3l7.8 7.8-7.8 7.8z" />
      <path d="m8.2 9.1-2-2" />
      <path d="M3 20.5c0-1.5 2-3.7 2-3.7s2 2.2 2 3.7a2 2 0 0 1-4 0Z" />
      <path d="M5.7 14.6h12.6" />
    </svg>
  )
}

function ScaleSelectionModal({ selection, onApply, onCancel }) {
  const [widthValue, setWidthValue] = useState(String(selection.w))
  const [heightValue, setHeightValue] = useState(String(selection.h))
  const [keepRatio, setKeepRatio] = useState(true)
  const width = Math.max(1, Math.round(Number(widthValue) || 1))
  const height = Math.max(1, Math.round(Number(heightValue) || 1))

  const updateWidth = value => {
    setWidthValue(value)
    if (keepRatio && value !== '') setHeightValue(String(Math.max(1, Math.round(Number(value) * selection.h / selection.w))))
  }
  const updateHeight = value => {
    setHeightValue(value)
    if (keepRatio && value !== '') setWidthValue(String(Math.max(1, Math.round(Number(value) * selection.w / selection.h))))
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 150, background: 'rgba(0,0,0,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="pixel-panel fade-up" style={{ width: '100%', maxWidth: '360px', padding: '30px' }}>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '9px', color: 'var(--accent)', marginBottom: '22px' }}>SCALE SELECTION</div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ flex: 1 }}><label className="pixel-label">Width</label><input className="pixel-input" type="number" min="1" value={widthValue} onChange={e => updateWidth(e.target.value)} onBlur={() => setWidthValue(String(width))} style={{ width: '100%' }} /></div>
          <div style={{ flex: 1 }}><label className="pixel-label">Height</label><input className="pixel-input" type="number" min="1" value={heightValue} onChange={e => updateHeight(e.target.value)} onBlur={() => setHeightValue(String(height))} style={{ width: '100%' }} /></div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '9px', marginTop: '16px', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '12px' }}>
          <input type="checkbox" checked={keepRatio} onChange={e => setKeepRatio(e.target.checked)} /> Keep aspect ratio
        </label>
        <div style={{ marginTop: '12px', color: 'var(--text-dim)', fontSize: '11px', lineHeight: 1.5 }}>Nearest-neighbour scaling preserves hard pixel edges.</div>
        <div style={{ display: 'flex', gap: '10px', marginTop: '22px' }}>
          <button className="btn-pixel" onClick={() => onApply(width, height)} style={{ flex: 1 }}>APPLY</button>
          <button className="btn-ghost" onClick={onCancel} style={{ flex: 1 }}>CANCEL</button>
        </div>
      </div>
    </div>
  )
}

// ── SpriteEditor ──────────────────────────────────────────────────────────────

export default function SpriteEditor({ userId, projectId, spriteId, setSaveStatus, onDeleted }) {
  const [sprite,       setSprite]       = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [currentFrame, setCurrentFrame] = useState(0)
  const [activeTool,   setActiveTool]   = useState('pencil')
  const [fillMode,     setFillMode]     = useState('contiguous')
  const [shapeFilled,  setShapeFilled]  = useState(false)
  const [activeInk,    setActiveInk]    = useState(1)
  const [bgInk,        setBgInk]        = useState(0)
  const [replaceInkTarget, setReplaceInkTarget] = useState(0)
  const [doubleWidth,  setDoubleWidth]  = useState(false)
  const [zoom,         setZoom]         = useState(2)
  const [playFps,      setPlayFps]      = useState(6)
  const [isPlaying,    setIsPlaying]    = useState(false)
  const [loopPlayback, setLoopPlayback] = useState(true)
  const [onionPrevious, setOnionPrevious] = useState(true)
  const [onionNext,    setOnionNext]    = useState(false)
  const [draggedFrame, setDraggedFrame] = useState(null)
  const [showExport,      setShowExport]      = useState(false)
  const [showProperties,  setShowProperties]  = useState(false)
  const [showSettings,    setShowSettings]    = useState(false)
  const [showScaleSelection, setShowScaleSelection] = useState(false)
  const [showScaleClipboard, setShowScaleClipboard] = useState(false)
  const [spriteSheetFile, setSpriteSheetFile] = useState(null)
  const [gridCellW,    setGridCellW]    = useState(8)
  const [gridCellH,    setGridCellH]    = useState(8)
  const [showGrid,     setShowGrid]     = useState(true)
  const [gridColor,    setGridColor]    = useState('#ffaa00')
  const [gridOpacity,  setGridOpacity]  = useState(0.55)
  const [guidesX,      setGuidesX]      = useState([])
  const [guidesY,      setGuidesY]      = useState([])
  const [selection,    setSelection]    = useState(null)
  const [clipboard,    setClipboard]    = useState(null)
  const [isPasting,    setIsPasting]    = useState(false)
  const [cursorPos,    setCursorPos]    = useState(null)
  const [textMode,     setTextMode]     = useState(null)
  const [textBuffer,   setTextBuffer]   = useState('')
  const [textCursor,   setTextCursor]   = useState({ x: 0, y: 0 })
  const [fontReady,    setFontReady]    = useState(false)
  const [toolbarMenu,  setToolbarMenu]  = useState(null)
  const textInputRef   = useRef(null)
  const toolbarRef     = useRef(null)
  const colorsRef      = useRef({ activeInk, bgInk })

  useEffect(() => { colorsRef.current = { activeInk, bgInk } }, [activeInk, bgInk])

  useEffect(() => {
    const closeMenu = (e) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target)) setToolbarMenu(null)
    }
    document.addEventListener('mousedown', closeMenu)
    return () => document.removeEventListener('mousedown', closeMenu)
  }, [])

  const handleTextClick = useCallback((x, y) => {
    setTextMode({ x, y })
    setTextBuffer('')
    setTextCursor({ x, y })
  }, [])

  const saveTimer   = useRef(null)
  const spriteRef   = useRef(null)
  const historyRef  = useRef([])
  const redoRef     = useRef([])
  const [canUndo,  setCanUndo]  = useState(false)
  const [canRedo,  setCanRedo]  = useState(false)

  // Keep ref in sync for autosave
  useEffect(() => { spriteRef.current = sprite }, [sprite])

  useEffect(() => {
    if (!isPlaying || !sprite?.frames?.length) return
    const timer = setInterval(() => {
      setCurrentFrame(frame => {
        const last = sprite.frames.length - 1
        if (frame >= last) {
          if (loopPlayback) return 0
          setIsPlaying(false)
          return last
        }
        return frame + 1
      })
    }, Math.max(1, Math.round(1000 / playFps)))
    return () => clearInterval(timer)
  }, [isPlaying, loopPlayback, playFps, sprite?.frames?.length])

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
        redoRef.current = []
        setCanUndo(false)
        setCanRedo(false)
      })
      .catch(err => {
        console.error('Failed to load sprite:', err)
        setLoading(false)
      })
  }, [spriteId, userId, projectId])

  // Load font
  useEffect(() => {
    loadFont().then(() => setFontReady(true)).catch(err => {
      console.error('Failed to load font:', err)
    })
  }, [])

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
    redoRef.current = []
    setCanUndo(true)
    setCanRedo(false)
  }, [])

  const handleUndo = useCallback(() => {
    const prev = historyRef.current.pop()
    if (!prev) return
    redoRef.current.push(spriteRef.current)
    if (redoRef.current.length > 50) redoRef.current.shift()
    setSprite(prev)
    scheduleAutoSave(prev)
    setCanUndo(historyRef.current.length > 0)
    setCanRedo(true)
  }, [scheduleAutoSave])

  const handleRedo = useCallback(() => {
    const next = redoRef.current.pop()
    if (!next) return
    historyRef.current.push(spriteRef.current)
    if (historyRef.current.length > 50) historyRef.current.shift()
    setSprite(next)
    scheduleAutoSave(next)
    setCanUndo(true)
    setCanRedo(redoRef.current.length > 0)
  }, [scheduleAutoSave])

  const handleUndoRef = useRef(null)
  const handleRedoRef = useRef(null)
  const handleEraseSelectionRef = useRef(null)
  useEffect(() => { handleUndoRef.current = handleUndo }, [handleUndo])
  useEffect(() => { handleRedoRef.current = handleRedo }, [handleRedo])

  useEffect(() => {
    if (textMode && textInputRef.current) {
      textInputRef.current.focus()
    }
  }, [textMode])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); handleRedoRef.current?.(); return }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); handleRedoRef.current?.(); return }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); handleUndoRef.current?.(); return }
      const key = e.key.toLowerCase()
      if ((e.ctrlKey || e.metaKey) && key === 'c') { e.preventDefault(); handleCopyRef.current?.(); return }
      if ((e.ctrlKey || e.metaKey) && key === 'x') { e.preventDefault(); handleCutRef.current?.(); return }
      if ((e.ctrlKey || e.metaKey) && key === 'v') { e.preventDefault(); setIsPasting(true); setActiveTool('select'); return }
      if (e.key === 'Delete') { e.preventDefault(); handleEraseSelectionRef.current?.(); return }

      if (e.key === 'd' || e.key === 'D') { setDoubleWidth(v => !v); return }
      if (e.key === 'g' || e.key === 'G') { setShowGrid(v => !v); return }
      if (e.key === 'x' || e.key === 'X') {
        const { activeInk: foreground, bgInk: background } = colorsRef.current
        setActiveInk(background)
        setBgInk(foreground)
        return
      }
      if (e.key === 'b' || e.key === 'B') { setActiveTool('pencil'); setIsPasting(false); return }
      if (e.key === 'e' || e.key === 'E') { setActiveTool('eraser'); setIsPasting(false); return }
      if (e.key === 'f' || e.key === 'F') { setActiveTool('fill');   setIsPasting(false); return }
      if (e.key === 'l' || e.key === 'L') { setActiveTool('line'); setIsPasting(false); return }
      if (e.key === 'r' || e.key === 'R') { setActiveTool('rectangle'); setIsPasting(false); return }
      if (e.key === 'o' || e.key === 'O') { setActiveTool('ellipse'); setIsPasting(false); return }
      if (e.key === 'm' || e.key === 'M') { setActiveTool('select'); setIsPasting(false); return }
      if (e.key === 'v' || e.key === 'V') { setActiveTool('move');   setIsPasting(false); return }
      if (e.key === 't' || e.key === 'T') { setActiveTool('text');   setIsPasting(false); return }
      if (e.key === 'Escape') {
        if (textMode) {
          setTextMode(null)
          setTextBuffer('')
          return
        }
        setSelection(null)
        setIsPasting(false)
        setActiveTool(t => t === 'select' ? 'pencil' : t)
        return
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Paint handler
  const handlePaint = useCallback((cx, cy, ink, isPick, pickBackground = false) => {
    if (isPick) {
      if (pickBackground) setBgInk(ink)
      else setActiveInk(ink)
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
          if (x >= 0 && x < prev.width && y >= 0 && y < prev.height && cellInSelection(x, y, selection))
            pixels[y * prev.width + x] = ink
        }
        return { ...f, pixels }
      })
      return { ...prev, frames }
    })
  }, [currentFrame, selection, updateSprite])

  // Flip H
  const flipH = useCallback(() => {
    pushHistory()
    updateSprite(prev => {
      const { width, height } = prev
      const frames = prev.frames.map((f, fi) => {
        if (fi !== currentFrame) return f
        const pixels = [...f.pixels]
        const area = selection ?? { x: 0, y: 0, w: width, h: height }
        for (let y = area.y; y < area.y + area.h; y++) {
          for (let offset = 0; offset < area.w; offset++) {
            const x = area.x + offset
            const sourceX = area.x + area.w - 1 - offset
            pixels[y * width + x] = f.pixels[y * width + sourceX]
          }
        }
        return { ...f, pixels }
      })
      return { ...prev, frames }
    })
  }, [currentFrame, selection, updateSprite, pushHistory])

  // Flip V
  const flipV = useCallback(() => {
    pushHistory()
    updateSprite(prev => {
      const { width, height } = prev
      const frames = prev.frames.map((f, fi) => {
        if (fi !== currentFrame) return f
        const pixels = [...f.pixels]
        const area = selection ?? { x: 0, y: 0, w: width, h: height }
        for (let offset = 0; offset < area.h; offset++) {
          const y = area.y + offset
          const sourceY = area.y + area.h - 1 - offset
          for (let x = area.x; x < area.x + area.w; x++) {
            pixels[y * width + x] = f.pixels[sourceY * width + x]
          }
        }
        return { ...f, pixels }
      })
      return { ...prev, frames }
    })
  }, [currentFrame, selection, updateSprite, pushHistory])

  const rotateSelection = useCallback((clockwise) => {
    if (!selection || !sprite) return
    const { x, y, w, h } = selection
    const newW = h, newH = w
    if (x + newW > sprite.width || y + newH > sprite.height) return
    pushHistory()
    updateSprite(prev => {
      const frames = prev.frames.map((frame, fi) => {
        if (fi !== currentFrame) return frame
        const source = []
        for (let sy = 0; sy < h; sy++)
          for (let sx = 0; sx < w; sx++) source.push(frame.pixels[(y + sy) * prev.width + x + sx] ?? 0)
        const rotated = Array(newW * newH).fill(0)
        for (let sy = 0; sy < h; sy++) {
          for (let sx = 0; sx < w; sx++) {
            const dx = clockwise ? h - 1 - sy : sy
            const dy = clockwise ? sx : w - 1 - sx
            rotated[dy * newW + dx] = source[sy * w + sx]
          }
        }
        const pixels = [...frame.pixels]
        for (let py = y; py < y + h; py++) for (let px = x; px < x + w; px++) pixels[py * prev.width + px] = bgInk
        for (let dy = 0; dy < newH; dy++) for (let dx = 0; dx < newW; dx++) pixels[(y + dy) * prev.width + x + dx] = rotated[dy * newW + dx]
        return { ...frame, pixels }
      })
      return { ...prev, frames }
    })
    setSelection({ x, y, w: newW, h: newH })
  }, [selection, sprite, bgInk, currentFrame, updateSprite, pushHistory])

  const nudgeSelection = useCallback((dx, dy) => {
    if (!selection || !sprite) return
    const { x, y, w, h } = selection
    const nx = x + dx, ny = y + dy
    if (nx < 0 || ny < 0 || nx + w > sprite.width || ny + h > sprite.height) return
    pushHistory()
    updateSprite(prev => {
      const frames = prev.frames.map((frame, fi) => {
        if (fi !== currentFrame) return frame
        const source = []
        for (let sy = 0; sy < h; sy++) for (let sx = 0; sx < w; sx++) source.push(frame.pixels[(y + sy) * prev.width + x + sx] ?? 0)
        const pixels = [...frame.pixels]
        for (let py = y; py < y + h; py++) for (let px = x; px < x + w; px++) pixels[py * prev.width + px] = bgInk
        for (let sy = 0; sy < h; sy++) for (let sx = 0; sx < w; sx++) pixels[(ny + sy) * prev.width + nx + sx] = source[sy * w + sx]
        return { ...frame, pixels }
      })
      return { ...prev, frames }
    })
    setSelection({ x: nx, y: ny, w, h })
  }, [selection, sprite, bgInk, currentFrame, updateSprite, pushHistory])

  const scaleSelection = useCallback((newW, newH) => {
    if (!selection || !sprite) return
    const { x, y, w, h } = selection
    const targetW = Math.min(newW, sprite.width - x)
    const targetH = Math.min(newH, sprite.height - y)
    pushHistory()
    updateSprite(prev => {
      const frames = prev.frames.map((frame, fi) => {
        if (fi !== currentFrame) return frame
        const source = []
        for (let sy = 0; sy < h; sy++) for (let sx = 0; sx < w; sx++) source.push(frame.pixels[(y + sy) * prev.width + x + sx] ?? 0)
        const pixels = [...frame.pixels]
        for (let py = y; py < y + h; py++) for (let px = x; px < x + w; px++) pixels[py * prev.width + px] = bgInk
        for (let dy = 0; dy < targetH; dy++) {
          for (let dx = 0; dx < targetW; dx++) {
            const sx = Math.min(w - 1, Math.floor(dx * w / targetW))
            const sy = Math.min(h - 1, Math.floor(dy * h / targetH))
            pixels[(y + dy) * prev.width + x + dx] = source[sy * w + sx]
          }
        }
        return { ...frame, pixels }
      })
      return { ...prev, frames }
    })
    setSelection({ x, y, w: targetW, h: targetH })
    setShowScaleSelection(false)
  }, [selection, sprite, bgInk, currentFrame, updateSprite, pushHistory])

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

  const addBlankFrame = useCallback(() => {
    pushHistory()
    updateSprite(prev => {
      const blank = { pixels: Array(prev.width * prev.height).fill(0) }
      const frames = [
        ...prev.frames.slice(0, currentFrame + 1),
        blank,
        ...prev.frames.slice(currentFrame + 1),
      ]
      return { ...prev, frames }
    })
    setCurrentFrame(fi => fi + 1)
  }, [currentFrame, updateSprite, pushHistory])

  const reorderFrame = useCallback((from, to) => {
    if (from == null || from === to) return
    pushHistory()
    updateSprite(prev => {
      const frames = [...prev.frames]
      const [moved] = frames.splice(from, 1)
      frames.splice(to, 0, moved)
      return { ...prev, frames }
    })
    setCurrentFrame(to)
    setDraggedFrame(null)
  }, [updateSprite, pushHistory])

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

  const swapInkSlots = useCallback((first, second) => {
    if (!sprite || first === second || first < 0 || second < 0 || first >= sprite.palette.length || second >= sprite.palette.length) return
    pushHistory()
    updateSprite(prev => {
      const palette = [...prev.palette]
      ;[palette[first], palette[second]] = [palette[second], palette[first]]
      const frames = prev.frames.map(frame => ({
        ...frame,
        pixels: frame.pixels.map(ink => ink === first ? second : ink === second ? first : ink),
      }))
      return { ...prev, palette, frames }
    })
    setActiveInk(ink => ink === first ? second : ink === second ? first : ink)
    setBgInk(ink => ink === first ? second : ink === second ? first : ink)
  }, [sprite, updateSprite, pushHistory])

  const replaceInk = useCallback((source, target, allFrames) => {
    if (!sprite || source === target) return
    pushHistory()
    updateSprite(prev => ({
      ...prev,
      frames: prev.frames.map((frame, fi) => (
        allFrames || fi === currentFrame
          ? { ...frame, pixels: frame.pixels.map(ink => ink === source ? target : ink) }
          : frame
      )),
    }))
  }, [sprite, currentFrame, updateSprite, pushHistory])

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
    pushHistory()
    const { x, y, w, h } = selection
    updateSprite(prev => {
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
  }, [selection, sprite, bgInk, currentFrame, updateSprite, pushHistory])

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
              pixels[ny * prev.width + nx] = ink
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

  const transformClipboard = useCallback((operation) => {
    setClipboard(block => transformPixelBlock(block, operation))
    setIsPasting(true)
  }, [])

  const scaleClipboard = useCallback((newW, newH) => {
    setClipboard(block => scalePixelBlock(block, newW, newH))
    setShowScaleClipboard(false)
    setIsPasting(true)
  }, [])

  // ── Fill ────────────────────────────────────────────────────────────────────

  const handleFill = useCallback((cx, cy, ink) => {
    pushHistory()
    const fillInk = ink ?? activeInk
    updateSprite(prev => {
      const frames = prev.frames.map((f, fi) => {
        if (fi !== currentFrame) return f
        const pixels = fillPixels(f.pixels, cx, cy, prev.width, prev.height, fillInk, selection, fillMode)
        return { ...f, pixels }
      })
      return { ...prev, frames }
    })
  }, [currentFrame, activeInk, selection, fillMode, updateSprite, pushHistory])

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
              pixels[py * prev.width + px] = bgInk
        return { ...f, pixels }
      })
      return { ...prev, frames }
    })
  }, [selection, bgInk, currentFrame, updateSprite, pushHistory])

  useEffect(() => { handleEraseSelectionRef.current = handleEraseSelection }, [handleEraseSelection])

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
        ctx.fillStyle = CPC_COLORS[palette[ink] ?? 0]
        ctx.fillRect(px, py, 1, 1)
      }
    }
    const link = document.createElement('a')
    link.download = `${name || 'sprite'}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }, [sprite, currentFrame])

  const exportSpriteSheet = useCallback((direction) => {
    if (!sprite?.frames?.length) return
    const { width, height, palette, frames, name } = sprite
    const horizontal = direction === 'horizontal'
    const canvas = document.createElement('canvas')
    canvas.width = horizontal ? width * frames.length : width
    canvas.height = horizontal ? height : height * frames.length
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    frames.forEach((frame, fi) => {
      const offsetX = horizontal ? fi * width : 0
      const offsetY = horizontal ? 0 : fi * height
      for (let py = 0; py < height; py++) {
        for (let px = 0; px < width; px++) {
          const ink = frame.pixels[py * width + px]
          ctx.fillStyle = CPC_COLORS[palette[ink] ?? 0]
          ctx.fillRect(offsetX + px, offsetY + py, 1, 1)
        }
      }
    })

    const link = document.createElement('a')
    link.download = `${name || 'sprite'}-spritesheet-${horizontal ? 'horizontal' : 'vertical'}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }, [sprite])

  // ── PNG import ──────────────────────────────────────────────────────────────

  const importPngRef = useRef(null)
  const importSheetRef = useRef(null)

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

  const importSpriteSheetFrames = useCallback((importedFrames) => {
    if (!importedFrames.length) return
    pushHistory()
    updateSprite(prev => ({ ...prev, frames: importedFrames }))
    setCurrentFrame(0)
    setIsPlaying(false)
    setSelection(null)
    setSpriteSheetFile(null)
  }, [pushHistory, updateSprite])

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
  const currentInkUsage = Array(inkCount).fill(0)
  const totalInkUsage = Array(inkCount).fill(0)
  for (const ink of currentPixels) if (ink >= 0 && ink < inkCount) currentInkUsage[ink]++
  for (const frame of frames) for (const ink of frame.pixels) if (ink >= 0 && ink < inkCount) totalInkUsage[ink]++
  const onionLayers = []
  if (!isPlaying) {
    if (onionPrevious && currentFrame > 0) onionLayers.push({ pixels: frames[currentFrame - 1]?.pixels, color: 'rgba(246,146,26,0.28)' })
    if (onionNext && currentFrame < frames.length - 1) onionLayers.push({ pixels: frames[currentFrame + 1]?.pixels, color: 'rgba(33,82,255,0.24)' })
  }

  const dividerStyle = { height: '1px', background: 'var(--border)', margin: '2px 0', gridColumn: '1 / -1' }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>

      {/* COMPACT HORIZONTAL TOOLBAR */}
      <div ref={toolbarRef} className="sprite-toolbar">
        <div className="sprite-tool-group" aria-label="Drawing tools">
          <ToolBtn label="✏" name="PENCIL" title="Pencil [B] — Alt = pick" active={activeTool === 'pencil'} onClick={() => { setActiveTool('pencil'); setIsPasting(false) }} />
          <ToolBtn label="⌫" name="ERASE" title="Eraser [E] — Alt = pick" active={activeTool === 'eraser'} onClick={() => { setActiveTool('eraser'); setIsPasting(false) }} />
          <ToolBtn label="⊕" name="PICK" title="Color Picker" active={activeTool === 'picker'} onClick={() => { setActiveTool('picker'); setIsPasting(false) }} />
          <ToolBtn label={<FillBucketIcon />} name="FILL" title="Fill [F] — Alt = pick" active={activeTool === 'fill'} onClick={() => { setActiveTool('fill'); setIsPasting(false) }} />
          <ToolBtn label="╱" name="LINE" title="Line [L] — right button = erase" active={activeTool === 'line'} onClick={() => { setActiveTool('line'); setIsPasting(false) }} />
          <ToolBtn label="□" name="RECT" title="Rectangle [R] — right button = erase" active={activeTool === 'rectangle'} onClick={() => { setActiveTool('rectangle'); setIsPasting(false) }} />
          <ToolBtn label="○" name="ELLIPSE" title="Ellipse [O] — right button = erase" active={activeTool === 'ellipse'} onClick={() => { setActiveTool('ellipse'); setIsPasting(false) }} />
          <ToolBtn label="T" name="TEXT" title="Text [T]" active={activeTool === 'text'} onClick={() => { setActiveTool('text'); setIsPasting(false) }} />
        </div>

        <div className="sprite-toolbar-separator" />

        <div className="sprite-tool-group" aria-label="Selection tools">
          <ToolBtn label="⬚" name="SELECT" title="Select [M]" active={activeTool === 'select'} onClick={() => { setActiveTool('select'); setIsPasting(false) }} />
          <ToolBtn label="✥" name="MOVE" title="Move selection [V]" active={activeTool === 'move'} disabled={!selection} onClick={() => { setActiveTool('move'); setIsPasting(false) }} />
        </div>

        {clipboard && <ToolBtn label="⎗" name="PASTE" title="Paste [Ctrl+V]" active={isPasting} onClick={() => { setIsPasting(true); setActiveTool('select') }} />}

        <div className="sprite-toolbar-separator" />
        <div className="sprite-tool-group" aria-label="History">
          <ToolBtn label="↩" name="UNDO" title="Undo [Ctrl+Z]" disabled={!canUndo} onClick={handleUndo} />
          <ToolBtn label="↪" name="REDO" title="Redo [Ctrl+Shift+Z]" disabled={!canRedo} onClick={handleRedo} />
        </div>

        <div className="sprite-toolbar-separator" />
        <div className="sprite-zoom-control">
          <button title="Zoom out" disabled={SPRITE_ZOOM_LEVELS.indexOf(zoom) === 0} onClick={() => { const i = SPRITE_ZOOM_LEVELS.indexOf(zoom); if (i > 0) setZoom(SPRITE_ZOOM_LEVELS[i - 1]) }}>−</button>
          <select title="Zoom level" value={zoom} onChange={e => setZoom(Number(e.target.value))}>
            {SPRITE_ZOOM_LEVELS.map(level => <option key={level} value={level}>{level * 100}%</option>)}
          </select>
          <button title="Zoom in" disabled={SPRITE_ZOOM_LEVELS.indexOf(zoom) === SPRITE_ZOOM_LEVELS.length - 1} onClick={() => { const i = SPRITE_ZOOM_LEVELS.indexOf(zoom); if (i < SPRITE_ZOOM_LEVELS.length - 1) setZoom(SPRITE_ZOOM_LEVELS[i + 1]) }}>+</button>
        </div>

        <button className={`sprite-toolbar-toggle${doubleWidth ? ' active' : ''}`} title="Double horizontal pixel width [D]" onClick={() => setDoubleWidth(v => !v)}>2×W</button>
        <button className={`sprite-toolbar-toggle${showGrid ? ' active' : ''}`} title="Show / hide grid [G]" onClick={() => setShowGrid(v => !v)}>#</button>

        <div className="sprite-toolbar-spacer" />

        <div className="sprite-color-compact" title="Foreground / background inks">
          <div className="sprite-bg-chip" style={{ background: CPC_COLORS[palette[bgInk] ?? 0] }} />
          <div className="sprite-fg-chip" style={{ background: CPC_COLORS[palette[activeInk] ?? 0] }} />
          <button title="Swap foreground / background [X]" onClick={() => { const tmp = activeInk; setActiveInk(bgInk); setBgInk(tmp) }}>⇄</button>
        </div>

        <div className="sprite-toolbar-menu-wrap">
          <button className="sprite-toolbar-menu-btn" onClick={() => setToolbarMenu(m => m === 'io' ? null : 'io')}>Import / Export⌄</button>
          {toolbarMenu === 'io' && (
            <div className="sprite-toolbar-dropdown">
              <button onClick={() => { setToolbarMenu(null); importPngRef.current?.click() }}>Import PNG…</button>
              <button onClick={() => { setToolbarMenu(null); exportPNG() }}>Export current frame PNG</button>
              <div />
              <button onClick={() => { setToolbarMenu(null); importSheetRef.current?.click() }}>Import spritesheet…</button>
              <button onClick={() => { setToolbarMenu(null); exportSpriteSheet('horizontal') }}>Export spritesheet →</button>
              <button onClick={() => { setToolbarMenu(null); exportSpriteSheet('vertical') }}>Export spritesheet ↓</button>
              <div />
              <button onClick={() => { setToolbarMenu(null); importPaletteRef.current?.click() }}>Import palette…</button>
              <button onClick={() => { setToolbarMenu(null); exportPalette() }}>Export palette</button>
              <div />
              <button onClick={() => { setToolbarMenu(null); setShowExport(true) }}>Export CPC data…</button>
            </div>
          )}
        </div>

        <div className="sprite-toolbar-menu-wrap">
          <button className="sprite-toolbar-menu-btn compact" title="More options" onClick={() => setToolbarMenu(m => m === 'more' ? null : 'more')}>•••</button>
          {toolbarMenu === 'more' && (
            <div className="sprite-toolbar-dropdown align-right">
              <button onClick={() => { setToolbarMenu(null); setShowProperties(true) }}>Sprite properties…</button>
              <button onClick={() => { setToolbarMenu(null); setShowSettings(true) }}>View settings…</button>
            </div>
          )}
        </div>

        <input ref={importPngRef} type="file" accept="image/png,image/*" style={{ display: 'none' }} onChange={e => { importPNG(e.target.files?.[0]); e.target.value = '' }} />
        <input ref={importSheetRef} type="file" accept="image/png,image/*" style={{ display: 'none' }} onChange={e => { setSpriteSheetFile(e.target.files?.[0] ?? null); e.target.value = '' }} />
      </div>

      <div className="sprite-fixed-tool-options" aria-label="Tool and selection options">
        <span className="sprite-fixed-tool-title">OPTIONS</span>
        {isPasting && clipboard ? (
          <>
            <span className="sprite-option-context">PASTE {clipboard.w}×{clipboard.h}</span>
            <button onClick={() => transformClipboard('flipH')}>↔ Flip H</button>
            <button onClick={() => transformClipboard('flipV')}>↕ Flip V</button>
            <button onClick={() => transformClipboard('rotateLeft')}>↶ Rotate L</button>
            <button onClick={() => transformClipboard('rotateRight')}>↷ Rotate R</button>
            <button onClick={() => setShowScaleClipboard(true)}>⤢ Scale…</button>
            <button onClick={() => setIsPasting(false)}>Cancel <kbd>Esc</kbd></button>
            <span className="sprite-option-hint">Transform, then click the canvas to place</span>
          </>
        ) : selection ? (
          <>
            <span className="sprite-option-context">SELECTION {selection.w}×{selection.h}</span>
            {activeTool === 'fill' && (
              <label>Fill scope
                <select value={fillMode} onChange={event => setFillMode(event.target.value)}>
                  <option value="contiguous">Contiguous pixels</option>
                  <option value="matching">All matching pixels</option>
                </select>
              </label>
            )}
            {(activeTool === 'rectangle' || activeTool === 'ellipse') && (
              <label className="sprite-option-checkbox">
                <input type="checkbox" checked={shapeFilled} onChange={event => setShapeFilled(event.target.checked)} />
                Fill shape
              </label>
            )}
            <button onClick={handleCopy}>Copy <kbd>Ctrl+C</kbd></button>
            <button onClick={handleCut}>Cut <kbd>Ctrl+X</kbd></button>
            {clipboard && <button onClick={() => { setIsPasting(true); setActiveTool('select') }}>Paste <kbd>Ctrl+V</kbd></button>}
            <button onClick={handleEraseSelection}>Delete <kbd>Del</kbd></button>
            <span className="sprite-option-divider" />
            <button onClick={flipH}>↔ Flip H</button>
            <button onClick={flipV}>↕ Flip V</button>
            <button disabled={selection.x + selection.h > width || selection.y + selection.w > height} onClick={() => rotateSelection(false)}>↶ Rotate L</button>
            <button disabled={selection.x + selection.h > width || selection.y + selection.w > height} onClick={() => rotateSelection(true)}>↷ Rotate R</button>
            <button onClick={() => setShowScaleSelection(true)}>⤢ Scale…</button>
          </>
        ) : activeTool === 'fill' ? (
          <>
            <span className="sprite-option-context">FILL</span>
            <label>Scope
              <select value={fillMode} onChange={event => setFillMode(event.target.value)}>
                <option value="contiguous">Contiguous pixels</option>
                <option value="matching">All matching pixels</option>
              </select>
            </label>
            <span className="sprite-option-hint">Applied to the current frame</span>
          </>
        ) : (activeTool === 'rectangle' || activeTool === 'ellipse') ? (
          <>
            <span className="sprite-option-context">{activeTool.toUpperCase()}</span>
            <label className="sprite-option-checkbox">
              <input type="checkbox" checked={shapeFilled} onChange={event => setShapeFilled(event.target.checked)} />
              Fill with foreground ink
            </label>
          </>
        ) : (
          <span className="sprite-option-hint">{activeTool.toUpperCase()} has no additional options</span>
        )}
      </div>

      {/* TOP AREA */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

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
          showGrid={showGrid}
          gridColor={gridColor}
          gridOpacity={gridOpacity}
          guidesX={guidesX}
          guidesY={guidesY}
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
          onTextClick={handleTextClick}
          onionLayers={onionLayers}
          shapeFilled={shapeFilled}
          textOverlay={textMode ? { startX: textMode.x, startY: textMode.y, text: textBuffer, ink: activeInk } : null}
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

          {frames.length > 1 && (
            <>
              <div style={dividerStyle} />
              <AnimPreview
                frames={frames}
                width={width}
                height={height}
                videoMode={videoMode}
                palette={palette}
                fps={playFps}
              />
            </>
          )}

          <div style={dividerStyle} />

          {/* Text tool */}
          {activeTool === 'text' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '6px', color: 'var(--text-dim)', letterSpacing: '1px' }}>
                TEXT
              </div>
              {textMode ? (
                <div style={{ fontFamily: "'VT323', monospace", fontSize: '13px', color: 'var(--text)', lineHeight: 1.6 }}>
                  Type to write…<br />
                  <span style={{ color: 'var(--text-dim)' }}>Enter = confirm</span><br />
                  <span style={{ color: 'var(--text-dim)' }}>Esc = cancel</span>
                </div>
              ) : (
                <div style={{ fontFamily: "'VT323', monospace", fontSize: '13px', color: 'var(--text-dim)', lineHeight: 1.6 }}>
                  {fontReady ? 'Click canvas to place text' : 'Loading font…'}
                </div>
              )}
              <input
                ref={textInputRef}
                type="text"
                value={textBuffer}
                onChange={e => setTextBuffer(e.target.value.toUpperCase())}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    if (!textMode || !textBuffer.trim()) return
                    pushHistory()
                    updateSprite(prev => {
                      const frames = prev.frames.map((f, fi) => {
                        if (fi !== currentFrame) return f
                        const newPixels = stampText(f.pixels, prev.width, prev.height, textMode.x, textMode.y, textBuffer, activeInk, 1)
                        return { ...f, pixels: newPixels }
                      })
                      return { ...prev, frames }
                    })
                    setTextMode(null)
                    setTextBuffer('')
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault()
                    setTextMode(null)
                    setTextBuffer('')
                  }
                  if (e.key === 'Backspace') {
                    e.preventDefault()
                    setTextBuffer(prev => prev.slice(0, -1))
                  }
                }}
                style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
                autoFocus={textMode}
              />
            </div>
          )}

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
                const isActive  = inkIdx === activeInk
                const isBg      = inkIdx === bgInk
                const colorHex  = CPC_COLORS[cpcIdx] ?? '#000'
                return (
                  <div
                    key={inkIdx}
                    onClick={() => setActiveInk(inkIdx)}
                    onContextMenu={e => { e.preventDefault(); setBgInk(inkIdx) }}
                    title={`Ink ${inkIdx} = CPC ${cpcIdx} (${colorHex})\nCurrent frame: ${currentInkUsage[inkIdx]} px\nAll frames: ${totalInkUsage[inkIdx]} px\nLeft-click → set as foreground\nRight-click → set as background`}
                    style={{
                      width: '24px', height: '24px', cursor: 'pointer',
                      border: isActive ? '2px solid var(--green)' : isBg ? '2px solid var(--amber)' : '1px solid var(--border)',
                      position: 'relative', flexShrink: 0,
                      background: colorHex,
                      transition: 'border-color 0.1s',
                    }}
                  >
                    <span style={{
                      position: 'absolute', bottom: '1px', right: '2px',
                      fontFamily: "'Press Start 2P', monospace",
                      fontSize: '4px', lineHeight: 1,
                      color: 'rgba(255,255,255,0.75)',
                      textShadow: '0 1px 2px rgba(0,0,0,.9)',
                      pointerEvents: 'none',
                    }}>
                      {inkIdx}
                    </span>
                  </div>
                )
              })}
            </div>
            <div style={{ marginTop: '9px', fontFamily: "'Roboto Mono', monospace", fontSize: '10px', color: 'var(--text-dim)', lineHeight: 1.6 }}>
              INK {activeInk}: <span style={{ color: 'var(--text)' }}>{currentInkUsage[activeInk]} px</span> frame · <span style={{ color: 'var(--text)' }}>{totalInkUsage[activeInk]} px</span> total
            </div>

            <div style={{ display: 'flex', gap: '4px', marginTop: '7px' }}>
              <button className="btn-ghost" title="Move ink slot left without changing the image" disabled={activeInk <= 0} onClick={() => swapInkSlots(activeInk, activeInk - 1)} style={{ flex: 1, padding: '5px 3px', fontSize: '9px' }}>← Slot</button>
              <button className="btn-ghost" title="Move ink slot right without changing the image" disabled={activeInk >= inkCount - 1} onClick={() => swapInkSlots(activeInk, activeInk + 1)} style={{ flex: 1, padding: '5px 3px', fontSize: '9px' }}>Slot →</button>
            </div>

            <div style={{ display: 'flex', gap: '4px', marginTop: '7px' }}>
              <select className="pixel-input" aria-label="Replacement ink" value={replaceInkTarget} onChange={e => setReplaceInkTarget(Number(e.target.value))} style={{ width: '62px', padding: '4px', fontSize: '10px' }}>
                {Array.from({ length: inkCount }, (_, ink) => <option key={ink} value={ink}>INK {ink}</option>)}
              </select>
              <button className="btn-ghost" disabled={replaceInkTarget === activeInk || currentInkUsage[activeInk] === 0} title="Replace selected ink in current frame" onClick={() => replaceInk(activeInk, replaceInkTarget, false)} style={{ flex: 1, padding: '5px 3px', fontSize: '8px' }}>Replace frame</button>
              <button className="btn-ghost" disabled={replaceInkTarget === activeInk || totalInkUsage[activeInk] === 0} title="Replace selected ink in every frame" onClick={() => replaceInk(activeInk, replaceInkTarget, true)} style={{ flex: 1, padding: '5px 3px', fontSize: '8px' }}>All frames</button>
            </div>
          </div>

          <input
            ref={importPaletteRef}
            type="file"
            accept=".pal"
            style={{ display: 'none' }}
            onChange={e => { importPalette(e.target.files?.[0]); e.target.value = '' }}
          />

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

      {/* FRAME TIMELINE */}
      <div className="sprite-timeline">
        <div className="sprite-timeline-controls">
          <div className="sprite-timeline-title">FRAMES <span>{frames.length}</span></div>
          <button className={isPlaying ? 'active' : ''} title={isPlaying ? 'Pause animation' : 'Play animation'} onClick={() => setIsPlaying(v => !v)}>{isPlaying ? 'Ⅱ' : '▶'}</button>
          <button className={loopPlayback ? 'active' : ''} title="Loop playback" onClick={() => setLoopPlayback(v => !v)}>↻</button>
          <label className="sprite-fps-control" title="Frames per second">
            <input type="number" min="1" max="60" value={playFps} onChange={e => setPlayFps(Math.max(1, Math.min(60, Number(e.target.value) || 1)))} /> FPS
          </label>
          <div className="sprite-timeline-divider" />
          <button className={onionPrevious ? 'onion-prev active' : 'onion-prev'} title="Show previous frame onion skin" onClick={() => setOnionPrevious(v => !v)}>−1</button>
          <button className={onionNext ? 'onion-next active' : 'onion-next'} title="Show next frame onion skin" onClick={() => setOnionNext(v => !v)}>+1</button>
        </div>

        <div className="sprite-frame-strip">
          {frames.map((frame, index) => (
            <FrameThumb
              key={index}
              index={index}
              pixels={frame.pixels}
              width={width}
              height={height}
              videoMode={videoMode}
              palette={palette}
              active={index === currentFrame}
              dragging={index === draggedFrame}
              canDelete={frames.length > 1}
              onClick={() => { setCurrentFrame(index); setIsPlaying(false) }}
              onDelete={() => deleteFrame(index)}
              onDragStart={e => { setDraggedFrame(index); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(index)) }}
              onDragEnd={() => setDraggedFrame(null)}
              onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
              onDrop={e => { e.preventDefault(); reorderFrame(Number(e.dataTransfer.getData('text/plain')), index) }}
            />
          ))}
        </div>

        <div className="sprite-timeline-actions">
          <button title="Duplicate current frame" onClick={addFrame}>⧉ Duplicate</button>
          <button title="Add blank frame" onClick={addBlankFrame}>+ Blank</button>
          <button className="danger" title="Delete current frame" disabled={frames.length <= 1} onClick={() => deleteFrame(currentFrame)}>Delete</button>
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

      {spriteSheetFile && (
        <SpriteSheetImportModal
          file={spriteSheetFile}
          sprite={sprite}
          onConfirm={importSpriteSheetFrames}
          onCancel={() => setSpriteSheetFile(null)}
        />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          doubleWidth={doubleWidth}
          showGrid={showGrid}
          gridCellW={gridCellW}
          gridCellH={gridCellH}
          gridColor={gridColor}
          gridOpacity={gridOpacity}
          guidesX={guidesX}
          guidesY={guidesY}
          width={width}
          height={height}
          onApply={({ doubleWidth: dw, showGrid: visible, gridCellW: cw, gridCellH: ch, gridColor: color, gridOpacity: opacity, guidesX: gx, guidesY: gy }) => {
            setDoubleWidth(dw)
            setShowGrid(visible)
            setGridCellW(cw)
            setGridCellH(ch)
            setGridColor(color)
            setGridOpacity(opacity)
            setGuidesX(gx)
            setGuidesY(gy)
            setShowSettings(false)
          }}
          onCancel={() => setShowSettings(false)}
        />
      )}

      {showScaleSelection && selection && (
        <ScaleSelectionModal
          selection={selection}
          onApply={scaleSelection}
          onCancel={() => setShowScaleSelection(false)}
        />
      )}

      {showScaleClipboard && clipboard && (
        <ScaleSelectionModal
          selection={{ x: 0, y: 0, w: clipboard.w, h: clipboard.h }}
          onApply={scaleClipboard}
          onCancel={() => setShowScaleClipboard(false)}
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
