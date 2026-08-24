export const SPRITE_SCHEMA_VERSION = 2
export const TRANSPARENT_INK = -1
export const BASE_LAYER_ID = 'base'

export function createLayer({ id, name, visible = true, locked = false }) {
  if (!id) throw new Error('A layer id is required.')
  return { id, name: name?.trim() || 'Layer', visible, locked }
}

export function createTransparentPixels(width, height) {
  return Array(width * height).fill(TRANSPARENT_INK)
}

export function createCel(width, height, pixels = null) {
  const expectedLength = width * height
  const celPixels = pixels ? [...pixels] : createTransparentPixels(width, height)
  if (celPixels.length !== expectedLength) {
    throw new Error(`Cel contains ${celPixels.length} pixels; expected ${expectedLength}.`)
  }
  return { pixels: celPixels }
}

export function createLayeredFrame(layers, width, height) {
  return {
    cels: Object.fromEntries(layers.map(layer => [layer.id, createCel(width, height)])),
  }
}

export function migrateLegacySprite(sprite) {
  if (!sprite) return sprite
  if (sprite.schemaVersion === SPRITE_SCHEMA_VERSION && Array.isArray(sprite.layers)) {
    return {
      ...sprite,
      layers: sprite.layers.map(layer => ({ ...layer })),
      frames: (sprite.frames ?? []).map(frame => ({
        ...frame,
        cels: Object.fromEntries(Object.entries(frame.cels ?? {}).map(([layerId, cel]) => [
          layerId,
          { ...cel, pixels: [...(cel.pixels ?? [])] },
        ])),
      })),
    }
  }

  const baseLayer = createLayer({ id: BASE_LAYER_ID, name: 'Layer 1' })
  return {
    ...sprite,
    schemaVersion: SPRITE_SCHEMA_VERSION,
    layers: [baseLayer],
    frames: (sprite.frames ?? []).map(frame => {
      const { pixels, ...frameData } = frame
      return {
        ...frameData,
        cels: { [BASE_LAYER_ID]: createCel(sprite.width, sprite.height, pixels) },
      }
    }),
  }
}

export function compositeFrame(sprite, frameIndex, backgroundInk = 0) {
  const pixelCount = sprite.width * sprite.height
  const output = Array(pixelCount).fill(backgroundInk)
  const frame = sprite.frames?.[frameIndex]
  if (!frame) return output

  for (const layer of sprite.layers ?? []) {
    if (!layer.visible) continue
    const pixels = frame.cels?.[layer.id]?.pixels
    if (!pixels) continue
    for (let index = 0; index < pixelCount; index++) {
      const ink = pixels[index]
      if (ink !== TRANSPARENT_INK && ink != null) output[index] = ink
    }
  }
  return output
}

// Temporary compatibility view used while the editor is being migrated in
// phases. The persisted source of truth remains `cels`; `pixels` is a composed
// working buffer understood by the current single-layer editor.
export function prepareSpriteForEditor(sprite) {
  const layered = migrateLegacySprite(sprite)
  if (!layered) return layered
  const editableLayerId = layered.layers[0]?.id ?? BASE_LAYER_ID
  return {
    ...layered,
    activeLayerId: editableLayerId,
    frames: layered.frames.map(frame => ({
      ...frame,
      pixels: [...(frame.cels?.[editableLayerId]?.pixels ?? createTransparentPixels(layered.width, layered.height))],
    })),
  }
}

export function compositeEditorFrame(sprite, frameIndex, backgroundInk = 0) {
  const frame = sprite.frames?.[frameIndex]
  if (!frame?.pixels) return compositeFrame(sprite, frameIndex, backgroundInk)
  const editableLayerId = sprite.activeLayerId ?? sprite.layers?.[0]?.id ?? BASE_LAYER_ID
  const projected = {
    ...sprite,
    frames: sprite.frames.map((candidate, index) => index === frameIndex ? {
      ...candidate,
      cels: {
        ...(candidate.cels ?? {}),
        [editableLayerId]: { ...(candidate.cels?.[editableLayerId] ?? {}), pixels: candidate.pixels },
      },
    } : candidate),
  }
  return compositeFrame(projected, frameIndex, backgroundInk)
}

