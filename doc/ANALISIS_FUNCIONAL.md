# WebTile — análisis funcional

## 1. Propósito y alcance

WebTile es una aplicación web de edición gráfica orientada a videojuegos 2D y, de forma especial, a proyectos para Amstrad CPC. Reúne en una sola interfaz:

- gestión de proyectos en la nube;
- creación y edición de mapas basados en tiles;
- organización de mapas como páginas o bancos y salas numeradas;
- definición de conexiones, entradas, puntos de aparición y entidades;
- edición de tiles a nivel de píxel;
- creación y edición de sprites multiframe;
- importación y exportación de activos y proyectos.

Es una SPA React. Los datos del usuario se guardan en Firebase Firestore y el acceso se controla con Firebase Authentication.

## 2. Acceso y sesión

La aplicación tiene tres rutas:

- `#/login`: acceso y registro;
- `#/forgot-password`: recuperación de contraseña;
- `#/`: espacio de trabajo, protegido para usuarios autenticados.

El usuario puede iniciar sesión con correo y contraseña o mediante una ventana emergente de Google. En la misma pantalla puede cambiar entre acceso y alta; durante el alta se exige repetir la contraseña y se valida que ambas coincidan. Los errores de Firebase se traducen parcialmente a mensajes comprensibles.

La recuperación envía un enlace al correo indicado, muestra confirmación y permite solicitar otro. Mientras Firebase determina la sesión actual se presenta una pantalla de carga. Un visitante no autenticado que intenta abrir el editor es redirigido al acceso. Desde el editor se muestran el nombre o correo de la cuenta y la opción de cerrar sesión.

## 3. Conceptos funcionales

### Proyecto

Es el contenedor principal de mapas, páginas y sprites. Tiene nombre, perfil, fechas de creación/actualización y una lista de páginas. Se crea inicialmente con una página `Base`.

### Perfil de proyecto

Hay dos perfiles:

| Perfil | Comportamiento |
|---|---|
| Genérico | Permite elegir libremente dimensiones de tile y mapa, entre 1 y 256, y activar ancho visual doble. |
| Model01 CPC | Fija tiles de 8×8, mapas de 16×20, máximo de 48 tiles, objetivo de 40 salas por banco y máximo de 50 entidades por mapa. Está preparado para vídeo CPC modo 0. |

El perfil Model01 añade exportación de manifiesto y una estimación de capacidad por página.

### Página o banco

Agrupa salas/mapas y comparte un tileset entre todos los mapas asignados. Las páginas pueden crearse, renombrarse, seleccionarse y eliminarse. Un mapa puede moverse de una página a otra desde el menú. No se puede borrar la última página. Al borrar una página sus mapas no se borran, pero quedan sin asignación en los datos.

### Mapa o sala

Es una cuadrícula rectangular de celdas. Cada mapa posee nombre, dimensiones de tile y cuadrícula, identificador numérico de sala, página, tiles, conexiones, entradas, spawns, entidades y un espacio de datos `scripts`. Al crear mapas, el identificador de sala se asigna como el siguiente entero disponible.

### Tileset

Es una imagen dividida según el ancho y alto del tile activo. Se guarda por página, por lo que cargar o editar un tileset afecta al recurso compartido de esa página. Los mapas antiguos o importados pueden conservar un tileset propio como mecanismo de compatibilidad.

### Sprite

Es un gráfico con nombre, modo de vídeo CPC, ancho, alto, paleta y uno o más frames. Cada píxel almacena un índice de tinta, no un RGB directo; la tinta 0 se interpreta como transparente al exportar PNG.

## 4. Espacio de trabajo y navegación

La cabecera contiene cuatro menús:

- **Projects**: nuevo, cargar, importar paquete, exportar paquete, exportar manifiesto Model01 y cerrar;
- **Pages**: seleccionar, crear, renombrar, borrar y mover mapas entre páginas;
- **Maps**: seleccionar/borrar mapas, crear, importar TMX, exportar TMX, exportar tileset PNG y cerrar mapa;
- **Sprites**: seleccionar/borrar sprites, crear, cargar PNG y cerrar sprite.

