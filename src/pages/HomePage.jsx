import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import NewProjectModal from '../components/NewProjectModal'
import LoadProjectModal from '../components/LoadProjectModal'
import NewMapModal from '../components/NewMapModal'
import TilemapGrid from '../components/TilemapGrid'
import RightSidebar from '../components/RightSidebar'
import Toolbar from '../components/Toolbar'
import SpriteEditor from '../components/SpriteEditor'
import NewSpriteModal from '../components/NewSpriteModal'
import {
  createProject, loadProject, listMaps,
  createMap, saveMap, loadMap, deleteMap,
} from '../services/projectService'
import { createSprite, listSprites, deleteSprite } from '../services/spriteService'

// ── TMX helpers ───────────────────────────────────────────────────────────────

function parseTMX(xmlText) {
  try {
    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml')
    const map    = xmlDoc.querySelector('map')
    if (!map) return null

    const mapW  = parseInt(map.getAttribute('width'))
    const mapH  = parseInt(map.getAttribute('height'))
    const tileW = parseInt(map.getAttribute('tilewidth'))
    const tileH = parseInt(map.getAttribute('tileheight'))

    const tilesetEl   = map.querySelector('tileset')
    const firstgid    = tilesetEl ? parseInt(tilesetEl.getAttribute('firstgid') || '1') : 1
    const tilesetCols = tilesetEl ? parseInt(tilesetEl.getAttribute('columns') || '0') : 0

    const dataEl = map.querySelector('data[encoding="csv"]')
    let mapTiles = Array.from({ length: mapH }, () => Array(mapW).fill(null))

    if (dataEl && tilesetCols > 0) {
      const rawIds = dataEl.textContent.trim().split(',').map(s => parseInt(s.trim()))
      for (let r = 0; r < mapH; r++) {
        for (let c = 0; c < mapW; c++) {
          const gid = rawIds[r * mapW + c]
          if (gid > 0) {
            const idx = gid - firstgid
            const col = idx % tilesetCols
            const row = Math.floor(idx / tilesetCols)
            mapTiles[r][c] = { col, row, idx }
          }
        }
      }
    }

    return { mapW, mapH, tileW, tileH, mapTiles, hasTileData: tilesetCols > 0 }
  } catch (_) {
    return null
  }
}

