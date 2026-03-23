import { useState } from 'react'

const MODE_INFO = [
  { mode: 0, label: 'Mode 0', desc: '160×200 · 16 colors · 2:1 pixels', multiple: 2 },
  { mode: 1, label: 'Mode 1', desc: '320×200 · 4 colors · 1:1 pixels',  multiple: 4 },
  { mode: 2, label: 'Mode 2', desc: '640×200 · 2 colors · 1:2 pixels',  multiple: 8 },
]

function snapToMultiple(value, multiple) {
  const n = Math.max(multiple, parseInt(value, 10) || multiple)
  return Math.round(n / multiple) * multiple
}

export default function NewSpriteModal({ onConfirm, onCancel }) {
  const [name,      setName]      = useState('')
  const [videoMode, setVideoMode] = useState(0)
  const [width,     setWidth]     = useState(16)
  const [height,    setHeight]    = useState(16)
  const [widthDraft, setWidthDraft] = useState(null)
  const [heightDraft, setHeightDraft] = useState(null)

  const currentMultiple = MODE_INFO[videoMode].multiple

  const commitWidth = (raw) => {
    setWidthDraft(null)
    setWidth(snapToMultiple(raw, currentMultiple))
  }

  const commitHeight = (raw) => {
    setHeightDraft(null)
    const n = Math.max(1, parseInt(raw, 10) || 1)
    setHeight(n)
  }

  const handleModeChange = (m) => {
    setVideoMode(m)
    const mult = MODE_INFO[m].multiple
    setWidth(w => snapToMultiple(w, mult))
  }

  const handleConfirm = () => {
    const finalWidth  = snapToMultiple(width, currentMultiple)
    const finalHeight = Math.max(1, height)
    onConfirm({
      name: name.trim() || 'Untitled Sprite',
      videoMode,
      width:  finalWidth,
      height: finalHeight,
    })
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 50,
    }}>
      <div className="pixel-panel fade-up" style={{ width: '100%', maxWidth: '440px', padding: '36px 32px', position: 'relative' }}>

        {/* Close button */}
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

        {/* Title */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '11px', color: 'var(--green)', letterSpacing: '2px' }}>
            NEW SPRITE
          </div>
          <div style={{ width: '36px', height: '2px', background: 'var(--green)', marginTop: '12px' }} />
        </div>

        {/* Name */}
        <div style={{ marginBottom: '20px' }}>
          <label className="pixel-label">SPRITE NAME</label>
          <input
            className="pixel-input"
            type="text"
            maxLength={64}
            placeholder="Untitled Sprite"
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
            style={{ width: '100%' }}
            onKeyDown={e => { if (e.key === 'Enter') handleConfirm() }}
          />
        </div>

        {/* Video Mode */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '7px', color: 'var(--amber)', letterSpacing: '2px', marginBottom: '12px' }}>
            VIDEO MODE
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {MODE_INFO.map(({ mode, label, desc }) => {
              const active = videoMode === mode
              return (
                <button
                  key={mode}
                  onClick={() => handleModeChange(mode)}
                  style={{
                    flex: 1, padding: '10px 6px', cursor: 'pointer',
                    background: active ? 'rgba(0,232,122,0.10)' : 'transparent',
                    border: `1px solid ${active ? 'var(--green)' : 'var(--border)'}`,
                    transition: 'border-color 0.15s, background 0.15s',
                    textAlign: 'center',
                  }}
                  onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor = 'var(--green-dim)'; e.currentTarget.style.background = 'var(--green-glow)' } }}
                  onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'transparent' } }}
                >
                  <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '7px', color: active ? 'var(--green)' : 'var(--text-dim)', letterSpacing: '1px', marginBottom: '6px' }}>
                    {label}
                  </div>
                  <div style={{ fontFamily: "'VT323', monospace", fontSize: '13px', color: active ? 'var(--text)' : 'var(--text-dim)', letterSpacing: '0.5px', lineHeight: 1.4 }}>
                    {desc}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Dimensions */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '7px', color: 'var(--amber)', letterSpacing: '2px', marginBottom: '12px' }}>
            DIMENSIONS (CPC PIXELS)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label className="pixel-label">WIDTH</label>
              <input
                className="pixel-input"
                type="number"
                min={currentMultiple}
                step={currentMultiple}
                value={widthDraft !== null ? widthDraft : String(width)}
                onChange={e => setWidthDraft(e.target.value)}
                onBlur={e => commitWidth(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') commitWidth(e.target.value) }}
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label className="pixel-label">HEIGHT</label>
              <input
                className="pixel-input"
                type="number"
                min={1}
                value={heightDraft !== null ? heightDraft : String(height)}
                onChange={e => setHeightDraft(e.target.value)}
                onBlur={e => commitHeight(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') commitHeight(e.target.value) }}
                style={{ width: '100%' }}
              />
            </div>
          </div>
        </div>

        {/* Constraint hint */}
        <div style={{
          background: 'rgba(0,232,122,0.04)', border: '1px solid var(--border)',
          padding: '10px 14px', marginBottom: '28px',
          fontFamily: "'VT323', monospace", fontSize: '15px',
          color: 'var(--text-dim)', letterSpacing: '1px', lineHeight: 1.6,
        }}>
          <div>
            Width must be divisible by <span style={{ color: 'var(--amber)' }}>{currentMultiple}</span>
            {' '}(Mode {videoMode} constraint)
          </div>
          <div>
            Pixel array: <span style={{ color: 'var(--green)' }}>{width} × {height}</span>
            {' '}= <span style={{ color: 'var(--green)' }}>{width * height}</span> pixels
            {' '}· <span style={{ color: 'var(--green)' }}>{Math.ceil(width / currentMultiple) * height}</span> bytes/frame
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn-pixel" onClick={handleConfirm} style={{ flex: 1 }}>CREATE</button>
          <button className="btn-ghost" onClick={onCancel}      style={{ flex: 1 }}>CANCEL</button>
        </div>
      </div>
    </div>
  )
}
