const jwt = require('jsonwebtoken');
const environment = require('../config/environment');
const prisma = require('../config/database');
const { ApiError } = require('./errorHandler');
const logger = require('../utils/logger');

const authenticate = async (req, res, next) => {
  try {
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.query && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Access token is missing or malformed.');
    }

    let decoded;
    try {
      decoded = jwt.verify(token, environment.jwt.secret);
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        throw new ApiError(401, 'TOKEN_EXPIRED', 'Access token has expired.');
      }
      throw new ApiError(401, 'INVALID_TOKEN', 'Access token signature is invalid.');
    }

    // Query DB to verify actual account status (suspension, approval flags)
    const user = await prisma.user.findFirst({
      where: {
        id: decoded.userId,
        deletedAt: null
      },
      include: {
        role: true
      }
    });

    if (!user) {
      throw new ApiError(401, 'USER_NOT_FOUND', 'User account associated with this token no longer exists.');
    }

    if (user.isSuspended) {
      throw new ApiError(403, 'USER_SUSPENDED', 'Your account has been suspended by an administrator.');
    }

    if (!user.isApproved) {
      throw new ApiError(403, 'PENDING_APPROVAL', 'Your registration request is pending admin approval.');
    }

    // Bind account context values to request object
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role.name,
      isApproved: user.isApproved,
      isSuspended: user.isSuspended
    };

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = authenticate;
