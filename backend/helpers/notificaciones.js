import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Envía una notificación en tiempo real a Slack o Discord vía Webhook por cada transacción o error en MongoDB.
 * 
 * @param {string} evento - Nombre del evento (ej: 'Consulta Crédito', 'Inserción Historial', 'Error MongoDB', etc.)
 * @param {Object} detalles - Información relevante (cédula, timestamp, resultado, error, etc.)
 */
export async function enviarNotificacionBD(evento, detalles = {}) {
  const webhookUrl = process.env.WEBHOOK_NOTIFICACIONES_URL;

  if (!webhookUrl || webhookUrl.includes('TU/WEBHOOK/AQUI')) {
    console.warn(`⚠️ [Webhook omitido] URL no configurada en WEBHOOK_NOTIFICACIONES_URL (.env) para el evento [${evento}]`);
    return false;
  }

  const timestamp = new Date().toISOString();
  const esError = evento.toLowerCase().includes('error') || Boolean(detalles.error);

  const emoji = esError ? '🚨' : '💾';
  const estadoBadge = esError ? '🔴 FALLO' : '🟢 ÉXITO';

  // Formatear las propiedades del objeto de detalles para Markdown
  const lineasDetalles = Object.entries(detalles)
    .map(([clave, valor]) => {
      const valorStr = typeof valor === 'object' && valor !== null ? JSON.stringify(valor) : String(valor);
      return `• *${clave}:* \`${valorStr}\``;
    })
    .join('\n');

  const mensajeMarkdown = `${emoji} *[ALERTA BASE DE DATOS]* - *${evento}*\n*Estado:* ${estadoBadge}\n*Timestamp:* \`${timestamp}\`\n${lineasDetalles}`;

  // Payload formateado compatible con Slack y Discord Webhooks
  const payload = {
    text: mensajeMarkdown,
    content: mensajeMarkdown
  };

  try {
    const respuesta = await axios.post(webhookUrl, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000 // Timeout de 5 segundos para no bloquear el flujo principal
    });

    console.log(`📡 [Webhook OK] Notificación enviada para evento: [${evento}] (${respuesta.status})`);
    return true;
  } catch (error) {
    // Se atrapa la excepción sin propagarla para no interrumpir el flujo de la API principal
    const msj = error.response ? `${error.response.status} ${error.response.statusText}` : error.message;
    console.error(`❌ [Webhook Error] No se pudo enviar notificación para [${evento}]:`, msj);
    return false;
  }
}

export default enviarNotificacionBD;
