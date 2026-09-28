# Implementation Plan

## Overview

Plan incremental y guiado por pruebas para el API Gateway en `services/gateway`. El servicio ya tiene la estructura estándar del steering con un placeholder de autenticación y un proxy defectuoso. El plan actualiza primero el contrato (steering `tech.md`), luego la configuración, la Tabla_Rutas y los módulos puros, los middlewares de seguridad, el proxy corregido y las métricas, y al final la infraestructura (Keycloak en Compose) y los consumidores (k6, E2E, Postman).

Lenguaje: **JavaScript (Node.js 20 LTS)**. Dependencias: `express-jwt` y `jwks-rsa` (ya presentes), `prom-client` (nueva). DevDependencies: `fast-check` (`4.10.2`) y `jsonwebtoken`.

## Tasks

- [x] 1. Actualizar primero el contrato OpenAPI 3.0 (`contracts/spec1-gateway.yaml`)
  - [x] 1.1 Actualizar `spec1-gateway.yaml` a la versión `1.1.0`
    - `servers` con `/v1`; `securitySchemes.OAuth2` `clientCredentials` con `tokenUrl` de Keycloak y los tres scopes
    - `POST /evaluaciones-credito` y `GET /evaluaciones-credito/{id}` con esquemas de `spec2` por `$ref` externo; `GET /auditoria/evaluaciones` y `GET /auditoria/evaluaciones/{id}/detalle` con esquemas de `spec3`
    - Respuestas del Gateway 401 / 403 / 404 / 429 (`Retry-After`, `RateLimit-*`) / 502 / 503 / 504 con `ErrorRespuestaGateway`; cabeceras `X-Request-Id`, `API-Version`, `X-Response-Time`
    - _Requirements: 1.1, 1.3, 2.1, 2.3, 3.2, 3.3, 4.1, 4.2, 4.4, 4.5, 4.6, 5.1, 5.4, 6.5_

- [x] 2. Configuración y módulos puros
  - [x] 2.1 Añadir dependencias: `prom-client` (versión fijada); devDependencies `fast-check` `4.10.2` y `jsonwebtoken`
    - _Requirements: 1.2, 6.3_

  - [x] 2.2 Reescribir `src/config/gatewayConfig.js` y `.env.example`
    - `crearGatewayConfig(env)`: OAuth2 obligatorio (issuer, audience, JWKS), destinos y timeouts, límite de tasa, `metricsPort`
    - _Requirements: 1.2, 3.5, 4.6, 6.3_

  - [x] 2.3 Crear `src/routes/tablaRutas.js`
    - `TABLA_RUTAS` versión `v1` y `resolverRuta(metodo, ruta)` con plantillas ancladas y parámetros re-codificados
    - _Requirements: 2.1, 4.1, 4.2, 4.4, 5.1, 5.3_

  - [x] 2.4 Crear `src/utils/scopes.js`, `src/utils/errorGateway.js` y `src/utils/registroMetricas.js`
    - `scopesDelToken`, `identificadorCliente`; `ErrorGateway` con la tabla del diseño; registro `prom-client` propio
    - _Requirements: 2.4, 3.1, 6.3_

  - [x]* 2.5 Escribir pruebas unitarias de configuración, Tabla_Rutas y scopes
    - Fallo sin issuer / audience / JWKS; plantillas ancladas; codificación de parámetros; `scope` vs `scp`
    - _Requirements: 1.2, 2.4, 4.4, 5.3_

- [x] 3. Middlewares de seguridad y observabilidad
  - [x] 3.1 Crear `solicitudId.js`, `metricas.js` y `resolverRuta.js`
    - _Requirements: 4.4, 4.7, 5.2, 6.1, 6.2, 6.4, 6.5_

  - [x] 3.2 Reescribir `autenticacion.js` (express-jwt + jwks-rsa, RS256, iss, aud, exp)
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 3.3 Reescribir `limiteTasa.js` (por cliente) y crear `autorizacionScope.js`
    - _Requirements: 2.2, 2.3, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.4 Reescribir `manejadorErrores.js`
    - `UnauthorizedError` → 401 + `WWW-Authenticate`; errores de JWKS → 503; `ErrorGateway` tal cual; resto → 500
    - _Requirements: 1.3, 1.5_

