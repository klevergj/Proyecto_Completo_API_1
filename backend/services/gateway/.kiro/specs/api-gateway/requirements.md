# Requirements Document

## Introduction

Esta funcionalidad implementa la lógica real del **API Gateway** (`gateway`, puerto 8080), el único punto de entrada público del sistema **Resuelve Crédito** para aliados, tiendas y apps. El Gateway autentica cada petición con OAuth2 (flujo `client_credentials`), verifica el scope requerido por cada endpoint, limita la tasa por cliente, enruta hacia el BFF correspondiente bajo un contrato versionado `/v1` y registra métricas por petición para las pruebas de carga.

Hoy el Gateway tiene la estructura por capas del steering, pero su lógica es un placeholder con defectos:

1. **No autentica.** `autenticacion.js` solo exige la cabecera `Authorization` en `production` y acepta cualquier valor; nunca valida un JWT. `docker-compose.yml` define un `JWT_SECRET` simétrico que no se usa.
2. **No autoriza.** No existen scopes: cualquier petición llega a cualquier BFF.
3. **Limita por IP, no por cliente.** El rate limit usa la IP, que detrás de un NAT de tienda o un balanceador agrupa a muchos clientes.
4. **El enrutamiento hacia el BFF POS está roto.** Con `http-proxy-middleware` 3.x, el prefijo montado por `router.use()` no llega al destino: `POST /evaluaciones-credito` llega al BFF como `POST /` y responde 404. Además, la opción `onError` (API v2) se ignora, así que un BFF caído produce un `504` en texto plano (documentado con `test.failing`).
5. **No versiona.** Las rutas públicas no tienen el prefijo `/v1` que declara el contrato (Spec 1, `servers: https://api.resuelve.com/v1`).
6. **No mide.** No registra latencia ni código de respuesta por petición.

El Gateway está en el camino de **todas** las peticiones, así que rige los KPIs del sistema: 95 % de las solicitudes en menos de 3 s, p95 < 500 ms bajo carga sostenida, error < 1 % y picos de 100-500 usuarios concurrentes. Su trabajo propio (validar la firma del JWT con una clave en caché, comprobar el scope, consultar el contador de tasa) debe ser de milisegundos, y los timeouts hacia los BFFs deben superar los timeouts internos de cada BFF, para que el error que llegue al cliente sea el del BFF y no uno genérico del Gateway.

Contrato de referencia (fuente de verdad): `contracts/spec1-gateway.yaml` (se actualiza primero, steering `tech.md`), que referencia los esquemas de `spec2-bff-pos.yaml` y `spec3-bff-auditoria.yaml`.

## Glossary

- **Gateway**: El servicio `gateway` descrito en este documento.
- **Servidor_Autorizacion**: Keycloak (steering `tech.md`), que emite los tokens de acceso OAuth2 con el flujo `client_credentials` y publica sus claves públicas (JWKS).
- **Cliente_API**: Aliado, tienda o app registrado en el Servidor_Autorizacion con un `client_id` y los scopes que tiene permitidos.
- **Token_Acceso**: JWT firmado con RS256 por el Servidor_Autorizacion, con los claims `iss`, `aud`, `exp`, `scope` (scopes separados por espacio) y `azp` o `client_id` (identificador del Cliente_API).
- **Scope_Requerido**: Scope que debe estar en el Token_Acceso para acceder a un endpoint: `evaluaciones:escribir`, `evaluaciones:leer` o `auditoria:leer`.
- **Tabla_Rutas**: Definición declarativa de los endpoints públicos: método, ruta pública bajo `/v1`, Scope_Requerido, BFF destino y ruta interna.
- **BFF_POS**: `bff-punto-venta` (Spec 2): `POST /evaluaciones-credito` y `GET /evaluaciones-credito/{id}`.
- **BFF_Auditoria**: `bff-auditoria` (Spec 3): `GET /evaluaciones` y `GET /evaluaciones/{id}/detalle`.
- **Limite_Tasa**: Máximo de peticiones por Cliente_API en una ventana de tiempo (`RATE_LIMIT_MAX` en `RATE_LIMIT_WINDOW_MS`).
- **Metricas_Peticion**: Latencia, código de respuesta, método y ruta (plantilla, sin identificadores) de cada petición.
- **ErrorRespuestaGateway**: Cuerpo de error `{ error: { code, message, reintentable } }`, con la misma forma que usan los BFFs.

## Requirements

### Requisito 1: Autenticación OAuth2 client_credentials

**Historia de Usuario:** Como responsable de seguridad, quiero que el Gateway solo reenvíe peticiones con un token de acceso válido emitido por nuestro servidor de autorización, para que ningún tercero no registrado llegue a los servicios internos. (RF-01)

#### Criterios de Aceptación

