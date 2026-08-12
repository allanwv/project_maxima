# Maxima Project

## Objetivo

Aplicación web moderna y simple para visualizar y editar planificaciones Gantt, sirviendo como alternativa mucho más amigable visualmente a ProjectLibre. La prioridad es la simplicidad y una UX/UI excepcional.

## Stack

- Next.js (App Router)
- React
- TypeScript
- Tailwind CSS
- ESLint

*Por ahora sin backend y sin base de datos. Funciona completamente local con datos mock.*

## Arquitectura

La aplicación sigue una arquitectura modular y separada:
- `src/domain/`: Modelos de datos principales.
- `src/importers/`: (Futuro) Lógica para importar formatos POD/XML.
- `src/components/`: Componentes UI reutilizables (Gantt, Layout, etc.).
- `src/mock/`: Datos de prueba para el desarrollo inicial.
- `src/app/`: Páginas y enrutamiento de Next.js.

## Modelo de datos

Modelos definidos en `src/domain/models.ts`:
- `GanttProject`
- `GanttTask`
- `GanttDependency`
- `GanttResource`

## Decisiones técnicas

- **Visualización Gantt**: Desarrollada de forma nativa utilizando CSS/HTML en lugar de librerías pesadas para mantener el control sobre la experiencia y el rendimiento.
- **Sin backend inicial**: Construir la UI con mock data primero para validar el diseño y la interacción sin complejidad adicional de infraestructura.
- **Tailwind CSS**: Utilizado para estilos y consistencia visual rápida sin necesidad de preprocesadores externos.

## Estado actual

- [x] Inicialización del proyecto Next.js.
- [x] Configuración de la documentación técnica inicial (`PROJECT_STATE.md`, arquitectura, etc.).
- [x] Definición de los modelos de dominio.
- [x] Creación de datos mock.
- [x] Implementación de la vista principal del Gantt (UI y sync de scroll).
- [x] **Iteración 2**: Importador real de XML (ProjectLibre / MS Project) con `DOMParser`, integrando lectura de archivo local y parseo de dependencias/recursos.

## Próximos pasos

1. Probar XML real exportado desde ProjectLibre.
2. Corregir posibles incompatibilidades encontradas durante el parseo del XML en producción.
3. Investigar e implementar el importador POD (arquitectura preparada).
4. Edición interactiva (drag & drop) de fechas y redimensionamiento de barras.

## Pendientes / dudas

- Evaluación de la carga de trabajo en el cliente para planificaciones muy extensas usando solo HTML/CSS nativo (posible necesidad de windowing/virtualization a futuro).

## Historial de implementación

- **2026-08-10**: Creación del proyecto, estructura base y definición del modelo de datos.
- **2026-08-10 (Iteración 2)**: Implementación de importador de XML nativo en el cliente. Mapeo de campos esenciales (Name, Start, Finish, Duration, OutlineLevel, PredecessorLink, Resources, Assignments). UI de importación añadida.
- **2026-08-10 (Bugfix XML Real)**: Se identificó y resolvió un bug visual donde el componente `GanttTimeline` colapsaba a lo ancho debido a `flex` sin un `width` explícito calculado. El XML proveía las fechas correctas (109 tareas, rango de más de 1 año) pero el layout no permitía scroll horizontal. También se incluyó un test de regresión sobre el archivo real validando 100% de éxito en la ingesta de fechas.
- **2026-08-10 (Iteración 2.1 - Resolvers)**: Robustecimiento del importador añadiendo lógicas avanzadas de fallback (`resolveTaskProgress`) para progreso (considerando `PhysicalPercentComplete`, `PercentWorkComplete` y Custom Fields) y fechas (recurriendo a `EarlyStart/EarlyFinish`). Se enriqueció `GanttTask` con fechas opcionales y metadata de trazabilidad. Pruebas 100% exitosas contra el archivo XML real, que demostró tener progresos nativos al 0%.
- **2026-08-10 (Iteración 2.5)**: Expansión de la `GanttTable` izquierda para mostrar % de avance y fechas estimadas (`eS`, `eF`). Implementación de redimensionamiento de columnas estilo Excel mediante arrastre (`col-resize`) con preservación de anchura global (la línea temporal a la derecha se adapta fluidamente) y persistencia del layout en `localStorage`. Agregada columna `Duración` respetando XML `Duration` y `MinutesPerDay`, marcando `?` si es estimada.
- **2026-08-10 (Iteración 3 - FINAL MVP)**: Conversión de visor a editor Gantt interactivo moderno. 
  - Funcionalidad de *drag & drop* horizontal de barras y redimensionamiento mediante *handles* (respetando dependencias `duration` y lógica L-V sin fin de semana).
  - Edición *inline* en tabla de parámetros (Avance, Duración, eS, eF) con recálculo dinámico inteligente (e.g. al editar duración, `start` se congela y se reasigna `end`).
  - Sincronización transparente bajo un mismo estado del ciclo de vida del proyecto mediante `useProjectEditor`.
  - Herramientas de robustez: Historial *Undo/Redo* con atajos de teclado, persistencia en caché web (Autosave) y exportación/importación al formato propietario encriptado `.maxima.json`.
  - Capa visual mejorada con Tooltips descriptivos e interpolación dinámica de SVG para dependencias de tareas (FS, SS, FF, SF).
