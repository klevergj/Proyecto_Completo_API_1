# Requirements Document

## Introduction

Esta funcionalidad implementa la lógica real del **BFF Auditoría** (`bff-auditoria`, puerto 8082) dentro del sistema **Resuelve Crédito**. El BFF adapta el Servicio de Auditoría (Spec 7) a las necesidades del panel interno de analistas y auditores: listado filtrado y paginado de evaluaciones, y detalle completo de una evaluación con los datos que el Frontend Tiendas nunca ve (score del buró, reglas aplicadas, consulta al buró).

Hoy el servicio tiene la estructura por capas del steering, pero su lógica es un passthrough:

1. **No cumple el contrato Spec 3.** Recibe `decision`, `page` desde 1 y `limit`, en lugar de `estado`, `page` con base 0 y `size`. No acepta `tiendaId` y devuelve la respuesta del Servicio de Auditoría sin adaptar.
2. **No existe el detalle.** `GET /evaluaciones/{id}/detalle` (Spec 3, RF-03) no está implementado.
3. **No valida ni acota.** Reenvía cualquier parámetro y no limita el tamaño de página (RF-04).
4. **Filtra errores.** El manejador de errores devuelve `err.message` de axios y `err.response.data` del servicio aguas abajo.

El BFF está detrás del API Gateway (`/auditoria/*` → `bff-auditoria`, sin el prefijo). Según el steering (`tech.md`), un BFF no contiene lógica de negocio: valida la forma de la entrada, delega en el Servicio de Auditoría y adapta la respuesta al panel.

Contratos de referencia (fuente de verdad): `contracts/spec3-bff-auditoria.yaml` (interfaz expuesta; se actualiza primero, steering `tech.md`) y `contracts/spec7-auditoria.yaml` (dependencia, actualizado en la feature `servicio-auditoria`).

## Glossary

- **BFF_Auditoria**: El servicio `bff-auditoria` descrito en este documento.
- **Servicio_Auditoria**: El servicio `auditoria` (Spec 7): `GET /registros` (listado paginado) y `GET /registros/{idEvaluacion}` (registro individual).
- **Panel_Auditoria**: Frontend interno de analistas y auditores que consume el BFF_Auditoria a través del Gateway.
- **ResumenAuditoria**: Elemento del listado para el Panel_Auditoria: `idEvaluacion`, `fecha`, `decision`, `tiendaId` y `consultaBuroRealizada`.
- **DetalleAuditoria**: Vista completa de una evaluación para un analista: los campos del ResumenAuditoria más `identificacion`, `montoSolicitado`, `plazoMeses`, `motivo`, `scoreBuro`, `reglasAplicadas` y `registradoEn`.
- **Filtros_Listado**: `estado`, `fechaDesde`, `fechaHasta` y `tiendaId`, opcionales y combinables.
- **PaginaResumenAuditoria**: Respuesta del listado: `total`, `page` (base 0), `size`, `totalPaginas` e `items` (ResumenAuditoria).
- **Tamano_Pagina_Defecto** / **Tamano_Pagina_Maximo**: Tamaño aplicado sin `size` (`PAGINA_TAMANO_DEFECTO`, por defecto 20) y máximo aceptado (`PAGINA_TAMANO_MAXIMO`, por defecto 100).
- **ErrorRespuestaAuditoria**: Cuerpo de error `{ error: { code, message, reintentable } }`, sin detalles técnicos (misma convención que el BFF Punto de Venta).
- **Timeout_Auditoria**: Tiempo máximo que el BFF_Auditoria espera al Servicio_Auditoria (`AUDITORIA_TIMEOUT_MS`, por defecto 3000 ms).

## Requirements

### Requisito 1: Listado filtrado de evaluaciones

**Historia de Usuario:** Como analista de auditoría, quiero listar evaluaciones por estado, rango de fechas y tienda, para revisar el comportamiento del motor en un periodo o punto de venta. (RF-02)

#### Criterios de Aceptación

1. WHEN el BFF_Auditoria recibe `GET /evaluaciones` con parámetros válidos, THE BFF_Auditoria SHALL invocar una sola vez `GET /registros` del Servicio_Auditoria con los mismos Filtros_Listado, `page` y `size`, y responder 200 con una PaginaResumenAuditoria.
2. THE BFF_Auditoria SHALL enviar al Servicio_Auditoria únicamente los parámetros `estado`, `fechaDesde`, `fechaHasta`, `tiendaId`, `page` y `size` que tengan valor, y SHALL descartar cualquier otro parámetro recibido.
3. IF `estado` no pertenece a {`APROBADO`, `RECHAZADO`, `REVISION_MANUAL`}, `fechaDesde` o `fechaHasta` no son fechas `YYYY-MM-DD` válidas, o `fechaDesde` es posterior a `fechaHasta`, THEN THE BFF_Auditoria SHALL responder 400 con un ErrorRespuestaAuditoria de `code` `PARAMETRO_INVALIDO` sin invocar al Servicio_Auditoria.
4. THE `items` de la PaginaResumenAuditoria SHALL contener exactamente los campos del ResumenAuditoria, en el mismo orden en que los entregó el Servicio_Auditoria.

