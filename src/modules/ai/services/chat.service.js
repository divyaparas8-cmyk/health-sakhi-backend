const prisma = require('../../../config/database');
const { ApiError } = require('../../../middlewares/errorHandler');
const logger = require('../../../utils/logger');
const memoryService = require('./memory.service');
const actionService = require('./action.service');
const recommendationService = require('./recommendation.service');
const openaiService = require('./openai.service');
const contextBuilder = require('./context-builder.service');
const memoryExtractor = require('./memory-extractor.service');
const escalationService = require('./escalation.service');
const languageService = require('../../i18n/language.service');
const ttsService = require('../../i18n/tts.service');

/**
 * Retrieve active plan limits for daily chat validation.
 */
const getUserPlanSlug = async (userId) => {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    include: {
      subscriptions: {
        where: {
          deletedAt: null,
          endsAt: { gte: new Date() }
        },
        include: { plan: true },
        take: 1
      }
    }
  });

  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User account not found.');
  }

  if (user.subscriptions && user.subscriptions.length > 0) {
    const activeSub = user.subscriptions[0];
    if (activeSub.status === 'ACTIVE') {
      return activeSub.plan.slug;
    }
  }

  return 'free-sakhi';
};

/**
 * Perform chat limit verification and counter increment.
 */
const checkAndLogUsageLimit = async (userId) => {
  const planSlug = await getUserPlanSlug(userId);
  const isFree = planSlug === 'free-sakhi';
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  if (isFree && process.env.NODE_ENV !== 'development') {
    const usage = await prisma.aIUsageLimit.findUnique({
      where: {
        userId_chatDate: {
          userId,
          chatDate: today
        }
      }
    });

    const currentCount = usage ? usage.count : 0;
    if (currentCount >= 5) {
      throw new ApiError(403, 'CHAT_LIMIT_EXCEEDED', 'You have exhausted your daily limit of 5 free AI chats. Upgrade to Premium Pro for unlimited access.');
    }

    // Increment usage
    await prisma.aIUsageLimit.upsert({
      where: {
        userId_chatDate: {
          userId,
          chatDate: today
        }
      },
      update: {
        count: { increment: 1 }
      },
      create: {
        userId,
        chatDate: today,
        count: 1
      }
    });
  }
};

/**
 * Main chat handler.
 */
