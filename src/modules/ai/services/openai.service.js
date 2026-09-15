const { GoogleGenerativeAI } = require('@google/generative-ai');
const prisma = require('../../../config/database');
const config = require('../../../config/environment');
const logger = require('../../../utils/logger');

// Initialize Google Generative AI client
const genAI = new GoogleGenerativeAI(config.gemini.apiKey || process.env.GEMINI_API_KEY || '');

/**
 * Get pricing rates for a given model from AICostTracking or fallback to Gemini defaults.
 */
const getModelPricing = async (modelName) => {
  try {
    const costTrack = await prisma.aICostTracking.findUnique({
      where: { modelName }
    });

    if (costTrack) {
      return {
        inputCostPerMillion: Number(costTrack.inputCostPerMillion),
        outputCostPerMillion: Number(costTrack.outputCostPerMillion)
      };
    }
  } catch (error) {
    logger.warn(`Failed to fetch pricing from database for model ${modelName}: ${error.message}`);
  }

  // Default fallback rates (per million tokens) for Google Gemini
  if (modelName.includes('gemini-1.5-flash') || modelName.includes('gemini-2.0-flash') || modelName.includes('gemini-2.5-flash')) {
    return {
      inputCostPerMillion: 0.075,
      outputCostPerMillion: 0.30
    };
  } else if (modelName.includes('gemini-1.5-pro') || modelName.includes('gemini-2.5-pro')) {
    return {
      inputCostPerMillion: 1.25,
      outputCostPerMillion: 5.00
    };
  }

  // Generic fallback (Gemini 1.5 Flash rates)
  return {
    inputCostPerMillion: 0.075,
    outputCostPerMillion: 0.30
  };
};

/**
 * Execute chat completion request using Google Gemini with retry handling and timeout check.
 */