### Requisito 2: Paginación obligatoria y acotada

**Historia de Usuario:** Como equipo de operación, quiero que el listado del panel siempre pagine con un tamaño acotado y liviano, para evitar payloads sobrecargados. (RF-04)

#### Criterios de Aceptación

1. WHEN no se recibe `page`, THE BFF_Auditoria SHALL usar `page` 0; WHEN no se recibe `size`, SHALL usar el Tamano_Pagina_Defecto.
2. IF `page` no es un entero mayor o igual que 0, o `size` no es un entero entre 1 y el Tamano_Pagina_Maximo, THEN THE BFF_Auditoria SHALL responder 400 con un ErrorRespuestaAuditoria de `code` `PARAMETRO_INVALIDO` sin invocar al Servicio_Auditoria.
3. THE PaginaResumenAuditoria SHALL incluir `total`, `page`, `size` y `totalPaginas`, este último calculado como el entero superior de `total / size` (0 si `total` es 0).
4. THE listado SHALL devolver ResumenAuditoria y SHALL NOT incluir `motivo`, `reglasAplicadas`, `scoreBuro` ni `identificacion`, que solo se exponen en el DetalleAuditoria.
5. THE Tamano_Pagina_Defecto y el Tamano_Pagina_Maximo SHALL obtenerse de la configuración; IF el valor configurado no es un entero mayor que 0 o el defecto supera al máximo, THEN THE BFF_Auditoria SHALL usar 20 y 100 y registrar una advertencia.

### Requisito 3: Detalle completo de una evaluación para el analista

**Historia de Usuario:** Como analista de auditoría, quiero ver el detalle completo de una evaluación, incluidos el score del buró, las reglas aplicadas y si se consultó el buró, para entender por qué se tomó la decisión. (RF-03)

#### Criterios de Aceptación

1. WHEN el BFF_Auditoria recibe `GET /evaluaciones/{id}/detalle` con un `id` existente, THE BFF_Auditoria SHALL invocar `GET /registros/{id}` del Servicio_Auditoria y responder 200 con un DetalleAuditoria.
2. THE DetalleAuditoria SHALL incluir `consultaBuroRealizada`, `scoreBuro` (entero o null) y `reglasAplicadas` en el mismo orden registrado, además de `idEvaluacion`, `fecha`, `decision`, `motivo`, `tiendaId`, `identificacion`, `montoSolicitado`, `plazoMeses` y `registradoEn`.
3. WHEN un campo opcional no fue registrado, THE DetalleAuditoria SHALL incluirlo con valor `null`, de modo que el Panel_Auditoria reciba siempre la misma forma.
4. IF `id` no es un UUID, THEN THE BFF_Auditoria SHALL responder 400 con un ErrorRespuestaAuditoria de `code` `PARAMETRO_INVALIDO` sin invocar al Servicio_Auditoria.
5. IF el Servicio_Auditoria responde 404, THEN THE BFF_Auditoria SHALL responder 404 con un ErrorRespuestaAuditoria de `code` `EVALUACION_NO_ENCONTRADA`.

### Requisito 4: Errores comprensibles y sin filtraciones

**Historia de Usuario:** Como analista, quiero que cualquier falla del servicio de auditoría se muestre como un mensaje claro que indique si puedo reintentar, para no quedarme bloqueado ante un error técnico.

#### Criterios de Aceptación

1. IF el Servicio_Auditoria no responde dentro del Timeout_Auditoria, THEN THE BFF_Auditoria SHALL responder 504 con un ErrorRespuestaAuditoria de `code` `AUDITORIA_TIMEOUT` y `reintentable` verdadero.
2. IF el Servicio_Auditoria no es alcanzable o responde 503, THEN THE BFF_Auditoria SHALL responder 503 con un ErrorRespuestaAuditoria de `code` `SERVICIO_NO_DISPONIBLE` y `reintentable` verdadero.
3. IF el Servicio_Auditoria responde con otro 5xx o con un cuerpo que no cumple Spec 7, THEN THE BFF_Auditoria SHALL responder 502 con un ErrorRespuestaAuditoria de `code` `ERROR_AUDITORIA` y `reintentable` verdadero.
4. IF el Servicio_Auditoria responde 400, THEN THE BFF_Auditoria SHALL responder 400 con un ErrorRespuestaAuditoria de `code` `PARAMETRO_INVALIDO` y `reintentable` falso.
5. THE ErrorRespuestaAuditoria SHALL contener únicamente `error.code`, `error.message` y `error.reintentable`, y SHALL NOT incluir el cuerpo de la respuesta del Servicio_Auditoria, mensajes de axios, URLs internas ni trazas de pila.
6. IF ocurre un error no previsto, THEN THE BFF_Auditoria SHALL responder 500 con un ErrorRespuestaAuditoria de `code` `ERROR_INTERNO` y registrar el detalle solo en el log.
