# Walkthrough: Proyecto Final - Evaluador de Créditos Financieros

Se han completado con éxito todas las fases requeridas en el proyecto **Proyecto_Final**, cumpliendo estrictamente con los contratos de OpenAPI descritos en la especificación.

---

## Cambios Realizados

### Frontend (`Frontend/`)
- **[CreditForm.jsx](file:///c:/Users/ADMIN/Documents/Proyectos_API_DI/Proyecto_Final/Frontend/src/components/CreditForm.jsx)**: Se modificó la interfaz del formulario para solicitar ÚNICAMENTE 3 campos:
  1. `identificacion` (Cédula / DNI / RUC)
  2. `montoSolicitado` (Monto Solicitado USD)
  3. `plazoMeses` (Plazo en Meses)
  Se eliminaron por completo los campos de `nombre`, `ingresosMensuales` y `gastosMensuales`.
- **[ResultCard.jsx](file:///c:/Users/ADMIN/Documents/Proyectos_API_DI/Proyecto_Final/Frontend/src/components/ResultCard.jsx)**: Se adaptó para representar las respuestas OpenAPI `DecisionFrontend` en los 3 estados:
  - `APROBADO` (Verde con ícono de éxito)
  - `RECHAZADO` (Rojo con ícono de advertencia)
  - `REVISION_MANUAL` (Ámbar con ícono de reloj)
  Muestra el UUID de la evaluación, dictamen/motivo, indicador de consulta a buró externo y marca de tiempo.
- **[apiService.js](file:///c:/Users/ADMIN/Documents/Proyectos_API_DI/Proyecto_Final/Frontend/src/services/apiService.js)**:
  - Se agregó la autenticación automática contra el endpoint `POST /oauth/token` (Client Credentials).
  - Se configuraron los headers con token `Authorization: Bearer <token>` para las peticiones `POST /v1/evaluaciones-credito` y `GET /v1/evaluaciones-credito/:id`.

---

### Backend (`backend/`)
- **[package.json](file:///c:/Users/ADMIN/Documents/Proyectos_API_DI/Proyecto_Final/backend/package.json)** & **[.env](file:///c:/Users/ADMIN/Documents/Proyectos_API_DI/Proyecto_Final/backend/.env)**: Inicialización del proyecto Node.js/Express con dependencias de cors, dotenv, express, jsonwebtoken y uuid.
- **[authRoutes.js](file:///c:/Users/ADMIN/Documents/Proyectos_API_DI/Proyecto_Final/backend/src/routes/authRoutes.js)**: Implementación del flujo OAuth2 Client Credentials en `POST /oauth/token`.
- **[authMiddleware.js](file:///c:/Users/ADMIN/Documents/Proyectos_API_DI/Proyecto_Final/backend/src/middleware/authMiddleware.js)**: Middleware de protección de rutas para verificar el token Bearer JWT.
- **[evaluacionRoutes.js](file:///c:/Users/ADMIN/Documents/Proyectos_API_DI/Proyecto_Final/backend/src/routes/evaluacionRoutes.js)**: Implementación de las rutas protegidas:
  - `POST /v1/evaluaciones-credito`
  - `GET /v1/evaluaciones-credito/:id`
- **[coreEngine.js](file:///c:/Users/ADMIN/Documents/Proyectos_API_DI/Proyecto_Final/backend/src/services/coreEngine.js)**: Motor de reglas de riesgo crediticio que orquesta la verificación en el Repositorio Interno y el Simulador de Buró Externo.
- **[internalRepo.js](file:///c:/Users/ADMIN/Documents/Proyectos_API_DI/Proyecto_Final/backend/src/services/internalRepo.js)**: Simulación de historial interno (mora vigente, antigüedad, ingresos).
- **[buroSimulator.js](file:///c:/Users/ADMIN/Documents/Proyectos_API_DI/Proyecto_Final/backend/src/services/buroSimulator.js)**: Simulación de buró de crédito externo (score crediticio 300-850 y morosidad externa).
- **[auditStore.js](file:///c:/Users/ADMIN/Documents/Proyectos_API_DI/Proyecto_Final/backend/src/services/auditStore.js)**: Registro persistente en memoria por UUID de evaluación.

---

## Verificación Realizada

### Pruebas de Endpoints e Integración
Se ejecutó un script de verificación automatizado sobre los endpoints HTTP del servidor Backend:

1. **Autenticación OAuth2 (`POST /oauth/token`):**
   - Retornó token JWT válido con scope `evaluaciones:escribir evaluaciones:leer`.
2. **Evaluación de Crédito APROBADO (`POST /v1/evaluaciones-credito`):**
   - Retornó `decision: APROBADO`, `consultaBuroRealizada: true` y UUID de evaluación.
3. **Consulta de Evaluación por UUID (`GET /v1/evaluaciones-credito/:id`):**
   - Recuperó correctamente los datos de la evaluación almacenada en auditoría.
4. **Evaluación RECHAZADA por Mora Interna:**
   - Para cédulas con mora registrada en repositorio interno, retornó `decision: RECHAZADO` y `consultaBuroRealizada: false` (evitó consulta innecesaria a buró).
5. **Evaluación REVISIÓN MANUAL:**
   - Para scores limítrofes, retornó `decision: REVISION_MANUAL`.
6. **Compilación de Frontend:**
   - `npm run build` en el Frontend se ejecutó exitosamente en 5.73s.

---

## Cómo Ejecutar el Proyecto

### 1. Iniciar el Backend
En una terminal:
```bash
cd backend
npm install
npm start
```
El servidor backend se ejecutará en `http://localhost:8080`.

### 2. Iniciar el Frontend
En otra terminal:
```bash
cd Frontend
npm install
npm run dev
```
La aplicación web se abrirá en `http://localhost:5173`.
