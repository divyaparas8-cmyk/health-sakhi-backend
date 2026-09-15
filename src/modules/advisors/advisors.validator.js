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

const createAvailabilityValidator = validate([
  body('date')
    .trim()
    .notEmpty().withMessage('Date is required.')
    .isISO8601().withMessage('Date must be a valid ISO-8601 date.'),
  body('startTime')
    .trim()
    .notEmpty().withMessage('Start time is required.')
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/).withMessage('Start time must be in HH:MM or HH:MM:SS format.'),
  body('endTime')
    .trim()
    .notEmpty().withMessage('End time is required.')
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/).withMessage('End time must be in HH:MM or HH:MM:SS format.')
]);

const bookAppointmentValidator = validate([
  body('advisor_id')
    .trim()
    .notEmpty().withMessage('advisor_id is required.')
    .isUUID().withMessage('advisor_id must be a valid UUID.'),
  body('availability_id')
    .trim()
    .notEmpty().withMessage('availability_id is required.')
    .isUUID().withMessage('availability_id must be a valid UUID.')
]);

const submitNotesValidator = validate([
  ...uuidParamValidator('id'),
  body('symptoms').optional().trim(),
  body('diagnosis').optional().trim(),
  body('treatment_plan')
    .trim()
    .notEmpty().withMessage('Treatment plan is required.'),
  body('prescriptions').optional().trim()
]);

const rescheduleAppointmentValidator = validate([
  ...uuidParamValidator('id'),
  body('new_availability_id')
    .trim()
    .notEmpty().withMessage('new_availability_id is required.')
    .isUUID().withMessage('new_availability_id must be a valid UUID.')
]);

const cancelAppointmentValidator = validate([
  ...uuidParamValidator('id')
]);

module.exports = {
  createAvailabilityValidator,
  bookAppointmentValidator,
  submitNotesValidator,
  rescheduleAppointmentValidator,
  cancelAppointmentValidator,
  uuidParamValidator
};
