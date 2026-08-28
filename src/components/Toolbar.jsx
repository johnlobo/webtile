import { ENTITY_TYPES } from '../services/entityTypes'
import { ZOOM_LEVELS } from '../services/constants'

/* Pixel-art SVG icons */
const IconStamp = () => (
  <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
    <rect x="7" y="1" width="6" height="7"/>
    <rect x="8" y="7" width="4" height="3"/>
    <rect x="3" y="10" width="14" height="5"/>
    <rect x="1" y="16" width="18" height="2"/>
  </svg>
)

const IconFill = () => (
  <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
    <rect x="3" y="6"  width="11" height="2"/>
    <rect x="2" y="8"  width="13" height="2"/>
    <rect x="2" y="10" width="13" height="2"/>
    <rect x="3" y="12" width="11" height="2"/>
    <rect x="4" y="14" width="9"  height="2"/>
    <rect x="5" y="2"  width="7"  height="1"/>
    <rect x="4" y="3"  width="1"  height="3"/>
    <rect x="12" y="3" width="1"  height="3"/>
    <rect x="16" y="11" width="2" height="3"/>
    <rect x="15" y="14" width="4" height="2"/>
    <rect x="16" y="16" width="2" height="2"/>
  </svg>
)

const IconZoomIn = () => (
  <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
    {/* Lens circle (pixel) */}
    <rect x="3"  y="6"  width="2" height="6"/>
    <rect x="13" y="6"  width="2" height="6"/>
    <rect x="6"  y="3"  width="6" height="2"/>
    <rect x="6"  y="13" width="6" height="2"/>
    <rect x="4"  y="4"  width="2" height="2"/>
    <rect x="12" y="4"  width="2" height="2"/>
    <rect x="4"  y="12" width="2" height="2"/>
    <rect x="12" y="12" width="2" height="2"/>
    {/* Handle */}
    <rect x="13" y="13" width="2" height="2"/>
    <rect x="14" y="14" width="2" height="2"/>
    <rect x="15" y="15" width="3" height="3"/>
    {/* + sign */}
    <rect x="8"  y="7"  width="2" height="5"/>
    <rect x="6"  y="9"  width="6" height="2"/>
  </svg>
)

const IconZoomOut = () => (
  <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
    {/* Lens circle (pixel) */}
    <rect x="3"  y="6"  width="2" height="6"/>
    <rect x="13" y="6"  width="2" height="6"/>
    <rect x="6"  y="3"  width="6" height="2"/>
    <rect x="6"  y="13" width="6" height="2"/>
    <rect x="4"  y="4"  width="2" height="2"/>
    <rect x="12" y="4"  width="2" height="2"/>
    <rect x="4"  y="12" width="2" height="2"/>
    <rect x="12" y="12" width="2" height="2"/>
    {/* Handle */}
    <rect x="13" y="13" width="2" height="2"/>
    <rect x="14" y="14" width="2" height="2"/>
    <rect x="15" y="15" width="3" height="3"/>
    {/* – sign */}
    <rect x="6"  y="9"  width="6" height="2"/>
  </svg>
)

const IconEraser = () => (
  <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
    {/* Eraser body */}
    <rect x="2"  y="11" width="10" height="6"/>
    {/* Top angled part */}
    <rect x="4"  y="7"  width="10" height="4"/>
    <rect x="6"  y="4"  width="10" height="3"/>
    <rect x="8"  y="2"  width="10" height="2"/>
    {/* Highlight stripe */}
    <rect x="4"  y="11" width="10" height="2" style={{ fill: 'currentColor', opacity: 0.4 }}/>
    {/* Erased line on paper */}
    <rect x="1"  y="18" width="18" height="1"/>
    <rect x="13" y="11" width="2"  height="6" style={{ fill: 'currentColor', opacity: 0.5 }}/>
  </svg>
)

