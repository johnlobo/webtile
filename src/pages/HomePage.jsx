import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import NewProjectModal from '../components/NewProjectModal'
import LoadProjectModal from '../components/LoadProjectModal'
import NewMapModal from '../components/NewMapModal'
import TilemapGrid from '../components/TilemapGrid'
import RightSidebar from '../components/RightSidebar'
import MapDataSection from '../components/MapDataSection'
import Toolbar from '../components/Toolbar'
import SpriteEditor from '../components/SpriteEditor'
import NewSpriteModal from '../components/NewSpriteModal'
import ImportSpriteModal from '../components/ImportSpriteModal'
import ConfirmDialog from '../components/ConfirmDialog'
import PixelHeading from '../components/PixelHeading'
import {
  createProject, loadProject, listMaps,
  createMap, saveMap, loadMap, deleteMap,
} from '../services/projectService'
import { loadPages, addPage, assignRoomToPage, removeRoomFromPage, renamePage, deletePage, savePageTileset, loadPageTileset } from '../services/pageService'
import { createSprite, createSpriteFromImport, listSprites, deleteSprite } from '../services/spriteService'
import { exportProjectPackage, importProjectPackage } from '../services/packageService'
import { generateModel01Manifest } from '../services/manifestService'
import { GENERIC_PROFILE_ID, MODEL01_PROFILE_ID, getProjectProfile } from '../model01Profile'

const ENTITY_DEFAULT_PROPERTIES = {
  enemy:   { speed: 1, behavior: 'patrol', health: 1 },
  object:  { collectible: true, respawn: false },
  portal:  { targetRoomId: null, targetEntry: 0 },
  trigger: { event: 'none', once: true },
}

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
      const rawIds = dataEl.textContent.trim().split(',').map(s => s.trim()).filter(s => s !== '').map(s => parseInt(s))
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
          background: isOpen ? 'rgba(33,82,255,0.07)' : 'transparent',
          border: 'none', borderBottom: isOpen ? '2px solid var(--accent)' : '2px solid transparent',
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontFamily: "'Roboto', sans-serif",
          fontSize: '11px', fontWeight: 600, letterSpacing: '0.6px',
          color: disabled ? 'var(--text-dim)' : isOpen ? 'var(--accent)' : 'var(--text)',
          opacity: disabled ? 0.4 : 1,
          transition: 'color 0.15s, background 0.15s, border-color 0.15s',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={e => { if (!disabled && !isOpen) { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.background = 'rgba(33,82,255,0.04)' }}}
        onMouseLeave={e => { if (!disabled && !isOpen) { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'transparent' }}}
      >
        {label}
        <span style={{
          fontSize: '9px', color: disabled ? 'var(--text-dim)' : 'var(--text-dim)',
          transform: isOpen ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.18s', display: 'inline-block', marginTop: '1px',
        }}>▼</span>
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute', top: '100%', left: 0,
          minWidth: '210px', zIndex: 200,
          background: 'var(--panel)',
          borderRadius: '0 0 10px 10px',
          boxShadow: '0 8px 28px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)',
        }}>
          {children}
        </div>
      )}
    </div>
  )
}

