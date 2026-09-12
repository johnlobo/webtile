import { useEffect, useMemo, useRef, useState } from 'react'
import { analyzeMapImage, buildCombinedTilesetCanvas, inferCpcPalette } from '../services/mapImageImport'

function canvasImageData(canvas) {
  return canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height)
}

export default function AppendTilesModal({ file, tileset, tileW, tileH, maxTiles, onConfirm, onCancel }) {
  const sourceRef = useRef(null)
  const previewRef = useRef(null)
  const [size, setSize] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      canvas.getContext('2d').drawImage(image, 0, 0)
      sourceRef.current = canvas
      setSize({ width: canvas.width, height: canvas.height })
      URL.revokeObjectURL(url)
    }
    image.onerror = () => { setError('The PNG could not be loaded.'); URL.revokeObjectURL(url) }
    image.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  const result = useMemo(() => {
    if (!size || !sourceRef.current) return null
    if (size.width % tileW !== 0 || size.height % tileH !== 0) {
      return { error: `PNG dimensions must be exact multiples of ${tileW}×${tileH}px.` }
    }
    try {
      const sourceData = canvasImageData(sourceRef.current)
      const palette = tileset?.palette ?? inferCpcPalette(tileset?.canvas ? canvasImageData(tileset.canvas) : sourceData, 16)
      const analysis = analyzeMapImage({
        imageData: sourceData, tileW, tileH,
        mapW: size.width / tileW, mapH: size.height / tileH,
        palette, emptyTransparent: true,
        existingImageData: tileset?.canvas ? canvasImageData(tileset.canvas) : null,
        existingCols: tileset?.cols ?? 0, existingRows: tileset?.rows ?? 0,
        existingTileCount: tileset?.tileCount ?? null,
      })
      return { analysis, palette }
    } catch (cause) { return { error: cause.message } }
  }, [size, tileW, tileH, tileset])

  useEffect(() => {
    if (!size || !previewRef.current || !sourceRef.current) return
    const canvas = previewRef.current
    canvas.width = size.width
    canvas.height = size.height
    canvas.getContext('2d').drawImage(sourceRef.current, 0, 0)
  }, [size])

  const confirm = async () => {
    if (!result?.analysis || result.analysis.newTileCount === 0) return
    if (maxTiles && result.analysis.totalCount > maxTiles) {
      setError(`The resulting tileset would contain ${result.analysis.totalCount} tiles; this profile allows ${maxTiles}.`)
      return
    }
    setBusy(true)
    try {
      const canvas = buildCombinedTilesetCanvas({ existingCanvas: tileset?.canvas, analysis: result.analysis, tileW, tileH })
      await onConfirm({
        url: canvas.toDataURL('image/png'), canvas,
        cols: result.analysis.cols, rows: result.analysis.rows, tileCount: result.analysis.totalCount,
        naturalW: canvas.width, naturalH: canvas.height, tileW, tileH, palette: result.palette,
      })
    } catch (cause) { setError(cause.message || 'Tiles could not be appended.'); setBusy(false) }
  }

  const analysis = result?.analysis
  return <div className="map-import-backdrop">
    <div className="pixel-panel append-tiles-modal">
      <button className="map-import-close" onClick={onCancel}>✕</button>
      <div className="map-import-title">ADD TILES FROM PNG</div>
      <div className="append-tiles-content">
        <div className="append-tiles-preview"><canvas ref={previewRef} /></div>
        <div>
          <p>The PNG is split automatically into {tileW}×{tileH}px tiles and converted to the shared page palette.</p>
          {analysis && <div className="tileset-rescan-stats append-tiles-stats">
            <div><span>PNG tiles</span><b>{(size.width / tileW) * (size.height / tileH)}</b></div>
            <div><span>Already present</span><b>{analysis.reusedCount}</b></div>
            <div className="result"><span>New tiles</span><b>{analysis.newTileCount}</b></div>
            <div><span>Final tileset</span><b>{analysis.totalCount}{maxTiles ? ` / ${maxTiles}` : ''}</b></div>
          </div>}
          {(error || result?.error) && <div className="map-import-error">{error || result.error}</div>}
          {analysis?.newTileCount === 0 && <div className="tileset-rescan-note">Every non-transparent tile already exists in the page tileset.</div>}
        </div>
      </div>
      <div className="map-import-actions"><button onClick={onCancel}>CANCEL</button><button className="primary" disabled={busy || !analysis?.newTileCount} onClick={confirm}>{busy ? 'ADDING…' : 'ADD NEW TILES'}</button></div>
    </div>
  </div>
}
