# Requirements Document

## Introduction

Esta funcionalidad implementa la lógica real del motor de decisión crediticia dentro del servicio `evaluacion-core`. El servicio ya está estructurado por capas (dominio con reglas y motor tipo Chain of Responsibility, capa de aplicación con el caso de uso, infraestructura con adapters hacia buró externo y repositorio interno, y publicador de auditoría), pero todas las reglas de negocio devuelven actualmente valores nulos (placeholders).

El motor recibe una `SolicitudCore` (`identificacion`, `montoSolicitado`, `plazoMeses`, `tiendaId`), consulta el historial interno del cliente, ejecuta las reglas de negocio en cadena deteniéndose en la primera que emita un veredicto definitivo, y devuelve una `DecisionCore` con la decisión (`APROBADO`, `RECHAZADO` o `REVISION_MANUAL`), el motivo, las reglas aplicadas y si fue necesario consultar el buró externo. Cada decisión, exitosa o con fallo de dependencias, dispara un registro de auditoría.

El diseño está condicionado por indicadores de negocio no negociables: al menos 60% de las evaluaciones deben resolverse sin consultar el buró externo (las reglas internas se aplican primero y la cadena se detiene en la primera regla que decide), el 95% de las solicitudes debe resolverse en menos de 3 segundos, la latencia p95 debe mantenerse por debajo de 500 ms bajo carga sostenida, y la tasa de error debe mantenerse por debajo del 1% bajo carga sostenida.

## Glossary

- **Motor_Reglas**: Componente de dominio que recorre las reglas de decisión en cadena (Chain of Responsibility) y devuelve el veredicto de la primera regla que decide.
- **Regla_Mora_Vigente**: Estrategia que evalúa si el cliente registra mora vigente en el historial interno.
- **Regla_Cliente_Nuevo**: Estrategia que evalúa a clientes sin historial interno previo.
- **Regla_Score_Buro**: Estrategia que evalúa el score crediticio proveniente del buró externo.
- **Regla_Capacidad_Pago**: Estrategia que evalúa la relación entre la cuota estimada y el ingreso declarado del cliente.
- **Caso_Uso_Evaluacion**: Componente de la capa de aplicación (`evaluarCreditoUseCase`) que orquesta la obtención de historial, la consulta condicional al buró, la ejecución del Motor_Reglas y la publicación de auditoría.
- **Adapter_Buro_Externo**: Adaptador de infraestructura que consulta el score del buró externo mediante un Circuit Breaker con fallback a reglas internas.
- **Adapter_Repositorio_Interno**: Adaptador de infraestructura que obtiene el historial interno del cliente.
- **Publicador_Auditoria**: Componente de infraestructura (`auditoriaPublisher`) que envía el registro de cada decisión al servicio de auditoría.
- **Historial_Interno**: Datos del cliente provistos por el repositorio interno (`tieneMoraVigente`, `creditosPrevios`, `ingresosDeclarados`, `antiguedadMeses`). Ausencia de historial (respuesta 404) indica cliente nuevo.
- **Datos_Buro**: Datos del buró externo (`score` en rango 300-850, `moraExterna`, `deudaExternaTotal`). En fallback, `score` es nulo y `estadoBuro` es `INDISPONIBLE`.
- **Decision**: Veredicto del motor, uno de `APROBADO`, `RECHAZADO` o `REVISION_MANUAL`.
- **Umbral_Score_Minimo**: Valor configurable de score del buró por debajo del cual se rechaza automáticamente.
- **Umbral_Score_Bueno**: Valor configurable de score del buró a partir del cual el score se considera bueno para un cliente nuevo.
- **Porcentaje_Cuota_Ingreso**: Porcentaje configurable máximo tolerado de relación cuota mensual / ingreso mensual.
- **Modo_Cuota_Ingreso**: Configuración que determina si superar el `Porcentaje_Cuota_Ingreso` produce `RECHAZADO` o `REVISION_MANUAL`.
- **Tope_Monto_Aprobacion_Automatica**: Monto máximo configurable para aprobación automática de clientes con historial limpio.

## Requirements

### Requisito 1: Rechazo por score de buró bajo el umbral

**Historia de Usuario:** Como unidad de crédito, quiero rechazar automáticamente solicitudes cuyo score de buró externo esté por debajo del umbral mínimo, para evitar otorgar crédito a clientes de alto riesgo. (RF-01)

