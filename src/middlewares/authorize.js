const { ApiError } = require('./errorHandler');

/**
 * Middleware wrapper to validate allowed user roles.
 * @param {Array<string>} allowedRoles - List of permitted roles (e.g. ['admin', 'advisor'])
 */
const authorize = (allowedRoles = []) => {
  return (req, res, next) => {
    try {
      const { user } = req;

      if (!user) {
        throw new ApiError(401, 'UNAUTHORIZED', 'Authentication context missing.');
      }

      if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
        console.error(`AUTHORIZE 403 FAILED: User ${user.email} has role ${user.role}, but allowed roles are: ${allowedRoles.join(', ')}`);
        throw new ApiError(
          403,
          'FORBIDDEN',
          `Access denied. Requires one of the following roles: ${allowedRoles.join(', ')}`
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

module.exports = authorize;
