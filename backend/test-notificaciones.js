import dotenv from 'dotenv';
import { conectarDB } from './config/db.js';
import { enviarNotificacionBD } from './helpers/notificaciones.js';
import { ClienteHistorialModel } from './models/ClienteHistorial.js';

dotenv.config();

async function probarSistema() {
  console.log('----------------------------------------------------');
  console.log('🧪 INICIANDO PRUEBA DE CONEXIÓN A BD Y NOTIFICACIÓN WEBHOOK (/backend)');
  console.log('----------------------------------------------------');

  try {
    // 1. Probar Conexión a MongoDB Atlas
    console.log('\nStep 1: Conectando a MongoDB Atlas...');
    await conectarDB();
    console.log('✅ Conexión a MongoDB Atlas VERIFICADA.');

    // 2. Disparar Notificación de Prueba Éxito
    console.log('\nStep 2: Enviando notificación de prueba a Slack/Discord Webhook...');
    const resNotifExito = await enviarNotificacionBD('Prueba Inicial Sistema BD (/backend)', {
      identificacion: '1720000002',
      modulo: 'Test Local Backend',
      estado: 'Conexión y Notificaciones OK',
      detalles: 'Evaluación ejecutada directamente en /backend'
    });

    if (resNotifExito) {
      console.log('✅ Notificación Webhook enviada con ÉXITO.');
    } else {
      console.log('⚠️ La notificación Webhook se ejecutó (Revisa la URL en tu /backend/.env si es un placeholder).');
    }

    // 3. Probar Operación DB (Inserción o Consulta)
    console.log('\nStep 3: Ejecutando consulta de prueba en MongoDB Atlas...');
    const clientePrueba = await ClienteHistorialModel.findOne({ identificacion: '1720000002' }).lean();
    
    await enviarNotificacionBD('Consulta Historial Cliente - Prueba Local (/backend)', {
      identificacion: '1720000002',
      encontrado: Boolean(clientePrueba),
      ingresosDeclarados: clientePrueba ? clientePrueba.ingresosDeclarados : 1500
    });
    console.log('✅ Operación en MongoDB Atlas completada y notificada.');

    // 4. Disparar Notificación de Prueba Error (Simulado)
    console.log('\nStep 4: Probando notificación de Error Simulado...');
    await enviarNotificacionBD('Error MongoDB - Prueba de Alerta (/backend)', {
      identificacion: '9999999999',
      error: 'Simulación de fallo en consulta MongoDB para verificar alerta en tiempo real'
    });
    console.log('✅ Notificación de error probada exitosamente.');

    console.log('\n----------------------------------------------------');
    console.log('🎉 TODAS LAS PRUEBAS EN /backend FINALIZARON CORRECTAMENTE');
    console.log('----------------------------------------------------');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ ERROR EN LA PRUEBA EN /backend:', error.message);
    process.exit(1);
  }
}

probarSistema();
