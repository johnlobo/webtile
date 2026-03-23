import { useState, useRef, useEffect, useCallback } from 'react'

/* ── Minimap ─────────────────────────────────────────────────────────── */
function MinimapSection({ project, mapTiles, tileset }) {
  const canvasRef = useRef()
  const INNER_W   = 56   // usable px inside the sidebar

  useEffect(() => {
    if (!project) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const fullW  = project.mapW * project.tileW
    const fullH  = project.mapH * project.tileH
    const scaleX = INNER_W / fullW
    const scaleH = Math.round(fullH * scaleX)

    canvas.width  = INNER_W
    canvas.height = scaleH

    // Background
    ctx.fillStyle = '#06090a'
    ctx.fillRect(0, 0, INNER_W, scaleH)

    // Draw tiles (painted tiles if available, otherwise checkerboard)
    for (let row = 0; row < project.mapH; row++) {
      for (let col = 0; col < project.mapW; col++) {
        const px = Math.round(col * project.tileW * scaleX)
        const py = Math.round(row * project.tileH * scaleX)
        const pw = Math.max(1, Math.round(project.tileW * scaleX))
        const ph = Math.max(1, Math.round(project.tileH * scaleX))

        const tile = mapTiles?.[row]?.[col]
        if (tileset && tile != null) {
          const srcX = tile.col * project.tileW
          const srcY = tile.row * project.tileH
          ctx.drawImage(tileset.canvas ?? tileset.img, srcX, srcY, project.tileW, project.tileH, px, py, pw, ph)
        } else {
          ctx.fillStyle = (col + row) % 2 === 0 ? '#06090a' : '#0b1214'
          ctx.fillRect(px, py, pw, ph)
        }

        // Grid line
        ctx.strokeStyle = '#122018'
        ctx.lineWidth = 0.5
        ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1)
      }
    }

    // Border
    ctx.strokeStyle = '#007a40'
    ctx.lineWidth = 1
    ctx.strokeRect(0, 0, INNER_W, scaleH)
  }, [project, mapTiles, tileset])

  if (!project) return null

  return (
    <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: INNER_W, flexShrink: 0, imageRendering: 'pixelated' }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: "'Roboto', sans-serif", fontWeight: 700,
          fontSize: '10px', color: 'var(--text-dim)',
          letterSpacing: '2px', marginBottom: '6px',
        }}>
          MINIMAP
        </div>
        <div style={{
          fontFamily: "'Roboto', sans-serif",
          fontSize: '12px', color: 'var(--text-dim)', letterSpacing: '1px', lineHeight: 1.5,
        }}>
          {project.mapW}×{project.mapH}<br/>{project.tileW}×{project.tileH}px
        </div>
      </div>
    </div>
  )
}

