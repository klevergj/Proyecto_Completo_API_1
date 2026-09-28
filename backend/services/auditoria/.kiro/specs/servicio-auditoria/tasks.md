# Implementation Plan

## Overview

Plan incremental y guiado por pruebas para el Servicio de Auditoría en `services/auditoria`. El servicio ya tiene la estructura estándar del steering con un repositorio en memoria. Este plan actualiza primero el contrato (steering `tech.md`), luego los módulos puros (configuración, fechas, errores, modelo, DTOs), después el patrón Repository con la implementación MongoDB, la capa HTTP y el arranque, y al final Docker Compose.

Lenguaje: **JavaScript (Node.js 20 LTS)**. Se añade `fast-check` (`4.10.2`) como devDependency; `mongodb` ya está en `dependencies`.

## Tasks

- [x] 1. Actualizar primero el contrato OpenAPI 3.0 (`contracts/spec7-auditoria.yaml`)
  - [x] 1.1 Actualizar `spec7-auditoria.yaml` a la versión `1.1.0`
    - `servers` internos y `GET /health` (con `almacen`)
    - `RegistroAuditoria` con `identificacion`, `montoSolicitado`, `plazoMeses`; obligatorios `idEvaluacion`, `decision`, `fecha`, `consultaBuroRealizada`, `reglasAplicadas`; `RegistroAuditoriaAlmacenado` con `registradoEn`
    - `GET /registros` con `estado`, `fechaDesde`, `fechaHasta`, `tiendaId`, `page` (base 0) y `size` (1-100, default 20); `PaginaRegistros { total, page, size, items }`
    - `GET /registros/{idEvaluacion}`; `ErrorRespuesta`; respuestas 201/400/404/409/500/503 con ejemplos
    - _Requirements: 1.1, 1.4, 1.6, 2.1, 2.7, 3.1, 3.2, 4.1, 4.4, 5.4, 5.6, 5.7_

- [x] 2. Configuración y módulos puros
  - [x] 2.1 Añadir `fast-check` (`4.10.2`) como devDependency
    - _Requirements: 1.1_

  - [x] 2.2 Reescribir `src/config/auditoriaConfig.js` y `.env.example`
    - `mongoUri` (sin credenciales por defecto), `dbName`, `mongoTimeoutMs`, `paginaTamanoDefecto`, `paginaTamanoMaximo`, `dbInitReintentos`, `dbInitEsperaMs`
    - Valores inválidos o defecto > máximo → defaults + advertencia
    - `.env.example` sin la cadena de conexión real
    - _Requirements: 4.5, 5.1, 5.3, 5.4_

  - [x] 2.3 Crear `src/utils/fechas.js` y `src/utils/errorAuditoria.js`
    - Validación `YYYY-MM-DD` de calendario real; `inicioDiaUtc` e `inicioDiaSiguienteUtc`
    - `ErrorAuditoria(status, code, message)` con `toRespuesta()` y `clasificarErrorAlmacen(error)` según la tabla del diseño
    - _Requirements: 2.3, 2.4, 5.4, 5.5, 5.6_

  - [x] 2.4 Reescribir `src/models/registroAuditoria.js` y crear los DTOs
    - Modelo inmutable con `fecha` y `registradoEn` como `Date` y opcionales en `null`
    - `dtos/registroAuditoriaDto.js`: `validarRegistroAuditoria` (lista blanca) y `toRegistroAuditoriaDto`
    - `dtos/listadoRegistrosDto.js`: `validarParametrosListado` y `toPaginaRegistrosDto`
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 2.7, 4.1, 4.2, 4.3, 4.4_

  - [x]* 2.5 Escribir pruebas unitarias de configuración y fechas
    - Defaults, defecto > máximo, bordes de día UTC, fechas inexistentes (`2026-02-30`)
    - _Requirements: 2.3, 2.4, 4.5_

  - [x]* 2.6 Escribir prueba basada en propiedades para la clasificación de errores del almacén
    - `// Feature: servicio-auditoria, Property 7: Todo fallo del almacén se traduce sin filtraciones`
    - **Property 7** — **Validates: Requirements 5.4, 5.5, 5.6** — `{ numRuns: 100 }`

- [x] 3. Patrón Repository
  - [x] 3.1 Reescribir `repositories/registroAuditoriaRepository.interface.js`
    - `inicializar`, `guardar`, `buscarPorId`, `buscar` + `asegurarRegistroAuditoriaRepository`
    - _Requirements: 1.1, 2.1, 3.1_

  - [x] 3.2 Crear `repositories/mongoRegistroAuditoriaRepository.js`
    - `_id = idEvaluacion`; índices `{fecha:-1,_id:1}`, `{decision:1,fecha:-1,_id:1}`, `{tiendaId:1,fecha:-1,_id:1}`
    - Filtros, orden `fecha` desc / `_id` asc, `skip`/`limit`, `countDocuments`, `maxTimeMS`; `11000` → 409
    - _Requirements: 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 5.2_

  - [x] 3.3 Reescribir `repositories/memoriaRegistroAuditoriaRepository.js` con la misma semántica
    - _Requirements: 1.6, 2.1, 2.6_

  - [x] 3.4 Crear `db/mongoCliente.js` (reemplaza `db/connection.js`)
    - `crearClienteMongo({ mongoUri, dbName, mongoTimeoutMs })` → `{ client, db, verificarConexion, cerrar }`
    - _Requirements: 5.1, 5.4, 5.7_

  - [x]* 3.5 Escribir las pruebas de contrato del repositorio (memoria siempre; MongoDB con `MONGO_URI_TEST`)
    - Guardar / duplicado, `buscarPorId`, filtros, orden, paginación, `inicializar` idempotente
    - _Requirements: 1.6, 2.1, 2.6, 3.1, 3.2, 5.2_

