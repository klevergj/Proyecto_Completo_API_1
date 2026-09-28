# Requirements Document

## Introduction

Esta funcionalidad implementa la lógica real del **Servicio de Auditoría** (`auditoria`, puerto 8095) dentro del sistema **Resuelve Crédito**. El servicio registra de forma inmutable cada decisión emitida por el Servicio de Evaluación (core) y la expone, filtrada y paginada, al BFF Auditoría para el panel interno de analistas y auditores.

Hoy el servicio tiene la estructura por capas del steering, pero su lógica es un placeholder:

1. **No persiste.** Los registros se guardan en un arreglo en memoria (`memoriaRegistroAuditoriaRepository`) y se pierden al reiniciar, aunque el steering (`tech.md`) exige MongoDB para `auditoria`. Además, la conexión existente (`db/connection.js`) trae como valor por defecto una cadena de conexión de Atlas con usuario y contraseña reales.
2. **No valida.** Acepta cualquier cuerpo en `POST /registros` y lo guarda tal cual, incluidos campos arbitrarios.
3. **No cumple el contrato Spec 7.** Filtra por `decision` en lugar de `estado`, pagina desde 1 (el contrato define `page` con base 0), responde `{ total, pagina, limite, datos }` en lugar de `{ total, page, items }` e ignora `fechaDesde` y `fechaHasta`.
4. **No cubre los RF.** No filtra por tienda (RF-02), no ofrece la consulta de un registro individual que necesita el detalle del BFF (RF-03) y no limita el tamaño de página (RF-04).

El servicio recibe un `POST /registros` del core por **cada** evaluación. El core lo invoca de forma no bloqueante (fire-and-forget) con un timeout de 3000 ms, así que la escritura debe ser rápida y nunca afectar la respuesta de crédito. Los KPIs del sistema (p95 < 500 ms, error < 1% bajo 100-500 usuarios concurrentes) implican que el volumen de registros crece con cada venta: las consultas deben apoyarse en índices y la paginación es obligatoria.

Contratos de referencia (fuente de verdad): `contracts/spec7-auditoria.yaml` (interfaz expuesta; se actualiza primero, steering `tech.md`), consumido por `evaluacion-core` (`clients/auditoriaPublisher.js`, escritura) y `bff-auditoria` (lectura).

## Glossary

- **Servicio_Auditoria**: El servicio `auditoria` descrito en este documento.
- **Core**: El Servicio de Evaluación (`evaluacion-core`), que publica un RegistroAuditoria tras cada decisión.
- **BFF_Auditoria**: El servicio `bff-auditoria`, único consumidor de lectura del Servicio_Auditoria.
- **RegistroAuditoria**: Evento de auditoría de una decisión (Spec 7): `idEvaluacion` (uuid), `identificacion`, `montoSolicitado`, `plazoMeses`, `tiendaId`, `decision` (`APROBADO` | `RECHAZADO` | `REVISION_MANUAL`), `motivo`, `fecha` (date-time de la decisión), `consultaBuroRealizada` (boolean), `scoreBuro` (entero o null) y `reglasAplicadas` (lista de nombres de reglas).
- **Registro_Almacenado**: RegistroAuditoria persistido más el metadato `registradoEn` (instante en que el Servicio_Auditoria lo guardó).
- **Almacen_Auditoria**: La colección `registros_auditoria` de MongoDB (steering `tech.md`).
- **Filtros_Listado**: `estado`, `fechaDesde`, `fechaHasta` y `tiendaId`, todos opcionales y combinables.
- **Pagina**: Respuesta del listado: `total` (registros que cumplen los filtros), `page` (índice base 0), `size` (tamaño aplicado) e `items` (registros de la página).
- **Tamano_Pagina_Defecto**: Tamaño de página aplicado cuando no se envía `size` (`PAGINA_TAMANO_DEFECTO`, por defecto 20).
- **Tamano_Pagina_Maximo**: Tamaño máximo aceptado para `size` (`PAGINA_TAMANO_MAXIMO`, por defecto 100).
- **ErrorRespuesta**: Cuerpo de error `{ error: { code, message } }`, sin detalles técnicos.

## Requirements

