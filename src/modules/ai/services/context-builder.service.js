const prisma = require('../../../config/database');
const logger = require('../../../utils/logger');
const fs = require('fs');
const path = require('path');

/**
 * Search the books database and static list for matches.
 */
const findBooks = async (query) => {
  const allBooks = await getAvailableBooks();
  if (allBooks.length === 0) return [];

  const normalizeText = (text) => {
    return (text || '')
      .toLowerCase()
      .replace(/aa/g, 'a')
      .replace(/ee/g, 'i')
      .replace(/oo/g, 'u')
      .replace(/[^\w\s]/gi, '');
  };

  const normalizedQuery = normalizeText(query);
  const searchWords = normalizedQuery
    .split(' ')
    .filter(w => w.length > 2 && !['book','books','read','novel','author','recommend','available'].includes(w));

  const scoredBooks = allBooks.map(b => {
    let score = 0;
    const titleNorm = normalizeText(b.title || '');
    const descNorm = normalizeText(b.description || b.desc || '');
    const categoryNorm = normalizeText(b.category || '');
    const chapNorm = normalizeText((b.chapters || []).join(' '));

    if (searchWords.length === 0) {
      score = 1;
    } else {
      searchWords.forEach(word => {
        if (titleNorm.includes(word)) score += 5;
        if (chapNorm.includes(word)) score += 4;
        if (descNorm.includes(word)) score += 2;
        if (categoryNorm.includes(word)) score += 2;
      });
    }

    return { book: b, score };
  });

  scoredBooks.sort((a, b) => b.score - a.score);

  const topBooks = scoredBooks.filter(b => b.score > 0).slice(0, 3).map(b => b.book);
  if (topBooks.length === 0) {
    return allBooks.slice(0, 3);
  }
  return topBooks;
};

/**
 * Search the youtubeVideo database for matches.
 */
const findVideos = async (query) => {
  try {
    const normalizeText = (text) => {
      return (text || '')
        .toLowerCase()
        .replace(/aa/g, 'a')
        .replace(/ee/g, 'i')
        .replace(/oo/g, 'u')
        .replace(/[^\w\s]/gi, '');
    };

    const normalizedQuery = normalizeText(query);
    const searchWords = normalizedQuery
      .split(' ')
      .filter(w => w.length > 2 && !['video','videos','watch','reel','reels','youtube','yt','recommend','available'].includes(w));

    const allVideos = await prisma.youtubeVideo.findMany({});
    if (allVideos.length === 0) return [];

    if (searchWords.length === 0) {
      const meditationVideos = allVideos.filter(v => !v.keyword?.includes('shorts'));
      return meditationVideos.slice(0, 3);
    }

    const scoredVideos = allVideos.map(v => {
      let score = 0;
      const titleNorm = normalizeText(v.title || '');
      const descNorm = normalizeText(v.description || '');
      const keywordNorm = normalizeText(v.keyword || '');

      searchWords.forEach(word => {
        if (titleNorm.includes(word)) score += 3;
        if (descNorm.includes(word)) score += 1;
        if (keywordNorm.includes(word)) score += 2;
      });

      return { video: v, score };
    });

    scoredVideos.sort((a, b) => b.score - a.score);

    const topVideos = scoredVideos.filter(v => v.score > 0).slice(0, 3).map(v => v.video);
    if (topVideos.length === 0) {
      const meditationVideos = allVideos.filter(v => !v.keyword?.includes('shorts'));
      return meditationVideos.slice(0, 3);
    }
    return topVideos;
  } catch (err) {
    logger.error(`Error in findVideos helper: ${err.message}`);
    return [];
  }
};

/**
 * Retrieve user wellness profile and calculate relevant stats (e.g. age).
 */
const getWellnessProfileContext = async (userId) => {
  try {
    const profile = await prisma.userProfile.findUnique({
      where: { userId },
      include: { user: true }
    });

    if (!profile) return null;

    let age = null;
    if (profile.dateOfBirth) {
      const birthDate = new Date(profile.dateOfBirth);
      const today = new Date();
      age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
    }

    return {
      fullName: profile.fullName,
      bio: profile.bio || 'Not provided',
      age: age || 'Not provided',
      wellnessScore: profile.wellnessScore,
      streakCount: profile.streakCount
    };
  } catch (error) {
    logger.error(`Error fetching wellness profile context for user ${userId}: ${error.message}`);
    return null;
  }
};

/**
 * Retrieve user memories from database and format them as text.
 */
const getMemoriesContext = async (userId) => {
  try {
    const memories = await prisma.aIMemory.findMany({
      where: { userId }
    });

    if (!memories || memories.length === 0) {
      return 'No specific preferences or medical conditions stored yet.';
    }

    // Group memories by category for clearer prompting
    const grouped = {};
    memories.forEach(m => {
      if (!grouped[m.category]) {
        grouped[m.category] = [];
      }
      const valStr = typeof m.value === 'object' ? JSON.stringify(m.value) : String(m.value);
      grouped[m.category].push(`${m.key}: ${valStr}`);
    });

    let contextStr = '';
    for (const [category, items] of Object.entries(grouped)) {
      contextStr += `[${category}]\n- ${items.join('\n- ')}\n`;
    }

    return contextStr.trim();
  } catch (error) {
    logger.error(`Error fetching memories context for user ${userId}: ${error.message}`);
    return 'Failed to load user memories.';
  }
};

