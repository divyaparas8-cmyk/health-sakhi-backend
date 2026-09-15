const prisma = require('../../../config/database');
const logger = require('../../../utils/logger');
const openaiService = require('./openai.service');

/**
 * Extract persistent memory entities from user message using OpenAI.
 */
const extractMemoriesWithAI = async (userId, messageText) => {
  try {
    const messages = [
      {
        role: 'system',
        content: `You are a specialized wellness memory extraction engine. Analyze the user's chat message and extract any persistent facts or updates in these categories:
1. PREFERENCE: (e.g., diet type like vegan/vegetarian, sleep schedules, exercise habits, interests).
2. FAMILY: (e.g., family size, kids, dependents).
3. RELATIONSHIP: (e.g., marital status, relationship problems, social support issues).
4. WELLNESS_GOAL: (e.g., desire to reduce stress, lose weight, drink more water, start meditating).
5. MEDICAL_CONDITION: (e.g., PCOD/PCOS, thyroid issues, diabetes, chronic pain, migraine).
6. FINANCIAL_GOAL: (e.g., savings goals, budgeting for healthcare/wellness).

Output MUST be a valid JSON array of objects. If no persistent facts are found, output an empty array: [].
Do NOT wrap the output in markdown code blocks or add any comments/text outside the JSON structure.

Each object must have the following fields:
- category: String (must be one of: PREFERENCE, FAMILY, RELATIONSHIP, WELLNESS_GOAL, MEDICAL_CONDITION, FINANCIAL_GOAL)
- key: String (snake_case identifier, e.g., 'diet_preference', 'family_status', 'relationship_stress', 'hydration_goal', 'pcos_status', 'savings_target')
- value: Any (JSON-compatible value, e.g. "vegetarian", {"status": "married", "issues": true}, "PCOS diagnosed")
- confidence: Float (0.0 to 1.0 depending on how direct or implied the statement is)

Example Input: "I have been struggling with PCOD since last year and want to transition to a vegan diet."
Example Output:
[
  {"category": "MEDICAL_CONDITION", "key": "pcod_status", "value": "Struggling with PCOD since last year", "confidence": 1.0},
  {"category": "PREFERENCE", "key": "diet_preference", "value": "vegan", "confidence": 0.9}
]`
      },
      {
        role: 'user',
        content: `Extract from message: "${messageText}"`
      }
    ];

    const result = await openaiService.generateChatCompletion(messages, userId, {
      action: 'MEMORY_EXTRACTION',
      temperature: 0.1, // very low temperature for structural accuracy
      max_tokens: 500
    });

    let cleanedReply = result.reply.trim();
    // Remove markdown code fence wraps if the model added them anyway
    if (cleanedReply.startsWith('```json')) {
      cleanedReply = cleanedReply.substring(7, cleanedReply.length - 3).trim();
    } else if (cleanedReply.startsWith('```')) {
      cleanedReply = cleanedReply.substring(3, cleanedReply.length - 3).trim();
    }

    const entities = JSON.parse(cleanedReply);
    if (!Array.isArray(entities)) {
      logger.warn(`OpenAI returned non-array format for memory extraction: ${cleanedReply}`);
      return [];
    }

    return entities;
  } catch (error) {
    logger.error(`Error in extractMemoriesWithAI: ${error.message}`);
    return [];
  }
};

/**
 * Save extracted memories into the AIMemory database table.
 */
const saveExtractedMemories = async (userId, entities, sourceMsg) => {
  const savedMemories = [];

  for (const entity of entities) {
    const { category, key, value, confidence } = entity;
    if (!category || !key || value === undefined) continue;

    try {
      const memory = await prisma.aIMemory.upsert({
        where: {
          userId_key: {
            userId,
            key
          }
        },
        update: {
          category,
          value,
          confidence: confidence || 1.0,
          sourceMsg,
          updatedAt: new Date()
        },
        create: {
          userId,
          category,
          key,
          value,
          confidence: confidence || 1.0,
          sourceMsg
        }
      });

      savedMemories.push(memory);
      logger.info(`Successfully stored AIMemory [${key}] for user ${userId}`);
    } catch (err) {
      logger.error(`Failed to upsert memory [${key}] for user ${userId}: ${err.message}`);
    }
  }

  return savedMemories;
};

/**
 * Orchestrator method to extract and save.
 */
const processMessageForMemories = async (userId, messageText) => {
  const extracted = await extractMemoriesWithAI(userId, messageText);
  if (extracted && extracted.length > 0) {
    return await saveExtractedMemories(userId, extracted, messageText);
  }
  return [];
};

module.exports = {
  extractMemoriesWithAI,
  saveExtractedMemories,
  processMessageForMemories
};
