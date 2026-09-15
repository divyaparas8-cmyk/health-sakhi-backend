const { body, validationResult } = require('express-validator');
const { ApiError } = require('../../middlewares/errorHandler');

const validate = (validations) => {
  return async (req, res, next) => {
    for (let validation of validations) {
      const result = await validation.run(req);
      if (result.errors.length) break;
    }

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    const errorMsg = errors.array()[0].msg;
    next(new ApiError(400, 'VALIDATION_ERROR', errorMsg, errors.array()));
  };
};

const loginValidator = validate([
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required.')
    .isEmail().withMessage('Invalid email address format.'),
  body('password')
    .trim()
    .notEmpty().withMessage('Password is required.'),
  body('role')
    .trim()
    .notEmpty().withMessage('Role is required.')
    .isIn(['member', 'advisor', 'affiliate', 'admin']).withMessage('Invalid role specified.')
]);

const verifyOtpValidator = validate([
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required.')
    .isEmail().withMessage('Invalid email address format.'),
  body('otp')
    .trim()
    .notEmpty().withMessage('OTP is required.')
    .isLength({ min: 6, max: 6 }).withMessage('OTP must be exactly 6 numeric digits.')
    .isNumeric().withMessage('OTP must contain only numbers.')
]);

const refreshTokenValidator = validate([
  body('refreshToken')
    .trim()
    .notEmpty().withMessage('Refresh token is required.')
]);

module.exports = {
  loginValidator,
  verifyOtpValidator,
  refreshTokenValidator
};
