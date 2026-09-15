const { body, param, validationResult } = require('express-validator');
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

const createSessionValidator = validate([
  body('title')
    .optional()
    .trim()
    .isLength({ max: 255 }).withMessage('Session title must be under 255 characters.')
]);

const sendMessageValidator = validate([
  body('session_id')
    .trim()
    .notEmpty().withMessage('session_id is required.')
    .isUUID().withMessage('session_id must be a valid UUID.'),
  body('message')
    .trim()
    .notEmpty().withMessage('message text is required.')
]);

module.exports = {
  createSessionValidator,
  sendMessageValidator
};
