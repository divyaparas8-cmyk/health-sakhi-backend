const { body, param, validationResult } = require('express-validator');
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

const sendDirectEmailValidator = validate([
  body('to').trim().isEmail().withMessage('Recipient (to) must be a valid email address.'),
  body('subject').trim().notEmpty().withMessage('Subject is required.'),
  body('content').trim().notEmpty().withMessage('Email content (body) is required.')
]);

const createCampaignValidator = validate([
  body('name')
    .trim()
    .notEmpty().withMessage('Campaign name is required.')
    .isLength({ max: 150 }).withMessage('Campaign name must be under 150 characters.'),
  body('targetRole')
    .trim()
    .isIn(['all', 'member', 'advisor', 'affiliate']).withMessage('targetRole must be one of: all, member, advisor, affiliate.'),
  body('channel')
    .trim()
    .isIn(['push', 'email']).withMessage('channel must be push or email.'),
  body('subject')
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage('Subject must be under 200 characters.'),
  body('content')
    .trim()
    .notEmpty().withMessage('Campaign content is required.'),
  body('scheduledAt')
    .optional()
    .trim()
    .isISO8601().withMessage('scheduledAt must be a valid ISO-8601 date.')
]);

const sendDirectNotificationValidator = validate([
  body('userId').trim().isUUID().withMessage('Recipient userId must be a valid UUID.'),
  body('title').trim().notEmpty().withMessage('Title is required.'),
  body('message').trim().notEmpty().withMessage('Message is required.')
]);

module.exports = {
  sendDirectEmailValidator,
  createCampaignValidator,
  sendDirectNotificationValidator,
  uuidParamValidator,
  validate
};
