const translator = require('../utils/translator');
const logger = require('../utils/logger');

/**
 * Global translation middleware that intercepts Express res.json
 * and dynamically translates display fields using Gemini API
 */
const autoTranslateMiddleware = async (req, res, next) => {
  try {
    const rawLang = req.headers['accept-language'] || 'en';
    const lang = rawLang.toLowerCase().substring(0, 2);

    // Skip translation if language is English or not supported
    if (lang !== 'hi' && lang !== 'mr') {
      return next();
    }

    const originalJson = res.json;

    // Override res.json to translate data dynamically before sending
    res.json = async function (body) {
      // Restore res.json to original function to avoid infinite recursion
      res.json = originalJson;

      try {
        body = await translator.translateDeep(body, lang);
      } catch (err) {
        logger.error(`[Translation Middleware Error] ${err.message}`);
      }

      return res.json(body);
    };

    next();
  } catch (err) {
    logger.error(`[Translation Middleware Setup Error] ${err.message}`);
    next();
  }
};

module.exports = {
  autoTranslateMiddleware
};
