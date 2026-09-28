# Implementation Plan

## Overview

Plan incremental y guiado por pruebas para el BFF Auditoría en `services/bff-auditoria`. Depende del contrato `spec7-auditoria.yaml` v1.1.0 (feature `servicio-auditoria`). El servicio ya tiene la estructura estándar del steering con un repositorio HTTP passthrough. Este plan actualiza primero el contrato (steering `tech.md`), luego los módulos puros, el repositorio, la capa HTTP y las pruebas.

Lenguaje: **JavaScript (Node.js 20 LTS)**. Se añade `fast-check` (`4.10.2`) como devDependency.

## Tasks

- [x] 1. Actualizar primero el contrato OpenAPI 3.0 (`contracts/spec3-bff-auditoria.yaml`)
  - [x] 1.1 Actualizar `spec3-bff-auditoria.yaml` a la versión `1.1.0`
    - `servers` internos y `GET /health`
    - `GET /evaluaciones` con `estado`, `fechaDesde`, `fechaHasta`, `tiendaId`, `page` (base 0), `size` (1-100, default 20) → `PaginaResumenAuditoria { total, page, size, totalPaginas, items: ResumenAuditoria[] }`
    - `GET /evaluaciones/{id}/detalle` → `DetalleAuditoria` (12 campos, opcionales `nullable`)
    - `ErrorRespuestaAuditoria`; respuestas 400/404/500/502/503/504 con ejemplos
    - _Requirements: 1.1, 1.3, 2.3, 2.4, 3.1, 3.2, 3.5, 4.1, 4.2, 4.3, 4.5_

- [x] 2. Configuración y módulos puros
  - [x] 2.1 Añadir `fast-check` (`4.10.2`) como devDependency
    - _Requirements: 1.1_

  - [x] 2.2 Reescribir `src/config/bffAuditoriaConfig.js` y `.env.example`
    - `auditoriaTimeoutMs` (default 3000), `paginaTamanoDefecto` (20), `paginaTamanoMaximo` (100) con validación
    - _Requirements: 2.5, 4.1_

  - [x] 2.3 Crear `src/utils/fechas.js` y `src/utils/errorBffAuditoria.js`
    - `ErrorBffAuditoria(status, code, message, reintentable)` + `traducirErrorAuditoria` según la tabla del diseño
    - _Requirements: 1.3, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 2.4 Crear `src/models/evaluacionAuditada.js` y los DTOs
    - `EvaluacionAuditada.desdeRegistro` (502 si no cumple Spec 7; opcionales → `null`)
    - `dtos/parametrosListadoDto.js`, `resumenAuditoriaDto.js`, `detalleAuditoriaDto.js`, `paginaResumenAuditoriaDto.js`
    - _Requirements: 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 3.2, 3.3, 4.3_

  - [x]* 2.5 Escribir prueba basada en propiedades: `totalPaginas`
    - `// Feature: bff-auditoria, Property 3: totalPaginas es consistente con total y size`
    - **Property 3** — **Validates: Requirements 2.3** — `{ numRuns: 100 }`

  - [x]* 2.6 Escribir prueba basada en propiedades: traducción de errores
    - `// Feature: bff-auditoria, Property 5: Todo fallo del Servicio de Auditoría se traduce sin filtraciones`
    - **Property 5** — **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5** — `{ numRuns: 100 }`

- [x] 3. Patrón Repository
  - [x] 3.1 Reescribir `repositories/registroAuditoriaRepository.interface.js` (`buscar`, `buscarPorId`)
    - _Requirements: 1.1, 3.1_

  - [x] 3.2 Reescribir `repositories/httpRegistroAuditoriaRepository.js`
    - `buscar` → `GET /registros` (params lista blanca; valida forma → 502); `buscarPorId` → `GET /registros/{id}` (404 → `null`)
    - _Requirements: 1.1, 1.2, 3.1, 3.5, 4.3_

  - [x]* 3.3 Escribir pruebas por ejemplo del repositorio HTTP con `httpClient` inyectado
    - _Requirements: 1.2, 3.5, 4.3_

- [x] 4. Capa HTTP
  - [x] 4.1 Crear middlewares `validarParametrosListado` y `validarIdEvaluacion`; reescribir `manejadorErrores`
    - _Requirements: 1.3, 2.2, 3.4, 4.5, 4.6_

  - [x] 4.2 Reescribir `controllers/evaluacionesController.js`, `routes/evaluacionesRoutes.js`, `app.js` e `index.js`
    - `listar` → página de resúmenes; `obtenerDetalle` → detalle / 404
    - _Requirements: 1.1, 2.3, 3.1, 3.5_

  - [x]* 4.3 Escribir prueba basada en propiedades: listado con lista blanca y resúmenes
    - `// Feature: bff-auditoria, Property 1: El listado delega con lista blanca y devuelve resúmenes en el mismo orden`
    - **Property 1** — **Validates: Requirements 1.1, 1.2, 1.4, 2.4** — `{ numRuns: 100 }`

  - [x]* 4.4 Escribir prueba basada en propiedades: parámetros inválidos
    - `// Feature: bff-auditoria, Property 2: Parámetros inválidos se rechazan sin salir a red`
    - **Property 2** — **Validates: Requirements 1.3, 2.2** — `{ numRuns: 100 }`

  - [x]* 4.5 Escribir prueba basada en propiedades: forma del detalle
    - `// Feature: bff-auditoria, Property 4: El detalle tiene siempre la forma completa y conserva los datos del analista`
    - **Property 4** — **Validates: Requirements 3.1, 3.2, 3.3** — `{ numRuns: 100 }`

- [x] 5. Checkpoint final — Ensure all tests pass
  - Pruebas completas y verificación de extremo a extremo `bff-auditoria` → `auditoria` → `mongo:7`
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Las tareas con `*` son opcionales (pruebas) pero recomendadas.
- Contract-first (steering `tech.md`): la tarea 1 actualiza `spec3`. `spec1-gateway.yaml` (`/auditoria/evaluaciones`) se realineará en la feature del Gateway con `spec3` v1.1.0 como entrada.
- El Gateway reenvía `/auditoria/*` sin el prefijo, así que `/auditoria/evaluaciones/{id}/detalle` llega como `/evaluaciones/{id}/detalle` (verificado en las pruebas del Gateway).

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "2.2", "2.3", "3.1"] },
    { "id": 2, "tasks": ["2.4", "2.5", "2.6"] },
    { "id": 3, "tasks": ["3.2", "4.1"] },
    { "id": 4, "tasks": ["3.3", "4.2"] },
    { "id": 5, "tasks": ["4.3", "4.4", "4.5"] }
  ]
}
```
