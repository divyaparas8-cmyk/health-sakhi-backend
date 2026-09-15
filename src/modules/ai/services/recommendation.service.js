const prisma = require('../../../config/database');
const logger = require('../../../utils/logger');
const openaiService = require('./openai.service');
const contextBuilder = require('./context-builder.service');

/**
 * Log a recommendation in the AIRecommendation table.
 */
const logRecommendation = async (userId, resourceType, resourceId, context) => {
  try {
    return await prisma.aIRecommendation.create({
      data: {
        userId,
        resourceType,
        resourceId,
        context
      }
    });
  } catch (error) {
    logger.error(`Error logging AI recommendation: ${error.message}`);
    return null;
  }
};

/**
 * Use OpenAI to identify search terms based on user request and stored memories.
 */
const extractRecommendationTargets = async (userId, queryText) => {
  try {
    const memoriesStr = await contextBuilder.getMemoriesContext(userId);

    const messages = [
      {
        role: 'system',
        content: `You are a wellness recommendation matchmaker. Analyze the user's message and stored memories/preferences to generate search keywords for books, videos (representing wellness programs or courses), meditations, and advisor specializations.
        
Output MUST be a valid JSON object. Do NOT wrap output in markdown code blocks or add any text/comments outside the JSON structure.

The JSON object must contain these fields:
- bookTerms: Array of Strings (keywords to search titles/descriptions of books)
- videoTerms: Array of Strings (keywords to search video titles/playlists)
- meditationTerms: Array of Strings (keywords to search meditation sessions/categories)
- advisorSpecializations: Array of Strings (keywords to match advisor specializations, e.g. "PCOS", "Mental Health", "Diet", "Yoga")

Example Output:
{
  "bookTerms": ["pcod", "hormone balance"],
  "videoTerms": ["pcod yoga", "insulin levels"],
  "meditationTerms": ["stress", "sleep"],
  "advisorSpecializations": ["PCOS", "Yoga Therapy"]
}`
      },
      {
        role: 'user',
        content: `User query: "${queryText}"\nUser memories context:\n${memoriesStr}`
      }
    ];

    const result = await openaiService.generateChatCompletion(messages, userId, {
      action: 'RECOMMENDATION_MATCHING',
      temperature: 0.1,
      max_tokens: 300
    });

    let cleanedReply = result.reply.trim();
    if (cleanedReply.startsWith('```json')) {
      cleanedReply = cleanedReply.substring(7, cleanedReply.length - 3).trim();
    } else if (cleanedReply.startsWith('```')) {
      cleanedReply = cleanedReply.substring(3, cleanedReply.length - 3).trim();
    }

    return JSON.parse(cleanedReply);
  } catch (error) {
    logger.error(`Error extracting recommendation targets: ${error.message}`);
    return { bookTerms: [], videoTerms: [], meditationTerms: [], advisorSpecializations: [] };
  }
};

/**
 * Smart recommendation generator that uses OpenAI-driven terms to query the database.
 */
const generateRecommendations = async (userId, queryText) => {
  try {
    // 1. Get query targets from AI
    const targets = await extractRecommendationTargets(userId, queryText);
    return await generateRecommendationsFromTargets(userId, targets);
  } catch (error) {
    logger.error(`Error in generateRecommendations: ${error.message}`);
    return [];
  }
};

/**
 * Generate recommendations directly from extracted target terms.
 */
