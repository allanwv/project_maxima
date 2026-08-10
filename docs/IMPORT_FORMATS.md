# Formatos de Importación

El sistema Maxima deberá poder importar planificaciones creadas en otras herramientas, principalmente **ProjectLibre**.

## Formatos Soportados (Futuro)

1. **XML (Microsoft Project / ProjectLibre Export)**
   - Estándar abierto, más fácil de parsear utilizando herramientas estándar de XML a JSON/JS Object en el navegador o backend.

2. **POD (ProjectLibre Nativo)**
   - Formato binario nativo de ProjectLibre.
   - **IMPORTANTE**: Contiene objetos serializados de Java. No es un XML.
   - Requiere un enfoque cuidadoso para su parsing. No se debe desarrollar un parser JavaScript completo de inmediato, sino probablemente usar una API puente o un parser altamente específico que extraiga la data necesaria mediante descifrado/descompresión de la serialización Java.

## Arquitectura de Ingesta

La UI de Maxima nunca dependerá de las estructuras nativas de estos archivos.

Flujo:
1. Archivo subido por el usuario (`.xml` o `.pod`).
2. Módulo `importers` toma el archivo.
3. El importer específico parsea el archivo y lo mapea al modelo interno `GanttProject`.
4. La vista React recibe únicamente el objeto `GanttProject`.

```text
POD ───────────→ conversor/importador ─┐
                                       ↓
XML ───────────→ parser XML ───────────→ modelo interno común
                                       ↓
                                   React / Gantt
```
