# 💳 Resuelve - API de Evaluación y Scoring de Crédito

[![Architecture](https://img.shields.io/badge/Architecture-Microservices-blue.svg)](https://microservices.io/)
[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-green.svg)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose_v2-2496ED.svg)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-MIT-brightgreen.svg)](#)

---

## 1. TÍTULO Y DESCRIPCIÓN DEL PROYECTO

**Resuelve - API de Evaluación y Scoring de Crédito** es una plataforma de software distribuida orientada a microservicios para la evaluación de solicitudes crediticias en tiempo real. El sistema permite dictaminar de forma automatizada, resiliente e ininterrumpida la viabilidad de otorgamiento de crédito a clientes en puntos de venta (POS) y canales digitales.

### Resumen de Arquitectura
El sistema adopta una **arquitectura desacoplada y orientada a microservicios**, implementando patrones enterprise de software como **API Gateway**, **Backend-for-Frontend (BFF)**, **Chain of Responsibility**, **Strategy Pattern** y **Circuit Breaker**.

```
[ Frontend React / POS Terminal / Cliente HTTP ]
                     │
                     ▼
       ┌───────────────────────────┐
       │   API Gateway (:8080)     │ ◄── Auth OAuth2 (JWT) & Rate Limiting
       └─────────────┬─────────────┘
                     │
       ┌─────────────┴─────────────┐
       ▼                           ▼
┌──────────────┐            ┌──────────────────┐
│ BFF POS      │            │ BFF Auditoría    │
│ (:8081)      │            │ (:8082)          │
└──────┬───────┘            └────────┬─────────┘
       │                             │
       ▼                             ▼
┌──────────────────────────────────────────────┐
│  Servicio Core de Evaluación (:8090)         │
│  (Chain of Responsibility & Strategy)        │
└──────┬──────────────────────┬─────────┬──────┘
       │                      │         │
       ▼                      ▼         ▼
┌──────────────┐     ┌──────────────┐ ┌────────────────────────┐
│ Repositorio  │     │ Buró Simulado│ │ Servicio de Auditoría  │
│ Interno      │     │ Externo      │ │ & Trazabilidad         │
│ (:8092)      │     │ (:8091) [CB] │ │ (:8095)                │
└──────────────┘     └──────────────┘ └────────────────────────┘
```

* **Frontend SPA (React + Vite)**: Interfaz de usuario dinámica para simulación de solicitudes crediticias, administración de escenarios de fallas y panel de auditoría analítica.
* **API Gateway (Puerto `:8080`)**: Punto único de entrada. Encargado de la emisión de Tokens OAuth2 (Client Credentials Flow), validación de scopes JWT, rate-limiting y enrutamiento proxy transparente.
* **BFF Punto de Venta - POS (Puerto `:8081`)**: Backend-for-Frontend especializado para terminales de venta. Adapta los modelos de dominio complejos a respuestas simplificadas optimizadas para el operador del POS.
* **BFF Auditoría (Puerto `:8082`)**: Backend-for-Frontend especializado para tableros de analistas de riesgo. Permite la consulta paginada y filtrada del historial de evaluaciones.
* **Servicio Core de Evaluación (Puerto `:8090`)**: Motor orquestador del dominio de negocio. Ejecuta una cadena de responsabilidad (*Chain of Responsibility*) y desacopla la lógica de decisión mediante patrones de estrategia (*Strategy Pattern*).
* **Adaptador / Simulador de Buró (Puerto `:8091`)**: Microservicio externo simulado que provee el score crediticio. Incluye tolerancia a fallos mediante **Circuit Breaker** e inyección controlada de fallas (modo `NORMAL`, `LATENCIA_ALTA`, `CAIDO`).
* **Repositorio Interno de Clientes (Puerto `:8092`)**: Servicio de persistencia/consulta interna para verificación de mora interna vigente y antigüedad del cliente.
* **Servicio de Auditoría y Trazabilidad (Puerto `:8095`)**: Microservicio encargados de registrar y auditar de forma inmutable cada dictamen emitido, sus reglas aplicadas y tiempos de ejecución.

---

## 2. PRERREQUISITOS DEL SISTEMA

Antes de levantar el proyecto en un entorno local o de producción, asegúrese de contar con las siguientes herramientas instaladas:

* **Node.js**: Versión `v18.0.0` o superior (Recomendado LTS v20.x).
* **npm**: Versión `v9.0.0` o superior (incluido con Node.js).
* **Docker Desktop**: Versión `v4.x` con **Docker Compose v2.x** habilitado.
* **Git**: Para el control de versiones y clonación del repositorio.
* **Postman** (o Insomnia / cURL): Para pruebas manuales de la API REST.
* **k6**: Herramienta de pruebas de carga de Grafana (opcional pero recomendada para ejecutar los scripts de `/tests/k6`).

---

## 3. ESTRUCTURA DE ARCHIVOS Y CARPETAS

La estructura general del repositorio se organiza modularmente de la siguiente manera:

```text
Proyecto_Final/
├── docker-compose.yml              # Orquestación global de contenedores Docker
├── package.json                    # Scripts globales y dependencias raíz
├── README.md                       # Documentación técnica exhaustiva del sistema
├── contracts/                      # Especificaciones OpenAPI / Swagger 3.0
│   ├── spec0-frontend.yaml
│   ├── spec1-gateway.yaml
│   ├── spec2-bff-pos.yaml
│   ├── spec3-bff-auditoria.yaml
│   ├── spec4-core-evaluacion.yaml
│   ├── spec5-buro-simulado.yaml
│   ├── spec6-repositorio-interno.yaml
│   └── spec7-servicio-auditoria.yaml
├── Frontend/                       # Aplicación React + Vite
│   ├── src/                        # Componentes UI, vistas y cliente API
│   ├── package.json                # Configuración Frontend
│   └── vite.config.js              # Configuración del bundler Vite
├── services/                       # Arquitectura de Microservicios Backend
│   ├── api-gateway/                # Proxy inverso, OAuth2 Provider & Rate Limiter (:8080)
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── src/
│   │       ├── middleware.js
│   │       └── server.js
│   ├── bff-pos/                    # BFF Terminales Punto de Venta (:8081)
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── src/
│   │       └── server.js
│   ├── bff-auditoria/              # BFF Dashboard de Analistas (:8082)
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── src/
│   │       └── server.js
│   ├── servicio-evaluacion/        # Motor Core de Evaluación & Circuit Breaker (:8090)
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── src/
│   │       ├── circuitBreaker.js
│   │       ├── ruleEngine.js
│   │       └── server.js
│   ├── buro-simulado/              # Adaptador de Buró Crediticio Simulado (:8091)
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── src/
│   │       └── server.js
│   ├── repositorio-interno/        # Base de datos e historial interno (:8092)
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── src/
│   │       └── server.js
│   └── servicio-auditoria/         # Almacén centralizado de trazabilidad (:8095)
│       ├── Dockerfile
│       ├── package.json
│       └── src/
│           └── server.js
└── tests/
    └── k6/                         # Scripts de pruebas de carga y estrés
        ├── load-test.js            # Prueba de carga sostenida (150 VUs)
        └── spike-test.js           # Prueba de picos extremos (500 VUs)
```

---

## 4. VARIABLES DE ENTORNO (.env)

A continuación se detalla el contenido exacto de las variables de entorno para cada componente.

### 4.1. Archivo `.env` para el Frontend (`Frontend/.env`)

```env
# URL base del API Gateway de entrada
VITE_API_URL=http://localhost:8080

# Credenciales OAuth2 para el cliente Frontend
VITE_OAUTH_CLIENT_ID=frontend-tiendas
VITE_OAUTH_CLIENT_SECRET=supersecret_client_credentials_2026
```

### 4.2. Archivos `.env` para Microservicios Backend

Cada microservicio puede configurarse individualmente mediante archivos `.env` situados en sus respectivas carpetas dentro de `services/`:

#### `services/api-gateway/.env`
```env
PORT=8080
BFF_POS_URL=http://localhost:8081
BFF_AUDITORIA_URL=http://localhost:8082
JWT_SECRET=supersecret_key_resuelve_openapi_2026
```

#### `services/bff-pos/.env`
```env
PORT=8081
CORE_SERVICE_URL=http://localhost:8090
```

#### `services/bff-auditoria/.env`
```env
PORT=8082
AUDIT_SERVICE_URL=http://localhost:8095
```

#### `services/servicio-evaluacion/.env`
```env
PORT=8090
BURO_SERVICE_URL=http://localhost:8091
REPO_SERVICE_URL=http://localhost:8092
AUDIT_SERVICE_URL=http://localhost:8095
```

#### `services/buro-simulado/.env`
```env
PORT=8091
```

#### `services/repositorio-interno/.env`
```env
PORT=8092
```

#### `services/servicio-auditoria/.env`
```env
PORT=8095
```

---

## 5. GUÍA PASO A PASO PARA LEVANTAR EL PROYECTO

### Opción A: Despliegue con Docker Compose (Recomendado)

Esta es la alternativa sugerida para entornos de producción, QA o evaluación rápida, ya que aísla las dependencias y garantiza el correcto enrutamiento en la red interna de Docker (`resuelve-net`).

1. **Clonar el repositorio**:
   ```bash
   git clone https://github.com/klevergj/Taller_3.git
   cd Taller_3
   ```

2. **Construir y levantar todos los contenedores**:
   ```bash
   docker-compose up --build -d
   ```

3. **Verificar el estado de los contenedores**:
   ```bash
   docker-compose ps
   ```

4. **Verificación de salud de los servicios**:

   | Servicio | Contenedor Docker | Puerto Host | Endpoint Health Check |
   | :--- | :--- | :---: | :--- |
   | **API Gateway** | `resuelve-api-gateway` | `8080` | `http://localhost:8080/health` |
   | **BFF POS** | `resuelve-bff-pos` | `8081` | `http://localhost:8081/health` |
   | **BFF Auditoría** | `resuelve-bff-auditoria` | `8082` | `http://localhost:8082/health` |
   | **Core Evaluación** | `resuelve-servicio-evaluacion` | `8090` | `http://localhost:8090/health` |
   | **Buró Simulado** | `resuelve-buro-simulado` | `8091` | `http://localhost:8091/health` |
   | **Repositorio Interno**| `resuelve-repositorio-interno` | `8092` | `http://localhost:8092/health` |
   | **Servicio Auditoría** | `resuelve-servicio-auditoria` | `8095` | `http://localhost:8095/health` |

5. **Para detener los servicios**:
   ```bash
   docker-compose down
   ```

---

### Opción B: Levantar en Entorno Local de Desarrollo (Sin Docker)

Si desea depurar el código en tiempo real utilizando `Node.js` localmente, siga los siguientes pasos:

#### 1. Instalar dependencias globales y del backend
Desde la raíz del proyecto:
```bash
npm install
```

#### 2. Levantar los Microservicios Backend en paralelo
Puede ejecutar el script de desarrollo conjunto desde la raíz:
```bash
npm run dev
```
*(O levantar individualmente entrando a cada carpeta en `services/<nombre-servicio>` y ejecutando `npm install && npm run dev`)*.

#### 3. Levantar la aplicación Frontend
En una nueva ventana de terminal:
```bash
cd Frontend
npm install
npm run dev
```
La interfaz web estará disponible de forma predeterminada en `http://localhost:5173`.

---

## 6. PRUEBAS DE LA API CON POSTMAN (EJEMPLOS DE PETICIONES)

### 1. Obtener Token OAuth2 (`POST /oauth/token`)
Genera un token JWT firmado utilizando el flujo **Client Credentials**.

* **Método**: `POST`
* **URL**: `http://localhost:8080/oauth/token`
* **Headers**: `Content-Type: application/json`
* **Body (JSON)**:
  ```json
  {
    "grant_type": "client_credentials",
    "client_id": "frontend-tiendas",
    "client_secret": "supersecret_client_credentials_2026"
  }
  ```
* **Respuesta Esperada (`200 OK`)**:
  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "Bearer",
    "expires_in": 3600,
    "scope": "evaluaciones:escribir evaluaciones:leer auditoria:leer"
  }
  ```

---

### 2. Evaluación de Crédito Exitosa (`POST /v1/evaluaciones-credito`)
Solicita la evaluación crediticia a través del API Gateway que enruta al BFF POS.

* **Método**: `POST`
* **URL**: `http://localhost:8080/v1/evaluaciones-credito`
* **Headers**:
  * `Authorization`: `Bearer <token_jwt_obtenido>`
  * `Content-Type`: `application/json`
