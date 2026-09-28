# Resuelve API - Sistema de Evaluación de Crédito

Monorepo simple (sin npm workspaces) en **Node.js + Express** para el sistema de evaluación de crédito en tiendas **"Resuelve"**.

Cada servicio dentro de `services/` es un proyecto Node completamente independiente con su propio `package.json`, `Dockerfile`, `.env.example` y tests.

---

## 📁 Estructura del Proyecto

```text
resuelve-api-credito/
├── README.md                          # Este archivo
├── docker-compose.yml                 # Orquestación de los 7 microservicios y bases de datos
├── docker-compose.override.yml        # Configuración para desarrollo local con hot-reload (nodemon)
├── .gitignore                         # Exclusiones de Git (node_modules, .env, etc.)
├── contracts/                         # Especificaciones OpenAPI 3.0 por componente (Contract-First)
│   ├── spec0-frontend.yaml            # Contrato consumido por el Frontend Tiendas
│   ├── spec1-gateway.yaml             # Contrato público del API Gateway
│   ├── spec2-bff-pos.yaml             # Contrato del BFF Punto de Venta
│   ├── spec3-bff-auditoria.yaml       # Contrato del BFF Auditoría
│   ├── spec4-evaluacion-core.yaml     # Contrato del Servicio de Evaluación Core
│   ├── spec5-buro-simulado.yaml       # Contrato del Simulador de Buró Externo
│   ├── spec6-repositorio-interno.yaml # Contrato del Repositorio Interno de Clientes
│   └── spec7-auditoria.yaml           # Contrato del Servicio de Auditoría
├── services/                          # Microservicios independientes en Node.js + Express
│   ├── gateway/                       # Puerto 8080: API Gateway público con JWT y rate limit
│   ├── bff-punto-venta/               # Puerto 8081: BFF para el frontend de tiendas (POS)
│   ├── bff-auditoria/                 # Puerto 8082: BFF para panel de auditoría
│   ├── evaluacion-core/               # Puerto 8090: Motor de reglas y orquestación
│   ├── buro-simulado/                 # Puerto 8091: Simulador de buró externo con fallas controladas
│   ├── repositorio-interno/           # Puerto 8092: Repositorio de clientes respaldado en PostgreSQL
│   └── auditoria/                     # Puerto 8095: Servicio de auditoría conectado a MongoDB Atlas
├── frontend/
│   └── resuelve-tiendas/              # Carpeta vacía (.gitkeep) para el código del equipo Frontend
├── tests/
│   └── integration/
│       └── flujo-completo.test.js     # Test E2E placeholder contra Docker Compose
├── perf/
│   └── k6/
│       └── evaluacion-carga.js        # Script de prueba de carga y concurrencia con k6
└── docs/
    ├── architecture/
    │   └── arquitectura.md            # Diagramas Mermaid, flujos y patrones de resiliencia
    └── postman/
        └── Resuelve_API.postman_collection.json # Colección Postman para pruebas
```

---

## 🔌 Matriz de Puertos y Servicios

| Servicio | Puerto Interno | Descripción |
|---|:---:|---|
| **gateway** | `8080` | Punto de entrada público, autenticación JWT, rate limit, proxy a BFFs |
| **bff-punto-venta** | `8081` | BFF adaptado para el flujo de ventas en tiendas físicas |
| **bff-auditoria** | `8082` | BFF para consulta y reporte de evaluaciones crediticias |
| **evaluacion-core** | `8090` | Motor de reglas de negocio en cadena (*Chain of Responsibility*) y orquestador |
| **buro-simulado** | `8091` | Buró crediticio determinístico con escenarios (`NORMAL`, `LATENCIA_ALTA`, `CAIDO`) |
| **repositorio-interno** | `8092` | Historial interno de clientes respaldado en PostgreSQL |
| **auditoria** | `8095` | Registro inmutable de eventos de evaluación conectado a MongoDB Atlas |

---

## 🗄️ Bases de Datos

1. **PostgreSQL** (`postgres:16-alpine`):
   - Expuesto en puerto `5432`
   - Base de datos: `resuelve_db`, usuario: `resuelve_user`
   - Usado por `repositorio-interno`
2. **MongoDB Atlas**:
   - Conexión configurada en `auditoria`:
     ```text
     MONGO_URI=mongodb+srv://edisonenc80_db_user:ZUp7WDWVpTMlTwdq@cluster0.ce0hfi3.mongodb.net/
     ```

---

## 🚀 Despliegue con Docker Compose

### 1. Iniciar todos los servicios
```bash
docker compose up -d --build
```

### 2. Verificar estado de los contenedores
```bash
docker compose ps
```

### 3. Ver logs en tiempo real
```bash
docker compose logs -f
```

### 4. Detener los servicios
```bash
docker compose down
```

---

## 💻 Desarrollo Local (por Servicio)

Si un integrante del equipo desea trabajar únicamente en su servicio individual:

```bash
cd services/<nombre-servicio>
npm install
npm run dev
```

Cada servicio cuenta con scripts npm estándar:
- `npm start`: Ejecuta el servicio en producción (`node src/index.js`).
- `npm run dev`: Ejecuta en modo desarrollo con recarga en caliente (`nodemon src/index.js`).
- `npm test`: Ejecuta las pruebas unitarias con Jest.

---

## 🧪 Pruebas de Integración y Rendimiento

### Test E2E de Flujo Completo
Con el entorno Docker levantado:
```bash
npm install --save-dev axios jest
npx jest tests/integration/flujo-completo.test.js
```

### Prueba de Carga con k6
```bash
k6 run perf/k6/evaluacion-carga.js
```

---

## 📝 Reglas de Negocio en `evaluacion-core`

El motor de reglas utiliza el patrón **Chain of Responsibility** y se encuentra en `services/evaluacion-core/src/domain/`:
1. `reglaMoraVigente.js`: Rechazo directo si existe mora activa interna.
2. `reglaClienteNuevo.js`: Evaluación específica si el cliente no posee historial.
3. `reglaScoreBuro.js`: Evaluación del score obtenido del buró externo simulado.
4. `reglaCapacidadPago.js`: Validación de cuota vs ingresos declarados.
