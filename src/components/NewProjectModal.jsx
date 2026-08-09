import { useState } from 'react'
import { MODEL01_PROFILE_ID, GENERIC_PROFILE_ID } from '../model01Profile'

export default function NewProjectModal({ onConfirm, onCancel }) {
  const [name, setName] = useState('')
  const [profileId, setProfileId] = useState(MODEL01_PROFILE_ID)

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(52,71,103,0.25)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100,
    }}>
      <div className="pixel-panel fade-up" style={{ width: '100%', maxWidth: '380px', padding: '36px 32px', position: 'relative' }}>

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

        <div style={{ marginBottom: '28px' }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '11px', background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', letterSpacing: '1px' }}>
            NEW PROJECT
          </div>
          <div style={{ width: '36px', height: '3px', background: 'var(--accent-gradient)', borderRadius: '2px', marginTop: '12px' }} />
        </div>

        <div style={{ marginBottom: '28px' }}>
          <label className="pixel-label">Project Name</label>
          <input
            className="pixel-input"
            type="text"
            maxLength={64}
            placeholder="Untitled"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') onConfirm({ name: name.trim() || 'Untitled', profileId }) }}
            autoFocus
            style={{ width: '100%' }}
          />
          <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: '13px', fontWeight: 300, color: 'var(--text-dim)', marginTop: '8px' }}>
            Maps and sprites are added after creation.
          </div>
        </div>

        <div style={{ marginBottom: '28px' }}>
          <label className="pixel-label">Project Profile</label>
          <select className="pixel-input" value={profileId} onChange={e => setProfileId(e.target.value)} style={{ width: '100%' }}>
            <option value={MODEL01_PROFILE_ID}>Model01 CPC (recommended)</option>
            <option value={GENERIC_PROFILE_ID}>Generic</option>
          </select>
          <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: '12px', color: 'var(--text-dim)', marginTop: '8px' }}>
            Model01 fixes maps at 16×20 tiles, 8×8 px, with up to 48 tile IDs.
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn-pixel" onClick={() => onConfirm({ name: name.trim() || 'Untitled', profileId })} style={{ flex: 1 }}>
            Create
          </button>
          <button className="btn-ghost" onClick={onCancel} style={{ flex: 1 }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