function NavItem({ label, icon, onClick, accent, disabled }) {
  const baseColor = disabled ? 'var(--text-dim)' : accent === 'amber' ? 'var(--amber)' : accent === 'red' ? 'var(--red)' : 'var(--text)'
  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
        padding: '9px 16px', background: 'transparent', border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer', textAlign: 'left',
        fontFamily: "'Roboto', sans-serif", fontSize: '13px', fontWeight: 500, letterSpacing: '0.2px',
        color: baseColor, opacity: disabled ? 0.4 : 1,
        transition: 'color 0.12s, background 0.12s',
      }}
      onMouseEnter={e => { if (disabled) return; e.currentTarget.style.background = accent === 'red' ? 'rgba(234,6,6,0.06)' : 'rgba(33,82,255,0.05)'; e.currentTarget.style.color = accent === 'amber' ? 'var(--amber)' : accent === 'red' ? 'var(--red)' : 'var(--accent)' }}
      onMouseLeave={e => { if (disabled) return; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = baseColor }}
    >
      {icon && <span style={{ fontSize: '10px', color: disabled ? 'var(--text-dim)' : 'var(--accent)', flexShrink: 0, lineHeight: 1, opacity: 0.7 }}>{icon}</span>}
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
        background: active ? 'rgba(33,82,255,0.07)' : hovered ? 'rgba(33,82,255,0.04)' : 'transparent',
        borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
        marginLeft: '-1px', cursor: 'pointer',
      }}
    >
      <span style={{
        fontFamily: "'Roboto', sans-serif", fontSize: '13px', fontWeight: active ? 600 : 400,
        color: active ? 'var(--accent)' : 'var(--text)', flex: 1,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{map.name}</span>
      {(hovered || active) && (
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          style={{
            flexShrink: 0, padding: '2px 6px', background: 'transparent',
            border: '1px solid transparent', color: 'var(--text-dim)', cursor: 'pointer',
            fontFamily: "'Roboto', sans-serif", fontSize: '10px', fontWeight: 600,
            transition: 'border-color 0.12s, color 0.12s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--red)'; e.currentTarget.style.color = 'var(--red)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.color = 'var(--text-dim)' }}
        >DEL</button>
      )}
    </div>
  )
}

const iconBtnStyle = {
  padding: '2px 6px', background: 'transparent',
  border: '1px solid transparent', color: 'var(--text-dim)', cursor: 'pointer',
  fontFamily: "'Roboto', sans-serif", fontSize: '10px', fontWeight: 600,
  transition: 'border-color 0.12s, color 0.12s',
}

function TopNav({ projectName, packageInputRef, manifestInputRef, maps, activeMapId, hasTileset, onAction, onSelectMap, onDeleteMap, tmxInputRef, spritePngInputRef, sprites, selectedSpriteId, onSelectSprite, onDeleteSprite, onCloseProject, onCloseMap, onCloseSprite, pages, activePageId, onSelectPage, onAddPage, onRenamePage, onDeletePage, onMoveMapToPage, onExportManifest }) {
  const [activeMenu, setActiveMenu] = useState(null)
  const hasProject = !!projectName
  const hasActiveMap = !!activeMapId
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
        <div style={{ padding: '10px 16px 6px', fontFamily: "'Roboto', sans-serif", fontSize: '10px', fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.6px', textTransform: 'uppercase' }}>Project</div>
        {projectName && (
          <div style={{ padding: '2px 16px 8px', fontFamily: "'Roboto', sans-serif", fontSize: '13px', fontWeight: 600, color: 'var(--accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {projectName}
          </div>
        )}
        <NavSep />
        <NavItem label="NEW PROJECT"  icon="✦" onClick={() => { onAction('project', 'new');  close() }} />
        <NavItem label="LOAD PROJECT" icon="▶" onClick={() => { onAction('project', 'load'); close() }} />
        <NavItem label="↑ IMPORT PACKAGE" icon="" onClick={() => { close(); setTimeout(() => packageInputRef.current?.click(), 0) }} />
        <NavItem label="⬇ EXPORT PACKAGE" icon="" disabled={!projectName} onClick={() => { onAction('project', 'export-package'); close() }} />
        {projectName && (
          <>
            <NavSep />
            <NavItem label="EXPORT MANIFEST" icon="📄" onClick={() => { onExportManifest(); close() }} />
            <NavItem label="CLOSE PROJECT" icon="✕" accent="red" onClick={() => { onCloseProject(); close() }} />
          </>
        )}
      </NavDropdown>

      {/* PAGES */}
      <NavDropdown label="PAGES" open={activeMenu === 'pages'} disabled={!projectName} onToggle={() => toggle('pages')}>
        <div style={{ padding: '10px 16px 4px', fontFamily: "'Roboto', sans-serif", fontSize: '10px', fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.6px', textTransform: 'uppercase' }}>Pages</div>
        {pages.length === 0 && (
          <div style={{ padding: '4px 16px 8px', fontFamily: "'Roboto', sans-serif", fontSize: '13px', color: 'var(--text-dim)', opacity: 0.6 }}>No pages</div>
        )}
        {pages.map(p => (
          <div
            key={p.id}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '7px 12px 7px 16px',
              background: p.id === activePageId ? 'rgba(33,82,255,0.07)' : 'transparent',
              borderLeft: p.id === activePageId ? '2px solid var(--accent)' : '2px solid transparent',
              marginLeft: '-1px', cursor: 'pointer',
            }}
          >
            <button
              onClick={() => { onSelectPage(p.id); close() }}
              style={{
                flex: 1, background: 'transparent', border: 'none', color: p.id === activePageId ? 'var(--accent)' : 'var(--text)',
                fontSize: '13px', fontWeight: p.id === activePageId ? 600 : 400, cursor: 'pointer', textAlign: 'left',
                fontFamily: "'Roboto', sans-serif",
              }}
            >
              {p.label} <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>({(maps.filter(m => m.pageId === p.id)).length})</span>
            </button>
            <button onClick={() => { onRenamePage(p.id); }} style={{ ...iconBtnStyle, fontSize: '10px' }} title="Rename">✎</button>
            {pages.length > 1 && (
              <button onClick={() => { onDeletePage(p.id); }} style={{ ...iconBtnStyle, color: 'var(--red)' }} title="Delete">✕</button>
            )}
          </div>
        ))}
        <NavSep />
        <NavItem label="+ NEW PAGE" icon="✦" onClick={() => { onAddPage(); close() }} />
        <NavSep />
        <div style={{ padding: '6px 16px', fontFamily: "'Roboto', sans-serif", fontSize: '10px', fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.6px', textTransform: 'uppercase' }}>Move Map</div>
        {maps.length === 0 && (
          <div style={{ padding: '4px 16px 8px', fontSize: '12px', color: 'var(--text-dim)', opacity: 0.6 }}>No maps yet</div>
        )}
        {maps.map(m => (
          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 12px' }}>
            <span style={{ flex: 1, fontSize: '12px', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
            <select
              value={m.pageId ?? 'base'}
              onChange={e => { onMoveMapToPage(m.id, e.target.value) }}
              style={{ fontSize: '11px', background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', padding: '2px 4px' }}
            >
              {pages.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
        ))}
      </NavDropdown>

      {/* MAPS */}
      <NavDropdown label="MAPS" open={activeMenu === 'maps'} disabled={!hasProject} onToggle={() => toggle('maps')}>
        <div style={{ padding: '10px 16px 4px', fontFamily: "'Roboto', sans-serif", fontSize: '10px', fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.6px', textTransform: 'uppercase' }}>Maps</div>
        {maps.length === 0 && (
          <div style={{ padding: '4px 16px 8px', fontFamily: "'Roboto', sans-serif", fontSize: '13px', color: 'var(--text-dim)', opacity: 0.6 }}>No maps yet</div>
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
        <NavItem label="↑ IMPORT .TMX"  icon="" onClick={() => { close(); setTimeout(() => tmxInputRef.current?.click(), 0) }} />
        <NavSep />
        <NavItem label="⬇ EXPORT .TMX"     icon="" disabled={!hasActiveMap} onClick={() => { onAction('export', 'tmx'); close() }} />
        <NavItem label="⬇ EXPORT TILESET"  icon="" disabled={!hasActiveMap || !hasTileset} onClick={() => { onAction('export', 'tileset-png'); close() }} />
        {activeMapId && (
          <>
            <NavSep />
            <NavItem label="CLOSE MAP" icon="✕" accent="red" onClick={() => { onCloseMap(); close() }} />
          </>
        )}
      </NavDropdown>

      {/* SPRITES */}
      <NavDropdown label="SPRITES" open={activeMenu === 'sprites'} disabled={!hasProject} onToggle={() => toggle('sprites')}>
        <div style={{ padding: '10px 16px 4px', fontFamily: "'Roboto', sans-serif", fontSize: '10px', fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.6px', textTransform: 'uppercase' }}>Sprites</div>
        {sprites.length === 0 && (
          <div style={{ padding: '4px 16px 8px', fontFamily: "'Roboto', sans-serif", fontSize: '13px', color: 'var(--text-dim)', opacity: 0.6 }}>No sprites yet</div>
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
        <NavItem label="+ NEW SPRITE"  icon="✦" onClick={() => { onAction('sprites', 'new'); close() }} />
        <NavItem label="↑ LOAD PNG"   icon="↑" onClick={() => { onAction('sprites', 'import-png'); close() }} />
        {selectedSpriteId && (
          <>
            <NavSep />
            <NavItem label="CLOSE SPRITE" icon="✕" accent="red" onClick={() => { onCloseSprite(); close() }} />
          </>
        )}
      </NavDropdown>

      <input ref={tmxInputRef} type="file" accept=".tmx" style={{ display: 'none' }}
        onChange={e => { onAction('maps', 'import-tmx', e.target.files[0]); e.target.value = '' }} />

      <input ref={packageInputRef} type="file" accept=".json,.webtile.json" style={{ display: 'none' }} onChange={e => { const file = e.target.files?.[0]; if (file) onAction('project', 'import-package', file); e.target.value = '' }} />

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
        background: active ? 'rgba(33,82,255,0.07)' : hovered ? 'rgba(33,82,255,0.04)' : 'transparent',
        borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
        marginLeft: '-2px',
        cursor: 'pointer', transition: 'background 0.15s',
      }}
    >
      <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: '13px', fontWeight: active ? 600 : 400, color: active ? 'var(--accent)' : 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {map.name}
      </span>
      {(hovered || active) && (
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          style={{
            flexShrink: 0, padding: '2px 6px',
            background: 'transparent', border: '1px solid transparent',
            color: 'var(--text-dim)', cursor: 'pointer',
            fontFamily: "'Roboto', sans-serif", fontSize: '10px', fontWeight: 600,
            transition: 'border-color 0.15s, color 0.15s',
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
        background: active ? 'rgba(33,82,255,0.07)' : hovered ? 'rgba(33,82,255,0.04)' : 'transparent',
        borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
        marginLeft: '-2px',
        cursor: 'pointer', transition: 'background 0.15s',
      }}
    >
      <span style={{
        fontFamily: "'Roboto', sans-serif", fontSize: '10px', fontWeight: 700,
        color: active ? 'var(--accent)' : 'var(--text-dim)',
        background: active ? 'rgba(33,82,255,0.1)' : 'var(--bg)',
        border: `1px solid ${active ? 'rgba(33,82,255,0.3)' : 'var(--border)'}`,
        borderRadius: '4px',
        padding: '2px 5px', flexShrink: 0,
      }}>
        {modeLabel}
      </span>
      <span style={{
        fontFamily: "'Roboto', sans-serif", fontSize: '13px', fontWeight: active ? 600 : 400,
        color: active ? 'var(--accent)' : 'var(--text)',
        flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {sprite.name}
      </span>
      {(hovered || active) && (
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          style={{
            flexShrink: 0, padding: '2px 6px',
            background: 'transparent', border: '1px solid transparent',
            color: 'var(--text-dim)', cursor: 'pointer',
            fontFamily: "'Roboto', sans-serif", fontSize: '10px', fontWeight: 600,
            transition: 'border-color 0.15s, color 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--red)'; e.currentTarget.style.color = 'var(--red)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.color = 'var(--text-dim)' }}
        >DEL</button>
      )}
    </div>
  )
}

// ── Empty states ──────────────────────────────────────────────────────────────

function getDefaultProperties(type) {
  return ENTITY_DEFAULT_PROPERTIES[type] ?? {}
}

function EmptyWorkspace() {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
      <div className="pixel-panel fade-up" style={{ padding: '52px 44px', textAlign: 'center', maxWidth: '420px', width: '100%' }}>
        <PixelHeading size={10} letterSpacing="2px" center marginBottom={20} underlineWidth={40}>WEBTILE</PixelHeading>
        <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: '15px', fontWeight: 300, color: 'var(--text-dim)', lineHeight: 1.8 }}>
          Create or load a project<br />from the menu above
        </div>
        <div style={{ marginTop: '28px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', opacity: 0.12 }}>
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} style={{
              paddingBottom: '100%',
              background: i % 3 === 0 ? 'var(--accent)' : i % 3 === 1 ? 'var(--amber)' : 'var(--bg)',
              borderRadius: '4px',
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
        <PixelHeading plain center marginBottom={20} underlineWidth={40}>No Maps Yet</PixelHeading>
        <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: '14px', fontWeight: 300, color: 'var(--text-dim)', lineHeight: 1.8, marginBottom: '28px' }}>
          Add a map to this project<br/>to start editing
        </div>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button className="btn-pixel" onClick={onCreate}>+ New Map</button>
          <button className="btn-ghost" onClick={() => tmxInputRef.current?.click()}>↑ Import .TMX</button>
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
  const [projectProfileId, setProjectProfileId] = useState(GENERIC_PROFILE_ID)
  const [maps,        setMaps]        = useState([])
  const [pages,       setPages]       = useState([])
  const [activePageId, setActivePageId] = useState('base')

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
  const [connections,  setConnections]  = useState({})
  const [entryPositions, setEntryPositions] = useState([])
  const [spawns, setSpawns] = useState([])
  const [entities, setEntities] = useState([])
  const [selectedEntityType, setSelectedEntityType] = useState('enemy')
  const [selectedEntityId, setSelectedEntityId] = useState(null)

  // Sprites
  const [sprites,            setSprites]            = useState([])
  const [selectedSpriteId,   setSelectedSpriteId]   = useState(null)
  const [showNewSpriteModal, setShowNewSpriteModal] = useState(false)
  const [importSpriteFile,   setImportSpriteFile]   = useState(null)
  const spritePngInputRef = useRef(null)

  // Modals
  const [showNewProjectModal, setShowNewProjectModal] = useState(false)
  const [showLoadModal,       setShowLoadModal]       = useState(false)
  const [showNewMapModal,     setShowNewMapModal]     = useState(false)
  const [dialog,              setDialog]              = useState(null) // {title,message,danger,confirmLabel,cancelLabel,isConfirm,resolve}

  // Refs
  const projectIdRef_   = useRef(null)
  const activeMapIdRef_ = useRef(null)
  const activePageIdRef_ = useRef(null)
  const mapConfigRef_   = useRef(null)
  const tilesetRef_     = useRef(null)
  const mapTilesRef_    = useRef(null)
  const connectionsRef_ = useRef(null)
  const entryPositionsRef_ = useRef(null)
  const spawnsRef_      = useRef(null)
  const entitiesRef_    = useRef(null)
  const autoSaveTimer   = useRef(null)
  const historyRef      = useRef([])
  const redoRef         = useRef([])
  const [canRedo, setCanRedo] = useState(false)
  const tmxInputRef     = useRef(null)
  const packageInputRef = useRef(null)

  useEffect(() => { projectIdRef_.current   = projectId   }, [projectId])
  useEffect(() => { activeMapIdRef_.current = activeMapId }, [activeMapId])
  useEffect(() => { activePageIdRef_.current = activePageId }, [activePageId])
  useEffect(() => { mapConfigRef_.current   = mapConfig   }, [mapConfig])
  useEffect(() => { tilesetRef_.current     = tileset     }, [tileset])
  useEffect(() => { mapTilesRef_.current    = mapTiles    }, [mapTiles])
  useEffect(() => { connectionsRef_.current = connections }, [connections])
  useEffect(() => { entryPositionsRef_.current = entryPositions }, [entryPositions])
  useEffect(() => { spawnsRef_.current = spawns }, [spawns])
  useEffect(() => { entitiesRef_.current = entities }, [entities])

  // Load sprites when project changes
  useEffect(() => {
    if (!projectId) { setSprites([]); return }
    listSprites(user.uid, projectId).then(setSprites).catch(console.error)
  }, [projectId, user.uid])

  const captureMapState = useCallback(() => {
    return {
      tiles: mapTilesRef_.current,
      connections: connectionsRef_.current,
      entryPositions: entryPositionsRef_.current,
      spawns: spawnsRef_.current,
      entities: entitiesRef_.current,
    }
  }, [])

  const restoreMapState = useCallback((state) => {
    if (!state) return
    setMapTiles(state.tiles)
    setConnections(state.connections ?? {})
    setEntryPositions(state.entryPositions ?? [])
    setSpawns(state.spawns ?? [])
    setEntities(state.entities ?? [])
  }, [])

  const pushHistory = useCallback(() => {
    const state = captureMapState()
    if (!state.tiles) return
    historyRef.current.push(state)
    if (historyRef.current.length > 50) historyRef.current.shift()
    redoRef.current = []
    setCanUndo(true)
    setCanRedo(false)
  }, [captureMapState])

  const ZOOM_LEVELS = [0.25, 0.5, 1, 2, 4, 8]
  const zoomIn  = () => setZoom(z => { const i = ZOOM_LEVELS.indexOf(z); return i < ZOOM_LEVELS.length - 1 ? ZOOM_LEVELS[i + 1] : z })
  const zoomOut = () => setZoom(z => { const i = ZOOM_LEVELS.indexOf(z); return i > 0 ? ZOOM_LEVELS[i - 1] : z })

  const handleLogout = async () => { await logout(); navigate('/login') }

  const showAlert = useCallback((message, title) => new Promise(resolve => {
    setDialog({ title, message, resolve: () => { setDialog(null); resolve() } })
  }), [])

  const showConfirm = useCallback((message, opts = {}) => new Promise(resolve => {
    setDialog({
      title: opts.title, message, danger: opts.danger,
      confirmLabel: opts.confirmLabel, cancelLabel: opts.cancelLabel,
      isConfirm: true,
      resolve: (v) => { setDialog(null); resolve(v) },
    })
  }), [])

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

  const handleImportSprite = async ({ name, videoMode, width, height, palette, pixels }) => {
    setImportSpriteFile(null)
    setSaveStatus('saving')
    try {
      const sid = await createSpriteFromImport(user.uid, projectId, { name, videoMode, width, height, palette, pixels })
      setSprites(prev => [...prev, { id: sid, name, videoMode, width, height }])
      setSelectedSpriteId(sid)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus(null), 2000)
    } catch (err) {
      console.error('Failed to import sprite:', err)
      setSaveStatus('error')
      setTimeout(() => setSaveStatus(null), 4000)
    }
  }

  const handleSelectSprite = (spriteId) => {
    setSelectedSpriteId(spriteId)
  }

  const handleDeleteSprite = async (spriteId) => {
    if (!await showConfirm('Delete this sprite? Cannot be undone.', { danger: true, confirmLabel: 'Delete', title: 'DELETE SPRITE' })) return
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
      const mt  = tiles ?? mapTilesRef_.current
      if (!cfg || !mt) return
      setSaveStatus('saving')
      try {
        await saveMap(user.uid, pid, mid, {
          name:    cfg.name,
          config:  cfg,
          mapTiles: mt,
          connections,
          entryPositions,
          spawns,
          entities,
        })
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus(null), 2000)
      } catch (_) {
        setSaveStatus('error')
      }
    }, 2000)
  }, [user.uid, connections, entryPositions, spawns, entities])

  // Auto-save on overlay changes
  useEffect(() => {
    if (!projectId || !activeMapId) return
    scheduleAutoSave()
  }, [projectId, activeMapId, connections, entryPositions, spawns, entities, scheduleAutoSave])

  const handleUndo = useCallback(() => {
    const prev = historyRef.current.pop()
    if (!prev) return
    const current = captureMapState()
    redoRef.current.push(current)
    restoreMapState(prev)
    setCanUndo(historyRef.current.length > 0)
    setCanRedo(true)
  }, [captureMapState, restoreMapState])

  const handleRedo = useCallback(() => {
    const next = redoRef.current.pop()
    if (!next) return
    const current = captureMapState()
    historyRef.current.push(current)
    restoreMapState(next)
    setCanUndo(true)
    setCanRedo(redoRef.current.length > 0)
  }, [captureMapState, restoreMapState])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT') return
      if (e.key === 's' || e.key === 'S') setActiveTool('stamp')
      if (e.key === 'f' || e.key === 'F') setActiveTool('fill')
      if (e.key === 'e' || e.key === 'E') setActiveTool('eraser')
      if (e.key === 'l' || e.key === 'L') setActiveTool('conn')
      if (e.key === 'p' || e.key === 'P') setActiveTool('spawn')
      if (e.key === 'v' || e.key === 'V') setActiveTool('select')
      if (e.key === 'x' || e.key === 'X') setActiveTool('entity')
      if (e.key === 'd' || e.key === 'D') setMapConfig(c => c ? { ...c, doubleWidth: !c.doubleWidth } : c)
      if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey) && e.shiftKey) { e.preventDefault(); handleRedo(); return }
      if ((e.key === 'y' || e.key === 'Y') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleRedo(); return }
      if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleUndo() }
      if ((e.key === '+' || e.key === '=') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); zoomIn() }
      if (e.key === '-' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); zoomOut() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleUndo, handleRedo])

  // ── Activate a map (load its data) ────────────────────────────────────────

  const activateMap = useCallback(async (pid, mapId) => {
    try {
      const data = await loadMap(user.uid, pid, mapId)
      if (!data) return
      historyRef.current = []
      setCanUndo(false)
      setCanRedo(false)
      redoRef.current = []
      setActiveMapId(data.id)
      setMapConfig({ ...data.config, name: data.name })
      setTileset(data.tileset)
      setSelectedTile(null)
      setMapTiles(data.mapTiles)
      setConnections(data.connections ?? {})
      setEntryPositions(data.entryPositions ?? [])
      setSpawns(data.spawns ?? [])
      setEntities(data.entities ?? [])
    } catch (err) {
      console.error('Failed to load map:', err)
      setSaveStatus('error')
      setTimeout(() => setSaveStatus(null), 4000)
    }
  }, [user.uid])

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleAction = useCallback(async (group, item, payload) => {
    if (group === 'sprites' && item === 'new') { if (projectId) setShowNewSpriteModal(true); return }
    if (group === 'sprites' && item === 'import-png') { if (projectId) spritePngInputRef.current?.click(); return }
    if (group === 'project' && item === 'new')  { setShowNewProjectModal(true); return }
    if (group === 'project' && item === 'load') { setShowLoadModal(true); return }
    if (group === 'project' && item === 'export-package') {
      if (!projectId) return
      clearTimeout(autoSaveTimer.current)
      if (activeMapIdRef_.current && mapConfigRef_.current && mapTilesRef_.current) {
        await saveMap(user.uid, projectId, activeMapIdRef_.current, {
          name: mapConfigRef_.current.name,
          config: mapConfigRef_.current,
          mapTiles: mapTilesRef_.current,
        })
      }
      const pkg = await exportProjectPackage(user.uid, projectId)
      downloadText((projectName || 'project') + '.webtile.json', JSON.stringify(pkg, null, 2))
      return
    }
    if (group === 'project' && item === 'import-package') {
      if (!payload) return
      setSaveStatus('saving')
      try {
        const pkg = JSON.parse(await payload.text())
        const imported = await importProjectPackage(user.uid, pkg)
        const mapList = await listMaps(user.uid, imported.projectId)
        setProjectId(imported.projectId); setProjectName(imported.name); setProjectProfileId(imported.profileId); setMaps(mapList)
        setActiveMapId(null); setMapConfig(null); setMapTiles(null); setTileset(null); setSelectedTile(null)
        if (mapList.length) await activateMap(imported.projectId, mapList[0].id)
        setSaveStatus('saved'); setTimeout(() => setSaveStatus(null), 2000)
      } catch (err) { console.error(err); showAlert(err.message, 'IMPORT FAILED'); setSaveStatus('error') }
      return
    }

    if (group === 'maps' && item === 'new') {
      if (!projectId) return
      setShowNewMapModal(true)
      return
    }

    if (group === 'maps' && item === 'import-tmx') {
      if (!projectId || !payload) return
      const text   = await payload.text()
      const parsed = parseTMX(text)
      if (!parsed) { showAlert('Could not parse TMX file.', 'IMPORT FAILED'); return }
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
        setCanRedo(false)
        redoRef.current = []
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

  const handleNewProject = async ({ name, profileId }) => {
    setShowNewProjectModal(false)
    clearTimeout(autoSaveTimer.current)
    setSaveStatus('saving')
    try {
      const pid = await createProject(user.uid, { name, profileId })
      const pageList = await loadPages(user.uid, pid)
      setProjectId(pid)
      setProjectName(name)
      setProjectProfileId(profileId)
      setMaps([])
      setPages(pageList)
      setActivePageId(pageList[0]?.id ?? 'base')
      setActiveMapId(null)
      setMapConfig(null)
      setMapTiles(null)
      setTileset(null)
      setSelectedTile(null)
      historyRef.current = []
      setCanUndo(false)
      setCanRedo(false)
      redoRef.current = []
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
      const pageList = await loadPages(user.uid, pid)

      setProjectId(pid)
      setProjectName(proj.name)
      setProjectProfileId(proj.profileId)
      setMaps(mapList)
      setPages(pageList)
      setActivePageId(pageList[0]?.id ?? 'base')
      setActiveMapId(null)
      setMapConfig(null)
      setMapTiles(null)
      setTileset(null)
      setSelectedTile(null)
      historyRef.current = []
      setCanUndo(false)
      setCanRedo(false)
      redoRef.current = []

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
      const maxRoomId = maps.reduce((max, m) => Math.max(max, m.roomId ?? -1), -1)
      const roomId = maxRoomId + 1
      const pageId = activePageId ?? 'base'
      const mid = await createMap(user.uid, projectId, { ...config, roomId, pageId })
      const newMap = { id: mid, name: config.name, tileW: config.tileW, tileH: config.tileH, mapW: config.mapW, mapH: config.mapH, roomId, pageId }
      setMaps(ms => [...ms, newMap])
      await assignRoomToPage(user.uid, projectId, pageId, roomId)
      setPages(await loadPages(user.uid, projectId))
      // Directly activate without a Firestore round-trip (avoids null-return race)
      const emptyTiles = Array.from({ length: config.mapH }, () => Array(config.mapW).fill(null))
      historyRef.current = []
      setCanUndo(false)
      setCanRedo(false)
      redoRef.current = []
      setActiveMapId(mid)
      setMapConfig({ ...config })
      if (projectId) {
        const ts = await loadPageTileset(user.uid, projectId, pageId, config.tileW, config.tileH)
        setTileset(ts)
      } else {
        setTileset(null)
      }
      setSelectedTile(null)
      setMapTiles(emptyTiles)
      setConnections({})
      setEntryPositions([])
      setSpawns([])
      setEntities([])
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus(null), 2000)
    } catch (_) {
      setSaveStatus('error')
    }
  }

  // ── Close handlers ────────────────────────────────────────────────────────

  const handleCloseProject = useCallback(() => {
    clearTimeout(autoSaveTimer.current)
    setProjectId(null)
    setProjectName(null)
    setProjectProfileId(GENERIC_PROFILE_ID)
    setMaps([])
    setActiveMapId(null)
    setMapConfig(null)
    setMapTiles(null)
    setTileset(null)
    setSelectedTile(null)
    setSprites([])
    setSelectedSpriteId(null)
    historyRef.current = []
    setCanUndo(false)
    setCanRedo(false)
    redoRef.current = []
    setSaveStatus(null)
  }, [])

  const handleCloseMap = useCallback(() => {
    setActiveMapId(null)
    setMapConfig(null)
    setMapTiles(null)
    setSelectedTile(null)
    setConnections({})
    setEntryPositions([])
    setSpawns([])
    setEntities([])
    historyRef.current = []
    setCanUndo(false)
    setCanRedo(false)
    redoRef.current = []
  }, [])

  const handleCloseSprite = useCallback(() => {
    setSelectedSpriteId(null)
  }, [])

  // ── Select map ────────────────────────────────────────────────────────────

  const handleSelectMap = useCallback(async (mapId) => {
    setSelectedSpriteId(null)  // switch to map view
    if (mapId === activeMapId) return
    const map = maps.find(m => m.id === mapId)
    if (map?.pageId && map.pageId !== activePageId) {
      setActivePageId(map.pageId)
    }
    if (projectId) await activateMap(projectId, mapId)
  }, [activeMapId, projectId, activateMap, maps, activePageId])

  // ── Pages ───────────────────────────────────────────────────────────────────

  const handleSelectPage = useCallback(async (pageId) => {
    setActivePageId(pageId)
    const pageMaps = maps.filter(m => m.pageId === pageId)
    if (pageMaps.length > 0 && pageMaps[0].id !== activeMapId) {
      await activateMap(projectId, pageMaps[0].id)
    } else if (pageMaps.length === 0 && projectId) {
      setActiveMapId(null)
      setMapConfig(null)
      setMapTiles(null)
      setSelectedTile(null)
      setConnections({})
      setEntryPositions([])
      setSpawns([])
      setEntities([])
      const ts = await loadPageTileset(user.uid, projectId, pageId)
      setTileset(ts)
    }
  }, [maps, activePageId, activeMapId, projectId, activateMap, user.uid])

  const handleAddPage = async () => {
    if (!projectId) return
    const label = prompt('Page name:')
    if (!label?.trim()) return
    const page = await addPage(user.uid, projectId, { label: label.trim() })
    setPages(prev => [...prev, page])
    setActivePageId(page.id)
  }

  const handleRenamePage = async (pageId) => {
    if (!projectId) return
    const page = pages.find(p => p.id === pageId)
    if (!page) return
    const label = prompt('Rename page:', page.label)
    if (!label?.trim() || label === page.label) return
    await renamePage(user.uid, projectId, pageId, label.trim())
    setPages(prev => prev.map(p => p.id === pageId ? { ...p, label: label.trim() } : p))
  }

  const handleDeletePage = async (pageId) => {
    if (!projectId) return
    if (pages.length <= 1) { showAlert('Cannot delete the last page.', 'NOTICE'); return }
    if (!await showConfirm('Delete this page? Maps in it will become unassigned.', { danger: true, confirmLabel: 'Delete', title: 'DELETE PAGE' })) return
    await deletePage(user.uid, projectId, pageId)
    const remaining = pages.filter(p => p.id !== pageId)
    setPages(remaining)
    if (activePageId === pageId) {
      setActivePageId(remaining[0]?.id ?? 'base')
    }
  }

  const handleMoveMapToPage = async (mapId, targetPageId) => {
    if (!projectId) return
    const map = maps.find(m => m.id === mapId)
    if (!map) return
    const oldPageId = map.pageId
    if (oldPageId === targetPageId) return
    await removeRoomFromPage(user.uid, projectId, oldPageId, map.roomId)
    await assignRoomToPage(user.uid, projectId, targetPageId, map.roomId)
    await saveMap(user.uid, projectId, mapId, { pageId: targetPageId })
    setMaps(prev => prev.map(m => m.id === mapId ? { ...m, pageId: targetPageId } : m))
    setPages(await loadPages(user.uid, projectId))
  }

  const handleExportManifest = async () => {
    if (!projectId) return
    try {
      const proj = await loadProject(user.uid, projectId)
      const allMaps = await listMaps(user.uid, projectId)
      const fullMaps = await Promise.all(allMaps.map(async (m) => {
        const data = await loadMap(user.uid, projectId, m.id)
        return data ? { ...m, ...data } : m
      }))
      const manifest = generateModel01Manifest(proj, fullMaps)
      const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${projectName || 'model01'}-manifest.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error(err)
      showAlert(err.message, 'EXPORT FAILED')
    }
  }

  const handleConnectionClick = useCallback((direction, targetRoomId) => {
    pushHistory()
    setConnections(prev => {
      const next = { ...prev }
      if (targetRoomId == null) {
        if (next[direction]) {
          delete next[direction]
        } else {
          next[direction] = { direction, targetRoomId: null }
        }
      } else {
        next[direction] = { direction, targetRoomId }
      }
      return next
    })
  }, [])

  const handleEntryClick = useCallback((col, row) => {
    pushHistory()
    setEntryPositions(prev => {
      const exists = prev.find(ep => ep.col === col && ep.row === row)
      if (exists) return prev.filter(ep => !(ep.col === col && ep.row === row))
      return [...prev, { col, row }]
    })
  }, [])

  const handleSpawnClick = useCallback((col, row) => {
    pushHistory()
    setSpawns(prev => {
      const exists = prev.find(sp => sp.col === col && sp.row === row)
      if (exists) return prev.filter(sp => !(sp.col === col && sp.row === row))
      if (prev.length >= 12) return prev
      return [...prev, { col, row }]
    })
  }, [])

  const handleEntityClick = useCallback((col, row) => {
    const maxEntities = getProjectProfile(projectProfileId).maxEntitiesPerMap ?? null
    if (maxEntities != null && entities.length >= maxEntities) return
    pushHistory()
    setEntities(prev => {
      const existing = prev.find(e => e.col === col && e.row === row)
      if (existing) {
        setSelectedEntityId(existing.id)
        return prev
      }
      const newEntity = { type: selectedEntityType, col, row, id: Date.now(), properties: getDefaultProperties(selectedEntityType) }
      return [...prev, newEntity]
    })
  }, [selectedEntityType, entities.length, projectProfileId])

  const handleRemoveEntity = useCallback((id) => {
    pushHistory()
    setEntities(prev => prev.filter(e => e.id !== id))
    setSelectedEntityId(prev => prev === id ? null : prev)
  }, [])

  const handleRemoveSpawn = useCallback((spawn) => {
    pushHistory()
    setSpawns(prev => prev.filter(sp => !(sp.col === spawn.col && sp.row === spawn.row)))
  }, [])

  const handleRemoveEntry = useCallback((entry) => {
    pushHistory()
    setEntryPositions(prev => prev.filter(ep => !(ep.col === entry.col && ep.row === entry.row)))
  }, [])

  const handleSelectEntity = useCallback((id) => {
    setSelectedEntityId(id)
  }, [])

  const handleUpdateEntityProperty = useCallback((id, key, value) => {
    setEntities(prev => prev.map(e => e.id === id ? { ...e, properties: { ...e.properties, [key]: value } } : e))
  }, [])

  const handleDeleteSelectedEntity = useCallback(() => {
    if (!selectedEntityId) return
    pushHistory()
    setEntities(prev => prev.filter(e => e.id !== selectedEntityId))
    setSelectedEntityId(null)
  }, [selectedEntityId])

  const getSelectedEntity = useCallback(() => {
    return entities.find(e => e.id === selectedEntityId) || null
  }, [entities, selectedEntityId])

  const handleSaveMapMeta = useCallback(async () => {
    if (!projectId || !activeMapId || !mapConfigRef_.current) return
    const cfg = mapConfigRef_.current
    const pid = projectIdRef_.current
    const mid = activeMapIdRef_.current
    if (!pid || !mid) return
    clearTimeout(autoSaveTimer.current)
    setSaveStatus('saving')
    try {
      await saveMap(user.uid, pid, mid, {
        name: cfg.name,
        config: cfg,
        mapTiles: mapTilesRef_.current,
        tileset: tilesetRef_.current,
        tilesetBlobUrl: tilesetRef_.current?.url,
        connections,
        entryPositions,
        spawns,
        entities,
      })
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus(null), 2000)
    } catch (_) {
      setSaveStatus('error')
    }
  }, [projectId, activeMapId, connections, entryPositions, spawns, entities, user.uid])

  const getPageCapacity = (pageId) => {
    const profile = getProjectProfile(projectProfileId)
    if (profile.id !== 'model01') return null
    const pageRooms = maps.filter(m => m.pageId === pageId)
    const roomCount = pageRooms.length
    const spawns = pageRooms.reduce((sum, m) => sum + (m.spawns ?? 0), 0)
    const entities = pageRooms.reduce((sum, m) => sum + (m.entities?.length ?? 0), 0)
    const estimatedMapBytes = roomCount * 50
    const spawnBytes = spawns * 8
    const entityBytes = entities * 4
    const directoryBytes = roomCount * 6
    const used = estimatedMapBytes + spawnBytes + entityBytes + directoryBytes
    const budget = 5632
    return {
      rooms: roomCount,
      target: profile.targetScreensPerBank,
      used,
      free: Math.max(0, budget - used),
      budget,
    }
  }

  // ── Delete map ────────────────────────────────────────────────────────────

  const handleDeleteMap = useCallback(async (mapId) => {
    if (!projectId) return
    if (!await showConfirm('Delete this map? This cannot be undone.', { danger: true, confirmLabel: 'Delete', title: 'DELETE MAP' })) return
    try {
      const map = maps.find(m => m.id === mapId)
      await deleteMap(user.uid, projectId, mapId)
      const remaining = maps.filter(m => m.id !== mapId)
      setMaps(remaining)
      if (map?.roomId != null && map?.pageId) {
        await removeRoomFromPage(user.uid, projectId, map.pageId, map.roomId)
        setPages(await loadPages(user.uid, projectId))
      }
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
          setCanRedo(false)
          redoRef.current = []
        }
      }
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus(null), 2000)
    } catch (_) {
      setSaveStatus('error')
    }
  }, [projectId, activeMapId, maps, user.uid, activateMap])

  // ── Tileset ────────────────────────────────────────────────────────────────

  const handleLoadTileset = useCallback(async (ts) => {
    setTileset(ts)
    const pid = projectIdRef_.current
    const pageId = activePageIdRef_.current
    if (!pid || !pageId) return
    setSaveStatus('saving')
    try {
      await savePageTileset(user.uid, pid, pageId, ts)
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
    const pageId = activePageIdRef_.current
    if (!pid || !pageId) return
    clearTimeout(autoSaveTimer.current)
    setSaveStatus('saving')
    autoSaveTimer.current = setTimeout(async () => {
      const ts = tilesetRef_.current
      if (!ts) return
      try {
        await savePageTileset(user.uid, pid, pageId, ts)
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
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        background: 'var(--panel)', flexShrink: 0,
        height: '48px',
      }}>
        {/* Logo */}
        <a href="/" style={{
          display: 'flex', alignItems: 'center',
          padding: '0 20px 0 24px',
          borderRight: '1px solid var(--border)',
          fontFamily: "'Press Start 2P', monospace", fontSize: '11px',
          letterSpacing: '2px', flexShrink: 0,
          background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          textDecoration: 'none', cursor: 'pointer',
        }}>
          WEBTILE
        </a>

        {/* Dropdown nav */}
        <TopNav
          projectName={projectName}
          packageInputRef={packageInputRef}
          manifestInputRef={null}
          maps={maps}
          activeMapId={activeMapId}
          onAction={handleAction}
          onSelectMap={handleSelectMap}
          onDeleteMap={handleDeleteMap}
          tmxInputRef={tmxInputRef}
          spritePngInputRef={spritePngInputRef}
          sprites={sprites}
          selectedSpriteId={selectedSpriteId}
          onSelectSprite={handleSelectSprite}
          onDeleteSprite={handleDeleteSprite}
          onCloseProject={handleCloseProject}
          onCloseMap={handleCloseMap}
          onCloseSprite={handleCloseSprite}
          hasTileset={!!tileset}
          pages={pages}
          activePageId={activePageId}
          onSelectPage={handleSelectPage}
          onAddPage={handleAddPage}
          onRenamePage={handleRenamePage}
          onDeletePage={handleDeletePage}
          onMoveMapToPage={handleMoveMapToPage}
          onExportManifest={handleExportManifest}
        />

        {/* Centre breadcrumb */}
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center',
          padding: '0 20px', gap: '10px', overflow: 'hidden',
        }}>
          {mapConfig && !selectedSpriteId && (
            <>
              <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: '13px', fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {mapConfig.name}
              </span>
              <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: '11px', fontWeight: 400, color: 'var(--text-dim)', flexShrink: 0 }}>
                {mapConfig.mapW}×{mapConfig.mapH} · {mapConfig.tileW}×{mapConfig.tileH}px
              </span>
            </>
          )}
          {saveStatus && (
            <span style={{
              fontSize: '11px', fontWeight: 500, flexShrink: 0,
              color: saveStatus === 'error' ? 'var(--red)' : saveStatus === 'saving' ? 'var(--text-dim)' : 'var(--accent)',
              fontFamily: "'Roboto', sans-serif",
            }}>
              {saveStatus === 'saving' ? '· Saving…' : saveStatus === 'saved' ? '· Saved' : '· Save error'}
            </span>
          )}
        </div>

        {/* Right: user + logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '0 20px', borderLeft: '1px solid var(--border)', flexShrink: 0 }}>
          <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: '13px', fontWeight: 400, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
            {user.displayName || user.email}
          </span>
          <button className="btn-ghost" onClick={handleLogout}>Log Out</button>
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
              canRedo={canRedo} onRedo={handleRedo}
              doubleWidth={mapConfig.doubleWidth}
              onToggleDoubleWidth={() => setMapConfig(c => c ? { ...c, doubleWidth: !c.doubleWidth } : c)}
              selectedEntityType={selectedEntityType}
              onSelectEntityType={setSelectedEntityType}
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
                    connections={connections}
                    entryPositions={entryPositions}
                    roomId={maps.find(m => m.id === activeMapId)?.roomId}
                    onConnectionClick={handleConnectionClick}
                    onEntryClick={handleEntryClick}
                    spawns={spawns}
                    onSpawnClick={handleSpawnClick}
                    entities={entities}
                    onEntityClick={handleEntityClick}
                    onSelectEntity={handleSelectEntity}
                    selectedEntityType={activeTool === 'entity' ? selectedEntityType : null}
                    selectedEntityId={selectedEntityId}
                    onEntityRemove={handleRemoveEntity}
                    onSpawnRemove={handleRemoveSpawn}
                    onEntryRemove={handleRemoveEntry}
                    maxEntities={getProjectProfile(projectProfileId).maxEntitiesPerMap ?? null}
                  />
          }
        </div>

        {!selectedSpriteId && (
          <div style={{ display: 'flex', flexShrink: 0 }}>
            <RightSidebar
              project={mapConfig}
              mapTiles={mapTiles}
              tileset={tileset}
              selectedTile={selectedTile}
              onLoadTileset={handleLoadTileset}
              onSelectTile={setSelectedTile}
              onEditTile={handleEditTile}
              connections={connections}
              entryPositions={entryPositions}
              spawns={spawns}
              entities={entities}
              roomId={maps.find(m => m.id === activeMapId)?.roomId}
              maps={maps.filter(m => m.roomId != null)}
              selectedEntityId={selectedEntityId}
              selectedEntity={getSelectedEntity()}
              onUpdateEntityProperty={handleUpdateEntityProperty}
              onDeleteSelectedEntity={handleDeleteSelectedEntity}
              onConnectionTargetChange={handleConnectionClick}
              maxEntities={getProjectProfile(projectProfileId).maxEntitiesPerMap ?? null}
            />
            <MapDataSection
              roomId={maps.find(m => m.id === activeMapId)?.roomId}
              connections={connections}
              entryPositions={entryPositions}
              spawns={spawns}
              entities={entities}
              mapW={mapConfig?.mapW}
              mapH={mapConfig?.mapH}
              maps={maps.filter(m => m.roomId != null)}
              onConnectionTargetChange={handleConnectionClick}
              maxEntities={getProjectProfile(projectProfileId).maxEntitiesPerMap ?? null}
            />
            {projectProfileId === MODEL01_PROFILE_ID && pages.length > 0 && (() => {
              const capacity = getPageCapacity(activePageId)
              if (!capacity) return null
              const pct = Math.round((capacity.used / capacity.budget) * 100)
              return (
                <aside style={{
                  width: '220px',
                  flexShrink: 0,
                  background: 'var(--panel)',
                  borderLeft: '1px solid var(--border)',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    padding: '12px',
                    borderBottom: '1px solid var(--border)',
                    fontFamily: "'Roboto', sans-serif", fontWeight: 700,
                    fontSize: '10px', color: 'var(--text-dim)',
                    letterSpacing: '2px',
                  }}>
                    PAGE CAPACITY
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
                    <div style={{ marginBottom: '8px', fontWeight: 600, color: 'var(--accent)' }}>
                      {pages.find(p => p.id === activePageId)?.label ?? 'Base'}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                      <div style={{ background: 'var(--bg)', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>Rooms</div>
                        <div style={{ fontSize: '16px', fontWeight: 700 }}>{capacity.rooms} <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>/ {capacity.target}</span></div>
                      </div>
                      <div style={{ background: 'var(--bg)', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>Used</div>
                        <div style={{ fontSize: '16px', fontWeight: 700 }}>{capacity.used}<span style={{ fontSize: '10px', color: 'var(--text-dim)' }}> B</span></div>
                      </div>
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-dim)', marginBottom: '4px' }}>
                        <span>Budget</span>
                        <span>{capacity.budget} B</span>
                      </div>
                      <div style={{ width: '100%', height: '6px', background: 'var(--bg)', borderRadius: '3px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: pct > 85 ? 'var(--red)' : 'var(--accent)', transition: 'width 0.2s' }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-dim)', marginTop: '4px' }}>
                        <span>Free: {capacity.free} B</span>
                        <span>{pct}%</span>
                      </div>
                    </div>
                    {pct >= 100 && (
                      <div style={{ marginTop: '8px', padding: '8px', background: 'rgba(255,60,60,0.08)', border: '1px solid rgba(255,60,60,0.3)', borderRadius: '6px', color: 'var(--red)', fontSize: '10px', fontWeight: 600 }}>
                        PAGE OVER BUDGET BY {capacity.used - capacity.budget} B
                      </div>
                    )}
                    <div style={{ fontSize: '10px', color: 'var(--text-dim)', lineHeight: 1.6, marginTop: '12px' }}>
                      <div>Maps (est.): {capacity.rooms * 50} B</div>
                      <div>Spawns: {maps.filter(m => m.pageId === activePageId).reduce((s, m) => s + (m.spawns ?? 0), 0) * 8} B</div>
                      <div>Entities: {maps.filter(m => m.pageId === activePageId).reduce((s, m) => s + (m.entities?.length ?? 0), 0) * 4} B</div>
                      <div>Directory: {capacity.rooms * 6} B</div>
                    </div>
                  </div>
                </aside>
              )
            })()}
          </div>
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
          profileId={projectProfileId}
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
      <input
        ref={spritePngInputRef}
        type="file"
        accept="image/png"
        style={{ display: 'none' }}
        onChange={e => {
          const f = e.target.files?.[0]
          if (f) setImportSpriteFile(f)
          e.target.value = ''
        }}
      />
      {importSpriteFile && (
        <ImportSpriteModal
          file={importSpriteFile}
          onConfirm={handleImportSprite}
          onCancel={() => setImportSpriteFile(null)}
        />
      )}
      {dialog && (
        <ConfirmDialog
          title={dialog.title}
          message={dialog.message}
          danger={dialog.danger}
          confirmLabel={dialog.confirmLabel}
          cancelLabel={dialog.cancelLabel}
          onConfirm={() => dialog.resolve(true)}
          onCancel={dialog.isConfirm ? () => dialog.resolve(false) : undefined}
        />
      )}
    </div>
  )
}
