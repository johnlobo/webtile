import { useState, useRef, useEffect } from 'react'

const CPC_COLORS = [
  '#000000', '#000080', '#0000FF', '#800000', '#800080', '#8000FF',
  '#FF0000', '#FF0080', '#FF00FF', '#008000', '#008080', '#0080FF',
  '#808000', '#808080', '#8080FF', '#FF8000', '#FF8080', '#FF80FF',
  '#00FF00', '#00FF80', '#00FFFF', '#80FF00', '#80FF80', '#80FFFF',
  '#FFFF00', '#FFFF80', '#FFFFFF',
]

const MODE_INFO = [
  { mode: 0, label: 'Mode 0', desc: '160×200 · 16 colors · 2:1 pixels', inkCount: 16, multiple: 2 },
  { mode: 1, label: 'Mode 1', desc: '320×200 · 4 colors · 1:1 pixels',  inkCount: 4,  multiple: 4 },
  { mode: 2, label: 'Mode 2', desc: '640×200 · 2 colors · 1:2 pixels',  inkCount: 2,  multiple: 8 },
]

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}

function nearestCpcColor(r, g, b) {
  let best = 0, bestDist = Infinity
  for (let i = 0; i < CPC_COLORS.length; i++) {
    const [cr, cg, cb] = hexToRgb(CPC_COLORS[i])
    const d = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2
    if (d < bestDist) { bestDist = d; best = i }
  }
  return best
}

function snapToMultiple(value, multiple) {
  const n = Math.max(multiple, Math.round(value / multiple) * multiple)
  return n
}

/**
 * Quantize an ImageData to CPC palette + ink indices.
 * Returns { palette: number[], pixels: number[] }
 * where palette is an array of CPC color indices (up to inkCount),
 * and pixels is an array of ink indices (0-based into palette).
 * Ink 0 = transparent (background).
 */
function quantizeImage(imageData, width, height, inkCount) {
  const { data } = imageData  // RGBA flat array

  // Build palette by collecting unique CPC colors from the image
  const cpcIndexCounts = new Map()
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4]
    const g = data[i * 4 + 1]
    const b = data[i * 4 + 2]
    const a = data[i * 4 + 3]
    if (a < 128) continue  // skip transparent pixels
    const cpcIdx = nearestCpcColor(r, g, b)
    cpcIndexCounts.set(cpcIdx, (cpcIndexCounts.get(cpcIdx) ?? 0) + 1)
  }

  // Sort by frequency, take top (inkCount - 1) — ink 0 reserved for transparent
  const sorted = [...cpcIndexCounts.entries()].sort((a, b) => b[1] - a[1])
  // palette[0] = black (transparent/background), rest = top colors
  const palette = [0]
  for (const [cpcIdx] of sorted) {
    if (palette.length >= inkCount) break
    if (!palette.includes(cpcIdx)) palette.push(cpcIdx)
  }
  // Pad palette if needed
  while (palette.length < inkCount) palette.push(0)

  // Map each pixel to nearest ink in palette
  const pixels = new Array(width * height).fill(0)
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4]
    const g = data[i * 4 + 1]
    const b = data[i * 4 + 2]
    const a = data[i * 4 + 3]
    if (a < 128) { pixels[i] = 0; continue }  // transparent → ink 0
    let bestInk = 1, bestDist = Infinity
    for (let ink = 1; ink < palette.length; ink++) {
      const [cr, cg, cb] = hexToRgb(CPC_COLORS[palette[ink] ?? 0])
      const d = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2
      if (d < bestDist) { bestDist = d; bestInk = ink }
    }
    pixels[i] = bestInk
  }

  return { palette, pixels }
}