#### Criterios de Aceptación

1. WHEN el Motor_Reglas evalúa una solicitud con Datos_Buro cuyo `score` es un número dentro del rango válido de 300 a 850 y menor que Umbral_Score_Minimo, THE Regla_Score_Buro SHALL devolver una Decision `RECHAZADO`.
2. WHEN la Regla_Score_Buro devuelve `RECHAZADO` por score bajo el umbral, THE Regla_Score_Buro SHALL incluir en el resultado un motivo que indique que el `score` está por debajo del Umbral_Score_Minimo.
3. WHILE el `score` de Datos_Buro es un número dentro del rango válido de 300 a 850 y mayor o igual que Umbral_Score_Minimo, THE Regla_Score_Buro SHALL devolver un valor nulo para que el Motor_Reglas continúe la cadena.
4. IF el `score` de Datos_Buro es nulo, no es un número, o está fuera del rango válido de 300 a 850, THEN THE Regla_Score_Buro SHALL devolver un valor nulo para que el Motor_Reglas continúe la cadena sin emitir un `RECHAZADO` por esta regla.
5. WHEN la Regla_Score_Buro se ejecuta, THE Regla_Score_Buro SHALL obtener el Umbral_Score_Minimo desde la configuración del servicio como un número dentro del rango de 300 a 850.
6. IF el Umbral_Score_Minimo no está definido en la configuración del servicio o no es un número dentro del rango de 300 a 850, THEN THE Regla_Score_Buro SHALL devolver un valor nulo para que el Motor_Reglas continúe la cadena sin emitir un `RECHAZADO` por esta regla.

### Requisito 2: Rechazo por mora vigente sin consultar el buró

**Historia de Usuario:** Como unidad de crédito, quiero rechazar automáticamente a clientes con mora vigente en el repositorio interno sin consultar el buró externo, para reducir el costo variable por consulta y proteger el indicador de resolución sin buró. (RF-02)

#### Criterios de Aceptación

1. WHEN el Motor_Reglas evalúa una solicitud cuyo Historial_Interno tiene `tieneMoraVigente` igual a verdadero, THE Regla_Mora_Vigente SHALL devolver una Decision `RECHAZADO`.
2. WHEN la Regla_Mora_Vigente devuelve `RECHAZADO`, THE Regla_Mora_Vigente SHALL incluir un motivo que indique la existencia de mora vigente en el historial interno.
3. THE Motor_Reglas SHALL ejecutar la Regla_Mora_Vigente como primera regla de la cadena, antes que cualquier otra regla y antes de cualquier invocación al Adapter_Buro_Externo.
4. WHEN la Regla_Mora_Vigente devuelve `RECHAZADO`, THE Caso_Uso_Evaluacion SHALL finalizar la evaluación con cero (0) invocaciones al Adapter_Buro_Externo y registrar `consultaBuroRealizada` igual a falso.
5. WHILE el Historial_Interno tiene `tieneMoraVigente` igual a falso, THE Regla_Mora_Vigente SHALL devolver un valor nulo para que el Motor_Reglas continúe la cadena.
6. IF el Adapter_Buro_Externo no está disponible o excede su timeout, THEN THE Regla_Mora_Vigente SHALL determinar su Decision usando únicamente el Historial_Interno, sin verse afectada por el estado del buró externo.

### Requisito 3: Evaluación de la relación cuota/ingreso

**Historia de Usuario:** Como unidad de crédito, quiero evaluar la relación entre la cuota estimada y el ingreso declarado del cliente, para rechazar o derivar a revisión manual las solicitudes con capacidad de pago insuficiente. (RF-03)

#### Criterios de Aceptación