/* ── Tileset Panel ───────────────────────────────────────────────────── */
function TilesetSection({ tileW, tileH, tileset, selectedTile, onLoadTileset, onSelectTile, onEditTile }) {
  const fileRef     = useRef()
  const containerRef = useRef()
  const [hover, setHover] = useState(null)  // { col, row }

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const cols = Math.floor(img.naturalWidth  / tileW)
      const rows = Math.floor(img.naturalHeight / tileH)
      const canvas = document.createElement('canvas')
      canvas.width  = img.naturalWidth
      canvas.height = img.naturalHeight
      canvas.getContext('2d').drawImage(img, 0, 0)
      onLoadTileset({ url, img, canvas, cols, rows, naturalW: img.naturalWidth, naturalH: img.naturalHeight })
    }
    img.src = url
    // Reset input so same file can be reloaded
    e.target.value = ''
  }

  const getScale = () => {
    if (!containerRef.current || !tileset) return 1
    return containerRef.current.offsetWidth / tileset.naturalW
  }

  const handleMouseMove = (e) => {
    if (!tileset) return
    const rect = e.currentTarget.getBoundingClientRect()
    const scale = rect.width / tileset.naturalW
    const col = Math.floor((e.clientX - rect.left)  / (tileW * scale))
    const row = Math.floor((e.clientY - rect.top)   / (tileH * scale))
    if (col >= 0 && col < tileset.cols && row >= 0 && row < tileset.rows) {
      setHover({ col, row })
    } else {
      setHover(null)
    }
  }

  const handleClick = (e) => {
    if (!tileset) return
    const rect = e.currentTarget.getBoundingClientRect()
    const scale = rect.width / tileset.naturalW
    const col = Math.floor((e.clientX - rect.left)  / (tileW * scale))
    const row = Math.floor((e.clientY - rect.top)   / (tileH * scale))
    if (col >= 0 && col < tileset.cols && row >= 0 && row < tileset.rows) {
      onSelectTile({ col, row, idx: row * tileset.cols + col })
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

      {/* Header */}
      <div style={{
        padding: '12px 12px 8px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{
          fontFamily: "'Roboto', sans-serif", fontWeight: 700,
          fontSize: '11px', color: 'var(--text-dim)', letterSpacing: '2px',
        }}>
          TILESET
        </div>
        <button
          onClick={() => fileRef.current.click()}
          style={{
            fontFamily: "'Roboto', sans-serif", fontSize: '11px', fontWeight: 600,
            padding: '5px 10px', background: 'transparent',
            border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--accent)',
            cursor: 'pointer',
            transition: 'border-color 0.15s, background 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(33,82,255,0.06)'; e.currentTarget.style.borderColor = 'rgba(33,82,255,0.35)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--border)' }}
        >
          {tileset ? 'Change' : 'Load'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
      </div>

      {!tileset ? (
        /* Empty state */
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '24px 12px', gap: '16px',
        }}>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 20px)',
            gridTemplateRows: 'repeat(3, 20px)', gap: '2px', opacity: 0.15,
          }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} style={{
                background: i % 3 === 0 ? 'var(--green-dim)' : i % 2 === 0 ? 'var(--amber-dim)' : 'var(--bg2)',
                border: '1px solid var(--border)',
              }} />
            ))}
          </div>
          <button
            onClick={() => fileRef.current.click()}
            className="btn-ghost"
            style={{ padding: '8px 16px' }}
          >
            Load Image
          </button>
          <div style={{
            fontFamily: "'Roboto', sans-serif", fontSize: '13px',
            color: 'var(--text-dim)', textAlign: 'center', letterSpacing: '1px', lineHeight: 1.6,
          }}>
            PNG, JPG, GIF<br />tiles: {tileW}×{tileH} px
          </div>
        </div>
      ) : (
        /* Tileset image + selector */
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 12px' }}>

          {/* Tile info */}
          <div style={{
            fontFamily: "'Roboto', sans-serif", fontSize: '13px',
            color: 'var(--text-dim)', letterSpacing: '1px', marginBottom: '8px',
          }}>
            {tileset.cols}×{tileset.rows} tiles · {tileset.naturalW}×{tileset.naturalH}px
            {selectedTile && (
              <span style={{ color: 'var(--green)', marginLeft: '8px' }}>
                [{selectedTile.col},{selectedTile.row}]
              </span>
            )}
          </div>

          {/* Image container with overlay */}
          <div
            ref={containerRef}
            style={{
              position: 'relative', cursor: 'crosshair',
              border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden',
              display: 'inline-block', width: '100%',
            }}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHover(null)}
            onClick={handleClick}
          >
            <img
              src={tileset.url}
              style={{
                display: 'block', width: '100%',
                imageRendering: 'pixelated',
              }}
            />

            {/* Hover highlight */}
            {hover && (() => {
              const scale = (containerRef.current?.offsetWidth ?? 1) / tileset.naturalW
              return (
                <div style={{
                  position: 'absolute',
                  left:   hover.col * tileW * scale,
                  top:    hover.row * tileH * scale,
                  width:  tileW * scale,
                  height: tileH * scale,
                  background: 'rgba(33,82,255,0.18)',
                  pointerEvents: 'none',
                }} />
              )
            })()}

            {/* Selected tile highlight */}
            {selectedTile && (() => {
              const scale = (containerRef.current?.offsetWidth ?? 1) / tileset.naturalW
              return (
                <div style={{
                  position: 'absolute',
                  left:   selectedTile.col * tileW * scale,
                  top:    selectedTile.row * tileH * scale,
                  width:  tileW * scale,
                  height: tileH * scale,
                  border: '2px solid var(--green)',
                  boxShadow: '0 0 6px var(--green-glow)',
                  pointerEvents: 'none',
                }} />
              )
            })()}

            {/* Grid lines overlay (SVG) */}
            <svg
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
              viewBox={`0 0 ${tileset.naturalW} ${tileset.naturalH}`}
              preserveAspectRatio="none"
            >
              {Array.from({ length: tileset.cols - 1 }).map((_, i) => (
                <line key={`v${i}`}
                  x1={(i + 1) * tileW} y1={0}
                  x2={(i + 1) * tileW} y2={tileset.naturalH}
                  stroke="#122018" strokeWidth="1" />
              ))}
              {Array.from({ length: tileset.rows - 1 }).map((_, i) => (
                <line key={`h${i}`}
                  x1={0}               y1={(i + 1) * tileH}
                  x2={tileset.naturalW} y2={(i + 1) * tileH}
                  stroke="#122018" strokeWidth="1" />
              ))}
            </svg>
          </div>
          {/* Tile pixel editor (shown when a tile is selected) */}
          {selectedTile && tileset?.canvas && (
            <TileEditorSection
              tileW={tileW} tileH={tileH}
              tileset={tileset} selectedTile={selectedTile}
              onEditTile={onEditTile}
            />
          )}
        </div>
      )}
    </div>
  )
}