export function prepareSpriteForStorage(sprite) {
  const layered = migrateLegacySprite(sprite)
  if (!layered) return layered
  const editableLayerId = sprite.activeLayerId ?? layered.layers[0]?.id ?? BASE_LAYER_ID
  return {
    ...layered,
    schemaVersion: SPRITE_SCHEMA_VERSION,
    frames: layered.frames.map(frame => {
      const { pixels, ...frameData } = frame
      const cels = Object.fromEntries(Object.entries(frame.cels ?? {}).map(([layerId, cel]) => [
        layerId,
        { ...cel, pixels: [...(cel.pixels ?? [])] },
      ]))
      if (pixels) cels[editableLayerId] = createCel(layered.width, layered.height, pixels)
      if (!cels[editableLayerId]) cels[editableLayerId] = createCel(layered.width, layered.height)
      return { ...frameData, cels }
    }),
  }
}

export function commitWorkingLayer(sprite) {
  if (!sprite) return sprite
  const activeLayerId = sprite.activeLayerId ?? sprite.layers?.[0]?.id
  if (!activeLayerId) return sprite
  return {
    ...sprite,
    frames: sprite.frames.map(frame => ({
      ...frame,
      cels: {
        ...(frame.cels ?? {}),
        [activeLayerId]: createCel(sprite.width, sprite.height, frame.pixels),
      },
    })),
  }
}

export function selectEditorLayer(sprite, layerId) {
  if (!sprite?.layers?.some(layer => layer.id === layerId)) return sprite
  const committed = commitWorkingLayer(sprite)
  return {
    ...committed,
    activeLayerId: layerId,
    frames: committed.frames.map(frame => ({
      ...frame,
      pixels: [...(frame.cels?.[layerId]?.pixels ?? createTransparentPixels(sprite.width, sprite.height))],
    })),
  }
}

export function addEditorLayer(sprite, layer, { duplicateActive = false } = {}) {
  const committed = commitWorkingLayer(sprite)
  const activeIndex = Math.max(0, committed.layers.findIndex(item => item.id === committed.activeLayerId))
  const layers = [...committed.layers]
  layers.splice(activeIndex + 1, 0, createLayer(layer))
  const frames = committed.frames.map(frame => {
    const pixels = duplicateActive
      ? [...(frame.cels?.[committed.activeLayerId]?.pixels ?? createTransparentPixels(sprite.width, sprite.height))]
      : createTransparentPixels(sprite.width, sprite.height)
    return {
      ...frame,
      pixels,
      cels: { ...(frame.cels ?? {}), [layer.id]: createCel(sprite.width, sprite.height, pixels) },
    }
  })
  return { ...committed, layers, frames, activeLayerId: layer.id }
}

export function deleteEditorLayer(sprite, layerId) {
  if (!sprite || sprite.layers.length <= 1) return sprite
  const committed = commitWorkingLayer(sprite)
  const removedIndex = committed.layers.findIndex(layer => layer.id === layerId)
  if (removedIndex < 0) return sprite
  const layers = committed.layers.filter(layer => layer.id !== layerId)
  const nextLayer = layers[Math.min(removedIndex, layers.length - 1)]
  const frames = committed.frames.map(frame => {
    const cels = { ...(frame.cels ?? {}) }
    delete cels[layerId]
    return { ...frame, cels, pixels: [...(cels[nextLayer.id]?.pixels ?? createTransparentPixels(sprite.width, sprite.height))] }
  })
  return { ...committed, layers, frames, activeLayerId: nextLayer.id }
}

