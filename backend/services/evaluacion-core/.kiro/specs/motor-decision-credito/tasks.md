# Implementation Plan

## Overview

Plan de implementación incremental y guiado por pruebas para el motor de decisión crediticia en `services/evaluacion-core`. El orden respeta las dependencias del diseño: primero la configuración de umbrales y la normalización del adapter del buró, luego las cuatro reglas (Strategy), después el motor (Chain of Responsibility con ejecución por fases), luego la reescritura del caso de uso con consulta perezosa del buró y el publicador de auditoría enriquecido, y finalmente las pruebas de integración. Cada regla y componente se acompaña de sus pruebas basadas en propiedades (P1-P8) y pruebas unitarias por ejemplo.

Todas las reglas hoy devuelven `null` (placeholders); este plan las reemplaza por lógica real. Los contratos de `contracts/` son la fuente de verdad de request/response. La librería `fast-check` se añade como devDependency (Jest + Supertest ya existen).

## Tasks

- [x] 1. Configuración de umbrales del servicio
  - [x] 1.1 Crear `src/config/reglasConfig.js` y actualizar `.env.example`
    - Crear módulo único que lea `process.env` una vez y exponga umbrales tipados con defaults y validación de rango
    - `umbralScoreMinimo` desde `UMBRAL_SCORE_MINIMO` (default 600, valida rango 300-850)
    - `umbralScoreBueno` desde `UMBRAL_SCORE_BUENO` (default 700, valida rango 300-850)
    - `porcentajeCuotaIngreso` desde `PORCENTAJE_CUOTA_INGRESO` (default 0.35)
    - `modoCuotaIngreso` desde `MODO_CUOTA_INGRESO` (`RECHAZADO`|`REVISION_MANUAL`, default `REVISION_MANUAL`)
    - `topeMontoAprobacionAutomatica` desde `TOPE_MONTO_APROBACION_AUTOMATICA` (default 500, valida > 0)
    - Cada valor inválido debe quedar detectable por las reglas (valor no configurado) para que se auto-inhiban
    - Añadir las cinco variables a `.env.example`
    - _Requirements: 1.5, 1.6, 3.6, 4.5, 5.3, 5.5_

  - [ ]* 1.2 Escribir pruebas unitarias de `reglasConfig`
    - Verificar parsing de env vars, aplicación de defaults y validación de rangos/valores inválidos
    - _Requirements: 1.5, 1.6, 3.6, 4.5, 5.3, 5.5_

- [x] 2. Normalización del adapter del buró externo
  - [x] 2.1 Normalizar la salida de `src/infrastructure/adapters/buroExternoAdapter.js`
    - Mapear tanto la respuesta real (`ScoreResponse`, sin `estadoBuro`) como el fallback a la forma consistente `Datos_Buro`: `{ score: number|null, moraExterna, deudaExternaTotal, estadoBuro: "DISPONIBLE"|"INDISPONIBLE" }`
    - Conservar opossum: `timeout 3000`, `errorThresholdPercentage 50`, `resetTimeout 10000`
    - Fallback debe producir `score: null`, `estadoBuro: "INDISPONIBLE"`, `deudaExternaTotal: 0`, `moraExterna: false`
    - Manejar timeout y error de forma explícita, nunca propagar excepción al llamador
    - _Requirements: 7.1, 7.5_

  - [x]* 2.2 Escribir pruebas unitarias de normalización del adapter
    - Verificar mapeo de `ScoreResponse` a `Datos_Buro` y forma del fallback (score nulo, estado INDISPONIBLE)
    - _Requirements: 7.1_

- [x] 3. Implementar Regla Mora Vigente (Strategy, interna)
  - [x] 3.1 Implementar `src/domain/reglas/reglaMoraVigente.js`
    - Exportar `{ nombre: "REGLA_MORA_VIGENTE", requiereBuro: false, evaluar() }`
    - Devolver `RECHAZADO` con motivo de mora vigente si `historial.tieneMoraVigente === true`
    - Devolver `null` si `tieneMoraVigente === false` o indeterminado
    - _Requirements: 2.1, 2.2, 2.5_

  - [x]* 3.2 Escribir property test P1 (mora rechaza sin tocar el buró)
    - **Property 1: Mora vigente rechaza sin tocar el buró**
    - **Validates: Requirements 2.1, 2.3, 2.4**
    - `fc.assert(..., { numRuns: 100 })`; mock del adapter que cuenta invocaciones (cero esperadas)
    - Comentario: `// Feature: motor-decision-credito, Property 1: ...`

