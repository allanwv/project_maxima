# Formatos de Importación

El sistema Maxima puede importar planificaciones creadas en otras herramientas, principalmente **ProjectLibre** y **Microsoft Project**.

## Formatos Soportados

1. **XML (Microsoft Project / ProjectLibre Export)** - **SOPORTADO**
   - Utilizamos un parseo basado en `DOMParser` local en el navegador, sin enviar datos al backend.
   - **Campos Soportados:**
     - `Project.Name` / `Project.Title`
     - **Resources**: Reconstruido a partir de `<Resources>`.
     - **Assignments**: `<Assignments>` mapea Recursos con `TaskUID`, `ResourceUID`.

#### Resolución de Progreso (Avance)
El importador sigue un orden estricto de prioridad para no inventar información:
1. `PhysicalPercentComplete` (solo si `EarnedValueMethod` = 1).
2. `PercentComplete`.
3. `PercentWorkComplete`.
4. Atributos extendidos (`ExtendedAttribute`) que mapean a términos conocidos como "avance", "progreso".
5. `0` por defecto.

#### Resolución de Duración
- **Fuente Principal**: `<Duration>` (XML format ISO `PTxHxMxS`).
- **Conversión a días**: Se usa la constante `<MinutesPerDay>` dictada por el XML del proyecto (por defecto 480 mins = 8 horas).
- **Estimación**: Se lee `<Estimated>` o `<DurationFormat>` (p. ej. > 34, que codifica *estimated days*, *estimated hours*) para marcarlo como `durationEstimated`.
- **Fallback**: Si no existe `Duration` pero hay `Start/Finish`, la duración es la `differenceInDays + 1`, marcando `durationSource: 'calculated-from-dates'`. Nota: Start/Finish definen la posición programada de la barra visualmente, pero Duration expresa el volumen de trabajo (no son 1:1 equivalentes).

#### Fechas Estimadas
- **Inicio Estimado**: `<Start>` → fallback: `<EarlyStart>`.
- **Fin Estimado**: `<Finish>` → fallback: `<EarlyFinish>`.
- Fechas reales como `ActualStart` y `ActualFinish` se preservan en el modelo opcionalmente, pero **no** se usan como fechas programadas visuales en la Gantt actual.

     - `Tasks`:
       - `UID`
       - `Name`
       - `Start`
       - `Finish`
       - `Duration` (Formato ISO 8601 tipo `PT24H0M0S`)
       - `PercentComplete`
       - `Milestone`
       - `OutlineLevel` (Utilizado para inferir jerarquía de padres/hijos)
       - `PredecessorLink` (`PredecessorUID`, `Type`, `LinkLag`)

2. **POD (ProjectLibre Nativo)** - **(Futuro)**
   - Formato binario nativo de ProjectLibre.
   - Contiene objetos serializados de Java. No es un XML.
   - Requiere probablemente usar una API puente o descifrar/descomprimir la serialización Java. No se implementará hasta validar el XML.

## Arquitectura de Ingesta

La UI de Maxima nunca depende de las estructuras nativas de estos archivos.

```text
POD ──→ PodImporter ──┐
                      │
XML ──→ XmlImporter ──┼──→ GanttProject ──→ UI
                      │
JSON ─→ JsonImporter ─┘
```
