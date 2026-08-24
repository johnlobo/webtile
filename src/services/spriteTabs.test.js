import { describe, expect, it } from 'vitest'
import { activeTabAfterClose, reorderSpriteTabs, restoreSpriteTabs } from './spriteTabs'

describe('sprite tabs', () => {
  it('reorders tabs without mutating the original list', () => {
    const tabs = ['a', 'b', 'c']
    expect(reorderSpriteTabs(tabs, 'c', 'a')).toEqual(['c', 'a', 'b'])
    expect(tabs).toEqual(['a', 'b', 'c'])
  })

  it('selects a neighboring tab when the active tab closes', () => {
    expect(activeTabAfterClose(['a', 'b', 'c'], 'b', 'b')).toBe('c')
    expect(activeTabAfterClose(['a', 'b'], 'b', 'b')).toBe('a')
    expect(activeTabAfterClose(['a'], 'a', 'a')).toBeNull()
    expect(activeTabAfterClose(['a', 'b'], 'a', 'b')).toBe('a')
  })

  it('restores only unique tabs that still exist', () => {
    const restored = restoreSpriteTabs(JSON.stringify({ openSpriteIds: ['b', 'missing', 'b', 'a'], activeSpriteId: 'b' }), ['a', 'b'])
    expect(restored).toEqual({ openSpriteIds: ['b', 'a'], activeSpriteId: 'b' })
    expect(restoreSpriteTabs('invalid json', ['a'])).toEqual({ openSpriteIds: [], activeSpriteId: null })
  })
})
