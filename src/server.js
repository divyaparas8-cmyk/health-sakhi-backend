const app = require('./app');
// Force nodemon reload for GEMINI_API_KEY update and port release
const environment = require('./config/environment');
const logger = require('./utils/logger');
const prisma = require('./config/database');
const { startYoutubeCron, stopYoutubeCron } = require('./modules/content/youtube.cron');
const { initializeLibraryVideos } = require('./modules/content-asset/libraryVideoResolver');

const server = app.listen(environment.port, () => {
  logger.info(`===================================================`);
  logger.info(`health sakhi ver listening on port: ${environment.port}`);
  logger.info(`Active Profile mode: ${environment.nodeEnv}`);
  logger.info(`===================================================`);

  // Start YouTube auto-sync cron (immediate first run + every 12h)
  startYoutubeCron();

  // Seed/initialize baseline dynamic library videos from YouTube/Fallback
  initializeLibraryVideos();
});

// Process signal monitoring for graceful termination
const gracefulShutdown = async (signal) => {
  logger.info(`Received signal ${signal}. Initiating safe process shutdown...`);

  // 1. Stop receiving new HTTP requests
  server.close(async () => {
    logger.info('HTTP server terminated.');

    try {
      // 2. Stop YouTube cron scheduler
      stopYoutubeCron();
      // 3. Shut down database connections
      await prisma.$disconnect();
      logger.info('Database client connection closed successfully.');
      process.exit(0);
    } catch (err) {
      logger.error('Failed to close database client connection during shutdown:', err);
      process.exit(1);
    }
  });

  // Force exit if shutdown hangs (e.g. active sockets hold open)
  setTimeout(() => {
    logger.error('Shutdown deadline reached. Forcing immediate termination.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Track and capture unexpected node crash indicators
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception occurred! Logging trace context:');
  logger.error(err.message, { stack: err.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection detected:');
  logger.error(reason instanceof Error ? reason.message : String(reason), {
    stack: reason instanceof Error ? reason.stack : undefined
  });
});
