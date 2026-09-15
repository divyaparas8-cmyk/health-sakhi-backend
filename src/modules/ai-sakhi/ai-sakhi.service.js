const prisma = require('../../config/database');
const { ApiError } = require('../../middlewares/errorHandler');
const logger = require('../../utils/logger');

/**
 * Helper: Retrieve user plan type
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

  // Fallback to free tier slug
  return 'free-sakhi';
};

/**
 * 1. Create a fresh chat session
 */
const createSession = async (userId, title) => {
  const session = await prisma.aIChatSession.create({
    data: {
      userId,
      title: title || 'New Chat Session'
    }
  });

  return {
    success: true,
    session_id: session.id,
    title: session.title
  };
};

/**
 * 2. Retrieve history of sessions
 */
const getSessions = async (userId) => {
  const sessions = await prisma.aIChatSession.findMany({
    where: { userId, deletedAt: null },
    orderBy: { createdAt: 'desc' }
  });

  return {
    success: true,
    sessions: sessions.map(s => ({
      id: s.id,
      title: s.title,
      created_at: s.createdAt
    }))
  };
};

/**
 * 3. Retrieve messages inside a session
 */
const getMessages = async (sessionId, userId) => {
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
    messages: messages.map(m => ({
      id: m.id,
      role: m.senderRole,
      message: m.messageText,
      created_at: m.createdAt
    }))
  };
};

/**
 * 4. Send chat message to AI Sakhi (with daily limit checking and counter logging)
 */
