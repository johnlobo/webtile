import { ENTITY_TYPES } from '../services/entityTypes'

export default function MapDataSection({ roomId, connections, entryPositions, spawns, entities, mapW, mapH, maps, onConnectionTargetChange, maxEntities }) {
  const directions = ['north', 'south', 'east', 'west']
  const dirLabels = { north: 'North ↑', south: 'South ↓', east: 'East →', west: 'West ←' }

  return (
    <div style={{ borderTop: '1px solid var(--border)', padding: '12px', flexShrink: 0 }}>
      <div style={{
        fontFamily: "'Roboto', sans-serif", fontWeight: 700,
        fontSize: '10px', color: 'var(--text-dim)',
        letterSpacing: '2px', marginBottom: '10px',
      }}>
        ROOM {roomId} DATA
      </div>

      {/* Connections */}
      <div style={{ marginBottom: '10px' }}>
        <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginBottom: '4px', letterSpacing: '1px' }}>CONNECTIONS</div>
        {directions.map(d => {
          const target = connections?.[d]
          return (
            <div key={d} style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-dim)', width: '42px' }}>{dirLabels[d]}</span>
              <select
                value={target?.targetRoomId ?? ''}
                onChange={e => {
                  const value = e.target.value
                  onConnectionTargetChange(d, value === '' ? null : Number(value))
                }}
                style={{ fontSize: '11px', background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', padding: '2px 4px', flex: 1 }}
              >
                <option value="">—</option>
                {maps
                  .filter(m => m.roomId != null && m.roomId !== roomId)
                  .sort((a, b) => (a.roomId ?? 0) - (b.roomId ?? 0))
                  .map(m => (
                    <option key={m.id} value={m.roomId}>{m.roomId} — {m.name}</option>
                  ))}
              </select>
            </div>
          )
        })}
      </div>

      {/* Entry positions */}
      <div>
        <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginBottom: '4px', letterSpacing: '1px' }}>ENTRY POINTS</div>
        <div style={{ fontSize: '11px', color: entryPositions?.length ? 'var(--accent)' : 'var(--text-dim)' }}>
          {entryPositions.length ? `${entryPositions.length} placed` : 'None'}
        </div>
        {entryPositions.length > 0 && (
          <div style={{ marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
            {entryPositions.slice(0, 8).map((ep, i) => (
              <span key={i} style={{
                fontSize: '9px', padding: '1px 4px', borderRadius: '3px',
                background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-dim)',
              }}>
                {ep.col},{ep.row}
              </span>
            ))}
            {entryPositions.length > 8 && (
              <span style={{ fontSize: '9px', color: 'var(--text-dim)' }}>+{entryPositions.length - 8} more</span>
            )}
          </div>
        )}
      </div>

      {/* Spawns */}
      <div style={{ marginTop: '10px' }}>
        <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginBottom: '4px', letterSpacing: '1px' }}>SPAWNS</div>
        <div style={{ fontSize: '11px', color: spawns?.length ? 'var(--amber)' : 'var(--text-dim)' }}>
          {spawns.length ? `${spawns.length} / 12` : 'None'}
        </div>
        {spawns.length > 0 && (
          <div style={{ marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
            {spawns.slice(0, 8).map((sp, i) => (
              <span key={i} style={{
                fontSize: '9px', padding: '1px 4px', borderRadius: '3px',
                background: 'rgba(255,170,0,0.12)', border: '1px solid rgba(255,170,0,0.3)',
                color: 'var(--amber)',
              }}>
                {sp.col},{sp.row}
              </span>
            ))}
            {spawns.length > 8 && (
              <span style={{ fontSize: '9px', color: 'var(--text-dim)' }}>+{spawns.length - 8} more</span>
            )}
          </div>
        )}
      </div>

      {/* Entities */}
      <div style={{ marginTop: '10px' }}>
        <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginBottom: '4px', letterSpacing: '1px' }}>ENTITIES</div>
        <div style={{ fontSize: '11px', color: entities?.length ? 'var(--accent)' : 'var(--text-dim)' }}>
          {entities.length ? `${entities.length}${maxEntities != null ? ` / ${maxEntities}` : ''} placed` : 'None'}
        </div>
        {maxEntities != null && entities.length >= maxEntities && (
          <div style={{ fontSize: '10px', color: 'var(--red)', marginTop: '4px' }}>MAX REACHED</div>
        )}
        {entities.length > 0 && (
          <div style={{ marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
            {entities.slice(0, 8).map((ent, i) => (
              <span key={i} style={{
                fontSize: '9px', padding: '1px 4px', borderRadius: '3px',
                background: 'var(--bg)', border: '1px solid var(--border)',
                color: 'var(--text-dim)',
              }}>
                {ent.type}:{ent.col},{ent.row}
              </span>
            ))}
            {entities.length > 8 && (
              <span style={{ fontSize: '9px', color: 'var(--text-dim)' }}>+{entities.length - 8} more</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
