# Requirements Document

## Introduction

Esta funcionalidad implementa la lógica real del **Repositorio Interno de Clientes** (`repositorio-interno`, puerto 8092) dentro del sistema **Resuelve Crédito**. El servicio expone el historial interno de un cliente (mora vigente, créditos previos, ingresos declarados y antigüedad) a partir de su identificación, desacoplando al Servicio de Evaluación (core, Spec 4) del esquema real de la base de datos PostgreSQL.

Hoy el servicio es un esqueleto con cuatro defectos que impiden al core aplicar sus reglas internas:

1. **No usa la base de datos.** La ruta busca en un arreglo en memoria (`CLIENTES_SEED`) y el script `seed.js` no inserta nada en PostgreSQL.
2. **El cliente nuevo no es nuevo.** La identificación de demostración del cliente nuevo (`1730000003`) está en el arreglo, así que responde 200 en lugar de 404. El core nunca puede ejercitar la Regla_Cliente_Nuevo.
3. **La respuesta no cumple el contrato Spec 6.** Faltan `creditosPrevios`, `ingresosDeclarados` y `antiguedadMeses`, este último usado por la Regla_Capacidad_Pago del core. Además sobran campos con datos personales o internos (`nombres`, `saldoPendiente`, `calificacionInterna`).
4. **Filtración de errores.** El manejador de errores devuelve `err.message`, que en fallos de base de datos puede contener detalles del esquema o de la conexión.

El servicio está en el camino crítico de **cada** evaluación: el core lo consulta antes de cualquier regla y propaga como error 5xx cualquier fallo distinto de 404. Por eso rige los KPIs del sistema: el 95% de las solicitudes debe resolverse en menos de 3 segundos, la latencia p95 debe mantenerse por debajo de 500 ms bajo carga sostenida y la tasa de error debe ser menor al 1%. El adaptador del core espera como máximo 4000 ms.

Contrato de referencia (fuente de verdad): `contracts/spec6-repositorio-interno.yaml` (interfaz expuesta), consumido por `services/evaluacion-core/src/repositories/httpHistorialClienteRepository.js`.

## Glossary

- **Repositorio_Interno**: El servicio `repositorio-interno` descrito en este documento.
- **Core**: El Servicio de Evaluación de Crédito (`evaluacion-core`), único consumidor del Repositorio_Interno. Interpreta un 404 como cliente nuevo y cualquier otro error como fallo no recuperable.
- **Base_Datos**: La instancia PostgreSQL (`postgres:16-alpine`, base `resuelve_db`) que almacena el historial.
- **HistorialCliente**: Respuesta del Repositorio_Interno según Spec 6, con exactamente los campos `identificacion` (string), `tieneMoraVigente` (boolean), `creditosPrevios` (integer ≥ 0), `ingresosDeclarados` (number > 0 o null) y `antiguedadMeses` (integer ≥ 0).
- **Registro_Historial**: Fila de la tabla `clientes_historial` en la Base_Datos.
- **Fecha_Primer_Registro**: Fecha en que el cliente se registró por primera vez en Resuelve. Es el dato persistido del que se deriva `antiguedadMeses`.
- **Cliente_Nuevo**: Cliente sin Registro_Historial en la Base_Datos.
- **Datos_Semilla**: Conjunto fijo de Registro_Historial de demostración cargado por el proceso de siembra.
- **Proceso_Siembra**: Rutina que crea el esquema de la Base_Datos si no existe y carga los Datos_Semilla. Se ejecuta con `npm run seed` o al arrancar el servicio.
- **ErrorRespuesta**: Cuerpo de error del Repositorio_Interno: objeto `error` con `code` (string estable) y `message` (texto sin detalles técnicos), igual a la convención de `evaluacion-core` y `buro-simulado`.

## Requirements

### Requisito 1: Consulta del historial interno de un cliente

**Historia de Usuario:** Como Servicio de Evaluación, quiero obtener el historial interno de un cliente a partir de su identificación, para aplicar las reglas de mora vigente y capacidad de pago sin consultar el buró externo. (RF-01)

#### Criterios de Aceptación

1. WHEN el Repositorio_Interno recibe `GET /clientes/{identificacion}/historial` para una identificación con Registro_Historial en la Base_Datos, THE Repositorio_Interno SHALL responder 200 con un HistorialCliente leído de la Base_Datos.
2. THE HistorialCliente SHALL contener exactamente los campos `identificacion`, `tieneMoraVigente`, `creditosPrevios`, `ingresosDeclarados` y `antiguedadMeses`, y SHALL NOT incluir nombres, saldos, calificaciones internas ni ningún otro dato del Registro_Historial.
3. THE campo `ingresosDeclarados` SHALL ser un número mayor que cero cuando el Registro_Historial tiene ingreso declarado, y `null` cuando no lo tiene; SHALL NOT representarse como cadena de texto.
4. THE campo `antiguedadMeses` SHALL calcularse al momento de la consulta como el número de meses completos transcurridos entre la Fecha_Primer_Registro y la fecha actual, con valor mínimo 0.
5. IF la `identificacion` recibida, tras eliminar espacios al inicio y al final, está vacía, tiene más de 20 caracteres o contiene caracteres distintos de letras, dígitos y guion, THEN THE Repositorio_Interno SHALL responder 400 con un ErrorRespuesta de `code` `IDENTIFICACION_INVALIDA` sin consultar la Base_Datos.
6. THE Repositorio_Interno SHALL consultar la Base_Datos mediante una sentencia parametrizada por clave primaria, sin interpolar la `identificacion` en el texto SQL.

