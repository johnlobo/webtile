import { describe, expect, it } from 'vitest'
import {
  BASE_LAYER_ID,
  SPRITE_SCHEMA_VERSION,
  TRANSPARENT_INK,
  compositeFrame,
  compositeEditorFrame,
  createCel,
  createLayer,
  createLayeredFrame,
  migrateLegacySprite,
  prepareSpriteForEditor,
  prepareSpriteForStorage,
  addEditorLayer,
  deleteEditorLayer,
  moveEditorLayer,
  selectEditorLayer,
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

  it('can flatten visible layers while preserving an empty transparent background', () => {
    const sprite = {
      width: 3,
      height: 1,
      activeLayerId: 'front',
      layers: [
        createLayer({ id: 'hidden', name: 'Hidden', visible: false }),
        createLayer({ id: 'front', name: 'Front' }),
      ],
      frames: [{
        pixels: [TRANSPARENT_INK, 2, TRANSPARENT_INK],
        cels: {
          hidden: createCel(3, 1, [7, 7, 7]),
          front: createCel(3, 1, [TRANSPARENT_INK, TRANSPARENT_INK, TRANSPARENT_INK]),
        },
      }],
    }
    expect(compositeEditorFrame(sprite, 0, TRANSPARENT_INK)).toEqual([TRANSPARENT_INK, 2, TRANSPARENT_INK])
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

  it('renders the working base buffer through upper visible layers', () => {
    const sprite = {
      width: 2,
      height: 1,
      schemaVersion: SPRITE_SCHEMA_VERSION,
      layers: [
        createLayer({ id: 'base', name: 'Base' }),
        createLayer({ id: 'top', name: 'Top' }),
      ],
      frames: [{
        pixels: [3, 4],
        cels: {
          base: createCel(2, 1, [1, 1]),
          top: createCel(2, 1, [TRANSPARENT_INK, 7]),
        },
      }],
    }
    expect(compositeEditorFrame(sprite, 0)).toEqual([3, 7])
    expect(sprite.frames[0].cels.base.pixels).toEqual([1, 1])
  })

  it('commits and switches the editable layer across every frame', () => {
    let sprite = prepareSpriteForEditor({ width: 2, height: 1, frames: [{ pixels: [1, 2] }, { pixels: [3, 4] }] })
    sprite = addEditorLayer(sprite, { id: 'top', name: 'Top' })
    sprite.frames[0].pixels = [5, TRANSPARENT_INK]
    sprite.frames[1].pixels = [TRANSPARENT_INK, 6]
    sprite = selectEditorLayer(sprite, BASE_LAYER_ID)
    expect(sprite.frames.map(frame => frame.pixels)).toEqual([[1, 2], [3, 4]])
    expect(sprite.frames[0].cels.top.pixels).toEqual([5, TRANSPARENT_INK])
  })

  it('duplicates, reorders, and deletes layers without losing cels', () => {
    let sprite = prepareSpriteForEditor({ width: 1, height: 1, frames: [{ pixels: [7] }] })
    sprite = addEditorLayer(sprite, { id: 'copy', name: 'Copy' }, { duplicateActive: true })
    expect(sprite.frames[0].pixels).toEqual([7])
    sprite = moveEditorLayer(sprite, 'copy', -1)
    expect(sprite.layers.map(layer => layer.id)).toEqual(['copy', BASE_LAYER_ID])
    sprite = deleteEditorLayer(sprite, 'copy')
    expect(sprite.layers.map(layer => layer.id)).toEqual([BASE_LAYER_ID])
    expect(sprite.frames[0].pixels).toEqual([7])
  })
})
