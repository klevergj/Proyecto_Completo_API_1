import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8092;

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`[Repositorio Interno :${PORT}] ${req.method} ${req.url}`);
  next();
});

/**
 * GET /clientes/:identificacion/historial y GET /v1/clientes/:identificacion/historial
 */
const handleHistorialCliente = (req, res) => {
  const { identificacion } = req.params;

  // 1. Simular cliente nuevo (HTTP 404)
  if (identificacion.endsWith('00') || identificacion.startsWith('00') || identificacion.endsWith('404')) {
    return res.status(404).json({
      codigo: 'CLIENTE_NO_ENCONTRADO',
      mensaje: `No existe historial interno registrado para el cliente ${identificacion} (Cliente nuevo)`
    });
  }

  // 2. Simular cliente con mora interna vigente (ID termina o empieza en 99)
  const tieneMora = identificacion.endsWith('99') || identificacion.startsWith('99');

  return res.status(200).json({
    identificacion,
    tieneMoraVigente: tieneMora,
    creditosPrevios: tieneMora ? 2 : 1,
    ingresosDeclarados: tieneMora ? 400.00 : 1500.00,
    antiguedadMeses: tieneMora ? 6 : 24
  });
};

app.get('/clientes/:identificacion/historial', handleHistorialCliente);
app.get('/v1/clientes/:identificacion/historial', handleHistorialCliente);

app.get('/health', (req, res) => {
  res.json({
    status: 'UP',
    service: 'Repositorio Interno de Clientes',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`📦 Repositorio Interno iniciado en puerto ${PORT}`);
  console.log(`👤 Historial endpoint: GET http://localhost:${PORT}/v1/clientes/:identificacion/historial`);
  console.log(`====================================================`);
});
