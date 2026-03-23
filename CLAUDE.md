# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server at port 5173
npm run build     # Production build to dist/
npm run preview   # Preview production build
```

No test suite is configured.

## Environment

Firebase config must be provided via environment variables in `.env`:
```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

## Vite / code-server proxy

The app runs behind a code-server reverse proxy. `vite.config.js` sets `base: '/proxy/5173/'` and includes a custom middleware (`codeServerProxyPlugin`) that rewrites incoming request URLs to re-add the proxy prefix before Vite processes them. HMR is intentionally disabled — reload manually after changes.

## Architecture

Single-page React app with Firebase Auth + Firestore. No state management library; all state lives in `HomePage`.

### Routing

Uses `HashRouter` — all URLs begin with `#/`. Routes: `/` → `HomePage` (protected), `/login` → `LoginPage`, `/forgot-password` → `ForgotPasswordPage`. The hash-based router avoids issues with the code-server reverse proxy rewriting paths.

### Auth flow

`AuthContext` (`src/contexts/AuthContext.jsx`) wraps the app. `ProtectedRoute` redirects unauthenticated users to `/login`. Auth methods: Google OAuth popup, email/password.

### Main editor (`src/pages/HomePage.jsx`)

The entire editor UI lives here. It owns all state and passes handlers down. Key state:

- **Project level**: `projectId`, `projectName`, `maps[]`
- **Active map**: `activeMapId`, `mapConfig`, `mapTiles`, `tileset`
- **Sprites**: `sprites[]`, `selectedSpriteId`
- **Editor**: `activeTool`, `zoom`, `selectedTile`, `saveStatus`, history stack

The main content area renders one of four views based on state priority:
1. `EmptyWorkspace` — no project loaded
2. `SpriteEditor` — a sprite is selected (`selectedSpriteId != null`)
3. `NoMaps` — project loaded but no maps
4. `TilemapGrid` — normal map editing mode

Inline components `Sidebar`, `SidebarSection`, `SidebarBtn`, `MapItem`, `SpriteItem` are defined in this file.

Map undo is fully implemented: `historyRef` stores previous `mapTiles` snapshots (max 50), `pushHistory` is called before every tile mutation, `handleUndo` pops and restores, Ctrl+Z is wired globally, and the toolbar exposes an UNDO button (`canUndo`/`onUndo` props).

**Map editor keyboard shortcuts:** `S` → Stamp, `F` → Fill, `E` → Eraser, `D` → Toggle doubleWidth, `Ctrl+Z` → Undo, `Ctrl++`/`Ctrl+-` → Zoom in/out.

Auto-save fires 2 seconds after the last tile paint, using refs (`projectIdRef_`, `activeMapIdRef_`, `mapConfigRef_`, `tilesetRef_`, `mapTilesRef_`) to capture current values inside the async callback without stale closures.

### Firestore data model

```
users/{uid}/projects/{pid}
  name, createdAt, updatedAt

users/{uid}/projects/{pid}/maps/{mid}
  name, tileW, tileH, mapW, mapH, doubleWidth
  mapTiles: int[]   # flat array, -1=empty, (tileRow*1000+tileCol)=tile
  hasTileset: bool
  createdAt, updatedAt

users/{uid}/projects/{pid}/maps/{mid}/assets/tileset
  data: base64 data URL, naturalW, naturalH

users/{uid}/projects/{pid}/sprites/{sid}
  name, videoMode (0/1/2), width, height
  palette: int[]    # CPC color indices per ink slot
  frames: [{pixels: int[]}]  # ink index per pixel, 0=transparent
  createdAt, updatedAt
```

Old schema (pre-restructure) stored map config directly on the project doc. `migrateOldProject()` in `projectService.js` auto-migrates on load.

### TilemapGrid (`src/components/TilemapGrid.jsx`)

Renders the map as a CSS grid of tile-sized cells. Left-drag paints, right-click erases. Flood-fill replaces all contiguous cells with the same tile. Hover shows a preview overlay of the selected tile or eraser indicator. Scroll wheel zooms. Empty cells render as a checkerboard (CSS background, `image-rendering: pixelated`).

### RightSidebar (`src/components/RightSidebar.jsx`)

Displays the tileset image as a grid; clicking a tile selects it as the active stamp. Also contains per-tile info, a pixel-level tile editor for editing individual tileset tiles, and tileset import/export buttons (PNG).

### TMX import/export

`handleAction('exportTMX')` / `handleAction('importTMX')` in `HomePage` read/write Tiled `.tmx` (XML) format. Export embeds the tileset image path and encodes `mapTiles` as CSV data. Import parses the XML and rehydrates `mapTiles`. This is the main interchange format with external map editors.

### Tile encoding

