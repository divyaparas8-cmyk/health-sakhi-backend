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

const uuidParam = (name) => [
  param(name).isUUID().withMessage(`${name} must be a valid UUID.`)
];

// Book progress
const bookProgressValidator = validate([
  body('chapter_id').trim().isUUID().withMessage('chapter_id must be a valid UUID.'),
  body('last_read_page').isInt({ min: 1 }).withMessage('last_read_page must be a positive integer.'),
  body('completion_percentage')
    .isFloat({ min: 0, max: 100 }).withMessage('completion_percentage must be between 0 and 100.')
]);

// Video progress
const videoProgressValidator = validate([
  body('last_watched_timestamp')
    .isInt({ min: 0 }).withMessage('last_watched_timestamp must be a non-negative integer (seconds).'),
  body('completed').isBoolean().withMessage('completed must be a boolean.')
]);

const getBookValidator = validate([
  ...uuidParam('id')
]);

const getChapterValidator = validate([
  ...uuidParam('bookId'),
  ...uuidParam('chapterId')
]);

const saveBookProgressValidator = validate([
  ...uuidParam('bookId'),
  body('chapter_id').trim().isUUID().withMessage('chapter_id must be a valid UUID.'),
  body('last_read_page').isInt({ min: 1 }).withMessage('last_read_page must be a positive integer.'),
  body('completion_percentage')
    .isFloat({ min: 0, max: 100 }).withMessage('completion_percentage must be between 0 and 100.')
]);

const saveVideoProgressValidator = validate([
  ...uuidParam('videoId'),
  body('last_watched_timestamp')
    .isInt({ min: 0 }).withMessage('last_watched_timestamp must be a non-negative integer (seconds).'),
  body('completed').isBoolean().withMessage('completed must be a boolean.')
]);

module.exports = {
  bookProgressValidator,
  videoProgressValidator,
  uuidParam,
  getBookValidator,
  getChapterValidator,
  saveBookProgressValidator,
  saveVideoProgressValidator
};
