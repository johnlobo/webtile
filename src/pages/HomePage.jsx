import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import NewProjectModal from '../components/NewProjectModal'
import LoadProjectModal from '../components/LoadProjectModal'
import NewMapModal from '../components/NewMapModal'
import TilemapGrid from '../components/TilemapGrid'
import RightSidebar from '../components/RightSidebar'
import Toolbar from '../components/Toolbar'
import {
  createProject, loadProject, listMaps,
  createMap, saveMap, loadMap, deleteMap,
} from '../services/projectService'

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

// ── Sidebar ───────────────────────────────────────────────────────────────────

function SidebarSection({ id, label, icon, open, onToggle, children }) {
  return (
    <div>
      <button
        onClick={() => onToggle(id)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
          padding: '10px 16px', background: 'transparent', border: 'none',
          cursor: 'pointer', fontFamily: "'Press Start 2P', monospace",
          fontSize: '8px', color: 'var(--green)', letterSpacing: '1px',
          textAlign: 'left', transition: 'background 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--green-glow)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <span style={{ fontSize: '12px', lineHeight: 1 }}>{icon}</span>
        <span style={{ flex: 1 }}>{label}</span>
        <span style={{
          fontSize: '10px', color: 'var(--text-dim)',
          transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s', display: 'inline-block',
        }}>▶</span>
      </button>
      {open && (
        <div style={{ borderLeft: '2px solid var(--green-dim)', marginLeft: '24px' }}>
          {children}
        </div>
      )}
    </div>
  )
}

function SidebarBtn({ label, icon, onClick, dimmed, color }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
        padding: '9px 16px', background: 'transparent', border: 'none',
        cursor: onClick ? 'pointer' : 'default',
        fontFamily: "'VT323', monospace",
        fontSize: '18px',
        color: dimmed ? 'var(--text-dim)' : (color || 'var(--text-dim)'),
        letterSpacing: '2px', textAlign: 'left',
        transition: 'color 0.15s, background 0.15s',
        opacity: dimmed ? 0.5 : 1,
      }}
      onMouseEnter={e => {
        if (!onClick) return
        e.currentTarget.style.color = color || 'var(--green)'
        e.currentTarget.style.background = 'var(--green-glow)'
      }}
      onMouseLeave={e => {
        if (!onClick) return
        e.currentTarget.style.color = dimmed ? 'var(--text-dim)' : (color || 'var(--text-dim)')
        e.currentTarget.style.background = 'transparent'
      }}
    >
      {icon && <span style={{ fontSize: '10px', color: 'var(--green-dim)', flexShrink: 0 }}>{icon}</span>}
      {label}
    </button>
  )
}

