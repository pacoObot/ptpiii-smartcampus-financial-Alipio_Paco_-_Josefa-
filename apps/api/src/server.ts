import app from './app';
import { env } from './config/env';
import { startNotificationDispatcher } from './modules/financial/application/notificationDeliveryService';

const stopNotificationDispatcher = startNotificationDispatcher();

const server = app.listen(env.PORT, () => {
  console.log('=======================================================');
  console.log(`SMART CAMPUS CORE API running on http://localhost:${env.PORT}`);
  console.log(`Health Check: http://localhost:${env.PORT}/health`);
  console.log(`Swagger Docs: http://localhost:${env.PORT}/api/docs`);
  console.log(`API Base v1:  http://localhost:${env.PORT}/api/v1`);
  console.log('=======================================================');
});

function shutdown() {
  stopNotificationDispatcher();
  console.log('Encerrando o servidor Smart Campus Core API...');
  server.close(() => {
    console.log('Servidor desligado com sucesso.');
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