const sendMessage = async (userId, sessionId, messageText, mode = null) => {
  const session = await prisma.aIChatSession.findFirst({
    where: { id: sessionId, userId, deletedAt: null }
  });

  if (!session) {
    throw new ApiError(404, 'SESSION_NOT_FOUND', 'Chat session not found.');
  }

  const planSlug = await getUserPlanSlug(userId);
  const isFree = planSlug === 'free-sakhi';
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  let remainingChatsToday = 'unlimited';

  if (isFree && process.env.NODE_ENV !== 'development') {
    // Query usage limit record
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

    remainingChatsToday = 5 - (currentCount + 1);
  }

  // Simulated AI response generator
  let responseText = "I hear you, Sakhi. I'm here to support you on your health and wellness journey. Let's work on this together.";
  const msgLower = messageText.toLowerCase();

  const followUpQuestions = {
    book: [
      "Have you read any wellness books recently, or is this your first time exploring them?",
      "Would you like me to tell you more about the chapters of this book?",
      "How do you feel about setting a small goal to read just a few pages today?"
    ],
    pcod: [
      "Have you been diagnosed with PCOS/PCOD, or are you just experiencing some related symptoms lately?",
      "Are you facing any issues like irregular periods, sudden acne, or hair fall?",
      "Would you like some recommendations on diet adjustments specifically for PCOD?"
    ],
    stress: [
      "What is weighing on your mind the most today, Sakhi? Is it work, family, or just general fatigue?",
      "How was your sleep last night? Sometimes a restless mind comes from a restless night.",
      "Did you manage to take even 5 minutes of quiet time for yourself today?"
    ],
    diet: [
      "Are you looking to manage a specific health condition, or just trying to eat cleaner in general?",
      "How is your daily water intake? Staying hydrated is just as important as eating well.",
      "What are the main challenges you face when trying to maintain a healthy diet?"
    ],
    general: [
      "How are you feeling overall today, Sakhi? Is there anything specific you would like to share?",
      "Did you take some time to drink enough water and breathe deeply today?",
      "How can I make your journey a little lighter or more comfortable today?"
    ]
  };

  const getRandomQuestion = (category) => {
    const list = followUpQuestions[category] || followUpQuestions.general;
    const index = Math.floor(Math.random() * list.length);
    return list[index];
  };

  let modeGreeting = "Hello Sakhi! 🌸";
  if (mode) {
    const formattedMode = mode.toLowerCase();
    if (formattedMode === 'teen') {
      modeGreeting = "Hey dear! 🧒 I'm here to listen to whatever you are going through. Emo-stress or changes can feel huge at your age, but you are not alone.";
    } else if (formattedMode === 'family') {
      modeGreeting = "Hello Sakhi! 🏠 Family dynamics and household tasks can sometimes feel very overwhelming. Let's look after your peace of mind first.";
    } else if (formattedMode === 'elder') {
      modeGreeting = "Hello Sakhi! 🤝 Caring for elders and senior family members is a beautiful responsibility, but it requires a lot of emotional strength. Remember to prioritize your own recovery and peace.";
    } else if (formattedMode === 'marriage') {
      modeGreeting = "Hello Sakhi! 💑 Marital relationships require a lot of understanding and communication. Let's work together to manage the stress and keep your bond strong.";
    } else if (formattedMode === 'women') {
      modeGreeting = "Hello Sakhi! 🌸 I'm here for your heart and body. Let's support your wellness journey.";
    }
  }

  const isBookRequest = msgLower.includes('book') || 
                        msgLower.includes('books') || 
                        msgLower.includes('kitaab') || 
                        msgLower.includes('kitab') || 
                        msgLower.includes('read') || 
                        msgLower.includes('suggest');

  if (isBookRequest) {
    let mood = null;
    if (msgLower.includes('happy') || msgLower.includes('joy') || msgLower.includes('excited') || msgLower.includes('good')) {
      mood = 'Happy';
    } else if (msgLower.includes('stress') || msgLower.includes('anxiety') || msgLower.includes('anxious') || msgLower.includes('tense')) {
      mood = 'Stressed';
    } else if (msgLower.includes('tired') || msgLower.includes('exhausted') || msgLower.includes('sleepy') || msgLower.includes('fatigue')) {
      mood = 'Tired';
    } else if (msgLower.includes('sad') || msgLower.includes('low') || msgLower.includes('gloom') || msgLower.includes('depressed')) {
      mood = 'Low Energy';
    }

    if (!mood) {
      const latestMoodLog = await prisma.moodLog.findFirst({
        where: { userId },
        orderBy: { loggedAt: 'desc' }
      });
      if (latestMoodLog) {
        mood = latestMoodLog.moodType;
      }
    }

    const fs = require('fs');
    const path = require('path');
    let allBooks = [];
    try {
      const dbBooks = await prisma.book.findMany({ where: { deletedAt: null } });
      allBooks.push(...dbBooks);
    } catch(e) {}
    try {
      const assetBooks = await prisma.contentAsset.findMany({ where: { type: 'Book', status: 'Published' } });
      allBooks.push(...assetBooks);
    } catch(e) {}
    try {
      const jsonPath = path.join(__dirname, '../../../../health-sakhi-frontend/public/books/books_list.json');
      if (fs.existsSync(jsonPath)) {
        const staticBooks = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        if (Array.isArray(staticBooks)) allBooks.push(...staticBooks);
      }
    } catch(e) {}

    let suggestedBook = null;
    if (allBooks.length > 0) {
      const searchWords = msgLower.replace(/[^\w\s]/gi, '').split(' ').filter(w => w.length > 3 && !['book','books','suggest','please','read','give','show','nikaal','meko','sakhi'].includes(w));
      let bestBook = null;
      let bestScore = -1;

      allBooks.forEach(b => {
        let score = 0;
        const titleLower = (b.title || '').toLowerCase();
        const descLower = (b.description || b.desc || '').toLowerCase();
        
        searchWords.forEach(word => {
          if (titleLower.includes(word)) score += 3;
          if (descLower.includes(word)) score += 1;
        });

        if (mood) {
          const keywords = {
            'Happy': ['wellness', 'desire', 'science', 'happy', 'joy', 'heart'],
            'Tired': ['beauty', 'parlour', 'tired', 'sleep', 'rest'],
            'Stressed': ['pcod', 'protocol', 'stress', 'anxiety', 'calm', 'parenting'],
            'Low Energy': ['loneliness', 'healing', 'sad', 'depressed', 'low', 'child']
          }[mood] || [];
          keywords.forEach(kw => {
            if (titleLower.includes(kw)) score += 2;
            if (descLower.includes(kw)) score += 1;
          });
        }
        if (score > bestScore) {
          bestScore = score;
          bestBook = b;
        }
      });
      
      if (bestBook && bestScore > 0) {
        suggestedBook = bestBook;
      } else {
        suggestedBook = allBooks[Math.floor(Math.random() * allBooks.length)];
      }
    }

    if (suggestedBook) {
      const titleLower = (suggestedBook.title || '').toLowerCase();
      const bookRecommends = {
        'womens monthly wellness': 'It is a wonderful guide for tracking your monthly cycle, managing symptoms, and understanding your hormonal health. This book is very good for maintaining your daily wellness.',
        'beauty without parlour': 'It is a very good self-care book filled with natural wellness tips and soothing home-pampering routines to relax your mind and body.',
        'healing loneliness': 'It is an incredibly comforting and supportive read that helps you navigate feelings of isolation and rebuild emotional warmth. This book is really good for your heart and soul.',
        'the pcod protocol': 'It is highly recommended for managing PCOD/PCOS symptoms naturally through simple lifestyle, exercise, and diet choices. This book is exceptionally good for hormonal balance.',
        'science of desire': 'It is a great book to help you understand relationship bonding, emotional intimacy, and connection.'
      };

      let customBlurb = '';
      for (const [key, blurb] of Object.entries(bookRecommends)) {
        if (titleLower.includes(key)) {
          customBlurb = blurb;
          break;
        }
      }

      const blurbText = customBlurb || suggestedBook.description || suggestedBook.desc || 'It is a wonderful resource to support your wellbeing today.';
      
      responseText = `${modeGreeting} Since you are feeling ${mood ? mood.toLowerCase() : 'wellness-focused'}, I highly suggest reading **"${suggestedBook.title}"** by *${suggestedBook.author || 'our expert panel'}*.

✨ **Why this book is great for you:**
${blurbText}

📖 You can easily read this book right now in the **Books section** of our app.

👉 ${getRandomQuestion('book')}`;
    } else {
      responseText = `${modeGreeting} I suggest checking out our Book Library to find a book that matches how you feel. Reading can be incredibly healing!

👉 ${getRandomQuestion('book')}`;
    }
  } else if (msgLower.includes('pcod') || msgLower.includes('pcos')) {
    responseText = `${modeGreeting} PCOD/PCOS is highly manageable with a few healthy lifestyle tweaks:

🌿 **Healthy Diet:** Focus on leafy greens, whole grains, and lean proteins to balance hormones.
🏃‍♀️ **Daily Activity:** Just 30 minutes of walking, yoga, or light exercise can work wonders.
💧 **Stay Hydrated:** Drink plenty of water throughout the day to flush out toxins.

Don't worry, we are in this together! You can also consult our certified health advisors for a personalized plan.

👉 ${getRandomQuestion('pcod')}`;
  } else if (msgLower.includes('stress') || msgLower.includes('anxiety') || msgLower.includes('sad')) {
    responseText = `${modeGreeting} Stress and emotional weight can deeply affect your body and even disturb your menstrual cycle. Let's take a quick pause and do a simple breathing exercise together:

✨ **4-7-8 Breathing Technique:**
1. **Inhale** slowly through your nose for **4 seconds**.
2. **Hold** your breath for **7 seconds**.
3. **Exhale** completely through your mouth for **8 seconds**.

Repeat this 3 times. How does that feel?

👉 ${getRandomQuestion('stress')}`;
  } else if (msgLower.includes('diet') || msgLower.includes('food')) {
    responseText = `${modeGreeting} Eating the right food is key to regular cycles and high energy levels. Here's a quick guide for a balanced plate:

🥬 **Leafy Greens & Veggies:** Rich in iron, fiber, and essential vitamins.
🌾 **Complex Carbs:** Switch to oats, quinoa, or brown rice to maintain stable insulin levels.
🍳 **Clean Proteins:** Eggs, dal, paneer, or tofu to support hormone production.

Small, positive changes in your daily meals can make a big difference!

👉 ${getRandomQuestion('diet')}`;
  } else {
    responseText = `${modeGreeting} I hear you, and I am always here to support you on your health and wellness journey. Let's take it one step at a time.

Remember to:
• Listen to your body and rest when needed.
• Stay positive, because your wellbeing is what matters most.

👉 ${getRandomQuestion('general')}`;
  }

  const nowTime = new Date();
  // Perform updates inside a transaction
  await prisma.$transaction(async (tx) => {
    // 1. Save User Message
    await tx.aIChatMessage.create({
      data: {
        sessionId,
        senderRole: 'user',
        messageText,
        tokensUsed: Math.ceil(messageText.length / 4),
        createdAt: new Date(nowTime.getTime() - 1000)
      }
    });

    // 2. Save AI Assistant Message
    await tx.aIChatMessage.create({
      data: {
        sessionId,
        senderRole: 'assistant',
        messageText: responseText,
        tokensUsed: Math.ceil(responseText.length / 4),
        createdAt: nowTime
      }
    });

    // 3. Update Daily usage tracking count if user is on Free tier
    if (isFree) {
      await tx.aIUsageLimit.upsert({
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
  });

  return {
    success: true,
    reply: responseText,
    remaining_chats_today: remainingChatsToday
  };
};

module.exports = {
  createSession,
  getSessions,
  getMessages,
  sendMessage
};
