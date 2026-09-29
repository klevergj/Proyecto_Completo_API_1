import { jest } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../server.js';
import { ClienteHistorialModel } from '../../models/ClienteHistorial.js';
import { BuroCreditoModel } from '../../models/BuroCredito.js';
import { AuditoriaModel } from '../../models/Auditoria.js';

describe('API Evaluacion de Credito', () => {
  let token;
  const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_key_resuelve_openapi_2026';

  beforeAll(() => {
    AuditoriaModel.create = jest.fn();
    AuditoriaModel.countDocuments = jest.fn().mockResolvedValue(0);
    AuditoriaModel.find = jest.fn().mockReturnValue({ sort: jest.fn().mockReturnValue({ skip: jest.fn().mockReturnValue({ limit: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }) }) }) });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('1) Emisión de tokens OAuth2 / JWT', () => {
    it('debería emitir un token correctamente', async () => {
      const res = await request(app)
        .post('/oauth/token')
        .send({ grant_type: 'client_credentials' });
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('access_token');
      expect(res.body.token_type).toBe('Bearer');
      
      token = res.body.access_token;
      const decoded = jwt.verify(token, JWT_SECRET);
      expect(decoded.client_id).toBe('frontend-tiendas');
    });

    it('debería fallar si grant_type es inválido', async () => {
      const res = await request(app)
        .post('/oauth/token')
        .send({ grant_type: 'password' });
      
      expect(res.status).toBe(400);
      expect(res.body.codigo).toBe('GRANT_TYPE_INVALIDO');
    });
  });

  describe('2) Motor de reglas y Endpoints (200, 400, 429)', () => {
    beforeAll(() => {
      token = jwt.sign({ client_id: 'test' }, JWT_SECRET, { expiresIn: '1h' });
    });

    it('debería retornar 400 si falta identificación', async () => {
      const res = await request(app)
        .post('/v1/evaluaciones-credito')
        .set('Authorization', `Bearer ${token}`)
        .send({ montoSolicitado: 1000, plazoMeses: 12 });
      
      expect(res.status).toBe(400);
      expect(res.body.codigo).toBe('PARAMETROS_INVALIDOS');
    });

    it('Caso Aprobación: historial limpio, buen score, monto < 5000', async () => {
      jest.spyOn(ClienteHistorialModel, 'findOne').mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
      jest.spyOn(BuroCreditoModel, 'findOne').mockReturnValue({ lean: jest.fn().mockResolvedValue({ score: 750, tieneMoraBuro: false, reportadoEnMora: false }) });

      const res = await request(app)
        .post('/v1/evaluaciones-credito')
        .set('Authorization', `Bearer ${token}`)
        .send({ identificacion: '1234567890', montoSolicitado: 1000 });
      
      expect(res.status).toBe(200);
      expect(res.body.decision).toBe('APROBADO');
    });

    it('Caso Rechazo por Mora', async () => {
      jest.spyOn(ClienteHistorialModel, 'findOne').mockReturnValue({ lean: jest.fn().mockResolvedValue({ tieneMoraVigente: true }) });
      jest.spyOn(BuroCreditoModel, 'findOne').mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });

      const res = await request(app)
        .post('/v1/evaluaciones-credito')
        .set('Authorization', `Bearer ${token}`)
        .send({ identificacion: 'MORA-CLIENT', montoSolicitado: 1000 });
      
      expect(res.status).toBe(200);
      expect(res.body.decision).toBe('RECHAZADO');
      expect(res.body.motivo).toMatch(/Mora vigente/);
    });

    it('Caso Revisión Manual por monto > 5000', async () => {
      jest.spyOn(ClienteHistorialModel, 'findOne').mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
      jest.spyOn(BuroCreditoModel, 'findOne').mockReturnValue({ lean: jest.fn().mockResolvedValue({ score: 750 }) });

      const res = await request(app)
        .post('/v1/evaluaciones-credito')
        .set('Authorization', `Bearer ${token}`)
        .send({ identificacion: 'HIGH-AMOUNT', montoSolicitado: 6000 });
      
      expect(res.status).toBe(200);
      expect(res.body.decision).toBe('REVISION_MANUAL');
    });

    it('debería retornar 429 por rate limit en múltiples requests (Simulado)', async () => {
      // Configurar rateLimit a 100 implica hacer 101 requests para llegar al límite en testing real,
      // Pero como estamos validando si la ruta maneja el límite, enviaremos 101 peticiones asincrónicas.
      const requests = Array.from({ length: 105 }).map(() =>
        request(app)
          .post('/v1/evaluaciones-credito')
          .set('Authorization', `Bearer ${token}`)
          .send({ identificacion: '123', montoSolicitado: 1000 })
      );
      
      const responses = await Promise.all(requests);
      const rateLimited = responses.find(r => r.status === 429);
      
      expect(rateLimited).toBeDefined();
      expect(rateLimited.body.codigo).toBe('LIMITE_TASA_EXCEDIDO');
    });
  });
});
