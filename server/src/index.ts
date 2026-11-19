import { createApp } from './app';
import { loadConfig } from './config';

const config = loadConfig();
const { http } = createApp(config);

http.listen(config.port, () => {
  console.log(`✦ ARCANA server listening on :${config.port}`);
  console.log(`  CORS origins: ${config.corsOrigins === '*' ? '*' : config.corsOrigins.join(', ')}`);
});

const shutdown = () => {
  console.log('Shutting down…');
  http.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
