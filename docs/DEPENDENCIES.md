# Dependency Architecture

## Conceptos Clave: ID vs UID

En MS Project y ProjectLibre existen dos identificadores fundamentales para cada tarea que Project Maxima respeta estrictamente para su motor de dependencias:

1. **`UID` (Identificador Único Permanente):** 
   - Es inmutable y único en todo el ciclo de vida del proyecto.
   - Si una tarea se mueve, elimina o inserta, el `UID` NO cambia.
   - **Toda relación (predecesoras/sucesoras) apunta exclusivamente al `UID`.**
   - Internamente en nuestro modelo (`GanttTask`), el `UID` se guarda en la propiedad `id`.

2. **`ID` / `displayId` (ID Visual Secuencial):**
   - Es la posición física de la tarea en la tabla (1, 2, 3...).
   - Si la tarea 2 se mueve al final, su `ID` visual cambiará al nuevo número de fila.
   - Representa el orden absoluto en el layout original, independientemente de si las tareas padre están colapsadas (ocultas) o expandidas en la interfaz.

### El Proceso de Resolución

Cuando visualizamos las predecesoras de una tarea, el usuario espera ver el `displayId` visual (ej. `14FS`), no el identificador interno del sistema (ej. `300FS`).

Para lograrlo, la arquitectura utiliza un _resolver_ en tiempo de renderizado:
1. La celda itera sobre las dependencias `task.dependencies` (donde `taskId` guarda el `UID` de la predecesora).
2. Se llama a `getDisplayIdByTaskUid(tasks, UID)`.
3. El resolver busca la tarea objetivo en el array aplanado de layout (`tasks` procesado por `buildTaskHierarchy`) y extrae su `displayId` precalculado.

## Tipos de Dependencias Soportadas

Project Maxima soporta internamente los 4 tipos estándar heredados del XML:

- **FS (Finish-to-Start):** La tarea actual no puede iniciar hasta que la predecesora haya finalizado. (La más común, tipificada como `1` en XML).
- **SS (Start-to-Start):** La tarea actual no puede iniciar hasta que la predecesora haya iniciado. (`3` en XML).
- **FF (Finish-to-Finish):** La tarea actual no puede finalizar hasta que la predecesora haya finalizado. (`0` en XML).
- **SF (Start-to-Finish):** La tarea actual no puede finalizar hasta que la predecesora haya iniciado. (`2` en XML).

## Lag / Lead (Retraso o Adelanto)

- Se guarda en el XML bajo `<LinkLag>`. Generalmente viene expresado en décimas de minuto.
- Maxima convierte internamente este valor a **días** considerando las horas de trabajo diario (`<MinutesPerDay>`).
- En la visualización se representa concatenado al tipo de dependencia si es distinto de cero. Ejemplo: `14FS+3d` (3 días de retraso).

## Edición y Validación Inline

La columna "PREDECESORAS" soporta edición de texto inline. Al escribir la dependencia, el usuario utiliza el `displayId` por conveniencia humana. 

**Ejemplos de sintaxis soportada:**
- `4` (Se asume FS: equivale a `4FS`)
- `4SS`, `4FF`, `4SF` (Especificando el tipo explícito)
- `4FS+2d`, `4FS-1d` (Con lag o lead en días. Sin espacios intermedios o con sufijo 'd')
- `4FS, 8SS` (Soporte para dependencias múltiples separadas por coma)

**Validaciones Estrictas (Tiempo Real):**
1. **Existencia:** El ID objetivo debe estar presente en el proyecto.
2. **Auto-dependencia:** Una tarea no puede depender de sí misma.
3. **Duplicidad:** No se permiten enlaces múltiples a la misma tarea.
4. **Ciclos:** Empleamos DFS (`wouldCreateDependencyCycle`) para prohibir dependencias que generen una red circular infinita (Ej. A → B → C → A).

Si se infringe alguna validación, se muestra un *tooltip* flotante rojo nativo de la UI y se cancela el guardado.

## Cronograma (Scheduling Engine) - Etapa Actual

Project Maxima implementa un robusto **Dependency Scheduling Engine** (desacoplado actualmente de la UI React) que se encarga de:
- Empujar fechas de inicio de tareas sucesoras (`eS`) cuando se modifique el fin (`eF`) de una predecesora o se agregue/elimine un enlace.
- Propagar los cambios en cascada usando Búsqueda en Anchura (BFS).
- Respetar Múltiples Predecesoras: Si una tarea depende de varias, se evalúan todas y se asume la fecha *más restrictiva* matemáticamente.
- **Días Laborables**: Excluye fines de semana usando los cálculos de `date-fns` (`addBusinessDays`, `subBusinessDays`).
- **Conservar Holgura (Slack)**: Si una dependencia exige que una tarea empiece el día 10, pero la tarea fue programada manualmente para el día 15, **se queda en el día 15**. El motor está diseñado de manera pasiva y respetuosa para no destruir calendarios sin necesidad.

En la **Siguiente Iteración**, este motor puro se integrará como un "middleware" entre el editor de tareas y la UI, para activarse tras eventos de Drag & Drop y redimensionamiento.