function Sidebar({ projectName, maps, activeMapId, onAction, onSelectMap, onDeleteMap, tmxInputRef }) {
  const [open, setOpen] = useState({ project: true, maps: true, sprites: false })
  const toggle = id => setOpen(prev => ({ ...prev, [id]: !prev[id] }))
  const hasProject = !!projectName

  return (
    <aside style={{
      width: '200px', flexShrink: 0,
      background: 'var(--panel)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      position: 'relative', zIndex: 1,
    }}>
      <div style={{
        padding: '14px 16px 10px',
        fontFamily: "'Press Start 2P', monospace",
        fontSize: '7px', color: 'var(--text-dim)',
        letterSpacing: '2px', borderBottom: '1px solid var(--border)',
      }}>
        MENU
      </div>

      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>

        {/* PROJECT */}
        <SidebarSection id="project" label="PROJECT" icon="▤" open={open.project} onToggle={toggle}>
          {hasProject && (
            <div style={{
              padding: '6px 16px 8px',
              fontFamily: "'VT323', monospace", fontSize: '16px',
              color: 'var(--amber)', letterSpacing: '1px',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {projectName}
            </div>
          )}
          <SidebarBtn label="NEW"  icon="✦" onClick={() => onAction('project', 'new')} />
          <SidebarBtn label="LOAD" icon="▶" onClick={() => onAction('project', 'load')} />

          <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />

          {/* MAPS (nested) */}
          <SidebarSection id="maps" label="MAPS" icon="⊞" open={open.maps} onToggle={toggle}>
            {!hasProject && (
              <div style={{ padding: '6px 16px', fontFamily: "'VT323', monospace", fontSize: '14px', color: 'var(--text-dim)', letterSpacing: '1px', opacity: 0.5 }}>
                No project loaded
              </div>
            )}
            {hasProject && maps.length === 0 && (
              <div style={{ padding: '6px 16px', fontFamily: "'VT323', monospace", fontSize: '14px', color: 'var(--text-dim)', letterSpacing: '1px', opacity: 0.5 }}>
                No maps yet
              </div>
            )}
            {hasProject && maps.map(m => (
              <MapItem
                key={m.id}
                map={m}
                active={m.id === activeMapId}
                onClick={() => onSelectMap(m.id)}
                onDelete={() => onDeleteMap(m.id)}
              />
            ))}
            {hasProject && (
              <>
                <SidebarBtn label="+ NEW MAP"    icon="✦" onClick={() => onAction('maps', 'new')} />
                <SidebarBtn label="IMPORT .TMX"  icon="↑" onClick={() => tmxInputRef.current?.click()} />
                {/* hidden TMX file input */}
                <input
                  ref={tmxInputRef}
                  type="file"
                  accept=".tmx"
                  style={{ display: 'none' }}
                  onChange={e => { onAction('maps', 'import-tmx', e.target.files[0]); e.target.value = '' }}
                />
                <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />
                <SidebarBtn label="EXPORT .TMX"     icon="⬇" onClick={() => onAction('export', 'tmx')} />
                <SidebarBtn label="EXPORT TILESET"  icon="⬇" onClick={() => onAction('export', 'tileset-png')} />
              </>
            )}
          </SidebarSection>

          <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />

          {/* SPRITES (nested) */}
          <SidebarSection id="sprites" label="SPRITES" icon="◈" open={open.sprites} onToggle={toggle}>
            <div style={{ padding: '8px 16px' }}>
              <div style={{ fontFamily: "'VT323', monospace", fontSize: '14px', color: 'var(--text-dim)', letterSpacing: '1px', opacity: 0.45, lineHeight: 1.6 }}>
                COMING SOON
              </div>
              <div style={{ fontFamily: "'VT323', monospace", fontSize: '13px', color: 'var(--text-dim)', opacity: 0.3, letterSpacing: '1px' }}>
                Create, import &amp;<br />export sprites
              </div>
            </div>
          </SidebarSection>

        </SidebarSection>

      </nav>
    </aside>
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
    setSaveStatus('saving')
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
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus(null), 2000)
    } catch (_) {
      setSaveStatus('error')
    }
  }, [user.uid])

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleAction = useCallback(async (group, item, payload) => {
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
    } catch (_) {
      setSaveStatus('error')
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
    } catch (_) {
      setSaveStatus('error')
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
        position: 'relative', zIndex: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 24px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--panel)', flexShrink: 0,
      }}>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '13px', color: 'var(--green)', letterSpacing: '2px' }}>
          WEB<span style={{ color: 'var(--amber)' }}>TILE</span>
          {projectName && (
            <span style={{ fontSize: '8px', color: 'var(--amber)', marginLeft: '20px', letterSpacing: '1px' }}>
              {projectName}
            </span>
          )}
          {mapConfig && (
            <span style={{ fontSize: '7px', color: 'var(--text-dim)', marginLeft: '12px', letterSpacing: '1px' }}>
              {mapConfig.name}
              <span style={{ marginLeft: '10px', color: 'var(--text-dim)', opacity: 0.6 }}>
                {mapConfig.mapW}×{mapConfig.mapH} / {mapConfig.tileW}×{mapConfig.tileH}px
              </span>
            </span>
          )}
          {saveStatus && (
            <span style={{
              marginLeft: '18px', fontSize: '6px', letterSpacing: '1px',
              color: saveStatus === 'error' ? 'var(--red, #ff3c3c)' : saveStatus === 'saving' ? 'var(--text-dim)' : 'var(--green)',
              fontFamily: "'Press Start 2P', monospace",
            }}>
              {saveStatus === 'saving' ? '· SAVING…' : saveStatus === 'saved' ? '· SAVED' : '· SAVE ERROR'}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          <span style={{ fontFamily: "'VT323', monospace", fontSize: '17px', color: 'var(--text-dim)', letterSpacing: '2px' }}>
            {user.displayName || user.email}
          </span>
          <button className="btn-ghost" onClick={handleLogout}>LOG OUT</button>
        </div>
      </header>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Sidebar
          projectName={projectName}
          maps={maps}
          activeMapId={activeMapId}
          onAction={handleAction}
          onSelectMap={handleSelectMap}
          onDeleteMap={handleDeleteMap}
          tmxInputRef={tmxInputRef}
        />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {hasMap && (
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

        <RightSidebar
          project={mapConfig}
          mapTiles={mapTiles}
          tileset={tileset}
          selectedTile={selectedTile}
          onLoadTileset={handleLoadTileset}
          onSelectTile={setSelectedTile}
          onEditTile={handleEditTile}
        />
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
    </div>
  )
}