const generateRecommendationsFromTargets = async (userId, targets) => {
  const recommendations = [];
  const { bookTerms = [], videoTerms = [], meditationTerms = [], advisorSpecializations = [] } = targets || {};

  try {
    // Build OR filters
    const bookFilters = bookTerms.map(term => ({ title: { contains: term } }));
    const videoFilters = videoTerms.map(term => ({ title: { contains: term } }));
    const meditationFilters = meditationTerms.map(term => ({
      OR: [
        { title: { contains: term } },
        { category: { contains: term } }
      ]
    }));
    const advisorFilters = advisorSpecializations.map(spec => ({
      specializationName: { contains: spec }
    }));

    // 2. Query Books
    const books = await prisma.book.findMany({
      where: {
        status: 'published',
        ...(bookFilters.length > 0 ? { OR: bookFilters } : {})
      },
      take: 2
    });

    for (const book of books) {
      const rec = await logRecommendation(
        userId,
        'book',
        book.id,
        `Recommended reading: "${book.title}" to match your interest in ${bookTerms.join(', ') || 'wellness'}.`
      );
      if (rec) {
        recommendations.push({
          id: rec.id,
          type: 'book',
          resource_id: book.id,
          title: book.title,
          description: book.description,
          context: rec.context
        });
      }
    }

    // 3. Query Videos (representing wellness programs / courses)
    const videos = await prisma.video.findMany({
      where: videoFilters.length > 0 ? { OR: videoFilters } : {},
      take: 2
    });

    for (const video of videos) {
      const rec = await logRecommendation(
        userId,
        'video',
        video.id,
        `Recommended video module: "${video.title}" to support your learning goals.`
      );
      if (rec) {
        recommendations.push({
          id: rec.id,
          type: 'video',
          resource_id: video.id,
          title: video.title,
          description: video.description,
          context: rec.context
        });
      }
    }

    // 4. Query Meditations
    const meditations = await prisma.meditationSession.findMany({
      where: meditationFilters.length > 0 ? { OR: meditationFilters } : {},
      take: 2
    });

    for (const med of meditations) {
      const rec = await logRecommendation(
        userId,
        'meditation',
        med.id,
        `Try this audio session: "${med.title}" for immediate relaxation and focus.`
      );
      if (rec) {
        recommendations.push({
          id: rec.id,
          type: 'meditation',
          resource_id: med.id,
          title: med.title,
          category: med.category,
          duration: med.duration,
          context: rec.context
        });
      }
    }

    // 5. Query Advisors
    const advisors = await prisma.advisor.findMany({
      where: {
        status: 'approved',
        ...(advisorFilters.length > 0 ? {
          specializations: {
            some: { OR: advisorFilters }
          }
        } : {})
      },
      include: {
        user: { include: { profile: true } },
        specializations: true
      },
      take: 2
    });

    for (const adv of advisors) {
      const name = adv.user?.profile?.fullName || 'Health Advisor';
      const rec = await logRecommendation(
        userId,
        'advisor',
        adv.id,
        `Consult specialist ${name} to get custom wellness guidance.`
      );
      if (rec) {
        recommendations.push({
          id: rec.id,
          type: 'advisor',
          resource_id: adv.id,
          name,
          specializations: adv.specializations.map(s => s.specializationName),
          photo_url: adv.photoUrl,
          rating: Number(adv.rating),
          context: rec.context
        });
      }
    }

    // Fallbacks if no items match terms
    if (recommendations.length === 0) {
      const defaultBooks = await prisma.book.findMany({ where: { status: 'published' }, take: 1 });
      const defaultMeds = await prisma.meditationSession.findMany({ take: 1 });

      for (const item of [...defaultBooks, ...defaultMeds]) {
        const type = item.audioUrl ? 'meditation' : 'book';
        const rec = await logRecommendation(
          userId,
          type,
          item.id,
          `Highly recommended general wellness resource: "${item.title}".`
        );
        if (rec) {
          recommendations.push({
            id: rec.id,
            type,
            resource_id: item.id,
            title: item.title,
            description: item.description || '',
            context: rec.context
          });
        }
      }
    }

  } catch (error) {
    logger.error(`Error generating recommendations from targets: ${error.message}`);
  }

  return recommendations;
};

/**
 * Get recommendation logs for a user.
 */
const getUserRecommendations = async (userId) => {
  try {
    return await prisma.aIRecommendation.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
  } catch (error) {
    logger.error(`Error getting user recommendations: ${error.message}`);
    throw error;
  }
};

module.exports = {
  generateRecommendations,
  generateRecommendationsFromTargets,
  getUserRecommendations
};
