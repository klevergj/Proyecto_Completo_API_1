# Implementation Plan

## Overview

Plan de implementación incremental y guiado por pruebas para el Repositorio Interno en `services/repositorio-interno`. El servicio **ya existe y arranca**, así que se mejora sin reconstruirlo. El orden respeta el steering y las dependencias del diseño: primero el contrato en `contracts/` (fuente de verdad), luego la configuración y los módulos puros (validación, mapper, errores), luego la infraestructura de datos (pool, esquema, siembra y repositorio), después la capa HTTP y el arranque, y al final Docker Compose.

Lenguaje de implementación: **JavaScript (Node.js 20 LTS)**. Se añaden `fast-check` y `pg-mem` como devDependencies (Jest y Supertest ya existen). Las identificaciones `1710000001`, `1720000002` y `1730000003` se conservan porque ya las usan Postman, k6 y el test E2E.

## Tasks

- [x] 1. Actualizar primero el contrato OpenAPI 3.0 (`contracts/spec6-repositorio-interno.yaml`)
  - [x] 1.1 Actualizar `contracts/spec6-repositorio-interno.yaml` como fuente de verdad (versión `1.1.0`)
    - `servers` internos (`http://repositorio-interno:8092`, `http://localhost:8092`) y `GET /health` con el estado de la base
    - Parámetro `identificacion` con `pattern` y `maxLength: 20`
    - `HistorialCliente` con `required`, `additionalProperties: false`, rangos y ejemplos de los datos semilla
    - Esquema `ErrorRespuesta` con el enum de `code`; respuestas 200, 400, 404, 500 y 503 con ejemplos, en el estilo de `spec4-evaluacion-core.yaml`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.3, 4.1, 4.3, 4.4, 4.6_

- [x] 2. Configuración y dependencias
  - [x] 2.1 Añadir `fast-check` (`4.10.2`) y `pg-mem` como devDependencies con versión fijada
    - Confirmar que `app` se sigue exportando desde `src/index.js` y que el arranque está protegido por `NODE_ENV !== "test"`
    - _Requirements: 1.1_

  - [x] 2.2 Crear `src/config/repoConfig.js` y actualizar `.env.example`
    - `db` (host, port, user, password, database) con los defaults actuales
    - `dbPoolMax` (default 10), `dbConexionTimeoutMs` (default 1500), `dbConsultaTimeoutMs` (default 2000)
    - `seedAlIniciar` (default true; solo `"false"` lo desactiva), `dbInitReintentos` (default 10), `dbInitEsperaMs` (default 2000)
    - Ante un valor inválido: usar el default y registrar una advertencia
    - Documentar las variables nuevas en `.env.example`
    - _Requirements: 3.6, 3.7, 4.1, 4.2, 4.5_

  - [x]* 2.3 Escribir pruebas unitarias de `repoConfig`
    - Defaults, parsing, reemplazo de valores inválidos y `dbConexionTimeoutMs + dbConsultaTimeoutMs < 4000` por defecto
    - _Requirements: 3.6, 3.7, 4.5_

- [x] 3. Módulos puros: validación, mapper y errores
  - [x] 3.1 Crear `src/middlewares/validarIdentificacion.js`
    - `normalizarIdentificacion(valor)` → identificación con `trim` o `null` si no cumple `/^[0-9A-Za-z-]{1,20}$/`
    - Middleware `validarIdentificacion`: 400 `IDENTIFICACION_INVALIDA` o deja `req.identificacion`
    - _Requirements: 1.5_

  - [x] 3.2 Crear `src/utils/fechas.js`, `src/models/clienteHistorial.js` y `src/dtos/historialClienteDto.js`
    - `mesesCompletosEntre(desde, hasta)`: meses completos con componentes UTC, mínimo 0; acepta `"YYYY-MM-DD"` o `Date`
    - Modelo inmutable `ClienteHistorial` con `antiguedadMeses(ahora)`
    - `toHistorialClienteDto(cliente, ahora)`: lista blanca de cinco campos
    - _Requirements: 1.2, 1.3, 1.4_

  - [x] 3.3 Crear `src/utils/errorRepositorio.js`
    - Clase `ErrorRepositorio(status, code, message)` con `toRespuesta()` → `{ error: { code, message } }`
    - Constructores de ayuda: `identificacionInvalida()` (400), `clienteNoEncontrado()` (404, sin la identificación)
    - `clasificarErrorBaseDatos(error)`: 503 `REPOSITORIO_NO_DISPONIBLE` para los códigos de red, SQLSTATE de clase `08`, `57P01`-`57P03`, `53300`, `57014` y los mensajes de timeout de `node-pg`; 500 `ERROR_INTERNO` para el resto; siempre con textos fijos
    - _Requirements: 1.5, 2.1, 2.3, 4.1, 4.2, 4.3, 4.4_

  - [x]* 3.4 Escribir prueba basada en propiedades para la forma del `HistorialCliente`
    - `// Feature: repositorio-interno, Property 1: HistorialCliente tiene exactamente cinco campos con los tipos del contrato`
    - Filas con `ingresos_declarados` numérico, como cadena numérica o `null`, y columnas extra arbitrarias
    - Usar `{ numRuns: 100 }`
    - **Property 1: `HistorialCliente` tiene exactamente cinco campos con los tipos del contrato**
    - **Validates: Requirements 1.2, 1.3**

  - [x]* 3.5 Escribir prueba basada en propiedades para `antiguedadMeses`
    - `// Feature: repositorio-interno, Property 2: antiguedadMeses cuenta meses completos, nunca es negativa y no decrece con el tiempo`
    - Usar `{ numRuns: 100 }`
    - **Property 2: `antiguedadMeses` cuenta meses completos, nunca es negativa y no decrece con el tiempo**
    - **Validates: Requirements 1.4**

  - [x]* 3.6 Escribir pruebas unitarias por ejemplo de `mesesCompletosEntre`
    - Mismo día del mes, día anterior, fin de mes, fecha futura → 0, entrada `Date` vs cadena
    - _Requirements: 1.4_

  - [x]* 3.7 Escribir prueba basada en propiedades para la clasificación de errores
    - `// Feature: repositorio-interno, Property 7: Todo fallo de la base se traduce a un error estructurado y sin filtraciones`
    - Generar errores con códigos de red, SQLSTATE arbitrarios y mensajes con una marca; verificar la forma exacta, el `code`, el status y que la marca no aparezca en la respuesta
    - Usar `{ numRuns: 100 }`
    - **Property 7: Todo fallo de la base se traduce a un error estructurado y sin filtraciones**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