La zona central de la cabecera presenta el mapa activo, sus dimensiones y el estado de guardado (`Saving`, `Saved` o error). La vista principal sigue esta prioridad:

1. sin proyecto: invitación a crear o cargar;
2. con sprite seleccionado: editor de sprites;
3. proyecto sin mapa activo: invitación a crear o importar mapa;
4. con mapa activo: editor de mapas y paneles laterales.

Cerrar un mapa, sprite o proyecto solo cierra su contexto en la interfaz; no lo elimina. Las eliminaciones de proyecto, mapa y sprite requieren confirmación.

## 5. Gestión de proyectos

### Crear y cargar

Al crear se solicita nombre y perfil. Al cargar se listan los proyectos del usuario, ordenados por actualización más reciente, con fecha y opción de borrado. Si el proyecto tiene mapas, se abre automáticamente el primero.

Existe migración automática de proyectos antiguos que almacenaban un único mapa dentro del documento de proyecto: al cargarlos se crea el mapa en la estructura actual y se copia su tileset cuando existe.

### Paquete completo

La exportación produce `<proyecto>.webtile.json` con formato `webtile-project`, versión 1. Incluye metadatos del proyecto, perfil, páginas, mapas, tiles aplanados, tilesets embebidos como data URL, datos de sala, entidades, sprites, paletas y frames.

La importación valida formato, versión, estructura, dimensiones e IDs de tile. En Model01 también valida dimensiones fijas, límite de tiles y número de entidades. Crea un proyecto nuevo con el sufijo `(Imported)`, recrea páginas, mapas y sprites, y vuelve a hidratar los tilesets. Los IDs de sala se reasignan de forma secuencial según el orden de los mapas importados.

## 6. Editor de mapas

### Crear un mapa

En perfil genérico se eligen nombre, tamaño del tile, columnas, filas y ancho visual doble. En Model01 las dimensiones quedan bloqueadas a 8×8 y 16×20 y el ancho doble se desactiva. El mapa nace vacío, se asigna a la página activa y reutiliza el tileset de esa página si existe.

### Herramientas

| Herramienta | Función |
|---|---|
| Stamp (`S`) | Pinta el tile seleccionado; admite arrastre. |
| Fill (`F`) | Rellena por inundación una región contigua de tiles iguales. |
| Eraser (`E`) | Borra tiles y, con prioridad, entidades, spawns o entradas presentes en la celda. El botón derecho borra desde cualquier herramienta. |
| Link (`L`) | Gestiona conexiones en bordes y puntos de entrada en celdas. |
| Spawn (`P`) | Añade o quita puntos de aparición, con límite fijo de 12 por mapa. |
| Select (`V`) | Selecciona una entidad existente para editar sus propiedades. |
| Entity (`X`) | Coloca una entidad del tipo activo o selecciona la ya existente en la celda. |

El cursor muestra una previsualización del tile, borrado o entidad antes de aplicar la acción. Las celdas vacías se presentan con fondo ajedrezado. La barra informativa muestra coordenadas, tamaño del mapa, tile, lienzo, sala y, según la herramienta, estado de enlaces o límite de entidades.

### Zoom, proporción e historial

Los niveles de zoom son 25 %, 50 %, 100 %, 200 %, 400 % y 800 %. Se cambian desde la barra, con la rueda sobre el mapa o con `Ctrl++`/`Ctrl+-`. `D` alterna la representación al doble de ancho sin alterar los datos de píxel almacenados.

El historial conserva hasta 50 estados e incluye tiles, conexiones, entradas, spawns y entidades. Admite deshacer (`Ctrl+Z`) y rehacer (`Ctrl+Shift+Z` o `Ctrl+Y`).

### Conexiones y datos de sala

Cada sala puede enlazar al norte, sur, este y oeste con otra sala. El destino se selecciona en el panel de datos o se activa desde el borde con la herramienta Link. Las conexiones activas se visualizan como bandas exteriores. Dentro de la cuadrícula pueden marcarse múltiples puntos de entrada, visibles con un triángulo.

Los spawns se alternan al pulsar una celda y se numeran visualmente. El panel lateral resume conexiones, coordenadas de entradas, spawns y entidades.

### Entidades

Hay cuatro tipos con propiedades iniciales:

