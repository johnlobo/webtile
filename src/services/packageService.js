import { createProject, loadProject, listMaps, loadMap, createMap, saveMap } from './projectService'
import { addPage, DEFAULT_PAGE_ID } from './pageService'
import { listSprites, loadSprite, createSprite, saveSprite } from './spriteService'
import { getProjectProfile, MODEL01_PROFILE_ID, normalizeProfileId } from '../model01Profile'

export const PROJECT_PACKAGE_FORMAT = 'webtile-project'
export const PROJECT_PACKAGE_VERSION = 1

const flattenTiles = grid => grid.flat().map(tile => tile?.idx ?? -1)

function expandTiles(ids, width, height, columns) {
  return Array.from({ length: height }, (_, row) =>
    Array.from({ length: width }, (_, col) => {
      const idx = ids[row * width + col]
      return idx === -1 ? null : { idx, row: Math.floor(idx / columns), col: idx % columns }
    }))
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Invalid tileset image in package.'))
    img.src = src
  })
}

async function hydrateTileset(data, tileW, tileH) {
  if (!data) return null
  const img = await loadImage(data.data)
  const canvas = document.createElement('canvas')
  canvas.width = data.naturalW
  canvas.height = data.naturalH
  canvas.getContext('2d').drawImage(img, 0, 0)
  return {
    url: data.data, img, canvas,
    naturalW: data.naturalW, naturalH: data.naturalH,
    cols: Math.floor(data.naturalW / tileW),
    rows: Math.floor(data.naturalH / tileH),
  }
}

export function validateProjectPackage(pkg) {
  if (!pkg || pkg.format !== PROJECT_PACKAGE_FORMAT || pkg.version !== PROJECT_PACKAGE_VERSION) {
    throw new Error(`Unsupported package. Expected ${PROJECT_PACKAGE_FORMAT} version ${PROJECT_PACKAGE_VERSION}.`)
  }
  if (!pkg.project?.name || !Array.isArray(pkg.maps) || !Array.isArray(pkg.sprites)) {
    throw new Error('The project package is incomplete.')
  }
  const profileId = normalizeProfileId(pkg.project.profileId)
  const profile = getProjectProfile(profileId)
  for (const map of pkg.maps) {
    const { tileW, tileH, mapW, mapH } = map.config || {}
    if (![tileW, tileH, mapW, mapH].every(Number.isInteger)) throw new Error(`Map "${map.name}" has invalid dimensions.`)
    if (!Array.isArray(map.tiles) || map.tiles.length !== mapW * mapH) throw new Error(`Map "${map.name}" has invalid tile data.`)
    if (!map.tiles.every(id => Number.isInteger(id) && id >= -1)) throw new Error(`Map "${map.name}" contains invalid tile IDs.`)
    if (profileId === MODEL01_PROFILE_ID) {
      const validSize = tileW === profile.tileWidth && tileH === profile.tileHeight &&
        mapW === profile.mapWidth && mapH === profile.mapHeight
      if (!validSize) throw new Error(`Map "${map.name}" does not match the Model01 profile.`)
      if (map.tiles.some(id => id >= profile.maxTiles)) throw new Error(`Map "${map.name}" exceeds the ${profile.maxTiles}-tile Model01 limit.`)
    }
    if (map.spawns !== undefined && (!Number.isInteger(map.spawns) && !Array.isArray(map.spawns))) {
      throw new Error(`Map "${map.name}" has invalid spawns.`)
    }
    if (map.connections && typeof map.connections !== 'object') {
      throw new Error(`Map "${map.name}" has invalid connections.`)
    }
    if (map.entryPositions && !Array.isArray(map.entryPositions)) {
      throw new Error(`Map "${map.name}" has invalid entryPositions.`)
    }
    if (map.entities && !Array.isArray(map.entities)) {
      throw new Error(`Map "${map.name}" has invalid entities.`)
    }
  }
  return profileId
}

