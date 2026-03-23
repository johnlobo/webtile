import { useState } from 'react'

function FIELD({ label, value, onChange, min = 1, max = 256 }) {
  const [draft, setDraft] = useState(null)
  const displayed = draft !== null ? draft : String(value)
  const commit = (raw) => {
    setDraft(null)
    const n = parseInt(raw, 10)
    onChange(isNaN(n) ? min : Math.max(min, Math.min(max, n)))
  }
  return (
    <div>
      <label className="pixel-label">{label}</label>
      <input
        className="pixel-input"
        type="number"
        min={min} max={max}
        value={displayed}
        onChange={e => setDraft(e.target.value)}
        onBlur={e => commit(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') commit(e.target.value) }}
        style={{ width: '100%' }}
      />
    </div>
  )
}

export default function NewMapModal({ onConfirm, onCancel }) {
  const [name,        setName]        = useState('')
  const [tileW,       setTileW]       = useState(8)
  const [tileH,       setTileH]       = useState(8)
  const [mapW,        setMapW]        = useState(16)
  const [mapH,        setMapH]        = useState(20)
  const [doubleWidth, setDoubleWidth] = useState(false)

  const displayTileW = doubleWidth ? tileW * 2 : tileW

  const handleConfirm = () => {
    onConfirm({ name: name.trim() || 'Untitled Map', tileW, tileH, mapW, mapH, doubleWidth })
  }

  const sectionLabel = {
    fontFamily: "'Roboto', sans-serif", fontSize: '11px', fontWeight: 700,
    color: 'var(--text-dim)', letterSpacing: '0.5px', textTransform: 'uppercase',
    marginBottom: '12px',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(52,71,103,0.25)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100,
    }}>
      <div className="pixel-panel fade-up" style={{ width: '100%', maxWidth: '420px', padding: '36px 32px', position: 'relative' }}>

        <button
          onClick={onCancel}
          style={{
            position: 'absolute', top: '16px', right: '16px',
            width: '28px', height: '28px', background: 'transparent',
            border: '1px solid var(--border)', borderRadius: '6px',
            color: 'var(--text-dim)', cursor: 'pointer',
            fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'border-color 0.15s, color 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--red)'; e.currentTarget.style.color = 'var(--red)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-dim)' }}
        >✕</button>

        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '11px', background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', letterSpacing: '1px' }}>
            NEW MAP
          </div>
          <div style={{ width: '36px', height: '3px', background: 'var(--accent-gradient)', borderRadius: '2px', marginTop: '12px' }} />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label className="pixel-label">Map Name</label>
          <input
            className="pixel-input"
            type="text"
            maxLength={64}
            placeholder="Untitled Map"
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
            style={{ width: '100%' }}
          />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div style={sectionLabel}>Tile Size (px)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <FIELD label="Width"  value={tileW} onChange={setTileW} min={1} max={256} />
            <FIELD label="Height" value={tileH} onChange={setTileH} min={1} max={256} />
          </div>
        </div>

        <label style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          cursor: 'pointer', marginBottom: '24px',
          padding: '10px 12px',
          background: doubleWidth ? 'rgba(33,82,255,0.05)' : 'transparent',
          border: `1px solid ${doubleWidth ? 'rgba(33,82,255,0.3)' : 'var(--border)'}`,
          borderRadius: '8px',
          transition: 'background 0.15s, border-color 0.15s',
        }}>
          <span style={{
            width: '16px', height: '16px', flexShrink: 0,
            border: `2px solid ${doubleWidth ? 'var(--accent)' : 'var(--text-dim)'}`,
            borderRadius: '4px',
            background: doubleWidth ? 'var(--accent)' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s',
          }}>
            {doubleWidth && <span style={{ color: '#fff', fontSize: '10px', fontWeight: 'bold', lineHeight: 1 }}>✓</span>}
          </span>
          <input type="checkbox" checked={doubleWidth} onChange={e => setDoubleWidth(e.target.checked)} style={{ display: 'none' }} />
          <div>
            <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: '12px', fontWeight: 600, color: doubleWidth ? 'var(--accent)' : 'var(--text)', letterSpacing: '0.3px' }}>
              Double Pixel Width
            </div>
            <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: '12px', fontWeight: 300, color: 'var(--text-dim)', marginTop: '2px' }}>
              Render tiles at {displayTileW}×{tileH} px on screen
            </div>
          </div>
        </label>

        <div style={{ height: '1px', background: 'var(--border)', marginBottom: '24px' }} />

        <div style={{ marginBottom: '24px' }}>
          <div style={sectionLabel}>Map Size (tiles)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <FIELD label="Columns" value={mapW} onChange={setMapW} min={1} max={256} />
            <FIELD label="Rows"    value={mapH} onChange={setMapH} min={1} max={256} />
          </div>
        </div>

        <div style={{
          background: 'rgba(33,82,255,0.04)', border: '1px solid rgba(33,82,255,0.12)',
          borderRadius: '8px', padding: '12px 14px', marginBottom: '28px',
          fontFamily: "'Roboto', sans-serif", fontSize: '13px', fontWeight: 400,
          color: 'var(--text-dim)', lineHeight: 1.7,
        }}>
          <div>Tiles: {tileW}×{tileH} px stored{doubleWidth && <span style={{ color: 'var(--accent)', fontWeight: 600 }}> · {displayTileW}×{tileH} px displayed</span>}</div>
          <div>Map: {mapW}×{mapH} tiles · <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{mapW * displayTileW}×{mapH * tileH} px</span> on screen</div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn-pixel" onClick={handleConfirm} style={{ flex: 1 }}>Create</button>
          <button className="btn-ghost" onClick={onCancel}      style={{ flex: 1 }}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