- [x] 4. Implementar Regla Capacidad de Pago (Strategy, interna)
  - [x] 4.1 Implementar `src/domain/reglas/reglaCapacidadPago.js`
    - Exportar `{ nombre: "REGLA_CAPACIDAD_PAGO", requiereBuro: false, evaluar() }`
    - `APROBADO` si `montoSolicitado <= topeMontoAprobacionAutomatica` con historial presente y `tieneMoraVigente === false`
    - `REVISION_MANUAL` con motivo si `ingresosDeclarados` nulo o no numérico > 0
    - `REVISION_MANUAL` con motivo si `plazoMeses` nulo o no numérico > 0 (sin calcular cuota)
    - Calcular `cuotaMensual = montoSolicitado / plazoMeses`; si `cuota/ingreso > porcentajeCuotaIngreso`, decidir según `modoCuotaIngreso` (`RECHAZADO` o `REVISION_MANUAL`)
    - Devolver `null` si config inválida, historial ausente/mora indeterminada, o relación cuota/ingreso dentro del límite
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 5.1, 5.4, 5.5_

  - [x]* 4.2 Escribir property test P3 (monto bajo con historial limpio aprueba sin buró)
    - **Property 3: Monto bajo con historial limpio aprueba sin buró**
    - **Validates: Requirements 5.1, 5.2**
    - `numRuns: 100`; mock del adapter que verifica cero invocaciones
    - Comentario: `// Feature: motor-decision-credito, Property 3: ...`

  - [ ]* 4.3 Escribir pruebas unitarias por ejemplo de `reglaCapacidadPago`
    - Motivo por ingreso ausente (crit. 4) y plazo inválido (crit. 5)
    - `modoCuotaIngreso` en `RECHAZADO` vs `REVISION_MANUAL` sobre la misma relación cuota/ingreso (crit. 2)
    - _Requirements: 3.2, 3.4, 3.5_

- [x] 5. Implementar Regla Score Buró (Strategy, requiere buró)
  - [x] 5.1 Implementar `src/domain/reglas/reglaScoreBuro.js`
    - Exportar `{ nombre: "REGLA_SCORE_BURO", requiereBuro: true, evaluar() }`
    - `RECHAZADO` con motivo que mencione el umbral si `score` numérico en 300-850 y `< umbralScoreMinimo`
    - Devolver `null` si `score` nulo/no numérico/fuera de 300-850, o si `>= umbral`, o si el umbral es inválido
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 7.2_

  - [ ]* 5.2 Escribir property test P2 (score bajo el umbral rechaza)
    - **Property 2: Score bajo el umbral (con buró disponible y sin mora) rechaza**
    - **Validates: Requirements 1.1, 1.3**
    - `numRuns: 100`
    - Comentario: `// Feature: motor-decision-credito, Property 2: ...`

  - [ ]* 5.3 Escribir pruebas unitarias por ejemplo de `reglaScoreBuro`
    - El motivo del rechazo menciona el umbral (crit. 2); `score == umbral` continúa la cadena (crit. 3)
    - _Requirements: 1.2, 1.3_

- [x] 6. Implementar Regla Cliente Nuevo (Strategy, requiere buró)
  - [x] 6.1 Implementar `src/domain/reglas/reglaClienteNuevo.js`
    - Exportar `{ nombre: "REGLA_CLIENTE_NUEVO", requiereBuro: true, evaluar() }`
    - Solo actúa si historial ausente; `null` si hay historial
    - `REVISION_MANUAL` con motivo de buen score si `score >= umbralScoreBueno`
    - `REVISION_MANUAL` con motivo de indisponibilidad si `score` nulo o `estadoBuro === "INDISPONIBLE"`, o si el umbral es inválido
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 7.4_

  - [ ]* 6.2 Escribir property test P4 (cliente nuevo con buen score deriva a revisión)
    - **Property 4: Cliente nuevo con buen score deriva a revisión manual**
    - **Validates: Requirements 4.1**
    - `numRuns: 100`
    - Comentario: `// Feature: motor-decision-credito, Property 4: ...`

  - [ ]* 6.3 Escribir pruebas unitarias por ejemplo de `reglaClienteNuevo`
    - Motivos diferenciados: buen score vs buró indisponible (crit. 2, 4)
    - _Requirements: 4.2, 4.4_

