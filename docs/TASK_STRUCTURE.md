# Task Structure & CRUD

## UID Estable (Identidad Permanente)

Cada tarea tiene un `id` (string) que es su **UID estable**. Este identificador:

- **Nunca cambia** aunque la tarea sea renombrada, reordenada, indentada o exportada.
- **Nunca se basa en posición** (no es `tasks.length + 1`).
- Para tareas importadas desde XML/ProjectLibre, el UID es el `<UID>` original del archivo.
- Para tareas creadas en Maxima, se genera via `generateTaskUid()` con formato `maxima_<uuid>`.

```typescript
// Ejemplo
generateTaskUid() → "maxima_7c9a2b3d-4e5f-6789-abcd-ef0123456789"
```

Las dependencias (`GanttDependency.taskId`), los `parentId` y las referencias internas siempre usan UID.

## displayId (Posición Visual)

El `displayId` es un número secuencial que se calcula dinámicamente por `buildTaskHierarchy()` según el orden actual de las tareas en el array. Es efímero y se recalcula en cada render.

- **No se almacena** en el modelo.
- Colapsar/expandir no modifica displayIds.
- Al crear/eliminar tareas, los displayIds se renumeran automáticamente.
- Las dependencias se muestran al usuario con displayId pero se almacenan con UID.

## parentId y Jerarquía

- `parentId` referencia al UID del padre.
- Una tarea sin `parentId` es una tarea raíz.
- La profundidad se calcula recursivamente en `buildTaskHierarchy()`.

## Summary Tasks (Comportamiento Dinámico)

Una tarea es summary si tiene al menos un hijo (`task.parentId === summary.id`).

```typescript
taskHasChildren(tasks, taskId) → boolean
```

Cuando una tarea leaf recibe su primera subtarea → se convierte en summary.
Cuando pierde su último hijo → vuelve a ser leaf.

Las fechas de un summary se derivan automáticamente:
- `summary.start = min(start de hijos)`
- `summary.end = max(end de hijos)`

## Crear Tarea

1. Se genera un UID nuevo via `generateTaskUid()`.
2. Se asignan defaults: `name="Nueva tarea"`, `duration=1`, `progress=0`, `dependencies=[]`.
3. La fecha `start` se calcula:
   - Subtarea: hereda el `start` del padre.
   - Tarea raíz: primer día laboral después del `end` más tardío del proyecto.
   - Proyecto vacío: hoy (o siguiente día laboral).
4. Se inserta en la posición correcta del array.
5. Se entra automáticamente en modo edición del nombre.

## Crear Subtarea

1. Se genera UID.
2. Se asigna `parentId = UID del padre`.
3. Se inserta después del padre y todos sus descendientes existentes.
4. El padre se auto-expande en la UI.
5. Si era leaf, pasa a comportarse como summary.

## Eliminar Tarea

### Caso A: Sin hijos ni dependientes
→ Eliminar directamente.

### Caso B: Con subtareas
→ Confirmación: "Contiene X subtareas que también se eliminarán."
→ Eliminar toda la rama.

### Caso C: Otras tareas dependen de ella
→ Confirmación: "X tareas dependen de esta actividad."
→ Al confirmar: se eliminan las referencias (limpieza de dependencias huérfanas).
→ Las tareas que pierden su predecesora **conservan sus fechas** (slack-friendly).

## Undo/Redo

Todas las operaciones CRUD son atómicas:
- Crear → Ctrl+Z elimina la tarea.
- Eliminar rama de 10 tareas → Ctrl+Z restaura las 10 + sus dependencias.
- Renombrar → Ctrl+Z restaura el nombre anterior.

## Limitaciones Actuales

- No hay drag vertical / reorder (FASE 4B).
- No hay indent/outdent manual (FASE 4B).
- No hay copiar/pegar/duplicar tareas.
- No hay recursos editables.
