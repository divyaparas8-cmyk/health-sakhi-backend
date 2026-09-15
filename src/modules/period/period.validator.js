const { body, query, validationResult } = require('express-validator');
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

const setupProfileValidator = validate([
  body('cycleLength')
    .optional()
    .isInt({ min: 21, max: 45 }).withMessage('Cycle length must be between 21 and 45 days.'),
  body('periodLength')
    .optional()
    .isInt({ min: 2, max: 10 }).withMessage('Period length must be between 2 and 10 days.'),
  body('lastPeriodDate')
    .notEmpty().withMessage('Last period date is required.')
    .isISO8601().withMessage('Last period date must be a valid ISO-8601 date.')
]);

const updateProfileValidator = validate([
  body('cycleLength')
    .optional()
    .isInt({ min: 21, max: 45 }).withMessage('Cycle length must be between 21 and 45 days.'),
  body('periodLength')
    .optional()
    .isInt({ min: 2, max: 10 }).withMessage('Period length must be between 2 and 10 days.'),
  body('lastPeriodDate')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601().withMessage('Last period date must be a valid ISO-8601 date.')
]);

const logPeriodValidator = validate([
  body('logDate')
    .notEmpty().withMessage('Log date is required.')
    .isISO8601().withMessage('Log date must be a valid ISO-8601 date.'),
  body('mood').optional().trim().isLength({ max: 50 }),
  body('pain').optional().trim().isLength({ max: 50 }),
  body('flow').optional().trim().isLength({ max: 50 }),
  body('energy').optional().trim().isLength({ max: 50 }),
  body('notes').optional().trim()
]);

const getCalendarValidator = validate([
  query('month')
    .notEmpty().withMessage('Month is required.')
    .isInt({ min: 1, max: 12 }).withMessage('Month must be between 1 and 12.'),
  query('year')
    .notEmpty().withMessage('Year is required.')
    .isInt({ min: 2000, max: 2100 }).withMessage('Year must be valid.')
]);

const startPeriodValidator = validate([
  body('startDate')
    .notEmpty().withMessage('Start date is required.')
    .isISO8601().withMessage('Start date must be a valid ISO-8601 date.'),
  body('endDate')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601().withMessage('End date must be a valid ISO-8601 date.')
]);

module.exports = {
  setupProfileValidator,
  updateProfileValidator,
  logPeriodValidator,
  getCalendarValidator,
  startPeriodValidator
};