1. WHEN el Gateway recibe una petición a un endpoint de la Tabla_Rutas, THE Gateway SHALL exigir la cabecera `Authorization: Bearer <token>` antes de reenviarla a cualquier BFF.
2. THE Gateway SHALL aceptar el Token_Acceso solo si su firma RS256 es válida contra las claves publicadas en el JWKS del Servidor_Autorizacion, su `iss` es el emisor configurado (`JWT_ISSUER`), su `aud` incluye la audiencia configurada (`JWT_AUDIENCE`) y no está expirado.
3. IF la cabecera falta, no es de tipo `Bearer` o el Token_Acceso no cumple el criterio 2, THEN THE Gateway SHALL responder 401 con un ErrorRespuestaGateway de `code` `NO_AUTENTICADO`, la cabecera `WWW-Authenticate: Bearer` y SHALL NOT reenviar la petición.
4. THE Gateway SHALL obtener las claves públicas del JWKS con caché y límite de consultas, para que validar un token no requiera una llamada de red por petición.
5. IF el JWKS del Servidor_Autorizacion no está disponible y la clave del token no está en caché, THEN THE Gateway SHALL responder 503 con un ErrorRespuestaGateway de `code` `AUTORIZACION_NO_DISPONIBLE` y `reintentable` verdadero.
6. THE Gateway SHALL NOT reenviar la cabecera `Authorization` a los BFFs; SHALL reenviar el identificador del Cliente_API en la cabecera `X-Client-Id`.
7. WHEN el Gateway recibe `GET /health`, THE Gateway SHALL responder 200 sin exigir autenticación.
8. WHERE la configuración define `AUTH_HABILITADA` con el valor `false` (modo temporal, hasta integrar el Frontend con tokens), THE Gateway SHALL omitir la autenticación y la verificación de scope, aplicar el Limite_Tasa por dirección IP, reenviar `X-Client-Id: anonimo` y registrar una advertencia al arrancar. Con cualquier otro valor, o sin la variable, la autenticación SHALL quedar activa.

### Requisito 2: Autorización por scope

**Historia de Usuario:** Como responsable de seguridad, quiero que cada cliente solo acceda a las operaciones que tiene autorizadas, para que una tienda no pueda consultar la auditoría interna ni un auditor pueda crear evaluaciones. (RF-02)

#### Criterios de Aceptación

1. THE Tabla_Rutas SHALL asignar el Scope_Requerido: `POST /v1/evaluaciones-credito` → `evaluaciones:escribir`; `GET /v1/evaluaciones-credito/{id}` → `evaluaciones:leer`; `GET /v1/auditoria/evaluaciones` y `GET /v1/auditoria/evaluaciones/{id}/detalle` → `auditoria:leer`.
2. WHEN un Token_Acceso válido incluye el Scope_Requerido del endpoint, THE Gateway SHALL permitir la petición.
3. IF el Token_Acceso válido no incluye el Scope_Requerido, THEN THE Gateway SHALL responder 403 con un ErrorRespuestaGateway de `code` `SCOPE_INSUFICIENTE`, la cabecera `WWW-Authenticate: Bearer error="insufficient_scope", scope="<scope>"` y SHALL NOT reenviar la petición.
4. THE Gateway SHALL interpretar el claim `scope` como una cadena de scopes separados por espacios y SHALL aceptar también un arreglo de cadenas (`scp`), sin coincidencias parciales (`evaluaciones:leer` no satisface `evaluaciones:escribir`).

### Requisito 3: Rate limiting por cliente

**Historia de Usuario:** Como equipo de operación, quiero limitar la tasa de peticiones por cliente, para que un aliado con un error o un pico no degrade el servicio para los demás. (RF-03)

#### Criterios de Aceptación

1. THE Gateway SHALL contar las peticiones autenticadas por identificador de Cliente_API (claim `azp`, o `client_id` si `azp` no existe), no por dirección IP.
2. IF un Cliente_API supera el Limite_Tasa dentro de la ventana, THEN THE Gateway SHALL responder 429 con un ErrorRespuestaGateway de `code` `LIMITE_TASA_EXCEDIDO`, `reintentable` verdadero y la cabecera `Retry-After`, sin reenviar la petición.
3. THE Gateway SHALL incluir en cada respuesta limitada las cabeceras estándar `RateLimit-Limit`, `RateLimit-Remaining` y `RateLimit-Reset`.
4. WHEN un Cliente_API alcanza su límite, THE Gateway SHALL seguir atendiendo a los demás Cliente_API sin afectarlos.
5. THE Limite_Tasa y su ventana SHALL obtenerse de la configuración (`RATE_LIMIT_MAX`, por defecto 100; `RATE_LIMIT_WINDOW_MS`, por defecto 60000).

### Requisito 4: Enrutamiento hacia los BFFs

**Historia de Usuario:** Como aliado, quiero un único punto de entrada que lleve cada operación al servicio correcto, para integrarme sin conocer la topología interna. (RF-04)

#### Criterios de Aceptación

