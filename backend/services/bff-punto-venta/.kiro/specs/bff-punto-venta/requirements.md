# Requirements Document

## Introduction

Esta funcionalidad implementa la lógica real del **BFF Punto de Venta** (`bff-punto-venta`, puerto 8081) dentro del sistema **Resuelve Crédito**. El BFF (Backend for Frontend) es la capa que adapta el Servicio de Evaluación (core, Spec 4) a las necesidades de la pantalla de caja en tienda. Hoy el servicio es un esqueleto: reenvía el cuerpo de la solicitud al core sin validarlo ni traducirlo, devuelve un objeto con la forma de `DecisionFrontend` (no la de `ResultadoPos` del contrato Spec 2), rellena valores por defecto engañosos (`PENDIENTE`, UUID de ceros) cuando el core no responde lo esperado, siempre reconsulta al core en `GET /evaluaciones-credito/{id}` y expone al frontend errores crudos (incluido el cuerpo de la respuesta del core).

El BFF recibe la `SolicitudEvaluacionPos` que llega desde el API Gateway, la valida y la traduce a la `SolicitudCore` que espera el core; traduce la `DecisionCore` a un `ResultadoPos` reducido (`idEvaluacion`, `aprobado`, `mensajeParaCliente`) para mostrarse en caja en una o dos líneas; mantiene una caché en memoria de resultados para responder reconsultas de estado sin volver a llamar al core; y convierte cualquier fallo del core en una respuesta de error estructurada y comprensible para el frontend.

El diseño está condicionado por los indicadores de negocio del sistema: el 95% de las solicitudes debe resolverse en menos de 3 segundos, la latencia p95 debe mantenerse por debajo de 500 ms bajo carga sostenida y la tasa de error debe ser menor al 1%. El BFF no debe añadir latencia significativa al camino crítico ni convertir fallos recuperables en errores opacos.

Contrato de referencia (fuente de verdad): `contracts/spec2-bff-pos.yaml` (interfaz expuesta) y `contracts/spec4-evaluacion-core.yaml` (dependencia consumida).

## Glossary

- **BFF_POS**: El servicio `bff-punto-venta` descrito en este documento.
- **Gateway**: El API Gateway (`gateway`, puerto 8080), que reenvía por proxy las peticiones `/evaluaciones-credito*` hacia el BFF_POS.
- **Core**: El Servicio de Evaluación de Crédito (`evaluacion-core`, puerto 8090), que expone `POST /evaluar` y `GET /evaluaciones/{id}` según Spec 4.
- **Cliente_Core**: Componente de infraestructura del BFF_POS (`evaluacionCoreClient`) que realiza las llamadas HTTP al Core.
- **SolicitudEvaluacionPos**: Cuerpo de entrada del BFF_POS según Spec 2: `identificacion` (string), `montoSolicitado` (number), `plazoMeses` (integer) y `tiendaId` (string), todos obligatorios.
- **SolicitudCore**: Cuerpo que espera el Core en `POST /evaluar` según Spec 4: `identificacion` (string no vacía), `montoSolicitado` (number > 0), `plazoMeses` (integer > 0) y `tiendaId` (string, opcional en Spec 4).
- **DecisionCore**: Respuesta del Core según Spec 4: `idEvaluacion` (uuid), `decision` (`APROBADO` | `RECHAZADO` | `REVISION_MANUAL`), `motivo`, `fecha`, `consultaBuroRealizada` y `reglasAplicadas`.
- **ResultadoPos**: Respuesta del BFF_POS según Spec 2: `idEvaluacion` (uuid), `aprobado` (boolean) y `mensajeParaCliente` (string corto y humano).
- **Mensaje_Para_Cliente**: Texto que el cajero muestra al cliente final, derivado exclusivamente de la `decision` del Core.
- **Cache_Resultados**: Almacén en memoria del BFF_POS que asocia `idEvaluacion` con su `ResultadoPos`, con tiempo de vida (TTL) y capacidad máxima configurables.
- **ErrorRespuestaPos**: Cuerpo de error del BFF_POS: objeto `error` con `code` (string estable), `message` (texto en lenguaje humano) y `reintentable` (boolean).
- **Timeout_Core**: Tiempo máximo configurable que el Cliente_Core espera una respuesta del Core.

## Requirements

### Requisito 1: Recepción, validación y traducción de la solicitud

**Historia de Usuario:** Como cajero de tienda, quiero que la solicitud de crédito capturada en caja llegue al motor de evaluación en el formato correcto, para obtener una decisión sin errores de integración. (RF-01)

