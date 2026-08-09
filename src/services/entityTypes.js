export const ENTITY_TYPES = {
  enemy:   { label: 'E', color: 'rgba(255,60,60,0.85)',   bg: 'rgba(255,60,60,0.2)' },
  object:  { label: 'O', color: 'rgba(60,255,60,0.85)',   bg: 'rgba(60,255,60,0.2)' },
  portal:  { label: 'P', color: 'rgba(180,60,255,0.85)',  bg: 'rgba(180,60,255,0.2)' },
  trigger: { label: 'T', color: 'rgba(255,180,60,0.85)',  bg: 'rgba(255,180,60,0.2)' },
}

export const ENTITY_DEFAULT_PROPERTIES = {
  enemy:   { speed: 1, behavior: 'patrol', health: 1 },
  object:  { collectible: true, respawn: false },
  portal:  { targetRoomId: null, targetEntry: 0 },
  trigger: { event: 'none', once: true },
}

export const ENTITY_BEHAVIORS = ['patrol', 'chase', 'static', 'random']
export const ENTITY_EVENTS = ['none', 'open_door', 'spawn', 'win', 'message']