* **Body (JSON)**:
  ```json
  {
    "identificacion": "0203040506",
    "montoSolicitado": 1500,
    "plazoMeses": 12,
    "tiendaId": "STORE-POS-NORTE"
  }
  ```
* **Respuesta Esperada (`200 OK`)**:
  ```json
  {
    "idEvaluacion": "b3e21a44-8874-4f81-a979-994f9bd1d402",
    "aprobado": true,
    "mensajeParaCliente": "Crédito aprobado: Cumple reglas de score (760 pts) y capacidad de pago",
    "decision": "APROBADO",
    "motivo": "Cumple reglas de score (760 pts) y capacidad de pago",
    "consultaBuroRealizada": true,
    "fecha": "2026-09-24T11:45:00.000Z"
  }
  ```

---

### 3. Cambiar Escenario del Buró (`POST /admin/escenario`)
Endpoint administrativo en el microservicio de Buró Simulado para inyectar fallos o latencia y probar la resiliencia del sistema.

* **Método**: `POST`
* **URL**: `http://localhost:8091/admin/escenario` *(o mediante Gateway proxy si se halla mapeado)*
* **Headers**: `Content-Type: application/json`
* **Body (JSON - Simular Caída)**:
  ```json
  {
    "modo": "CAIDO"
  }
  ```
