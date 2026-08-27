export default function RescanTilesetModal({ pageLabel, analysis, busy, error, onConfirm, onCancel }) {
  const changed = analysis.finalCount !== analysis.currentCount
  return <div className="map-import-backdrop">
    <div className="pixel-panel tileset-rescan-modal">
      <button className="map-import-close" onClick={busy ? undefined : onCancel}>✕</button>
      <div className="map-import-title">RESCAN PAGE TILESET</div>
      <p>WebTile has scanned every map in <strong>{pageLabel}</strong>. Applying the result will update their tile indices together with the shared tileset.</p>
      <div className="tileset-rescan-stats">
        <div><span>Current tiles</span><b>{analysis.currentCount}</b></div>
        <div><span>Used tiles</span><b>{analysis.usedCount}</b></div>
        <div><span>Duplicates</span><b>{analysis.duplicateCount}</b></div>
        <div><span>Unused</span><b>{analysis.unusedCount}</b></div>
        <div className="result"><span>Final tiles</span><b>{analysis.finalCount}</b></div>
        <div><span>Maps updated</span><b>{analysis.remappedMaps.length}</b></div>
      </div>
      <div className="tileset-rescan-note">
        {changed
          ? `The tileset will shrink by ${analysis.currentCount - analysis.finalCount} tile${analysis.currentCount - analysis.finalCount === 1 ? '' : 's'}. Duplicate references will point to the first matching tile.`
          : 'No duplicate or unused tiles were found. The tileset is already compact.'}
      </div>
      {error && <div className="map-import-error">{error}</div>}
      <div className="map-import-actions">
        <button disabled={busy} onClick={onCancel}>CANCEL</button>
        <button className="primary" disabled={busy || !changed} onClick={onConfirm}>{busy ? 'COMPACTING…' : 'COMPACT TILESET'}</button>
      </div>
    </div>
  </div>
}
