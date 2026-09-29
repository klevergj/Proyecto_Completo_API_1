import axios from 'axios';

const API_URL = import.meta.env?.VITE_API_BASE_URL || import.meta.env?.VITE_API_URL || (typeof process !== 'undefined' && process.env?.REACT_APP_API_URL) || 'http://localhost:8080';

let cachedToken = null;
let tokenExpiresAt = 0;

/**
 * Solicita o retorna un Token de Acceso OAuth2 válido utilizando el flujo Client Credentials.
 */
export const obtenerTokenOAuth = async (forceRefresh = false) => {
  const now = Date.now();
  if (!forceRefresh && cachedToken && now < tokenExpiresAt) {
    return cachedToken;
  }

  try {
    const response = await axios.post(`${API_URL}/oauth/token`, {
      grant_type: 'client_credentials',
      client_id: 'frontend-tiendas',
      client_secret: 'secret-key-resuelve'
    }, {
      headers: { 'Content-Type': 'application/json' }
    });

    const data = response.data;
    cachedToken = data.access_token;
    tokenExpiresAt = Date.now() + ((data.expires_in || 3600) * 1000) - 10000;
    return cachedToken;
  } catch (error) {
    console.error('Error al obtener token OAuth2:', error);
    if (!error.response) {
      throw new Error('Error de red o CORS al intentar conectar con el servidor (OAuth2). Verifica tu conexión o configuración de red.');
    }
    throw new Error('No se pudo autenticar con el servidor (OAuth2). Verifica que el backend esté en ejecución y los datos de autenticación sean correctos.');
  }
};

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

apiClient.interceptors.request.use(
  async (config) => {
    const token = await obtenerTokenOAuth();
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Network errors (no response from server)
    if (!error.response) {
      return Promise.reject(new Error('Error de conexión con el servidor. Verifica tu conexión a internet o los certificados si usas HTTPS.'));
    }
    
    // Auto-refresh token if 401 Unauthorized
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        await obtenerTokenOAuth(true); // force refresh
        return apiClient(originalRequest);
      } catch (err) {
        return Promise.reject(err);
      }
    }
    
    // Handle Rate Limiting
    if (error.response?.status === 429) {
      return Promise.reject(new Error('Demasiadas solicitudes. Por favor, espere unos segundos.'));
    }

    const msg = error.response?.data?.error?.message || error.response?.data?.mensaje || error.message;
    return Promise.reject(new Error(msg));
  }
);

export const evaluarCredito = async (datosSolicitud) => {
  const payload = {
    identificacion: String(datosSolicitud.identificacion || '').trim(),
    montoSolicitado: Number(datosSolicitud.montoSolicitado) || 0,
    plazoMeses: Number(datosSolicitud.plazoMeses) || 12,
    tiendaId: datosSolicitud.tiendaId || 'TIENDA-001'
  };

  try {
    const response = await apiClient.post('/v1/evaluaciones-credito', payload);
    return response.data;
  } catch (error) {
    if (error.message.includes('Network Error')) {
      throw new Error(`No se pudo conectar con el servidor backend en ${API_URL}.`);
    }
    throw error;
  }
};

export const obtenerEvaluacion = async (id) => {
  try {
    const response = await apiClient.get(`/v1/evaluaciones-credito/${id}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const obtenerAuditorias = async (params = {}) => {
  try {
    const response = await apiClient.get('/v1/auditoria/evaluaciones', { params });
    return response.data;
  } catch (error) {
    throw error;
  }
};