/* ── Tile Pixel Editor ───────────────────────────────────────────────── */
// Amstrad CPC 27-color hardware palette (3×3×3 RGB cube: 0x00, 0x80, 0xFF per channel)
const SWATCHES = [
  '#000000','#000080','#0000ff',
  '#800000','#800080','#8000ff',
  '#ff0000','#ff0080','#ff00ff',
  '#008000','#008080','#0080ff',
  '#808000','#808080','#8080ff',
  '#ff8000','#ff8080','#ff80ff',
  '#00ff00','#00ff80','#00ffff',
  '#80ff00','#80ff80','#80ffff',
  '#ffff00','#ffff80','#ffffff',
]

function TileEditorSection({ tileW, tileH, tileset, selectedTile, onEditTile }) {
  const canvasRef  = useRef()
  const isPainting = useRef(false)
  const [color, setColor] = useState('#000000')
  const [tool,  setTool]  = useState('pen')  // 'pen' | 'eyedropper'

  const ZOOM = Math.max(2, Math.floor(180 / Math.max(tileW, tileH)))
  const CW   = tileW * ZOOM
  const CH   = tileH * ZOOM

  // Redraw editor canvas from tileset.canvas
  const redrawEditor = useCallback(() => {
    const el = canvasRef.current
    if (!el || !tileset?.canvas || !selectedTile) return
    const ctx = el.getContext('2d')
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, CW, CH)
    ctx.drawImage(
      tileset.canvas,
      selectedTile.col * tileW, selectedTile.row * tileH, tileW, tileH,
      0, 0, CW, CH
    )
    // pixel grid — dark underlay for contrast, then bright line on top
    for (let x = 0; x <= tileW; x++) {
      ctx.strokeStyle = 'rgba(0,0,0,0.55)'
      ctx.lineWidth   = 1.5
      ctx.beginPath(); ctx.moveTo(x * ZOOM, 0); ctx.lineTo(x * ZOOM, CH); ctx.stroke()
      ctx.strokeStyle = 'rgba(180,230,200,0.45)'
      ctx.lineWidth   = 0.5
      ctx.beginPath(); ctx.moveTo(x * ZOOM, 0); ctx.lineTo(x * ZOOM, CH); ctx.stroke()
    }
    for (let y = 0; y <= tileH; y++) {
      ctx.strokeStyle = 'rgba(0,0,0,0.55)'
      ctx.lineWidth   = 1.5
      ctx.beginPath(); ctx.moveTo(0, y * ZOOM); ctx.lineTo(CW, y * ZOOM); ctx.stroke()
      ctx.strokeStyle = 'rgba(180,230,200,0.45)'
      ctx.lineWidth   = 0.5
      ctx.beginPath(); ctx.moveTo(0, y * ZOOM); ctx.lineTo(CW, y * ZOOM); ctx.stroke()
    }
  }, [tileset, selectedTile, tileW, tileH, CW, CH, ZOOM])

  useEffect(() => { redrawEditor() }, [redrawEditor])

  const paintAt = (e, forceErase = false) => {
    if (!tileset?.canvas || !selectedTile) return
    const el   = canvasRef.current
    const rect = el.getBoundingClientRect()
    const px   = Math.floor((e.clientX - rect.left) / rect.width  * tileW)
    const py   = Math.floor((e.clientY - rect.top)  / rect.height * tileH)
    if (px < 0 || px >= tileW || py < 0 || py >= tileH) return

    const tsx   = selectedTile.col * tileW + px
    const tsy   = selectedTile.row * tileH + py
    const tsCtx = tileset.canvas.getContext('2d')

    if (!forceErase && tool === 'eyedropper') {
      const [r, g, b] = tsCtx.getImageData(tsx, tsy, 1, 1).data
      setColor('#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join(''))
      setTool('pen')
      return
    }

    if (forceErase) {
      tsCtx.clearRect(tsx, tsy, 1, 1)
    } else {
      tsCtx.fillStyle = color
      tsCtx.fillRect(tsx, tsy, 1, 1)
    }
    redrawEditor()
    onEditTile(tileset.canvas)
  }

  return (
    <div style={{ padding: '12px 12px 16px', borderTop: '1px solid var(--border)' }}>

      {/* Header */}
      <div style={{
        fontFamily: "'Roboto', sans-serif", fontWeight: 700,
        fontSize: '11px', color: 'var(--text-dim)',
        letterSpacing: '2px', marginBottom: '10px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span>TILE EDITOR</span>
        <span style={{ color: 'var(--amber)' }}>[{selectedTile.col},{selectedTile.row}]</span>
      </div>

      {/* Zoomed pixel canvas */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
        <canvas
          ref={canvasRef}
          width={CW} height={CH}
          style={{
            display: 'block', width: CW, height: CH,
            imageRendering: 'pixelated',
            border: '1px solid var(--green-dim)',
            cursor: tool === 'eyedropper' ? 'cell' : 'crosshair',
          }}
          onContextMenu={e => e.preventDefault()}
          onMouseDown={e => {
            isPainting.current = true
            if (e.button === 2) paintAt(e, true)
            else paintAt(e)
          }}
          onMouseMove={e => { if (isPainting.current) paintAt(e, e.buttons === 2) }}
          onMouseUp={() => { isPainting.current = false }}
          onMouseLeave={() => { isPainting.current = false }}
        />
      </div>

      {/* Tools */}
      <div style={{ display: 'flex', gap: '5px', marginBottom: '8px' }}>
        {[['pen','PEN'],['eyedropper','PICK']].map(([id, label]) => (
          <button key={id} onClick={() => setTool(id)} style={{
            flex: 1, padding: '4px 0',
            background: tool === id ? 'var(--green-glow)' : 'transparent',
            border: `1px solid ${tool === id ? 'var(--green)' : 'var(--border)'}`,
            color: tool === id ? 'var(--green)' : 'var(--text-dim)',
            cursor: 'pointer',
            fontFamily: "'Roboto', sans-serif", fontSize: '11px', fontWeight: 600, letterSpacing: '1px',
          }}>{label}</button>
        ))}
        <div style={{
          fontSize: '11px', color: 'var(--text-dim)', fontFamily: "'Roboto', sans-serif", fontWeight: 400,
          letterSpacing: '1px', alignSelf: 'center', lineHeight: 1.2,
          borderLeft: '1px solid var(--border)', paddingLeft: '6px',
        }}>RMB<br/>ERASE</div>
      </div>

      {/* Color swatches */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: '2px', marginBottom: '8px' }}>
        {SWATCHES.map(c => (
          <div
            key={c}
            onClick={() => { setColor(c); setTool('pen') }}
            style={{
              paddingBottom: '100%', background: c, boxSizing: 'border-box',
              cursor: 'pointer',
              border: color.toLowerCase() === c ? '2px solid var(--green)' : '1px solid var(--border)',
            }}
          />
        ))}
      </div>

      {/* Color input */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
        <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: '13px', color: 'var(--text-dim)', letterSpacing: '1px' }}>
          COLOR
        </span>
        <input
          type="color" value={color}
          onChange={e => { setColor(e.target.value); setTool('pen') }}
          style={{ width: '28px', height: '20px', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', padding: '1px' }}
        />
        <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: '13px', color: 'var(--green)', letterSpacing: '1px' }}>
          {color.toUpperCase()}
        </span>
      </div>
    </div>
  )
}

/* ── Right Sidebar ───────────────────────────────────────────────────── */
export default function RightSidebar({ project, mapTiles, tileset, selectedTile, onLoadTileset, onSelectTile, onEditTile }) {
  return (
    <aside style={{
      width: '220px',
      flexShrink: 0,
      background: 'var(--panel)',
      borderLeft: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      zIndex: 1,
      overflow: 'hidden',
    }}>
      <MinimapSection project={project} mapTiles={mapTiles} tileset={tileset} />

      {project && (
        <TilesetSection
          tileW={project.tileW}
          tileH={project.tileH}
          tileset={tileset}
          selectedTile={selectedTile}
          onLoadTileset={onLoadTileset}
          onSelectTile={onSelectTile}
          onEditTile={onEditTile}
        />
      )}

      {!project && (
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'Roboto', sans-serif", fontSize: '14px',
          color: 'var(--text-dim)', letterSpacing: '2px', textAlign: 'center', padding: '24px',
        }}>
          CREATE A PROJECT<br />TO START<span className="blink">_</span>
        </div>
      )}
    </aside>
  )
}