1. WHEN el Motor_Reglas evalúa una solicitud con `ingresosDeclarados` numérico mayor que cero en el Historial_Interno y `plazoMeses` numérico mayor que cero, THE Regla_Capacidad_Pago SHALL calcular la cuota mensual estimada como `montoSolicitado` dividido entre `plazoMeses`.
2. IF la relación entre la cuota mensual estimada y el `ingresosDeclarados` mensual es mayor que Porcentaje_Cuota_Ingreso, THEN THE Regla_Capacidad_Pago SHALL devolver una Decision determinada por Modo_Cuota_Ingreso, siendo `RECHAZADO` o `REVISION_MANUAL`.
3. WHILE la relación entre la cuota mensual estimada y el `ingresosDeclarados` mensual es menor o igual que Porcentaje_Cuota_Ingreso, THE Regla_Capacidad_Pago SHALL devolver un valor nulo para que el Motor_Reglas continúe la cadena.
4. IF el `ingresosDeclarados` del Historial_Interno es nulo o no es un número mayor que cero, THEN THE Regla_Capacidad_Pago SHALL devolver una Decision `REVISION_MANUAL` con un motivo que indique la ausencia de ingreso declarado.
5. IF el `plazoMeses` de la solicitud es nulo o no es un número mayor que cero, THEN THE Regla_Capacidad_Pago SHALL devolver una Decision `REVISION_MANUAL` con un motivo que indique un plazo inválido, sin calcular la cuota.
6. THE Porcentaje_Cuota_Ingreso y el Modo_Cuota_Ingreso SHALL obtenerse de la configuración del servicio.

### Requisito 4: Revisión manual para cliente nuevo con buen score

**Historia de Usuario:** Como unidad de crédito, quiero derivar a revisión manual a los clientes nuevos sin historial interno que presenten un buen score externo, para decidir con criterio humano en casos sin antecedentes internos. (RF-04)

#### Criterios de Aceptación

1. WHEN el Motor_Reglas evalúa una solicitud sin decisión previa cuyo Historial_Interno está ausente y cuyos Datos_Buro tienen un `score` numérico mayor o igual que Umbral_Score_Bueno, THE Regla_Cliente_Nuevo SHALL devolver una Decision `REVISION_MANUAL`.
2. WHEN la Regla_Cliente_Nuevo devuelve `REVISION_MANUAL` por buen score, THE Regla_Cliente_Nuevo SHALL incluir un motivo que indique que se trata de un cliente nuevo sin historial interno con buen score externo.
3. WHILE el Historial_Interno está presente, THE Regla_Cliente_Nuevo SHALL devolver un valor nulo para que el Motor_Reglas continúe la cadena.
4. WHEN el Historial_Interno está ausente y el `score` de Datos_Buro es nulo o el `estadoBuro` es `INDISPONIBLE`, THE Regla_Cliente_Nuevo SHALL devolver una Decision `REVISION_MANUAL` con un motivo que indique la indisponibilidad del buró externo para un cliente sin historial.
5. THE Umbral_Score_Bueno SHALL obtenerse de la configuración del servicio; IF no está definido o no es un número válido, THEN THE Regla_Cliente_Nuevo SHALL derivar a `REVISION_MANUAL` para clientes sin historial.

### Requisito 5: Aprobación automática por monto bajo con historial limpio

**Historia de Usuario:** Como unidad de crédito, quiero aprobar automáticamente solicitudes de monto bajo de clientes con historial limpio, para resolver en segundos los casos de bajo riesgo sin intervención humana. (RF-05)

#### Criterios de Aceptación

1. WHEN el Motor_Reglas evalúa una solicitud cuyo `montoSolicitado` es menor o igual que Tope_Monto_Aprobacion_Automatica y cuyo Historial_Interno está presente con `tieneMoraVigente` igual a falso y sin resolverse por reglas anteriores, THE Regla_Capacidad_Pago SHALL devolver una Decision `APROBADO`.
2. WHEN una solicitud se resuelve con `APROBADO` por monto bajo e historial limpio, THE Caso_Uso_Evaluacion SHALL finalizar la evaluación con cero (0) invocaciones al Adapter_Buro_Externo y registrar `consultaBuroRealizada` igual a falso.
3. THE Tope_Monto_Aprobacion_Automatica SHALL obtenerse de la configuración del servicio como un número mayor que cero.
4. IF el Historial_Interno está ausente o `tieneMoraVigente` es indeterminado, THEN THE Regla_Capacidad_Pago SHALL devolver un valor nulo para que el Motor_Reglas continúe la cadena en lugar de aprobar automáticamente.
5. IF el Tope_Monto_Aprobacion_Automatica no está definido en la configuración o no es un número mayor que cero, THEN THE Regla_Capacidad_Pago SHALL devolver un valor nulo sin emitir `APROBADO` automático por esta regla.

### Requisito 6: Registro de trazabilidad de la decisión

