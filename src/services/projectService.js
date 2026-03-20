import {
  collection, doc, setDoc, getDoc, getDocs,
  deleteDoc, serverTimestamp, query, orderBy,
} from 'firebase/firestore'
import { db } from '../firebase'

// ── Tile encoding ──────────────────────────────────────────────────────────────
// Flat int array: -1 = empty, otherwise (tileRow * 1000 + tileCol)

function encodeTiles(mapTiles) {
  return mapTiles.flat().map(t => (t ? t.row * 1000 + t.col : -1))
}

function decodeTiles(flat, mapW, mapH, tilesetCols) {
  const grid = []
  for (let r = 0; r < mapH; r++) {
    const row = []
    for (let c = 0; c < mapW; c++) {
      const v = flat[r * mapW + c]
      if (v === -1 || v == null) {
        row.push(null)
      } else {
        const tCol = v % 1000
        const tRow = Math.floor(v / 1000)
        row.push({ col: tCol, row: tRow, idx: tRow * tilesetCols + tCol })
      }
    }
    grid.push(row)
  }
  return grid
}

// ── Tileset image helpers ──────────────────────────────────────────────────────

async function toBase64DataUrl(url) {
  if (url.startsWith('data:')) return url
  const blob = await fetch(url).then(r => r.blob())
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload  = () => resolve(img)
    img.onerror = reject
    img.src     = src
  })
}

// ── Firestore refs ─────────────────────────────────────────────────────────────

const projectsCol      = (uid)           => collection(db, 'users', uid, 'projects')
const projectDoc       = (uid, pid)      => doc(projectsCol(uid), pid)
const mapsCol          = (uid, pid)      => collection(db, 'users', uid, 'projects', pid, 'maps')
const mapDoc           = (uid, pid, mid) => doc(mapsCol(uid, pid), mid)
const mapTilesetDoc    = (uid, pid, mid) => doc(db, 'users', uid, 'projects', pid, 'maps', mid, 'assets', 'tileset')
const oldTilesetDoc    = (uid, pid)      => doc(db, 'users', uid, 'projects', pid, 'assets', 'tileset')

// ── Old-schema migration ────────────────────────────────────────────────────────
// Pre-restructure projects stored map config inline in the project doc and tileset
// at projects/{pid}/assets/tileset. Migrate to the new subcollection schema on load.

async function migrateOldProject(userId, projectId, oldData) {
  // Skip if already migrated (maps subcollection already has docs)
  const existing = await getDocs(mapsCol(userId, projectId))
  if (existing.size > 0) return

  const mapRef  = doc(mapsCol(userId, projectId))
  const mapTiles = Array.isArray(oldData.mapTiles)
    ? oldData.mapTiles
    : Array((oldData.mapW || 16) * (oldData.mapH || 20)).fill(-1)

  await setDoc(mapRef, {
    name:        oldData.name || 'Map 1',
    tileW:       oldData.tileW,
    tileH:       oldData.tileH,
    mapW:        oldData.mapW,
    mapH:        oldData.mapH,
    doubleWidth: oldData.doubleWidth ?? false,
    mapTiles,
    hasTileset:  oldData.hasTileset ?? false,
    createdAt:   serverTimestamp(),
    updatedAt:   serverTimestamp(),
  })

  if (oldData.hasTileset) {
    try {
      const tsSnap = await getDoc(oldTilesetDoc(userId, projectId))
      if (tsSnap.exists()) {
        await setDoc(mapTilesetDoc(userId, projectId, mapRef.id), tsSnap.data())
      }
    } catch (_) {}
  }
}

// ── Project API ────────────────────────────────────────────────────────────────

