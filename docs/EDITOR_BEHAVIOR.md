# Maxima Editor Behavior

## 1. Drag & Drop (Mover Barras)
- Las barras de tareas que no son "summary" (padres) pueden moverse horizontalmente mediante drag and drop.
- Durante el movimiento, se realiza un *snap* visual y lógico al nivel de día.
- Mover una barra actualiza el `start` y `end`, pero mantiene intacta la `duration` de la tarea.
- El movimiento inyecta en la metadata de la tarea el origen `startSource: maxima-user` y `finishSource: maxima-user`.

## 2. Redimensionamiento (Resize)
- Las barras cuentan con dos manejadores (handles) en los extremos que se revelan al hover.
- **Left Handle**: Cambia el `start`. Recalcula la duración. Mantiene `end` fijo.
- **Right Handle**: Cambia el `end`. Recalcula la duración. Mantiene `start` fijo.
- La duración nunca puede ser menor a 1 día de unidad básica.

## 3. Edición Inline en Tabla
- Las columnas `%`, `Duración`, `eS`, y `eF` permiten edición inline mediante "doble clic".
- **Duración**: Al editar, se recalcula el `end` de la tarea excluyendo fines de semana (Lunes a Viernes). Se asigna `durationSource: maxima-calculated`.
- **Fechas**: Al editar `eS` se recalcula `eF` para mantener duración. Al editar `eF` se recalcula la duración manteniendo `eS`.
- **Avance**: Permite valores de 0 a 100, asignando `progressSource: maxima-user`.

## 4. Tareas Padre (Summary)
- Las tareas padre (que contienen hijos en la jerarquía) no se pueden arrastrar ni redimensionar directamente.
- Sus fechas de `start` y `end` son derivadas automáticamente del mínimo `start` y máximo `end` de todos sus descendientes de forma recursiva.

## 5. Hitos (Milestones)
- Se representan visualmente como diamantes.
- Pueden moverse en el tiempo arrastrándolos, pero NO pueden redimensionarse.
- Se mantiene su constante `start === end` y `duration === 0`.

## 6. Sincronización y Estado
- Maxima emplea una arquitectura centralizada donde `useProjectEditor` expone el estado de edición in-memory.
- Al interactuar con el Timeline (Drag, Resize) o con la Table (Inline Edit), todo muta un solo estado compartido `GanttProject`.
- Dependencias (FS, SS, FF, SF) se renderizan en tiempo real mediante un SVG overlay adaptativo sobre el timeline.

## 7. Undo / Redo
- Se mantiene un historial local estricto (`history` y `future`) con un límite de 50 estados.
- Controles por interfaz en el header o atajos de teclado (`Ctrl+Z`, `Ctrl+Shift+Z`).

## 8. Persistencia y Exportación Local
- **Autosave**: El proyecto modificado se guarda silenciosamente en `localStorage` (bajo la key `maxima:autosave`) previniendo pérdida de información.
- **Exportación Local**: No se sobrescribe el XML nativo de MS Project / ProjectLibre para evitar corrupción. Se genera un archivo `.maxima.json` descargable para persistir el modelo editable propio con toda la metadata encriptada.
