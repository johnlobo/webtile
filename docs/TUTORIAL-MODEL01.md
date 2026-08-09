# Tutorial — Webtile con perfil Model01

Este tutorial cubre el flujo completo para crear contenido de **Model01** desde Webtile:
crear proyecto, organizar páginas/bancos, editar mapas, colocar spawns/conexiones/entidades
y exportar el paquete y el manifiesto listo para `content_builder.py`.

---

## 1. Crear un proyecto Model01

1. Abre Webtile y pulsa **PROJECTS → NEW PROJECT**.
2. En el modal, elige:
   - **Profile**: `Model01 CPC`
   - **Name**: el nombre de tu proyecto.
3. Pulsa **CREATE PROJECT**.

El perfil Model01 fija automáticamente:
- Modo 0 (16 colores)
- Tiles de 8×8 px
- Mapas de 16×20 tiles
- Máximo 48 tiles distintos
- Objetivo de 40 pantallas por página/bancos

---

## 2. Gestionar páginas (bancos)

El proyecto se crea con una página llamada **Base**.
Puedes crear más páginas para organizar el contenido en bancos de memoria.

### Crear página
1. **PAGES → + NEW PAGE**
2. Escribe el nombre de la página (ej: `Bank 1`, `Bank 2`).
3. Pulsa **Enter**.

### Renombrar / eliminar página
- En el menú **PAGES**, cada página tiene:
  - **✎** para renombrar.
  - **✕** para eliminar (no se puede eliminar la última página).

### Mover mapas entre páginas
1. En **PAGES → Move Map**, cada mapa tiene un `<select>` con las páginas disponibles.
2. Cambia la página para reasignar el mapa.

---

## 3. Crear un mapa (room)

1. **MAPS → + NEW MAP**
2. Rellena:
   - **Name**: nombre del mapa/room.
   - **Tile width/height**: 8 / 8 (fijado por el perfil).
   - **Map width/height**: 16 / 20 (fijado por el perfil).
3. Pulsa **CREATE MAP**.

El mapa se crea con un `roomId` automático (0, 1, 2, …) y se asigna a la página activa.

---

## 4. Editar el tilemap

### Herramientas
| Herramienta | Shortcut | Acción |
|-------------|----------|--------|
| STAMP | `S` | Pintar el tile seleccionado. |
| FILL | `F` | Rellenar área contigua del mismo tile. |
| ERASE | `E` | Borrar tile (volver a vacío). |
| LINK | `L` | Colocar conexiones y entry points. |
| SPAWN | `P` | Colocar puntos de aparición (máx 12). |
| ENTITY | `X` | Colocar entidades (enemigos, objetos, portales, triggers). |

### Zoom
- Rueda del ratón, o botones **IN/OUT** en el toolbar.
- Atajos: `Ctrl/Cmd + +` y `Ctrl/Cmd + -`.

### Deshacer
- Botón **UNDO** o `Ctrl/Cmd + Z`.

---

## 5. Cargar y editar tileset

1. En el panel derecho **TILESET**, pulsa **Load**.
2. Selecciona una imagen PNG/JPG/GIF.
3. El tileset se muestra en el panel inferior.
4. Haz clic en un tile para seleccionarlo y usarlo con la herramienta STAMP.

### Editar tile pixel a pixel
1. Selecciona un tile en el tileset.
2. En el panel inferior aparece el **TILE EDITOR**.
3. Usa el **PEN** para pintar, **PICK** para eyedropper.
4. Elige color en la paleta o con el input de color.
5. Los cambios se aplican al tileset y se autoguardan.

---

## 6. Colocar spawns

1. Selecciona la herramienta **SPAWN** (`P`).
2. Haz clic en las celdas donde quieras colocar spawns.
3. Se muestran como círculos amarillos numerados (1, 2, 3, …).
4. Máximo 12 spawns por mapa.
5. Clic de nuevo sobre un spawn para eliminarlo.

---

## 7. Colocar conexiones y entry points

1. Selecciona la herramienta **LINK** (`L`).
2. En el panel derecho **ROOM DATA** verás las conexiones N/S/E/O.
3. Para conectar:
   - Haz clic en el borde del mapa (Norte, Sur, Este, Oeste).
   - La conexión se muestra como una banda azul con la etiqueta `→ targetRoomId`.
4. Para cambiar el destino:
   - Usa el panel derecho o el selector de página en **PAGES → Move Map**.
5. Para colocar entry points:
   - Haz clic en cualquier celda del mapa.
   - Se marca con un triángulo `▶`.
   - Clic de nuevo para eliminar.

---

## 8. Colocar entidades

1. Selecciona la herramienta **ENTITY** (`X`).
2. En el toolbar elige el tipo de entidad:
   - **E** — Enemy (rojo)
   - **O** — Object (verde)
   - **P** — Portal (morado)
   - **T** — Trigger (naranja)
