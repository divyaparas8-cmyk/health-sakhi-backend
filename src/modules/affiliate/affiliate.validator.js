const { body, param, query, validationResult } = require('express-validator');
const { ApiError } = require('../../middlewares/errorHandler');

const validate = (validations) => {
  return async (req, res, next) => {
    for (const validation of validations) {
      const result = await validation.run(req);
      if (result.errors.length) break;
    }
    const errors = validationResult(req);
    if (errors.isEmpty()) return next();
    next(new ApiError(400, 'VALIDATION_ERROR', errors.array()[0].msg, errors.array()));
  };
};

const uuidParamValidator = (paramName) => [
  param(paramName).trim().isUUID().withMessage(`Invalid ${paramName} parameter. Must be a valid UUID.`)
];

const registerAffiliateValidator = validate([
  body('website_url').optional().trim().isURL().withMessage('website_url must be a valid URL.'),
  body('payment_details').notEmpty().withMessage('payment_details are required to register.')
]);

const createLinkValidator = validate([
  body('unique_slug')
    .trim()
    .notEmpty().withMessage('unique_slug is required.')
    .matches(/^[a-zA-Z0-9-]+$/).withMessage('unique_slug must contain only letters, numbers, and hyphens.')
    .isLength({ min: 3, max: 100 }).withMessage('unique_slug must be between 3 and 100 characters.'),
  body('target_url')
    .trim()
    .notEmpty().withMessage('target_url is required.')
    .isURL().withMessage('target_url must be a valid URL.')
]);

const trackClickValidator = validate([
  body('referral_code').optional().trim().isLength({ min: 3, max: 50 }).withMessage('referral_code must be between 3 and 50 characters.'),
  body('unique_slug').optional().trim().isLength({ min: 3, max: 100 }).withMessage('unique_slug must be between 3 and 100 characters.')
]);

const requestPayoutValidator = validate([
  body('amount')
    .isFloat({ min: 1.0 }).withMessage('Payout amount must be a positive number of at least 1.0.'),
  body('payout_method')
    .trim()
    .notEmpty().withMessage('payout_method is required (e.g. Bank Transfer, UPI, PayPal).')
]);

module.exports = {
  registerAffiliateValidator,
  createLinkValidator,
  trackClickValidator,
  requestPayoutValidator,
  uuidParamValidator
};
