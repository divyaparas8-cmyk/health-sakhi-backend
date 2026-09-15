const prisma = require('../../../config/database');
const logger = require('../../../utils/logger');

/**
 * Save or update user memory.
 */
const saveMemory = async (userId, category, key, value, confidence = 1.0, sourceMsg = null) => {
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
        confidence,
        sourceMsg,
        updatedAt: new Date()
      },
      create: {
        userId,
        category,
        key,
        value,
        confidence,
        sourceMsg
      }
    });
    return memory;
  } catch (error) {
    logger.error(`Error saving memory for user ${userId}: ${error.message}`);
    throw error;
  }
};

/**
 * Retrieve memories for a user, optionally filtered by category.
 */
const getMemories = async (userId, category = null) => {
  try {
    const whereClause = { userId };
    if (category) {
      whereClause.category = category;
    }
    const memories = await prisma.aIMemory.findMany({
      where: whereClause,
      orderBy: { updatedAt: 'desc' }
    });
    return memories;
  } catch (error) {
    logger.error(`Error fetching memories for user ${userId}: ${error.message}`);
    throw error;
  }
};

/**
 * Parse a message to extract preferences, conditions, cycle details, and metrics.
 * Upserts them directly to the database.
 */
const extractMemoriesFromMessage = async (userId, message, messageId = null) => {
  const extracted = [];
  const lowercaseMsg = message.toLowerCase();

  // Pattern rules
  const rules = [
    {
      regex: /(?:i am|i'm|diet is|eating)\s+(vegetarian|vegan|keto|gluten-free|paleo|non-vegetarian)/i,
      category: 'PREFERENCE',
      key: 'diet_preference',
      extractor: (match) => match[1].toLowerCase()
    },
    {
      regex: /(?:cycle length|period length|cycle duration|my cycle is|my period is)\s+(\d+)\s*(?:days|day)/i,
      category: 'CYCLE',
      key: 'cycle_length_days',
      extractor: (match) => parseInt(match[1], 10)
    },
    {
      regex: /(?:diagnosed with|have|suffer from|struggling with|has)\s+(pcod|pcos|thyroid|diabetes|migraine)/i,
      category: 'WELLNESS_PATTERN',
      key: 'primary_condition',
      extractor: (match) => match[1].toUpperCase()
    },
    {
      regex: /(?:sleep|sleeping|sleep for)\s+(\d+)\s*(?:hours|hour)/i,
      category: 'PREFERENCE',
      key: 'sleep_hours_target',
      extractor: (match) => parseInt(match[1], 10)
    },
    {
      regex: /(?:my weight is|weigh|current weight)\s+(\d+)\s*(?:kg|lbs|kilos)/i,
      category: 'HEALTH_METRIC',
      key: 'body_weight',
      extractor: (match) => `${match[1]} kg`
    },
    {
      regex: /(?:water intake|drink|hydration)\s+(\d+(?:\.\d+)?)\s*(?:liters|litres|l)/i,
      category: 'HEALTH_METRIC',
      key: 'daily_water_intake',
      extractor: (match) => `${match[1]} L`
    }
  ];

  for (const rule of rules) {
    const match = message.match(rule.regex);
    if (match) {
      const extractedValue = rule.extractor(match);
      try {
        const memory = await saveMemory(
          userId,
          rule.category,
          rule.key,
          extractedValue,
          1.0,
          message
        );
        extracted.push(memory);
        logger.info(`Extracted memory: User ${userId} -> [${rule.key}: ${extractedValue}]`);
      } catch (err) {
        logger.error(`Failed to save extracted memory for user ${userId}: ${err.message}`);
      }
    }
  }

  return extracted;
};

module.exports = {
  saveMemory,
  getMemories,
  extractMemoriesFromMessage
};