* **Body (JSON - Simular Alta Latencia)**:
  ```json
  {
    "modo": "LATENCIA_ALTA",
    "latenciaMs": 4000
  }
  ```
* **Respuesta Esperada (`204 No Content`)**

---

### 4. Prueba de Fallback tras caída del Buró (Circuit Breaker)
Con el escenario en `"modo": "CAIDO"`, envíe una nueva evaluación para comprobar el comportamiento defensivo.

* **Método**: `POST`
* **URL**: `http://localhost:8080/v1/evaluaciones-credito`
* **Headers**:
  * `Authorization`: `Bearer <token_jwt_obtenido>`
  * `Content-Type`: `application/json`
* **Body (JSON)**:
  ```json
  {
    "identificacion": "0203040506",
    "montoSolicitado": 2000,
    "plazoMeses": 18
  }
  ```
* **Respuesta Esperada (`200 OK` - Fallback Activo)**:
  ```json
  {
    "idEvaluacion": "f891b29a-1123-4e31-897b-cc11245ee109",
    "aprobado": false,
    "mensajeParaCliente": "En revisión manual: Buró crediticio no disponible temporalmente (Circuit Breaker activo). Derivado a revisión manual.",
    "decision": "REVISION_MANUAL",
    "motivo": "Buró crediticio no disponible temporalmente (Circuit Breaker activo). Derivado a revisión manual.",
    "consultaBuroRealizada": false,
    "fecha": "2026-09-24T11:46:12.000Z"
  }
  ```