export function moveEditorLayer(sprite, layerId, offset) {
  const committed = commitWorkingLayer(sprite)
  const index = committed.layers.findIndex(layer => layer.id === layerId)
  const target = index + offset
  if (index < 0 || target < 0 || target >= committed.layers.length) return committed
  const layers = [...committed.layers]
  const [layer] = layers.splice(index, 1)
  layers.splice(target, 0, layer)
  return { ...committed, layers }
}

export function mergeEditorLayerDown(sprite, layerId = sprite?.activeLayerId) {
  if (!sprite || sprite.layers.length <= 1) return sprite
  const committed = commitWorkingLayer(sprite)
  const upperIndex = committed.layers.findIndex(layer => layer.id === layerId)
  if (upperIndex <= 0) return committed
  const upperLayer = committed.layers[upperIndex]
  const lowerLayer = committed.layers[upperIndex - 1]
  if (upperLayer.locked || lowerLayer.locked) return committed

  const layers = committed.layers.filter(layer => layer.id !== upperLayer.id)
  const frames = committed.frames.map(frame => {
    const lowerPixels = frame.cels?.[lowerLayer.id]?.pixels ?? createTransparentPixels(sprite.width, sprite.height)
    const upperPixels = frame.cels?.[upperLayer.id]?.pixels ?? createTransparentPixels(sprite.width, sprite.height)
    const pixels = lowerPixels.map((ink, index) => {
      const lowerInk = lowerLayer.visible ? ink : TRANSPARENT_INK
      const upperInk = upperLayer.visible ? upperPixels[index] : TRANSPARENT_INK
      return upperInk === TRANSPARENT_INK || upperInk == null ? lowerInk : upperInk
    })
    const cels = { ...(frame.cels ?? {}), [lowerLayer.id]: createCel(sprite.width, sprite.height, pixels) }
    delete cels[upperLayer.id]
    return { ...frame, cels, pixels: [...pixels] }
  })
  const mergedLayers = layers.map(layer => layer.id === lowerLayer.id
    ? { ...layer, visible: lowerLayer.visible || upperLayer.visible }
    : layer)
  return { ...committed, layers: mergedLayers, frames, activeLayerId: lowerLayer.id }
}

export function mergeVisibleEditorLayers(sprite) {
  if (!sprite) return sprite
  const committed = commitWorkingLayer(sprite)
  const visibleLayers = committed.layers.filter(layer => layer.visible)
  if (visibleLayers.length < 2 || visibleLayers.some(layer => layer.locked)) return committed
  const destination = visibleLayers[visibleLayers.length - 1]
  const visibleIds = new Set(visibleLayers.map(layer => layer.id))
  const layers = [
    ...committed.layers.filter(layer => !visibleIds.has(layer.id)),
    { ...destination, name: 'Merged Visible', visible: true, locked: false },
  ]
  const frames = committed.frames.map((frame, frameIndex) => {
    const pixels = compositeFrame(committed, frameIndex, TRANSPARENT_INK)
    const cels = Object.fromEntries(Object.entries(frame.cels ?? {}).filter(([layerId]) => !visibleIds.has(layerId)))
    cels[destination.id] = createCel(sprite.width, sprite.height, pixels)
    return { ...frame, cels, pixels: [...pixels] }
  })
  return { ...committed, layers, frames, activeLayerId: destination.id }
}

export function flattenEditorLayers(sprite) {
  if (!sprite) return sprite
  const committed = commitWorkingLayer(sprite)
  if (committed.layers.some(layer => layer.locked)) return committed
  const destination = [...committed.layers].reverse().find(layer => layer.visible) ?? committed.layers[0]
  if (!destination) return committed
  const layer = { ...destination, name: 'Flattened', visible: true, locked: false }
  const frames = committed.frames.map((frame, frameIndex) => {
    const pixels = compositeFrame(committed, frameIndex, TRANSPARENT_INK)
    return { ...frame, cels: { [layer.id]: createCel(sprite.width, sprite.height, pixels) }, pixels: [...pixels] }
  })
  return { ...committed, layers: [layer], frames, activeLayerId: layer.id }
}
