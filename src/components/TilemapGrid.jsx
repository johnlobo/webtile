import { useState, useCallback, useRef, useEffect } from 'react'
import { ZOOM_LEVELS } from './Toolbar'

function floodFill(mapTiles, startCol, startRow, mapW, mapH) {
  const targetTile = mapTiles[startRow][startCol]
  const targetIdx  = targetTile?.idx ?? null
  const visited    = new Uint8Array(mapW * mapH)
  const result     = []
  const queue      = [startCol + startRow * mapW]
  visited[startCol + startRow * mapW] = 1

  while (queue.length) {
    const idx = queue.pop()
    const col = idx % mapW
    const row = (idx / mapW) | 0
    result.push({ col, row })

    for (const [dc, dr] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nc = col + dc
      const nr = row + dr
      if (nc < 0 || nc >= mapW || nr < 0 || nr >= mapH) continue
      const ni = nc + nr * mapW
      if (visited[ni]) continue
      visited[ni] = 1
      const cell = mapTiles[nr][nc]
      const cellIdx = cell?.idx ?? null
      if (cellIdx === targetIdx) queue.push(ni)
    }
  }
  return result
}

export default function TilemapGrid({
  tileW, tileH, mapW, mapH, doubleWidth,
  activeTool, zoom, onZoomChange,
  tileset, selectedTile,
  mapTiles, onPaintCell, onFillCells,
}) {
  const displayW   = (doubleWidth ? tileW * 2 : tileW) * zoom
  const displayH   = tileH * zoom
  const isPainting = useRef(false)
  const isErasing  = useRef(false)
  const [hoveredCell, setHoveredCell] = useState(null)

  // Release both drag modes on mouse up anywhere
  useEffect(() => {
    const up = () => { isPainting.current = false; isErasing.current = false }
    window.addEventListener('mouseup', up)
    return () => window.removeEventListener('mouseup', up)
  }, [])

  const handleWheel = useCallback((e) => {
    e.preventDefault()
    const idx = ZOOM_LEVELS.indexOf(zoom)
    if (e.deltaY < 0 && idx < ZOOM_LEVELS.length - 1) onZoomChange(ZOOM_LEVELS[idx + 1])
    if (e.deltaY > 0 && idx > 0)                       onZoomChange(ZOOM_LEVELS[idx - 1])
  }, [zoom, onZoomChange])

  const tryPaint = useCallback((col, row) => {
    if (activeTool === 'eraser') {
      onPaintCell(col, row, null)
    } else if (activeTool === 'fill' && selectedTile && tileset) {
      const cells = floodFill(mapTiles, col, row, mapW, mapH)
      // Skip if the clicked cell already has the selected tile
      if (cells.length === 1 && mapTiles[row][col]?.idx === selectedTile.idx) return
      onFillCells(cells, selectedTile)
    } else if (activeTool === 'stamp' && selectedTile && tileset) {
      onPaintCell(col, row, selectedTile)
    }
  }, [activeTool, selectedTile, tileset, mapTiles, mapW, mapH, onPaintCell, onFillCells])

  const tryErase = useCallback((col, row) => {
    onPaintCell(col, row, null)
  }, [onPaintCell])

  // Background style for a cell — only shows the painted tile
  const getCellStyle = (col, row) => {
    const checker     = (col + row) % 2 === 0
    const paintedTile = mapTiles?.[row]?.[col]

    if (!paintedTile || !tileset) {
      return { background: checker ? 'var(--bg)' : 'var(--bg2)' }
    }

    const scaleX = displayW / tileW
    const scaleY = displayH / tileH

    return {
      backgroundImage:    `url(${tileset.url})`,
      backgroundRepeat:   'no-repeat',
      backgroundSize:     `${tileset.naturalW * scaleX}px ${tileset.naturalH * scaleY}px`,
      backgroundPosition: `-${paintedTile.col * tileW * scaleX}px -${paintedTile.row * tileH * scaleY}px`,
      imageRendering:     'pixelated',
    }
  }

  // Single overlay rendered on top of the entire grid at the hovered cell position
  const renderHoverOverlay = () => {
    if (!hoveredCell) return null
    const { col, row } = hoveredCell
    const left = col * displayW
    const top  = row * displayH
    const base = { position: 'absolute', left, top, width: displayW, height: displayH, pointerEvents: 'none', zIndex: 10, boxSizing: 'border-box' }

    if (activeTool === 'eraser') {
      return (
        <div style={{
          ...base,
          background: 'rgba(255,60,60,0.18)',
          outline: '2px solid var(--red, #ff3c3c)',
          outlineOffset: '-2px',
        }} />
      )
    }

    if (!tileset || !selectedTile) {
      return (
        <div style={{ ...base, outline: '1px solid var(--green)', outlineOffset: '-1px' }} />
      )
    }

    const scaleX = displayW / tileW
    const scaleY = displayH / tileH

    return (
      <div style={{
        ...base,
        backgroundImage:    `url(${tileset.url})`,
        backgroundRepeat:   'no-repeat',
        backgroundSize:     `${tileset.naturalW * scaleX}px ${tileset.naturalH * scaleY}px`,
        backgroundPosition: `-${selectedTile.col * tileW * scaleX}px -${selectedTile.row * tileH * scaleY}px`,
        imageRendering:     'pixelated',
        outline:            '2px solid var(--amber)',
        outlineOffset:      '-2px',
      }} />
    )
  }

  return (
    <div
      style={{
        overflow: 'auto', flex: 1,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start',
        padding: '24px', position: 'relative', zIndex: 1,
      }}
      onWheel={handleWheel}
    >
      <div style={{ margin: 'auto' }}>

        {/* Info bar */}
        <div style={{
          fontFamily: "'Press Start 2P', monospace", fontSize: '7px',
          color: 'var(--text-dim)', letterSpacing: '2px',
          marginBottom: '10px', display: 'flex', gap: '20px', flexWrap: 'wrap',
        }}>
          <span>MAP <span style={{ color: 'var(--green)' }}>{mapW}×{mapH}</span> TILES</span>
          <span>TILE <span style={{ color: 'var(--amber)' }}>{tileW}×{tileH}</span> PX</span>
          {doubleWidth && <span>DISPLAY <span style={{ color: 'var(--green)' }}>{tileW * 2}×{tileH}</span> PX</span>}
          <span>CANVAS <span style={{ color: 'var(--green)' }}>{mapW * tileW}×{mapH * tileH}</span> PX</span>
        </div>

        {/* Status bar */}
        <div style={{
          fontFamily: "'Roboto Mono', 'Roboto', monospace", fontSize: '11px', fontWeight: 400,
          color: 'var(--text-dim)', marginBottom: '8px',
          display: 'flex', gap: '20px', alignItems: 'center', minHeight: '18px',
        }}>
          {hoveredCell
            ? <span>tile <span style={{ color: 'var(--text)', fontWeight: 600 }}>{hoveredCell.col}, {hoveredCell.row}</span></span>
            : <span style={{ opacity: 0.4 }}>—</span>
          }
        </div>

        {/* Grid wrapper — position:relative so the hover overlay is anchored here */}
        <div style={{ position: 'relative' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${mapW}, ${displayW}px)`,
              gridTemplateRows:    `repeat(${mapH}, ${displayH}px)`,
              border: '1px solid var(--green-dim)',
              boxShadow: '0 0 20px var(--green-glow)',
              cursor: activeTool === 'eraser' || (tileset && selectedTile && activeTool === 'stamp') ? 'none' : 'crosshair',
              userSelect: 'none',
            }}
            onContextMenu={e => e.preventDefault()}
            onMouseLeave={() => setHoveredCell(null)}
          >
            {Array.from({ length: mapW * mapH }).map((_, i) => {
              const col = i % mapW
              const row = Math.floor(i / mapW)

              return (
                <div
                  key={i}
                  title={`${col},${row}`}
                  style={{
                    width: displayW, height: displayH,
                    ...getCellStyle(col, row),
                    boxSizing: 'border-box',
                    borderRight:  '1px solid var(--border)',
                    borderBottom: '1px solid var(--border)',
                    transition: 'none',
                  }}
                  onMouseEnter={() => {
                    setHoveredCell({ col, row })
                    if (isPainting.current) tryPaint(col, row)
                    if (isErasing.current)  tryErase(col, row)
                  }}
                  onMouseDown={(e) => {
                    if (e.button === 2) { isErasing.current = true; tryErase(col, row); return }
                    if (e.button !== 0) return
                    isPainting.current = true
                    tryPaint(col, row)
                  }}
                />
              )
            })}
          </div>

          {/* Single hover overlay, always on top of the grid */}
          {renderHoverOverlay()}
        </div>
      </div>
    </div>
  )
}