- [x] 4. Proxy corregido y composición
  - [x] 4.1 Reescribir `src/routes/proxyRoutes.js`
    - Ruta interna desde la Tabla_Rutas (corrige el defecto de v3); `proxyTimeout` por destino; `on.proxyReq` (sin `Authorization`, con `X-Client-Id` y `X-Request-Id`); `on.proxyRes` (`API-Version`); `on.error` → 502 / 504 JSON
    - _Requirements: 1.6, 4.1, 4.2, 4.3, 4.5, 4.6, 4.7, 4.8, 5.4_

  - [x] 4.2 Reescribir `src/app.js` e `src/index.js`
    - Cadena en el orden del diseño; `crearAppMetricas`; dos `listen` (público y métricas)
    - _Requirements: 1.7, 6.3_

- [x] 5. Pruebas basadas en propiedades
  - [x]* 5.1 Crear fixtures `__helpers__/jwt.js` (RSA + JWKS local + firma) y `__helpers__/bffEco.js`
  - [x]* 5.2 Property 1 — `// Feature: api-gateway, Property 1: Sin un token válido no se llega a ningún BFF` — **Validates: Requirements 1.1, 1.2, 1.3** — `{ numRuns: 100 }`
  - [x]* 5.3 Property 2 — `// Feature: api-gateway, Property 2: El scope decide exactamente el acceso` — **Validates: Requirements 2.1, 2.2, 2.3, 2.4** — `{ numRuns: 100 }`
  - [x]* 5.4 Property 3 — `// Feature: api-gateway, Property 3: El enrutamiento preserva método, ruta interna, query y cuerpo` — **Validates: Requirements 1.6, 4.1, 4.2, 4.3, 4.7, 4.8** — `{ numRuns: 100 }`
  - [x]* 5.5 Property 4 — `// Feature: api-gateway, Property 4: El límite de tasa es por cliente e independiente entre clientes` — **Validates: Requirements 3.1, 3.2, 3.3, 3.4** — `{ numRuns: 25 }` (crea una app por iteración)
  - [x]* 5.6 Property 5 — `// Feature: api-gateway, Property 5: Rutas no versionadas o desconocidas responden 404 sin token ni proxy` — **Validates: Requirements 4.4, 5.1, 5.2** — `{ numRuns: 100 }`
  - [x]* 5.7 Property 6 — `// Feature: api-gateway, Property 6: Cada petición queda medida con una ruta de baja cardinalidad` — **Validates: Requirements 6.1, 6.2, 6.3** — `{ numRuns: 50 }`
  - [x]* 5.8 Property 7 — `// Feature: api-gateway, Property 7: Todo fallo del BFF se traduce sin filtraciones` — **Validates: Requirements 4.5, 4.6** — `{ numRuns: 20 }` (incluye esperas por timeout)
  - [x]* 5.9 Pruebas de ejemplo: JWKS caído → 503; `X-Request-Id` recibido y generado; `/metrics` en el puerto de métricas; `/health` sin token; `X-Response-Time`
    - Convertir las dos pruebas `test.failing` del defecto del proxy en pruebas normales
    - _Requirements: 1.5, 1.7, 4.7, 6.3, 6.5_

