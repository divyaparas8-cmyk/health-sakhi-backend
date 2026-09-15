const { body, param, query, validationResult } = require('express-validator');
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

const uuidParamValidator = (paramName) => [
  param(paramName).trim().isUUID().withMessage(`Invalid ${paramName} parameter. Must be a valid UUID.`)
];

const updateProfileValidator = validate([
  body('full_name')
    .trim()
    .notEmpty().withMessage('Full name is required.')
    .isLength({ max: 150 }).withMessage('Full name must be under 150 characters.'),
  body('bio').optional().trim(),
  body('avatar_url').optional().trim().isURL().withMessage('Avatar URL must be a valid URL format.'),
  body('date_of_birth').optional().trim().isISO8601().withMessage('Date of birth must be a valid ISO-8601 date.')
]);

const logMoodValidator = validate([
  body('mood_type')
    .trim()
    .notEmpty().withMessage('Mood type is required.')
    .isIn(['Happy', 'Sad', 'Tired', 'Stressed', 'Grateful', 'Low Energy']).withMessage('Mood type must be one of: Happy, Sad, Tired, Stressed, Grateful, Low Energy.'),
  body('intensity')
    .isInt({ min: 1, max: 5 }).withMessage('Intensity must be an integer between 1 and 5.'),
  body('notes').optional().trim()
]);

const createTodoValidator = validate([
  body('title')
    .trim()
    .notEmpty().withMessage('Task title is required.')
    .isLength({ max: 255 }).withMessage('Task title must be under 255 characters.'),
  body('category')
    .trim()
    .notEmpty().withMessage('Category is required.')
    .isIn(['Health', 'Personal', 'Work']).withMessage('Category must be one of: Health, Personal, Work.'),
  body('due_date')
    .trim()
    .notEmpty().withMessage('Due date is required.')
    .isISO8601().withMessage('Due date must be a valid ISO-8601 date.'),
  body('due_time').optional().trim()
]);

const updateTodoValidator = validate([
  ...uuidParamValidator('id'),
  body('is_completed')
    .isBoolean().withMessage('is_completed must be a boolean (true/false).')
]);

const createTransactionValidator = validate([
  body('category_name')
    .trim()
    .notEmpty().withMessage('Category name is required.')
    .isLength({ max: 50 }).withMessage('Category name must be under 50 characters.'),
  body('type')
    .trim()
    .notEmpty().withMessage('Type is required.')
    .isIn(['income', 'expense']).withMessage('Type must be either income or expense.'),
  body('amount')
    .isFloat({ min: 0.01 }).withMessage('Amount must be a positive number greater than 0.'),
  body('description').optional().trim(),
  body('transaction_date')
    .trim()
    .notEmpty().withMessage('Transaction date is required.')
    .isISO8601().withMessage('Transaction date must be a valid ISO-8601 date.')
]);

const dailyCheckInValidator = validate([
  body('text')
    .trim()
    .notEmpty().withMessage('Check-in text content is required.')
    .isLength({ max: 2000 }).withMessage('Check-in text must be under 2000 characters.')
]);

const updateTransactionValidator = validate([
  ...uuidParamValidator('id'),
  body('category_name')
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage('Category name must be under 50 characters.'),
  body('type')
    .optional()
    .trim()
    .isIn(['income', 'expense']).withMessage('Type must be either income or expense.'),
  body('amount')
    .optional()
    .isFloat({ min: 0.01 }).withMessage('Amount must be a positive number greater than 0.'),
  body('description').optional().trim(),
  body('transaction_date')
    .optional()
    .trim()
    .isISO8601().withMessage('Transaction date must be a valid ISO-8601 date.')
]);

const deleteTransactionValidator = validate([
  ...uuidParamValidator('id')
]);

module.exports = {
  updateProfileValidator,
  logMoodValidator,
  createTodoValidator,
  updateTodoValidator,
  createTransactionValidator,
  updateTransactionValidator,
  deleteTransactionValidator,
  uuidParamValidator,
  dailyCheckInValidator
};