const IconUndo = () => (
  <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
    {/* Arrow shaft */}
    <rect x="4"  y="8"  width="10" height="2"/>
    <rect x="4"  y="10" width="8"  height="2"/>
    <rect x="4"  y="12" width="6"  height="2"/>
    {/* Arrow head pointing left */}
    <rect x="2"  y="8"  width="2"  height="2"/>
    <rect x="1"  y="9"  width="2"  height="2"/>
    <rect x="2"  y="10" width="2"  height="2"/>
    {/* Arc top */}
    <rect x="6"  y="4"  width="8"  height="2"/>
    <rect x="4"  y="6"  width="2"  height="2"/>
    <rect x="14" y="6"  width="2"  height="2"/>
    <rect x="14" y="8"  width="2"  height="2"/>
  </svg>
)

const IconRedo = () => (
  <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor" style={{ transform: 'scaleX(-1)' }}>
    <rect x="4"  y="8"  width="10" height="2"/>
    <rect x="4"  y="10" width="8"  height="2"/>
    <rect x="4"  y="12" width="6"  height="2"/>
    <rect x="2"  y="8"  width="2"  height="2"/>
    <rect x="1"  y="9"  width="2"  height="2"/>
    <rect x="2"  y="10" width="2"  height="2"/>
    <rect x="6"  y="4"  width="8"  height="2"/>
    <rect x="4"  y="6"  width="2"  height="2"/>
    <rect x="14" y="6"  width="2"  height="2"/>
    <rect x="14" y="8"  width="2"  height="2"/>
  </svg>
)

const IconTileIds = () => (
  <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
    <rect x="1" y="1" width="8" height="8" opacity="0.28"/>
    <rect x="11" y="1" width="8" height="8" opacity="0.28"/>
    <rect x="1" y="11" width="8" height="8" opacity="0.28"/>
    <rect x="11" y="11" width="8" height="8" opacity="0.28"/>
    <path d="M4 3h3v1H6v3H5V4H4zm9 0h3v4h-3V6h2V4h-2zM3 13h4v1H5v1h2v2H3v-1h3v-1H4v-1H3zm10 0h3v4h-3v-1h2v-1h-2z"/>
  </svg>
)

const IconRescan = () => (
  <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
    <path d="M4 4h9V2l4 3-4 3V6H5v4H3V6a2 2 0 0 1 1-2zm12 12H7v2l-4-3 4-3v2h8v-4h2v4a2 2 0 0 1-1 2z"/>
    <rect x="7" y="8" width="2" height="2"/><rect x="10" y="8" width="2" height="2"/><rect x="7" y="11" width="2" height="2"/><rect x="10" y="11" width="2" height="2"/>
  </svg>
)

const IconGrid = () => (
  <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
    <path d="M2 2h16v16H2zm2 2v5h5V4zm7 0v5h5V4zM4 11v5h5v-5zm7 0v5h5v-5z"/>
  </svg>
)

const IconGridSettings = () => (
  <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
    <path d="M2 3h10v2H2zm14 0h2v2h-2zM2 9h3v2H2zm7 0h9v2H9zM2 15h10v2H2zm14 0h2v2h-2z"/>
    <rect x="12" y="1" width="4" height="6"/><rect x="5" y="7" width="4" height="6"/><rect x="12" y="13" width="4" height="6"/>
  </svg>
)

const IconConnection = () => (
  <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
    {/* Map A */}
    <rect x="1" y="4" width="7" height="5"/>
    <rect x="2" y="1" width="2" height="2"/>
    <rect x="5" y="1" width="2" height="2"/>
    {/* Arrow */}
    <rect x="9" y="6" width="2" height="2"/>
    {/* Map B */}
    <rect x="12" y="4" width="7" height="5"/>
    <rect x="15" y="1" width="2" height="2"/>
  </svg>
)

const IconSpawn = () => (
  <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
    <rect x="9" y="1" width="2" height="2"/>
    <rect x="7" y="3" width="6" height="2"/>
    <rect x="5" y="5" width="10" height="2"/>
    <rect x="3" y="7" width="14" height="2"/>
    <rect x="1" y="9" width="18" height="2"/>
    <rect x="3" y="11" width="14" height="2"/>
    <rect x="5" y="13" width="10" height="2"/>
    <rect x="7" y="15" width="6" height="2"/>
    <rect x="9" y="17" width="2" height="2"/>
  </svg>
)