**Historia de Usuario:** Como área de auditoría, quiero que cada decisión indique si se consultó el buró externo y qué reglas participaron, para auditar el cumplimiento del indicador de resolución sin buró y trazar el razonamiento de cada evaluación. (RF-06)

#### Criterios de Aceptación

1. THE Caso_Uso_Evaluacion SHALL incluir en cada DecisionCore el campo `consultaBuroRealizada` con valor verdadero cuando se invocó al Adapter_Buro_Externo y falso en caso contrario.
2. THE Motor_Reglas SHALL incluir en cada DecisionCore el campo `reglasAplicadas` como una lista ordenada, sin duplicados, con los nombres de las reglas evaluadas.
3. WHEN una regla emite el veredicto definitivo, THE Motor_Reglas SHALL incluir en `reglasAplicadas` los nombres de todas las reglas evaluadas hasta esa regla inclusive, en el orden de ejecución.
4. WHEN ninguna regla emite un veredicto definitivo y se aplica la aprobación por defecto, THE Motor_Reglas SHALL incluir en `reglasAplicadas` los nombres de todas las reglas evaluadas y el identificador de la decisión por defecto.
5. THE Caso_Uso_Evaluacion SHALL consultar al Adapter_Buro_Externo únicamente cuando alguna regla de la cadena requiera Datos_Buro y ninguna regla previa haya emitido un veredicto definitivo.

### Requisito 7: Continuidad ante fallo del buró externo

**Historia de Usuario:** Como unidad de crédito, quiero que el motor siga respondiendo con reglas internas cuando el buró externo falla o excede el tiempo máximo, para mantener la disponibilidad del servicio y la tasa de error bajo el 1%. (RF-07)

#### Criterios de Aceptación

1. IF el Adapter_Buro_Externo falla o excede el tiempo máximo de respuesta de 3000 ms, THEN THE Adapter_Buro_Externo SHALL devolver un resultado de fallback con `score` nulo, `estadoBuro` igual a `INDISPONIBLE`, `deudaExternaTotal` igual a 0 y `moraExterna` igual a falso.
2. WHEN el Motor_Reglas evalúa una solicitud con Datos_Buro cuyo `score` es nulo, THE Regla_Score_Buro SHALL devolver un valor nulo para que el Motor_Reglas continúe la cadena hacia reglas internas.
3. WHEN el Adapter_Buro_Externo devuelve un resultado de fallback, THE Caso_Uso_Evaluacion SHALL producir una DecisionCore resolviéndose con reglas internas y mantener la tasa de error por debajo del 1%.
4. WHEN el Motor_Reglas no puede emitir un veredicto por indisponibilidad de Datos_Buro para un cliente sin historial interno, THE Regla_Cliente_Nuevo SHALL devolver una Decision `REVISION_MANUAL` con un motivo que indique la indisponibilidad del buró externo.
5. WHILE el Circuit Breaker del Adapter_Buro_Externo está abierto tras superar el 50% de errores, THE Adapter_Buro_Externo SHALL devolver el resultado de fallback sin invocar al buró externo hasta que transcurra el resetTimeout de 10000 ms.

### Requisito 8: Publicación de auditoría por cada decisión

**Historia de Usuario:** Como área de auditoría, quiero que cada evaluación dispare un registro de auditoría, exitosa o con fallo de dependencias, para conservar la trazabilidad completa de las decisiones de crédito. (RF-08)

#### Criterios de Aceptación

1. WHEN el Caso_Uso_Evaluacion produce una DecisionCore, THE Caso_Uso_Evaluacion SHALL invocar al Publicador_Auditoria con el registro de la decisión.
2. THE registro enviado al Publicador_Auditoria SHALL incluir `idEvaluacion`, `identificacion`, `montoSolicitado`, `plazoMeses`, `decision`, `motivo`, `reglasAplicadas`, `consultaBuroRealizada` y `fecha`.
3. IF la publicación en el Publicador_Auditoria falla o excede su timeout de 3000 ms, THEN THE Caso_Uso_Evaluacion SHALL registrar el error sin alterar ni bloquear la DecisionCore devuelta al solicitante.
4. WHEN una evaluación se resuelve mediante el fallback del Adapter_Buro_Externo, THE Caso_Uso_Evaluacion SHALL invocar igualmente al Publicador_Auditoria con el registro de la decisión.
