# Implementation Plan

## Overview

Este plan mejora el servicio `buro-simulado` (Node.js 20 LTS + Express) **ya existente y en funcionamiento**, sin reconstruirlo desde cero. El orden mantiene el servicio operativo en cada paso: primero se extrae el estado de escenario a un módulo dedicado (refactor de bajo riesgo que elimina el acoplamiento `score.js → admin.js`), luego se aplican las correcciones de comportamiento (rango del score, validación de `identificacion` vacía, latencia configurable), después se crea el contrato OpenAPI 3.0 como fuente de verdad, y finalmente se añaden las pruebas basadas en propiedades (fast-check) y de ejemplo/integración (Jest + Supertest), cerrando con la ejecución de toda la suite.

Lenguaje de implementación: **JavaScript (Node.js 20 LTS)**, según el diseño y el código existente.

## Tasks

- [x] 1. Extraer el estado de escenario a un módulo dedicado (`src/scenarioState.js`)
  - [x] 1.1 Crear `src/scenarioState.js` con el estado en memoria y su API
    - Definir `ESCENARIOS_VALIDOS = ["NORMAL", "LATENCIA_ALTA", "CAIDO"]`
    - Implementar `esEscenarioValido(valor)` (normaliza a mayúsculas y verifica pertenencia al conjunto)
    - Implementar `inicializarEscenario()`: lee `process.env.ESCENARIO_INICIAL`, lo normaliza a mayúsculas; si pertenece al conjunto válido lo usa, de lo contrario (ausente o inválido) usa `NORMAL`; establece el estado interno y lo retorna
    - Implementar `getEscenario()`: retorna el escenario activo actual
    - Implementar `setEscenario(valor)`: normaliza a mayúsculas; si es válido actualiza el estado y retorna `{ ok: true, escenario }`; si es ausente/inválido retorna `{ ok: false }` sin modificar el estado
    - Invocar `inicializarEscenario()` al cargar el módulo para dejar el estado inicial listo
    - Exportar `inicializarEscenario`, `getEscenario`, `setEscenario`, `esEscenarioValido`
    - _Requisitos: 5.5, 5.6, 5.1, 5.2, 5.3, 5.4_

  - [x]* 1.2 Escribir prueba basada en propiedades para la inicialización del escenario
    - `// Feature: buro-simulado, Property 9: Inicialización total del escenario`
    - Generar valores válidos (en distintas capitalizaciones), inválidos y ausentes para `ESCENARIO_INICIAL`; reiniciar el módulo (`jest.resetModules()`) y verificar que el estado inicial es el valor normalizado cuando es válido y `NORMAL` en cualquier otro caso
    - Usar `{ numRuns: 100 }`
    - **Property 9: Inicialización total del escenario**
    - **Validates: Requisitos 5.5, 5.6**

- [x] 2. Refactorizar `admin.js` y `score.js` para consumir `scenarioState`
  - [x] 2.1 Actualizar `src/routes/admin.js` para usar `scenarioState`
    - Eliminar la variable local `escenarioActual` y la función/export `getEscenario` propios del router
    - `GET /admin/escenario` → responder `200 { escenario }` usando `getEscenario()`
    - `POST /admin/escenario` → delegar en `setEscenario(req.body.escenario)`; si `ok` responder `200 { mensaje, escenario }`; si `!ok` responder `400 { error: { message, code: "INVALID_SCENARIO" } }` sin alterar el estado previo
    - _Requisitos: 5.1, 5.2, 5.3, 5.4_

  - [x] 2.2 Actualizar `src/routes/score.js` para usar `scenarioState`
    - Reemplazar `const { getEscenario } = require("./admin")` por el `require` de `../scenarioState` (elimina el acoplamiento router→router)
    - Verificar que el handler sigue leyendo el escenario con `getEscenario()` y que el comportamiento observable no cambia en este paso
    - _Requisitos: 5.2_

  - [x]* 2.3 Escribir prueba basada en propiedades para la conmutación válida de escenario
    - `// Feature: buro-simulado, Property 7: Conmutación válida gobierna estado y comportamiento`
    - Generar un valor del conjunto {NORMAL, LATENCIA_ALTA, CAIDO} en capitalización aleatoria; `POST /admin/escenario` responde 200 con el escenario normalizado, `GET /admin/escenario` refleja ese valor, y una consulta posterior a `GET /score/:identificacion` se comporta según el escenario recién establecido
    - Usar `{ numRuns: 100 }` y `LATENCIA_MS` reducido para el caso LATENCIA_ALTA
    - **Property 7: Conmutación válida gobierna el estado y el comportamiento**
    - **Validates: Requisitos 3.1, 4.3, 5.1, 5.2, 5.4**

  - [x]* 2.4 Escribir prueba basada en propiedades para la conmutación inválida de escenario
    - `// Feature: buro-simulado, Property 8: Conmutación inválida rechaza y preserva estado`
    - Generar cadenas fuera del conjunto válido y el caso de campo `escenario` ausente; `POST /admin/escenario` responde 400 con `error.code === "INVALID_SCENARIO"` y el escenario activo permanece igual al previo
    - Usar `{ numRuns: 100 }`
    - **Property 8: Conmutación inválida rechaza y preserva el estado**
    - **Validates: Requisitos 5.3**