- [x] 6. Checkpoint — Gateway
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Infraestructura y consumidores
  - [ ] 7.1 Crear `infra/keycloak/resuelve-realm.json` y añadir `keycloak` a `docker-compose.yml` — **PENDIENTE: se hará al activar el token, cuando el Frontend esté integrado**
    - Realm `resuelve`, scopes, audience mapper `resuelve-api`, clientes `tienda-demo` y `auditor-demo` (secretos solo de desarrollo)
    - Gateway en Compose: `AUTH_HABILITADA: "true"`, `JWT_ISSUER`, `JWT_AUDIENCE`, `JWKS_URI`; `depends_on` keycloak
    - _Requirements: 1.2, 1.4_

  - [x] 7.2 Actualizar `perf/k6/evaluacion-carga.js`
    - `/v1`, verificación de `ResultadoPos`, mezcla de datos semilla, umbrales de KPIs (p95 < 500 ms, error < 1 %, 100-500 VUs); `Bearer` opcional con `GATEWAY_TOKEN`
    - _Requirements: 6.1_

  - [x] 7.3 Actualizar `tests/integration/flujo-completo.test.js` y `docs/postman/Resuelve_API.postman_collection.json`
    - Todo por el Gateway `/v1` (evaluación, reconsulta, auditoría, 404 sin versión); token opcional (`GATEWAY_TOKEN` / `{{gatewayToken}}`)
    - _Requirements: 1.1, 2.3, 5.1_

  - [x] 7.4 Modo temporal sin autenticación (`AUTH_HABILITADA=false`)
    - Config: solo `"false"` desactiva OAuth2 (sin la variable queda activa); sin OAuth2 no se exigen las variables `JWT_*`
    - `app.js` omite `autenticacion` y `autorizacionScope`; límite de tasa por IP; `X-Client-Id: anonimo`; advertencia al arrancar
    - `docker-compose.yml`: `AUTH_HABILITADA: "false"`, timeouts, `METRICS_PORT`; se elimina `JWT_SECRET`
    - Pruebas: `gateway.sinAutenticacion.test.js`
    - _Requirements: 1.8_

- [x] 8. Checkpoint final — Ensure all tests pass
  - 25 pruebas del Gateway estables (5 corridas consecutivas sin fallos)
  - E2E con la cadena completa local (PostgreSQL y MongoDB reales) en modo sin token: 5/5
  - Pendiente con la tarea 7.1: verificación con Keycloak real (token `client_credentials`) y ejecución de k6 (no disponible localmente)

- [x] 9. Contrato publicado para el Frontend
  - [x] 9.1 Añadir etiquetas (Punto de Venta, Panel de Auditoria) y ejemplos de los tres escenarios a `spec1-gateway.yaml`
    - _Requirements: 7.3_
  - [x] 9.2 Crear `scripts/generarContratoFrontend.js` (`npm run contrato:frontend`): `redocly bundle` de spec1 + info y servers del Frontend -> `contracts/spec0-frontend.yaml` (autocontenido, marcado "NO EDITAR")
    - _Requirements: 7.1, 7.2_
  - [x] 9.3 Servir el contrato: `utils/contratoFrontend.js`, `routes/docsRoutes.js` (`/docs` Swagger UI, `/openapi.yaml`), `CONTRATO_FRONTEND_PATH`, volumen `./contracts:/contracts:ro` en Compose; etiquetas de métricas `/docs` y `/openapi.yaml`
    - Dependencias `yaml@2.9.1` (la 2.5.1 tenía una vulnerabilidad moderada) y `swagger-ui-express@5.0.1`; Redocly se ejecuta con `npx` (no queda en `package.json`)
    - _Requirements: 7.4, 7.5_
  - [x]* 9.4 Pruebas `gateway.docs.test.js`: alineación spec0 ↔ Tabla_Rutas, autocontenido, `/docs` y `/openapi.yaml` sin token, contrato ausente
    - _Requirements: 7.2, 7.3, 7.4, 7.5_

## Notes

- Las tareas con `*` son opcionales (pruebas) pero recomendadas: el Gateway es la frontera de seguridad.
- Contract-first (steering `tech.md`): la tarea 1 actualiza `spec1`. `spec0-frontend.yaml` se **genera** desde `spec1` (tarea 9) y el Gateway lo sirve en `/docs`; el Frontend lo toma como entrada.
- Condición de integración: el flujo `client_credentials` exige un secreto de cliente que no debe vivir en un navegador; el Frontend Tiendas debe obtener el token desde un backend de la tienda.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "2.2", "2.3", "2.4"] },
    { "id": 2, "tasks": ["2.5", "3.1", "3.2", "3.3", "3.4"] },
    { "id": 3, "tasks": ["4.1", "4.2", "5.1"] },
    { "id": 4, "tasks": ["5.2", "5.3", "5.4", "5.5", "5.6", "5.7", "5.8", "5.9", "7.1"] },
    { "id": 5, "tasks": ["7.2", "7.3"] }
  ]
}
```
