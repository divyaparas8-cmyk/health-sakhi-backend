const morgan = require('morgan');
const logger = require('../utils/logger');
const environment = require('../config/environment');

const morganFormat = environment.nodeEnv === 'development' ? 'dev' : 'combined';

const stream = {
  write: (message) => {
    // Strip trailing newlines from Morgan messages before logging
    logger.info(message.trim());
  }
};

const loggingMiddleware = morgan(morganFormat, { stream });

module.exports = loggingMiddleware;