const handleChat = async (userId, message, sessionId = null, mode = null) => {
  try {
    // 1. Verify usage limits
    await checkAndLogUsageLimit(userId);

    // 2. Open or retrieve chat session
    let chatSession;
    if (sessionId) {
      chatSession = await prisma.aIChatSession.findFirst({
        where: { id: sessionId, userId, deletedAt: null }
      });
      if (!chatSession) {
        throw new ApiError(404, 'SESSION_NOT_FOUND', 'Chat session not found.');
      }
    } else {
      chatSession = await prisma.aIChatSession.create({
        data: {
          userId,
          title: message.substring(0, 30) + (message.length > 30 ? '...' : '')
        }
      });
    }

    const currentSessionId = chatSession.id;
    const msgLower = (message || '').toLowerCase();

    // 3. Prepare full conversation history messages
    const systemMessages = await contextBuilder.buildSystemContext(userId, currentSessionId, mode);
    const historyMessages = await contextBuilder.getRecentChatHistory(currentSessionId);
    
    let bookContextMessage = null;
    const books = await contextBuilder.findBooks(message);
    if (books && books.length > 0) {
      let booksStr = books.map(b => {
        const chapStr = (b.chapters && b.chapters.length > 0) ? b.chapters.join(' | ') : 'Key chapters on emotional and physical well-being';
        return `- ID: "${b.id}", Title: "${b.title}", Category: "${b.category || 'Wellness'}", Description: "${b.description || b.desc || ''}", Key Chapters/Index: [${chapStr}]`;
      }).join('\n');

      const bookInstruction = `[SYSTEM ALERT: HealthSakhi Books & Chapters Context]
Here are the most relevant books and their chapters available in our HealthSakhi library for this query:
${booksStr}

RECOMMENDATION RULES:
1. Recommend 1 or 2 relevant books from the list above.
2. Format the book link EXACTLY as a markdown link: [Book Title](/app/books/{id})
3. Name specific Chapter(s) or Index topic(s) from the list above and explain key insights/points from those chapters.
4. DO NOT output video links or recommendations to /app/meditation?play=...`;

      bookContextMessage = {
        role: 'system',
        content: bookInstruction
      };
      logger.info(`[DEBUG] Book Context Injected: ${bookContextMessage.content}`);
    }

    let videoContextMessage = null; // Video links disabled per user requirement

    const fullMessages = [
      ...systemMessages,
      ...historyMessages,
    ];
    
    if (bookContextMessage) {
      fullMessages.push(bookContextMessage);
    }

    if (videoContextMessage) {
      fullMessages.push(videoContextMessage);
    }
    
    fullMessages.push({ role: 'user', content: message });

    let replyText = '';
    let tokensIn = 0;
    let tokensOut = 0;
    let memoriesExtracted = [];
    let recommendations = [];
    let escalation = null;
    const pendingActions = [];
    let isCrisis = false;
    let crisis = { detected: false, riskLevel: 'none', intent: 'General Chat', reason: '' };
    let memories = [];
    let recommendationTerms = { bookTerms: [], videoTerms: [], meditationTerms: [], advisorSpecializations: [] };
    let extractedActions = [];

    // FAQ & Book intent matching setup
    let matchedSource = 'ai';
    let detectedIntent = 'General Chat';
    let suggestions = [];
    let faqMatch = null;

    // Retrieve user language preference early
    const userLangPref = await languageService.getUserLanguage(userId);
    const languageCode = userLangPref.languageCode || 'en';

    // 1. Fetch published FAQs and check for a match
    const allFaqs = await prisma.faq.findMany({ where: { status: 'Published' } });
    if (allFaqs.length > 0) {
      const normalizeText = (text) => {
        return (text || '')
          .toLowerCase()
          .replace(/aa/g, 'a')
          .replace(/ee/g, 'i')
          .replace(/oo/g, 'u')
          .replace(/[^\w\s]/gi, '')
          .trim();
      };

      const qNorm = normalizeText(message);
      const qWords = qNorm.split(/\s+/).filter(w => w.length > 2 && !['what','how','why','when','where','who','please','tell','sakhi','help'].includes(w));

      const scoredFaqs = allFaqs.map(f => {
        let score = 0;
        const qFNorm = normalizeText(f.question);
        const aFNorm = normalizeText(f.answer);
        
        if (qNorm.includes(qFNorm) || qFNorm.includes(qNorm)) {
          score += 15;
        }
        qWords.forEach(word => {
          if (qFNorm.includes(word)) score += 3;
          if (aFNorm.includes(word)) score += 1;
        });
        return { faq: f, score };
      });

      scoredFaqs.sort((a, b) => b.score - a.score);
      const candidates = scoredFaqs.filter(x => x.score > 0).slice(0, 5).map(x => x.faq);

      if (candidates.length > 0) {
        const candidatesStr = candidates.map((c, idx) => `${idx + 1}. Q: "${c.question}"\nA: "${c.answer}"`).join('\n\n');
        const matchMessages = [
          {
            role: 'system',
            content: `You are an AI FAQ matching assistant for the Health Sakhi platform.
Your task is to check if the user query matches any of the candidate FAQs listed below.
The user query might be in English, Hindi, or Marathi. The candidates are in English.
Match by meaning, intent, or topics.

Candidates:
${candidatesStr}

If there is a clear match, respond with ONLY the number of the matching candidate (e.g. "2").
If there is no match, respond with ONLY the word "NONE".
Do not add any explanations, introductory text, or formatting.`
          },
          {
            role: 'user',
            content: `User Query: "${message}"`
          }
        ];

        try {
          const matchResult = await openaiService.generateChatCompletion(matchMessages, userId, {
            action: 'FAQ_MATCHING',
            temperature: 0.1,
            max_tokens: 10
          });

          const replyTrimmed = (matchResult.reply || '').trim().toUpperCase();
          const parsedIdx = parseInt(replyTrimmed, 10);
          if (!isNaN(parsedIdx) && parsedIdx >= 1 && parsedIdx <= candidates.length) {
            faqMatch = candidates[parsedIdx - 1];
            matchedSource = 'faq';
            detectedIntent = faqMatch.category || 'FAQ Match';
          }
        } catch (err) {
          logger.error(`FAQ Matching AI call failed: ${err.message}`);
        }
      }
    }

    if (faqMatch) {
      replyText = faqMatch.answer;
      tokensIn = Math.ceil(message.length / 4);
      tokensOut = Math.ceil(replyText.length / 4);
      
      // Get related FAQs as suggestions
      const related = allFaqs
        .filter(f => f.id !== faqMatch.id && f.category === faqMatch.category)
        .slice(0, 3);
      suggestions = related.map(f => ({
        type: 'question',
        title: f.question,
        action: f.question
      }));
      logger.info(`FAQ match found. Matched ID: ${faqMatch.id}`);
    } else {
      // 2. Fallback to AI matching and structured generation
      try {
        const structuredResult = await openaiService.generateStructuredChat(fullMessages, userId, {
          action: 'CHAT_CONVERSATION_CONSOLIDATED'
        });

        const structuredOutput = structuredResult.reply;
        replyText = structuredOutput.reply || '';
        tokensIn = structuredResult.usage.prompt_tokens;
        tokensOut = structuredResult.usage.completion_tokens;

        crisis = structuredOutput.crisis || crisis;
        isCrisis = !!crisis.detected;
        memories = structuredOutput.memories || memories;
        recommendationTerms = structuredOutput.recommendations || recommendationTerms;
        extractedActions = structuredOutput.extractedActions || extractedActions;
        
        matchedSource = structuredOutput.matchedSource || 'ai';
        detectedIntent = crisis.intent || 'General Chat';
        suggestions = structuredOutput.suggestions || [];

        logger.info(`Consolidated Gemini orchestration call succeeded. Source: ${matchedSource}, Crisis: ${isCrisis}, Memories: ${memories.length}, Actions: ${extractedActions.length}`);
      } catch (apiErr) {
        logger.error(`Consolidated Gemini orchestration failed, running fallback model chain: ${apiErr.message}`);
        
        const escalationResult = await escalationService.checkAndEscalate(userId, message).catch(err => {
          logger.error(`Escalation service error fallback: ${err.message}`);
          return null;
        });
        escalation = escalationResult ? escalationResult.escalation : null;
        isCrisis = !!escalation;

        if (isCrisis) {
          const riskLevel = escalationResult.riskLevel || 'high';
          const intent = escalationResult.intent || 'Self-Harm';
          const crisisSystemInstruction = {
            role: 'system',
            content: `[CRISIS ALERT - intent: ${intent}, riskLevel: ${riskLevel}]
The user is in emotional pain and needs genuine human connection, not a structured response.
Follow these rules exactly:
1. Respond as one continuous, flowing conversation — no bullet points, no bold section labels, no headings, no markdown formatting.
2. Never use phrases like "A Caring Note", "Safety Reminder", "Important Notice", "Wellness Tip", "Crisis Support", "Friendly Reminder", or any section heading whatsoever.
3. Begin by warmly acknowledging her pain with empathy. Make her feel truly heard and not judged.
4. Gently and naturally weave in the message that she is not alone and that her life has value — do not state this as a bullet point or formal note.
5. Suggest a simple calming step (breathing, drinking water, stepping outside) as a natural part of the conversation.
6. Invite her to keep talking. Ask her an open question to continue the conversation.
7. Do NOT use technical phrases such as "I have detected", "Your case has been flagged", "Emergency protocol activated", or "Escalated to advisor panel".
8. The entire response must read like one message from a caring, trusted friend — warm, gentle, human, and unbroken.`
          };
          fullMessages.push(crisisSystemInstruction);
        }

        const [fallbackMemories, fallbackResponse, fallbackRecs] = await Promise.all([
          memoryExtractor.processMessageForMemories(userId, message).catch(err => {
            logger.error(`Memory extraction error fallback: ${err.message}`);
            return [];
          }),
          openaiService.generateChatCompletion(fullMessages, userId, { action: 'CHAT_CONVERSATION' }).catch(err => {
            logger.error(`Chat completion error fallback: ${err.message}`);
            throw err;
          }),
          recommendationService.generateRecommendations(userId, message).catch(err => {
            logger.error(`Recommendation service error fallback: ${err.message}`);
            return [];
          })
        ]);

        replyText = fallbackResponse.reply;
        tokensIn = fallbackResponse.usage.prompt_tokens;
        tokensOut = fallbackResponse.usage.completion_tokens;
        memoriesExtracted = fallbackMemories;
        recommendations = fallbackRecs;
        
        const booksFound = await contextBuilder.findBooks(message);
        if (booksFound && booksFound.length > 0 && (msgLower.includes('book') || msgLower.includes('read') || msgLower.includes('kitaab') || msgLower.includes('kitab'))) {
          matchedSource = 'book';
          suggestions = [{
            type: 'book',
            title: booksFound[0].title,
            action: `/app/books/${booksFound[0].id}`
          }];
        } else {
          matchedSource = 'ai';
        }
        detectedIntent = isCrisis ? 'Crisis' : 'General Chat';
      }
    }

    // 5. Process DB updates based on structured AI output (only if we didn't hit fallback)
    if (memoriesExtracted.length === 0 && memories.length > 0) {
      memoriesExtracted = await memoryExtractor.saveExtractedMemories(userId, memories, message).catch(err => {
        logger.error(`Memory storage error: ${err.message}`);
        return [];
      });
    }

    if (recommendations.length === 0) {
      recommendations = await recommendationService.generateRecommendationsFromTargets(userId, recommendationTerms).catch(err => {
        logger.error(`Recommendation processing error: ${err.message}`);
        return [];
      });
    }

    if (!escalation && isCrisis) {
      const escalationResult = await escalationService.handleEscalation(userId, {
        riskLevel: crisis.riskLevel,
        intent: crisis.intent,
        reason: crisis.reason
      }).catch(err => {
        logger.error(`Escalation handler error: ${err.message}`);
        return null;
      });

      if (escalationResult) {
        escalation = escalationResult.escalation;
        crisis.recommendedAdvisor = escalationResult.recommendedAdvisor;
      }
    }

    // Process Actions
    const loggedTypes = new Set();
    if (Array.isArray(extractedActions) && extractedActions.length > 0) {
      for (const act of extractedActions) {
        const type = act.actionType;
        const payload = act.payload || {};
        try {
          const action = await actionService.createPendingAction(currentSessionId, type, payload);
          pendingActions.push(action);
          loggedTypes.add(type);
        } catch (e) {
          logger.error(`Failed to create pending action ${type}: ${e.message}`);
        }
      }
    }

    // Action Fallback logic to protect exact regex compatibility matching
    // Check mood trigger
    if (!loggedTypes.has('LOG_MOOD') && (msgLower.includes('log my mood') || msgLower.includes('i feel sad') || msgLower.includes('i feel stressed') || msgLower.includes('i feel tired'))) {
      let moodType = 'Stressed';
      if (msgLower.includes('happy')) moodType = 'Happy';
      else if (msgLower.includes('tired')) moodType = 'Tired';
      else if (msgLower.includes('low energy') || msgLower.includes('sad')) moodType = 'Low Energy';

      const action = await actionService.createPendingAction(currentSessionId, 'LOG_MOOD', {
        mood_type: moodType,
        intensity: 3,
        notes: 'Extracted automatically from chat conversation context.'
      });
      pendingActions.push(action);
      loggedTypes.add('LOG_MOOD');
    }

    // Check expense trigger
    if (!loggedTypes.has('CREATE_EXPENSE') && (msgLower.includes('expense') || msgLower.includes('spent') || msgLower.includes('bought') || msgLower.includes('cost'))) {
      const amountMatch = message.match(/\b\d+(\.\d+)?\b/);
      const amount = amountMatch ? parseFloat(amountMatch[0]) : 500.00; // default to 500
      
      const action = await actionService.createPendingAction(currentSessionId, 'CREATE_EXPENSE', {
        amount,
        category_name: 'Medicine',
        description: 'Auto-extracted medical/wellness cost.',
        transaction_date: new Date().toISOString().split('T')[0]
      });
      pendingActions.push(action);
      loggedTypes.add('CREATE_EXPENSE');
    }

    // Check period trigger
    if (!loggedTypes.has('LOG_PERIOD') && (msgLower.includes('period') || msgLower.includes('menstru') || msgLower.includes('cycle'))) {
      const action = await actionService.createPendingAction(currentSessionId, 'LOG_PERIOD', {
        start_date: new Date().toISOString().split('T')[0],
        flow_intensity: 'medium',
        symptoms: ['Cramps']
      });
      pendingActions.push(action);
      loggedTypes.add('LOG_PERIOD');
    }

    // Check advisor booking trigger
    if (!loggedTypes.has('BOOK_ADVISOR') && (msgLower.includes('book advisor') || msgLower.includes('consult doctor') || msgLower.includes('schedule doctor'))) {
      const activeAdvisor = await prisma.advisor.findFirst({
        where: { status: 'approved' }
      });

      if (activeAdvisor && Array.isArray(activeAdvisor.availability)) {
        const slot = activeAdvisor.availability.find(s => s.status === 'available');
        if (slot) {
          const action = await actionService.createPendingAction(currentSessionId, 'BOOK_ADVISOR', {
            advisor_id: activeAdvisor.id,
            availability_id: slot.id
          });
          pendingActions.push(action);
          loggedTypes.add('BOOK_ADVISOR');
        }
      }
    }

    // 6. Generate Conversational AI Response formatting
    if (isCrisis) {
      const riskLevel = crisis.riskLevel || 'high';
      const recommendedAdvisor = crisis.recommendedAdvisor;

      // Build a natural continuation — no headings, no labels, just a flowing sentence or two
      let crisisContinuation = '';

      if (recommendedAdvisor) {
        crisisContinuation = ` I'm also a little concerned about how much you're carrying right now, and I want you to know you don't have to face this alone. If you'd like, I can help connect you with ${recommendedAdvisor.fullName}, one of our certified advisors, who can offer you a safe and confidential space to talk things through.`;
      } else {
        crisisContinuation = ` I also want you to know that if things ever feel too heavy to carry on your own, reaching out to someone you trust — a close friend, a family member, or even a counsellor — can make a real difference. You deserve that kind of support.`;
      }

      if (riskLevel === 'high' || riskLevel === 'imminent') {
        crisisContinuation += ` And if at any point you feel you might act on these thoughts, please do reach out to a local crisis helpline or emergency services right away. Your life truly matters, and there are people ready to help you through this moment.`;
      }

      replyText += crisisContinuation;
    }

    // Append suggestions if actions were queued
    if (pendingActions.length > 0) {
      const actionList = pendingActions.map(a => a.actionType).join(', ');
      replyText += ` I've prepared a pending dashboard entry for you to complete: [${actionList}]. You can execute it directly with a single click.`;
    }

    // 7. Resolve Language and TTS translation settings
    const voiceEnabled = userLangPref.voiceEnabled || false;

    let translatedReply = replyText;
    if (languageCode !== 'en') {
      translatedReply = await languageService.translateText(replyText, languageCode, userId);
    }

    let audioUrl = null;
    if (voiceEnabled) {
      try {
        audioUrl = await ttsService.generateSpeech(translatedReply, languageCode);
      } catch (ttsErr) {
        logger.error(`TTS generation failed: ${ttsErr.message}`);
      }
    }

    const nowTime = new Date();
    // 8. Persist chat messages
    await prisma.aIChatMessage.createMany({
      data: [
        {
          sessionId: currentSessionId,
          senderRole: 'user',
          messageText: message,
          tokensUsed: tokensIn,
          createdAt: new Date(nowTime.getTime() - 1000)
        },
        {
          sessionId: currentSessionId,
          senderRole: 'assistant',
          messageText: translatedReply,
          tokensUsed: tokensOut,
          createdAt: nowTime
        }
      ]
    });

    // 9. Save user interaction details dynamically to ChatMemory database table
    try {
      await prisma.chatMemory.create({
        data: {
          userId,
          question: message,
          detectedIntent,
          matchedSource
        }
      });
    } catch (dbErr) {
      logger.error(`Failed to save ChatMemory log: ${dbErr.message}`);
    }

    return {
      success: true,
      reply: translatedReply,
      languageCode,
      audioUrl,
      session_id: currentSessionId,
      source: matchedSource,
      suggestions: suggestions,
      actions: pendingActions.map(a => ({
        id: a.id,
        action_type: a.actionType,
        payload: a.payload,
        status: a.status
      })),
      recommendations,
      escalation: escalation ? {
        id: escalation.id,
        severity: escalation.severity,
        status: escalation.status
      } : null,
      memories_extracted: memoriesExtracted.map(m => ({
        key: m.key,
        category: m.category,
        value: m.value
      }))
    };
  } catch (error) {
    logger.error(`Error in Chat service: ${error.message}`);
    throw error;
  }
};

