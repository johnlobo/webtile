export const GENERIC_PROFILE_ID = 'generic'
export const MODEL01_PROFILE_ID = 'model01'

export const PROJECT_PROFILES = {
  [GENERIC_PROFILE_ID]: {
    id: GENERIC_PROFILE_ID,
    label: 'Generic',
    description: 'Free map and tile dimensions.',
  },
  [MODEL01_PROFILE_ID]: {
    id: MODEL01_PROFILE_ID,
    label: 'Model01 CPC',
    description: 'Amstrad CPC profile for the Model01 engine.',
    videoMode: 0,
    tileWidth: 8,
    tileHeight: 8,
    mapWidth: 16,
    mapHeight: 20,
    maxTiles: 48,
    targetScreensPerBank: 40,
    maxActorsPerScreen: 12,
    maxEntitiesPerMap: 50,
  },
}

export function normalizeProfileId(profileId) {
  return PROJECT_PROFILES[profileId] ? profileId : GENERIC_PROFILE_ID
}

export function getProjectProfile(profileId) {
  return PROJECT_PROFILES[normalizeProfileId(profileId)]
}