| Tipo | Propiedades iniciales |
|---|---|
| Enemy | `speed: 1`, `behavior: patrol`, `health: 1` |
| Object | `collectible: true`, `respawn: false` |
| Portal | `targetRoomId: null`, `targetEntry: 0` |
| Trigger | `event: none`, `once: true` |

Los comportamientos disponibles son `patrol`, `chase`, `static` y `random`; los eventos son `none`, `open_door`, `spawn`, `win` y `message`. El panel de propiedades adapta el control al tipo de dato: número, texto, booleano o selector. Permite además borrar la entidad seleccionada. Model01 limita a 50 entidades por mapa; el perfil genérico no establece límite.

### Tileset, minimapa y editor de tile

El panel derecho permite cargar una imagen, muestra la rejilla calculada con las dimensiones del tile y selecciona el tile de estampado mediante clic. También ofrece:

- minimapa del mapa completo;
- exportación del tileset activo a `tileset.png`;
- editor píxel a píxel del tile seleccionado;
- lápiz, cuentagotas y borrado con botón derecho;
- paleta hardware CPC de 27 colores y selector RGB libre.

Las modificaciones del editor de tile se realizan sobre el lienzo completo del tileset y se guardan en el tileset de la página activa.

### Estimación Model01

Para la página activa se calcula un indicador de capacidad con presupuesto de 5632 bytes. La estimación suma 50 bytes por sala, 8 por spawn, 4 por entidad y 6 de directorio por sala, y compara el número de salas con el objetivo de 40. Es una ayuda de planificación, no una medición del binario final.

## 7. Intercambio de mapas

### TMX

La exportación genera TMX XML ortogonal compatible con Tiled 1.10.2, una capa y datos CSV. Si existe tileset, referencia `tileset.png`, por lo que conviene exportar también esa imagen.

La importación acepta un TMX con mapa, tileset con atributo `columns` y una capa CSV. Recupera dimensiones y contenido de tiles, crea un mapa con el nombre del fichero y no importa automáticamente la imagen referenciada. Tampoco importa capas múltiples, objetos, propiedades, compresión ni otros formatos de datos.

## 8. Editor de sprites

### Creación e importación inicial

Un sprite nuevo permite elegir:

- modo 0: 16 tintas y ancho múltiplo de 2;
- modo 1: 4 tintas y ancho múltiplo de 4;
- modo 2: 2 tintas y ancho múltiplo de 8.

La altura mínima es 1. El ancho se redondea al múltiplo exigido por el modo. Se crea un frame transparente y una paleta CPC predeterminada.

También puede crearse desde PNG. El importador deja elegir modo, nombre y dimensiones ajustadas a sus restricciones, escala la imagen y cuantiza sus colores a tintas CPC próximas. Los píxeles con alfa inferior a 128 pasan a tinta 0.

### Herramientas de dibujo

| Herramienta | Función |
|---|---|
| Pencil (`B`) | Dibujo libre; `Shift` traza una línea Bresenham desde el último punto y `Alt` toma el color. |
| Erase (`E`) | Pinta tinta 0; con selección activa puede limpiar toda la selección. |
| Pick | Toma la tinta de un píxel. |
| Select (`M`) | Define un rectángulo para copiar, cortar, pegar, borrar, rellenar o transformar. |
| Fill (`F`) | Relleno contiguo, restringido a la selección si existe; `Alt` toma color. |
| Move (`V`) | Mueve la selección y su contenido. |
| Text (`T`) | Coloca texto desde una fuente bitmap 3×9; convierte a mayúsculas, usa la tinta frontal e ignora caracteres no soportados. |

El editor permite copiar (`Ctrl+C`), cortar (`Ctrl+X`), pegar (`Ctrl+V`) con previsualización, voltear horizontal/verticalmente, deshacer y rehacer hasta 50 estados. `Escape` cancela texto o pegado, limpia la selección y, si procede, vuelve al lápiz.

### Tintas y paleta

El usuario maneja tinta frontal y de fondo; puede intercambiarlas, elegir la frontal con clic izquierdo y la de fondo con clic derecho. Cada ranura se asigna a uno de los 27 colores CPC. La tinta 0 se visualiza como transparencia.