#### Criterios de Aceptación

1. WHEN el BFF_POS recibe `POST /evaluaciones-credito` con una SolicitudEvaluacionPos válida, THE BFF_POS SHALL invocar al Core en `POST /evaluar` exactamente una vez con una SolicitudCore construida a partir de la solicitud recibida.
2. THE SolicitudCore enviada al Core SHALL contener únicamente los campos `identificacion`, `montoSolicitado`, `plazoMeses` y `tiendaId`, con los mismos valores recibidos, salvo `identificacion`, que se envía sin espacios al inicio ni al final.
3. IF `identificacion` está ausente, no es una cadena de texto o queda vacía tras eliminar espacios, THEN THE BFF_POS SHALL responder 400 con un ErrorRespuestaPos de `code` `SOLICITUD_INVALIDA` sin invocar al Core.
4. IF `montoSolicitado` está ausente o no es un número finito mayor que cero, THEN THE BFF_POS SHALL responder 400 con un ErrorRespuestaPos de `code` `SOLICITUD_INVALIDA` sin invocar al Core.
5. IF `plazoMeses` está ausente o no es un número entero mayor que cero, THEN THE BFF_POS SHALL responder 400 con un ErrorRespuestaPos de `code` `SOLICITUD_INVALIDA` sin invocar al Core.
6. IF `tiendaId` está ausente, no es una cadena de texto o queda vacía tras eliminar espacios, THEN THE BFF_POS SHALL responder 400 con un ErrorRespuestaPos de `code` `SOLICITUD_INVALIDA` sin invocar al Core.
7. IF el cuerpo de la petición no es un JSON bien formado o no es un objeto, THEN THE BFF_POS SHALL responder 400 con un ErrorRespuestaPos de `code` `SOLICITUD_INVALIDA` sin invocar al Core.
8. WHEN el BFF_POS rechaza una solicitud por validación, THE ErrorRespuestaPos SHALL incluir un `message` que identifique el campo inválido en lenguaje comprensible para el cajero.

### Requisito 2: Traducción de la decisión a un resultado simplificado para caja

**Historia de Usuario:** Como cajero de tienda, quiero recibir solo la información necesaria para comunicar el resultado al cliente, para atenderlo rápido y sin exponer detalles internos de la evaluación. (RF-02)

#### Criterios de Aceptación

1. WHEN el Core responde 200 con una DecisionCore válida, THE BFF_POS SHALL responder 200 con un ResultadoPos que contiene exactamente los campos `idEvaluacion`, `aprobado` y `mensajeParaCliente`.
2. THE campo `idEvaluacion` del ResultadoPos SHALL ser igual al `idEvaluacion` de la DecisionCore recibida.
3. THE campo `aprobado` del ResultadoPos SHALL ser verdadero si y solo si la `decision` de la DecisionCore es `APROBADO`.
4. THE ResultadoPos SHALL NOT incluir `motivo`, `reglasAplicadas`, `consultaBuroRealizada` ni ningún otro campo de la DecisionCore distinto de `idEvaluacion`.
5. IF el Core responde 200 con un cuerpo cuyo `idEvaluacion` no es una cadena no vacía o cuya `decision` no pertenece a {`APROBADO`, `RECHAZADO`, `REVISION_MANUAL`}, THEN THE BFF_POS SHALL responder con un ErrorRespuestaPos de `code` `ERROR_EVALUACION` en lugar de construir un ResultadoPos con valores por defecto.

### Requisito 3: Generación del mensaje para el cliente

**Historia de Usuario:** Como cajero de tienda, quiero un mensaje corto y humano según la decisión, para comunicar el resultado al cliente de forma clara y consistente en todas las tiendas. (RF-03)

#### Criterios de Aceptación

1. WHEN la `decision` de la DecisionCore es `APROBADO`, THE BFF_POS SHALL asignar como `mensajeParaCliente` el texto "Crédito aprobado".
2. WHEN la `decision` de la DecisionCore es `REVISION_MANUAL`, THE BFF_POS SHALL asignar como `mensajeParaCliente` el texto "En revisión, te contactaremos".
3. WHEN la `decision` de la DecisionCore es `RECHAZADO`, THE BFF_POS SHALL asignar como `mensajeParaCliente` el texto "Crédito no aprobado en esta ocasión".
4. THE `mensajeParaCliente` SHALL depender únicamente de la `decision` y SHALL NOT incluir el `motivo` de la DecisionCore, que puede contener información sensible del cliente (mora, score, ingresos).

### Requisito 4: Reconsulta de estado con caché de resultados