- [x] 3. Checkpoint — Verificar refactor sin regresiones
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Corregir el rango del score en `calcularScoreDeterministico`
  - [x] 4.1 Cambiar el módulo del cálculo del score de `651` a `551`
    - En `src/routes/score.js`, reemplazar `300 + (absHash % 651)` por `300 + (absHash % 551)` para producir un entero en `[300, 850]` inclusive
    - Actualizar el comentario del rango a `[300, 850]`
    - _Requisitos: 1.2_

  - [x]* 4.2 Escribir prueba basada en propiedades para el invariante de rango del score
    - `// Feature: buro-simulado, Property 2: Invariante de rango del score [300,850]`
    - Generar `identificacion` con `fc.string({ minLength: 1 })` y verificar que `score` es entero y `300 <= score <= 850`
    - Usar `{ numRuns: 100 }`
    - **Property 2: Invariante de rango del score**
    - **Validates: Requisitos 1.2**

  - [x]* 4.3 Escribir prueba basada en propiedades para el determinismo por identificación
    - `// Feature: buro-simulado, Property 1: Determinismo por identificación (score/mora/deuda estables)`
    - Generar `identificacion` no vacía; invocar el cálculo múltiples veces y verificar que `score`, `moraExterna` y `deudaExternaTotal` son idénticos en todas las invocaciones
    - Usar `{ numRuns: 100 }`
    - **Property 1: Determinismo por identificación**
    - **Validates: Requisitos 1.3, 2.1, 2.2, 2.3**

  - [x]* 4.4 Escribir prueba basada en propiedades para el bicondicional deuda/mora
    - `// Feature: buro-simulado, Property 3: Bicondicional deuda/mora`
    - Generar `identificacion` y verificar que `deudaExternaTotal > 0` si y solo si `moraExterna === true`, y que `deudaExternaTotal === 0` cuando `moraExterna === false`
    - Usar `{ numRuns: 100 }`
    - **Property 3: Bicondicional deuda/mora**
    - **Validates: Requisitos 1.4, 1.5**

- [x] 5. Añadir validación de `identificacion` vacía
  - [x] 5.1 Validar `identificacion` no vacía en `GET /score/:identificacion`
    - En `src/routes/score.js`, antes de leer el escenario, aplicar `trim()` a `identificacion`; si queda vacía responder `400 { error: { message, code: "INVALID_IDENTIFICACION" } }`
    - _Requisitos: 2.5_

  - [x]* 5.2 Escribir prueba de ejemplo (Supertest) para `identificacion` vacía
    - Enviar una `identificacion` en blanco (p. ej. `%20` codificado) y verificar respuesta 400 con objeto `error` que incluye `message` y `code === "INVALID_IDENTIFICACION"`
    - _Requisitos: 2.5_

