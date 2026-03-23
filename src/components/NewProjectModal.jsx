import { useState } from 'react'

export default function NewProjectModal({ onConfirm, onCancel }) {
  const [name, setName] = useState('')

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100,
    }}>
      <div className="pixel-panel fade-up" style={{ width: '100%', maxWidth: '380px', padding: '36px 32px', position: 'relative' }}>

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

        <div style={{ marginBottom: '28px' }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '11px', color: 'var(--green)', letterSpacing: '2px' }}>
            NEW PROJECT
          </div>
          <div style={{ width: '36px', height: '2px', background: 'var(--green)', marginTop: '12px' }} />
        </div>

        <div style={{ marginBottom: '28px' }}>
          <label className="pixel-label">PROJECT NAME</label>
          <input
            className="pixel-input"
            type="text"
            maxLength={64}
            placeholder="Untitled"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') onConfirm({ name: name.trim() || 'Untitled' }) }}
            autoFocus
            style={{ width: '100%' }}
          />
          <div style={{ fontFamily: "'VT323', monospace", fontSize: '17px', color: 'var(--text-dim)', marginTop: '8px', letterSpacing: '1px' }}>
            Maps and sprites are added after creation.
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn-pixel" onClick={() => onConfirm({ name: name.trim() || 'Untitled' })} style={{ flex: 1 }}>
            CREATE
          </button>
          <button className="btn-ghost" onClick={onCancel} style={{ flex: 1 }}>
            CANCEL
          </button>
        </div>
      </div>
    </div>
  )
}
