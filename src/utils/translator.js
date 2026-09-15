const { GoogleGenerativeAI } = require('@google/generative-ai');
const prisma = require('../config/database');
const logger = require('./logger');

// Initialize Gemini Client
const geminiApiKey = process.env.GEMINI_API_KEY;
let genAI = null;
if (geminiApiKey) {
  genAI = new GoogleGenerativeAI(geminiApiKey);
} else {
  logger.warn('[Translator] GEMINI_API_KEY is not defined in environment variables.');
}

/**
 * Translate a single text string to the target language (hi or mr)
 */
const translateText = async (text, targetLang) => {
  if (!text || typeof text !== 'string' || !text.trim()) return text;
  
  const trimmed = text.trim();
  
  // Safety check: Do not translate URLs, paths, or data-URIs
  if (
    trimmed.startsWith('http://') || 
    trimmed.startsWith('https://') || 
    trimmed.startsWith('/') || 
    trimmed.startsWith('data:') ||
    trimmed.endsWith('.jpg') ||
    trimmed.endsWith('.png') ||
    trimmed.endsWith('.pdf')
  ) {
    return text;
  }

  const normalizedLang = (targetLang || 'en').toLowerCase().substring(0, 2);

  // If target is English or unknown, return original text
  if (normalizedLang === 'en') return text;
  if (normalizedLang !== 'hi' && normalizedLang !== 'mr') return text;

  try {
    // 1. Check cache first
    const cached = await prisma.translationCache.findFirst({
      where: {
        sourceText: trimmed,
        targetLang: normalizedLang
      }
    });

    if (cached) {
      return cached.translatedText;
    }

    // 2. Fallback to Gemini translation if configured
    if (!genAI) {
      return text;
    }

    const langName = normalizedLang === 'hi' ? 'Hindi' : 'Marathi';
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
    // Strict prompt to ensure only the raw translation is returned
    const prompt = `Translate the following text into clear, natural ${langName}. Respond with ONLY the translated text. Do not add any conversational words, introduction, quotes, notes, formatting, or explanation. Output ONLY the raw translation itself:\n\n${trimmed}`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });

    let translatedText = result.response.text().trim();

    // Clean up any accidental markdown or quotes returned by LLM
    if (translatedText.startsWith('"') && translatedText.endsWith('"')) {
      translatedText = translatedText.slice(1, -1).trim();
    }
    if (translatedText.startsWith('`') && translatedText.endsWith('`')) {
      translatedText = translatedText.replace(/`/g, '').trim();
    }
    
    // Strip common conversational Hindi/Marathi prefixes if any
    const prefixesToRemove = [
      'निश्चित रूप से, यहाँ अनुवाद है:',
      'यहाँ अनुवाद है:',
      'निश्चितच, येथे भाषांतर आहे:',
      'येथे भाषांतर आहे:',
      'भाषांतर:'
    ];
    for (const p of prefixesToRemove) {
      if (translatedText.startsWith(p)) {
        translatedText = translatedText.replace(p, '').trim();
      }
    }

    if (translatedText && translatedText !== trimmed) {
      // 3. Save to cache
      try {
        await prisma.translationCache.create({
          data: {
            sourceText: trimmed,
            targetLang: normalizedLang,
            translatedText
          }
        });
      } catch (_cacheErr) {
        // Silently ignore — likely a duplicate key from concurrent requests
      }
      return translatedText;
    }
    
    return text;
  } catch (err) {
    logger.error(`[Translator Error] Failed to translate: ${err.message}`);
    return text; // Safe fallback
  }
};

/**
 * Handle special description markup parsing to avoid URL/tag corruption
 */
const translateDescriptionField = async (descriptionText, targetLang) => {
  if (!descriptionText || typeof descriptionText !== 'string') return descriptionText;

  // Split and translate only user-readable text, keeping [hs_cover] and [hs_chapters] urls intact
  if (descriptionText.includes('[hs_cover]')) {
    const parts = descriptionText.split('[hs_cover]');
    const beforeCover = parts[0] || '';
    const afterCover = parts.slice(1).join('[hs_cover]');
    
    const translatedBefore = await translateText(beforeCover, targetLang);
    return `${translatedBefore.trim()} [hs_cover] ${afterCover.trim()}`;
  }

  return translateText(descriptionText, targetLang);
};

/**
 * Recursively scan response payload and translate whitelisted display fields
 */
const translateDeep = async (obj, targetLang) => {
  if (!obj) return obj;

  if (Array.isArray(obj)) {
    return Promise.all(obj.map(item => translateDeep(item, targetLang)));
  }

  if (typeof obj === 'object') {
    // Return special objects (like Date, Buffers, Decimals) as-is
    if (obj.constructor && obj.constructor.name !== 'Object') {
      return obj;
    }
    // Skip translating the object if it is already in the target language
    const objLangCode = obj.languageCode || obj.language_code;
    if (objLangCode && typeof objLangCode === 'string' && objLangCode.toLowerCase() === targetLang.toLowerCase()) {
      return obj;
    }

    const newObj = { ...obj };
    
    for (const key in newObj) {
      if (newObj[key] && typeof newObj[key] === 'object') {
        newObj[key] = await translateDeep(newObj[key], targetLang);
      } else if (typeof newObj[key] === 'string') {
        const lowercaseKey = key.toLowerCase();
        
        const whitelist = [
          'title', 'desc', 'description', 'content', 'question', 'answer',
          'message', 'quote', 'comment', 'symptoms', 'diagnosis', 'doctornotes',
          'meals', 'harmonynotes', 'gratitude', 'personalnotes', 'name',
          'value', 'featurevalue'
        ];

        if (whitelist.includes(lowercaseKey)) {
          // If key is 'name' and value looks like email or ID, skip it
          if (lowercaseKey === 'name' && (newObj[key].includes('@') || newObj[key].length > 40)) {
            continue;
          }
          
          if (lowercaseKey === 'desc' || lowercaseKey === 'description') {
            newObj[key] = await translateDescriptionField(newObj[key], targetLang);
          } else {
            newObj[key] = await translateText(newObj[key], targetLang);
          }
        }
      }
    }
    return newObj;
  }

  return obj;
};

module.exports = {
  translateText,
  translateDescriptionField,
  translateDeep
};