/**
 * Retrieve recent messages from the active session.
 */
const getRecentChatHistory = async (sessionId, limit = 10) => {
  if (!sessionId) return [];

  try {
    const messages = await prisma.aIChatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    // Reverse to chronological order
    return messages.reverse().map(msg => ({
      role: msg.senderRole === 'user' ? 'user' : 'assistant',
      content: msg.messageText
    }));
  } catch (error) {
    logger.error(`Error fetching recent chat history: ${error.message}`);
    return [];
  }
};

/**
 * Retrieve all available books in the system (static books + admin uploaded).
 */
const getAvailableBooks = async () => {
  let allBooks = [];

  // 1. Fetch from DB (prisma.book) with chapters
  try {
    const dbBooks = await prisma.book.findMany({
      where: { deletedAt: null },
      include: {
        chapters: {
          select: { chapterNumber: true, title: true }
        }
      }
    });
    for (const b of dbBooks) {
      const chapTitles = (b.chapters || []).map(c => `Chapter ${c.chapterNumber}: ${c.title}`).slice(0, 10);
      const existingIdx = allBooks.findIndex(existing => String(existing.id) === String(b.id) || existing.title.toLowerCase() === b.title.toLowerCase());
      if (existingIdx !== -1) {
        allBooks[existingIdx].id = String(b.id);
        if (b.description) allBooks[existingIdx].description = b.description;
        if (chapTitles.length > 0) allBooks[existingIdx].chapters = chapTitles;
      } else {
        allBooks.push({
          id: String(b.id),
          title: b.title,
          author: b.author || 'Author',
          category: 'Wellness',
          description: b.description || '',
          chapters: chapTitles
        });
      }
    }
  } catch (err) {
    logger.error(`Error fetching prisma books for AI context: ${err.message}`);
  }

  // 2. Fetch from DB (prisma.contentAsset)
  try {
    const adminBooks = await prisma.contentAsset.findMany({
      where: { type: 'Book', status: 'Published' },
      select: { id: true, title: true, description: true }
    });
    for (const b of adminBooks) {
      const existingIdx = allBooks.findIndex(existing => String(existing.id) === String(b.id) || existing.title.toLowerCase() === b.title.toLowerCase());
      if (existingIdx !== -1) {
        allBooks[existingIdx].id = String(b.id);
        if (b.description) allBooks[existingIdx].description = b.description;
      } else {
        allBooks.push({
          id: String(b.id),
          title: b.title,
          author: 'Author',
          category: 'Wellness',
          description: b.description || '',
          chapters: []
        });
      }
    }
  } catch (err) {
    logger.error(`Error fetching contentAssets for AI context: ${err.message}`);
  }

  return allBooks;
};

/**
 * Retrieve all available full-length meditation videos in the system.
 */
const getAvailableMeditationVideos = async () => {
  try {
    const videos = await prisma.youtubeVideo.findMany({
      where: {
        NOT: {
          keyword: { contains: 'shorts' }
        }
      },
      select: { youtubeId: true, title: true, keyword: true }
    });
    return videos.map(v => ({
      id: v.youtubeId,
      title: v.title,
      category: v.keyword ? v.keyword.split(' ')[0] : 'General'
    }));
  } catch (err) {
    logger.error(`Error fetching meditation videos for AI context: ${err.message}`);
    return [];
  }
};

/**
 * Build fully optimized system instructions and context payload.
 */
