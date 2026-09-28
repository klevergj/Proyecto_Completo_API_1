---
inclusion: always
---
# Estructura del proyecto — Resuelve

## Layout general (monorepo simple, sin workspaces)

```text
resuelve-api-credito/
├── contracts/              # YAML OpenAPI, uno por servicio — fuente de verdad
├── services/                # 7 servicios Node/Express independientes
│   ├── gateway/              (puerto 8080)
│   ├── bff-punto-venta/      (puerto 8081)
│   ├── bff-auditoria/        (puerto 8082)
│   ├── evaluacion-core/      (puerto 8090)
│   ├── buro-simulado/        (puerto 8091)
│   ├── repositorio-interno/  (puerto 8092)
│   └── auditoria/            (puerto 8095)
├── frontend/resuelve-tiendas/  # React, mantenido por otro integrante
├── tests/integration/
├── perf/k6/
└── docs/
```

## Convenciones
- Cada servicio en services/ tiene su propio package.json, Dockerfile y
  src/index.js como punto de entrada — nunca dependencias compartidas entre
  servicios (son independientes a propósito).
- Todos los servicios (existentes y nuevos) siguen la estructura interna
  estándar descrita abajo.
- Nombres de archivo en español, camelCase para JS (ej. motorReglas.js,
  reglaScoreBuro.js), kebab-case para carpetas de servicios.
- Cada servicio referencia su contrato correspondiente por ruta relativa a
  contracts/, nunca copia el YAML dentro de su propia carpeta.

## Estructura interna de los servicios (patrón Repository)
Aplica a TODOS los servicios, los que ya existen y los que se creen. Cada
servicio usa solo las carpetas que necesita (ej. el gateway no tiene
repositories/ porque no accede a datos). Referencia implementada:
services/repositorio-interno y services/bff-punto-venta.

```text
src/
├── config/        # variables de entorno tipadas con defaults (ej. repoConfig.js)
├── controllers/   # HTTP <-> caso de uso/repositorio; arman el DTO de respuesta
├── dtos/          # forma de entrada/salida del contrato (lista blanca de campos)
├── middlewares/   # validación de entrada y manejadorErrores central
├── models/        # modelos de dominio inmutables (sin SQL ni formato HTTP)
├── repositories/  # <nombre>Repository.interface.js (puerto) +
│                  # <tecnologia><Nombre>Repository.js (implementación)
├── services/      # casos de uso, solo si orquestan varias dependencias
├── clients/       # llamadas HTTP salientes a otros servicios (axios + timeout)
├── routes/        # solo cablean middlewares + controlador, sin lógica
├── utils/         # errores tipados y helpers puros
├── app.js         # crearApp(deps): construye Express con dependencias inyectadas
└── index.js       # punto de entrada y raíz de composición (elige implementaciones)
```

Reglas:
- Controladores y servicios dependen de la INTERFAZ del repositorio, nunca de
  la implementación. La implementación concreta se elige solo en index.js.
- JavaScript no tiene `implements`: cada interfaz exporta un @typedef JSDoc y
  una función asegurar<Nombre>Repository(impl) que verifica los métodos al
  inyectar (la app falla al arrancar si la implementación está incompleta).
- Los repositorios devuelven modelos de dominio; la conversión al contrato
  (DTO) la hace el controlador. Solo la implementación del repositorio conoce
  el esquema de la base (columnas, SQL, colecciones).
- Pruebas junto al código (*.test.js); dobles de prueba implementan la misma
  interfaz del repositorio.
- Fuentes de datos remotas (otro servicio que DEVUELVE datos, ej. historial o
  score) también se acceden vía repositories/ (interfaz + implementación
  http<Nombre>Repository.js). clients/ queda para llamadas salientes que no
  son lectura de datos (ej. publicar auditoría, delegar una evaluación).

### Excepción acotada: evaluacion-core
Usa la misma estructura estándar y añade domain/ para el motor de reglas:

```text
src/domain/
├── motorReglas.js     # Chain of Responsibility
└── reglas/            # una Strategy por regla (reglaMoraVigente.js, ...)
```

domain/ es puro: no conoce HTTP, SQL ni repositorios; recibe modelos ya
normalizados. El caso de uso (services/) obtiene los datos por los
repositorios (historial interno y score del buró, este último con Circuit
Breaker + fallback dentro de su implementación) y ejecuta el motor.
