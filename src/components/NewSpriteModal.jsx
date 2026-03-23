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
      zIndex: 50,
    }}>
      <div className="pixel-panel fade-up" style={{ width: '100%', maxWidth: '440px', padding: '36px 32px', position: 'relative' }}>

        {/* Close button */}
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

        {/* Title */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '11px', background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', letterSpacing: '1px' }}>
            NEW SPRITE
          </div>
          <div style={{ width: '36px', height: '3px', background: 'var(--accent-gradient)', borderRadius: '2px', marginTop: '12px' }} />
        </div>

        {/* Name */}
        <div style={{ marginBottom: '20px' }}>
          <label className="pixel-label">Sprite Name</label>
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
          <div style={sectionLabel}>Video Mode</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {MODE_INFO.map(({ mode, label, desc }) => {
              const active = videoMode === mode
              return (
                <button
                  key={mode}
                  onClick={() => handleModeChange(mode)}
                  style={{
                    flex: 1, padding: '10px 6px', cursor: 'pointer',
                    background: active ? 'rgba(33,82,255,0.07)' : 'transparent',
                    border: `1px solid ${active ? 'rgba(33,82,255,0.35)' : 'var(--border)'}`,
                    borderRadius: '8px',
                    transition: 'border-color 0.15s, background 0.15s',
                    textAlign: 'center',
                  }}
                  onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor = 'rgba(33,82,255,0.25)'; e.currentTarget.style.background = 'rgba(33,82,255,0.04)' } }}
                  onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'transparent' } }}
                >
                  <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: '11px', fontWeight: 700, color: active ? 'var(--accent)' : 'var(--text-dim)', letterSpacing: '0.3px', marginBottom: '4px' }}>
                    {label}
                  </div>
                  <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: '11px', fontWeight: 300, color: active ? 'var(--text)' : 'var(--text-dim)', lineHeight: 1.5 }}>
                    {desc}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Dimensions */}
        <div style={{ marginBottom: '16px' }}>
          <div style={sectionLabel}>Dimensions (CPC pixels)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label className="pixel-label">Width</label>
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
              <label className="pixel-label">Height</label>
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
          background: 'rgba(33,82,255,0.04)', border: '1px solid rgba(33,82,255,0.12)',
          borderRadius: '8px', padding: '12px 14px', marginBottom: '28px',
          fontFamily: "'Roboto', sans-serif", fontSize: '13px', fontWeight: 400,
          color: 'var(--text-dim)', lineHeight: 1.7,
        }}>
          <div>
            Width must be divisible by <span style={{ color: 'var(--amber)', fontWeight: 600 }}>{currentMultiple}</span>
            {' '}(Mode {videoMode} constraint)
          </div>
          <div>
            Pixel array: <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{width} × {height}</span>
            {' '}= <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{width * height}</span> pixels
            {' '}· <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{Math.ceil(width / currentMultiple) * height}</span> bytes/frame
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn-pixel" onClick={handleConfirm} style={{ flex: 1 }}>Create</button>
          <button className="btn-ghost" onClick={onCancel}      style={{ flex: 1 }}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
