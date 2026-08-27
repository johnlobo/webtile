import { useEffect, useMemo, useRef, useState } from 'react'
import { decodePaletteBytes, parseJascPalette } from '../services/paletteService'
import { analyzeMapImage, buildCombinedTilesetCanvas, CPC_COLORS, DEFAULT_MAP_PALETTE, inferCpcPalette, paletteRgbToCpc } from '../services/mapImageImport'

function canvasImageData(canvas) {
  return canvas?.getContext('2d').getImageData(0, 0, canvas.width, canvas.height) ?? null
}

function NumberField({ label, value, onChange, min = 0, disabled = false }) {
  return <label className="map-import-field"><span>{label}</span><input type="number" min={min} disabled={disabled} value={value} onChange={event => onChange(Math.max(min, Number(event.target.value) || 0))} /></label>
}

export default function ImportMapImageModal({ file, pageLabel, existingTileset, profile, onConfirm, onCancel }) {
  const [name, setName] = useState(() => file.name.replace(/\.png$/i, '').slice(0, 64) || 'Imported map')
  const [image, setImage] = useState(null)
  const [tileW, setTileW] = useState(profile.tileWidth ?? 8)
  const [tileH, setTileH] = useState(profile.tileHeight ?? 8)
  const [mapW, setMapW] = useState(profile.mapWidth ?? 1)
  const [mapH, setMapH] = useState(profile.mapHeight ?? 1)
  const [marginX, setMarginX] = useState(0)
  const [marginY, setMarginY] = useState(0)
  const [spacingX, setSpacingX] = useState(0)
  const [spacingY, setSpacingY] = useState(0)
  const [emptyTransparent, setEmptyTransparent] = useState(true)
  const [palette, setPalette] = useState(existingTileset?.palette ?? DEFAULT_MAP_PALETTE)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const sourceCanvasRef = useRef(null)
  const previewRef = useRef(null)
  const paletteInputRef = useRef(null)
  const paletteLocked = Boolean(existingTileset)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    const loaded = new Image()
    loaded.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = loaded.naturalWidth
      canvas.height = loaded.naturalHeight
      canvas.getContext('2d').drawImage(loaded, 0, 0)
      sourceCanvasRef.current = canvas
      setImage({ width: canvas.width, height: canvas.height })
      if (!profile.mapWidth) setMapW(Math.max(1, Math.floor(canvas.width / tileW)))
      if (!profile.mapHeight) setMapH(Math.max(1, Math.floor(canvas.height / tileH)))
      if (!existingTileset) setPalette(inferCpcPalette(canvasImageData(canvas), 16))
      URL.revokeObjectURL(url)
    }
    loaded.onerror = () => { setError('The PNG could not be loaded.'); URL.revokeObjectURL(url) }
    loaded.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  useEffect(() => {
    if (!image || profile.mapWidth) return
    setMapW(Math.max(1, Math.floor((image.width - marginX + spacingX) / (tileW + spacingX))))
  }, [tileW, marginX, spacingX, image, profile.mapWidth])
  useEffect(() => {
    if (!image || profile.mapHeight) return
    setMapH(Math.max(1, Math.floor((image.height - marginY + spacingY) / (tileH + spacingY))))
  }, [tileH, marginY, spacingY, image, profile.mapHeight])

  const analysis = useMemo(() => {
    if (!image || !sourceCanvasRef.current || !palette.length || !tileW || !tileH || !mapW || !mapH) return null
    try {
      setError('')
      return analyzeMapImage({
        imageData: canvasImageData(sourceCanvasRef.current), tileW, tileH, mapW, mapH,
        marginX, marginY, spacingX, spacingY, palette, emptyTransparent,
        existingImageData: existingTileset?.canvas ? canvasImageData(existingTileset.canvas) : null,
        existingCols: existingTileset?.cols ?? 0, existingRows: existingTileset?.rows ?? 0,
      })
    } catch (cause) {
      setError(cause.message)
      return null
    }
  }, [image, tileW, tileH, mapW, mapH, marginX, marginY, spacingX, spacingY, palette, emptyTransparent, existingTileset])

  useEffect(() => {
    if (!analysis || !previewRef.current) return
    const canvas = previewRef.current
    canvas.width = analysis.quantized.width
    canvas.height = analysis.quantized.height
    canvas.getContext('2d').putImageData(new ImageData(analysis.quantized.data, analysis.quantized.width, analysis.quantized.height), 0, 0)
  }, [analysis])

  const loadPalette = async event => {
    const selected = event.target.files?.[0]
    event.target.value = ''
    if (!selected || paletteLocked) return
    try {
      const colors = parseJascPalette(decodePaletteBytes(await selected.arrayBuffer()))
      const next = paletteRgbToCpc(colors, 16)
      setPalette(next)
      setError(colors.length > next.length ? `Palette loaded and reduced to ${next.length} unique CPC colors.` : '')
    } catch (cause) { setError(cause.message) }
  }

  const confirm = async () => {
    if (!analysis) return
    if (profile.maxTiles && analysis.totalCount > profile.maxTiles) {
      setError(`This page would contain ${analysis.totalCount} tiles; the ${profile.label} profile allows ${profile.maxTiles}.`)
      return
    }
    setBusy(true)
    try {
      const canvas = buildCombinedTilesetCanvas({ existingCanvas: existingTileset?.canvas, analysis, tileW, tileH })
      await onConfirm({ name: name.trim() || 'Imported map', tileW, tileH, mapW, mapH, palette, mapTiles: analysis.mapTiles, tileset: { url: canvas.toDataURL('image/png'), canvas, cols: analysis.cols, rows: analysis.rows, naturalW: canvas.width, naturalH: canvas.height, palette } })
    } catch (cause) { setError(cause.message || 'Import failed.'); setBusy(false) }
  }

  return <div className="map-import-backdrop">
    <div className="pixel-panel map-import-modal">
      <button className="map-import-close" onClick={onCancel}>✕</button>
      <div className="map-import-title">IMPORT MAP FROM PNG</div>
      <div className="map-import-layout">
        <div className="map-import-preview"><canvas ref={previewRef} /><span>{image ? `${image.width} × ${image.height} px` : 'Loading PNG…'}</span></div>
        <div className="map-import-options">
          <label className="map-import-field map-import-name"><span>Map name</span><input value={name} maxLength={64} onChange={event => setName(event.target.value)} /></label>
          <div className="map-import-grid">
            <NumberField label="Tile width" value={tileW} min={1} disabled={Boolean(profile.tileWidth)} onChange={setTileW} />
            <NumberField label="Tile height" value={tileH} min={1} disabled={Boolean(profile.tileHeight)} onChange={setTileH} />
            <NumberField label="Map columns" value={mapW} min={1} disabled={Boolean(profile.mapWidth)} onChange={setMapW} />
            <NumberField label="Map rows" value={mapH} min={1} disabled={Boolean(profile.mapHeight)} onChange={setMapH} />
            <NumberField label="Margin X" value={marginX} onChange={setMarginX} />
            <NumberField label="Margin Y" value={marginY} onChange={setMarginY} />
            <NumberField label="Spacing X" value={spacingX} onChange={setSpacingX} />
            <NumberField label="Spacing Y" value={spacingY} onChange={setSpacingY} />
          </div>
          <div className="map-import-palette">
            <div><strong>Page palette · {pageLabel}</strong><span>{paletteLocked ? 'Shared palette in use. Import is converted to it.' : 'This palette will become the page palette.'}</span></div>
            <div className="map-import-swatches">{palette.map((color, index) => <i key={`${color}-${index}`} style={{ background: CPC_COLORS[color] }} title={`Ink ${index}: CPC ${color}`} />)}</div>
            <button disabled={paletteLocked} onClick={() => paletteInputRef.current?.click()}>{paletteLocked ? 'PALETTE LOCKED' : 'LOAD JASC-PAL'}</button>
            <input ref={paletteInputRef} type="file" accept=".pal" hidden onChange={loadPalette} />
          </div>
          <label className="map-import-check"><input type="checkbox" checked={emptyTransparent} onChange={event => setEmptyTransparent(event.target.checked)} /> Fully transparent tiles are empty cells</label>
          {analysis && <div className="map-import-summary">
            <span>Existing tiles <b>{analysis.existingCount}</b></span><span>New tiles <b>{analysis.newTileCount}</b></span>
            <span>Reused cells <b>{analysis.reusedCount}</b></span><span>Empty cells <b>{analysis.emptyCount}</b></span>
            <span>Total tileset <b>{analysis.totalCount}{profile.maxTiles ? ` / ${profile.maxTiles}` : ''}</b></span>
          </div>}
          {error && <div className="map-import-error">{error}</div>}
        </div>
      </div>
      <div className="map-import-actions"><button onClick={onCancel}>CANCEL</button><button className="primary" disabled={!analysis || busy} onClick={confirm}>{busy ? 'IMPORTING…' : 'CREATE MAP & TILESET'}</button></div>
    </div>
  </div>
}