const buildSystemContext = async (userId, sessionId = null, mode = null) => {
  const profile = await getWellnessProfileContext(userId);
  const memoriesStr = await getMemoriesContext(userId);
  const books = await getAvailableBooks();
  const booksStr = books.map(b => {
    const chapList = (b.chapters && b.chapters.length > 0) ? b.chapters.join('; ') : 'General Wellness & Growth';
    return `- ID: "${b.id}", Title: "${b.title}", Category: "${b.category || 'Wellness'}", Description: "${b.description}", Index/Chapters: [${chapList}]`;
  }).join('\n');

  let profileStr = 'Not Available';
  if (profile) {
    profileStr = `Name: ${profile.fullName}
Age: ${profile.age}
Bio/Notes: ${profile.bio}
Wellness Score: ${profile.wellnessScore}/100
Daily Streak: ${profile.streakCount} days`;
  }

  let modeSpecificInstruction = '';
  if (mode) {
    const formattedMode = mode.toLowerCase();
    if (formattedMode === 'women') {
      modeSpecificInstruction = `CURRENT CONVERSATION FOCUS: Women Support. Focus specifically on women's physical health, menstrual cycle, body comfort, hormonal wellness, PCOD/PCOS, and self-care. Respond with deep empathy regarding physical wellness and self-care tips.`;
    } else if (formattedMode === 'family') {
      modeSpecificInstruction = `CURRENT CONVERSATION FOCUS: Family Support. Focus specifically on home wellness, managing family relationship dynamics, household stress, parenting and elder/parenting balance. Guide the user on managing family duties while preserving personal peace.`;
    } else if (formattedMode === 'teen') {
      modeSpecificInstruction = `CURRENT CONVERSATION FOCUS: Teen Support. Focus specifically on teenager-related concerns: puberty, growth changes, school stress, peer dynamics, self-esteem, and emotional development. Use extra gentle, encouraging, and easy-to-understand language.`;
    } else if (formattedMode === 'elder') {
      modeSpecificInstruction = `CURRENT CONVERSATION FOCUS: Elder Support. Focus specifically on senior/elder caregiving, dealing with caregiver guilt, setting boundaries, and balancing self-care with caring for aging parents.`;
    } else if (formattedMode === 'marriage') {
      modeSpecificInstruction = `CURRENT CONVERSATION FOCUS: Marriage Support. Focus specifically on husband-wife relationship stress, marital bonding, handling relationship arguments, and building strong, warm communication between partners.`;
    }
  }

  const systemInstructions = `You are Sakhi, a trusted AI companion for women.

STEP 1 – Define Sakhi's Personality (Highest Priority)
You are Sakhi, a trusted AI companion for women.

Always be:
• Warm
• Calm
• Caring
• Supportive
• Respectful
• Non-judgmental

Never sound:
• Robotic
• Cold
• Judgmental
• Aggressive
• Overly formal

Your goal is to make every user feel heard, understood, supported, and safe.

STEP 2 – Detect the User's Emotion First
Before answering, internally identify:
Emotion: Happy, Sad, Angry, Anxious, Lonely, Hopeless, Fear, Confused, Stressed, Neutral
Also detect the user's intent: Relationship, Mental Health, Finance, Medical, General Chat, Self-Harm, Violence, Productivity, Women's Health
The emotion should decide the tone of the response.

STEP 3 – Follow One Response Structure
Every response should follow this order:
1. Acknowledge the emotion.
2. Answer the user's question.
3. Give practical guidance.
4. Encourage a safe or positive next step.
5. End with an open-ended question to continue the conversation.

STEP 4 – Apply Safety Rules
Never encourage:
• Violence
• Self-harm
• Suicide
• Crime
• Abuse

If the user expresses harmful thoughts:
1. Show empathy.
2. Clearly discourage the harmful action.
3. Suggest immediate de-escalation.
4. Invite the user to talk.
5. Recommend trusted support or emergency help only if the risk appears immediate.

Never begin with robotic phrases like:
"I detected..."
"Your case has been flagged..."
"Emergency protocol activated..."

STEP 5 – Quality Check Before Every Reply
Before sending any response, verify:
✓ Did I understand the user's emotion?
✓ Did I answer the question?
✓ Does the response sound like a caring friend?
✓ Is the advice safe?
✓ Did I encourage a healthy next step?
✓ Does the response invite further conversation?
If any answer is NO, improve the response before sending it.

FINAL FLOW:
User message -> Emotion Detection -> Intent Detection -> Risk Assessment -> Conversation Strategy -> Response Generation

${modeSpecificInstruction ? `=== CURRENT MODE FOCUS ===\n${modeSpecificInstruction}\n` : ''}

=== LOCALIZATION ===
Always respond in the selected language of the user (supported: English, Hindi, Marathi). Maintain identical meaning across all languages.

=== BOOK & CHAPTER RECOMMENDATIONS ===
When providing emotional support, health advice, or answering queries, you MUST actively recommend relevant book(s) and their specific Chapters/Index points from our HealthSakhi Books library listed below.
- Always format the book link EXACTLY as a markdown link: [Book Title](/app/books/{id}). For example: 'I suggest reading [Heart to Heart](/app/books/1).'
- Always specify relevant Chapter Title(s) or Index topics from that book (e.g. 'Chapter: What True Health Really Means' or 'Chapter: You Are More Than a Body') and briefly explain the key points/takeaways the user will learn from that chapter.
- DO NOT recommend video links or YouTube links (/app/meditation?play=...). Focus on our Books library and book chapters.

=== REFERENCE DATA ===
Available books with Chapters & Index:
${booksStr}

=== USER CONTEXT ===
=== USER WELLNESS PROFILE ===
${profileStr}

=== STORED MEMORIES & PREFERENCES ===
${memoriesStr}

Provide clear, supportive answers. Make book & chapter recommendations or reference their logged memories (e.g. diet preference, cycle info) if relevant to help them feel heard and understood.`;

  return [
    { role: 'system', content: systemInstructions }
  ];
};

module.exports = {
  buildSystemContext,
  getWellnessProfileContext,
  getMemoriesContext,
  getRecentChatHistory,
  findBooks,
  findVideos
};