- [x] 6. Introducir latencia configurable (`LATENCIA_MS`)
  - [x] 6.1 Usar `LATENCIA_MS` en la rama LATENCIA_ALTA
    - En `src/routes/score.js`, leer `LATENCIA_MS` desde el entorno con valor por defecto `5000` (parsear a entero; usar `5000` si es inválido)
    - Reemplazar el `setTimeout(resolve, 5000)` fijo por el valor `LATENCIA_MS`
    - Mantener el escenario CAIDO respondiendo sin aplicar retraso (respuesta en < 1 s)
    - _Requisitos: 3.2, 3.4, 1.6, 4.1_

  - [x] 6.2 Documentar `LATENCIA_MS` en `.env.example`
    - Añadir la variable `LATENCIA_MS=5000` con un comentario indicando que controla el retraso del escenario LATENCIA_ALTA (reducible en pruebas)
    - _Requisitos: 3.2_

  - [x]* 6.3 Escribir prueba basada en propiedades para la igualdad de valores NORMAL vs LATENCIA_ALTA
    - `// Feature: buro-simulado, Property 5: Igualdad de valores NORMAL vs LATENCIA_ALTA`
    - Con `LATENCIA_MS` reducido, generar `identificacion` y verificar que `score`, `moraExterna` y `deudaExternaTotal` bajo LATENCIA_ALTA son idénticos a los obtenidos bajo NORMAL
    - Usar `{ numRuns: 100 }`
    - **Property 5: Igualdad de valores entre NORMAL y LATENCIA_ALTA**
    - **Validates: Requisitos 1.6, 2.4, 3.3**

  - [x]* 6.4 Escribir prueba de ejemplo (Supertest) para el umbral de latencia
    - Con `LATENCIA_MS` reducido (o fake timers de Jest), verificar que la respuesta bajo LATENCIA_ALTA no se emite antes del umbral configurado y que finalmente responde 200
    - _Requisitos: 3.2, 3.3_

  - [x]* 6.5 Escribir prueba de ejemplo (Supertest) para concurrencia bajo LATENCIA_ALTA
    - Con `LATENCIA_MS` reducido, lanzar N peticiones concurrentes a `GET /score/:identificacion` y verificar que todas resuelven 200 sin rechazos ni descartes
    - _Requisitos: 3.4_

- [x] 7. Checkpoint — Verificar correcciones de comportamiento
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Completar cobertura de propiedades y pruebas de respuesta
  - [x]* 8.1 Escribir prueba basada en propiedades para la completitud y tipos de la respuesta NORMAL
    - `// Feature: buro-simulado, Property 4: Completitud y tipos de la respuesta NORMAL`
    - Generar `identificacion` no vacía bajo escenario NORMAL y verificar 200 con `identificacion` (igual al recibido), `score` (entero), `moraExterna` (booleano), `deudaExternaTotal` (número), `fechaConsulta` (cadena ISO 8601) y `escenarioSimulado` (cadena)
    - Usar `{ numRuns: 100 }`
    - **Property 4: Completitud y tipos de la respuesta NORMAL**
    - **Validates: Requisitos 1.1**

  - [x]* 8.2 Escribir prueba basada en propiedades para la respuesta bajo CAIDO
    - `// Feature: buro-simulado, Property 6: Respuesta bajo CAIDO (503 + error, sin campos de score)`
    - Con el escenario activo CAIDO, generar `identificacion` y verificar 503 con `error.message` y `error.code` como cadenas no vacías, y ausencia de `score`, `moraExterna` y `deudaExternaTotal`
    - Usar `{ numRuns: 100 }`
    - **Property 6: Respuesta bajo escenario CAIDO**
    - **Validates: Requisitos 1.7, 4.2**

  - [x]* 8.3 Escribir prueba de ejemplo (Supertest) para CAIDO rápido sin retraso
    - Con escenario CAIDO, verificar que la respuesta 503 se emite sin aplicar el retraso de latencia (respuesta en < 1 s)
    - _Requisitos: 4.1_

  - [x]* 8.4 Escribir prueba de ejemplo (Supertest) para `GET /health`
    - Smoke test que verifica 200 y presencia de `status`, `service` y `timestamp`
    - _Requisitos: 6.1_

  - [x]* 8.5 Escribir prueba de ejemplo (Supertest) para error no controlado
    - Forzar un error no controlado y verificar la respuesta estructurada con objeto `error` que contiene `message` y `code`
    - _Requisitos: 7.1_

- [x] 9. Crear el contrato OpenAPI 3.0 (`contracts/buro-simulado.yaml`)
  - [x] 9.1 Escribir `contracts/buro-simulado.yaml` como fuente de verdad
    - OpenAPI 3.0 con los paths `GET /health`, `GET /score/{identificacion}`, `GET /admin/escenario`, `POST /admin/escenario`
    - Definir los schemas `ScoreResponse`, `AdminEscenarioRequest`, `AdminEscenarioResponse`, `Error` y `Health`
    - Documentar los códigos de estado `200`, `400`, `503` y `500` para las operaciones correspondientes
    - Reflejar el rango `[300, 850]` de `score` y el objeto `error { message, code }`
    - _Requisitos: 1.1, 1.7, 2.5, 4.2, 5.1, 5.3, 5.4, 6.1, 7.1_

