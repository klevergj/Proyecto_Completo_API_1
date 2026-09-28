# Requirements Document

## Introduction

El Buró Simulado es un servicio adaptador (Node.js / Express) que forma parte del sistema "Resuelve Crédito". Su propósito es entregar puntajes crediticios (scores) simulados y soportar escenarios configurables de fallo y latencia, de modo que se puedan demostrar en vivo los patrones de resiliencia del núcleo (core), como el Circuit Breaker. El servicio genera puntajes de forma determinística a partir de la identificación consultada, garantizando que las pruebas y demostraciones sean reproducibles. Los escenarios de operación (NORMAL, LATENCIA_ALTA, CAIDO) se pueden alternar en tiempo de ejecución mediante un endpoint administrativo, sin reiniciar el servicio.

## Glossary

- **Buro_Simulado**: Servicio HTTP que expone endpoints de consulta de score crediticio y administración de escenarios. Escucha en el puerto configurado (por defecto 8091).
- **Identificacion**: Cadena de caracteres que identifica al sujeto de crédito y sirve como entrada para el cálculo determinístico del score.
- **Score**: Valor numérico entero que representa el puntaje crediticio simulado, dentro del rango 300 a 850 inclusive.
- **Mora**: Indicador booleano (`moraExterna`) que señala si el sujeto de crédito presenta atraso de pago simulado.
- **Deuda_Externa_Total**: Valor numérico que representa el monto de deuda externa simulada asociado al sujeto de crédito.
- **Escenario**: Modo de operación activo del Buro_Simulado. Valores válidos: NORMAL, LATENCIA_ALTA, CAIDO.
- **Escenario NORMAL**: Modo en el que el Buro_Simulado responde con score simulado y latencia estándar.
- **Escenario LATENCIA_ALTA**: Modo en el que el Buro_Simulado retrasa intencionalmente la respuesta para simular latencia alta.
- **Escenario CAIDO**: Modo en el que el Buro_Simulado responde con un error de servicio no disponible para simular una caída.
- **Endpoint_Administrativo**: Ruta HTTP `POST /admin/escenario` que permite cambiar el Escenario activo en tiempo de ejecución.
- **Circuit_Breaker**: Patrón de resiliencia implementado en el núcleo del sistema Resuelve Crédito que el Buro_Simulado permite demostrar mediante sus escenarios de fallo.
- **ESCENARIO_INICIAL**: Variable de entorno que define el Escenario activo al iniciar el Buro_Simulado.

## Requirements

### Requisito 1: Consulta de score crediticio simulado

**Historia de Usuario:** Como sistema núcleo de Resuelve Crédito, quiero consultar un score crediticio simulado y un indicador de mora para una identificación dada, para poder evaluar solicitudes de crédito durante las demostraciones.

#### Criterios de Aceptación

1. WHEN se recibe una petición `GET /score/:identificacion` con una `identificacion` no vacía y el escenario activo es NORMAL, THE Buro_Simulado SHALL responder con código HTTP 200 y un cuerpo JSON que incluye los campos `identificacion` (cadena igual al valor recibido en la ruta), `score` (entero), `moraExterna` (booleano), `deudaExternaTotal` (número), `fechaConsulta` (marca de tiempo en formato ISO 8601 en UTC) y `escenarioSimulado` (cadena con el nombre del escenario activo).
2. WHEN se calcula el `score` para una identificación, THE Buro_Simulado SHALL producir un valor entero mayor o igual a 300 y menor o igual a 850.
3. WHEN se consulta dos o más veces la misma `identificacion` bajo el escenario NORMAL, THE Buro_Simulado SHALL devolver los mismos valores de `score`, `moraExterna` y `deudaExternaTotal` en cada respuesta (resultado determinístico por identificación).
4. WHEN el indicador `moraExterna` calculado es verdadero, THE Buro_Simulado SHALL asignar a `deudaExternaTotal` un valor numérico mayor que cero.
5. WHEN el indicador `moraExterna` calculado es falso, THE Buro_Simulado SHALL asignar a `deudaExternaTotal` el valor cero.
6. WHILE el escenario activo es LATENCIA_ALTA, WHEN se recibe una petición `GET /score/:identificacion` con una `identificacion` no vacía, THE Buro_Simulado SHALL responder con código HTTP 200 y el mismo cuerpo JSON del criterio 1 tras un retraso de al menos 5 segundos (5000 ms) desde la recepción de la petición.
7. IF el escenario activo es CAIDO cuando se recibe una petición `GET /score/:identificacion`, THEN THE Buro_Simulado SHALL responder con código HTTP 503 y un cuerpo JSON que incluye un mensaje de error indicando que el servicio de buró no está disponible, sin devolver los campos `score`, `moraExterna` ni `deudaExternaTotal`.

### Requisito 2: Generación determinística del score

**Historia de Usuario:** Como responsable de las demostraciones, quiero que los scores se generen de forma determinística a partir de la identificación, para que las pruebas y demostraciones sean reproducibles.

#### Criterios de Aceptación

1. WHEN se consulta cualquier número de veces la misma `identificacion` bajo el escenario NORMAL, THE Buro_Simulado SHALL retornar el mismo valor de `score` en todas las respuestas.
2. WHEN se consulta cualquier número de veces la misma `identificacion` bajo el escenario NORMAL, THE Buro_Simulado SHALL retornar el mismo valor de `moraExterna` y de `deudaExternaTotal` en todas las respuestas.
3. THE Buro_Simulado SHALL derivar el `score`, el indicador `moraExterna` y el valor `deudaExternaTotal` de forma exclusiva a partir del valor de la `identificacion` recibida, sin depender de la fecha, la hora, el número de consultas previas ni reinicios del servicio.
4. WHEN se consulta la misma `identificacion` bajo el escenario LATENCIA_ALTA, THE Buro_Simulado SHALL retornar los mismos valores de `score`, `moraExterna` y `deudaExternaTotal` que retornaría bajo el escenario NORMAL.
5. IF se recibe una `identificacion` vacía, THEN THE Buro_Simulado SHALL responder con código HTTP 400 y un objeto `error`.