`mapTiles` in memory is a 2D array of `{col, row, idx} | null`. Firestore stores it as a flat int array: `-1` = empty, `tileRow * 1000 + tileCol` = tile. Encode/decode in `projectService.js`.

The tileset image is stored as a base64 data URL in a separate Firestore sub-document to stay within document size limits.

### Sprite encoding (CPC)

`SpriteEditor` (`src/components/SpriteEditor.jsx`) stores pixels as ink indices (0 = transparent). Export (`generateExport`) encodes to CPC hardware byte format per video mode:
- Mode 0: 2 px/byte, interleaved bit planes
- Mode 1: 4 px/byte, interleaved bit planes
- Mode 2: 8 px/byte, simple 1-bit

Optional mask interleaving (mask byte, sprite byte per column byte) and CPC scanline-interleaved row ordering are supported for ASM/BASIC export.

### SpriteEditor (`src/components/SpriteEditor.jsx`)

Large self-contained component (~1700 lines). Key internals:

**State & refs:**
- `sprite` — full sprite document (name, videoMode, width, height, palette, frames)
- `currentFrame` — active frame index
- `activeTool` — `'pencil' | 'eraser' | 'picker' | 'select' | 'fill'`
- `activeInk` — currently selected ink index (1–N)
- `zoom` — from `SPRITE_ZOOM_LEVELS = [1, 2, 4, 8]`
- `doubleWidth` — stretch pixels 2× horizontally (CPC mode 0 aspect ratio)
- `selection` — `{x, y, w, h}` in sprite-pixel coords, or `null`
- `clipboard` — `{w, h, pixels}` for copy/paste
- `isPasting` — paste-preview mode active
- `gridCellW / gridCellH` — custom amber grid overlay cell size (default 8×8)
- `historyRef` — undo stack (max 50 entries); `canUndo` state
- `spriteRef` — always mirrors `sprite` for use in stable callbacks

**updateSprite(fn):** central mutation helper — calls `setSprite(prev => fn(prev))` and schedules auto-save (1.5 s debounce). All sprite mutations go through this.

**pushHistory():** captures `spriteRef.current` into `historyRef` before any mutation. Called explicitly by every operation that modifies pixels or structure.

**handleUndo():** pops from `historyRef`, restores via `setSprite`, re-schedules auto-save.

**Keyboard shortcuts:**
- `Ctrl+Z` — undo
- `Ctrl+C / Ctrl+V` — copy / paste selection
- `D` — toggle double-width
- `F` — fill tool
- `R` — select tool
- `Escape` — clear selection, exit paste mode, revert to pencil

**Tools:**
- **Pencil**: paints `activeInk`; Shift+click draws a Bresenham line from the previous click point
- **Eraser**: clears pixels to ink 0; if a selection is active, one click clears the entire selection rectangle
- **Picker**: samples ink under cursor
- **Select** (`R`): drag to define rectangle; Ctrl+C copies, Ctrl+V enters paste mode (click to stamp), Escape clears
- **Fill** (`F`): BFS flood fill; constrained to selection bounds if active

**Erase & fill respect selection:** when a selection is active, both erase strokes and fill propagation are restricted to the selection rectangle.

**Canvas rendering (`renderSpriteToCanvas`):** draws checkerboard background at 1 cell-per-sprite-pixel, then pixels, then the amber custom grid overlay. Green per-pixel grid removed.

**Custom paint cursor:** `useMemo` builds a canvas data-URL cursor sized `cellW × cellH` (capped 128 px): filled with active ink color for pencil, checkerboard for eraser/ink-0.

**Left toolbar (2-column grid, 196 px wide):** PENCIL, ERASE, PICK, SELECT, FILL | FLIP H, FLIP V, UNDO | ZOOM IN, ZOOM OUT | SETTINGS, PROPS | EXPORT, EXP PNG, IMP PNG.

**Right sidebar:** sprite minimap, info, ink slots, palette import/export buttons (JASC-PAL `.pal` format), CPC 27-color picker, frame strip with add/delete, animation playback.

**Modals:** `PropertiesModal` (resize canvas, anchor, bg ink, double-width, sprite name), `SettingsModal` (double-width toggle, grid cell size), `ExportModal` (CPC ASM/BASIC export).

**Palette import/export (JASC-PAL):**
- Export: writes `JASC-PAL / 0100 / count / R G B` lines, downloads as `<name>.pal`
- Import: parses JASC-PAL, maps each RGB to nearest of the 27 CPC colors via Euclidean RGB distance

**PNG import/export:**
- Export: renders current frame at 1:1 (transparent background) as PNG download
- Import: scales PNG to sprite dimensions on an offscreen canvas, maps each pixel to nearest palette ink by RGB distance; transparent pixels (alpha < 128) become ink 0