3. Haz clic en el mapa para colocar la entidad.
4. Clic de nuevo sobre una entidad para eliminarla.
5. Las entidades se muestran como cajas con la letra del tipo.

---

## 9. Panel de capacidad (Model01)

En el panel lateral derecho, cuando el proyecto es Model01, verás **PAGE CAPACITY**:

| Campo | Descripción |
|-------|-------------|
| Rooms | Número de mapas en la página / objetivo (40) |
| Used | Bytes estimados usados (maps + spawns + directorio) |
| Budget | Presupuesto total por página: 5632 bytes |
| Free | Bytes libres restantes |
| Barra | Porcentaje de uso (se pone roja > 85%) |

> Nota: es una estimación. El tamaño real lo calcula ZX7B durante `make`.

---

## 10. Exportar paquete .webtile.json

1. **PROJECTS → EXPORT PACKAGE**
2. Se descarga un archivo `.webtile.json` con:
   - Proyecto y perfil.
   - Páginas.
   - Mapas con tiles, spawns, conexiones, entry points, entidades y scripts.
   - Sprites.

El paquete es portable, se puede guardar en Git y reimportar en otro proyecto.

---

## 11. Importar paquete .webtile.json

1. **PROJECTS → IMPORT PACKAGE**
2. Selecciona el archivo `.webtile.json`.
3. Se crea un proyecto nuevo con el contenido importado.
4. Los `roomId` se asignan automáticamente (0, 1, 2, …) en orden de aparición.

> Importante: si importas un paquete antiguo con `spawns` como número, se convierte automáticamente a posiciones `{col, row}`.

---

## 12. Exportar manifiesto para content_builder.py

1. **PROJECTS → EXPORT MANIFEST**
2. Se descarga `<nombre>-manifest.json` con el formato esperado por el builder:
   ```json
   {
     "format_version": 1,
     "map_width": 16,
     "map_height": 20,
     "tile_width": 8,
     "tile_height": 8,
     "max_tiles": 48,
     "target_rooms_per_page": 40,
     "room_budget_bytes": 5632,
     "directory_bytes_per_room": 6,
     "spawn_record_bytes": 8,
     "planning_spawns_per_room": 6,
     "pages": [
       {
         "id": "base",
         "rooms": [
           {
             "id": 0,
             "name": "Mapa 1",
             "map": "assets/map/Mapa 1.tmx",
             "spawns": 4,
             "entities": [
               { "type": "enemy", "col": 5, "row": 3 }
             ]
           }
         ]
       }
     ]
   }
   ```

Este manifiesto se pasa a `tools/content_builder.py` junto con los archivos `.tmx` exportados.

---

## 13. Exportar .tmx y tileset PNG

1. Abre el mapa que quieras exportar.
2. **MAPS → EXPORT .TMX** — descarga el archivo TMX del mapa.
3. **MAPS → EXPORT TILESET** — descarga el tileset en PNG.

Los TMX exportados incluyen los datos de tiles, spawns, conexiones, entry points y entidades en formato compatible con el builder.

---

## 14. Borrar mapa

1. En el menú **MAPS**, pasa el ratón sobre el mapa.
2. Pulsa **DEL**.
3. Confirma la eliminación.

> Si el mapa tenía `roomId` y `pageId`, se desasigna automáticamente de la página.

---

## 15. Cerrar proyecto

1. **PROJECTS → CLOSE PROJECT**
2. Se limpia el estado del editor.
3. Puedes abrir otro proyecto o crear uno nuevo.

---

## 16. Flujo de trabajo recomendado

```
1. Crear proyecto Model01
   ↓
2. Crear páginas/bancos según tu diseño de memoria
   ↓
3. Por cada página:
   a. Crear mapas (rooms)
   b. Asignar cada mapa a su página
   c. Editar tiles y tileset
   d. Colocar spawns, conexiones, entry points
   e. Colocar entidades
   ↓
4. Revisar PAGE CAPACITY para cada página
   ↓
5. Exportar manifiesto
   ↓
6. Exportar .tmx y tilesets por mapa
   ↓
7. Pasar a content_builder.py para generar ASM y bancos
```

---

## 17. Preguntas frecuentes

**¿Puedo tener mapas sin asignar a ninguna página?**
Sí, pero el builder solo procesará mapas que estén en una página del manifiesto.

**¿Qué pasa si supero los 5632 bytes por página?**
El panel de capacidad lo avisa, pero Webtile no bloquea la creación. El builder fallará o truncará si superas el presupuesto.

**¿Se pueden compartir proyectos entre usuarios?**
Sí, mediante el archivo `.webtile.json` (exportar/importar). Firestore no comparte datos entre usuarios.

**¿Los scripts se pueden editar en Webtile?**
No todavía. La estructura de scripts está definida en el modelo, pero el editor visual queda para una fase posterior.