**Historia de Usuario:** Como cajero de tienda, quiero volver a consultar el resultado de una evaluación (por ejemplo, al reabrir la pantalla) sin esperar ni recargar el motor de evaluación, para atender al cliente sin demoras. (RF-04)

#### Criterios de Aceptación

1. WHEN el BFF_POS construye un ResultadoPos a partir de una respuesta exitosa de `POST /evaluar`, THE BFF_POS SHALL almacenarlo en el Cache_Resultados asociado a su `idEvaluacion`.
2. WHEN el BFF_POS recibe `GET /evaluaciones-credito/{id}` y el Cache_Resultados contiene una entrada vigente para `id`, THE BFF_POS SHALL responder 200 con ese ResultadoPos sin invocar al Core.
3. WHEN el BFF_POS recibe `GET /evaluaciones-credito/{id}` y el Cache_Resultados no contiene una entrada vigente para `id`, THE BFF_POS SHALL invocar al Core en `GET /evaluaciones/{id}`, traducir la DecisionCore recibida a ResultadoPos según los Requisitos 2 y 3, almacenarlo en el Cache_Resultados y responder 200 con él.
4. IF el `id` recibido en `GET /evaluaciones-credito/{id}` no tiene formato UUID, THEN THE BFF_POS SHALL responder 400 con un ErrorRespuestaPos de `code` `ID_EVALUACION_INVALIDO` sin consultar el Cache_Resultados ni invocar al Core.
5. IF el Core responde 404 a `GET /evaluaciones/{id}`, THEN THE BFF_POS SHALL responder 404 con un ErrorRespuestaPos de `code` `EVALUACION_NO_ENCONTRADA`.
6. WHILE una entrada del Cache_Resultados supera el tiempo de vida configurado (`CACHE_TTL_MS`, por defecto 900000 ms), THE BFF_POS SHALL tratarla como inexistente.
7. WHEN el Cache_Resultados alcanza la capacidad máxima configurada (`CACHE_MAX_ENTRADAS`, por defecto 1000) y se almacena una entrada nueva, THE BFF_POS SHALL descartar la entrada usada menos recientemente.
8. THE Cache_Resultados SHALL almacenar únicamente ResultadoPos construidos a partir de respuestas exitosas del Core y SHALL NOT almacenar errores.

### Requisito 5: Propagación comprensible de errores del core

**Historia de Usuario:** Como cajero de tienda, quiero que cualquier falla del motor de evaluación se muestre como un mensaje claro que indique si puedo reintentar, para no quedarme bloqueado ante un error técnico. (RF-05)

#### Criterios de Aceptación

1. IF el Core no responde dentro del Timeout_Core (`CORE_TIMEOUT_MS`, por defecto 5000 ms), THEN THE BFF_POS SHALL responder 504 con un ErrorRespuestaPos de `code` `EVALUACION_TIMEOUT` y `reintentable` igual a verdadero.
2. IF el Core no es alcanzable (conexión rechazada, host no resuelto o conexión reiniciada), THEN THE BFF_POS SHALL responder 503 con un ErrorRespuestaPos de `code` `SERVICIO_NO_DISPONIBLE` y `reintentable` igual a verdadero.
3. IF el Core responde con un estado 5xx o con una DecisionCore inválida según el Requisito 2 criterio 5, THEN THE BFF_POS SHALL responder 502 con un ErrorRespuestaPos de `code` `ERROR_EVALUACION` y `reintentable` igual a verdadero.
4. IF el Core responde 400 a `POST /evaluar`, THEN THE BFF_POS SHALL responder 400 con un ErrorRespuestaPos de `code` `SOLICITUD_INVALIDA` y `reintentable` igual a falso; si el `code` del Core es `INVALID_IDENTIFICACION`, el `message` SHALL indicar que la identificación ingresada no es válida.
5. THE ErrorRespuestaPos SHALL contener únicamente el objeto `error` con los campos `code`, `message` y `reintentable`, y SHALL NOT incluir el cuerpo de la respuesta del Core, trazas de pila, URLs internas ni mensajes técnicos de la librería HTTP.
6. IF ocurre un error no previsto dentro del BFF_POS, THEN THE BFF_POS SHALL responder 500 con un ErrorRespuestaPos de `code` `ERROR_INTERNO` y registrar el detalle técnico únicamente en el log del servicio.
7. THE BFF_POS SHALL NOT reintentar automáticamente `POST /evaluar` ante un fallo del Core, dado que la evaluación no es idempotente y un reintento podría generar evaluaciones y registros de auditoría duplicados.