---

### 5. Consulta de Auditoría Paginada (`GET /v1/auditoria/evaluaciones`)
Consulta las evaluaciones registradas con soporte para paginación y filtros.

* **Método**: `GET`
* **URL**: `http://localhost:8080/v1/auditoria/evaluaciones?page=0&size=10&estado=APROBADO`
* **Headers**:
  * `Authorization`: `Bearer <token_jwt_obtenido>`
* **Respuesta Esperada (`200 OK`)**:
  ```json
  {
    "total": 1,
    "page": 0,
    "items": [
      {
        "idEvaluacion": "b3e21a44-8874-4f81-a979-994f9bd1d402",
        "decision": "APROBADO",
        "motivo": "Cumple reglas de score (760 pts) y capacidad de pago",
        "fecha": "2026-09-24T11:45:00.000Z",
        "tiendaId": "STORE-POS-NORTE",
        "consultaBuroRealizada": true,
        "scoreBuro": 760,
        "reglasAplicadas": [
          "REGLA_HISTORIAL_INTERNO",
          "REGLA_BURO_EXTERNO",
          "REGLA_BURO_SCORE_OPTIMO"
        ]
      }
    ]
  }
  ```

---

## 7. ESCENARIOS Y DATOS DE PRUEBA (SEED DATA)

