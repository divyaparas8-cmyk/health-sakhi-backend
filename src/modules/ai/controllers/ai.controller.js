const chatService = require('../services/chat.service');
const actionService = require('../services/action.service');
const memoryService = require('../services/memory.service');

/**
 * Handle AI conversational chat.
 * POST /api/v1/ai/chat
 */
const chat = async (req, res, next) => {
  try {
    const { message, session_id, mode } = req.body;
    const result = await chatService.handleChat(req.user.id, message, session_id, mode);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Execute a parsed or pending polymorphic AI action.
 * POST /api/v1/ai/action
 */
const action = async (req, res, next) => {
  try {
    const { action_id, action_type, session_id, payload } = req.body;
    let result;

    if (action_id) {
      result = await actionService.executeActionById(action_id, req.user.id);
    } else {
      result = await actionService.executeDirectAction(action_type, session_id, payload, req.user.id);
    }

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve chat history sessions or list of messages inside a session.
 * GET /api/v1/ai/history
 */
const getHistory = async (req, res, next) => {
  try {
    const { session_id } = req.query;
    const result = await chatService.getHistory(req.user.id, session_id);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Soft-delete a chat session and all its messages.
 * DELETE /api/v1/ai/history/:sessionId
 */
const deleteSession = async (req, res, next) => {
  try {
    const result = await chatService.deleteSession(req.user.id, req.params.sessionId);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Get long-term memories / preferences extracted for the user.
 * GET /api/v1/ai/memories
 */
const getMemories = async (req, res, next) => {
  try {
    const { category } = req.query;
    const memories = await memoryService.getMemories(req.user.id, category);
    return res.status(200).json({
      success: true,
      memories: memories.map(m => ({
        id: m.id,
        category: m.category,
        key: m.key,
        value: m.value,
        confidence: m.confidence,
        source_msg: m.sourceMsg,
        updated_at: m.updatedAt,
        created_at: m.createdAt
      }))
    });
  } catch (error) {
    next(error);
  }
};

const generateAffirmation = async (req, res, next) => {
  try {
    const { category } = req.body;
    if (!category) {
      return res.status(400).json({ error: 'category is required.' });
    }

    const { generateChatCompletion } = require('../services/openai.service');

    const messages = [
      {
        role: 'system',
        content: `You are an AI wellness guide. Generate an emotionally uplifting and natural affirmation for a women's wellness app, based on the requested category. The affirmation must be unique, natural-sounding, and short (10-25 words).
Return the response strictly as a JSON object matching this schema:
{
  "title": "${category}",
  "affirmation": "<The affirmation text>",
  "imagePrompt": "<A description prompt to generate a matching background image for this affirmation>"
}`
      },
      {
        role: 'user',
        content: `Generate a dynamic affirmation for the category: "${category}".`
      }
    ];

    const result = await generateChatCompletion(messages, req.user.id, {
      temperature: 0.9,
      action: 'AFFIRMATION_GENERATION'
    });

    let cleanReply = result.reply.trim();
    if (cleanReply.startsWith('```')) {
      cleanReply = cleanReply.replace(/^```json\s*/, '').replace(/```$/, '').trim();
    }
    
    let affirmationObj;
    try {
      affirmationObj = JSON.parse(cleanReply);
    } catch (parseErr) {
      // Fallback in case AI doesn't return strict JSON
      affirmationObj = {
        title: category,
        affirmation: cleanReply,
        imagePrompt: `peaceful scene illustrating ${category}`
      };
    }

    const unsplashMapping = {
      'Self Love': 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?q=80&w=800&auto=format&fit=crop',
      'Relationship': 'https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=800&auto=format&fit=crop',
      'Couples': 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?q=80&w=800&auto=format&fit=crop',
      'Meditation': 'https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?q=80&w=800&auto=format&fit=crop',
      'Confidence': 'https://images.unsplash.com/photo-1473968512647-3e447244af8f?q=80&w=800&auto=format&fit=crop',
      'Healing': 'https://images.unsplash.com/photo-1515377905703-c4788e51af15?q=80&w=800&auto=format&fit=crop'
    };

    const mediaUrl = unsplashMapping[category] || 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?q=80&w=800&auto=format&fit=crop';

    return res.status(200).json({
      success: true,
      title: affirmationObj.title || category,
      affirmation: affirmationObj.affirmation,
      imagePrompt: affirmationObj.imagePrompt,
      mediaUrl
    });
  } catch (error) {
    next(error);
  }
};

const generateSpiritualQuote = async (req, res, next) => {
  try {
    const { scripture, category, subcategory, recentQuotes, language, translateFromQuote } = req.body;
    if (!scripture || !category || !subcategory) {
      return res.status(400).json({ error: 'scripture, category, and subcategory are required.' });
    }

    let selectedScripture = scripture;
    if (scripture === 'All') {
      const scriptures = ['Bhagavad Gita', 'Quran', 'Bible', 'Buddhism', 'Sikhism', 'Jainism'];
      selectedScripture = scriptures[Math.floor(Math.random() * scriptures.length)];
    }

    const { generateChatCompletion } = require('../services/openai.service');

    const excludeInstruction = recentQuotes && recentQuotes.length > 0
      ? `\n- Do NOT generate or repeat any of these quotes (avoid them): ${JSON.stringify(recentQuotes)}`
      : '';

    let systemContent = `You are a spiritual wisdom assistant.

Generate authentic and meaningful quotes ONLY from the selected scripture.

Rules:

- Never generate fake verses.
- Never mix scriptures.
- If an exact verse exists, provide it with chapter and verse.
- If exact reference is unavailable, clearly mark it as:
'Inspired by the teachings of ...'
- Keep language simple and extremely easy to understand.
- Maximum 80 words.
- Output JSON only.${excludeInstruction}
- Output all text (including the quote itself, reference, meaning, and application) ONLY in the requested language: ${language || 'English'}.
- CRITICAL for Bhagavad Gita and other Sanskrit sources: Do NOT output the quote/verse in Sanskrit language or Sanskrit grammar (no visargas, halantas, or Sanskrit vocabulary like 'अस्ति', 'भवति'). You MUST translate the quote/verse itself completely into standard spoken ${language || 'English'} so that it can be read easily in ${language || 'English'}.
- The fields 'meaning' and 'application' must be written in simple, everyday spoken ${language || 'English'}. Avoid using complex, formal, or Sanskritized academic terms. It should be highly accessible to common people (Sakhis).

JSON Format:

{
  "quote": "",
  "source": "",
  "reference": "",
  "meaning": "",
  "application": ""
}`;

    let userContent = `Selected Scripture:
${selectedScripture}

Selected Category:
${category}

Selected Subcategory:
${subcategory}`;

    if (translateFromQuote) {
      systemContent = `You are a spiritual wisdom translation assistant.

Translate the provided quote, source, reference, meaning, and application completely into simple, standard ${language || 'English'}.
Maintain the same scripture meaning, but perform a clear translation.

Rules for translation:
- Translate the quote/verse itself completely into standard spoken ${language || 'English'}. Do NOT output the quote in Sanskrit (no Sanskrit grammar, visargas, or halantas).
- The fields 'meaning' and 'application' must be translated into clear, simple, everyday spoken ${language || 'English'}. Do NOT use overly formal, complex, or Sanskritized words.
- Preserve the JSON structure.

JSON Format:

{
  "quote": "",
  "source": "",
  "reference": "",
  "meaning": "",
  "application": ""
}`;

      userContent = `Please translate this quote data into ${language || 'English'}:
${JSON.stringify({ quote: translateFromQuote })}

Make sure the translation is completely accurate and matches the tone of ${selectedScripture}.`;
    }

    const messages = [
      {
        role: 'system',
        content: systemContent
      },
      {
        role: 'user',
        content: userContent
      }
    ];

    const result = await generateChatCompletion(messages, req.user.id, {
      temperature: 0.7,
      action: 'SPIRITUAL_QUOTE_GENERATION',
      responseMimeType: 'application/json'
    });

    let cleanReply = result.reply.trim();
    const jsonMatch = cleanReply.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanReply = jsonMatch[0];
    }
    
    let quoteObj;
    try {
      quoteObj = JSON.parse(cleanReply);
      if (!quoteObj.quote) {
        throw new Error("Missing quote field");
      }
      if (!quoteObj.meaning) {
        quoteObj.meaning = `Reflect on ${subcategory} in daily life.`;
      }
      if (!quoteObj.application) {
        quoteObj.application = `Ponder the values of ${category} today.`;
      }
      if (!quoteObj.source) {
        quoteObj.source = selectedScripture;
      }
      if (!quoteObj.reference) {
        quoteObj.reference = `Inspired by teachings`;
      }
    } catch (parseErr) {
      const quoteMatch = cleanReply.match(/"quote"\s*:\s*"([^"]+)"/);
      const meaningMatch = cleanReply.match(/"meaning"\s*:\s*"([^"]+)"/);
      const appMatch = cleanReply.match(/"application"\s*:\s*"([^"]+)"/);
      const sourceMatch = cleanReply.match(/"source"\s*:\s*"([^"]+)"/);
      const refMatch = cleanReply.match(/"reference"\s*:\s*"([^"]+)"/);

      quoteObj = {
        quote: quoteMatch ? quoteMatch[1] : cleanReply.replace(/[{}"']/g, '').replace(/quote:/g, '').trim(),
        source: sourceMatch ? sourceMatch[1] : selectedScripture,
        reference: refMatch ? refMatch[1] : `Inspired by teachings`,
        meaning: meaningMatch ? meaningMatch[1] : `Reflect on ${subcategory} in daily life.`,
        application: appMatch ? appMatch[1] : `Ponder the values of ${category} today.`
      };
    }

    return res.status(200).json({
      success: true,
      quote: quoteObj.quote,
      source: quoteObj.source,
      reference: quoteObj.reference,
      meaning: quoteObj.meaning,
      application: quoteObj.application
    });
  } catch (error) {
    console.error(`AI Spiritual Quote generation failed: ${error.message}`);
    // Generate fallback quote
    const isHindi = language && (language.toLowerCase() === 'hindi' || language.toLowerCase() === 'hi');
    const isMarathi = language && (language.toLowerCase() === 'marathi' || language.toLowerCase() === 'mr');
    let fallbackQuote;
    if (scripture === 'Quran') {
      if (isHindi) {
        fallbackQuote = {
          quote: "निस्संदेह, कठिनाई के साथ आसानी भी है।",
          source: "Quran",
          reference: "Surah Al-Inshirah 94:6",
          meaning: "हर कठिन समय के बाद राहत और आसानी अवश्य आती है, ईश्वर की योजना पर विश्वास रखें।",
          application: "मुश्किल समय में धैर्य रखें और सकारात्मक सोच बनाए रखें।"
        };
      } else if (isMarathi) {
        fallbackQuote = {
          quote: "खरोखर, प्रत्येक अडचणीसोबत सोपेपणा देखील आहे.",
          source: "Quran",
          reference: "Surah Al-Inshirah 94:6",
          meaning: "प्रत्येक कठीण काळानंतर सोपेपणा आणि आराम नक्कीच येतो, देवाच्या योजनेवर विश्वास ठेवा.",
          application: "कठीण प्रसंगात संयम बाळगा आणि सकारात्मक राहा."
        };
      } else {
        fallbackQuote = {
          quote: "Indeed, with hardship, there is ease.",
          source: "Quran",
          reference: "Surah Al-Inshirah 94:6",
          meaning: "Every difficult phase in life is followed by relief and ease. Trust in the divine timing.",
          application: "Stay patient during trying times and keep moving forward with hope."
        };
      }
    } else if (scripture === 'Bible') {
      if (isHindi) {
        fallbackQuote = {
          quote: "प्रेम धीरजवन्त है, और कृपालु है; प्रेम डाह नहीं करता।",
          source: "Bible",
          reference: "1 Corinthians 13:4",
          meaning: "सच्चा प्रेम हमेशा सहनशील, दयालु और निस्वार्थ होता है।",
          application: "दूसरों के प्रति दया और समझदारी का व्यवहार करें।"
        };
      } else if (isMarathi) {
        fallbackQuote = {
          quote: "प्रीती सहनशील व दयाळू आहे; प्रीती हेवा करत नाही.",
          source: "Bible",
          reference: "1 Corinthians 13:4",
          meaning: "खरे प्रेम नेहमी सहनशील, दयाळू आणि निस्वार्थी असते.",
          application: "इतरांशी दयाळूपणे आणि समजूतदारपणाने वागा."
        };
      } else {
        fallbackQuote = {
          quote: "Love is patient, love is kind. It does not envy, it does not boast.",
          source: "Bible",
          reference: "1 Corinthians 13:4",
          meaning: "True love is defined by patience, kindness, and selflessness rather than jealousy.",
          application: "Practice patience and show gentle kindness to those around you today."
        };
      }
    } else {
      // Default Bhagavad Gita
      if (isHindi) {
        fallbackQuote = {
          quote: "कर्मण्येवाधिकारस्ते मा फलेषु कदाचन।",
          source: "Bhagavad Gita",
          reference: "Chapter 2, Verse 47",
          meaning: "तुम्हारा अधिकार केवल कर्म करने पर है, उसके फलों पर कभी नहीं।",
          application: "परिणामों की चिंता किए बिना अपना सर्वश्रेष्ठ योगदान देने पर ध्यान केंद्रित करें।"
        };
      } else if (isMarathi) {
        fallbackQuote = {
          quote: "तुझा अधिकार फक्त कर्म करण्यावर आहे, त्याच्या फळावर कधीही नाही.",
          source: "Bhagavad Gita",
          reference: "Chapter 2, Verse 47",
          meaning: "तुमचे कर्तव्य पूर्ण समर्पण भावनेने करा, निकालाची किंवा फळाची चिंता करू नका.",
          application: "निकालाची चिंता न करता आपले सर्वोत्तम काम करण्यावर लक्ष केंद्रित करा."
        };
      } else {
        fallbackQuote = {
          quote: "You have a right to perform your prescribed duties, but you are not entitled to the fruits of your actions.",
          source: "Bhagavad Gita",
          reference: "Chapter 2, Verse 47",
          meaning: "Focus entirely on your efforts and duties, rather than worrying about the future results.",
          application: "Do your best in your tasks today without letting the anxiety of outcome stress you."
        };
      }
    }
    return res.status(200).json({
      success: true,
      quote: fallbackQuote.quote,
      source: fallbackQuote.source,
      reference: fallbackQuote.reference,
      meaning: fallbackQuote.meaning,
      application: fallbackQuote.application
    });
  }
};

module.exports = {
  chat,
  action,
  getHistory,
  deleteSession,
  getMemories,
  generateAffirmation,
  generateSpiritualQuote
};