- [x] 10. Configurar dependencias y ejecutar la suite completa
  - [x] 10.1 Añadir `fast-check` como dependencia de desarrollo
    - Agregar `fast-check` a `devDependencies` en `package.json` (versión fijada) e instalarlo
    - Confirmar que `app.listen` sigue protegido por `NODE_ENV !== "test"` y que `app` se exporta para Supertest
    - _Requisitos: 1.1, 3.2, 5.1_

  - [x] 10.2 Ejecutar toda la suite de Jest y verificar que todas las pruebas pasan
    - Correr `jest` en modo de una sola ejecución (sin watch) y confirmar que todas las pruebas de propiedades y de ejemplo/integración pasan
    - _Requisitos: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 6.1, 7.1_

- [x] 11. Checkpoint final — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Reestructurar por capas con patrón Repository (steering `structure.md`)
  - [x] 12.1 Extraer el estado de escenario a un repositorio con interfaz
    - `src/models/escenario.js`: `ESCENARIOS_VALIDOS`, `esEscenarioValido`, `normalizarEscenario`
    - `src/repositories/escenarioRepository.interface.js` (`obtener` / `guardar` + `asegurarEscenarioRepository`) y `memoriaEscenarioRepository.js` (reemplaza `src/scenarioState.js`; inicialización total con `escenarioInicial`)
    - _Requisitos: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x] 12.2 Separar capas HTTP y de aplicación sin cambiar el comportamiento observable
    - `config/buroConfig.js` (`LATENCIA_MS`, `ESCENARIO_INICIAL`, `CONTRATO_OPENAPI_PATH`); `utils/scoringDeterministico.js`, `utils/errorBuro.js`, `utils/contratoOpenApi.js`
    - `services/scoreService.js` y `services/escenarioService.js`; `controllers/scoreController.js` y `adminController.js`; `dtos/scoreResponseDto.js`
    - `middlewares/validarIdentificacion.js` y `manejadorErrores.js`; `routes/scoreRoutes.js`, `adminRoutes.js` y `docsRoutes.js`
    - `app.js` (`crearApp(deps)`) e `index.js` como raíz de composición
    - _Requisitos: 1.1, 1.7, 2.5, 3.2, 4.1, 5.4, 6.1, 7.1_

  - [x]* 12.3 Migrar las pruebas a la nueva estructura
    - Las suites de rutas fijan el escenario vía `escenarioRepository` exportado por `index.js`
    - Property 9 se prueba directamente sobre `crearMemoriaEscenarioRepository`; se añaden pruebas de la interfaz
    - `manejadorErrores.test.js` usa el middleware real en lugar de una réplica
    - _Requisitos: 5.5, 5.6, 7.1_

- [x] 13. Checkpoint — Reestructuración
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Las tareas marcadas con `*` son opcionales (pruebas) y pueden omitirse para un MVP más rápido, aunque se recomienda ejecutarlas por la naturaleza determinística y de resiliencia del servicio.
- Cada tarea referencia requisitos específicos para trazabilidad.
- Los checkpoints garantizan validación incremental manteniendo el servicio operativo en cada etapa.
- Las pruebas basadas en propiedades (fast-check, `{ numRuns: 100 }`) validan las 9 propiedades universales del diseño; cada una lleva el comentario `// Feature: buro-simulado, Property {n}: {texto}`.
- Las pruebas de ejemplo/integración (Jest + Supertest) cubren temporización, concurrencia, salud y errores.
- Para las propiedades y casos que involucran LATENCIA_ALTA se usa un `LATENCIA_MS` reducido para evitar suites lentas.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1", "2.2"] },
    { "id": 2, "tasks": ["2.3", "2.4", "4.1", "5.1", "6.1"] },
    { "id": 3, "tasks": ["4.2", "4.3", "4.4", "5.2", "6.2", "6.3", "6.4", "6.5", "8.1", "8.2", "8.3", "8.4", "8.5", "9.1"] },
    { "id": 4, "tasks": ["10.1"] },
    { "id": 5, "tasks": ["10.2"] },
    { "id": 6, "tasks": ["12.1"] },
    { "id": 7, "tasks": ["12.2"] },
    { "id": 8, "tasks": ["12.3"] }
  ]
}
```
