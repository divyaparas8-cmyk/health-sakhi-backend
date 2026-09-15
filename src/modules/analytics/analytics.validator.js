const { body, query } = require('express-validator');
const { validate } = require('../notifications/notifications.validator'); // Re-use the validate helper

const trackEventValidator = validate([
  body('event_name')
    .trim()
    .notEmpty().withMessage('event_name is required.')
    .isLength({ max: 100 }).withMessage('event_name must be under 100 characters.'),
  body('event_data')
    .optional()
    .isObject().withMessage('event_data must be a valid JSON object.')
]);

const queryDateRangeValidator = validate([
  query('startDate')
    .optional()
    .trim()
    .isISO8601().withMessage('startDate must be a valid ISO-8601 date.'),
  query('endDate')
    .optional()
    .trim()
    .isISO8601().withMessage('endDate must be a valid ISO-8601 date.')
]);

module.exports = {
  trackEventValidator,
  queryDateRangeValidator
};