- [x] 7. Checkpoint - Reglas y dependencias
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Motor de reglas con ejecución por fases y trazabilidad
  - [x] 8.1 Modificar `src/domain/motorReglas.js` (Chain of Responsibility)
    - Acumular `reglasAplicadas` como array ordenado sin duplicados de los `nombre` evaluados hasta la regla que decide inclusive
    - En fallback, incluir todas las reglas + `"DEFAULT_APROBADO"`
    - Devolver `{ decision, motivo, reglasAplicadas }`
    - Exponer método de fase interna (solo reglas con `requiereBuro === false`) y método de continuación (reglas restantes), preservando el acumulado entre fases
    - Orden de cadena: `REGLA_MORA_VIGENTE` → `REGLA_CAPACIDAD_PAGO` → `REGLA_SCORE_BURO` → `REGLA_CLIENTE_NUEVO`
    - _Requirements: 6.2, 6.3, 6.4, 6.5_

  - [ ]* 8.2 Escribir property test P6 (`reglasAplicadas` ordenada, no vacía y consistente)
    - **Property 6: `reglasAplicadas` es una lista ordenada, no vacía y consistente con la regla que decidió**
    - **Validates: Requirements 6.2, 6.3, 6.4**
    - `numRuns: 100`
    - Comentario: `// Feature: motor-decision-credito, Property 6: ...`

  - [ ]* 8.3 Escribir property test P5 (toda decisión es un valor válido del dominio)
    - **Property 5: Toda decisión es un valor válido del dominio**
    - **Validates: Requirements 1.1, 2.1, 4.1, 5.1, 6.2**
    - `numRuns: 100`
    - Comentario: `// Feature: motor-decision-credito, Property 5: ...`

- [x] 9. Publicador de auditoría enriquecido
  - [x] 9.1 Modificar `src/infrastructure/auditoriaPublisher.js`
    - Enriquecer `RegistroAuditoria` con `scoreBuro` (nullable) y `tiendaId`, según contrato spec7
    - Publicación no bloqueante (fire-and-forget) con timeout 3000 ms; fallo/timeout solo se loguea y nunca altera la respuesta
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 10. Reescribir el caso de uso con consulta perezosa del buró
  - [x] 10.1 Reescribir `src/application/evaluarCreditoUseCase.js`
    - Obtener historial vía `repositorioInternoAdapter` (404 → historial `null`)
    - Ejecutar fase interna (sin buró); si queda indefinido y la siguiente regla `requiereBuro`, consultar buró y marcar `consultaBuroRealizada = true`; ejecutar fase con buró
    - Generar `idEvaluacion` con `crypto.randomUUID()`
    - Construir `DecisionCore` incluyendo `reglasAplicadas` y `consultaBuroRealizada`
    - Publicar auditoría fire-and-forget no bloqueante (invocar también en fallback del buró)
    - _Requirements: 2.4, 5.2, 6.1, 6.5, 7.3, 8.1, 8.4_

  - [x]* 10.2 Escribir property test P8 (`consultaBuroRealizada` sii se invocó el adapter)
    - **Property 8: `consultaBuroRealizada` es verdadero si y solo si se invocó el adapter del buró**
    - **Validates: Requirements 6.1, 6.5, 2.4, 5.2**
    - `numRuns: 100`; mock del adapter que cuenta invocaciones
    - Comentario: `// Feature: motor-decision-credito, Property 8: ...`

  - [x]* 10.3 Escribir property test P7 (fallo/timeout del buró nunca produce excepción no controlada)
    - **Property 7: Fallo o timeout del buró nunca produce excepción no controlada**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**
    - `numRuns: 100`; mock del adapter que fuerza fallback
    - Comentario: `// Feature: motor-decision-credito, Property 7: ...`

  - [x]* 10.4 Escribir prueba unitaria de formato de `idEvaluacion`
    - Verificar que `idEvaluacion` cumple el formato UUID
    - _Requirements: 6.1_

- [x] 11. Añadir fast-check e integrar pruebas de extremo a extremo
  - [x] 11.1 Añadir `fast-check` como devDependency
    - Actualizar `package.json` (el script `test: jest` ya existe)
    - _Requirements: 6.2_

  - [x]* 11.2 Escribir pruebas de integración de `POST /evaluar` con Supertest
    - Validar `DecisionCore` del contrato spec4 (campos y enums)
    - Auditoría fire-and-forget: con el publicador fallando, la respuesta sigue 200 con la misma `DecisionCore`
    - Circuit Breaker: simular `CAIDO`/`LATENCIA_ALTA` del buró y verificar fallback y continuidad
    - _Requirements: 7.1, 7.3, 7.5, 8.3_