### Requisito 3: Escenario de latencia alta configurable

**Historia de Usuario:** Como responsable de las demostraciones, quiero activar un modo de latencia alta, para poder demostrar cómo el núcleo maneja respuestas lentas del buró.

#### Criterios de Aceptación

1. WHEN se recibe una solicitud válida para activar el Escenario LATENCIA_ALTA, THE Buro_Simulado SHALL establecer el Escenario activo como LATENCIA_ALTA y confirmar el cambio en la respuesta indicando el escenario resultante.
2. WHILE el Escenario activo es LATENCIA_ALTA, WHEN se recibe una solicitud a `GET /score/:identificacion`, THE Buro_Simulado SHALL retrasar el inicio del envío de la respuesta al menos 5 segundos antes de responder.
3. WHILE el Escenario activo es LATENCIA_ALTA, WHEN transcurre el retraso configurado, THE Buro_Simulado SHALL responder con código HTTP 200 y un cuerpo JSON que contenga los campos identificacion, score, moraExterna y deudaExternaTotal con los mismos valores deterministas que produciría el Escenario NORMAL para la misma identificación.
4. WHILE el Escenario activo es LATENCIA_ALTA, WHEN se reciben múltiples solicitudes concurrentes a `GET /score/:identificacion`, THE Buro_Simulado SHALL aplicar el retraso de forma independiente a cada solicitud sin rechazar ni descartar ninguna.

### Requisito 4: Escenario de caída del servicio

**Historia de Usuario:** Como responsable de las demostraciones, quiero activar un modo de caída del servicio, para poder demostrar en vivo el Circuit_Breaker del núcleo.

#### Criterios de Aceptación

1. WHILE el Escenario activo es CAIDO, THE Buro_Simulado SHALL responder a `GET /score/:identificacion` con código HTTP 503 en un tiempo máximo de 1 segundo (sin aplicar retraso de latencia).
2. WHILE el Escenario activo es CAIDO, THE Buro_Simulado SHALL incluir en la respuesta un cuerpo con formato JSON que contenga un objeto `error` con el campo `message` (cadena de texto no vacía que indica la indisponibilidad del servicio) y el campo `code` (cadena de texto no vacía que identifica la causa de indisponibilidad).
3. WHEN el Escenario activo cambia de CAIDO a un valor distinto de CAIDO, THE Buro_Simulado SHALL responder a `GET /score/:identificacion` con código HTTP 200 y el cuerpo de score correspondiente, dejando de emitir la respuesta 503.

### Requisito 5: Administración de escenarios en tiempo de ejecución

**Historia de Usuario:** Como responsable de las demostraciones, quiero cambiar el escenario activo mediante un endpoint administrativo, para poder alternar modos sin reiniciar el servicio.

#### Criterios de Aceptación

1. WHEN se recibe una petición `POST /admin/escenario` con un campo `escenario` cuyo valor, tras normalizarse a mayúsculas, es NORMAL, LATENCIA_ALTA o CAIDO, THE Buro_Simulado SHALL actualizar el Escenario activo al valor normalizado y responder con código HTTP 200 y un cuerpo JSON que incluye el Escenario activo resultante.
2. WHEN se actualiza correctamente el Escenario activo, THE Buro_Simulado SHALL aplicar el nuevo Escenario a las consultas posteriores de `GET /score/:identificacion` sin requerir reinicio del servicio.
3. IF se recibe una petición `POST /admin/escenario` sin el campo `escenario`, o con un valor que tras normalizarse a mayúsculas no está incluido en el conjunto {NORMAL, LATENCIA_ALTA, CAIDO}, THEN THE Buro_Simulado SHALL responder con código HTTP 400 y un objeto `error` con código `INVALID_SCENARIO`, y SHALL conservar sin cambios el Escenario activo previo.
4. WHEN se recibe una petición `GET /admin/escenario`, THE Buro_Simulado SHALL responder con código HTTP 200 y un cuerpo JSON que incluye el Escenario activo.
5. WHERE la variable de entorno ESCENARIO_INICIAL está definida al iniciar el servicio con un valor incluido en el conjunto {NORMAL, LATENCIA_ALTA, CAIDO}, THE Buro_Simulado SHALL establecer el Escenario activo inicial con el valor de ESCENARIO_INICIAL.
6. WHERE la variable de entorno ESCENARIO_INICIAL no está definida o tiene un valor no válido al iniciar el servicio, THE Buro_Simulado SHALL establecer el Escenario activo inicial en NORMAL.

### Requisito 6: Verificación de estado del servicio

**Historia de Usuario:** Como operador del sistema, quiero un endpoint de estado de salud, para poder verificar que el Buro_Simulado está en ejecución.

#### Criterios de Aceptación

1. WHEN se recibe una petición `GET /health`, THE Buro_Simulado SHALL responder con código HTTP 200 y un cuerpo JSON que incluye los campos `status`, `service` y `timestamp`.

### Requisito 7: Manejo de errores internos

**Historia de Usuario:** Como consumidor del servicio, quiero recibir respuestas de error estructuradas, para poder interpretar los fallos de forma consistente.

#### Criterios de Aceptación

1. IF ocurre un error no controlado durante el procesamiento de una petición, THEN THE Buro_Simulado SHALL responder con un objeto `error` que contiene los campos `message` y `code`.