export default function ImportSpriteModal({ file, onConfirm, onCancel }) {
  const [name,       setName]       = useState(() => file.name.replace(/\.[^.]+$/, '').slice(0, 64) || 'Imported Sprite')
  const [videoMode,  setVideoMode]  = useState(0)
  const [imgSize,    setImgSize]    = useState(null)   // { w, h } original
  const [preview,    setPreview]    = useState(null)   // canvas ImageData for preview
  const [error,      setError]      = useState('')
  const [busy,       setBusy]       = useState(false)

  const previewCanvasRef = useRef(null)
  const imgRef = useRef(null)

  const inkCount  = MODE_INFO[videoMode].inkCount
  const multiple  = MODE_INFO[videoMode].multiple

  // Load the image once
  useEffect(() => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      setImgSize({ w: img.naturalWidth, h: img.naturalHeight })
      URL.revokeObjectURL(url)
    }
    img.onerror = () => {
      setError('Could not load image.')
      URL.revokeObjectURL(url)
    }
    img.src = url
  }, [file])

  // Re-render quantized preview whenever mode or image changes
  useEffect(() => {
    const img = imgRef.current
    if (!img || !imgSize) return

    const w = snapToMultiple(imgSize.w, multiple)
    const h = Math.max(1, imgSize.h)

    // Draw to off-screen canvas at target size
    const offscreen = document.createElement('canvas')
    offscreen.width  = w
    offscreen.height = h
    const ctx = offscreen.getContext('2d')
    ctx.drawImage(img, 0, 0, w, h)
    const imageData = ctx.getImageData(0, 0, w, h)

    const { palette, pixels } = quantizeImage(imageData, w, h, inkCount)
    setPreview({ palette, pixels, w, h })
  }, [imgSize, videoMode, inkCount, multiple])

  // Render quantized preview to canvas
  useEffect(() => {
    const canvas = previewCanvasRef.current
    if (!canvas || !preview) return
    const { palette, pixels, w, h } = preview

    const SCALE = Math.min(4, Math.floor(280 / Math.max(w, 1)))
    const cw = w * SCALE
    const ch = h * SCALE
    canvas.width  = cw
    canvas.height = ch

    const ctx = canvas.getContext('2d')
    // Checkerboard background
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const ink = pixels[py * w + px]
        if (ink === 0) {
          ctx.fillStyle = ((px + py) % 2 === 0) ? '#c0c0c0' : '#909090'
        } else {
          ctx.fillStyle = CPC_COLORS[palette[ink] ?? 0]
        }
        ctx.fillRect(px * SCALE, py * SCALE, SCALE, SCALE)
      }
    }
  }, [preview])

  const handleConfirm = async () => {
    if (!preview) return
    setBusy(true)
    try {
      const { palette, pixels, w, h } = preview
      await onConfirm({
        name:      name.trim() || 'Imported Sprite',
        videoMode,
        width:     w,
        height:    h,
        palette,
        pixels,
      })
    } catch (err) {
      setError('Import failed.')
      setBusy(false)
    }
  }

  const snappedW = imgSize ? snapToMultiple(imgSize.w, multiple) : null
  const snappedH = imgSize ? Math.max(1, imgSize.h) : null

  const sectionLabel = {
    fontFamily: "'Roboto', sans-serif", fontSize: '11px', fontWeight: 700,
    color: 'var(--text-dim)', letterSpacing: '0.5px', textTransform: 'uppercase',
    marginBottom: '10px',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(52,71,103,0.25)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 50,
    }}>
      <div className="pixel-panel fade-up" style={{ width: '100%', maxWidth: '500px', padding: '36px 32px', position: 'relative', maxHeight: '90vh', display: 'flex', flexDirection: 'column', gap: '18px' }}>

        {/* Close */}
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
        <div>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '11px', background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', letterSpacing: '1px' }}>
            IMPORT PNG
          </div>
          <div style={{ width: '36px', height: '3px', background: 'var(--accent-gradient)', borderRadius: '2px', marginTop: '12px' }} />
        </div>

        {/* Name */}
        <div>
          <label className="pixel-label">Sprite Name</label>
          <input
            className="pixel-input"
            type="text"
            maxLength={64}
            value={name}
            onChange={e => setName(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>

        {/* Video Mode */}
        <div>
          <div style={sectionLabel}>Video Mode</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {MODE_INFO.map(({ mode, label, desc }) => {
              const active = videoMode === mode
              return (
                <button
                  key={mode}
                  onClick={() => setVideoMode(mode)}
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
                  <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: '11px', fontWeight: 700, color: active ? 'var(--accent)' : 'var(--text-dim)', marginBottom: '4px' }}>{label}</div>
                  <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: '11px', fontWeight: 300, color: active ? 'var(--text)' : 'var(--text-dim)', lineHeight: 1.5 }}>{desc}</div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Preview */}
        <div>
          <div style={sectionLabel}>Preview — quantized to {inkCount} inks</div>
          <div style={{
            background: '#1a1a2e', borderRadius: '8px', padding: '12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            minHeight: '80px', overflow: 'hidden',
          }}>
            {!preview && !error && (
              <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>Loading<span className="blink">…</span></span>
            )}
            {error && (
              <span style={{ fontFamily: "'Roboto', sans-serif", fontSize: '13px', color: 'var(--red)' }}>{error}</span>
            )}
            {preview && (
              <canvas
                ref={previewCanvasRef}
                style={{ imageRendering: 'pixelated', maxWidth: '100%', maxHeight: '200px' }}
              />
            )}
          </div>
          {preview && snappedW && (
            <div style={{
              background: 'rgba(33,82,255,0.04)', border: '1px solid rgba(33,82,255,0.12)',
              borderRadius: '8px', padding: '10px 14px', marginTop: '10px',
              fontFamily: "'Roboto', sans-serif", fontSize: '13px', color: 'var(--text-dim)', lineHeight: 1.7,
            }}>
              {imgSize && imgSize.w !== snappedW && (
                <div>Width snapped <span style={{ color: 'var(--amber)', fontWeight: 600 }}>{imgSize.w}</span> → <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{snappedW}</span> px (Mode {videoMode} multiple of {multiple})</div>
              )}
              <div>
                Pixel array: <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{snappedW} × {snappedH}</span>
                {' '}· <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{inkCount}</span> inks
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '12px', flexShrink: 0 }}>
          <button className="btn-pixel" onClick={handleConfirm} disabled={busy || !preview} style={{ flex: 1 }}>
            {busy ? 'Importing…' : 'Import'}
          </button>
          <button className="btn-ghost" onClick={onCancel} style={{ flex: 1 }}>Cancel</button>
        </div>

      </div>
    </div>
  )
}
