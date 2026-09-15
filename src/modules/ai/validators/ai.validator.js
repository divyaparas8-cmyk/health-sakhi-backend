const Joi = require('joi');
const { ApiError } = require('../../../middlewares/errorHandler');

const chatSchema = Joi.object({
  message: Joi.string().trim().required().messages({
    'string.empty': 'Message text is required.',
    'any.required': 'Message text is required.'
  }),
  session_id: Joi.string().guid({ version: 'uuidv4' }).optional().messages({
    'string.guid': 'Session ID must be a valid UUID.'
  })
});

const actionSchema = Joi.object({
  action_id: Joi.string().guid({ version: 'uuidv4' }).optional().messages({
    'string.guid': 'Action ID must be a valid UUID.'
  }),
  action_type: Joi.string().valid('LOG_MOOD', 'CREATE_EXPENSE', 'LOG_PERIOD', 'BOOK_ADVISOR').optional().messages({
    'any.only': 'Action type must be one of: LOG_MOOD, CREATE_EXPENSE, LOG_PERIOD, BOOK_ADVISOR.'
  }),
  session_id: Joi.string().guid({ version: 'uuidv4' }).optional().messages({
    'string.guid': 'Session ID must be a valid UUID.'
  }),
  payload: Joi.object().optional()
}).xor('action_id', 'action_type')
  .with('action_type', ['session_id', 'payload']);

const historySchema = Joi.object({
  session_id: Joi.string().guid({ version: 'uuidv4' }).optional().messages({
    'string.guid': 'Session ID must be a valid UUID.'
  })
});

const memoriesSchema = Joi.object({
  category: Joi.string().trim().optional()
});

const validateBody = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      const details = error.details.map(d => ({ message: d.message, path: d.path }));
      return next(new ApiError(400, 'VALIDATION_ERROR', error.details[0].message, details));
    }
    req.body = value;
    next();
  };
};

const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, { abortEarly: false, stripUnknown: true });
    if (error) {
      const details = error.details.map(d => ({ message: d.message, path: d.path }));
      return next(new ApiError(400, 'VALIDATION_ERROR', error.details[0].message, details));
    }
    req.query = value;
    next();
  };
};

module.exports = {
  validateChat: validateBody(chatSchema),
  validateAction: validateBody(actionSchema),
  validateHistory: validateQuery(historySchema),
  validateMemories: validateQuery(memoriesSchema)
};
