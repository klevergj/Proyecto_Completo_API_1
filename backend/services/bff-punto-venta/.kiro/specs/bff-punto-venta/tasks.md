# Implementation Plan

## Overview

Plan de implementación incremental y guiado por pruebas para el BFF Punto de Venta en `services/bff-punto-venta`. El servicio **ya existe y arranca**, así que se mejora sin reconstruirlo. El orden respeta el steering y las dependencias del diseño: primero el contrato en `contracts/` (fuente de verdad), luego la configuración y los módulos puros (errores, validación, mappers), luego la caché, después el caso de uso que los orquesta y al final la capa HTTP (rutas y manejador central). El servicio sigue operativo al terminar cada ola.

Lenguaje de implementación: **JavaScript (Node.js 20 LTS)**, según el diseño y el código existente. `fast-check` se añade como devDependency (Jest y Supertest ya existen). Los contratos de `contracts/` son la fuente de verdad: este plan actualiza `spec2-bff-pos.yaml` en la tarea 1 y el código se ajusta a él.

## Tasks

- [x] 1. Actualizar primero el contrato OpenAPI 3.0 (`contracts/spec2-bff-pos.yaml`)
  - [x] 1.1 Actualizar `contracts/spec2-bff-pos.yaml` como fuente de verdad (versión `1.1.0`)
    - `servers`: red interna Docker (`http://bff-punto-venta:8081`) y local (`http://localhost:8081`)
    - Paths `GET /health`, `POST /evaluaciones-credito` y `GET /evaluaciones-credito/{id}`
    - `SolicitudEvaluacionPos` con restricciones (`identificacion` y `tiendaId` `minLength: 1`, `montoSolicitado` > 0, `plazoMeses` entero > 0)
    - `ResultadoPos` con `required: [idEvaluacion, aprobado, mensajeParaCliente]` y los tres textos posibles documentados
    - Esquema `ErrorRespuestaPos` (`error { code, message, reintentable }`) con el enum de `code`
    - Respuestas `200`, `400`, `404` (solo GET), `500`, `502`, `503` y `504`, con ejemplos, siguiendo el estilo de `spec4-evaluacion-core.yaml`
    - Documentar la caché (reconsulta sin llamar al core dentro del TTL) en la descripción de `GET /evaluaciones-credito/{id}`
    - _Requirements: 1.3, 2.1, 3.1, 3.2, 3.3, 4.2, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 2. Configuración y dependencias
  - [x] 2.1 Crear `src/config/bffConfig.js` y actualizar `.env.example`
    - Leer `process.env` una sola vez al cargar el módulo
    - `coreUrl` desde `EVALUACION_CORE_URL` (default `http://evaluacion-core:8090`)
    - `coreTimeoutMs` desde `CORE_TIMEOUT_MS` (default 5000, número > 0)
    - `cacheTtlMs` desde `CACHE_TTL_MS` (default 900000, número > 0)
    - `cacheMaxEntradas` desde `CACHE_MAX_ENTRADAS` (default 1000, entero > 0)
    - Ante un valor inválido: usar el default y registrar una advertencia
    - Añadir `CORE_TIMEOUT_MS`, `CACHE_TTL_MS` y `CACHE_MAX_ENTRADAS` a `.env.example` con comentarios
    - _Requirements: 4.6, 4.7, 5.1_

  - [x] 2.2 Añadir `fast-check` como devDependency
    - Fijar la versión `4.10.2` en `package.json` e instalarla
    - Confirmar que `app.listen` sigue protegido por `NODE_ENV !== "test"` y que `app` se exporta
    - _Requirements: 2.1_

  - [x]* 2.3 Escribir pruebas unitarias de `bffConfig`
    - Verificar defaults, parsing de env vars y reemplazo por default ante valores inválidos (usar `jest.resetModules()`)
    - _Requirements: 4.6, 4.7, 5.1_