- [x] 12. Checkpoint final - Motor, caso de uso e integración
  - Ensure all tests pass, ask the user if questions arise.

- [ ]* 13. Validación de KPIs con k6 (fuera de este servicio)
  - Escenarios de carga en `perf/k6/` con mezcla representativa de solicitudes (mora, monto bajo, score, cliente nuevo)
  - Medir `p95 < 500 ms`, `95% < 3 s`, `error < 1%` y proporción de `consultaBuroRealizada = false >= 60%`
  - Vive fuera de `services/evaluacion-core`; opcional respecto a esta feature
  - _Requirements: 6.1_

- [x] 14. Reestructurar por capas con patrón Repository (steering `structure.md`)
  - [x] 14.1 Adaptar la estructura estándar conservando `domain/`
    - `domain/` (motor + reglas) y `config/reglasConfig.js` sin cambios
    - `application/evaluarCreditoUseCase.js` → `services/evaluacionCreditoService.js` (`crearEvaluacionCreditoService(deps)`, con dependencias inyectadas)
    - `routes/evaluar.js` → `routes/evaluacionRoutes.js` + `controllers/evaluacionController.js`; `index.js` → `app.js` (`crearApp(deps)`) + `index.js` (raíz de composición)
    - `config/coreConfig.js` con URLs, timeouts y opciones del Circuit Breaker
    - _Requirements: 6.1, 6.5, 8.1_

  - [x] 14.2 Convertir los adapters en repositorios con interfaz
    - `repositories/historialClienteRepository.interface.js` + `httpHistorialClienteRepository.js` (antes `repositorioInternoAdapter`; 404 → `null`)
    - `repositories/datosBuroRepository.interface.js` + `httpDatosBuroRepository.js` (antes `buroExternoAdapter`; Circuit Breaker opossum + fallback dentro de la implementación, un breaker por instancia)
    - Modelos inmutables `models/historialCliente.js` y `models/datosBuro.js` (`DatosBuro.indisponible()`)
    - `infrastructure/auditoriaPublisher.js` → `clients/auditoriaPublisher.js` (`crearAuditoriaPublisher`) + `dtos/registroAuditoriaDto.js`; `dtos/decisionCoreDto.js`
    - _Requirements: 7.1, 7.5, 8.2, 8.3_

  - [x] 14.3 Validación temprana de `SolicitudCore` y manejador de errores como middlewares
    - `middlewares/validarSolicitudCore.js`: 400 `INVALID_IDENTIFICACION` / `INVALID_REQUEST` antes de tocar el dominio (prevista en "Error Handling" del diseño y en spec4, hasta ahora no implementada)
    - `middlewares/manejadorErrores.js` + `utils/errorCore.js`; JSON mal formado → 400
    - _Requirements: 6.1_

- [x] 15. Checkpoint — Reestructuración
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Las tareas marcadas con `*` son opcionales (pruebas y validación de KPIs) y pueden omitirse para un MVP más rápido.
- Cada tarea referencia los criterios de aceptación específicos que satisface, no solo la historia de usuario.
- Los checkpoints aseguran validación incremental antes de continuar.
- Las pruebas basadas en propiedades (P1-P8) validan propiedades universales de corrección; las pruebas unitarias validan motivos y bordes concretos.
- Las reglas leen umbrales exclusivamente de `reglasConfig`, nunca de `process.env`.
- Todo cambio de contrato se refleja primero en el YAML de `contracts/`; este plan no modifica contratos, solo se ajusta a ellos.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1"] },
    { "id": 1, "tasks": ["1.2", "2.2", "3.1", "4.1", "5.1", "6.1", "9.1", "11.1"] },
    { "id": 2, "tasks": ["3.2", "4.2", "4.3", "5.2", "5.3", "6.2", "6.3", "8.1"] },
    { "id": 3, "tasks": ["8.2", "8.3", "10.1"] },
    { "id": 4, "tasks": ["10.2", "10.3", "10.4", "11.2"] },
    { "id": 5, "tasks": ["13"] },
    { "id": 6, "tasks": ["14.1", "14.2", "14.3"] }
  ]
}
```
