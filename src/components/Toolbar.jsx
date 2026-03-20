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

const TOOLS = [
  { id: 'stamp',  label: 'STAMP',  shortcut: 'S', Icon: IconStamp  },
  { id: 'fill',   label: 'FILL',   shortcut: 'F', Icon: IconFill   },
  { id: 'eraser', label: 'ERASE',  shortcut: 'E', Icon: IconEraser },
]

export const ZOOM_LEVELS = [0.25, 0.5, 1, 2, 4, 8]

function ToolBtn({ id, label, shortcut, Icon, active, onClick }) {
  return (
    <button
      title={`${label}${shortcut ? ` [${shortcut}]` : ''}`}
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: '4px', width: '48px', height: '48px',
        background: active ? 'var(--green)' : 'transparent',
        border: `2px solid ${active ? 'var(--green)' : 'var(--border)'}`,
        color: active ? '#000' : 'var(--text-dim)',
        cursor: 'pointer', transition: 'all 0.1s',
        position: 'relative', flexShrink: 0,
      }}
      onMouseEnter={e => {
        if (!active) {
          e.currentTarget.style.borderColor = 'var(--green)'
          e.currentTarget.style.color = 'var(--green)'
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          e.currentTarget.style.borderColor = 'var(--border)'
          e.currentTarget.style.color = 'var(--text-dim)'
        }
      }}
    >
      <Icon />
      <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '5px', letterSpacing: '0.5px', lineHeight: 1 }}>
        {label}
      </span>
      {shortcut && (
        <span style={{
          position: 'absolute', top: '2px', right: '3px',
          fontFamily: "'Press Start 2P', monospace", fontSize: '4px',
          color: active ? 'rgba(0,0,0,0.5)' : 'var(--text-dim)', opacity: 0.7,
        }}>
          {shortcut}
        </span>
      )}
    </button>
  )
}

const Divider = () => (
  <div style={{ width: '1px', height: '36px', background: 'var(--border)', margin: '0 4px', flexShrink: 0 }} />
)

export default function Toolbar({ activeTool, onSelectTool, zoom, onZoomIn, onZoomOut, canUndo, onUndo, doubleWidth, onToggleDoubleWidth }) {
  const zoomIdx   = ZOOM_LEVELS.indexOf(zoom)
  const canZoomIn  = zoomIdx < ZOOM_LEVELS.length - 1
  const canZoomOut = zoomIdx > 0
  const zoomLabel  = zoom >= 1 ? `${zoom}×` : `${Math.round(zoom * 100)}%`

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '4px',
      padding: '6px 10px',
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

      <Divider />

      {/* Zoom out */}
      <ToolBtn
        id="zoom-out" label="OUT" Icon={IconZoomOut}
        active={false}
        onClick={onZoomOut}
        style={{ opacity: canZoomOut ? 1 : 0.3 }}
      />

      {/* Zoom level display */}
      <div style={{
        width: '44px', textAlign: 'center', flexShrink: 0,
        fontFamily: "'Press Start 2P', monospace",
        fontSize: '8px', color: 'var(--green)', letterSpacing: '1px',
      }}>
        {zoomLabel}
      </div>

      {/* Zoom in */}
      <ToolBtn
        id="zoom-in" label="IN" Icon={IconZoomIn}
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
          gap: '4px', width: '48px', height: '48px',
          background: 'transparent',
          border: '2px solid var(--border)',
          color: canUndo ? 'var(--text-dim)' : 'var(--border)',
          cursor: canUndo ? 'pointer' : 'default',
          transition: 'all 0.1s', flexShrink: 0,
          opacity: canUndo ? 1 : 0.35,
        }}
        onMouseEnter={e => { if (canUndo) { e.currentTarget.style.borderColor = 'var(--amber)'; e.currentTarget.style.color = 'var(--amber)' } }}
        onMouseLeave={e => { if (canUndo) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-dim)' } }}
      >
        <IconUndo />
        <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '5px', letterSpacing: '0.5px', lineHeight: 1 }}>UNDO</span>
      </button>

      <Divider />

      {/* Double-width pixel toggle */}
      <button
        title="Double horizontal pixel width [D]"
        onClick={onToggleDoubleWidth}
        style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: '4px', width: '48px', height: '48px',
          background: doubleWidth ? 'var(--amber, #ffaa00)' : 'transparent',
          border: `2px solid ${doubleWidth ? 'var(--amber, #ffaa00)' : 'var(--border)'}`,
          color: doubleWidth ? '#000' : 'var(--text-dim)',
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
        <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '5px', letterSpacing: '0.5px', lineHeight: 1 }}>2×W</span>
      </button>

      <Divider />

      {/* Active tool label */}
      <div style={{
        fontFamily: "'Press Start 2P', monospace",
        fontSize: '7px', color: 'var(--green)', letterSpacing: '1px',
      }}>
        {TOOLS.find(t => t.id === activeTool)?.label}
        <span style={{ color: 'var(--text-dim)', marginLeft: '8px', fontSize: '6px' }}>
          [{TOOLS.find(t => t.id === activeTool)?.shortcut}]
        </span>
      </div>
    </div>
  )
}