function buildTMX(mapConfig, mapTiles, tileset) {
  const { tileW, tileH, mapW, mapH } = mapConfig
  const tilesetCols = tileset ? Math.floor(tileset.naturalW / tileW) : 1
  const tilesetRows = tileset ? Math.floor(tileset.naturalH / tileH) : 1
  const tileCount   = tilesetCols * tilesetRows

  const tilesetBlock = tileset
    ? `\n <tileset firstgid="1" name="tileset" tilewidth="${tileW}" tileheight="${tileH}" tilecount="${tileCount}" columns="${tilesetCols}">\n  <image source="tileset.png" width="${tileset.naturalW}" height="${tileset.naturalH}"/>\n </tileset>`
    : ''

  const csv = mapTiles.map(row =>
    row.map(tile => tile ? (tile.row * tilesetCols + tile.col + 1) : 0).join(',')
  ).join(',\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" tiledversion="1.10.2" orientation="orthogonal" renderorder="right-down" width="${mapW}" height="${mapH}" tilewidth="${tileW}" tileheight="${tileH}" infinite="0" nextlayerid="2" nextobjectid="1">${tilesetBlock}
 <layer id="1" name="Tile Layer 1" width="${mapW}" height="${mapH}">
  <data encoding="csv">
${csv}
  </data>
 </layer>
</map>`
}

function downloadText(filename, content) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([content], { type: 'text/xml' }))
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

// ── Top Navigation ────────────────────────────────────────────────────────────

function NavDropdown({ label, open, disabled, onToggle, children }) {
  const isOpen = open && !disabled
  return (
    <div style={{ position: 'relative' }} data-topnav="true">
      <button
        onClick={disabled ? undefined : onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '0 16px', height: '100%', minHeight: '36px',
          background: isOpen ? 'var(--green-glow)' : 'transparent',
          border: 'none', borderBottom: isOpen ? '2px solid var(--green)' : '2px solid transparent',
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontFamily: "'Press Start 2P', monospace",
          fontSize: '7px', letterSpacing: '1.5px',
          color: disabled ? 'var(--text-dim)' : isOpen ? 'var(--green)' : 'var(--text)',
          opacity: disabled ? 0.35 : 1,
          transition: 'color 0.15s, background 0.15s, border-color 0.15s',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={e => { if (!disabled && !isOpen) { e.currentTarget.style.color = 'var(--green)'; e.currentTarget.style.background = 'rgba(0,232,122,0.06)' }}}
        onMouseLeave={e => { if (!disabled && !isOpen) { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'transparent' }}}
      >
        {label}
        <span style={{
          fontSize: '8px', color: disabled ? 'var(--text-dim)' : 'var(--green-dim)',
          transform: isOpen ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.18s', display: 'inline-block', marginTop: '1px',
        }}>▼</span>
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute', top: '100%', left: 0,
          minWidth: '200px', zIndex: 200,
          background: 'var(--panel)',
          border: '1px solid var(--green-dim)',
          borderTop: '2px solid var(--green)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.6), 0 0 12px rgba(0,232,122,0.08)',
        }}>
          {children}
        </div>
      )}
    </div>
  )
}

function NavItem({ label, icon, onClick, accent }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
        padding: '9px 16px', background: 'transparent', border: 'none',
        cursor: 'pointer', textAlign: 'left',
        fontFamily: "'VT323', monospace", fontSize: '19px', letterSpacing: '1.5px',
        color: accent === 'amber' ? 'var(--amber)' : 'var(--text-dim)',
        transition: 'color 0.12s, background 0.12s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--green-glow)'; e.currentTarget.style.color = accent === 'amber' ? 'var(--amber)' : 'var(--green)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = accent === 'amber' ? 'var(--amber)' : 'var(--text-dim)' }}
    >
      {icon && <span style={{ fontSize: '11px', color: 'var(--green-dim)', flexShrink: 0, lineHeight: 1 }}>{icon}</span>}
      {label}
    </button>
  )
}

function NavSep() {
  return <div style={{ height: '1px', background: 'var(--border)', margin: '3px 0' }} />
}

function NavMapItem({ map, active, onClick, onDelete }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '8px 12px 8px 16px',
        background: active ? 'rgba(0,232,122,0.08)' : hovered ? 'var(--green-glow)' : 'transparent',
        borderLeft: active ? '2px solid var(--green)' : '2px solid transparent',
        marginLeft: '-1px', cursor: 'pointer',
      }}
    >
      <span style={{
        fontFamily: "'VT323', monospace", fontSize: '18px', letterSpacing: '1px',
        color: active ? 'var(--green)' : 'var(--text-dim)', flex: 1,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{map.name}</span>
      {(hovered || active) && (
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          style={{
            flexShrink: 0, padding: '1px 5px', background: 'transparent',
            border: '1px solid transparent', color: 'var(--text-dim)', cursor: 'pointer',
            fontFamily: "'Press Start 2P', monospace", fontSize: '5px',
            transition: 'border-color 0.12s, color 0.12s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--red)'; e.currentTarget.style.color = 'var(--red)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.color = 'var(--text-dim)' }}
        >DEL</button>
      )}
    </div>
  )
}

function TopNav({ projectName, maps, activeMapId, onAction, onSelectMap, onDeleteMap, tmxInputRef, sprites, selectedSpriteId, onSelectSprite, onDeleteSprite }) {
  const [activeMenu, setActiveMenu] = useState(null)
  const hasProject = !!projectName
  const navRef = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) setActiveMenu(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggle = (menu) => setActiveMenu(prev => prev === menu ? null : menu)
  const close = () => setActiveMenu(null)

  return (
    <div ref={navRef} style={{ display: 'flex', alignItems: 'stretch', height: '100%' }}>

      {/* PROJECTS */}
      <NavDropdown label="PROJECTS" open={activeMenu === 'project'} onToggle={() => toggle('project')}>
        <div style={{ padding: '8px 16px 6px', fontFamily: "'Press Start 2P', monospace", fontSize: '6px', color: 'var(--text-dim)', letterSpacing: '2px' }}>PROJECT</div>
        {projectName && (
          <div style={{ padding: '4px 16px 8px', fontFamily: "'VT323', monospace", fontSize: '17px', color: 'var(--amber)', letterSpacing: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            ▸ {projectName}
          </div>
        )}
        <NavSep />
        <NavItem label="NEW PROJECT"  icon="✦" onClick={() => { onAction('project', 'new');  close() }} />
        <NavItem label="LOAD PROJECT" icon="▶" onClick={() => { onAction('project', 'load'); close() }} />
      </NavDropdown>

      {/* MAPS */}
      <NavDropdown label="MAPS" open={activeMenu === 'maps'} disabled={!hasProject} onToggle={() => toggle('maps')}>
        <div style={{ padding: '8px 16px 4px', fontFamily: "'Press Start 2P', monospace", fontSize: '6px', color: 'var(--text-dim)', letterSpacing: '2px' }}>MAPS</div>
        {maps.length === 0 && (
          <div style={{ padding: '4px 16px 8px', fontFamily: "'VT323', monospace", fontSize: '16px', color: 'var(--text-dim)', opacity: 0.5, letterSpacing: '1px' }}>No maps yet</div>
        )}
        {maps.length > 0 && (
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {maps.map(m => (
              <NavMapItem
                key={m.id} map={m} active={m.id === activeMapId}
                onClick={() => { onSelectMap(m.id); close() }}
                onDelete={() => onDeleteMap(m.id)}
              />
            ))}
          </div>
        )}
        <NavSep />
        <NavItem label="+ NEW MAP"       icon="✦" onClick={() => { onAction('maps', 'new'); close() }} />
        <NavItem label="↑ IMPORT .TMX"  icon="" onClick={() => { tmxInputRef.current?.click(); close() }} />
        <input ref={tmxInputRef} type="file" accept=".tmx" style={{ display: 'none' }}
          onChange={e => { onAction('maps', 'import-tmx', e.target.files[0]); e.target.value = '' }} />
        <NavSep />
        <NavItem label="⬇ EXPORT .TMX"     icon="" onClick={() => { onAction('export', 'tmx'); close() }} />
        <NavItem label="⬇ EXPORT TILESET"  icon="" onClick={() => { onAction('export', 'tileset-png'); close() }} />
      </NavDropdown>

      {/* SPRITES */}
      <NavDropdown label="SPRITES" open={activeMenu === 'sprites'} disabled={!hasProject} onToggle={() => toggle('sprites')}>
        <div style={{ padding: '8px 16px 4px', fontFamily: "'Press Start 2P', monospace", fontSize: '6px', color: 'var(--text-dim)', letterSpacing: '2px' }}>SPRITES</div>
        {sprites.length === 0 && (
          <div style={{ padding: '4px 16px 8px', fontFamily: "'VT323', monospace", fontSize: '16px', color: 'var(--text-dim)', opacity: 0.5, letterSpacing: '1px' }}>No sprites yet</div>
        )}
        {sprites.length > 0 && (
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {sprites.map(s => (
              <SpriteItem
                key={s.id} sprite={s} active={s.id === selectedSpriteId}
                onClick={() => { onSelectSprite(s.id); close() }}
                onDelete={() => onDeleteSprite(s.id)}
              />
            ))}
          </div>
        )}
        <NavSep />
        <NavItem label="+ NEW SPRITE" icon="✦" onClick={() => { onAction('sprites', 'new'); close() }} />
      </NavDropdown>

    </div>
  )
}

function MapItem({ map, active, onClick, onDelete }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '7px 10px 7px 16px',
        background: active ? 'rgba(0,232,122,0.08)' : hovered ? 'var(--green-glow)' : 'transparent',
        borderLeft: active ? '2px solid var(--green)' : '2px solid transparent',
        marginLeft: '-2px',
        cursor: 'pointer', transition: 'background 0.15s',
      }}
    >
      <span style={{ fontFamily: "'VT323', monospace", fontSize: '17px', color: active ? 'var(--green)' : 'var(--text-dim)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '1px' }}>
        {map.name}
      </span>
      {(hovered || active) && (
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          style={{
            flexShrink: 0, padding: '2px 5px',
            background: 'transparent', border: '1px solid transparent',
            color: 'var(--text-dim)', cursor: 'pointer',
            fontFamily: "'Press Start 2P', monospace", fontSize: '5px',
            letterSpacing: '0.5px', transition: 'border-color 0.15s, color 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--red)'; e.currentTarget.style.color = 'var(--red)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.color = 'var(--text-dim)' }}
        >DEL</button>
      )}
    </div>
  )
}

function SpriteItem({ sprite, active, onClick, onDelete }) {
  const [hovered, setHovered] = useState(false)
  const modeLabel = `M${sprite.videoMode}`
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '7px 10px 7px 16px',
        background: active ? 'rgba(0,232,122,0.08)' : hovered ? 'var(--green-glow)' : 'transparent',
        borderLeft: active ? '2px solid var(--green)' : '2px solid transparent',
        marginLeft: '-2px',
        cursor: 'pointer', transition: 'background 0.15s',
      }}
    >
      <span style={{
        fontFamily: "'Press Start 2P', monospace", fontSize: '5px',
        color: active ? 'var(--green)' : 'var(--text-dim)',
        background: active ? 'rgba(0,232,122,0.15)' : 'var(--bg)',
        border: `1px solid ${active ? 'var(--green-dim)' : 'var(--border)'}`,
        padding: '2px 4px', flexShrink: 0, letterSpacing: '0.5px',
      }}>
        {modeLabel}
      </span>
      <span style={{
        fontFamily: "'VT323', monospace", fontSize: '17px',
        color: active ? 'var(--green)' : 'var(--text-dim)',
        flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        letterSpacing: '1px',
      }}>
        {sprite.name}
      </span>
      {(hovered || active) && (
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          style={{
            flexShrink: 0, padding: '2px 5px',
            background: 'transparent', border: '1px solid transparent',
            color: 'var(--text-dim)', cursor: 'pointer',
            fontFamily: "'Press Start 2P', monospace", fontSize: '5px',
            letterSpacing: '0.5px', transition: 'border-color 0.15s, color 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--red)'; e.currentTarget.style.color = 'var(--red)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.color = 'var(--text-dim)' }}
        >DEL</button>
      )}
    </div>
  )
}

// ── Empty states ──────────────────────────────────────────────────────────────

function EmptyWorkspace() {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
      <div className="pixel-panel fade-up" style={{ padding: '52px 44px', textAlign: 'center', maxWidth: '420px', width: '100%' }}>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '9px', color: 'var(--green)', letterSpacing: '2px', marginBottom: '14px' }}>
          TILEMAP EDITOR
        </div>
        <div style={{ width: '40px', height: '2px', background: 'var(--green)', margin: '0 auto 24px' }} />
        <div style={{ fontFamily: "'VT323', monospace", fontSize: '20px', color: 'var(--text-dim)', letterSpacing: '2px', lineHeight: 1.8 }}>
          CREATE OR LOAD A PROJECT<br />FROM THE MENU<span className="blink">_</span>
        </div>
        <div style={{ marginTop: '28px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', opacity: 0.15 }}>
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} style={{
              paddingBottom: '100%',
              background: i % 3 === 0 ? 'var(--green-dim)' : i % 3 === 1 ? 'var(--amber-dim)' : 'var(--bg2)',
              border: '1px solid var(--border)',
            }} />
          ))}
        </div>
      </div>
    </div>
  )
}

function NoMaps({ onCreate, onImport, tmxInputRef }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
      <div className="pixel-panel fade-up" style={{ padding: '48px 44px', textAlign: 'center', maxWidth: '380px', width: '100%' }}>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '8px', color: 'var(--amber)', letterSpacing: '2px', marginBottom: '14px' }}>
          NO MAPS YET
        </div>
        <div style={{ width: '40px', height: '2px', background: 'var(--amber)', margin: '0 auto 24px' }} />
        <div style={{ fontFamily: "'VT323', monospace", fontSize: '18px', color: 'var(--text-dim)', letterSpacing: '2px', lineHeight: 1.8, marginBottom: '28px' }}>
          Add a map to this project<br/>to start editing<span className="blink">_</span>
        </div>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button className="btn-pixel" onClick={onCreate}>+ NEW MAP</button>
          <button className="btn-ghost" onClick={() => tmxInputRef.current?.click()}>↑ IMPORT .TMX</button>
        </div>
      </div>
    </div>
  )
}

// ── HomePage ──────────────────────────────────────────────────────────────────

export default function HomePage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  // Project level
  const [projectId,   setProjectId]   = useState(null)
  const [projectName, setProjectName] = useState(null)
  const [maps,        setMaps]        = useState([])

  // Active map
  const [activeMapId, setActiveMapId] = useState(null)
  const [mapConfig,   setMapConfig]   = useState(null)  // {name,tileW,tileH,mapW,mapH,doubleWidth}
  const [mapTiles,    setMapTiles]    = useState(null)
  const [tileset,     setTileset]     = useState(null)

  // Editor state
  const [selectedTile, setSelectedTile] = useState(null)
  const [activeTool,   setActiveTool]   = useState('stamp')
  const [zoom,         setZoom]         = useState(1)
  const [saveStatus,   setSaveStatus]   = useState(null)
  const [canUndo,      setCanUndo]      = useState(false)

  // Sprites
  const [sprites,            setSprites]            = useState([])
  const [selectedSpriteId,   setSelectedSpriteId]   = useState(null)
  const [showNewSpriteModal, setShowNewSpriteModal] = useState(false)

  // Modals
  const [showNewProjectModal, setShowNewProjectModal] = useState(false)
  const [showLoadModal,       setShowLoadModal]       = useState(false)
  const [showNewMapModal,     setShowNewMapModal]     = useState(false)

  // Refs
  const projectIdRef_   = useRef(null)
  const activeMapIdRef_ = useRef(null)
  const mapConfigRef_   = useRef(null)
  const tilesetRef_     = useRef(null)
  const mapTilesRef_    = useRef(null)
  const autoSaveTimer   = useRef(null)
  const historyRef      = useRef([])
  const tmxInputRef     = useRef(null)

  useEffect(() => { projectIdRef_.current   = projectId   }, [projectId])
  useEffect(() => { activeMapIdRef_.current = activeMapId }, [activeMapId])
  useEffect(() => { mapConfigRef_.current   = mapConfig   }, [mapConfig])
  useEffect(() => { tilesetRef_.current     = tileset     }, [tileset])
  useEffect(() => { mapTilesRef_.current    = mapTiles    }, [mapTiles])

  // Load sprites when project changes
  useEffect(() => {
    if (!projectId) { setSprites([]); return }
    listSprites(user.uid, projectId).then(setSprites).catch(console.error)
  }, [projectId, user.uid])

  const pushHistory = useCallback(() => {
    if (!mapTilesRef_.current) return
    historyRef.current.push(mapTilesRef_.current)
    setCanUndo(true)
  }, [])

  const handleUndo = useCallback(() => {
    const prev = historyRef.current.pop()
    if (!prev) return
    setMapTiles(prev)
    setCanUndo(historyRef.current.length > 0)
  }, [])

  const ZOOM_LEVELS = [0.25, 0.5, 1, 2, 4, 8]
  const zoomIn  = () => setZoom(z => { const i = ZOOM_LEVELS.indexOf(z); return i < ZOOM_LEVELS.length - 1 ? ZOOM_LEVELS[i + 1] : z })
  const zoomOut = () => setZoom(z => { const i = ZOOM_LEVELS.indexOf(z); return i > 0 ? ZOOM_LEVELS[i - 1] : z })

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT') return
      if (e.key === 's' || e.key === 'S') setActiveTool('stamp')
      if (e.key === 'f' || e.key === 'F') setActiveTool('fill')
      if (e.key === 'e' || e.key === 'E') setActiveTool('eraser')
      if (e.key === 'd' || e.key === 'D') setMapConfig(c => c ? { ...c, doubleWidth: !c.doubleWidth } : c)
      if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleUndo() }
      if ((e.key === '+' || e.key === '=') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); zoomIn() }
      if (e.key === '-' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); zoomOut() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleUndo])

  const handleLogout = async () => { await logout(); navigate('/login') }

  // ── Sprite handlers ────────────────────────────────────────────────────────

  const handleNewSprite = async ({ name, videoMode, width, height }) => {
    setShowNewSpriteModal(false)
    setSaveStatus('saving')
    try {
      const sid = await createSprite(user.uid, projectId, { name, videoMode, width, height })
      setSprites(prev => [...prev, { id: sid, name, videoMode, width, height }])
      setSelectedSpriteId(sid)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus(null), 2000)
    } catch (err) {
      console.error('Failed to create sprite:', err)
      setSaveStatus('error')
      setTimeout(() => setSaveStatus(null), 4000)
    }
  }

  const handleSelectSprite = (spriteId) => {
    setSelectedSpriteId(spriteId)
  }

  const handleDeleteSprite = async (spriteId) => {
    if (!confirm('Delete this sprite? Cannot be undone.')) return
    try {
      await deleteSprite(user.uid, projectId, spriteId)
      setSprites(prev => prev.filter(s => s.id !== spriteId))
      if (selectedSpriteId === spriteId) setSelectedSpriteId(null)
    } catch (err) {
      console.error('Delete sprite failed:', err)
    }
  }

  // ── Auto-save ──────────────────────────────────────────────────────────────

  const scheduleAutoSave = useCallback((tiles) => {
    const pid = projectIdRef_.current
    const mid = activeMapIdRef_.current
    if (!pid || !mid) return
    clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(async () => {
      const cfg = mapConfigRef_.current
      const ts  = tilesetRef_.current
      if (!cfg || !tiles) return
      setSaveStatus('saving')
      try {
        await saveMap(user.uid, pid, mid, {
          name:    cfg.name,
          config:  cfg,
          mapTiles: tiles,
          tileset: ts,
        })
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus(null), 2000)
      } catch (_) {
        setSaveStatus('error')
      }
    }, 2000)
  }, [user.uid])

  // ── Activate a map (load its data) ────────────────────────────────────────

  const activateMap = useCallback(async (pid, mapId) => {
    try {
      const data = await loadMap(user.uid, pid, mapId)
      if (!data) return
      historyRef.current = []
      setCanUndo(false)
      setActiveMapId(data.id)
      setMapConfig({ ...data.config, name: data.name })
      setTileset(data.tileset)
      setSelectedTile(null)
      setMapTiles(data.mapTiles)
    } catch (err) {
      console.error('Failed to load map:', err)
      setSaveStatus('error')
      setTimeout(() => setSaveStatus(null), 4000)
    }
  }, [user.uid])

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleAction = useCallback(async (group, item, payload) => {
    if (group === 'sprites' && item === 'new') { if (projectId) setShowNewSpriteModal(true); return }
    if (group === 'project' && item === 'new')  { setShowNewProjectModal(true); return }
    if (group === 'project' && item === 'load') { setShowLoadModal(true); return }

    if (group === 'maps' && item === 'new') {
      if (!projectId) return
      setShowNewMapModal(true)
      return
    }

    if (group === 'maps' && item === 'import-tmx') {
      if (!projectId || !payload) return
      const text   = await payload.text()
      const parsed = parseTMX(text)
      if (!parsed) { alert('Could not parse TMX file.'); return }
      const { mapW, mapH, tileW, tileH, mapTiles: importedTiles } = parsed
      const mapName = payload.name.replace(/\.tmx$/i, '')
      setSaveStatus('saving')
      try {
        const mid = await createMap(user.uid, projectId, { name: mapName, tileW, tileH, mapW, mapH })
        const newMap = { id: mid, name: mapName, tileW, tileH, mapW, mapH }
        setMaps(ms => [...ms, newMap])
        // activate and immediately save with tile data
        setActiveMapId(mid)
        setMapConfig({ name: mapName, tileW, tileH, mapW, mapH, doubleWidth: false })
        setTileset(null)
        setSelectedTile(null)
        setMapTiles(importedTiles)
        historyRef.current = []
        setCanUndo(false)
        await saveMap(user.uid, projectId, mid, {
          name:    mapName,
          config:  { tileW, tileH, mapW, mapH, doubleWidth: false },
          mapTiles: importedTiles,
          tileset: null,
        })
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus(null), 2000)
      } catch (_) {
        setSaveStatus('error')
      }
      return
    }

    if (group === 'export' && item === 'tmx') {
      if (!mapConfig || !mapTilesRef_.current) return
      const xml = buildTMX(mapConfig, mapTilesRef_.current, tilesetRef_.current)
      downloadText(`${mapConfig.name || 'map'}.tmx`, xml)
      return
    }

    if (group === 'export' && item === 'tileset-png') {
      const ts = tilesetRef_.current
      if (!ts) return
      const url = ts.canvas ? ts.canvas.toDataURL('image/png') : ts.url
      const a = document.createElement('a')
      a.href = url
      a.download = 'tileset.png'
      a.click()
      return
    }
  }, [projectId, mapConfig, user.uid])

  // ── New project ────────────────────────────────────────────────────────────

  const handleNewProject = async ({ name }) => {
    setShowNewProjectModal(false)
    clearTimeout(autoSaveTimer.current)
    setSaveStatus('saving')
    try {
      const pid = await createProject(user.uid, { name })
      setProjectId(pid)
      setProjectName(name)
      setMaps([])
      setActiveMapId(null)
      setMapConfig(null)
      setMapTiles(null)
      setTileset(null)
      setSelectedTile(null)
      historyRef.current = []
      setCanUndo(false)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus(null), 2000)
    } catch (err) {
      console.error('Failed to create project:', err)
      setSaveStatus('error')
      setTimeout(() => setSaveStatus(null), 4000)
    }
  }

  // ── Load project ───────────────────────────────────────────────────────────

  const handleLoadProject = async (pid) => {
    setShowLoadModal(false)
    setSaveStatus('saving')
    try {
      const proj = await loadProject(user.uid, pid)
      if (!proj) return
      const mapList = await listMaps(user.uid, pid)

      setProjectId(pid)
      setProjectName(proj.name)
      setMaps(mapList)
      setActiveMapId(null)
      setMapConfig(null)
      setMapTiles(null)
      setTileset(null)
      setSelectedTile(null)
      historyRef.current = []
      setCanUndo(false)

      // Auto-activate the first map if any
      if (mapList.length > 0) {
        await activateMap(pid, mapList[0].id)
      } else {
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus(null), 2000)
      }
    } catch (err) {
      console.error('Failed to load project:', err)
      setSaveStatus('error')
      setTimeout(() => setSaveStatus(null), 4000)
    }
  }

  // ── New map ────────────────────────────────────────────────────────────────

  const handleNewMap = async (config) => {
    setShowNewMapModal(false)
    if (!projectId) return
    setSaveStatus('saving')
    try {
      const mid = await createMap(user.uid, projectId, config)
      const newMap = { id: mid, name: config.name, tileW: config.tileW, tileH: config.tileH, mapW: config.mapW, mapH: config.mapH }
      setMaps(ms => [...ms, newMap])
      // Directly activate without a Firestore round-trip (avoids null-return race)
      const emptyTiles = Array.from({ length: config.mapH }, () => Array(config.mapW).fill(null))
      historyRef.current = []
      setCanUndo(false)
      setActiveMapId(mid)
      setMapConfig({ ...config })
      setTileset(null)
      setSelectedTile(null)
      setMapTiles(emptyTiles)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus(null), 2000)
    } catch (_) {
      setSaveStatus('error')
    }
  }

  // ── Select map ────────────────────────────────────────────────────────────

  const handleSelectMap = useCallback(async (mapId) => {
    setSelectedSpriteId(null)  // switch to map view
    if (mapId === activeMapId) return
    if (projectId) await activateMap(projectId, mapId)
  }, [activeMapId, projectId, activateMap])

  // ── Delete map ────────────────────────────────────────────────────────────

  const handleDeleteMap = useCallback(async (mapId) => {
    if (!projectId) return
    if (!confirm('Delete this map? This cannot be undone.')) return
    try {
      await deleteMap(user.uid, projectId, mapId)
      const remaining = maps.filter(m => m.id !== mapId)
      setMaps(remaining)
      if (mapId === activeMapId) {
        // Load another map or clear editor
        if (remaining.length > 0) {
          await activateMap(projectId, remaining[0].id)
        } else {
          setActiveMapId(null)
          setMapConfig(null)
          setMapTiles(null)
          setTileset(null)
          setSelectedTile(null)
          historyRef.current = []
          setCanUndo(false)
        }
      }
    } catch (_) {
      setSaveStatus('error')
    }
  }, [projectId, activeMapId, maps, user.uid, activateMap])

  // ── Tileset ────────────────────────────────────────────────────────────────

  const handleLoadTileset = useCallback(async (ts) => {
    setTileset(ts)
    const pid = projectIdRef_.current
    const mid = activeMapIdRef_.current
    const cfg = mapConfigRef_.current
    if (!pid || !mid || !cfg) return
    setSaveStatus('saving')
    try {
      await saveMap(user.uid, pid, mid, {
        name:           cfg.name,
        config:         cfg,
        mapTiles:       mapTilesRef_.current,
        tileset:        ts,
        tilesetBlobUrl: ts.url,
      })
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus(null), 2000)
    } catch (_) {
      setSaveStatus('error')
    }
  }, [user.uid])

  const handleEditTile = useCallback((canvas) => {
    const url = canvas.toDataURL()
    setTileset(ts => ts ? { ...ts, url } : ts)
    const pid = projectIdRef_.current
    const mid = activeMapIdRef_.current
    if (!pid || !mid) return
    clearTimeout(autoSaveTimer.current)
    setSaveStatus('saving')
    autoSaveTimer.current = setTimeout(async () => {
      const cfg = mapConfigRef_.current
      const ts  = tilesetRef_.current
      if (!cfg || !ts) return
      try {
        await saveMap(user.uid, pid, mid, {
          name:           cfg.name,
          config:         cfg,
          mapTiles:       mapTilesRef_.current,
          tileset:        ts,
          tilesetBlobUrl: ts.canvas ? ts.canvas.toDataURL() : ts.url,
        })
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus(null), 2000)
      } catch (_) {
        setSaveStatus('error')
      }
    }, 2000)
  }, [user.uid])

  // ── Paint ──────────────────────────────────────────────────────────────────

  const handlePaintCell = useCallback((col, row, tile) => {
    const current = mapTilesRef_.current
    if (!current) return
    const existing = current[row][col]
    if (tile === null ? existing === null : existing?.idx === tile.idx) return
    pushHistory()
    const next = current.map(r => [...r])
    next[row][col] = tile
    setMapTiles(next)
    scheduleAutoSave(next)
  }, [pushHistory, scheduleAutoSave])

  const handleFillCells = useCallback((cells, tile) => {
    if (!cells.length || !mapTilesRef_.current) return
    pushHistory()
    const next = mapTilesRef_.current.map(r => [...r])
    for (const { col, row } of cells) next[row][col] = tile
    setMapTiles(next)
    scheduleAutoSave(next)
  }, [pushHistory, scheduleAutoSave])

  // ── Render ─────────────────────────────────────────────────────────────────

  const hasProject = !!projectId
  const hasMap     = !!mapConfig

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <div className="tile-bg" />

      {/* Top bar */}
      <header style={{
        position: 'relative', zIndex: 100,
        display: 'flex', alignItems: 'stretch',
        borderBottom: '1px solid var(--border)',
        background: 'var(--panel)', flexShrink: 0,
        height: '48px',
      }}>
        {/* Logo */}
        <div style={{
          display: 'flex', alignItems: 'center',
          padding: '0 20px 0 24px',
          borderRight: '1px solid var(--border)',
          fontFamily: "'Press Start 2P', monospace", fontSize: '11px',
          color: 'var(--green)', letterSpacing: '2px', flexShrink: 0,
        }}>
          WEB<span style={{ color: 'var(--amber)' }}>TILE</span>
        </div>

        {/* Dropdown nav */}
        <TopNav
          projectName={projectName}
          maps={maps}
          activeMapId={activeMapId}
          onAction={handleAction}
          onSelectMap={handleSelectMap}
          onDeleteMap={handleDeleteMap}
          tmxInputRef={tmxInputRef}
          sprites={sprites}
          selectedSpriteId={selectedSpriteId}
          onSelectSprite={handleSelectSprite}
          onDeleteSprite={handleDeleteSprite}
        />

        {/* Centre breadcrumb */}
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center',
          padding: '0 20px', gap: '10px', overflow: 'hidden',
        }}>
          {mapConfig && !selectedSpriteId && (
            <>
              <span style={{ fontFamily: "'VT323', monospace", fontSize: '16px', color: 'var(--text-dim)', letterSpacing: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {mapConfig.name}
              </span>
              <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '6px', color: 'var(--border)', flexShrink: 0 }}>
                {mapConfig.mapW}×{mapConfig.mapH} / {mapConfig.tileW}×{mapConfig.tileH}px
              </span>
            </>
          )}
          {saveStatus && (
            <span style={{
              fontSize: '6px', letterSpacing: '1px', flexShrink: 0,
              color: saveStatus === 'error' ? 'var(--red)' : saveStatus === 'saving' ? 'var(--text-dim)' : 'var(--green)',
              fontFamily: "'Press Start 2P', monospace",
            }}>
              {saveStatus === 'saving' ? '· SAVING…' : saveStatus === 'saved' ? '· SAVED' : '· SAVE ERROR'}
            </span>
          )}
        </div>

        {/* Right: user + logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '0 20px', borderLeft: '1px solid var(--border)', flexShrink: 0 }}>
          <span style={{ fontFamily: "'VT323', monospace", fontSize: '16px', color: 'var(--text-dim)', letterSpacing: '2px', whiteSpace: 'nowrap' }}>
            {user.displayName || user.email}
          </span>
          <button className="btn-ghost" onClick={handleLogout} style={{ fontSize: '14px' }}>LOG OUT</button>
        </div>
      </header>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {hasMap && !selectedSpriteId && (
            <Toolbar
              activeTool={activeTool} onSelectTool={setActiveTool}
              zoom={zoom} onZoomIn={zoomIn} onZoomOut={zoomOut}
              canUndo={canUndo} onUndo={handleUndo}
              doubleWidth={mapConfig.doubleWidth}
              onToggleDoubleWidth={() => setMapConfig(c => c ? { ...c, doubleWidth: !c.doubleWidth } : c)}
            />
          )}
          {!hasProject
            ? <EmptyWorkspace />
            : selectedSpriteId
              ? <SpriteEditor
                  userId={user.uid}
                  projectId={projectId}
                  spriteId={selectedSpriteId}
                  setSaveStatus={setSaveStatus}
                  onDeleted={() => setSelectedSpriteId(null)}
                />
              : !hasMap
                ? <NoMaps onCreate={() => setShowNewMapModal(true)} onImport={() => tmxInputRef.current?.click()} tmxInputRef={tmxInputRef} />
                : <TilemapGrid
                    {...mapConfig}
                    activeTool={activeTool}
                    zoom={zoom} onZoomChange={setZoom}
                    tileset={tileset} selectedTile={selectedTile}
                    mapTiles={mapTiles} onPaintCell={handlePaintCell} onFillCells={handleFillCells}
                  />
          }
        </div>

        {!selectedSpriteId && (
          <RightSidebar
            project={mapConfig}
            mapTiles={mapTiles}
            tileset={tileset}
            selectedTile={selectedTile}
            onLoadTileset={handleLoadTileset}
            onSelectTile={setSelectedTile}
            onEditTile={handleEditTile}
          />
        )}
      </div>

      {showNewProjectModal && (
        <NewProjectModal
          onConfirm={handleNewProject}
          onCancel={() => setShowNewProjectModal(false)}
        />
      )}
      {showLoadModal && (
        <LoadProjectModal
          userId={user.uid}
          onLoad={handleLoadProject}
          onCancel={() => setShowLoadModal(false)}
        />
      )}
      {showNewMapModal && (
        <NewMapModal
          onConfirm={handleNewMap}
          onCancel={() => setShowNewMapModal(false)}
        />
      )}
      {showNewSpriteModal && (
        <NewSpriteModal
          onConfirm={handleNewSprite}
          onCancel={() => setShowNewSpriteModal(false)}
        />
      )}
    </div>
  )
}