El sistema integra un conjunto de reglas deterministas preseteadas para facilitar la verificación de pruebas funcionales y de integración:

| Cédula / DNI de Prueba | Condición Histórica Interna | Comportamiento en Buró Externo | Resultado Esperado (`decision`) | Regla Aplicada Principal |
| :--- | :--- | :--- | :--- | :--- |
| **`0102030405`** (o ID finaliza en `99`) | **Mora Vigente Interna** | No se consulta (Cortocircuito en Chain) | **`RECHAZADO`** | `REGLA_RECHAZO_MORA_INTERNA` |
| **`0203040506`** (ID estándar) | Sin mora (Cliente regular) | Score `760` (Óptimo, sin mora) | **`APROBADO`** | `REGLA_BURO_SCORE_OPTIMO` |
| **`0999999999`** (o ID finaliza en `00`) | Cliente Nuevo (404 Interno) | Score `760` (Evaluación normal) | **`APROBADO`** | `REGLA_BURO_SCORE_OPTIMO` |
| **`1122334488`** (o ID finaliza en `88`) | Sin mora | Score `420` (Reportado en mora externa) | **`RECHAZADO`** | `REGLA_BURO_MORA_EXTERNA` |
| **`1122334477`** (o ID finaliza en `77`) | Sin mora | Score `650` (Score limítrofe) | **`REVISION_MANUAL`** | `REGLA_BURO_SCORE_LIMITROFE` |
| **`1122334466`** (o ID finaliza en `66`) | Sin mora | Score `520` (Score insuficiente) | **`RECHAZADO`** | `REGLA_BURO_SCORE_BAJO` |

---

## 8. EJECUCIÓN DE PRUEBAS DE CARGA (K6)

Los scripts de rendimiento y estrés se encuentran ubicados en la carpeta `/tests/k6/`. Asegúrese de tener el API Gateway y los microservicios desplegados antes de iniciar la prueba.

### 1. Prueba de Carga Sostenida (`load-test.js`)
Evalúa el comportamiento del sistema bajo una carga continua simulando un incremento paulatino hasta **150 usuarios virtuales (VUs)**.

```bash
k6 run tests/k6/load-test.js
```

* **Escenario de Carga**:
  * 0 a 30s: Ramp-up progresivo hasta 50 VUs.
  * 30s a 1m30s: Ramp-up hasta 150 VUs.
  * 1m30s a 3m30s: Carga mantenida a 150 VUs.
  * 3m30s a 4m: Ramp-down a 0 VUs.
* **Criterios de Aceptación (Thresholds)**:
  * `http_req_duration`: p(95) < 2000 ms.
  * `http_req_failed`: Tasa de falla < 5%.

---

### 2. Prueba de Pico Extremo / Stress (`spike-test.js`)
Evalúa la resiliencia del API Gateway, la activación de los Rate Limiters y la respuesta del sistema ante ráfagas repentinas de tráfico de hasta **500 usuarios virtuales (VUs)**.

```bash
k6 run tests/k6/spike-test.js
```

* **Escenario de Pico**:
  * 0 a 10s: Carga inicial de 20 VUs.
  * 10s a 40s: Pico abrupto (*spike*) a 500 VUs.
  * 40s a 1m40s: Mantenimiento del pico extremo (500 VUs).
  * 1m40s a 2m: Ramp-down acelerado.
* **Criterios de Aceptación (Thresholds)**:
  * El sistema debe responder adecuadamente con respuestas exitosas (`200 OK`) o peticiones limitadas de forma segura (`429 Too Many Requests`), garantizando un `rate < 15%` para errores no controlados.

---

### Licencia y Créditos
Desarrollado como proyecto final de arquitectura de software desacoplada para el **Sistema de Evaluación Crediticia Resuelve**.