Las paletas se importan/exportan como JASC-PAL (`.pal`). Al importar, cada RGB se aproxima al color CPC más cercano por distancia euclídea.

### Frames y animación

El sprite admite varios frames, selección por miniatura, alta, duplicado, eliminación (manteniendo al menos uno) y reordenación mediante arrastre. Las miniaturas ajustan siempre el frame completo al espacio disponible. La interfaz permite reproducir la secuencia, activar el bucle y ajustar los FPS, además de mostrar el frame anterior o siguiente como referencia semitransparente (*onion skin*).

El inspector incorpora una previsualización animada permanente cuando el sprite tiene más de un frame. Esta vista encaja el sprite completo respetando la proporción de píxel del modo CPC y utiliza la velocidad FPS configurada en la línea de tiempo.

La animación puede intercambiarse como spritesheet PNG horizontal o vertical. Desde el explorador del proyecto se puede importar una hoja para crear directamente un nuevo sprite animado, eligiendo nombre, modo CPC, dimensiones de frame, orientación y separación. El diálogo detecta la cantidad de frames y muestra sobre la imagen los cortes que realizará.

Dentro de un sprite existente, la importación divide la imagen usando sus dimensiones actuales, admite una separación configurable, conserva el orden visual y aproxima cada color a la paleta CPC activa. Esta variante sustituye todos los frames en una única operación deshacible. La exportación compone todos los frames en orden, sin separación y conservando la transparencia de la tinta 0.

### Vista y propiedades

El zoom del sprite dispone de 1×, 2×, 4× y 8×, además de rueda. La vista puede duplicar horizontalmente el píxel para aproximar la proporción del modo 0. La cuadrícula superpuesta admite tamaño de celda configurable.

En propiedades se puede renombrar y redimensionar el sprite, seleccionar uno de nueve anclajes para conservar el contenido, elegir la tinta que rellena el área nueva y modificar la vista de ancho doble. El cambio se aplica a todos los frames.

### PNG y datos CPC

La exportación PNG individual genera únicamente el frame actual a escala 1:1, con tinta 0 transparente. Importar un PNG individual desde el editor reemplaza el frame actual, escala la imagen a las dimensiones existentes y la aproxima a la paleta del sprite. La importación y exportación de spritesheets permite leer o escribir todos los frames en un único PNG.

La exportación de datos codifica todos los frames en bytes hardware CPC:

- modo 0: 2 píxeles por byte;
- modo 1: 4 píxeles por byte;
- modo 2: 8 píxeles por byte.

Puede producir BASIC con líneas `DATA` o ensamblador `.db` en hexadecimal o decimal. Opcionalmente reordena líneas en disposición entrelazada CPC e intercala máscara y datos de sprite. El resultado se muestra para copiar al portapapeles; no se descarga directamente como fichero.

## 9. Persistencia y guardado

Los mapas se autoguardan aproximadamente dos segundos después de la última edición. Los cambios de tileset se guardan inmediatamente al cargarlo y con espera de dos segundos al editar píxeles. Los sprites se autoguardan aproximadamente 1,5 segundos después de una modificación. La cabecera comunica progreso, éxito o fallo.

Modelo lógico de Firestore:

```text
users/{uid}/projects/{projectId}
  name, profileId, pages[], createdAt, updatedAt

users/{uid}/projects/{projectId}/maps/{mapId}
  name, tileW, tileH, mapW, mapH, doubleWidth
  roomId, pageId, mapTiles[], connections, entryPositions
  spawns, entities, scripts, createdAt, updatedAt

users/{uid}/projects/{projectId}/pages/{pageId}/assets/tileset
  data, naturalW, naturalH

users/{uid}/projects/{projectId}/sprites/{spriteId}
  name, videoMode, width, height, palette, frames
  createdAt, updatedAt
```

Los tiles de mapa se guardan como un array plano: `-1` significa vacío y un tile se codifica como `fila * 1000 + columna`. Esto presupone tilesets con menos de 1000 columnas. Los sprites guardan, por frame, un array plano de índices de tinta.

## 10. Manifiesto Model01

Solo los proyectos Model01 pueden exportarlo. El JSON contiene versión de formato, dimensiones, máximo de tiles, objetivo de salas por página, presupuestos y páginas con sus salas, rutas TMX, spawns y entidades.

