const CPC_COLORS = [
  '#000000', '#000080', '#0000FF', '#800000', '#800080', '#8000FF',
  '#FF0000', '#FF0080', '#FF00FF', '#008000', '#008080', '#0080FF',
  '#808000', '#808080', '#8080FF', '#FF8000', '#FF8080', '#FF80FF',
  '#00FF00', '#00FF80', '#00FFFF', '#80FF00', '#80FF80', '#80FFFF',
  '#FFFF00', '#FFFF80', '#FFFFFF',
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

const GLYPH_W = 2
const GLYPH_H = 9
const CHAR_COUNT = 47

const CHAR_MAP = {}
CHAR_MAP[33] = 0
for (let i = 0; i < 10; i++) CHAR_MAP[48 + i] = 9 + i
for (let i = 0; i < 6; i++) CHAR_MAP[58 + i] = 14 + i
for (let i = 0; i < 28; i++) CHAR_MAP[64 + i] = 20 + i

let fontImage = null
let glyphs = null
let loading = false
let loadPromise = null

export async function loadFont() {
  if (glyphs) return glyphs
  if (loading && loadPromise) return loadPromise
  loading = true
  loadPromise = new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      fontImage = img
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      const imageData = ctx.getImageData(0, 0, img.width, img.height)
      const data = imageData.data

      glyphs = []
      for (let c = 0; c < CHAR_COUNT; c++) {
        const glyph = []
        for (let y = 0; y < GLYPH_H; y++) {
          for (let x = 0; x < GLYPH_W; x++) {
            const px = x
            const py = c * GLYPH_H + y
            const idx = (py * img.width + px) * 4
            const r = data[idx]
            const g = data[idx + 1]
            const b = data[idx + 2]
            const a = data[idx + 3]
            if (a < 128) {
              glyph.push(0)
            } else {
              glyph.push(nearestCpcColor(r, g, b))
            }
          }
        }
        glyphs.push(glyph)
      }
      loading = false
      resolve(glyphs)
    }
    img.onerror = () => {
      loading = false
      reject(new Error('Failed to load font image'))
    }
    img.src = '/font_chars_0.png'
  })
  return loadPromise
}

export function getCharIndex(charCode) {
  return CHAR_MAP[charCode]
}

export function getGlyph(charIndex) {
  if (!glyphs) return null
  if (charIndex < 0 || charIndex >= CHAR_COUNT) return null
  return glyphs[charIndex]
}

export function stampText(pixels, spriteWidth, spriteHeight, startX, startY, text, ink) {
  const result = [...pixels]
  let x = startX
  const upper = text.toUpperCase()
  for (let i = 0; i < upper.length; i++) {
    const code = upper.charCodeAt(i)
    if (code === 32) {
      x += GLYPH_W
      continue
    }
    const charIdx = CHAR_MAP[code]
    if (charIdx === undefined || !glyphs) {
      x += GLYPH_W
      continue
    }
    const glyph = glyphs[charIdx]
    if (!glyph) {
      x += GLYPH_W
      continue
    }
    for (let gy = 0; gy < GLYPH_H; gy++) {
      for (let gx = 0; gx < GLYPH_W; gx++) {
        const px = x + gx
        const py = startY + gy
        if (px < 0 || py < 0 || px >= spriteWidth || py >= spriteHeight) continue
        const val = glyph[gy * GLYPH_W + gx]
        if (val !== 0) {
          result[py * spriteWidth + px] = ink
        }
      }
    }
    x += GLYPH_W
  }
  return result
}
