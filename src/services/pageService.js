import {
  collection, doc, setDoc, getDoc, getDocs, updateDoc, arrayUnion, arrayRemove,
} from 'firebase/firestore'
import { db } from '../firebase'

const projectsCol = (uid) => collection(db, 'users', uid, 'projects')
const projectDoc  = (uid, pid) => doc(projectsCol(uid), pid)

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
