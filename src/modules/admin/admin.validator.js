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

const getUsersValidator = validate([
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer.'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be an integer between 1 and 100.'),
  query('role').optional().trim().isIn(['member', 'advisor', 'affiliate', 'admin', 'Member', 'Admin', 'Advisor', 'Affiliate']).withMessage('Invalid role filter.'),
  query('status').optional().trim().isIn(['pending', 'active', 'suspended', 'inactive', 'Pending', 'Active', 'Suspended', 'Inactive']).withMessage('Invalid status filter.')
]);

const updateUserValidator = validate([
  ...uuidParamValidator('id'),
  body('fullName').optional().trim().notEmpty().withMessage('Full name cannot be empty.'),
  body('bio').optional().trim(),
  body('planSlug').optional().trim().notEmpty().withMessage('Plan slug cannot be empty.'),
  body('status').optional().trim().isIn(['Active', 'Pending', 'Suspended', 'Inactive', 'active', 'pending', 'suspended', 'inactive']).withMessage('Status must be Active, Pending, Suspended, or Inactive.')
]);

const suspendUserValidator = validate([
  ...uuidParamValidator('id'),
  body('suspend').isBoolean().withMessage('Suspend value must be a boolean (true/false).'),
  body('reason').optional().trim().notEmpty().withMessage('Reason cannot be empty.')
]);

const approveMemberValidator = validate([
  ...uuidParamValidator('id'),
  body('approve').isBoolean().withMessage('Approve must be a boolean (true/false).'),
  body('notes').optional().trim()
]);

const rejectMemberValidator = validate([
  ...uuidParamValidator('id'),
  body('reject').isBoolean().withMessage('Reject must be a boolean (true/false).'),
  body('notes').optional().trim()
]);

const updateAdvisorStatusValidator = validate([
  ...uuidParamValidator('id'),
  body('status').trim().isIn(['pending', 'approved', 'suspended']).withMessage('Status must be one of: pending, approved, suspended.')
]);

const updateAdvisorValidator = validate([
  ...uuidParamValidator('id'),
  body('qualification').optional().trim().notEmpty().withMessage('Qualification cannot be empty.'),
  body('hourlyRate').optional().isFloat({ min: 0 }).withMessage('Hourly rate must be a non-negative number.'),
  body('bio').optional().trim()
]);

const createPlanValidator = validate([
  body('name').trim().notEmpty().withMessage('Plan name is required.'),
  body('slug').trim().notEmpty().withMessage('Plan slug is required.'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a non-negative number.'),
  body('originalPrice').optional().isFloat({ min: 0 }).withMessage('Original price must be a non-negative number.'),
  body('interval').trim().isIn(['MONTHLY', 'YEARLY']).withMessage('Interval must be MONTHLY or YEARLY.'),
  body('status').optional().trim().isIn(['ACTIVE', 'ARCHIVED']).withMessage('Status must be ACTIVE or ARCHIVED.'),
  body('maxAiChatsPerDay').optional().isInt({ min: -1 }).withMessage('maxAiChatsPerDay must be -1 (unlimited) or positive integer.'),
  body('advisorCredits').optional().isInt({ min: 0 }).withMessage('advisorCredits must be a non-negative integer.'),
  body('features').optional().isArray().withMessage('Features must be an array of features.'),
  body('features.*.featureName').optional().trim().notEmpty().withMessage('Feature name cannot be empty.'),
  body('features.*.featureValue').optional().trim().notEmpty().withMessage('Feature value cannot be empty.')
]);

const updatePlanValidator = validate([
  ...uuidParamValidator('id'),
  body('name').optional().trim().notEmpty().withMessage('Plan name cannot be empty.'),
  body('slug').optional().trim().notEmpty().withMessage('Plan slug cannot be empty.'),
  body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a non-negative number.'),
  body('originalPrice').optional().isFloat({ min: 0 }).withMessage('Original price must be a non-negative number.'),
  body('interval').optional().trim().isIn(['MONTHLY', 'YEARLY']).withMessage('Interval must be MONTHLY or YEARLY.'),
  body('status').optional().trim().isIn(['ACTIVE', 'ARCHIVED']).withMessage('Status must be ACTIVE or ARCHIVED.'),
  body('maxAiChatsPerDay').optional().isInt({ min: -1 }).withMessage('maxAiChatsPerDay must be -1 (unlimited) or positive integer.'),
  body('advisorCredits').optional().isInt({ min: 0 }).withMessage('advisorCredits must be a non-negative integer.'),
  body('features').optional().isArray().withMessage('Features must be an array of features.'),
  body('features.*.featureName').optional().trim().notEmpty().withMessage('Feature name cannot be empty.'),
  body('features.*.featureValue').optional().trim().notEmpty().withMessage('Feature value cannot be empty.')
]);

const createUserValidator = validate([
  body('email').trim().isEmail().withMessage('Valid email address is required.'),
  body('fullName').trim().notEmpty().withMessage('Full name is required.'),
  body('planSlug').optional().trim().notEmpty().withMessage('Plan slug cannot be empty.')
]);

const createAdvisorValidator = validate([
  body('name').trim().notEmpty().withMessage('Advisor name is required.'),
  body('email').trim().isEmail().withMessage('Valid email address is required.'),
  body('specialty').trim().notEmpty().withMessage('Specialty is required.'),
  body('status').trim().isIn(['pending', 'approved', 'Review', 'Pending', 'Approved', 'review']).withMessage('Status must be pending, approved, or Review.')
]);

module.exports = {
  uuidParamValidator,
  getUsersValidator,
  updateUserValidator,
  suspendUserValidator,
  approveMemberValidator,
  rejectMemberValidator,
  updateAdvisorStatusValidator,
  updateAdvisorValidator,
  createPlanValidator,
  updatePlanValidator,
  createUserValidator,
  createAdvisorValidator
};
