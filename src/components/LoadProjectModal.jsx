import { useState, useEffect } from 'react'
import { listProjects, deleteProject } from '../services/projectService'

function fmt(date) {
  if (!date) return '—'
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
    + ' ' + date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export default function LoadProjectModal({ userId, onLoad, onCancel }) {
  const [projects, setProjects] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [deleting, setDeleting] = useState(null)
  const [error,    setError]    = useState(null)

  const refresh = async () => {
    setLoading(true)
    setError(null)
    try {
      setProjects(await listProjects(userId))
    } catch (_) {
      setError('Failed to load projects.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [userId])

  const handleDelete = async (e, id) => {
    e.stopPropagation()
    if (!confirm('Delete this project and all its maps? This cannot be undone.')) return
    setDeleting(id)
    try {
      await deleteProject(userId, id)
      setProjects(ps => ps.filter(p => p.id !== id))
    } catch (_) {
      setError('Failed to delete project.')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(52,71,103,0.25)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100,
    }}>
      <div className="pixel-panel fade-up" style={{ width: '100%', maxWidth: '480px', padding: '36px 32px', position: 'relative', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>

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

        <div style={{ marginBottom: '24px', flexShrink: 0 }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '11px', background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', letterSpacing: '1px' }}>
            LOAD PROJECT
          </div>
          <div style={{ width: '36px', height: '3px', background: 'var(--accent-gradient)', borderRadius: '2px', marginTop: '12px' }} />
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading && (
            <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: '14px', fontWeight: 300, color: 'var(--text-dim)', textAlign: 'center', padding: '32px 0' }}>
              Loading<span className="blink">...</span>
            </div>
          )}
          {error && <div className="msg-error" style={{ marginBottom: '12px' }}>{error}</div>}
          {!loading && projects.length === 0 && (
            <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: '14px', fontWeight: 300, color: 'var(--text-dim)', textAlign: 'center', padding: '32px 0' }}>
              No saved projects
            </div>
          )}
          {!loading && projects.map(p => (
            <div
              key={p.id}
              onClick={() => onLoad(p.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px 14px', marginBottom: '8px',
                border: '1px solid var(--border)', borderRadius: '8px',
                background: 'transparent', cursor: 'pointer',
                transition: 'border-color 0.15s, background 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(33,82,255,0.3)'; e.currentTarget.style.background = 'rgba(33,82,255,0.04)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(33,82,255,0.08)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.boxShadow = 'none' }}
            >
              <span style={{ fontSize: '18px', color: 'var(--accent)', flexShrink: 0, opacity: 0.7 }}>▤</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.name}
                </div>
                <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: '12px', fontWeight: 300, color: 'var(--text-dim)' }}>
                  {fmt(p.updatedAt)}
                </div>
              </div>
              <button
                onClick={e => handleDelete(e, p.id)}
                disabled={deleting === p.id}
                style={{
                  flexShrink: 0, padding: '4px 10px',
                  background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px',
                  color: 'var(--text-dim)', cursor: 'pointer',
                  fontFamily: "'Roboto', sans-serif", fontSize: '11px', fontWeight: 600,
                  transition: 'border-color 0.15s, color 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--red)'; e.currentTarget.style.color = 'var(--red)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-dim)' }}
              >
                {deleting === p.id ? '…' : 'Del'}
              </button>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '20px', flexShrink: 0 }}>
          <button className="btn-ghost" onClick={onCancel} style={{ width: '100%' }}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