- **2026-08-10 (Iteración 3.1 - UX/UI Ajustes)**: 
  - Diferenciación visual de tareas *Summary* (padres). Ahora muestran un fondo gris/slate suave para evitar parecer "completadas al 0%" a diferencia de las tareas hoja celestes.
  - Implementación de controles funcionales de Zoom: Presets de `Día | Semana | Mes` junto a controles incrementales de `+` y `-` con persistencia del nivel de zoom en `localStorage`.
  - Mejorada la representación de las fechas en la tabla para usar el formato `dd-MM-yyyy` optimizando el truncado.
- **2026-08-10 (Iteración 4 - Dependencias (Fase 1))**:
  - Preparación de la arquitectura base para soporte robusto de predecesoras, manejando correctamente los conceptos de `UID` (identidad permanente) vs `displayId` (posición mostrada).
  - Integración de dos nuevas columnas: **ID** (visual) y **PREDECESORAS**.
  - Mapeo dinámico de relaciones del tipo FS/SS/FF/SF + Lag, leyendo la etiqueta nativa `<LinkLag>` (decodificando minutos a días) y `<Type>` del XML.
  - Comprobado que la línea SVG de dependencias existente dependa de `UID` (identificador estable).
  - **Edición Inline de Predecesoras**:
    - Permite escribir dependencias de forma humana (`4FS+2d, 5`).
    - Resolución `DisplayId -> UID` al guardar.
    - Validaciones estrictas: Prevención de ciclos, auto-dependencias, id inexistentes y dependencias duplicadas.
    - Integración automática con Undo/Redo y persistencia a archivo `.json` de Maxima.
    - Líneas SVG actualizadas en tiempo real, aún sin recalcular cronograma en cascada.
  - **Dependency Scheduling Engine (Capa de lógica pura)**:
    - Función central `scheduleProjectAfterTaskChange` que recalcula fechas al vuelo.
    - Soporte completo para relaciones FS, SS, FF y SF, incluyendo lags positivos y negativos (leads).
    - Múltiples predecesoras por tarea (aplica la restricción más exigente matemáticamente).
    - Propagación en cascada recorriendo el árbol de sucesoras (`BFS` graph traversal).
    - Mantiene duraciones originales en días laborales. Ignora fines de semana para cálculo de fechas.
    - Ajuste recíproco de start/end en Summary Tasks y propagación jerárquica.
    - Estrategia pasiva/slack-friendly: solo desplaza barras hacia adelante si la dependencia lo fuerza. No destruye los adelantamientos manuales (holgura).
  - **FASE 4A - CRUD Estructural**:
    - Renombrar proyecto: Edición inline en el header (doble-click o icono lápiz, Enter/Escape/blur).
    - Renombrar tarea: Columna `Nombre` editable inline con validación (no vacío).
    - Crear tarea raíz: Botón `+ Tarea` al final de la tabla. Genera UID estable con prefijo `maxima_`.
    - Crear subtarea: Menú contextual `···` en cada fila → "Agregar subtarea" con auto-expand del padre.
    - Eliminar tarea: Menú contextual con confirmación cuando hay subtareas o dependientes. Limpieza automática de dependencias huérfanas (slack-friendly: no mueve fechas).
    - UID estable: Generado via `generateTaskUid()` con formato `maxima_<uuid>`. Nunca basado en displayId ni posición.
    - displayId: Recalculado dinámicamente por `buildTaskHierarchy()` según posición actual.
    - Summary dinámico: Cualquier tarea con hijos se comporta como summary automáticamente.
    - Undo/Redo atómico para todas las operaciones CRUD.
    - Save/Load `.maxima.json` preserva UIDs, jerarquía y dependencias.

### Próximos Pasos (Futuro - Post MVP)
- **FASE 4B**: Reorder + Indent/Outdent + Drag vertical.
- **Integrar Scheduling Engine con UI**: Conectar la lógica pura a eventos de Drag & Drop, resize y edición de celdas fecha/duración.
