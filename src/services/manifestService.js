import { getProjectProfile, MODEL01_PROFILE_ID } from '../model01Profile'

export const MODEL01_MANIFEST_CONSTANTS = {
  format_version: 1,
  room_budget_bytes: 5632,
  directory_bytes_per_room: 6,
  spawn_record_bytes: 8,
  planning_spawns_per_room: 6,
}

export function generateModel01Manifest(project, maps) {
  const profile = getProjectProfile(project.profileId)
  if (profile.id !== MODEL01_PROFILE_ID) {
    throw new Error('Manifest generation is only supported for Model01 projects.')
  }

  const pages = (project.pages ?? []).map(page => {
    const pageMaps = maps.filter(m => m.pageId === page.id)
    const rooms = pageMaps
      .slice()
      .sort((a, b) => (a.roomId ?? 0) - (b.roomId ?? 0))
      .map(m => ({
        id: m.roomId ?? 0,
        name: m.name,
        map: `assets/map/${m.name}.tmx`,
        spawns: m.spawns ?? 0,
        entities: (m.entities ?? []).map(e => ({
          type: e.type,
          col: e.col,
          row: e.row,
        })),
      }))

    return {
      id: page.id,
      rooms,
    }
  })

  const orderedRooms = pages.flatMap(p => p.rooms).sort((a, b) => a.id - b.id)
  const expectedIds = orderedRooms.map((_, i) => i)
  const actualIds = orderedRooms.map(r => r.id)
  if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) {
    throw new Error(
      `Room IDs must be contiguous and start at zero. Expected ${JSON.stringify(expectedIds)}, got ${JSON.stringify(actualIds)}.`
    )
  }

  return {
    format_version: MODEL01_MANIFEST_CONSTANTS.format_version,
    map_width: profile.mapWidth,
    map_height: profile.mapHeight,
    tile_width: profile.tileWidth,
    tile_height: profile.tileHeight,
    max_tiles: profile.maxTiles,
    target_rooms_per_page: profile.targetScreensPerBank,
    room_budget_bytes: MODEL01_MANIFEST_CONSTANTS.room_budget_bytes,
    directory_bytes_per_room: MODEL01_MANIFEST_CONSTANTS.directory_bytes_per_room,
    spawn_record_bytes: MODEL01_MANIFEST_CONSTANTS.spawn_record_bytes,
    planning_spawns_per_room: MODEL01_MANIFEST_CONSTANTS.planning_spawns_per_room,
    pages,
  }
}
