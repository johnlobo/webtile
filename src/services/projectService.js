import {
  collection, doc, setDoc, getDoc, getDocs,
  deleteDoc, serverTimestamp, query, orderBy,
} from 'firebase/firestore'
import { db } from '../firebase'
import { GENERIC_PROFILE_ID, normalizeProfileId } from '../model01Profile'

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
const pageTilesetDoc   = (uid, pid, pageId) => doc(db, 'users', uid, 'projects', pid, 'pages', pageId, 'assets', 'tileset')

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

/** Create a new project. Returns generated Firestore ID. */
export async function createProject(userId, { name, profileId = GENERIC_PROFILE_ID }) {
  const ref = doc(projectsCol(userId))
  await setDoc(ref, {
    name,
    profileId: normalizeProfileId(profileId),
    pages: [{ id: 'base', label: 'Base', roomIds: [] }],
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
  return {
    id: projectId,
    name: d.name,
    profileId: normalizeProfileId(d.profileId),
    pages: d.pages ?? [],
  }
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
  try {
    const projSnap = await getDoc(projectDoc(userId, projectId))
    const pages = projSnap.data()?.pages ?? []
    for (const p of pages) {
      try { await deleteDoc(pageTilesetDoc(userId, projectId, p.id)) } catch (_) {}
    }
  } catch (_) {}
  try {
    const msnap = await getDocs(mapsCol(userId, projectId))
    for (const md of msnap.docs) {
      try { await deleteDoc(md.ref) } catch (_) {}
    }
  } catch (_) {}
  try { await deleteDoc(oldTilesetDoc(userId, projectId)) } catch (_) {}
  await deleteDoc(projectDoc(userId, projectId))
}

// ── Map API ────────────────────────────────────────────────────────────────────

/** Create a new map in a project. Returns mapId. */
export async function createMap(userId, projectId, { name, tileW, tileH, mapW, mapH, doubleWidth = false, roomId, pageId, spawns = 0, connections = {}, entryPositions = [], entities = [], scripts = {} }) {
  const ref = doc(mapsCol(userId, projectId))
  await setDoc(ref, {
    name,
    tileW, tileH, mapW, mapH,
    doubleWidth,
    roomId: roomId ?? null,
    pageId: pageId ?? null,
    spawns,
    connections,
    entryPositions,
    entities,
    scripts,
    mapTiles:   Array(mapW * mapH).fill(-1),
    hasTileset: false,
    createdAt:  serverTimestamp(),
    updatedAt:  serverTimestamp(),
  })
  await setDoc(projectDoc(userId, projectId), { updatedAt: serverTimestamp() }, { merge: true })
  return ref.id
}

/** Save (update) a map's tile data and config. */
export async function saveMap(userId, projectId, mapId, { name, config, mapTiles, roomId, pageId, spawns, connections, entryPositions, entities, scripts }) {
  const updates = {
    name,
    ...config,
    mapTiles:  encodeTiles(mapTiles),
    updatedAt: serverTimestamp(),
  }

  if (roomId !== undefined)       updates.roomId = roomId
  if (pageId !== undefined)       updates.pageId = pageId
  if (spawns !== undefined)       updates.spawns = spawns
  if (connections !== undefined)  updates.connections = connections
  if (entryPositions !== undefined) updates.entryPositions = entryPositions
  if (entities !== undefined)     updates.entities = entities
  if (scripts !== undefined)      updates.scripts = scripts

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
  if (d.pageId) {
    const tsSnap = await getDoc(pageTilesetDoc(userId, projectId, d.pageId))
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
  if (!tileset) {
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
  return {
    id: mapId,
    name: d.name,
    config,
    mapTiles,
    tileset,
    roomId: d.roomId ?? null,
    pageId: d.pageId ?? null,
    spawns: d.spawns ?? [],
    connections: d.connections ?? {},
    entryPositions: d.entryPositions ?? [],
    entities: d.entities ?? [],
    scripts: d.scripts ?? {},
  }
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
    roomId:    d.data().roomId ?? null,
    pageId:    d.data().pageId ?? null,
    spawns:    d.data().spawns ?? 0,
    entities:  d.data().entities ?? [],
    updatedAt: d.data().updatedAt?.toDate?.() ?? null,
  }))
}

/** Delete a map. */
export async function deleteMap(userId, projectId, mapId) {
  await deleteDoc(mapDoc(userId, projectId, mapId))
}
