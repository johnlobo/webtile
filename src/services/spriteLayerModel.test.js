import { describe, expect, it } from 'vitest'
import {
  BASE_LAYER_ID,
  SPRITE_SCHEMA_VERSION,
  TRANSPARENT_INK,
  compositeFrame,
  createCel,
  createLayer,
  createLayeredFrame,
  migrateLegacySprite,
  prepareSpriteForEditor,
  prepareSpriteForStorage,
} from './spriteLayerModel'

describe('sprite layer model', () => {
  it('migrates legacy frames without mutating them or treating INK 0 as transparent', () => {
    const legacy = { width: 2, height: 1, frames: [{ pixels: [0, 3] }] }
    const migrated = migrateLegacySprite(legacy)
    expect(migrated.schemaVersion).toBe(SPRITE_SCHEMA_VERSION)
    expect(migrated.layers).toEqual([{ id: BASE_LAYER_ID, name: 'Layer 1', visible: true, locked: false }])
    expect(migrated.frames[0].cels[BASE_LAYER_ID].pixels).toEqual([0, 3])
    expect(legacy.frames[0].pixels).toEqual([0, 3])
  })

  it('creates transparent cels for every layer in a new frame', () => {
    const layers = [createLayer({ id: 'back', name: 'Back' }), createLayer({ id: 'front', name: 'Front' })]
    expect(createLayeredFrame(layers, 2, 1)).toEqual({
      cels: {
        back: { pixels: [TRANSPARENT_INK, TRANSPARENT_INK] },
        front: { pixels: [TRANSPARENT_INK, TRANSPARENT_INK] },
      },
    })
  })

  it('composites visible layers from bottom to top', () => {
    const sprite = {
      width: 3,
      height: 1,
      layers: [
        createLayer({ id: 'back', name: 'Back' }),
        createLayer({ id: 'hidden', name: 'Hidden', visible: false }),
        createLayer({ id: 'front', name: 'Front' }),
      ],
      frames: [{ cels: {
        back: createCel(3, 1, [1, 1, 1]),
        hidden: createCel(3, 1, [7, 7, 7]),
        front: createCel(3, 1, [TRANSPARENT_INK, 0, 3]),
      } }],
    }
    expect(compositeFrame(sprite, 0)).toEqual([1, 0, 3])
  })

  it('returns an isolated clone when normalizing an already layered sprite', () => {
    const sprite = migrateLegacySprite({ width: 1, height: 1, frames: [{ pixels: [2] }] })
    const clone = migrateLegacySprite(sprite)
    clone.frames[0].cels.base.pixels[0] = 9
    expect(sprite.frames[0].cels.base.pixels[0]).toBe(2)
  })

  it('round-trips legacy editor pixels through schema v2 storage', () => {
    const legacy = { width: 2, height: 1, frames: [{ pixels: [0, 4] }] }
    const stored = prepareSpriteForStorage(legacy)
    expect(stored.frames[0].pixels).toBeUndefined()
    expect(stored.frames[0].cels.base.pixels).toEqual([0, 4])
    expect(prepareSpriteForEditor(stored).frames[0].pixels).toEqual([0, 4])
  })

  it('writes an edited compatibility buffer back to the base cel', () => {
    const editorSprite = prepareSpriteForEditor({ width: 2, height: 1, frames: [{ pixels: [1, 2] }] })
    editorSprite.frames[0].pixels = [3, 0]
    expect(prepareSpriteForStorage(editorSprite).frames[0].cels.base.pixels).toEqual([3, 0])
  })
})
