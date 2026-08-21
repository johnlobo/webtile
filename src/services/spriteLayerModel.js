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
  return {
    ...layered,
    frames: layered.frames.map((frame, frameIndex) => ({
      ...frame,
      pixels: compositeFrame(layered, frameIndex),
    })),
  }
}

export function prepareSpriteForStorage(sprite) {
  const layered = migrateLegacySprite(sprite)
  if (!layered) return layered
  const editableLayerId = layered.layers[0]?.id ?? BASE_LAYER_ID
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