- [x] 3. Modelo de errores y traducción centralizada
  - [x] 3.1 Crear `src/utils/errorBff.js` y `src/middlewares/manejadorErrores.js`
    - Clase `ErrorBff(status, code, message, reintentable)` con `toRespuesta()` → `{ error: { code, message, reintentable } }`
    - Constructores de ayuda para `SOLICITUD_INVALIDA`, `ID_EVALUACION_INVALIDO` y `ERROR_INTERNO`
    - `traducirErrorCore(error, { operacion })` siguiendo la tabla del diseño: timeout → 504, red → 503, core 400 (mensaje específico para `INVALID_IDENTIFICACION`) → 400, core 404 en consulta → 404, 5xx/otros → 502; si ya es `ErrorBff`, devolverlo tal cual
    - Los `message` son textos fijos en lenguaje humano; nunca se copian `error.message` ni `response.data`
    - `manejadorErrores`: `ErrorBff` → su estado y cuerpo; `entity.parse.failed` → 400 `SOLICITUD_INVALIDA`; cualquier otro → log + 500 `ERROR_INTERNO`
    - _Requirements: 1.7, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 4.5_

  - [x]* 3.2 Escribir prueba basada en propiedades para la traducción de errores
    - `// Feature: bff-punto-venta, Property 8: Todo fallo del core se traduce a un error estructurado y sin filtraciones`
    - Generar errores de axios sintéticos (códigos de red, timeouts, `response.status` 400-599, `response.data` y `message` arbitrarios) y verificar la forma exacta, el `code` en el conjunto, un `message` no vacío que no contiene el texto de origen y un `status` coherente
    - Usar `{ numRuns: 100 }`
    - **Property 8: Todo fallo del core se traduce a un error estructurado y sin filtraciones**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

  - [x]* 3.3 Escribir pruebas unitarias por ejemplo de `traducirErrorCore`
    - Un caso por fila de la tabla del diseño, incluido `INVALID_IDENTIFICACION` y 404 solo en `operacion: "consultar"`
    - _Requirements: 4.5, 5.1, 5.2, 5.3, 5.4_

- [x] 4. DTO de entrada y middlewares de validación
  - [x] 4.1 Crear `src/dtos/solicitudEvaluacionPosDto.js`
    - `toSolicitudCore(solicitudPos)` por lista blanca: `{ identificacion, montoSolicitado, plazoMeses, tiendaId }` con `trim()` en `identificacion` y `tiendaId`
    - _Requirements: 1.2_

  - [x] 4.2 Validación de forma en `solicitudEvaluacionPosDto.js` y middlewares `validarSolicitudEvaluacion.js` / `validarIdEvaluacion.js`
    - `validarSolicitudEvaluacionPos(body)` → `{ ok: true, valor: SolicitudCore }` | `{ ok: false, errores: string[] }`
    - Reglas: cuerpo objeto no nulo ni array; `identificacion` y `tiendaId` string no vacíos tras `trim()`; `montoSolicitado` number finito > 0; `plazoMeses` entero > 0; sin coerción de strings numéricos
    - Acumular todos los errores con mensajes que nombren el campo en lenguaje humano
    - Producir `valor` con `toSolicitudCore`
    - Middleware `validarSolicitudEvaluacion`: 400 `SOLICITUD_INVALIDA` o deja `req.solicitudCore`; `validarIdEvaluacion`: 400 `ID_EVALUACION_INVALIDO` si `:id` no es UUID
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 4.4_

  - [x]* 4.3 Escribir pruebas unitarias por ejemplo del validador
    - Un caso por regla, acumulación de varios errores, rechazo de `"450"` como monto y de `12.5` como plazo
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 1.8_

- [x] 5. Modelo de dominio y DTO de salida `ResultadoPos`
  - [x] 5.1 Crear `src/models/resultadoEvaluacion.js` y `src/dtos/resultadoPosDto.js` (reemplazan `mappers/decisionToResultadoPos.js`)
    - Modelo inmutable `ResultadoEvaluacion { idEvaluacion, decision }` con `esDecisionCoreValida(d)` y `desdeDecisionCore(d)`: si es inválida, lanzar `ErrorBff(502, "ERROR_EVALUACION", ..., true)`
    - `resultadoPosDto`: exportar `MENSAJES_POR_DECISION` congelado (`APROBADO` → "Crédito aprobado", `REVISION_MANUAL` → "En revisión, te contactaremos", `RECHAZADO` → "Crédito no aprobado en esta ocasión") y `toResultadoPosDto(resultado)` → exactamente `{ idEvaluacion, aprobado: decision === "APROBADO", mensajeParaCliente }`
    - Eliminar los valores por defecto (`PENDIENTE`, UUID de ceros); el modelo no guarda el `motivo`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4_

  - [x]* 5.2 Escribir prueba basada en propiedades para el bicondicional `aprobado`
    - `// Feature: bff-punto-venta, Property 1: aprobado es verdadero si y solo si la decisión es APROBADO`
    - Usar `{ numRuns: 100 }`
    - **Property 1: `aprobado` es verdadero si y solo si la decisión es `APROBADO`**
    - **Validates: Requirements 2.3, 3.1**

  - [x]* 5.3 Escribir prueba basada en propiedades para el mensaje sin motivo
    - `// Feature: bff-punto-venta, Property 2: El mensaje depende solo de la decisión y nunca expone el motivo`
    - Generar pares de `DecisionCore` con igual `decision` y `motivo` distinto; verificar un mensaje idéntico e igual a la tabla
    - Usar `{ numRuns: 100 }`
    - **Property 2: El mensaje depende solo de la decisión y nunca expone el motivo**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**

  - [x]* 5.4 Escribir prueba basada en propiedades para la forma del `ResultadoPos`
    - `// Feature: bff-punto-venta, Property 3: ResultadoPos tiene exactamente tres campos y preserva el idEvaluacion`
    - Incluir campos extra arbitrarios en la `DecisionCore` generada
    - Usar `{ numRuns: 100 }`
    - **Property 3: `ResultadoPos` tiene exactamente tres campos y preserva el `idEvaluacion`**
    - **Validates: Requirements 2.1, 2.2, 2.4**

  - [x]* 5.5 Escribir prueba basada en propiedades para `DecisionCore` inválida
    - `// Feature: bff-punto-venta, Property 4: Una DecisionCore inválida nunca produce un resultado`
    - Generar `decision` fuera del enum (strings, `null`, números, ausente) e `idEvaluacion` vacío o no string; verificar que lanza `ErrorBff` 502 `ERROR_EVALUACION`
    - Usar `{ numRuns: 100 }`
    - **Property 4: Una `DecisionCore` inválida nunca produce un resultado**
    - **Validates: Requirements 2.5, 5.3**