const IconSelect = () => (
  <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
    <rect x="1" y="1" width="2" height="18"/>
    <rect x="3" y="3" width="2" height="16"/>
    <rect x="5" y="5" width="2" height="14"/>
    <rect x="7" y="7" width="2" height="12"/>
    <rect x="9" y="9" width="2" height="10"/>
    <rect x="11" y="11" width="2" height="8"/>
    <rect x="13" y="13" width="2" height="6"/>
    <rect x="15" y="15" width="2" height="4"/>
    <rect x="17" y="17" width="2" height="2"/>
  </svg>
)

const IconEntity = () => (
  <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
    <rect x="8" y="1" width="4" height="4"/>
    <rect x="6" y="5" width="8" height="3"/>
    <rect x="4" y="8" width="12" height="3"/>
    <rect x="2" y="11" width="16" height="3"/>
    <rect x="1" y="14" width="18" height="2"/>
  </svg>
)

const TOOLS = [
  { id: 'stamp',  label: 'STAMP',  shortcut: 'S', Icon: IconStamp  },
  { id: 'fill',   label: 'FILL',   shortcut: 'F', Icon: IconFill   },
  { id: 'eraser', label: 'ERASE',  shortcut: 'E', Icon: IconEraser },
  { id: 'conn',   label: 'LINK',   shortcut: 'L', Icon: IconConnection },
  { id: 'spawn',  label: 'SPAWN',  shortcut: 'P', Icon: IconSpawn },
  { id: 'select', label: 'SELECT', shortcut: 'V', Icon: IconSelect },
  { id: 'entity', label: 'ENTITY', shortcut: 'X', Icon: IconEntity },
]

function ToolBtn({ id, label, shortcut, badge, Icon, active, onClick }) {
  return (
    <button
      title={`${label}${shortcut ? ` [${shortcut}]` : ''}`}
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: '3px', width: '42px', height: '42px',
        background: active ? 'var(--accent-gradient)' : 'transparent',
        border: `1px solid ${active ? 'transparent' : 'var(--border)'}`,
        borderRadius: '8px',
        color: active ? '#fff' : 'var(--text-dim)',
        cursor: 'pointer', transition: 'all 0.1s',
        position: 'relative', flexShrink: 0,
        boxShadow: active ? '0 3px 10px rgba(33,82,255,0.25)' : 'none',
      }}
      onMouseEnter={e => {
        if (!active) {
          e.currentTarget.style.borderColor = 'rgba(33,82,255,0.35)'
          e.currentTarget.style.color = 'var(--accent)'
          e.currentTarget.style.background = 'rgba(33,82,255,0.05)'
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          e.currentTarget.style.borderColor = 'var(--border)'
          e.currentTarget.style.color = 'var(--text-dim)'
          e.currentTarget.style.background = 'transparent'
        }
      }}
    >
      <Icon />
      <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: '10px', fontWeight: 700, letterSpacing: '0.5px', lineHeight: 1 }}>
        {label}
      </span>
      {(badge || shortcut) && (
        <span style={{
          position: 'absolute', top: '2px', right: '3px',
          fontFamily: "'Roboto', sans-serif", fontSize: '9px', fontWeight: 600,
          color: active ? 'rgba(0,0,0,0.5)' : 'var(--text-dim)', opacity: 0.7,
        }}>
          {badge || shortcut}
        </span>
      )}
    </button>
  )
}

const Divider = () => (
  <div style={{ width: '1px', height: '36px', background: 'var(--border)', margin: '0 4px', flexShrink: 0 }} />
)

