import { describe, expect, it } from 'vitest'
import { generateModel01Manifest } from './manifestService'

const project = { profileId: 'model01', pages: [{ id: 'base' }] }

describe('generateModel01Manifest', () => {
  it('orders rooms and emits the Model01 constraints', () => {
    const manifest = generateModel01Manifest(project, [
      { name: 'Second', roomId: 1, pageId: 'base' },
      { name: 'First', roomId: 0, pageId: 'base', spawns: [{ col: 1, row: 2 }] },
    ])
    expect(manifest.pages[0].rooms.map(room => room.id)).toEqual([0, 1])
    expect(manifest).toMatchObject({ map_width: 16, map_height: 20, max_tiles: 48 })
  })

  it('rejects missing room IDs in the sequence', () => {
    expect(() => generateModel01Manifest(project, [
      { name: 'First', roomId: 0, pageId: 'base' },
      { name: 'Third', roomId: 2, pageId: 'base' },
    ])).toThrow(/contiguous/)
  })

  it('rejects generic projects', () => {
    expect(() => generateModel01Manifest({ profileId: 'generic' }, [])).toThrow(/only supported/)
  })
})
