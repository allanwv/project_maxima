# Columnas del Gantt

## Fuente de verdad

Todo el catálogo de columnas se define en:

`src/domain/columnDefinitions.ts`

Cada columna tiene un `GanttColumnId`, label, tooltip, ancho default, ancho mínimo, grupo (`core` / `optional`) y flags como `alwaysVisible` y `readOnly`.

## Catálogo actual

### Columnas core (visibles por defecto)

| ID | Label | Ancho default | Editable |
|---|---|---|---|
| `id` | ID | 55px | No (solo lectura visual) |
| `name` | Nombre de la Tarea | 280px | Sí (inline) |
| `progress` | % | 65px | Sí (inline numérico) |
| `duration` | Duración | 105px | Sí (inline numérico) |
| `estimatedStart` | S | 110px | Sí (inline date) |
| `estimatedFinish` | F | 110px | Sí (inline date) |
| `predecessors` | PREDEC. | 120px | Sí (inline expression) |

### Columnas opcionales (ocultas por defecto)

| ID | Label | Selector Label | Ancho default | Editable |
|---|---|---|---|---|
| `resources` | RESPONSABLES | Responsables | 150px | No |
| `actualStart` | aS | aS · Inicio real | 105px | No |
| `actualFinish` | aF | aF · Fin real | 105px | No |
| `baselineStart` | bS | bS · Inicio línea base | 105px | No |
| `baselineFinish` | bF | bF · Fin línea base | 105px | No |

## Reglas

1. **`name` es obligatoria**: marcada con `alwaysVisible: true`. Aparece como checkbox checked + disabled en el selector.
2. **Las opcionales son solo lectura por ahora**. La edición de recursos, fechas reales y baseline será implementada en fases posteriores.
3. **Ocultar una columna NO elimina su width guardado**. Al volver a mostrarla, recupera su ancho anterior.

## Responsables

La columna `resources` resuelve:

```
task.resourceIds → project.resources
```

Muestra los nombres de los recursos asignados, separados por coma.

- Si no cabe, se trunca con ellipsis y tooltip con la lista completa.
- **Solo usa Resource Assignments**, no campos de texto libre como `Contact` del XML.

## Fechas opcionales

- `actualStart` → `task.actualStart`
- `actualFinish` → `task.actualFinish`
- `baselineStart` → `task.baselineStart`
- `baselineFinish` → `task.baselineFinish`

Si el campo no existe en el modelo (el XML no lo traía, o es un proyecto nuevo):

→ La celda queda vacía. NO se muestra "N/A" ni se usa fallback a otras fechas.

## Selector de columnas

Botón `Columnas` con icono ubicado en la barra superior del área Gantt (entre el header de la app y la tabla).

Al hacer click abre un popover (no un modal de pantalla completa) con checkboxes.

- Cambios son **inmediatos** (sin botón Guardar).
- Se cierra con Escape, click fuera, o la X implícita.
- Incluye botón `Restaurar predeterminadas` al fondo.

## Persistencia

| Dato | localStorage key | Formato |
|---|---|---|
| Columnas visibles | `maxima:gantt-visible-columns` | `GanttColumnId[]` JSON |
| Anchos de columnas | `maxima:gantt-column-widths` | `Record<GanttColumnId, number>` JSON |

> **Importante**: La configuración de columnas es una **preferencia local del usuario**. NO se guarda dentro de `.maxima.json`. Así abrir el mismo proyecto en otro equipo no obliga a usar la configuración visual del creador.

### Fallback seguro

Al cargar desde localStorage:
- IDs desconocidos son filtrados (compatibilidad con versiones futuras).
- Columnas `alwaysVisible` se fuerzan de vuelta si faltan.
- Datos corruptos caen a defaults silenciosamente.

## XML sin datos opcionales

El modal muestra **todas** las columnas disponibles, independientemente del proyecto actual.

Si un XML no trae baseline o actual dates, el usuario puede activar esas columnas igualmente → las celdas quedarán vacías. Esto permite mantener un layout consistente entre proyectos.

## Integración con resize

Las nuevas columnas usan exactamente el mismo mecanismo de resize que las existentes:

1. Pointer drag en el handle derecho del header.
2. Se respetan `minWidth` por columna.
3. Los anchos se persisten en localStorage bajo la misma key.
4. El `totalWidth` del panel se recalcula automáticamente sumando solo las columnas visibles.
