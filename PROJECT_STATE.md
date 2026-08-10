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
- [ ] Creación de datos mock.
- [ ] Implementación de la vista principal del Gantt.

## Próximos pasos

1. Implementar la UI principal del diagrama de Gantt (Header, lista de tareas, línea de tiempo).
2. Desarrollar la lógica de expansión/colapso de tareas.
3. Sincronizar el scroll vertical entre la tabla de tareas y la vista del timeline.

## Pendientes / dudas

- Evaluación de la carga de trabajo en el cliente para planificaciones muy extensas usando solo HTML/CSS nativo (posible necesidad de windowing/virtualization a futuro).

## Historial de implementación

- **2026-08-10**: Creación del proyecto, estructura base y definición del modelo de datos.
