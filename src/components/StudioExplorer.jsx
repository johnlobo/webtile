import { useState } from 'react'

function Section({ title, count, action, actionTitle, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="studio-tree-section">
      <div className="studio-tree-heading">
        <button className="studio-tree-toggle" onClick={() => setOpen(v => !v)}>
          <span className={open ? 'studio-chevron open' : 'studio-chevron'}>›</span>
          <span>{title}</span>
          <span className="studio-count">{count}</span>
        </button>
        {action && <button className="studio-icon-action" title={actionTitle} onClick={action}>+</button>}
      </div>
      {open && <div className="studio-tree-content">{children}</div>}
    </section>
  )
}

function TreeRow({ active, icon, label, meta, onClick, onDelete, children }) {
  return (
    <div className={`studio-tree-row${active ? ' active' : ''}`} onClick={onClick}>
      <span className="studio-tree-icon">{icon}</span>
      <span className="studio-tree-label">{label}</span>
      {meta != null && <span className="studio-tree-meta">{meta}</span>}
      {children}
      {onDelete && (
        <button
          className="studio-row-delete"
          title={`Delete ${label}`}
          onClick={e => { e.stopPropagation(); onDelete() }}
        >×</button>
      )}
    </div>
  )
}

export default function StudioExplorer({
  collapsed, onToggle, projectName, profileLabel,
  pages, activePageId, maps, activeMapId, sprites, selectedSpriteId,
  onSelectPage, onAddPage, onRenamePage, onDeletePage,
  onSelectMap, onNewMap, onDeleteMap, onMoveMapToPage,
  onSelectSprite, onNewSprite, onDeleteSprite, onImportSprite, onImportSpriteSheet,
}) {
  if (collapsed) {
    return (
      <aside className="studio-explorer studio-explorer-collapsed">
        <button className="studio-panel-toggle" title="Open explorer" onClick={onToggle}>›</button>
      </aside>
    )
  }

  return (
    <aside className="studio-explorer">
      <div className="studio-panel-header">
        <div>
          <div className="studio-panel-eyebrow">EXPLORER</div>
          <div className="studio-project-name">{projectName || 'No project'}</div>
          {projectName && <div className="studio-project-profile">{profileLabel}</div>}
        </div>
        <button className="studio-panel-toggle" title="Collapse explorer" onClick={onToggle}>‹</button>
      </div>

      {!projectName ? (
        <div className="studio-panel-empty">Create or load a project to browse its contents.</div>
      ) : (
        <div className="studio-tree-scroll">
          <Section title="PAGES" count={pages.length} action={onAddPage} actionTitle="New page">
            {pages.map(page => (
              <div key={page.id}>
                <TreeRow
                  active={page.id === activePageId && !selectedSpriteId}
                  icon="▱"
                  label={page.label}
                  meta={maps.filter(m => m.pageId === page.id).length}
                  onClick={() => onSelectPage(page.id)}
                >
                  <button className="studio-row-action" title="Rename page" onClick={e => { e.stopPropagation(); onRenamePage(page.id) }}>✎</button>
                  {pages.length > 1 && <button className="studio-row-delete" title="Delete page" onClick={e => { e.stopPropagation(); onDeletePage(page.id) }}>×</button>}
                </TreeRow>
                {maps.filter(m => m.pageId === page.id).map(map => (
                  <TreeRow
                    key={map.id}
                    active={map.id === activeMapId && !selectedSpriteId}
                    icon="#"
                    label={map.name}
                    meta={map.roomId != null ? `R${map.roomId}` : null}
                    onClick={() => onSelectMap(map.id)}
                    onDelete={() => onDeleteMap(map.id)}
                  />
                ))}
              </div>
            ))}
            {maps.filter(m => !m.pageId || !pages.some(p => p.id === m.pageId)).map(map => (
              <TreeRow
                key={map.id}
                active={map.id === activeMapId && !selectedSpriteId}
                icon="?"
                label={map.name}
                meta="UNASSIGNED"
                onClick={() => onSelectMap(map.id)}
                onDelete={() => onDeleteMap(map.id)}
              >
                {pages.length > 0 && (
                  <select className="studio-inline-select" value="" onClick={e => e.stopPropagation()} onChange={e => onMoveMapToPage(map.id, e.target.value)}>
                    <option value="">Move…</option>
                    {pages.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                )}
              </TreeRow>
            ))}
            <button className="studio-add-row" onClick={onNewMap}>+ New map</button>
          </Section>

          <Section title="SPRITES" count={sprites.length} action={onNewSprite} actionTitle="New sprite">
            {sprites.map(sprite => (
              <TreeRow
                key={sprite.id}
                active={sprite.id === selectedSpriteId}
                icon="◆"
                label={sprite.name}
                meta={`${sprite.width}×${sprite.height}`}
                onClick={() => onSelectSprite(sprite.id)}
                onDelete={() => onDeleteSprite(sprite.id)}
              />
            ))}
            {sprites.length === 0 && <div className="studio-tree-empty">No sprites yet</div>}
            <button className="studio-add-row" onClick={onNewSprite}>+ New sprite</button>
            <button className="studio-add-row" onClick={onImportSprite}>↑ Import PNG</button>
            <button className="studio-add-row" onClick={onImportSpriteSheet}>↑ Import spritesheet</button>
          </Section>
        </div>
      )}
    </aside>
  )
}