/** Create a new project (name only). Returns generated Firestore ID. */
export async function createProject(userId, { name }) {
  const ref = doc(projectsCol(userId))
  await setDoc(ref, {
    name,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

/** Load project metadata (name only). Migrates old schema if needed. Returns null if not found. */
export async function loadProject(userId, projectId) {
  const snap = await getDoc(projectDoc(userId, projectId))
  if (!snap.exists()) return null
  const d = snap.data()
  // Detect and migrate old single-map schema (tileW stored directly on project doc)
  if (d.tileW != null) {
    await migrateOldProject(userId, projectId, d)
  }
  return { id: projectId, name: d.name }
}

/** List all projects for a user, newest first. */
export async function listProjects(userId) {
  const q    = query(projectsCol(userId), orderBy('updatedAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({
    id:        d.id,
    name:      d.data().name,
    updatedAt: d.data().updatedAt?.toDate?.() ?? null,
  }))
}

/** Delete a project and all its maps. */
export async function deleteProject(userId, projectId) {
  // Best-effort: delete maps subcollection and old-schema assets
  try {
    const msnap = await getDocs(mapsCol(userId, projectId))
    for (const md of msnap.docs) {
      try { await deleteDoc(mapTilesetDoc(userId, projectId, md.id)) } catch (_) {}
      try { await deleteDoc(md.ref) } catch (_) {}
    }
  } catch (_) {}
  try { await deleteDoc(oldTilesetDoc(userId, projectId)) } catch (_) {}
  // Critical: delete the project document itself
  await deleteDoc(projectDoc(userId, projectId))
}

// ── Map API ────────────────────────────────────────────────────────────────────

/** Create a new map in a project. Returns mapId. */
export async function createMap(userId, projectId, { name, tileW, tileH, mapW, mapH, doubleWidth = false }) {
  const ref = doc(mapsCol(userId, projectId))
  await setDoc(ref, {
    name,
    tileW, tileH, mapW, mapH,
    doubleWidth,
    mapTiles:   Array(mapW * mapH).fill(-1),
    hasTileset: false,
    createdAt:  serverTimestamp(),
    updatedAt:  serverTimestamp(),
  })
  await setDoc(projectDoc(userId, projectId), { updatedAt: serverTimestamp() }, { merge: true })
  return ref.id
}

/** Save (update) a map's tile data and config. */
export async function saveMap(userId, projectId, mapId, { name, config, mapTiles, tileset, tilesetBlobUrl }) {
  const updates = {
    name,
    ...config,
    mapTiles:  encodeTiles(mapTiles),
    updatedAt: serverTimestamp(),
  }

  if (tilesetBlobUrl) {
    const base64 = await toBase64DataUrl(tilesetBlobUrl)
    await setDoc(mapTilesetDoc(userId, projectId, mapId), {
      data:     base64,
      naturalW: tileset.naturalW,
      naturalH: tileset.naturalH,
    })
    updates.hasTileset = true
  }

  await setDoc(mapDoc(userId, projectId, mapId), updates, { merge: true })
  await setDoc(projectDoc(userId, projectId), { updatedAt: serverTimestamp() }, { merge: true })
}

/** Load a full map (config + mapTiles + tileset image). Returns null if not found. */
export async function loadMap(userId, projectId, mapId) {
  const snap = await getDoc(mapDoc(userId, projectId, mapId))
  if (!snap.exists()) return null
  const d = snap.data()

  const config = {
    tileW: d.tileW, tileH: d.tileH,
    mapW:  d.mapW,  mapH:  d.mapH,
    doubleWidth: d.doubleWidth ?? false,
  }

  let tileset = null
  if (d.hasTileset) {
    const tsSnap = await getDoc(mapTilesetDoc(userId, projectId, mapId))
    if (tsSnap.exists()) {
      const ts   = tsSnap.data()
      const img  = await loadImage(ts.data)
      const cols = Math.floor(ts.naturalW / d.tileW)
      const rows = Math.floor(ts.naturalH / d.tileH)
      const canvas = document.createElement('canvas')
      canvas.width  = ts.naturalW
      canvas.height = ts.naturalH
      canvas.getContext('2d').drawImage(img, 0, 0)
      tileset = { url: ts.data, img, canvas, cols, rows, naturalW: ts.naturalW, naturalH: ts.naturalH }
    }
  }

  const mapTiles = decodeTiles(d.mapTiles, d.mapW, d.mapH, tileset?.cols ?? 1)
  return { id: mapId, name: d.name, config, mapTiles, tileset }
}

/** List all maps in a project (summaries only, no tile data). Ordered by creation. */
export async function listMaps(userId, projectId) {
  const q    = query(mapsCol(userId, projectId), orderBy('createdAt', 'asc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({
    id:        d.id,
    name:      d.data().name,
    tileW:     d.data().tileW,
    tileH:     d.data().tileH,
    mapW:      d.data().mapW,
    mapH:      d.data().mapH,
    updatedAt: d.data().updatedAt?.toDate?.() ?? null,
  }))
}

/** Delete a map and its tileset sub-document. */
export async function deleteMap(userId, projectId, mapId) {
  try { await deleteDoc(mapTilesetDoc(userId, projectId, mapId)) } catch (_) {}
  await deleteDoc(mapDoc(userId, projectId, mapId))
}
