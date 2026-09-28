---
inclusion: always
---
# Stack tecnológico y patrones — Resuelve

## Stack
- Backend: Node.js 20 LTS + Express, un servicio por componente (ver structure.md)
- Autenticación: OAuth2 (flujo client_credentials) vía Keycloak; validación de
  JWT con express-jwt + jwks-rsa
- Rate limiting: express-rate-limit, aplicado en el API Gateway por client_id
- Resiliencia: opossum como Circuit Breaker en cualquier llamada a un
  servicio que pueda fallar o demorar (ej. buro-simulado)
- HTTP entre servicios: axios
- Persistencia: PostgreSQL (repositorio-interno, datos estructurados) y
  MongoDB (auditoria, documentos semi-estructurados)
- Frontend: React + Vite
- Contratos: OpenAPI 3.0, un YAML por servicio en contracts/, SIEMPRE la
  fuente de verdad de cualquier request/response
- Mocking: Prism, para levantar un mock desde cualquier YAML de contracts/
- Pruebas: Jest + Supertest (unitarias/integración), k6 (carga y estrés)
- Contenerización: Docker (un Dockerfile por servicio) + docker-compose

## Patrones obligatorios y dónde aplican
- **API Gateway**: único punto de entrada público, hace auth + rate limiting
  + enrutamiento. Nunca contiene lógica de negocio.
- **BFF (Backend for Frontend)**: un backend distinto por tipo de consumidor
  (bff-punto-venta para el frontend de tiendas, bff-auditoria para el panel
  interno). Nunca un solo contrato sirviendo a ambos.
- **Strategy**: cada regla de negocio del motor de evaluación es un módulo
  independiente e intercambiable, nunca un bloque de if/else monolítico.
- **Chain of Responsibility**: el motor de reglas las recorre en cadena y se
  detiene en la primera que decide (protege el KPI de "60% sin buró").
- **Circuit Breaker**: obligatorio en cualquier adapter hacia un servicio
  externo que pueda caerse o demorar (buro-simulado). Debe tener fallback
  a reglas internas.
- **Repository/Adapter**: el core nunca conoce el esquema real de la base de
  datos, solo interfaces (ports) hacia repositorio-interno y buro-simulado.
- **Cache-Aside**: resultados de reglas internas por cliente, con TTL corto,
  para reducir carga bajo tráfico sostenido.

## Reglas de código
- Nunca implementar lógica de negocio directamente en el Gateway o en
  cualquier BFF — esa lógica vive únicamente en evaluacion-core.
- Todo cambio de contrato (request/response) se hace primero en el YAML de
  contracts/, nunca directamente en el código sin actualizar el YAML.
- Toda llamada saliente a otro servicio debe manejar timeout y error
  explícitamente, nunca asumir que la respuesta siempre llega.
