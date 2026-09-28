import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Módulo de Conexión a MongoDB Atlas mediante Mongoose.
 * Incluye opciones de timeout, eventos de monitoreo y cierre limpio (graceful shutdown).
 */
export const conectarDB = async () => {
  const mongoURI = process.env.MONGODB_URI;

  if (!mongoURI) {
    console.error('❌ FATAL: La variable MONGODB_URI no está definida en el archivo .env');
    process.exit(1);
  }

  const opcionesConexion = {
    serverSelectionTimeoutMS: 5000, // Timeout para selección de servidor (5s)
    socketTimeoutMS: 45000,         // Timeout para inactividad de socket (45s)
    autoIndex: true
  };

  // Eventos de monitoreo de la conexión Mongoose
  mongoose.connection.on('connected', () => {
    console.log('🟢 [MongoDB Atlas] Conexión establecida correctamente.');
  });

  mongoose.connection.on('error', (err) => {
    console.error(`🔴 [MongoDB Atlas Error] Fallo en la conexión: ${err.message}`);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️ [MongoDB Atlas] Conexión desconectada.');
  });

  // Graceful Shutdown (cierre limpio de la conexión al recibir SIGINT o SIGTERM)
  const cerrarConexionLimpia = async (senial) => {
    console.log(`\n🛑 Recibida señal ${senial}. Cerrando conexión a MongoDB Atlas...`);
    try {
      await mongoose.connection.close();
      console.log('🟢 Conexión a MongoDB cerrada de forma limpia.');
      process.exit(0);
    } catch (err) {
      console.error('❌ Error al cerrar conexión a MongoDB:', err.message);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => cerrarConexionLimpia('SIGINT'));
  process.on('SIGTERM', () => cerrarConexionLimpia('SIGTERM'));

  try {
    console.log('🔄 Conectando a MongoDB Atlas...');
    await mongoose.connect(mongoURI, opcionesConexion);
  } catch (error) {
    console.error('❌ Error inicial al conectar a MongoDB Atlas:', error.message);
    throw error;
  }
};

export default conectarDB;