export async function exportProjectPackage(userId, projectId) {
  const [project, mapList, spriteList] = await Promise.all([
    loadProject(userId, projectId), listMaps(userId, projectId), listSprites(userId, projectId),
  ])
  if (!project) throw new Error('Project not found.')

  const pages = project.pages ?? []

  const maps = await Promise.all(mapList.map(async ({ id }, index) => {
    const map = await loadMap(userId, projectId, id)
    return {
      name: map.name,
      roomId: index,
      pageId: map.pageId,
      spawns: map.spawns,
      connections: map.connections,
      entryPositions: map.entryPositions,
      entities: map.entities ?? [],
      scripts: map.scripts,
      config: map.config,
      tiles: flattenTiles(map.mapTiles),
      tileset: map.tileset ? {
        data: map.tileset.canvas?.toDataURL('image/png') ?? map.tileset.url,
        naturalW: map.tileset.naturalW,
        naturalH: map.tileset.naturalH,
      } : null,
    }
  }))

  const sprites = await Promise.all(spriteList.map(async ({ id }) => {
    const sprite = await loadSprite(userId, projectId, id)
    const { id: ignoredId, createdAt, updatedAt, ...data } = sprite
    return data
  }))

  return {
    format: PROJECT_PACKAGE_FORMAT,
    version: PROJECT_PACKAGE_VERSION,
    exportedAt: new Date().toISOString(),
    project: { name: project.name, profileId: project.profileId },
    pages,
    maps,
    sprites,
  }
}

export async function importProjectPackage(userId, pkg) {
  const profileId = validateProjectPackage(pkg)
  const name = `${pkg.project.name} (Imported)`
  const projectId = await createProject(userId, { name, profileId })

  const pages = pkg.pages ?? []
  for (const page of pages) {
    await addPage(userId, projectId, {
      id: page.id || `page-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      label: page.label || 'Page',
      roomIds: [],
    })
  }

  const roomIdMap = new Map()
  for (let i = 0; i < pkg.maps.length; i++) {
    const map = pkg.maps[i]
    const roomId = i
    roomIdMap.set(map.name, roomId)

    const targetPageId = map.pageId && pages.find(p => p.id === map.pageId)
      ? map.pageId
      : DEFAULT_PAGE_ID

    const spawns = Array.isArray(map.spawns)
      ? map.spawns
      : typeof map.spawns === 'number'
        ? Array.from({ length: map.spawns }, (_, idx) => ({
            col: idx % map.config.mapW,
            row: Math.floor(idx / map.config.mapW),
          }))
        : []

    const mapId = await createMap(userId, projectId, {
      name: map.name,
      ...map.config,
      roomId,
      pageId: targetPageId,
      spawns,
      connections: map.connections ?? {},
      entryPositions: map.entryPositions ?? [],
      entities: map.entities ?? [],
      scripts: map.scripts ?? {},
    })

    const tileset = await hydrateTileset(map.tileset, map.config.tileW, map.config.tileH)
    const columns = tileset?.cols ?? Math.max(1, Math.max(...map.tiles, 0) + 1)
    await saveMap(userId, projectId, mapId, {
      name: map.name,
      config: map.config,
      mapTiles: expandTiles(map.tiles, map.config.mapW, map.config.mapH, columns),
      tileset,
      tilesetBlobUrl: tileset?.url,
      roomId,
      pageId: targetPageId,
      spawns,
      connections: map.connections ?? {},
      entryPositions: map.entryPositions ?? [],
      entities: map.entities ?? [],
      scripts: map.scripts ?? {},
    })

    await assignRoomToPage(userId, projectId, targetPageId, roomId)
  }

  for (const sprite of pkg.sprites) {
    const spriteId = await createSprite(userId, projectId, sprite)
    await saveSprite(userId, projectId, spriteId, sprite)
  }

  return { projectId, name, profileId }
}
