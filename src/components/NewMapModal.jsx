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

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100,
    }}>
      <div className="pixel-panel fade-up" style={{ width: '100%', maxWidth: '420px', padding: '36px 32px', position: 'relative' }}>

        <button
          onClick={onCancel}
          style={{
            position: 'absolute', top: '12px', right: '12px',
            width: '24px', height: '24px', background: 'transparent',
            border: '1px solid var(--border)', color: 'var(--text-dim)',
            cursor: 'pointer', fontFamily: "'Press Start 2P', monospace",
            fontSize: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'border-color 0.15s, color 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--red)'; e.currentTarget.style.color = 'var(--red)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-dim)' }}
        >✕</button>

        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '11px', color: 'var(--green)', letterSpacing: '2px' }}>
            NEW MAP
          </div>
          <div style={{ width: '36px', height: '2px', background: 'var(--green)', marginTop: '12px' }} />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label className="pixel-label">MAP NAME</label>
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
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '7px', color: 'var(--amber)', letterSpacing: '2px', marginBottom: '12px' }}>
            TILE SIZE (px)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <FIELD label="WIDTH"  value={tileW} onChange={setTileW} min={1} max={256} />
            <FIELD label="HEIGHT" value={tileH} onChange={setTileH} min={1} max={256} />
          </div>
        </div>

        <label style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          cursor: 'pointer', marginBottom: '24px',
          padding: '10px 12px',
          background: doubleWidth ? 'rgba(0,232,122,0.06)' : 'transparent',
          border: `1px solid ${doubleWidth ? 'var(--green-dim)' : 'var(--border)'}`,
          transition: 'background 0.15s, border-color 0.15s',
        }}>
          <span style={{
            width: '16px', height: '16px', flexShrink: 0,
            border: `2px solid ${doubleWidth ? 'var(--green)' : 'var(--text-dim)'}`,
            background: doubleWidth ? 'var(--green)' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s',
          }}>
            {doubleWidth && <span style={{ color: '#000', fontSize: '10px', fontWeight: 'bold', lineHeight: 1 }}>✓</span>}
          </span>
          <input type="checkbox" checked={doubleWidth} onChange={e => setDoubleWidth(e.target.checked)} style={{ display: 'none' }} />
          <div>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '7px', color: doubleWidth ? 'var(--green)' : 'var(--text-dim)', letterSpacing: '1px' }}>
              DOUBLE PIXEL WIDTH
            </div>
            <div style={{ fontFamily: "'VT323', monospace", fontSize: '14px', color: 'var(--text-dim)', marginTop: '4px', letterSpacing: '1px' }}>
              Render tiles at {displayTileW}×{tileH} px on screen
            </div>
          </div>
        </label>

        <div style={{ height: '1px', background: 'var(--border)', marginBottom: '24px' }} />

        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '7px', color: 'var(--amber)', letterSpacing: '2px', marginBottom: '12px' }}>
            MAP SIZE (tiles)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <FIELD label="COLUMNS" value={mapW} onChange={setMapW} min={1} max={256} />
            <FIELD label="ROWS"    value={mapH} onChange={setMapH} min={1} max={256} />
          </div>
        </div>

        <div style={{
          background: 'rgba(0,232,122,0.04)', border: '1px solid var(--border)',
          padding: '10px 14px', marginBottom: '28px',
          fontFamily: "'VT323', monospace", fontSize: '16px',
          color: 'var(--text-dim)', letterSpacing: '2px', lineHeight: 1.7,
        }}>
          <div>TILES: {tileW}×{tileH} px stored{doubleWidth && <span style={{ color: 'var(--green)' }}> · {displayTileW}×{tileH} px displayed</span>}</div>
          <div>MAP: {mapW}×{mapH} tiles · <span style={{ color: 'var(--green)' }}>{mapW * displayTileW}×{mapH * tileH} px</span> on screen</div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn-pixel" onClick={handleConfirm} style={{ flex: 1 }}>CREATE</button>
          <button className="btn-ghost" onClick={onCancel}      style={{ flex: 1 }}>CANCEL</button>
        </div>
      </div>
    </div>
  )
}