const generateChatCompletion = async (messages, userId, options = {}) => {
  const model = options.model || config.gemini.model || 'gemini-1.5-flash';
  const maxRetries = options.maxRetries || 3;
  let attempt = 0;
  let delay = 1000;

  // 1. Separate System Message and Chat Content
  const systemMsg = messages.find(m => m.role === 'system');
  const systemInstruction = systemMsg ? systemMsg.content : undefined;

  // Format message history to match Google Generative AI shape
  // roles: 'user' or 'model' (Google uses 'model' instead of 'assistant')
  const contents = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content || m.messageText || '' }]
    }));

  while (attempt < maxRetries) {
    try {
      logger.info(`Sending ChatCompletion request to Gemini (Attempt ${attempt + 1}/${maxRetries}), model: ${model}`);

      // Initialize generative model with optional system instructions
      const modelInstance = genAI.getGenerativeModel({
        model,
        systemInstruction
      });

      // Execute request with generation configs
      const result = await modelInstance.generateContent({
        contents,
        generationConfig: {
          temperature: options.temperature !== undefined ? options.temperature : 0.7,
          maxOutputTokens: options.max_tokens || 1000,
          responseMimeType: options.responseMimeType
        }
      });

      const response = await result.response;
      const reply = response.text() || '';

      // Extract usage metadata from Gemini response metadata
      const usageMetadata = response.usageMetadata || {};
      const promptTokens = usageMetadata.promptTokenCount || Math.ceil(JSON.stringify(contents).length / 4);
      const completionTokens = usageMetadata.candidatesTokenCount || Math.ceil(reply.length / 4);
      const totalTokens = promptTokens + completionTokens;

      const usage = {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens
      };

      // Cost tracking
      const pricing = await getModelPricing(model);
      const inputCost = (promptTokens / 1000000) * pricing.inputCostPerMillion;
      const outputCost = (completionTokens / 1000000) * pricing.outputCostPerMillion;
      const totalCostUsd = inputCost + outputCost;

      // Log AI usage in database
      await prisma.aIUsageLog.create({
        data: {
          userId,
          action: options.action || 'CHAT_CONVERSATION',
          tokens: totalTokens,
          costUsd: totalCostUsd
        }
      });

      logger.info(`Gemini response received. Tokens: ${totalTokens}, Cost: $${totalCostUsd.toFixed(6)}`);

      return {
        reply,
        usage,
        costUsd: totalCostUsd
      };

    } catch (error) {
      attempt++;
      logger.error(`Gemini API Error on attempt ${attempt}: ${error.message}`);

      // Check if this is an API key authentication/configuration error
      const isApiKeyError = error.message.includes('API key not valid') || 
                            error.message.includes('API_KEY_INVALID') || 
                            error.message.includes('API key') ||
                            error.message.includes('key not found');

      if (isApiKeyError) {
        throw new Error('The Gemini API key is currently unconfigured or invalid. Once a valid API key is set up in the server environment (.env), AI Sakhi will start returning perfect responses.');
      }

      // Determine retryable error
      const isRetryable = error.message.includes('429') || error.message.includes('503') || error.message.includes('timeout') || error.message.includes('fetch');

      if (!isRetryable || attempt >= maxRetries) {
        throw new Error(`Gemini API failed: ${error.message}`);
      }

      // Exponential backoff with jitter
      const jitter = Math.random() * 200;
      logger.info(`Retrying Gemini request in ${delay + jitter}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay + jitter));
      delay *= 2;
    }
  }
};

/**
 * Execute unified chat completion using Google Gemini returning structured JSON data.
 */
const generateStructuredChat = async (messages, userId, options = {}) => {
  const model = options.model || config.gemini.model || 'gemini-1.5-flash';
  const maxRetries = options.maxRetries || 3;
  let attempt = 0;
  let delay = 1000;

  // Separate System Message and Chat Content
  const systemMsg = messages.find(m => m.role === 'system');
  const systemInstruction = systemMsg ? systemMsg.content : undefined;

  // Format message history
  const contents = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content || m.messageText || '' }]
    }));

  // Define structured output schema for all orchestrator attributes using direct JSON Schema string types
  const structuredSchema = {
    type: "object",
    properties: {
      reply: {
        type: "string",
        description: "Empathetic conversational response in user's preferred language."
      },
      matchedSource: {
        type: "string",
        description: "Source utilized for the reply. MUST be 'book' if the user question is directly answered using the injected book contents, otherwise 'ai'."
      },
      suggestions: {
        type: "array",
        description: "List of suggested actions or resources (e.g. read book deep link or follow-up question). Limit to 2 items.",
        items: {
          type: "object",
          properties: {
            type: {
              type: "string",
              description: "Type of suggestion: 'book' or 'question'"
            },
            title: {
              type: "string",
              description: "Short button label, e.g. 'Read Heart to Heart' or 'How can I stay active?'"
            },
            action: {
              type: "string",
              description: "Destination route if type is 'book' (e.g. '/app/books/123'), or exact question query text if type is 'question'"
            }
          },
          required: ["type", "title", "action"]
        }
      },
      crisis: {
        type: "object",
        properties: {
          detected: {
            type: "boolean",
            description: "true if user displays symptoms of deep depression, self-harm/suicide thoughts, abuse indicators, or severe panic/anxiety."
          },
          riskLevel: {
            type: "string",
            description: "none, low, moderate, high, or imminent"
          },
          intent: {
            type: "string",
            description: "Intent classification: Self-Harm, Violence, Mental Health, Relationship, General Chat, or other categories."
          },
          reason: {
            type: "string",
            description: "Brief reasoning why crisis was/was not flagged."
          }
        },
        required: ["detected", "riskLevel", "intent", "reason"]
      },
      memories: {
        type: "array",
        description: "List of new/updated user profile facts/preferences extracted from this user message.",
        items: {
          type: "object",
          properties: {
            category: {
              type: "string",
              description: "PREFERENCE, FAMILY, RELATIONSHIP, WELLNESS_GOAL, MEDICAL_CONDITION, FINANCIAL_GOAL"
            },
            key: {
              type: "string",
              description: "snake_case key name, e.g. diet_preference, family_status, pcos_status"
            },
            value: {
              type: "string",
              description: "Detailed extracted value"
            },
            confidence: {
              type: "number",
              description: "Confidence estimation float between 0.0 and 1.0"
            }
          },
          required: ["category", "key", "value", "confidence"]
        }
      },
      recommendations: {
        type: "object",
        properties: {
          bookTerms: {
            type: "array",
            items: { type: "string" }
          },
          videoTerms: {
            type: "array",
            items: { type: "string" }
          },
          meditationTerms: {
            type: "array",
            items: { type: "string" }
          },
          advisorSpecializations: {
            type: "array",
            items: { type: "string" }
          }
        },
        required: ["bookTerms", "videoTerms", "meditationTerms", "advisorSpecializations"]
      },
      extractedActions: {
        type: "array",
        description: "Dashboard actions detected based on user statements (e.g. logging mood/periods/expenses or booking advisors).",
        items: {
          type: "object",
          properties: {
            actionType: {
              type: "string",
              description: "LOG_MOOD, CREATE_EXPENSE, LOG_PERIOD, BOOK_ADVISOR"
            },
            payload: {
              type: "object",
              description: "Extracted action properties depending on actionType. All properties are optional depending on the actionType.",
              properties: {
                mood_type: { type: "string", description: "Happy, Tired, Stressed, Low Energy" },
                intensity: { type: "integer", description: "Scale of 1-5" },
                notes: { type: "string", description: "Contextual notes about the action" },
                amount: { type: "number", description: "Amount spent for expense action" },
                category_name: { type: "string", description: "Category of expense: Medicine, Food, Diet, Groceries, Shopping, Travel, Others" },
                description: { type: "string", description: "Short description of expense" },
                transaction_date: { type: "string", description: "YYYY-MM-DD format transaction date" },
                start_date: { type: "string", description: "YYYY-MM-DD format start date of menstrual cycle/period" },
                flow_intensity: { type: "string", description: "light, medium, heavy" },
                symptoms: { type: "array", items: { type: "string" }, description: "Array of period symptoms, e.g. Cramps, Headache, Bloating" },
                advisor_id: { type: "string", description: "Advisor UUID" },
                availability_id: { type: "string", description: "Slot UUID" }
              }
            }
          },
          required: ["actionType", "payload"]
        }
      }
    },
    required: ["reply", "matchedSource", "suggestions", "crisis", "memories", "recommendations", "extractedActions"]
  };

  while (attempt < maxRetries) {
    try {
      logger.info(`Sending Consolidated Structured Request to Gemini (Attempt ${attempt + 1}/${maxRetries}), model: ${model}`);

      const modelInstance = genAI.getGenerativeModel({
        model,
        systemInstruction
      });

      const result = await modelInstance.generateContent({
        contents,
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2000,
          responseMimeType: "application/json",
          responseSchema: structuredSchema
        }
      });

      const response = await result.response;
      const reply = response.text() || '{}';

      // Log metadata
      const usageMetadata = response.usageMetadata || {};
      const promptTokens = usageMetadata.promptTokenCount || Math.ceil(JSON.stringify(contents).length / 4);
      const completionTokens = usageMetadata.candidatesTokenCount || Math.ceil(reply.length / 4);
      const totalTokens = promptTokens + completionTokens;

      const usage = {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens
      };

      const pricing = await getModelPricing(model);
      const inputCost = (promptTokens / 1000000) * pricing.inputCostPerMillion;
      const outputCost = (completionTokens / 1000000) * pricing.outputCostPerMillion;
      const totalCostUsd = inputCost + outputCost;

      await prisma.aIUsageLog.create({
        data: {
          userId,
          action: 'CHAT_CONVERSATION_CONSOLIDATED',
          tokens: totalTokens,
          costUsd: totalCostUsd
        }
      });

      logger.info(`Gemini structured response received. Tokens: ${totalTokens}, Cost: $${totalCostUsd.toFixed(6)}`);

      return {
        reply: JSON.parse(reply),
        usage,
        costUsd: totalCostUsd
      };

    } catch (error) {
      attempt++;
      logger.error(`Gemini Structured API Error on attempt ${attempt}: ${error.message}`);

      const isApiKeyError = error.message.includes('API key not valid') || 
                            error.message.includes('API_KEY_INVALID') || 
                            error.message.includes('API key') ||
                            error.message.includes('key not found');

      if (isApiKeyError) {
        throw new Error('The Gemini API key is currently unconfigured or invalid. Once a valid API key is set up in the server environment (.env), AI Sakhi will start returning perfect responses.');
      }

      const isRetryable = error.message.includes('429') || error.message.includes('503') || error.message.includes('timeout') || error.message.includes('fetch');

      if (!isRetryable || attempt >= maxRetries) {
        throw new Error(`Gemini Structured API failed: ${error.message}`);
      }

      const jitter = Math.random() * 200;
      logger.info(`Retrying Gemini structured request in ${delay + jitter}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay + jitter));
      delay *= 2;
    }
  }
};

module.exports = {
  generateChatCompletion,
  generateStructuredChat,
  getModelPricing
};