### Requisito 1: Registro de cada decisión del core

**Historia de Usuario:** Como área de auditoría, quiero que cada decisión emitida por el core quede registrada con la información de cómo se decidió, para trazar el razonamiento y auditar el indicador de resolución sin buró. (RF-01)

#### Criterios de Aceptación

1. WHEN el Servicio_Auditoria recibe `POST /registros` con un RegistroAuditoria válido, THE Servicio_Auditoria SHALL persistirlo en el Almacen_Auditoria y responder 201 con el Registro_Almacenado.
2. THE Registro_Almacenado SHALL conservar `consultaBuroRealizada` y `reglasAplicadas` exactamente como los envió el Core, en el mismo orden.
3. THE Servicio_Auditoria SHALL almacenar únicamente los campos del RegistroAuditoria definidos en Spec 7 y SHALL descartar cualquier otro campo recibido.
4. IF `idEvaluacion` no es un UUID, `decision` no pertenece a {`APROBADO`, `RECHAZADO`, `REVISION_MANUAL`}, `fecha` no es una fecha-hora ISO 8601 válida, `consultaBuroRealizada` no es booleano o `reglasAplicadas` no es una lista de cadenas, THEN THE Servicio_Auditoria SHALL responder 400 con un ErrorRespuesta de `code` `REGISTRO_INVALIDO` sin persistir nada.
5. IF alguno de los campos opcionales (`identificacion`, `montoSolicitado`, `plazoMeses`, `tiendaId`, `motivo`, `scoreBuro`) está presente con un tipo distinto del definido en Spec 7, THEN THE Servicio_Auditoria SHALL responder 400 con un ErrorRespuesta de `code` `REGISTRO_INVALIDO` sin persistir nada.
6. IF ya existe un Registro_Almacenado con el mismo `idEvaluacion`, THEN THE Servicio_Auditoria SHALL responder 409 con un ErrorRespuesta de `code` `REGISTRO_DUPLICADO` y SHALL NOT modificar el registro existente.
7. THE Servicio_Auditoria SHALL NOT exponer operaciones de modificación ni borrado de registros (registro inmutable).

### Requisito 2: Listado con filtros

**Historia de Usuario:** Como analista de auditoría, quiero listar las evaluaciones por estado, rango de fechas y tienda, para revisar el comportamiento del motor en un periodo o punto de venta concreto. (RF-02)

#### Criterios de Aceptación

1. WHEN el Servicio_Auditoria recibe `GET /registros`, THE Servicio_Auditoria SHALL responder 200 con una Pagina que contiene solo los Registro_Almacenado que cumplen todos los Filtros_Listado recibidos.
2. WHEN se recibe `estado`, THE Servicio_Auditoria SHALL incluir solo registros cuya `decision` es igual a `estado`.
3. WHEN se recibe `fechaDesde` (fecha `YYYY-MM-DD`), THE Servicio_Auditoria SHALL incluir solo registros cuya `fecha` es igual o posterior al inicio de ese día en UTC.
4. WHEN se recibe `fechaHasta` (fecha `YYYY-MM-DD`), THE Servicio_Auditoria SHALL incluir solo registros cuya `fecha` es anterior al inicio del día siguiente en UTC (el día `fechaHasta` queda incluido).
5. WHEN se recibe `tiendaId`, THE Servicio_Auditoria SHALL incluir solo registros cuyo `tiendaId` es igual al recibido.
6. THE Servicio_Auditoria SHALL ordenar los `items` por `fecha` descendente y, ante igual `fecha`, por `idEvaluacion` ascendente, para que la paginación sea estable.
7. IF `estado` no pertenece al conjunto de decisiones, `fechaDesde` o `fechaHasta` no son fechas `YYYY-MM-DD` válidas, o `fechaDesde` es posterior a `fechaHasta`, THEN THE Servicio_Auditoria SHALL responder 400 con un ErrorRespuesta de `code` `PARAMETRO_INVALIDO` sin consultar el Almacen_Auditoria.

### Requisito 3: Consulta de un registro individual

**Historia de Usuario:** Como BFF Auditoría, quiero obtener el registro completo de una evaluación por su identificador, para construir el detalle que ve el analista. (Soporte a RF-03)

