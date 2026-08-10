import {
  collection, doc, setDoc, getDoc, getDocs, updateDoc, arrayUnion, arrayRemove, deleteDoc,
} from 'firebase/firestore'
import { db } from '../firebase'

const projectsCol = (uid) => collection(db, 'users', uid, 'projects')
const projectDoc  = (uid, pid) => doc(projectsCol(uid), pid)
const pageDoc     = (uid, pid, pageId) => doc(db, 'users', uid, 'projects', pid, 'pages', pageId)
const pageTilesetDoc = (uid, pid, pageId) => doc(pageDoc(uid, pid, pageId), 'assets', 'tileset')

export const DEFAULT_PAGE_ID = 'base'

export async function createDefaultPages(userId, projectId) {
  await updateDoc(projectDoc(userId, projectId), {
    pages: [{ id: DEFAULT_PAGE_ID, label: 'Base', roomIds: [] }],
  })
}

export async function loadPages(userId, projectId) {
  const snap = await getDoc(projectDoc(userId, projectId))
  if (!snap.exists()) return []
  return snap.data().pages ?? []
}

export async function addPage(userId, projectId, page) {
  const pagesSnap = await getDoc(projectDoc(userId, projectId))
  const pages = pagesSnap.data()?.pages ?? []
  const newPage = {
    id: page.id || `page-${Date.now()}`,
    label: page.label || `Page ${pages.length + 1}`,
    roomIds: page.roomIds ?? [],
  }
  await updateDoc(projectDoc(userId, projectId), {
    pages: arrayUnion(newPage),
  })
  return newPage
}

export async function renamePage(userId, projectId, pageId, label) {
  const snap = await getDoc(projectDoc(userId, projectId))
  const pages = (snap.data()?.pages ?? []).map(p =>
    p.id === pageId ? { ...p, label } : p,
  )
  await updateDoc(projectDoc(userId, projectId), { pages })
}

export async function assignRoomToPage(userId, projectId, pageId, roomId) {
  const snap = await getDoc(projectDoc(userId, projectId))
  const pages = (snap.data()?.pages ?? []).map(p => {
    if (p.id !== pageId) return p
    const roomIds = Array.isArray(p.roomIds) ? [...p.roomIds] : []
    if (!roomIds.includes(roomId)) roomIds.push(roomId)
    return { ...p, roomIds }
  })
  await updateDoc(projectDoc(userId, projectId), { pages })
}

export async function removeRoomFromPage(userId, projectId, pageId, roomId) {
  const snap = await getDoc(projectDoc(userId, projectId))
  const pages = (snap.data()?.pages ?? []).map(p => {
    if (p.id !== pageId) return p
    return { ...p, roomIds: (p.roomIds ?? []).filter(id => id !== roomId) }
  })
  await updateDoc(projectDoc(userId, projectId), { pages })
}

export async function deletePage(userId, projectId, pageId) {
  const snap = await getDoc(projectDoc(userId, projectId))
  const pages = (snap.data()?.pages ?? []).filter(p => p.id !== pageId)
  await updateDoc(projectDoc(userId, projectId), { pages })
}

export async function savePageTileset(userId, projectId, pageId, tileset) {
  if (!tileset) return
  const base64 = tileset.url?.startsWith('data:')
    ? tileset.url
    : await fetch(tileset.url).then(r => r.blob()).then(blob => new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload  = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      }))
  await setDoc(pageTilesetDoc(userId, projectId, pageId), {
    data:     base64,
    naturalW: tileset.naturalW,
    naturalH: tileset.naturalH,
  })
}

export async function loadPageTileset(userId, projectId, pageId) {
  try {
    const tsSnap = await getDoc(pageTilesetDoc(userId, projectId, pageId))
    if (!tsSnap.exists()) return null
    const ts = tsSnap.data()
    const img = await loadImage(ts.data)
    const canvas = document.createElement('canvas')
    canvas.width  = ts.naturalW
    canvas.height = ts.naturalH
    canvas.getContext('2d').drawImage(img, 0, 0)
    return {
      url: ts.data, img, canvas,
      naturalW: ts.naturalW, naturalH: ts.naturalH,
    }
  } catch (_) {
    return null
  }
}

export async function deletePageTileset(userId, projectId, pageId) {
  try { await deleteDoc(pageTilesetDoc(userId, projectId, pageId)) } catch (_) {}
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Invalid tileset image.'))
    img.src = src
  })
}