- [x] 4. Checkpoint — Módulos y repositorios
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Capa HTTP y arranque
  - [x] 5.1 Crear middlewares `validarRegistroAuditoria`, `validarParametrosListado`, `validarIdEvaluacion` y reescribir `manejadorErrores`
    - _Requirements: 1.4, 1.5, 2.7, 3.3, 4.4, 5.5, 5.6_

  - [x] 5.2 Reescribir `controllers/registrosController.js` y `routes/registrosRoutes.js`
    - `crear` (201), `listar` (200), `obtenerPorId` (200 / 404)
    - _Requirements: 1.1, 2.1, 3.1, 3.2, 4.1_

  - [x] 5.3 Reescribir `app.js` e `index.js`
    - `crearApp({ registroRepository, verificarAlmacen, config, ahora })`; `/health` con `almacen`
    - `index.js`: cliente Mongo + `mongoRegistroAuditoriaRepository`; `iniciar()` con reintentos de `inicializar()` y `exit(1)`
    - _Requirements: 5.3, 5.7_

  - [x]* 5.4 Escribir prueba basada en propiedades: ida y vuelta de un registro válido
    - `// Feature: servicio-auditoria, Property 1: Ida y vuelta de un registro válido`
    - **Property 1** — **Validates: Requirements 1.1, 1.2, 1.3, 3.1** — `{ numRuns: 100 }`

  - [x]* 5.5 Escribir prueba basada en propiedades: registro inválido rechazado sin persistir
    - `// Feature: servicio-auditoria, Property 2: Un registro inválido se rechaza sin persistir`
    - **Property 2** — **Validates: Requirements 1.4, 1.5** — `{ numRuns: 100 }`

  - [x]* 5.6 Escribir prueba basada en propiedades: filtros exactos
    - `// Feature: servicio-auditoria, Property 3: El listado devuelve exactamente los registros que cumplen los filtros`
    - **Property 3** — **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5** — `{ numRuns: 100 }`

  - [x]* 5.7 Escribir prueba basada en propiedades: paginación estable, completa y acotada
    - `// Feature: servicio-auditoria, Property 4: La paginación es estable, completa y acotada`
    - **Property 4** — **Validates: Requirements 2.6, 4.1, 4.6** — `{ numRuns: 50 }`

  - [x]* 5.8 Escribir prueba basada en propiedades: parámetros inválidos
    - `// Feature: servicio-auditoria, Property 5: Parámetros de listado inválidos se rechazan con 400`
    - **Property 5** — **Validates: Requirements 2.7, 4.4** — `{ numRuns: 100 }`

  - [x]* 5.9 Escribir prueba basada en propiedades: duplicados
    - `// Feature: servicio-auditoria, Property 6: Un duplicado se rechaza y el original no cambia`
    - **Property 6** — **Validates: Requirements 1.6, 1.7** — `{ numRuns: 100 }`

  - [x]* 5.10 Escribir pruebas de ejemplo de `/health`, errores del almacén y arranque
    - `/health` UP/DOWN; repositorio caído → 503 sin filtraciones; `iniciar` reintenta y agota con `exit(1)`
    - _Requirements: 5.3, 5.4, 5.5, 5.7_

- [x] 6. Orquestación
  - [x] 6.1 Actualizar `docker-compose.yml` para `auditoria`
    - Variables `MONGO_TIMEOUT_MS`, `PAGINA_TAMANO_DEFECTO`, `PAGINA_TAMANO_MAXIMO`
    - _Requirements: 4.5, 5.4_

- [x] 7. Checkpoint final — Ensure all tests pass
  - Pruebas completas y verificación contra `mongo:7` en Docker con `MONGO_URI_TEST`
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Las tareas con `*` son opcionales (pruebas) pero recomendadas: la auditoría sustenta el control del KPI del 60 % sin buró.
- Contract-first (steering `tech.md`): la tarea 1 actualiza `spec7`, entrada de la feature `bff-auditoria`. Según `structure.md`, no se copia el YAML en el servicio.
- Seguridad: `MONGO_URI` real sigue en `docker-compose.yml` y `README.md` (fuera de este servicio). Se recomienda rotar la contraseña de Atlas y moverla a un `.env` no versionado.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "2.2", "2.3", "3.1"] },
    { "id": 2, "tasks": ["2.4", "2.5", "2.6", "3.4"] },
    { "id": 3, "tasks": ["3.2", "3.3"] },
    { "id": 4, "tasks": ["3.5", "5.1"] },
    { "id": 5, "tasks": ["5.2", "5.3"] },
    { "id": 6, "tasks": ["5.4", "5.5", "5.6", "5.7", "5.8", "5.9", "5.10", "6.1"] }
  ]
}
```