- [x] 4. Checkpoint — Módulos puros
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Infraestructura de datos
  - [x] 5.1 Actualizar `src/db/connection.js`
    - `crearPool(config)` con `max`, `connectionTimeoutMillis`, `statement_timeout` y `query_timeout` de `repoConfig`
    - Parser de `DATE` (OID 1082) que devuelve el texto `YYYY-MM-DD`
    - `pool.on("error")` con log; exportar `pool` y `verificarConexion(pool)` (`SELECT 1`)
    - _Requirements: 1.1, 4.1, 4.2, 4.6_

  - [x] 5.2 Crear `src/db/schema.js`
    - DDL idempotente de `clientes_historial` con PK y los `CHECK` del diseño
    - _Requirements: 1.6, 3.5_

  - [x] 5.3 Crear `src/db/seedData.js` y reescribir `src/db/seed.js`
    - `REGISTROS_SEMILLA` (1710000001, 1720000002, 1740000004, 1750000005) sin datos personales e `IDENTIFICACIONES_SIN_HISTORIAL = ["1730000003"]`
    - `sembrar(pool)`: transacción con esquema, upsert `ON CONFLICT (identificacion) DO UPDATE` y `DELETE` de las identificaciones sin historial; `ROLLBACK` si hay error
    - Modo script (`npm run seed`): siembra con el pool real y cierra el pool
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.8_

  - [x] 5.4 Crear el patrón Repository en `src/repositories/`
    - `historialRepository.interface.js`: `@typedef` del puerto + `asegurarHistorialRepository(impl)` (verificación en runtime)
    - `postgresHistorialRepository.js`: `crearPostgresHistorialRepository({ pool })` → `buscarPorIdentificacion(id)` con consulta parametrizada por PK; `filaAClienteHistorial` (NUMERIC → number); `null` si no hay fila; errores propagados
    - _Requirements: 1.1, 1.6, 2.1_

  - [x]* 5.5 Escribir prueba basada en propiedades para la idempotencia de la siembra
    - `// Feature: repositorio-interno, Property 6: La siembra es idempotente y garantiza la ausencia del cliente nuevo`
    - Sobre `pg-mem`: estado previo arbitrario (incluido `1730000003` y valores alterados), ejecutar `sembrar` n ∈ [1,5] veces y comparar con los datos semilla
    - Usar `{ numRuns: 25 }` (cada iteración recrea la base)
    - **Property 6: La siembra es idempotente y garantiza la ausencia del cliente nuevo**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

  - [x]* 5.6 Escribir pruebas de ejemplo de cobertura de los datos semilla
    - Tras `sembrar`: `1710000001` con mora, `1720000002` con buen historial, `1730000003` ausente, y `1740000004` y `1750000005` con la forma esperada
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x]* 5.7 Escribir pruebas de la interfaz `HistorialRepository`
    - La implementación PostgreSQL la cumple; `asegurarHistorialRepository` rechaza `null`, `{}` y métodos que no son funciones; `crearApp` falla al arrancar con un repositorio incompleto
    - _Requirements: 1.1_