#### Criterios de Aceptación

1. WHEN el Servicio_Auditoria recibe `GET /registros/{idEvaluacion}` con un `idEvaluacion` existente, THE Servicio_Auditoria SHALL responder 200 con el Registro_Almacenado completo.
2. IF no existe un Registro_Almacenado con ese `idEvaluacion`, THEN THE Servicio_Auditoria SHALL responder 404 con un ErrorRespuesta de `code` `REGISTRO_NO_ENCONTRADO`.
3. IF `idEvaluacion` no es un UUID, THEN THE Servicio_Auditoria SHALL responder 400 con un ErrorRespuesta de `code` `PARAMETRO_INVALIDO` sin consultar el Almacen_Auditoria.

### Requisito 4: Paginación obligatoria y acotada

**Historia de Usuario:** Como equipo de operación, quiero que el listado siempre pagine con un tamaño acotado, para que el volumen creciente de registros nunca genere respuestas sobrecargadas ni consultas costosas. (RF-04)

#### Criterios de Aceptación

1. THE Servicio_Auditoria SHALL devolver en cada respuesta de listado a lo sumo `size` registros en `items`, junto con `total`, `page` y `size`.
2. WHEN no se recibe `page`, THE Servicio_Auditoria SHALL usar `page` 0 (primera página, base 0).
3. WHEN no se recibe `size`, THE Servicio_Auditoria SHALL usar el Tamano_Pagina_Defecto.
4. IF `page` no es un entero mayor o igual que 0, o `size` no es un entero entre 1 y el Tamano_Pagina_Maximo, THEN THE Servicio_Auditoria SHALL responder 400 con un ErrorRespuesta de `code` `PARAMETRO_INVALIDO`.
5. THE Tamano_Pagina_Defecto y el Tamano_Pagina_Maximo SHALL obtenerse de la configuración del servicio; IF el valor configurado no es un entero mayor que 0 o el defecto supera al máximo, THEN THE Servicio_Auditoria SHALL usar los valores por defecto (20 y 100) y registrar una advertencia.
6. WHEN `page` apunta más allá del último registro, THE Servicio_Auditoria SHALL responder 200 con `items` vacío y el `total` real.

### Requisito 5: Persistencia, rendimiento y manejo de errores

**Historia de Usuario:** Como equipo de operación, quiero que el servicio persista de forma segura y responda rápido o falle con un error claro, para no afectar al core ni exponer detalles internos.

#### Criterios de Aceptación

1. THE Servicio_Auditoria SHALL persistir los registros en MongoDB y SHALL obtener la cadena de conexión y el nombre de la base únicamente de variables de entorno (`MONGO_URI`, `DB_NAME`), sin credenciales en el código fuente.
2. THE Almacen_Auditoria SHALL tener un índice único sobre `idEvaluacion` e índices que soporten el orden por `fecha` descendente combinado con los filtros `decision` y `tiendaId`.
3. WHEN el Servicio_Auditoria arranca, THE Servicio_Auditoria SHALL crear los índices si no existen, reintentando un número configurable de veces (`DB_INIT_REINTENTOS`, por defecto 10, con `DB_INIT_ESPERA_MS`, por defecto 2000 ms, entre intentos) y SHALL terminar con código distinto de cero si se agotan.
4. IF MongoDB no está disponible o no responde en `MONGO_TIMEOUT_MS` (por defecto 2000 ms), THEN THE Servicio_Auditoria SHALL responder 503 con un ErrorRespuesta de `code` `ALMACEN_NO_DISPONIBLE`.
5. IF ocurre un error no previsto, THEN THE Servicio_Auditoria SHALL responder 500 con un ErrorRespuesta de `code` `ERROR_INTERNO` y registrar el detalle técnico solo en el log.
6. THE ErrorRespuesta SHALL contener únicamente `error.code` y `error.message`, y SHALL NOT incluir mensajes del driver, cadenas de conexión, hosts ni trazas de pila.
7. WHEN el Servicio_Auditoria recibe `GET /health`, THE Servicio_Auditoria SHALL responder 200 con `status`, `service`, `timestamp` y el estado del almacén (`UP` o `DOWN`).