Antes de exportar exige que los IDs de sala formen la secuencia contigua `0..N-1`. Las rutas se generan como `assets/map/<nombre>.tmx`; los ficheros TMX y tilesets no se incluyen en el manifiesto y deben exportarse/ubicarse aparte.

## 11. Comportamientos y limitaciones observados

- No hay suite de pruebas automatizada configurada.
- La persistencia depende de una configuración Firebase válida en variables `VITE_FIREBASE_*` y de reglas de seguridad adecuadas en el proyecto Firebase.
- El borrado de un proyecto elimina sus páginas de tileset, mapas y documento principal, pero el servicio no recorre ni elimina explícitamente la subcolección de sprites; en Firestore borrar el padre tampoco elimina subcolecciones automáticamente. Pueden quedar datos huérfanos.
- El borrado de mapa elimina el documento del mapa, pero no elimina explícitamente su antiguo subdocumento de tileset individual.
- Borrar una página no elimina su documento de tileset y no actualiza explícitamente `pageId` en los mapas que contenía; la interfaz anuncia que quedan sin asignar, pero el dato del mapa puede conservar la referencia antigua.
- El tileset compartido por página exige que los mapas de esa página usen el mismo tamaño de tile para dividir la imagen coherentemente; la interfaz no impone esta coherencia en proyectos genéricos.
- Al importar TMX, el mapa se crea sin `roomId` ni `pageId`; por tanto puede no integrarse plenamente en páginas, conexiones y manifiesto hasta que se trate mediante otras operaciones.
- Los datos `scripts` se conservan en servicios y paquetes, pero no existe un editor de scripts visible en la interfaz actual.
- La función interna de guardado admite metadatos de mapa, pero parte de los cambios visuales, como alternar `doubleWidth`, dependen de una edición posterior que dispare autoguardado; no hay botón general de guardado manual.
- La exportación de paquete fuerza un guardado previo del mapa activo, pero ese guardado previo envía principalmente configuración y tiles; los metadatos ya autoguardados permanecen en Firestore.
- La herramienta Link alterna entradas al pulsar celdas y conexiones al pulsar bordes; un doble clic sobre una celda ejecuta también el manejador de entrada y puede producir alternancias adicionales según la secuencia de eventos del navegador.
- El texto del sprite depende del recurso `/font_chars_0.png` y de un conjunto limitado de caracteres mapeados.

## 12. Resumen de atajos

### Mapa

| Atajo | Acción |
|---|---|
| `S`, `F`, `E` | Stamp, Fill, Eraser |
| `L`, `P`, `V`, `X` | Link, Spawn, Select, Entity |
| `D` | Ancho visual doble |
| `Ctrl+Z` | Deshacer |
| `Ctrl+Shift+Z` / `Ctrl+Y` | Rehacer |
| `Ctrl++` / `Ctrl+-` | Zoom |
| Botón derecho | Borrar contenido de celda |

### Sprite

| Atajo | Acción |
|---|---|
| `B`, `E`, `F`, `M`, `V`, `T` | Pencil, Erase, Fill, Select, Move, Text |
| `D` | Ancho visual doble |
| `Ctrl+C`, `Ctrl+X`, `Ctrl+V` | Copiar, cortar, pegar |
| `Ctrl+Z` | Deshacer |
| `Ctrl+Shift+Z` / `Ctrl+Y` | Rehacer |
| `Escape` | Cancelar contexto/limpiar selección |
| `Shift` + lápiz | Línea recta entre puntos |
| `Alt` + lápiz/fill | Tomar tinta |

## 13. Tecnología y ejecución

La interfaz usa React 18, React Router con navegación por hash y Vite. Firebase 10 proporciona autenticación y Firestore. No hay backend propio ni biblioteca de gestión global de estado: el estado principal reside en `HomePage` y el editor de sprites gestiona internamente el suyo.

Comandos disponibles:

```bash
npm install
npm run dev
npm run build
npm run preview
```

En desarrollo Vite usa la base `/proxy/5173/`; en producción usa rutas relativas. El enrutamiento hash evita conflictos con el proxy inverso.