- [x] 6. Capa HTTP y arranque
  - [x] 6.1 Crear `src/controllers/historialController.js`, `src/routes/historialRoutes.js`, `src/middlewares/manejadorErrores.js` y `src/app.js`
    - `crearHistorialController({ historialRepository, ahora })`: repositorio (vía interfaz) → DTO → 200 / 404
    - `crearHistorialRoutes(controller)`: `validarIdentificacion` → `obtenerHistorial`
    - `crearApp({ historialRepository, verificarConexion, ahora })`: verifica la interfaz, `/health` (siempre 200, `database: "UP" | "DOWN"`), rutas y `manejadorErrores`
    - Eliminar el uso de `CLIENTES_SEED` y la exposición de `err.message`
    - _Requirements: 1.1, 1.5, 2.1, 2.2, 2.3, 2.4, 4.3, 4.4, 4.6_

  - [x] 6.2 Actualizar `src/index.js`
    - Raíz de composición: crear `crearPostgresHistorialRepository({ pool })`, inyectarlo en `crearApp` y exportar `app`
    - `iniciar({ sembrar, escuchar, esperar, salir })` con dependencias inyectables: siembra con reintentos si `seedAlIniciar`, luego `listen`; `salir(1)` si se agotan los intentos
    - _Requirements: 3.6, 3.7_

  - [x]* 6.3 Escribir prueba basada en propiedades para la ida y vuelta por la base
    - `// Feature: repositorio-interno, Property 3: Ida y vuelta por la base de datos`
    - Supertest sobre `crearApp` con repositorio real sobre `pg-mem` y reloj fijo
    - Usar `{ numRuns: 100 }`
    - **Property 3: Ida y vuelta por la base de datos**
    - **Validates: Requirements 1.1, 1.6**

  - [x]* 6.4 Escribir prueba basada en propiedades para identificaciones sin historial
    - `// Feature: repositorio-interno, Property 4: Una identificación sin historial responde 404, nunca 200`
    - Usar `{ numRuns: 100 }`
    - **Property 4: Una identificación sin historial responde 404, nunca 200**
    - **Validates: Requirements 2.1, 2.2, 2.3**

  - [x]* 6.5 Escribir prueba basada en propiedades para identificaciones inválidas
    - `// Feature: repositorio-interno, Property 5: Una identificación con formato inválido responde 400 sin consultar la base`
    - Doble del repositorio que cuenta invocaciones (cero esperadas)
    - Usar `{ numRuns: 100 }`
    - **Property 5: Una identificación con formato inválido responde 400 sin consultar la base**
    - **Validates: Requirements 1.5**

  - [x]* 6.6 Escribir pruebas de integración de `/health`, errores y arranque
    - `/health` con base `UP` y `DOWN`; repositorio que lanza un error de conexión → 503 sin filtraciones; error genérico → 500
    - `iniciar`: reintenta hasta tener éxito; agota los intentos → `salir(1)`; `seedAlIniciar=false` → no siembra
    - _Requirements: 3.6, 3.7, 4.1, 4.3, 4.4, 4.6_

- [x] 7. Checkpoint — Servicio completo
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Orquestación con Docker Compose
  - [x] 8.1 Actualizar `docker-compose.yml`
    - `healthcheck` en `postgres` con `pg_isready -U resuelve_user -d resuelve_db`
    - `repositorio-interno`: `depends_on: postgres: condition: service_healthy` y `SEED_AL_INICIAR: "true"`
    - _Requirements: 3.6, 3.7_

- [x] 9. Checkpoint final — Ensure all tests pass
  - Ejecutar `jest` una sola vez (sin watch) y confirmar que pasan todas las pruebas
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Las tareas marcadas con `*` son opcionales (pruebas) y pueden omitirse para un MVP más rápido. Se recomiendan porque el repositorio está en el camino crítico de cada evaluación.
- Cada tarea referencia los criterios de aceptación específicos que satisface.
- Las propiedades que tocan SQL se prueban con `pg-mem`; la verificación contra PostgreSQL real queda en el test E2E con Docker Compose (`tests/integration/`).
- Contract-first (steering `tech.md`): la tarea 1 actualiza `spec6` antes de tocar el código; ese contrato es la entrada de cualquier feature que consuma el repositorio. Según `structure.md`, el servicio lo referencia por ruta relativa y no guarda una copia del YAML en su carpeta. El adaptador actual del core ya es compatible: solo depende de 200/404 y de los campos de `HistorialCliente`.
- Efecto visible en el core: al llegar `ingresosDeclarados` real, `1720000002` pasa de `REVISION_MANUAL` (ingreso ausente) a `APROBADO` sin buró para montos dentro del tope, y `1730000003` pasa a evaluarse como cliente nuevo.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "2.2", "3.1", "3.2", "3.3"] },
    { "id": 2, "tasks": ["2.3", "3.4", "3.5", "3.6", "3.7", "5.1", "5.2"] },
    { "id": 3, "tasks": ["5.3", "5.4"] },
    { "id": 4, "tasks": ["5.5", "5.6", "5.7", "6.1"] },
    { "id": 5, "tasks": ["6.2", "6.3", "6.4", "6.5"] },
    { "id": 6, "tasks": ["6.6", "8.1"] }
  ]
}
```