- [x] 6. Checkpoint — Módulos puros
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Patrón Repository para los resultados (Cache-Aside)
  - [x] 7.1 Crear `src/repositories/resultadoEvaluacionRepository.interface.js` y `src/repositories/memoriaResultadoEvaluacionRepository.js`
    - Interfaz: `@typedef` con `guardar(resultado)` y `buscarPorId(id)` + `asegurarResultadoEvaluacionRepository(impl)` (verificación en runtime)
    - Implementación en memoria `crearMemoriaResultadoEvaluacionRepository({ ttlMs, maxEntradas, ahora = Date.now })`
    - `Map` con entradas `{ resultado, expiraEn }`; expiración perezosa en la lectura; reinsertar en un acierto (LRU); desalojar la primera clave al superar `maxEntradas`
    - Guarda modelos `ResultadoEvaluacion` inmutables
    - _Requirements: 4.1, 4.2, 4.6, 4.7, 4.8_

  - [x]* 7.2 Escribir pruebas unitarias del repositorio en memoria y de la interfaz
    - TTL con reloj inyectado (vigente justo antes de expirar y ausente después), desalojo LRU y renovación tras una lectura
    - La implementación cumple la interfaz; `asegurarResultadoEvaluacionRepository` rechaza implementaciones incompletas; el servicio falla al construirse con un repositorio inválido
    - _Requirements: 4.6, 4.7_

- [x] 8. Cliente del core y caso de uso
  - [x] 8.1 Actualizar `src/clients/evaluacionCoreClient.js`
    - Tomar `baseURL` y `timeout` de `bffConfig`
    - `encodeURIComponent(id)` en `obtenerEvaluacionPorId`
    - Sin reintentos ni lógica de negocio
    - _Requirements: 5.1, 5.7_

  - [x] 8.2 Crear `src/services/evaluacionPosService.js`
    - `crearEvaluacionPosService({ coreClient, resultadoRepository })` → `{ registrarEvaluacion(solicitudCore), consultarEstado(id) }`; verifica la interfaz del repositorio
    - `registrarEvaluacion`: `solicitarEvaluacion` (una sola vez) → `ResultadoEvaluacion.desdeDecisionCore` → `repositorio.guardar` → devolver el modelo; traducir los errores del cliente con `operacion: "crear"`
    - `consultarEstado`: `repositorio.buscarPorId` → si hay *miss*, `obtenerEvaluacionPorId` → modelo → `repositorio.guardar`; traducir los errores con `operacion: "consultar"`
    - No almacenar errores en el repositorio
    - _Requirements: 1.1, 1.3, 2.1, 4.1, 4.2, 4.3, 4.4, 4.5, 4.8, 5.7_

  - [x]* 8.3 Escribir prueba basada en propiedades para la traducción de la solicitud
    - `// Feature: bff-punto-venta, Property 5: La traducción de la solicitud preserva los valores y usa lista blanca`
    - Supertest sobre `crearApp` con doble del cliente del core (`jest.fn()`); verificar una sola invocación con exactamente cuatro claves y los valores con `trim`
    - Usar `{ numRuns: 100 }`
    - **Property 5: La traducción de la solicitud preserva los valores y usa lista blanca**
    - **Validates: Requirements 1.1, 1.2**

  - [x]* 8.4 Escribir prueba basada en propiedades para una solicitud inválida
    - `// Feature: bff-punto-venta, Property 6: Una solicitud inválida se rechaza con 400 sin tocar el core`
    - Supertest: partir de una solicitud válida y mutar al menos un campo a un valor inválido; verificar 400 `SOLICITUD_INVALIDA` y cero invocaciones
    - Usar `{ numRuns: 100 }`
    - **Property 6: Una solicitud inválida se rechaza con 400 sin tocar el core**
    - **Validates: Requirements 1.3, 1.4, 1.5, 1.6, 1.7**

  - [x]* 8.5 Escribir prueba basada en propiedades para la ida y vuelta por caché
    - `// Feature: bff-punto-venta, Property 7: Ida y vuelta por caché sin volver al core`
    - `registrarEvaluacion` seguido de `consultarEstado(idEvaluacion)`: resultado igual (profundo) y cero invocaciones a `obtenerEvaluacionPorId`
    - Usar `{ numRuns: 100 }`
    - **Property 7: Ida y vuelta por caché sin volver al core**
    - **Validates: Requirements 4.1, 4.2**

