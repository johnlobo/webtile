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

function EdgeOverlay({ direction, color, label }) {
  const style = {
    position: 'absolute',
    background: color,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    fontWeight: 700,
    color: '#000',
    pointerEvents: 'none',
    zIndex: 5,
    opacity: 0.85,
  }

  const sizes = {
    north: { left: 0, top: -14, width: '100%', height: 14 },
    south: { left: 0, bottom: -14, width: '100%', height: 14 },
    west:  { left: -14, top: 0, width: 14, height: '100%' },
    east:  { right: -14, top: 0, width: 14, height: '100%' },
  }

  return (
    <div style={{ ...style, ...sizes[direction] }}>
      {label}
    </div>
  )
}

import { ENTITY_TYPES } from '../services/entityTypes'

export default function TilemapGrid({
  tileW, tileH, mapW, mapH, doubleWidth,
  activeTool, zoom, onZoomChange,
  tileset, selectedTile,
  mapTiles, onPaintCell, onFillCells,
  connections, entryPositions,
  onConnectionClick, onEntryClick, roomId,
  spawns, onSpawnClick,
  entities, onEntityClick, selectedEntityType,
  selectedEntityId, onSelectEntity,
}) {
  const displayW   = (doubleWidth ? tileW * 2 : tileW) * zoom
  const displayH   = tileH * zoom
  const isPainting = useRef(false)
  const isErasing  = useRef(false)
  const [hoveredCell, setHoveredCell] = useState(null)
  const gridRef = useRef(null)

  const connectionDirections = ['north', 'south', 'east', 'west'].filter(d => connections?.[d] != null)
  const hasActiveConnection = activeTool === 'conn' && connectionDirections.length > 0

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

  useEffect(() => {
    const el = gridRef.current
    if (!el) return
    const handler = (e) => handleWheel(e)
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [handleWheel])

  const tryPaint = useCallback((col, row) => {
    if (activeTool === 'entity') {
      if (onEntityClick) {
        const existing = entities.find(e => e.col === col && e.row === row)
        if (existing && onSelectEntity) {
          onSelectEntity(existing.id)
          return
        }
        onEntityClick(col, row)
      }
      return
    }
    if (activeTool === 'spawn') {
      if (onSpawnClick) onSpawnClick(col, row)
      return
    }
    if (activeTool === 'conn') {
      if (onEntryClick) onEntryClick(col, row)
      return
    }
    if (activeTool === 'eraser') {
      onPaintCell(col, row, null)
    } else if (activeTool === 'fill' && selectedTile && tileset) {
      const cells = floodFill(mapTiles, col, row, mapW, mapH)
      if (cells.length === 1 && mapTiles[row][col]?.idx === selectedTile.idx) return
      onFillCells(cells, selectedTile)
    } else if (activeTool === 'stamp' && selectedTile && tileset) {
      onPaintCell(col, row, selectedTile)
    }
  }, [activeTool, selectedTile, tileset, mapTiles, mapW, mapH, onPaintCell, onFillCells, onEntryClick, onSpawnClick, onEntityClick, onSelectEntity, entities])

  const tryErase = useCallback((col, row) => {
    onPaintCell(col, row, null)
  }, [onPaintCell])

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

    if (activeTool === 'conn') {
      return (
        <div style={{
          ...base,
          background: 'rgba(33,82,255,0.15)',
          outline: '2px solid var(--accent)',
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

  const renderConnectionOverlay = (dir) => {
    if (!connections?.[dir]) return null
    const target = connections[dir]
    const color = 'rgba(33,82,255,0.35)'
    const label = `→ ${target.targetRoomId ?? '?'}`
    return <EdgeOverlay key={dir} direction={dir} color={color} label={label} />
  }

  const renderEntryPoints = () => {
    if (!entryPositions || entryPositions.length === 0) return null
    return entryPositions.map((ep, i) => {
      const left = ep.col * displayW
      const top = ep.row * displayH
      return (
        <div key={i} style={{
          position: 'absolute',
          left, top,
          width: displayW, height: displayH,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none', zIndex: 6,
          fontSize: '10px', fontWeight: 700, color: 'var(--amber)',
        }}>
          ▶
        </div>
      )
    })
  }

  const renderSpawns = () => {
    if (!spawns || spawns.length === 0) return null
    return spawns.map((sp, i) => {
      const left = sp.col * displayW
      const top = sp.row * displayH
      const size = Math.min(displayW, displayH) * 0.6
      return (
        <div key={i} style={{
          position: 'absolute',
          left: left + (displayW - size) / 2,
          top: top + (displayH - size) / 2,
          width: size, height: size,
          borderRadius: '50%',
          background: 'rgba(255, 170, 0, 0.85)',
          border: '2px solid #000',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none', zIndex: 7,
          fontFamily: "'Roboto', sans-serif",
          fontSize: Math.max(8, size * 0.4),
          fontWeight: 800,
          color: '#000',
          boxShadow: '0 0 4px rgba(255,170,0,0.6)',
        }}>
          {i + 1}
        </div>
      )
    })
  }

  const renderEntities = () => {
    if (!entities || entities.length === 0) return null
    return entities.map((ent, i) => {
      const def = ENTITY_TYPES[ent.type] ?? ENTITY_TYPES.object
      const left = ent.col * displayW
      const top = ent.row * displayH
      const size = Math.min(displayW, displayH) * 0.7
      const isSelected = selectedEntityId === ent.id
      const isTypeSelected = activeTool === 'entity' && selectedEntityType === ent.type
      return (
        <div key={ent.id ?? i} style={{
          position: 'absolute',
          left: left + (displayW - size) / 2,
          top: top + (displayH - size) / 2,
          width: size, height: size,
          borderRadius: '4px',
          background: def.bg,
          border: `2px solid ${def.color}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none', zIndex: 8,
          fontFamily: "'Roboto', sans-serif",
          fontSize: Math.max(8, size * 0.35),
          fontWeight: 800,
          color: def.color,
          boxShadow: `0 0 4px ${def.color}`,
          outline: isSelected ? '2px solid #fff' : isTypeSelected ? '2px solid var(--accent)' : 'none',
          outlineOffset: '-2px',
        }}>
          {def.label}
        </div>
      )
    })
  }

  const getCursorForTool = () => {
    if (activeTool === 'eraser') return 'none'
    if (activeTool === 'conn') return 'crosshair'
    if (activeTool === 'spawn') return 'crosshair'
    if (tileset && selectedTile && activeTool === 'stamp') return 'none'
    return 'crosshair'
  }

   return (
     <div
       ref={gridRef}
       style={{
         overflow: 'auto', flex: 1,
         display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start',
         padding: '24px', position: 'relative', zIndex: 1,
       }}
     >
      <div style={{ margin: 'auto', position: 'relative' }}>

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
          {roomId != null && <span>ROOM <span style={{ color: 'var(--accent)' }}>{roomId}</span></span>}
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
          {activeTool === 'conn' && (
            <span style={{ color: 'var(--accent)' }}>
              LINK MODE: click a border or cell
            </span>
          )}
        </div>

        {/* Grid wrapper */}
        <div style={{ position: 'relative' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${mapW}, ${displayW}px)`,
              gridTemplateRows:    `repeat(${mapH}, ${displayH}px)`,
              border: '1px solid var(--green-dim)',
              boxShadow: '0 0 20px var(--green-glow)',
              cursor: getCursorForTool(),
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
                  onDoubleClick={() => {
                    if (activeTool === 'conn' && onEntryClick) {
                      onEntryClick(col, row)
                    }
                  }}
                />
              )
            })}
          </div>

          {/* Connection edges */}
          {activeTool === 'conn' && (
            <>
              {renderConnectionOverlay('north')}
              {renderConnectionOverlay('south')}
              {renderConnectionOverlay('east')}
              {renderConnectionOverlay('west')}
            </>
          )}

          {/* Entry points */}
          {activeTool === 'conn' && renderEntryPoints()}

          {/* Spawns */}
          {renderSpawns()}

          {/* Entities */}
          {renderEntities()}

          {/* Hover overlay */}
          {renderHoverOverlay()}
        </div>
      </div>
    </div>
  )
}
