import {
  collection, doc, setDoc, getDoc, getDocs,
  deleteDoc, serverTimestamp, query, orderBy,
} from 'firebase/firestore'
import { db } from '../firebase'

// ── Default palettes per video mode ──────────────────────────────────────────

const DEFAULT_PALETTES = {
  0: [0, 26, 6, 18, 3, 11, 24, 15, 8, 20, 4, 2, 21, 5, 16, 13],
  1: [0, 26, 6, 18],
  2: [0, 26],
}

// ── Firestore refs ────────────────────────────────────────────────────────────

const spritesCol = (uid, pid)       => collection(db, 'users', uid, 'projects', pid, 'sprites')
const spriteDoc  = (uid, pid, sid)  => doc(spritesCol(uid, pid), sid)

// ── Sprite API ────────────────────────────────────────────────────────────────

/**
 * Create a new sprite in a project.
 * Returns the generated Firestore sprite ID.
 */
export async function createSprite(userId, projectId, { name, videoMode, width, height }) {
  const inkCount = videoMode === 0 ? 16 : videoMode === 1 ? 4 : 2
  const palette  = DEFAULT_PALETTES[videoMode] ?? DEFAULT_PALETTES[0]

  const ref = doc(spritesCol(userId, projectId))
  await setDoc(ref, {
    name,
    videoMode,
    width,
    height,
    palette: palette.slice(0, inkCount),
    frames: [{ pixels: Array(width * height).fill(0) }],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

/**
 * Load a full sprite document. Returns null if not found.
 */
export async function loadSprite(userId, projectId, spriteId) {
  const snap = await getDoc(spriteDoc(userId, projectId, spriteId))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() }
}

/**
 * Save (overwrite) sprite data. Does NOT include id or timestamps.
 */
export async function saveSprite(userId, projectId, spriteId, data) {
  const { name, videoMode, width, height, palette, frames } = data
  await setDoc(spriteDoc(userId, projectId, spriteId), {
    name,
    videoMode,
    width,
    height,
    palette,
    frames,
    updatedAt: serverTimestamp(),
  }, { merge: true })
}

/**
 * List all sprites in a project (summaries, no pixel data). Ordered by creation.
 */
export async function listSprites(userId, projectId) {
  const q    = query(spritesCol(userId, projectId), orderBy('createdAt', 'asc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({
    id:        d.id,
    name:      d.data().name,
    videoMode: d.data().videoMode,
    width:     d.data().width,
    height:    d.data().height,
    updatedAt: d.data().updatedAt?.toDate?.() ?? null,
  }))
}

/**
 * Create a sprite from an imported PNG (pre-quantized pixel data).
 * Returns the generated Firestore sprite ID.
 */
export async function createSpriteFromImport(userId, projectId, { name, videoMode, width, height, palette, pixels }) {
  const ref = doc(spritesCol(userId, projectId))
  await setDoc(ref, {
    name,
    videoMode,
    width,
    height,
    palette,
    frames: [{ pixels }],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

/**
 * Delete a sprite document.
 */
export async function deleteSprite(userId, projectId, spriteId) {
  await deleteDoc(spriteDoc(userId, projectId, spriteId))
}
