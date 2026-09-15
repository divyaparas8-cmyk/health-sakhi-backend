const languageService = require('./language.service');
const ttsService = require('./tts.service');
const logger = require('../../utils/logger');
const { ApiError } = require('../../middlewares/errorHandler');

/**
 * Fetch language preferences for current user
 */
async function getLanguagePreference(req, res, next) {
  try {
    const preference = await languageService.getUserLanguage(req.user.id);
    return res.status(200).json({
      success: true,
      preference
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Save language preferences for current user
 */
async function setLanguagePreference(req, res, next) {
  try {
    const { languageCode, voiceEnabled } = req.body;
    
    if (!languageCode) {
      throw new ApiError(400, 'BAD_REQUEST', 'languageCode is required.');
    }

    if (!['en', 'hi', 'mr'].includes(languageCode)) {
      throw new ApiError(400, 'BAD_REQUEST', 'Unsupported language code. Supported: en, hi, mr.');
    }

    const preference = await languageService.setUserLanguage(req.user.id, languageCode, voiceEnabled);
    return res.status(200).json({
      success: true,
      preference
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Generate base64 speech from text
 */
async function generateTts(req, res, next) {
  try {
    const { text, language } = req.body;

    if (!text) {
      throw new ApiError(400, 'BAD_REQUEST', 'text is required.');
    }

    const ttsLanguage = language || 'en';
    if (!['en', 'hi', 'mr'].includes(ttsLanguage)) {
      throw new ApiError(400, 'BAD_REQUEST', 'Unsupported speech language. Supported: en, hi, mr.');
    }

    const audioUrl = await ttsService.generateSpeech(text, ttsLanguage);
    return res.status(200).json({
      success: true,
      audioUrl
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Translate array of texts using Gemini
 */
async function translateTexts(req, res, next) {
  try {
    const { texts, targetLanguage } = req.body;

    if (!texts || !Array.isArray(texts)) {
      throw new ApiError(400, 'BAD_REQUEST', 'texts array is required.');
    }

    const target = targetLanguage || 'en';
    if (!['en', 'hi', 'mr'].includes(target)) {
      throw new ApiError(400, 'BAD_REQUEST', 'Unsupported target language.');
    }

    const translations = await Promise.all(
      texts.map(text => languageService.translateText(text, target, req.user ? req.user.id : null))
    );

    return res.status(200).json({
      success: true,
      translations
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getLanguagePreference,
  setLanguagePreference,
  generateTts,
  translateTexts
};
