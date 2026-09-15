const logger = require('../utils/logger');
const environment = require('../config/environment');

// Standardized API error helper class
class ApiError extends Error {
  constructor(statusCode, errorCode, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let errorCode = err.errorCode || 'INTERNAL_SERVER_ERROR';
  let message = err.message || 'An unexpected error occurred on the server.';
  let details = err.details || null;

  // Log complete error metadata
  logger.error(`${req.method} ${req.url} - Error: ${message}`, {
    stack: err.stack,
    errorCode,
    statusCode,
    details
  });
  
  if (statusCode === 403 || statusCode === 400 || statusCode === 500) {
    console.error(`[ERROR HANDLER] ${statusCode} on ${req.method} ${req.url}:`, message);
    console.error(`Headers:`, req.headers);
    const fs = require('fs');
    const path = require('path');
    const logPath = path.join(__dirname, '../../log.txt');
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${statusCode} on ${req.method} ${req.url}: ${message}\nHeaders: ${JSON.stringify(req.headers)}\nDetails: ${JSON.stringify(details)}\n\n`);
  }

  // Handle specific Prisma errors securely
  if (err.code && err.code.startsWith('P')) {
    statusCode = 400;
    errorCode = 'DATABASE_CONSTRAINT_ERROR';
    if (environment.nodeEnv === 'development') {
      message = `Prisma Database Error: ${err.message}`;
      details = { code: err.code, meta: err.meta };
    } else {
      message = 'A database operation failed validation checks.';
    }
  }

  // Format response body
  const errorResponse = {
    success: false,
    error: errorCode,
    message
  };

  if (details) {
    errorResponse.details = details;
  }

  if (environment.nodeEnv === 'development' && !err.statusCode) {
    errorResponse.stack = err.stack;
  }

  res.status(statusCode).json(errorResponse);
};

module.exports = {
  ApiError,
  errorHandler
};
