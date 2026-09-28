/**
 * Genera contracts/spec0-frontend.yaml: el contrato que consume el Frontend,
 * derivado de contracts/spec1-gateway.yaml (fuente de verdad del Gateway).
 *
 *   npm run contrato:frontend
 *
 * 1. `redocly bundle` resuelve los $ref externos a spec2 / spec3 y produce un
 *    unico archivo autocontenido (util para el Frontend y para mocks con Prism).
 * 2. Se ajustan solo los datos propios del consumidor: info y servers.
 *
 * spec0 NO se edita a mano: cualquier cambio se hace en spec1 (o spec2/spec3)
 * y se vuelve a generar, asi el contrato del Frontend nunca se desalinea.
 */
const { execSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const YAML = require("yaml");

const REDOCLY = "@redocly/cli@1.25.0";
const CONTRATOS = path.resolve(__dirname, "..", "..", "..", "contracts");
const ORIGEN = path.join(CONTRATOS, "spec1-gateway.yaml");
const DESTINO = path.join(CONTRATOS, "spec0-frontend.yaml");

const ENCABEZADO = [
  "# ---------------------------------------------------------------------------",
  "# GENERADO AUTOMATICAMENTE desde contracts/spec1-gateway.yaml - NO EDITAR.",
  "# Regenerar con: cd services/gateway && npm run contrato:frontend",
  "# ---------------------------------------------------------------------------",
  ""
].join("\n");

function generar() {
  const temporal = path.join(os.tmpdir(), `spec0-bundle-${process.pid}.yaml`);
  // Comando unico con rutas propias entre comillas (npx es un .cmd en Windows y
  // requiere shell); no se interpola ninguna entrada externa.
  execSync(`npx --yes ${REDOCLY} bundle "${ORIGEN}" -o "${temporal}"`, { stdio: "inherit" });

  const documento = YAML.parseDocument(fs.readFileSync(temporal, "utf8"));
  fs.unlinkSync(temporal);

  const versionGateway = documento.getIn(["info", "version"]);
  documento.set("info", {
    title: "Contrato Frontend - Resuelve",
    version: versionGateway,
    description: [
      "Contrato que consume el Frontend (Tiendas y Panel de Auditoria). Es el contrato",
      "publico del API Gateway (spec1) con los esquemas de los BFFs incluidos, en un solo",
      "archivo. Base URL: /v1 del Gateway.",
      "",
      "Flujos:",
      "- Punto de Venta: POST /evaluaciones-credito -> ResultadoPos; GET /evaluaciones-credito/{id} para reconsultar.",
      "- Panel de Auditoria: GET /auditoria/evaluaciones (resumen paginado) y GET /auditoria/evaluaciones/{id}/detalle.",
      "",
      "Autenticacion: OAuth2 client_credentials (Bearer). Mientras el Gateway corra con",
      "AUTH_HABILITADA=false, el token no se exige (se puede omitir la cabecera Authorization).",
      "",
      "Errores: siempre { error: { code, message, reintentable } }; usar `reintentable` para",
      "mostrar u ocultar la opcion de reintentar. Cabeceras utiles: X-Request-Id (soporte) y API-Version."
    ].join("\n")
  });
  documento.set("servers", [
    { url: "/v1", description: "Gateway que sirve esta documentacion" },
    { url: "http://localhost:8080/v1", description: "Local (Docker Compose)" },
    { url: "https://api.resuelve.com/v1", description: "Produccion" }
  ]);

  fs.writeFileSync(DESTINO, ENCABEZADO + documento.toString({ lineWidth: 0 }));
  console.log(`Contrato del Frontend generado: ${path.relative(process.cwd(), DESTINO)} (version ${versionGateway})`);
}

generar();
