const prisma = require('../../config/database');
const openaiService = require('../ai/services/openai.service');
const logger = require('../../utils/logger');
const config = require('../../config/environment');

// Cache object for translations
const translationCache = new Map();

/**
 * Set user language preference
 */
async function setUserLanguage(userId, languageCode, voiceEnabled) {
  try {
    const preference = await prisma.userLanguagePreference.upsert({
      where: { userId },
      update: {
        languageCode,
        voiceEnabled: voiceEnabled !== undefined ? voiceEnabled : false
      },
      create: {
        userId,
        languageCode,
        voiceEnabled: voiceEnabled !== undefined ? voiceEnabled : false
      }
    });
    return preference;
  } catch (error) {
    logger.error(`Error in setUserLanguage: ${error.message}`);
    throw error;
  }
}

/**
 * Get user language preference
 */
async function getUserLanguage(userId) {
  try {
    const preference = await prisma.userLanguagePreference.findUnique({
      where: { userId }
    });
    return preference || { languageCode: 'en', voiceEnabled: false };
  } catch (error) {
    logger.error(`Error in getUserLanguage: ${error.message}. Returning default language preference.`);
    return { languageCode: 'en', voiceEnabled: false };
  }
}

/**
 * Translate text using Google Translate unofficial free endpoint.
 * No API key required. Supports hi (Hindi) and mr (Marathi).
 */
async function translateWithGoogle(text, targetLanguage) {
  const MAX_CHUNK = 4500; // Google Translate limit per request
  const chunks = [];
  for (let i = 0; i < text.length; i += MAX_CHUNK) {
    chunks.push(text.slice(i, i + MAX_CHUNK));
  }

  const translated = [];
  for (const chunk of chunks) {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLanguage}&dt=t&q=${encodeURIComponent(chunk)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(10000)
    });

    if (!res.ok) {
      throw new Error(`Google Translate HTTP ${res.status}`);
    }

    const data = await res.json();
    // Google returns [[["translated","original",...], ...], ...]
    if (Array.isArray(data) && Array.isArray(data[0])) {
      const parts = data[0]
        .filter(item => Array.isArray(item) && item[0])
        .map(item => item[0]);
      translated.push(parts.join(''));
    } else {
      translated.push(chunk); // fallback to original
    }
  }

  return translated.join(' ');
}

/**
 * Check if the Gemini API key looks valid (must start with AIzaSy)
 */
function isGeminiKeyValid() {
  const key = config.gemini?.apiKey || process.env.GEMINI_API_KEY || '';
  return key.startsWith('AIzaSy') && key.length > 30;
}

/**
 * Translate text into the target language.
 * Priority: Gemini (if key valid) → Google Translate (free, no key)
 */
async function translateText(text, targetLanguage, userId) {
  if (!text || !targetLanguage || targetLanguage === 'en') {
    return text;
  }

  const cacheKey = `${text.trim().substring(0, 120)}:${targetLanguage}`;
  const cached = translationCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    logger.info(`Translation cache hit for key: ${cacheKey.substring(0, 40)}...`);
    return cached.translatedText;
  }

  let translatedText = text;

  // Try Gemini first (only if key is valid format)
  if (isGeminiKeyValid()) {
    try {
      const langNames = { hi: 'Hindi', mr: 'Marathi', en: 'English' };
      const targetLangName = langNames[targetLanguage] || targetLanguage;
      logger.info(`Translating to ${targetLangName} using Gemini...`);

      const messages = [
        {
          role: 'system',
          content: `You are a professional medical and wellness translator. Translate the following text into simple, natural spoken ${targetLangName}.
Use everyday, common words that are easy for an average local person to read and understand.
Preserve formatting (bullet points, bold text), emotional empathy, and supportive tone.
Translate ONLY the text itself. Do NOT add any introduction, explanations, or meta-comments.`
        },
        { role: 'user', content: text }
      ];

      const result = await openaiService.generateChatCompletion(messages, userId, {
        action: 'TRANSLATION',
        temperature: 0.3,
        max_tokens: 1500
      });

      translatedText = result.reply ? result.reply.trim() : text;
      logger.info('Gemini translation successful.');
    } catch (geminiError) {
      logger.warn(`Gemini translation failed: ${geminiError.message}. Trying Google Translate...`);
    }
  } else {
    logger.info('Gemini API key invalid/missing — skipping, using Google Translate directly.');
  }

  // If Gemini didn't translate (still original text), use Google Translate
  if (translatedText === text) {
    try {
      translatedText = await translateWithGoogle(text, targetLanguage);
      logger.info('Google Translate successful.');
    } catch (googleError) {
      logger.error(`Google Translate failed: ${googleError.message}. Returning original text.`);
      translatedText = text;
    }
  }

  // Cache the translation for 30 minutes
  translationCache.set(cacheKey, {
    translatedText,
    expiresAt: Date.now() + 1800000
  });

  return translatedText;
}

module.exports = {
  setUserLanguage,
  getUserLanguage,
  translateText
};
