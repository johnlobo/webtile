import { useState } from 'react'

export default function MapGridSettingsModal({ settings, onApply, onCancel }) {
  const [visible, setVisible] = useState(settings.visible)
  const [cellW, setCellW] = useState(String(settings.cellW))
  const [cellH, setCellH] = useState(String(settings.cellH))
  const [color, setColor] = useState(settings.color)
  const [opacity, setOpacity] = useState(settings.opacity)

  const apply = () => onApply({
    visible,
    cellW: Math.max(1, Number.parseInt(cellW, 10) || 1),
    cellH: Math.max(1, Number.parseInt(cellH, 10) || 1),
    color,
    opacity,
  })

  return <div className="map-import-backdrop">
    <div className="pixel-panel map-grid-settings-modal">
      <button className="map-import-close" onClick={onCancel}>✕</button>
      <div className="map-import-title">MAP GRID SETTINGS</div>

      <label className="map-grid-visibility">
        <input type="checkbox" checked={visible} onChange={event => setVisible(event.target.checked)} />
        Show grid <kbd>G</kbd>
      </label>

      <div className="map-import-grid">
        <label className="map-import-field"><span>Cell width · tiles</span><input type="number" min="1" value={cellW} onChange={event => setCellW(event.target.value)} /></label>
        <label className="map-import-field"><span>Cell height · tiles</span><input type="number" min="1" value={cellH} onChange={event => setCellH(event.target.value)} /></label>
      </div>

      <div className="map-grid-appearance">
        <label className="map-import-field"><span>Color</span><input className="map-grid-color" type="color" value={color} onChange={event => setColor(event.target.value)} /></label>
        <label className="map-import-field"><span>Opacity · {Math.round(opacity * 100)}%</span><input type="range" min="0.1" max="1" step="0.05" value={opacity} onChange={event => setOpacity(Number(event.target.value))} /></label>
      </div>

      <div className="tileset-rescan-note">Grid cell dimensions are measured in map tiles. A 4×2 grid groups blocks four tiles wide and two tiles high.</div>
      <div className="map-import-actions"><button onClick={onCancel}>CANCEL</button><button className="primary" onClick={apply}>APPLY</button></div>
    </div>
  </div>
}
