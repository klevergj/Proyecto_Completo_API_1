const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

let cachedToken = null;
let tokenExpiresAt = 0;

/**
 * Solicita o retorna un Token de Acceso OAuth2 válido utilizando el flujo Client Credentials.
 */
export const obtenerTokenOAuth = async () => {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt) {
    return cachedToken;
  }

  try {
    const response = await fetch(`${API_URL}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: 'frontend-tiendas',
        client_secret: 'secret-key-resuelve'
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.mensaje || `Error de autenticación OAuth2 (${response.status})`);
    }

    cachedToken = data.access_token;
    // Expira en Date.now() + (expires_in * 1000) - buffer de 10 seg
    tokenExpiresAt = Date.now() + ((data.expires_in || 3600) * 1000) - 10000;
    return cachedToken;
  } catch (error) {
    console.error('Error al obtener token OAuth2:', error);
    throw new Error('No se pudo autenticar con el servidor (OAuth2). Verifica que el backend esté en ejecución.');
  }
};

/**
 * Envía la solicitud de evaluación de crédito al endpoint principal del backend.
 * 
 * @param {Object} datosSolicitud { identificacion, montoSolicitado, plazoMeses }
 * @returns {Promise<Object>} Resultado de la evaluación (DecisionFrontend)
 */
export const evaluarCredito = async (datosSolicitud) => {
  try {
    const token = await obtenerTokenOAuth();

    const payload = {
      identificacion: String(datosSolicitud.identificacion || '').trim(),
      montoSolicitado: Number(datosSolicitud.montoSolicitado) || 0,
      plazoMeses: Number(datosSolicitud.plazoMeses) || 12,
      tiendaId: datosSolicitud.tiendaId || 'TIENDA-001'
    };

    const response = await fetch(`${API_URL}/v1/evaluaciones-credito`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      const msg = data.error?.message || data.mensaje || `Error en la evaluación de crédito (${response.status})`;
      throw new Error(msg);
    }

    return data;
  } catch (error) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error(`No se pudo conectar con el servidor backend en ${API_URL}. Por favor inicia el servidor backend.`);
    }
    throw error;
  }
};

/**
 * Consulta el estado de una evaluación previa por su UUID.
 * 
 * @param {string} id UUID de la evaluación
 * @returns {Promise<Object>} Detalle almacenado de la evaluación
 */
export const obtenerEvaluacion = async (id) => {
  try {
    const token = await obtenerTokenOAuth();

    const response = await fetch(`${API_URL}/v1/evaluaciones-credito/${id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      const msg = data.error?.message || data.mensaje || `No se pudo encontrar la evaluación (${response.status})`;
      throw new Error(msg);
    }

    return data;
  } catch (error) {
    throw error;
  }
};