- [x] 9. Capa HTTP y composición
  - [x] 9.1 Crear `src/controllers/evaluacionesController.js` y `src/routes/evaluacionesRoutes.js` (reemplaza `routes/evaluaciones.js`)
    - Controlador: `crear` y `obtenerEstado` llaman al caso de uso y responden `toResultadoPosDto(resultado)`
    - Rutas finas: `POST /` → `validarSolicitudEvaluacion` → `crear`; `GET /:id` → `validarIdEvaluacion` → `obtenerEstado`
    - _Requirements: 1.1, 2.1, 4.2, 4.3_

  - [x] 9.2 Crear `src/app.js` y reescribir `src/index.js` como raíz de composición
    - `crearApp({ coreClient, resultadoRepository })`: servicio + controlador + `/health` + rutas + `manejadorErrores`
    - `index.js`: crea `crearMemoriaResultadoEvaluacionRepository` con `bffConfig`, lo inyecta junto con `evaluacionCoreClient` y hace `listen`
    - Eliminar la exposición de `err.response.data` y de `err.message`
    - _Requirements: 1.7, 5.5, 5.6_

  - [x]* 9.3 Escribir pruebas de integración con Supertest
    - `jest.mock` de `evaluacionCoreClient`
    - `POST` 200 con `ResultadoPos` de tres campos; JSON mal formado → 400 sin llamar al core; core en timeout / caído / 500 → 504 / 503 / 502 sin filtraciones
    - `GET` tras `POST` → hit sin llamar al core; `GET` con id no UUID → 400; *miss* con core 404 → 404
    - `GET /health` → 200
    - _Requirements: 1.1, 1.7, 2.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.5_

- [x] 10. Checkpoint final — Ensure all tests pass
  - Ejecutar `jest` una sola vez (sin watch) y confirmar que pasan todas las pruebas de propiedades, las de ejemplo y las de integración
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Las tareas marcadas con `*` son opcionales (pruebas) y pueden omitirse para un MVP más rápido. Se recomienda ejecutarlas porque el BFF es el punto de contacto con la caja: un mapeo erróneo muestra un resultado falso al cliente.
- Cada tarea referencia los criterios de aceptación específicos que satisface.
- Las pruebas basadas en propiedades (fast-check, `{ numRuns: 100 }`) validan las 8 propiedades del diseño; cada una lleva el comentario `// Feature: bff-punto-venta, Property {n}: {texto}`.
- Contract-first (steering `tech.md`: "todo cambio de contrato se hace primero en el YAML de `contracts/`"): la tarea 1 actualiza `spec2-bff-pos.yaml` antes de tocar el código. Ese contrato es la entrada de las features del Gateway y del Frontend.
- Steering `structure.md`: el servicio referencia el contrato por ruta relativa (`../../contracts/spec2-bff-pos.yaml`) y **no** guarda una copia del YAML en su carpeta. Ahí se realinearán `spec1-gateway.yaml` y `spec0-frontend.yaml`, que hoy esperan `DecisionFrontend`.
- Dependencia conocida: hasta que `evaluacion-core` implemente `GET /evaluaciones/{id}`, un *miss* de caché en la reconsulta responde 502 `ERROR_EVALUACION`.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "2.2", "3.1"] },
    { "id": 2, "tasks": ["2.3", "3.2", "3.3", "4.1", "5.1", "7.1"] },
    { "id": 3, "tasks": ["4.2", "5.2", "5.3", "5.4", "5.5", "7.2", "8.1"] },
    { "id": 4, "tasks": ["4.3", "8.2"] },
    { "id": 5, "tasks": ["8.3", "8.4", "8.5", "9.1", "9.2"] },
    { "id": 6, "tasks": ["9.3"] }
  ]
}
```