export default function Toolbar({ activeTool, onSelectTool, zoom, onZoomIn, onZoomOut, canUndo, onUndo, canRedo, onRedo, doubleWidth, onToggleDoubleWidth, showGrid, onToggleGrid, onOpenGridSettings, showTileIds, onToggleTileIds, canRescanTileset, onRescanTileset, selectedEntityType, onSelectEntityType }) {
  const zoomIdx   = ZOOM_LEVELS.indexOf(zoom)
  const canZoomIn  = zoomIdx < ZOOM_LEVELS.length - 1
  const canZoomOut = zoomIdx > 0
  const zoomLabel  = zoom >= 1 ? `${zoom}×` : `${Math.round(zoom * 100)}%`

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '4px',
      padding: '5px 8px', overflowX: 'auto',
      background: 'var(--panel)',
      borderBottom: '1px solid var(--border)',
      flexShrink: 0, position: 'relative', zIndex: 1,
    }}>
      {/* Draw tools */}
      {TOOLS.map(({ id, label, shortcut, Icon }) => (
        <ToolBtn
          key={id} id={id} label={label} shortcut={shortcut} Icon={Icon}
          active={activeTool === id}
          onClick={() => onSelectTool(id)}
        />
      ))}

      {activeTool === 'entity' && onSelectEntityType && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '2px',
          padding: '0 4px', marginLeft: '4px',
        }}>
          {Object.entries(ENTITY_TYPES).map(([type, def]) => (
            <button
              key={type}
              onClick={() => onSelectEntityType(type)}
              style={{
                padding: '3px 7px',
                background: selectedEntityType === type ? def.color : 'transparent',
                border: `1px solid ${selectedEntityType === type ? def.color : 'var(--border)'}`,
                borderRadius: '4px',
                color: selectedEntityType === type ? '#000' : 'var(--text-dim)',
                cursor: 'pointer',
                fontFamily: "'Roboto', sans-serif",
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.5px',
                transition: 'all 0.1s',
              }}
              title={type}
            >
              {def.label}
            </button>
          ))}
        </div>
      )}

      <Divider />

      {/* Zoom out */}
      <ToolBtn
        id="zoom-out" label="OUT" shortcut="Ctrl+-" badge="−" Icon={IconZoomOut}
        active={false}
        onClick={onZoomOut}
        style={{ opacity: canZoomOut ? 1 : 0.3 }}
      />

      {/* Zoom level display */}
      <div style={{
        width: '44px', textAlign: 'center', flexShrink: 0,
        fontFamily: "'Roboto', sans-serif",
        fontSize: '13px', fontWeight: 700, color: 'var(--accent)',
      }}>
        {zoomLabel}
      </div>

      {/* Zoom in */}
      <ToolBtn
        id="zoom-in" label="IN" shortcut="Ctrl++" badge="+" Icon={IconZoomIn}
        active={false}
        onClick={onZoomIn}
      />

      <Divider />

      {/* Undo */}
      <button
        title="UNDO [Ctrl+Z]"
        onClick={onUndo}
        disabled={!canUndo}
        style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: '3px', width: '42px', height: '42px',
          background: 'transparent',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          color: canUndo ? 'var(--text-dim)' : 'var(--border)',
          cursor: canUndo ? 'pointer' : 'default',
          transition: 'all 0.1s', flexShrink: 0,
          opacity: canUndo ? 1 : 0.35,
        }}
        onMouseEnter={e => { if (canUndo) { e.currentTarget.style.borderColor = 'var(--amber)'; e.currentTarget.style.color = 'var(--amber)' } }}
        onMouseLeave={e => { if (canUndo) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-dim)' } }}
      >
        <IconUndo />
        <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: '10px', fontWeight: 700, letterSpacing: '0.5px', lineHeight: 1 }}>UNDO</span>
      </button>

      {/* Redo */}
      <button
        title="REDO [Ctrl+Shift+Z]"
        onClick={onRedo}
        disabled={!canRedo}
        style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: '3px', width: '42px', height: '42px',
          background: 'transparent',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          color: canRedo ? 'var(--text-dim)' : 'var(--border)',
          cursor: canRedo ? 'pointer' : 'default',
          transition: 'all 0.1s', flexShrink: 0,
          opacity: canRedo ? 1 : 0.35,
        }}
        onMouseEnter={e => { if (canRedo) { e.currentTarget.style.borderColor = 'var(--amber)'; e.currentTarget.style.color = 'var(--amber)' } }}
        onMouseLeave={e => { if (canRedo) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-dim)' } }}
      >
        <IconRedo />
        <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: '10px', fontWeight: 700, letterSpacing: '0.5px', lineHeight: 1 }}>REDO</span>
      </button>

      <Divider />

      {/* Double-width pixel toggle */}
      <button
        title="Double horizontal pixel width [D]"
        onClick={onToggleDoubleWidth}
        style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: '3px', width: '42px', height: '42px',
          background: doubleWidth ? 'var(--amber)' : 'transparent',
          border: `1px solid ${doubleWidth ? 'var(--amber)' : 'var(--border)'}`,
          borderRadius: '8px',
          color: doubleWidth ? '#fff' : 'var(--text-dim)',
          cursor: 'pointer', transition: 'all 0.1s', flexShrink: 0,
        }}
        onMouseEnter={e => {
          if (!doubleWidth) { e.currentTarget.style.borderColor = 'var(--amber, #ffaa00)'; e.currentTarget.style.color = 'var(--amber, #ffaa00)' }
        }}
        onMouseLeave={e => {
          if (!doubleWidth) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-dim)' }
        }}
      >
        <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
          {/* "2×" pixel-art glyph */}
          <rect x="2"  y="3"  width="5" height="2"/>
          <rect x="2"  y="5"  width="2" height="2"/>
          <rect x="5"  y="7"  width="2" height="2"/>
          <rect x="2"  y="9"  width="7" height="2"/>
          <rect x="10" y="7"  width="2" height="6"/>
          <rect x="14" y="3"  width="2" height="6"/>
          <rect x="12" y="5"  width="2" height="2"/>
          <rect x="12" y="9"  width="2" height="2"/>
          <rect x="10" y="3"  width="2" height="2"/>
          <rect x="16" y="5"  width="2" height="2"/>
          <rect x="16" y="9"  width="2" height="2"/>
        </svg>
        <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: '10px', fontWeight: 700, letterSpacing: '0.5px', lineHeight: 1 }}>2×W</span>
      </button>

      <Divider />

      <ToolBtn
        id="map-grid" label="GRID" shortcut="G" Icon={IconGrid}
        active={showGrid}
        onClick={onToggleGrid}
      />

      <button
        title="Grid settings"
        onClick={onOpenGridSettings}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: '3px', width: '42px', height: '42px', flexShrink: 0,
          background: 'transparent', border: '1px solid var(--border)', borderRadius: '8px',
          color: 'var(--text-dim)', cursor: 'pointer',
        }}
      >
        <IconGridSettings />
        <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: '10px', fontWeight: 700, letterSpacing: '0.5px', lineHeight: 1 }}>GRID…</span>
      </button>

      <ToolBtn
        id="tile-ids" label="IDS" shortcut="N" Icon={IconTileIds}
        active={showTileIds}
        onClick={onToggleTileIds}
      />

      <button
        title="Rescan and compact the page tileset"
        disabled={!canRescanTileset}
        onClick={onRescanTileset}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: '3px', width: '42px', height: '42px', flexShrink: 0,
          background: 'transparent', border: '1px solid var(--border)', borderRadius: '8px',
          color: canRescanTileset ? 'var(--text-dim)' : 'var(--border)',
          cursor: canRescanTileset ? 'pointer' : 'default', opacity: canRescanTileset ? 1 : 0.35,
        }}
      >
        <IconRescan />
        <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: '10px', fontWeight: 700, letterSpacing: '0.5px', lineHeight: 1 }}>SCAN</span>
      </button>

      <Divider />

      {/* Active tool label */}
      <div style={{
        fontFamily: "'Roboto', sans-serif",
        fontSize: '12px', fontWeight: 600, color: 'var(--accent)',
      }}>
        {TOOLS.find(t => t.id === activeTool)?.label}
        <span style={{ color: 'var(--text-dim)', marginLeft: '8px', fontSize: '11px', fontWeight: 400 }}>
          [{TOOLS.find(t => t.id === activeTool)?.shortcut}]
        </span>
      </div>
    </div>
  )
}