### Requisito 2: Respuesta 404 para cliente sin historial

**Historia de Usuario:** Como Servicio de Evaluación, quiero distinguir inequívocamente a un cliente nuevo de un fallo del repositorio, para derivarlo a la regla de cliente nuevo en lugar de abortar la evaluación. (RF-02)

#### Criterios de Aceptación

1. WHEN el Repositorio_Interno recibe `GET /clientes/{identificacion}/historial` con una identificación válida sin Registro_Historial en la Base_Datos, THE Repositorio_Interno SHALL responder 404 con un ErrorRespuesta de `code` `CLIENTE_NO_ENCONTRADO`.
2. THE Repositorio_Interno SHALL NOT responder 200 con un objeto vacío, con campos nulos ni con valores por defecto para un Cliente_Nuevo.
3. THE ErrorRespuesta de 404 SHALL NOT incluir la `identificacion` consultada.
4. THE Repositorio_Interno SHALL reservar el estado 404 exclusivamente para el caso de Cliente_Nuevo, de modo que un fallo de la Base_Datos nunca se confunda con un cliente sin historial.

### Requisito 3: Datos semilla de demostración

**Historia de Usuario:** Como equipo de producto, quiero datos de demostración que cubran los casos de historial interno, para mostrar de forma reproducible las reglas del motor que dependen del repositorio. (RF-03)

#### Criterios de Aceptación

1. THE Datos_Semilla SHALL incluir un cliente con `tieneMoraVigente` verdadero (identificación `1710000001`) para demostrar la Regla_Mora_Vigente del Core.
2. THE Datos_Semilla SHALL incluir un cliente con buen historial (identificación `1720000002`): `tieneMoraVigente` falso, al menos un crédito previo e `ingresosDeclarados` mayor que cero, para demostrar la aprobación por monto bajo con historial limpio de la Regla_Capacidad_Pago del Core.
3. THE Proceso_Siembra SHALL garantizar que la identificación de demostración del Cliente_Nuevo (`1730000003`) no tenga Registro_Historial, eliminándolo si existiera, para demostrar la Regla_Cliente_Nuevo del Core.
4. THE Datos_Semilla SHALL incluir además un cliente sin mora y sin ingreso declarado (identificación `1740000004`) y un cliente sin mora con ingreso bajo (identificación `1750000005`), para demostrar la derivación a revisión manual por datos insuficientes y por relación cuota/ingreso de la Regla_Capacidad_Pago del Core.
5. THE Proceso_Siembra SHALL crear la tabla `clientes_historial` si no existe y SHALL ser idempotente: ejecutarlo una o varias veces SHALL dejar la Base_Datos en el mismo estado para las identificaciones de los Datos_Semilla.
6. WHERE la variable `SEED_AL_INICIAR` no es `false`, THE Repositorio_Interno SHALL ejecutar el Proceso_Siembra al arrancar, antes de aceptar peticiones.
7. IF la Base_Datos no está disponible al arrancar, THEN THE Repositorio_Interno SHALL reintentar el Proceso_Siembra un número configurable de veces (`DB_INIT_REINTENTOS`, por defecto 10) con espera entre intentos (`DB_INIT_ESPERA_MS`, por defecto 2000 ms), y SHALL terminar el proceso con código distinto de cero si se agotan los intentos.
8. THE Datos_Semilla SHALL NOT contener nombres ni otros datos personales más allá de la identificación de demostración.

### Requisito 4: Manejo de errores y latencia acotada

**Historia de Usuario:** Como Servicio de Evaluación, quiero que el repositorio responda rápido o falle rápido con un error claro, para no agotar mi presupuesto de latencia ni recibir detalles internos de la base de datos.

#### Criterios de Aceptación

1. IF la Base_Datos no es alcanzable o no concede una conexión dentro de `DB_CONEXION_TIMEOUT_MS` (por defecto 1500 ms), THEN THE Repositorio_Interno SHALL responder 503 con un ErrorRespuesta de `code` `REPOSITORIO_NO_DISPONIBLE`.
2. IF una consulta supera `DB_CONSULTA_TIMEOUT_MS` (por defecto 2000 ms), THEN THE Repositorio_Interno SHALL cancelarla y responder 503 con un ErrorRespuesta de `code` `REPOSITORIO_NO_DISPONIBLE`.
3. IF ocurre cualquier otro error no previsto, THEN THE Repositorio_Interno SHALL responder 500 con un ErrorRespuesta de `code` `ERROR_INTERNO` y registrar el detalle técnico únicamente en el log del servicio.
4. THE ErrorRespuesta SHALL contener únicamente el objeto `error` con los campos `code` y `message`, y SHALL NOT incluir mensajes del driver de base de datos, sentencias SQL, nombres de tablas, hosts ni trazas de pila.
5. THE suma de `DB_CONEXION_TIMEOUT_MS` y `DB_CONSULTA_TIMEOUT_MS` por defecto SHALL ser menor que el timeout de 4000 ms del adaptador del Core, para que el Core reciba una respuesta del Repositorio_Interno antes de abandonar la petición.
6. WHEN el Repositorio_Interno recibe `GET /health`, THE Repositorio_Interno SHALL responder 200 con `status`, `service`, `timestamp` y el estado de la Base_Datos (`UP` o `DOWN`), sin fallar cuando la Base_Datos no está disponible.