/**
 * Retrieve session listings & messages inside a session
 */
const getHistory = async (userId, sessionId = null) => {
  try {
    if (sessionId) {
      // Validate session ownership
      const session = await prisma.aIChatSession.findFirst({
        where: { id: sessionId, userId, deletedAt: null }
      });
      if (!session) {
        throw new ApiError(404, 'SESSION_NOT_FOUND', 'Chat session not found.');
      }

      const messages = await prisma.aIChatMessage.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'asc' }
      });

      return {
        success: true,
        session_id: sessionId,
        title: session.title,
        messages: messages.map(m => ({
          id: m.id,
          role: m.senderRole,
          message: m.messageText,
          created_at: m.createdAt
        }))
      };
    } else {
      // List all sessions
      const sessions = await prisma.aIChatSession.findMany({
        where: { userId, deletedAt: null },
        orderBy: { updatedAt: 'desc' }
      });

      return {
        success: true,
        sessions: sessions.map(s => ({
          id: s.id,
          title: s.title,
          updated_at: s.updatedAt,
          created_at: s.createdAt
        }))
      };
    }
  } catch (error) {
    logger.error(`Error in getHistory service: ${error.message}`);
    throw error;
  }
};

/**
 * Delete a chat session and all its messages.
 * AIChatMessage has onDelete: Cascade so messages auto-delete with the session.
 */
const deleteSession = async (userId, sessionId) => {
  const session = await prisma.aIChatSession.findFirst({
    where: { id: sessionId, userId, deletedAt: null }
  });

  if (!session) {
    throw new ApiError(404, 'SESSION_NOT_FOUND', 'Chat session not found or already deleted.');
  }

  // Hard-delete the session — messages cascade automatically via DB constraint
  await prisma.aIChatSession.delete({
    where: { id: sessionId }
  });

  return { success: true, message: 'Conversation deleted successfully.' };
};

module.exports = {
  handleChat,
  getHistory,
  deleteSession
};
