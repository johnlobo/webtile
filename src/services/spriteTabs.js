export function reorderSpriteTabs(ids, sourceId, targetId) {
  const sourceIndex = ids.indexOf(sourceId)
  const targetIndex = ids.indexOf(targetId)
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return ids
  const reordered = [...ids]
  const [source] = reordered.splice(sourceIndex, 1)
  reordered.splice(targetIndex, 0, source)
  return reordered
}

export function activeTabAfterClose(ids, activeId, closedId) {
  if (activeId !== closedId) return activeId
  const index = ids.indexOf(closedId)
  const remaining = ids.filter(id => id !== closedId)
  return remaining[Math.min(Math.max(0, index), remaining.length - 1)] ?? null
}

export function restoreSpriteTabs(serialized, validIds) {
  try {
    const stored = JSON.parse(serialized)
    const valid = new Set(validIds)
    const openSpriteIds = [...new Set(Array.isArray(stored?.openSpriteIds) ? stored.openSpriteIds : [])].filter(id => valid.has(id))
    const activeSpriteId = openSpriteIds.includes(stored?.activeSpriteId) ? stored.activeSpriteId : null
    return { openSpriteIds, activeSpriteId }
  } catch (_) {
    return { openSpriteIds: [], activeSpriteId: null }
  }
}