1. WHEN el Gateway permite `POST /v1/evaluaciones-credito` o `GET /v1/evaluaciones-credito/{id}`, THE Gateway SHALL reenviarla al BFF_POS como `POST /evaluaciones-credito` o `GET /evaluaciones-credito/{id}`, conservando el cuerpo, la query string y el `Content-Type`.
2. WHEN el Gateway permite `GET /v1/auditoria/evaluaciones` o `GET /v1/auditoria/evaluaciones/{id}/detalle`, THE Gateway SHALL reenviarla al BFF_Auditoria como `GET /evaluaciones` o `GET /evaluaciones/{id}/detalle`, conservando la query string.
3. THE Gateway SHALL devolver al cliente el código de estado, el cuerpo y el `Content-Type` que responda el BFF, sin modificarlos.
4. IF la combinación de método y ruta no está en la Tabla_Rutas, THEN THE Gateway SHALL responder 404 con un ErrorRespuestaGateway de `code` `RUTA_NO_ENCONTRADA` sin exigir token y sin reenviar.
5. IF el BFF destino no es alcanzable, THEN THE Gateway SHALL responder 502 con un ErrorRespuestaGateway de `code` `BFF_NO_DISPONIBLE` y `reintentable` verdadero, sin incluir mensajes técnicos del proxy.
6. IF el BFF destino no responde dentro del timeout configurado para ese BFF (`BFF_POS_TIMEOUT_MS`, por defecto 6000; `BFF_AUDITORIA_TIMEOUT_MS`, por defecto 4000), THEN THE Gateway SHALL responder 504 con un ErrorRespuestaGateway de `code` `BFF_TIMEOUT` y `reintentable` verdadero.
7. THE Gateway SHALL propagar a los BFFs la cabecera `X-Request-Id` (la recibida si es válida, o una nueva UUID) y SHALL incluirla en la respuesta al cliente.
8. THE Gateway SHALL NOT contener lógica de negocio ni transformar los cuerpos de petición o respuesta (steering `tech.md`).

### Requisito 5: Versionado del contrato público

**Historia de Usuario:** Como aliado, quiero que el contrato público esté versionado, para que la evolución del API no rompa mi integración. (RF-05)

#### Criterios de Aceptación

1. THE Gateway SHALL exponer todos los endpoints de negocio bajo el prefijo `/v1`.
2. IF una petición usa una ruta de negocio sin prefijo de versión o con una versión no soportada, THEN THE Gateway SHALL responder 404 con un ErrorRespuestaGateway de `code` `RUTA_NO_ENCONTRADA`.
3. THE Tabla_Rutas SHALL definir la versión como parte de cada ruta, de modo que agregar `/v2` no requiera modificar las rutas `/v1` existentes.
4. THE Gateway SHALL incluir en cada respuesta de negocio la cabecera `API-Version: v1`.

### Requisito 6: Métricas por petición

**Historia de Usuario:** Como equipo de rendimiento, quiero métricas de latencia y código de respuesta por petición, para validar los KPIs en las pruebas de carga de la Fase 4. (RF-06)

#### Criterios de Aceptación

1. WHEN el Gateway termina de responder cualquier petición, incluidas las rechazadas con 401, 403, 404 o 429, THE Gateway SHALL registrar su latencia en segundos, el código de respuesta, el método y la ruta.
2. THE ruta registrada SHALL ser la plantilla de la Tabla_Rutas (por ejemplo `/v1/evaluaciones-credito/:id`) o `no_encontrada`, y SHALL NOT incluir identificadores, query strings ni datos del cliente, para acotar la cardinalidad.
3. THE Gateway SHALL exponer las métricas en formato Prometheus (histograma de latencia con percentiles calculables y contador de peticiones) en `GET /metrics` de un puerto interno separado (`METRICS_PORT`, por defecto 9464) que no se publica hacia los aliados.
4. THE Gateway SHALL escribir por cada petición una línea de log estructurado (JSON) con `requestId`, `clientId`, método, ruta, código y latencia, sin el token ni el cuerpo.
5. THE Gateway SHALL incluir en cada respuesta la cabecera `X-Response-Time` con la latencia medida en milisegundos.

### Requisito 7: Contrato publicado para el Frontend

**Historia de Usuario:** Como desarrollador del Frontend, quiero un contrato único y siempre alineado de los endpoints que consumo a través del Gateway, para integrarme sin revisar varios archivos ni adivinar los cuerpos de petición y respuesta.

#### Criterios de Aceptación

1. THE contrato del Frontend (`contracts/spec0-frontend.yaml`) SHALL generarse a partir de `contracts/spec1-gateway.yaml` con un comando del Gateway (`npm run contrato:frontend`) y SHALL NOT editarse a mano.
2. THE contrato del Frontend SHALL ser autocontenido: sin referencias a otros archivos, con los esquemas de los BFFs incluidos.
3. THE contrato del Frontend SHALL incluir cada endpoint de la Tabla_Rutas, agrupado por pantalla (Punto de Venta, Panel de Auditoria), con ejemplos de petición y respuesta.
4. WHEN el Gateway recibe `GET /docs` o `GET /openapi.yaml`, THE Gateway SHALL servir el contrato del Frontend (Swagger UI o YAML) sin exigir token, leyéndolo desde `contracts/` sin copiarlo en el servicio (steering `structure.md`).
5. IF el contrato no puede cargarse, THEN THE Gateway SHALL arrancar igualmente y responder 404 en `/openapi.yaml`.
