import { describe, expect, it } from 'vitest'
import {
  BASE_LAYER_ID,
  SPRITE_SCHEMA_VERSION,
  TRANSPARENT_INK,
  compositeFrame,
  compositeEditorFrame,
  getEditorLayerFrame,
  createCel,
  createLayer,
  createLayeredFrame,
  migrateLegacySprite,
  prepareSpriteForEditor,
  prepareSpriteForStorage,
  addEditorLayer,
  addEditorLayerWithFrames,
  deleteEditorLayer,
  deleteEditorLayers,
  moveEditorLayer,
  mergeEditorLayerDown,
  mergeVisibleEditorLayers,
  flattenEditorLayers,
  cropEditorSprite,
  getEditorCropBounds,
  selectEditorLayer,
} from './spriteLayerModel'

describe('sprite layer model', () => {
  it('crops every frame and layer while retaining CPC width alignment', () => {
    let sprite = prepareSpriteForEditor({ videoMode: 1, width: 8, height: 3, frames: [{ pixels: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 1, 2, 3, 4, 5, 6, 7, 8] }] })
    sprite = addEditorLayer(sprite, { id: 'top', name: 'Top' })
    sprite.frames[0].pixels = Array.from({ length: 24 }, (_, index) => index + 20)
    expect(getEditorCropBounds(sprite, { x: 2, y: 1, w: 3, h: 2 })).toEqual({ x: 2, y: 1, w: 4, h: 2 })
    sprite = cropEditorSprite(sprite, { x: 2, y: 1, w: 3, h: 2 })
    expect({ width: sprite.width, height: sprite.height }).toEqual({ width: 4, height: 2 })
    expect(sprite.frames[0].cels[BASE_LAYER_ID].pixels).toEqual([10, 11, 12, 13, 3, 4, 5, 6])
    expect(sprite.frames[0].cels.top.pixels).toEqual([30, 31, 32, 33, 38, 39, 40, 41])
    expect(sprite.frames[0].pixels).toEqual(sprite.frames[0].cels.top.pixels)
  })

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

  it('exports the working buffer only for the active layer', () => {
    const sprite = {
      width: 2, height: 1, activeLayerId: 'top',
      layers: [createLayer({ id: 'base', name: 'Base' }), createLayer({ id: 'top', name: 'Top' })],
      frames: [{ pixels: [7, TRANSPARENT_INK], cels: {
        base: createCel(2, 1, [1, 2]),
        top: createCel(2, 1, [3, 4]),
      } }],
    }
    expect(getEditorLayerFrame(sprite, 0, 'top')).toEqual([7, TRANSPARENT_INK])
    expect(getEditorLayerFrame(sprite, 0, 'base')).toEqual([1, 2])
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

  it('adds a layer from per-frame clipboard pixels and fills missing frames transparently', () => {
    let sprite = prepareSpriteForEditor({ width: 2, height: 1, frames: [{ pixels: [1, 1] }, { pixels: [2, 2] }] })
    sprite = addEditorLayerWithFrames(sprite, { id: 'pasted', name: 'Pasted' }, [[7, 8]])
    expect(sprite.activeLayerId).toBe('pasted')
    expect(sprite.frames[0].pixels).toEqual([7, 8])
    expect(sprite.frames[1].pixels).toEqual([TRANSPARENT_INK, TRANSPARENT_INK])
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

  it('deletes multiple selected layers while keeping a neighboring editable layer', () => {
    let sprite = prepareSpriteForEditor({ width: 1, height: 1, frames: [{ pixels: [1] }] })
    sprite = addEditorLayer(sprite, { id: 'middle', name: 'Middle' })
    sprite.frames[0].pixels = [2]
    sprite = addEditorLayer(sprite, { id: 'top', name: 'Top' })
    sprite.frames[0].pixels = [3]
    sprite = deleteEditorLayers(sprite, ['middle', 'top'])
    expect(sprite.layers.map(layer => layer.id)).toEqual([BASE_LAYER_ID])
    expect(sprite.activeLayerId).toBe(BASE_LAYER_ID)
    expect(sprite.frames[0].pixels).toEqual([1])
    expect(Object.keys(sprite.frames[0].cels)).toEqual([BASE_LAYER_ID])
  })

  it('refuses to delete every layer in a multi-selection', () => {
    let sprite = prepareSpriteForEditor({ width: 1, height: 1, frames: [{ pixels: [1] }] })
    sprite = addEditorLayer(sprite, { id: 'top', name: 'Top' })
    const result = deleteEditorLayers(sprite, [BASE_LAYER_ID, 'top'])
    expect(result.layers).toHaveLength(2)
    expect(result.frames[0].cels[BASE_LAYER_ID].pixels).toEqual([1])
  })

  it('merges the active layer down across every frame and preserves transparency', () => {
    let sprite = prepareSpriteForEditor({ width: 3, height: 1, frames: [{ pixels: [1, 1, 1] }, { pixels: [2, 2, 2] }] })
    sprite = addEditorLayer(sprite, { id: 'top', name: 'Top' })
    sprite.frames[0].pixels = [TRANSPARENT_INK, 7, TRANSPARENT_INK]
    sprite.frames[1].pixels = [8, TRANSPARENT_INK, 9]
    sprite = mergeEditorLayerDown(sprite)
    expect(sprite.layers.map(layer => layer.id)).toEqual([BASE_LAYER_ID])
    expect(sprite.activeLayerId).toBe(BASE_LAYER_ID)
    expect(sprite.frames.map(frame => frame.pixels)).toEqual([[1, 7, 1], [8, 2, 9]])
    expect(sprite.frames.every(frame => frame.cels.top === undefined)).toBe(true)
  })

  it('does not merge the bottom or locked layer', () => {
    let sprite = prepareSpriteForEditor({ width: 1, height: 1, frames: [{ pixels: [1] }] })
    expect(mergeEditorLayerDown(sprite)).toEqual(sprite)
    sprite = addEditorLayer(sprite, { id: 'top', name: 'Top', locked: true })
    expect(mergeEditorLayerDown(sprite).layers).toHaveLength(2)
  })

  it('merges hidden layers down without changing the visible result', () => {
    let sprite = prepareSpriteForEditor({ width: 2, height: 1, frames: [{ pixels: [1, 2] }] })
    sprite = addEditorLayer(sprite, { id: 'top', name: 'Top', visible: false })
    sprite.frames[0].pixels = [7, 8]
    sprite = mergeEditorLayerDown(sprite)
    expect(sprite.frames[0].pixels).toEqual([1, 2])
    expect(sprite.layers[0].visible).toBe(true)
  })

  it('merges every visible layer while retaining hidden layers', () => {
    const layers = [
      createLayer({ id: 'bottom', name: 'Bottom' }),
      createLayer({ id: 'hidden', name: 'Hidden', visible: false }),
      createLayer({ id: 'top', name: 'Top' }),
    ]
    const sprite = prepareSpriteForEditor({
      width: 2, height: 1, schemaVersion: SPRITE_SCHEMA_VERSION, layers,
      frames: [{ cels: {
        bottom: createCel(2, 1, [1, 1]),
        hidden: createCel(2, 1, [9, 9]),
        top: createCel(2, 1, [TRANSPARENT_INK, 3]),
      } }],
    })
    const merged = mergeVisibleEditorLayers(sprite)
    expect(merged.layers.map(layer => layer.id)).toEqual(['hidden', 'top'])
    expect(merged.frames[0].pixels).toEqual([1, 3])
    expect(merged.frames[0].cels.hidden.pixels).toEqual([9, 9])
  })

  it('flattens the visible composition into exactly one layer', () => {
    let sprite = prepareSpriteForEditor({ width: 2, height: 1, frames: [{ pixels: [1, 2] }] })
    sprite = addEditorLayer(sprite, { id: 'top', name: 'Top' })
    sprite.frames[0].pixels = [TRANSPARENT_INK, 7]
    const flattened = flattenEditorLayers(sprite)
    expect(flattened.layers).toHaveLength(1)
    expect(flattened.layers[0].name).toBe('Flattened')
    expect(flattened.frames[0].pixels).toEqual([1, 7])
    expect(Object.keys(flattened.frames[0].cels)).toEqual([flattened.activeLayerId])
  })
})
