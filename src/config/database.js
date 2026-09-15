const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');
const environment = require('./environment');

let prisma;

if (environment.nodeEnv === 'production') {
  prisma = new PrismaClient();
} else {
  // Prevent multiple instances of Prisma Client in development (due to hot reloading)
  if (!global.prisma) {
    global.prisma = new PrismaClient({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'info' },
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' }
      ]
    });

    global.prisma.$on('query', (e) => {
      logger.debug(`Query: ${e.query} - Params: ${e.params} - Duration: ${e.duration}ms`);
    });

    global.prisma.$on('info', (e) => {
      logger.info(e.message);
    });

    global.prisma.$on('warn', (e) => {
      logger.warn(e.message);
    });

    global.prisma.$on('error', (e) => {
      logger.error(e.message);
    });
  }
  prisma = global.prisma;
}

module.exports = prisma;
