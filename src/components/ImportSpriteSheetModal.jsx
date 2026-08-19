import { useEffect, useRef, useState } from 'react'
import { CPC_COLORS, MODE_INFO, quantizeImage, snapToMultiple } from './ImportSpriteModal'

export default function ImportSpriteSheetModal({ file, onConfirm, onCancel }) {
  const [name, setName] = useState(() => file.name.replace(/\.[^.]+$/, '').slice(0, 64) || 'Imported Animation')
  const [videoMode, setVideoMode] = useState(0)
  const [direction, setDirection] = useState('horizontal')
  const [spacing, setSpacing] = useState(0)
  const [frameW, setFrameW] = useState(16)
  const [frameH, setFrameH] = useState(16)
  const [image, setImage] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const previewRef = useRef(null)

  const mode = MODE_INFO[videoMode]
  const normalizedW = snapToMultiple(frameW, mode.multiple)
  const normalizedH = Math.max(1, frameH)
  const axisSize = image ? (direction === 'horizontal' ? image.naturalWidth : image.naturalHeight) : 0
  const crossSize = image ? (direction === 'horizontal' ? image.naturalHeight : image.naturalWidth) : 0
  const axisFrame = direction === 'horizontal' ? normalizedW : normalizedH
  const crossFrame = direction === 'horizontal' ? normalizedH : normalizedW
  const step = axisFrame + spacing
  const frameCount = image && step > 0 && crossSize >= crossFrame ? Math.floor((axisSize + spacing) / step) : 0
  const usedSize = frameCount ? frameCount * step - spacing : 0

  useEffect(() => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      setImage(img)
      const guessed = Math.max(1, Math.min(img.naturalWidth, img.naturalHeight))
      setFrameW(snapToMultiple(guessed, MODE_INFO[0].multiple))
      setFrameH(guessed)
      URL.revokeObjectURL(url)
    }
    img.onerror = () => { setError('Could not load the sprite sheet.'); URL.revokeObjectURL(url) }
    img.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  useEffect(() => {
    const canvas = previewRef.current
    if (!canvas || !image) return
    const maxW = 380
    const maxH = 180
    const scale = Math.min(1, maxW / image.naturalWidth, maxH / image.naturalHeight)
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const ctx = canvas.getContext('2d')
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#00e87a'
    ctx.lineWidth = 1
    for (let fi = 0; fi < frameCount; fi++) {
      const x = direction === 'horizontal' ? fi * step * scale : 0
      const y = direction === 'vertical' ? fi * step * scale : 0
      ctx.strokeRect(x + .5, y + .5, normalizedW * scale - 1, normalizedH * scale - 1)
    }
  }, [image, direction, spacing, normalizedW, normalizedH, frameCount, step])

  const handleConfirm = async () => {
    if (!image || frameCount < 1) return
    setBusy(true)
    setError('')
    try {
      const sheet = document.createElement('canvas')
      sheet.width = image.naturalWidth
      sheet.height = image.naturalHeight
      const sheetCtx = sheet.getContext('2d', { willReadFrequently: true })
      sheetCtx.imageSmoothingEnabled = false
      sheetCtx.drawImage(image, 0, 0)
      const quantized = quantizeImage(sheetCtx.getImageData(0, 0, sheet.width, sheet.height), sheet.width, sheet.height, mode.inkCount)
      const frames = []
      for (let fi = 0; fi < frameCount; fi++) {
        const startX = direction === 'horizontal' ? fi * step : 0
        const startY = direction === 'vertical' ? fi * step : 0
        const pixels = Array(normalizedW * normalizedH).fill(0)
        for (let y = 0; y < normalizedH; y++) {
          for (let x = 0; x < normalizedW; x++) {
            pixels[y * normalizedW + x] = quantized.pixels[(startY + y) * sheet.width + startX + x]
          }
        }
        frames.push({ pixels })
      }
      await onConfirm({ name: name.trim() || 'Imported Animation', videoMode, width: normalizedW, height: normalizedH, palette: quantized.palette, frames })
    } catch (err) {
      console.error(err)
      setError('Sprite sheet import failed.')
      setBusy(false)
    }
  }

  const optionStyle = active => ({ flex: 1, padding: '9px', cursor: 'pointer', borderRadius: '6px', border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`, background: active ? 'rgba(33,82,255,.07)' : 'transparent', color: active ? 'var(--accent)' : 'var(--text-dim)' })

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(52,71,103,.25)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="pixel-panel fade-up" style={{ width: '100%', maxWidth: '540px', maxHeight: '92vh', overflowY: 'auto', padding: '30px' }}>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '10px', color: 'var(--accent)', marginBottom: '20px' }}>IMPORT SPRITESHEET</div>

        <label className="pixel-label">Sprite name</label>
        <input className="pixel-input" value={name} maxLength={64} onChange={e => setName(e.target.value)} style={{ width: '100%', marginBottom: '14px' }} />

        <label className="pixel-label">Video mode</label>
        <div style={{ display: 'flex', gap: '7px', marginBottom: '14px' }}>
          {MODE_INFO.map(item => <button key={item.mode} style={optionStyle(videoMode === item.mode)} onClick={() => setVideoMode(item.mode)}>Mode {item.mode}<br /><small>{item.inkCount} inks</small></button>)}
        </div>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
          <div style={{ flex: 1 }}><label className="pixel-label">Frame width</label><input className="pixel-input" type="number" min={mode.multiple} value={frameW} onChange={e => setFrameW(Math.max(mode.multiple, Number(e.target.value) || mode.multiple))} style={{ width: '100%' }} /></div>
          <div style={{ flex: 1 }}><label className="pixel-label">Frame height</label><input className="pixel-input" type="number" min="1" value={frameH} onChange={e => setFrameH(Math.max(1, Number(e.target.value) || 1))} style={{ width: '100%' }} /></div>
          <div style={{ flex: 1 }}><label className="pixel-label">Spacing</label><input className="pixel-input" type="number" min="0" max="128" value={spacing} onChange={e => setSpacing(Math.max(0, Math.min(128, Number(e.target.value) || 0)))} style={{ width: '100%' }} /></div>
        </div>

        <div style={{ display: 'flex', gap: '7px', marginBottom: '14px' }}>
          <button style={optionStyle(direction === 'horizontal')} onClick={() => setDirection('horizontal')}>Horizontal →</button>
          <button style={optionStyle(direction === 'vertical')} onClick={() => setDirection('vertical')}>Vertical ↓</button>
        </div>

        <div style={{ minHeight: '80px', padding: '10px', display: 'flex', justifyContent: 'center', background: '#111820', overflow: 'hidden' }}>
          {image ? <canvas ref={previewRef} style={{ imageRendering: 'pixelated', maxWidth: '100%' }} /> : <span style={{ color: 'var(--text-dim)' }}>Loading…</span>}
        </div>
        <div style={{ marginTop: '10px', color: frameCount ? 'var(--text)' : 'var(--red)', fontSize: '12px' }}>
          {image && `${image.naturalWidth}×${image.naturalHeight}px · ${frameCount} frame${frameCount === 1 ? '' : 's'} detected`}
          {frameCount > 0 && usedSize !== axisSize && <span style={{ color: 'var(--amber)' }}> · unused pixels at end</span>}
        </div>
        {normalizedW !== frameW && <div style={{ color: 'var(--amber)', fontSize: '11px', marginTop: '6px' }}>Width adjusted to {normalizedW}px for Mode {videoMode}.</div>}
        {error && <div style={{ color: 'var(--red)', marginTop: '8px' }}>{error}</div>}

        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          <button className="btn-pixel" disabled={busy || frameCount < 1} onClick={handleConfirm} style={{ flex: 1 }}>{busy ? 'IMPORTING…' : `IMPORT ${frameCount || ''} FRAMES`}</button>
          <button className="btn-ghost" onClick={onCancel} style={{ flex: 1 }}>CANCEL</button>
        </div>
      </div>
    </div>
  )
}
