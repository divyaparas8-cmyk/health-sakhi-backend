const prisma = require('../../config/database');
const { ApiError } = require('../../middlewares/errorHandler');
const logger = require('../../utils/logger');
const openaiService = require('../ai/services/openai.service');

/**
 * Helper: Resolve User Plan Badge
 */
const getPlanDetails = (user) => {
  let planName = 'Free Sakhi';
  let endsAt = null;
  let autoRenew = false;
  let badge = 'Free Sakhi';

  if (user.subscriptions && user.subscriptions.length > 0) {
    const activeSub = user.subscriptions.find(sub => {
      const statusUpper = String(sub.status || '').toUpperCase();
      const isActiveStatus = statusUpper === 'ACTIVE' || statusUpper === 'CANCELLED';
      const isNotExpired = !sub.endsAt || new Date(sub.endsAt) > new Date();
      const isPaidPlan = sub.plan && (
        sub.plan.slug !== 'free-sakhi' && 
        !sub.plan.name.toLowerCase().includes('free')
      );
      return isActiveStatus && isNotExpired && isPaidPlan;
    });

    if (activeSub) {
      planName = activeSub.plan.name;
      endsAt = activeSub.endsAt;
      autoRenew = activeSub.autoRenew;
      badge = activeSub.plan.name;
    }
  }

  // Check 1-Month Free Sakhi Trial Expiry
  const userCreatedAt = user.createdAt || user.created_at;
  const oneMonthMs = 30 * 24 * 60 * 60 * 1000;
  const isTrialExpired = planName === 'Free Sakhi' && userCreatedAt && ((Date.now() - new Date(userCreatedAt).getTime()) > oneMonthMs);

  return { planName, endsAt, autoRenew, badge, isTrialExpired };
};

/**
 * 1. Retrieve member profile
 */
const getProfile = async (userId) => {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    include: {
      profile: true,
      subscriptions: {
        where: {
          deletedAt: null
        },
        include: { plan: true },
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  if (!user) {
    throw new ApiError(404, 'MEMBER_NOT_FOUND', 'Member account not found.');
  }

  const planInfo = getPlanDetails(user);

  return {
    success: true,
    profile: {
      id: user.id,
      email: user.email,
      phone: user.phone,
      full_name: user.profile ? user.profile.fullName : null,
      bio: user.profile ? user.profile.bio : null,
      avatar_url: user.profile ? user.profile.avatarUrl : null,
      date_of_birth: user.profile ? user.profile.dateOfBirth : null,
      streak_count: user.profile ? user.profile.streakCount : 0,
      wellness_score: user.profile ? user.profile.wellnessScore : 0,
      booksCompleted: user.profile ? user.profile.booksCompleted : 0,
      loginDays: user.profile ? user.profile.loginDays : 0,
      referralCount: user.profile ? user.profile.referralCount : 0,
      subscription: {
        plan_name: planInfo.planName,
        ends_at: planInfo.endsAt,
        auto_renew: planInfo.autoRenew,
        badge: planInfo.badge,
        is_trial_expired: planInfo.isTrialExpired
      }
    }
  };
};

/**
 * 2. Update member profile settings
 */
const updateProfile = async (userId, data) => {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    include: { profile: true }
  });

  if (!user) {
    throw new ApiError(404, 'MEMBER_NOT_FOUND', 'Member profile not found.');
  }

  const profileData = {};
  if (data.full_name !== undefined) profileData.fullName = data.full_name;
  if (data.bio !== undefined) profileData.bio = data.bio;
  if (data.avatar_url !== undefined) profileData.avatarUrl = data.avatar_url;
  if (data.date_of_birth !== undefined) {
    profileData.dateOfBirth = data.date_of_birth ? new Date(data.date_of_birth) : null;
  }

  const updatedProfile = await prisma.userProfile.update({
    where: { userId },
    data: profileData
  });

  return {
    success: true,
    message: 'Profile settings updated successfully.',
    profile: updatedProfile
  };
};

/**
 * 3. Retrieve member dashboard metrics
 */
const getDashboard = async (userId) => {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    include: {
      profile: true,
      subscriptions: {
        where: { deletedAt: null, endsAt: { gte: new Date() } },
        include: { plan: true },
        take: 1
      }
    }
  });

  if (!user) {
    throw new ApiError(404, 'MEMBER_NOT_FOUND', 'Member not found.');
  }

  // Plan info
  const planInfo = getPlanDetails(user);

  // Todo tasks counters
  const totalTodos = await prisma.todoTask.count({ where: { userId } });
  const completedTodos = await prisma.todoTask.count({ where: { userId, isCompleted: true } });
  const pendingTodos = totalTodos - completedTodos;

  // Financial summary for current month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const transactions = await prisma.financeTransaction.findMany({
    where: {
      userId,
      transactionDate: { gte: startOfMonth }
    }
  });

  let totalIncome = 0;
  let totalExpense = 0;
  transactions.forEach(t => {
    const amt = Number(t.amount);
    if (t.type === 'income') totalIncome += amt;
    else if (t.type === 'expense') totalExpense += amt;
  });

  // Recent mood logs
  const moodLogs = await prisma.moodLog.findMany({
    where: { userId },
    take: 5,
    orderBy: { loggedAt: 'desc' }
  });

  // Dynamic 100-Day Recurring Affirmation Logic
  const nowUtc = new Date();
  const startOfYear = new Date(nowUtc.getFullYear(), 0, 0);
  const diffTime = nowUtc - startOfYear;
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diffTime / oneDay);
  const currentDayIndex = ((dayOfYear - 1) % 100) + 1; // 1 to 100

  let affirmationObj = null;
  try {
    const dailyMessages = require('../../data/daily_messages_100.json');
    affirmationObj = dailyMessages.find(m => m.day === currentDayIndex) || dailyMessages[0];
  } catch (e) {
    console.error('Failed to load 100 daily messages:', e);
  }

  const affirmation = affirmationObj ? affirmationObj.message : 'Believe in yourself, Sakhi. You are stronger than you think.';
  const affirmationTitle = affirmationObj ? affirmationObj.title : 'Daily Affirmation';
  const affirmationDayNumber = currentDayIndex;

  // Dynamic Streak & Missed Days Calculation
  let currentStreak = user.profile ? user.profile.streakCount : 0;
  let missedDays = 0;

  const now = new Date();
  const todayDateStr = now.toISOString().split('T')[0];
  const lastActive = user.profile && user.profile.lastActiveDate ? new Date(user.profile.lastActiveDate) : null;

  if (lastActive) {
    const lastActiveStr = lastActive.toISOString().split('T')[0];
    if (lastActiveStr !== todayDateStr) {
      const diffTime = Math.abs(new Date(todayDateStr) - new Date(lastActiveStr));
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        currentStreak += 1;
        missedDays = 0;
      } else if (diffDays > 1) {
        missedDays = diffDays - 1;
        currentStreak = 1;
      }
      
      if (user.profile) {
        await prisma.userProfile.update({
          where: { userId },
          data: {
            streakCount: currentStreak,
            lastActiveDate: now
          }
        }).catch(() => {});
      }
    }
  } else {
    // Brand new user, no lastActiveDate recorded yet — streak stays as stored (0 for new users)
    if (user.profile) {
      await prisma.userProfile.update({
        where: { userId },
        data: { lastActiveDate: now }
      }).catch(() => {});
    }
  }

  const effectiveStreak = currentStreak || 0;

  // Calculate Badges & Master Status (Total System Badges = 4)
  let unlockedBadgesCount = 0;
  if (effectiveStreak >= 5) unlockedBadgesCount++;
  if (effectiveStreak >= 10) unlockedBadgesCount++;
  if (completedTodos >= 1) unlockedBadgesCount++;
  if (totalIncome > 0 || totalExpense > 0 || completedTodos >= 5) unlockedBadgesCount++;

  const totalBadges = 4;
  const masterStatusTarget = 4;
  const isMasterStatus = unlockedBadgesCount >= masterStatusTarget;

  // Fetch Member Content Progress for Books
  const bookProgresses = await prisma.userContentProgress.findMany({
    where: {
      userId,
      contentType: 'Book'
    }
  }).catch(() => []);

  const completedBooksCount = (bookProgresses || []).filter(p => p.completed).length;

  return {
    success: true,
    dashboard: {
      streak_count: effectiveStreak,
      missed_days: missedDays,
      badges: {
        unlocked: unlockedBadgesCount,
        total: totalBadges,
        formatted: `${String(unlockedBadgesCount).padStart(2, '0')} / ${totalBadges}`,
        master_status_target: masterStatusTarget,
        is_master: isMasterStatus
      },
      completed_books_count: completedBooksCount,
      user_book_progress: (bookProgresses || []).map(p => ({
        content_id: p.contentId,
        position: p.position,
        completed: p.completed
      })),
      wellness_score: user.profile ? user.profile.wellnessScore : 0,
      subscription_badge: planInfo.badge,
      todos: {
        total: totalTodos,
        completed: completedTodos,
        pending: pendingTodos
      },
      finance_summary: {
        month_income: totalIncome,
        month_expense: totalExpense,
        month_net: totalIncome - totalExpense
      },
      recent_moods: moodLogs.map(m => ({
        mood_type: m.moodType,
        intensity: m.intensity,
        logged_at: m.loggedAt
      })),
      daily_affirmation: affirmation,
      daily_affirmation_title: affirmationTitle,
      daily_affirmation_day: affirmationDayNumber
    }
  };
};

/**
 * 4. Log a mood entry and get recommendations
 */
const logMood = async (userId, data) => {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    include: { profile: true }
  });

  if (!user) {
    throw new ApiError(404, 'MEMBER_NOT_FOUND', 'Member not found.');
  }

  const { mood_type, intensity, notes } = data;

  const moodEntry = await prisma.$transaction(async (tx) => {
    // Write mood log
    const entry = await tx.moodLog.create({
      data: {
        userId,
        moodType: mood_type,
        intensity,
        notes
      }
    });

    // Reward: Increment wellness score by 5 (capped at 100)
    if (user.profile) {
      const currentScore = user.profile.wellnessScore || 0;
      const newScore = Math.min(100, currentScore + 5);
      await tx.userProfile.update({
        where: { userId },
        data: {
          wellnessScore: newScore,
          lastActiveDate: new Date()
        }
      });
    }

    return entry;
  });

  // Dynamic recommendations mapping
  let recommendations = {
    breathing_technique: 'Mindful Awareness Breathing',
    audio_relief_url: 'https://s3.amazonaws.com/health-sakhi/meditation/gratitude-meditation.mp3',
    article_suggestion: 'https://s3.amazonaws.com/health-sakhi/articles/positive-vibrations-guide.pdf'
  };

  if (mood_type === 'Stressed') {
    recommendations = {
      breathing_technique: '4-7-8 Breathing Technique',
      audio_relief_url: 'https://s3.amazonaws.com/health-sakhi/meditation/anxiety-relief.mp3',
      article_suggestion: 'https://s3.amazonaws.com/health-sakhi/articles/inner-healing-guide.pdf'
    };
  } else if (mood_type === 'Tired') {
    recommendations = {
      breathing_technique: 'Box Breathing for Relaxation',
      audio_relief_url: 'https://s3.amazonaws.com/health-sakhi/meditation/deep-sleep-booster.mp3',
      article_suggestion: 'https://s3.amazonaws.com/health-sakhi/articles/rest-recovery-protocols.pdf'
    };
  } else if (mood_type === 'Low Energy') {
    recommendations = {
      breathing_technique: 'Bellows Breath (Bhastrika)',
      audio_relief_url: 'https://s3.amazonaws.com/health-sakhi/meditation/energy-recharge.mp3',
      article_suggestion: 'https://s3.amazonaws.com/health-sakhi/articles/kickstart-productivity-guide.pdf'
    };
  }

  return {
    success: true,
    mood_logged: {
      id: moodEntry.id,
      mood_type: moodEntry.moodType,
      intensity: moodEntry.intensity,
      logged_at: moodEntry.loggedAt
    },
    recommendations
  };
};

/**
 * Retrieve mood logs list
 */
const getMoodLogs = async (userId) => {
  const logs = await prisma.moodLog.findMany({
    where: { userId },
    orderBy: { loggedAt: 'desc' }
  });

  return {
    success: true,
    moods: logs
  };
};

/**
 * 5. Create new growth planner todo task
 */
const createTodo = async (userId, data) => {
  const { title, category, due_date, due_time } = data;

  const task = await prisma.todoTask.create({
    data: {
      userId,
      title,
      category,
      dueDate: new Date(due_date),
      dueTime: due_time || null,
      isCompleted: false
    }
  });

  return {
    success: true,
    task: {
      id: task.id,
      title: task.title,
      category: task.category,
      due_date: task.dueDate,
      due_time: task.dueTime,
      is_completed: task.isCompleted
    }
  };
};

/**
 * Toggle task completion (with gamification reward)
 */
const updateTodo = async (userId, taskId, isCompleted) => {
  const task = await prisma.todoTask.findFirst({
    where: { id: taskId, userId }
  });

  if (!task) {
    throw new ApiError(404, 'TODO_NOT_FOUND', 'Checklist task item not found.');
  }

  const updatedTask = await prisma.$transaction(async (tx) => {
    const updated = await tx.todoTask.update({
      where: { id: taskId },
      data: { isCompleted }
    });

    // Reward: Increment streak and wellness score if completed
    if (isCompleted && !task.isCompleted) {
      const userProfile = await tx.userProfile.findUnique({ where: { userId } });
      if (userProfile) {
        const scoreBonus = 2; // +2 points
        const nextScore = Math.min(100, (userProfile.wellnessScore || 0) + scoreBonus);
        
        // Compute streak
        let streak = userProfile.streakCount || 0;
        const lastActive = userProfile.lastActiveDate;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (lastActive) {
          const lastActiveDay = new Date(lastActive);
          lastActiveDay.setHours(0, 0, 0, 0);

          const diffTime = Math.abs(today - lastActiveDay);
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (diffDays === 1) {
            // Consecutive day
            streak += 1;
          } else if (diffDays > 1) {
            // Streak broken
            streak = 1;
          }
        } else {
          streak = 1;
        }

        await tx.userProfile.update({
          where: { userId },
          data: {
            wellnessScore: nextScore,
            streakCount: streak,
            lastActiveDate: new Date()
          }
        });
      }
    }

    return updated;
  });

  return {
    success: true,
    message: isCompleted ? 'Task marked completed.' : 'Task marked pending.',
    task: updatedTask
  };
};

/**
 * Fetch todos list
 */
const getTodos = async (userId, filters) => {
  const whereClause = { userId };
  if (filters.completed !== undefined) {
    whereClause.isCompleted = filters.completed === 'true';
  }
  if (filters.date) {
    whereClause.dueDate = new Date(filters.date);
  }

  const tasks = await prisma.todoTask.findMany({
    where: whereClause,
    orderBy: { dueDate: 'asc' }
  });

  return {
    success: true,
    todos: tasks.map(t => ({
      id: t.id,
      title: t.title,
      category: t.category,
      due_date: t.dueDate,
      due_time: t.dueTime,
      is_completed: t.isCompleted
    }))
  };
};

/**
 * 6. Create finance ledger transaction
 */
const createTransaction = async (userId, data) => {
  const { category_name, type, amount, description, transaction_date } = data;

  const result = await prisma.$transaction(async (tx) => {
    // Find or create Finance Category
    let category = await tx.financeCategory.findUnique({
      where: { name: category_name }
    });

    if (!category) {
      category = await tx.financeCategory.create({
        data: {
          name: category_name,
          type
        }
      });
    }

    // Insert transaction
    const transaction = await tx.financeTransaction.create({
      data: {
        userId,
        categoryId: category.id,
        type,
        amount,
        description,
        transactionDate: new Date(transaction_date)
      }
    });

    return transaction;
  });

  return {
    success: true,
    transaction_id: result.id,
    message: 'Financial transaction recorded successfully.'
  };
};

/**
 * Get user transaction listings
 */
const getTransactions = async (userId) => {
  const transactions = await prisma.financeTransaction.findMany({
    where: { userId },
    include: { category: true },
    orderBy: { transactionDate: 'desc' }
  });

  let totalIncome = 0;
  let totalExpense = 0;
  transactions.forEach(t => {
    const amt = Number(t.amount);
    if (t.type === 'income') totalIncome += amt;
    else if (t.type === 'expense') totalExpense += amt;
  });

  return {
    success: true,
    summary: {
      total_income: totalIncome,
      total_expense: totalExpense,
      net_balance: totalIncome - totalExpense
    },
    transactions: transactions.map(t => ({
      id: t.id,
      category: t.category.name,
      type: t.type,
      amount: Number(t.amount),
      description: t.description,
      date: t.transactionDate,
      createdAt: t.createdAt
    }))
  };
};

/**
 * Update transaction
 */
const updateTransaction = async (userId, transactionId, data) => {
  const { category_name, type, amount, description, transaction_date } = data;

  const txCheck = await prisma.financeTransaction.findFirst({
    where: { id: transactionId, userId }
  });
  if (!txCheck) {
    throw new ApiError(404, 'TRANSACTION_NOT_FOUND', 'Transaction not found or unauthorized.');
  }

  const result = await prisma.$transaction(async (tx) => {
    let category = await tx.financeCategory.findUnique({
      where: { name: category_name }
    });

    if (!category) {
      category = await tx.financeCategory.create({
        data: {
          name: category_name,
          type
        }
      });
    }

    const updated = await tx.financeTransaction.update({
      where: { id: transactionId },
      data: {
        categoryId: category.id,
        type,
        amount: Number(amount),
        description,
        transactionDate: transaction_date ? new Date(transaction_date) : undefined
      }
    });

    return updated;
  });

  return {
    success: true,
    transaction_id: result.id,
    message: 'Transaction updated successfully.'
  };
};

/**
 * Delete transaction
 */
const deleteTransaction = async (userId, transactionId) => {
  const txCheck = await prisma.financeTransaction.findFirst({
    where: { id: transactionId, userId }
  });
  if (!txCheck) {
    throw new ApiError(404, 'TRANSACTION_NOT_FOUND', 'Transaction not found or unauthorized.');
  }

  await prisma.financeTransaction.delete({
    where: { id: transactionId }
  });

  return {
    success: true,
    message: 'Transaction deleted successfully.'
  };
};


/**
 * Export finance ledger report (PDF generation block check)
 */
const exportFinanceReport = async (userId) => {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    include: {
      subscriptions: {
        where: { deletedAt: null, endsAt: { gte: new Date() } },
        include: { plan: true }
      }
    }
  });

  if (!user) {
    throw new ApiError(404, 'MEMBER_NOT_FOUND', 'Member account not found.');
  }

  const planInfo = getPlanDetails(user);

  // Free Tier Block Rule: Access is disabled on free tier
  if (planInfo.badge !== 'Premium Active') {
    throw new ApiError(403, 'EXPORT_BLOCKED', 'Statement and ledger export PDF downloads are blocked on the Free tier. Upgrade to Premium Pro to download reports.');
  }

  const pdfUrl = `https://s3.amazonaws.com/health-sakhi/reports/finance-${userId}-${Date.now()}.pdf`;

  return {
    success: true,
    pdf_url: pdfUrl
  };
};

/**
 * 7. Retrieve Affirmations List
 */
const getAffirmations = async (category, mood) => {
  const whereClause = {};
  if (category) whereClause.category = category;
  if (mood) whereClause.moodTrigger = mood;

  const affirmations = await prisma.affirmation.findMany({
    where: whereClause
  });

  // Provide defaults if DB table is currently empty
  if (affirmations.length === 0) {
    return {
      success: true,
      affirmations: [
        { id: 'default-1', text: 'I choose self-love and wellness today.', category: 'Self-Love' },
        { id: 'default-2', text: 'Every breath I take balances my mind and body.', category: 'Health' },
        { id: 'default-3', text: 'I am strong, capable, and confident.', category: 'Confidence' }
      ]
    };
  }

  return {
    success: true,
    affirmations: affirmations.map(a => ({
      id: a.id,
      text: a.text,
      category: a.category,
      mood_trigger: a.moodTrigger
    }))
  };
};

const dailyCheckIn = async (userId, data) => {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    include: { profile: true }
  });

  if (!user) {
    throw new ApiError(404, 'MEMBER_NOT_FOUND', 'Member not found.');
  }

  const { text } = data;

  // 1. Call Gemini to process the text
  const systemPrompt = `You are a warm, empathetic, and highly supportive AI wellness companion named Health Sakhi. 
Analyze the member's daily check-in message. Write a comforting, highly personalized response to her in Hindi/English (Hinglish) or plain English based on the language she used. Keep the response caring, encouraging, and under 3-4 sentences.

You must classify the user's emotional state into exactly one of these moods: 'Happy', 'Sad', 'Tired', 'Stressed', 'Grateful', 'Low Energy'.
Also, generate an intensity level from 1 (mild) to 5 (extreme).
Generate 2-3 search terms/keywords (simple lowercase words) that could represent relaxing content (e.g. "pcos", "meditation", "anxiety", "cramps", "yoga").

Output MUST be a valid JSON object. Do NOT wrap output in markdown code blocks or add any text/comments outside the JSON structure.

JSON structure:
{
  "supportiveResponse": "Dear Sakhi...",
  "moodType": "Stressed",
  "intensity": 3,
  "searchTerms": ["stress", "breathing"]
}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Check-in text: "${text}"` }
  ];

  let aiReplyObj = {
    supportiveResponse: "I hear you, Sakhi. I'm here for you. Take a deep breath and let's go easy today.",
    moodType: "Stressed",
    intensity: 3,
    searchTerms: ["stress", "anxiety"]
  };

  try {
    const aiRes = await openaiService.generateChatCompletion(messages, userId, {
      action: 'DAILY_CHECKIN_ANALYSIS',
      temperature: 0.7,
      max_tokens: 500
    });

    let cleaned = aiRes.reply.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.substring(7, cleaned.length - 3).trim();
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.substring(3, cleaned.length - 3).trim();
    }

    const parsed = JSON.parse(cleaned);
    if (parsed.supportiveResponse && parsed.moodType) {
      aiReplyObj = parsed;
    }
  } catch (err) {
    logger.error(`Gemini dailyCheckIn analysis failed, falling back to defaults. Error: ${err.message}`);
  }

  // 2. Validate extracted mood type
  const allowedMoods = ['Happy', 'Sad', 'Tired', 'Stressed', 'Grateful', 'Low Energy'];
  if (!allowedMoods.includes(aiReplyObj.moodType)) {
    aiReplyObj.moodType = 'Stressed'; // default fallback
  }

  // 3. Write MoodLog to DB & Award Wellness Score points
  const moodEntry = await prisma.$transaction(async (tx) => {
    // Write mood log (save check-in text in notes)
    const entry = await tx.moodLog.create({
      data: {
        userId,
        moodType: aiReplyObj.moodType,
        intensity: aiReplyObj.intensity || 3,
        notes: text
      }
    });

    // Reward: Increment wellness score by 5 (capped at 100)
    if (user.profile) {
      const currentScore = user.profile.wellnessScore || 0;
      const newScore = Math.min(100, currentScore + 5);
      await tx.userProfile.update({
        where: { userId },
        data: {
          wellnessScore: newScore,
          lastActiveDate: new Date()
        }
      });
    }

    return entry;
  });

  // 4. Query matching resources
  const recommendations = [];
  try {
    const searchTerms = aiReplyObj.searchTerms || [];
    if (searchTerms.length > 0) {
      // Find matching ContentAsset (videos, books, interactive modules)
      const matchingAssets = await prisma.contentAsset.findMany({
        where: {
          status: 'Published',
          OR: searchTerms.map(term => ({
            OR: [
              { title: { contains: term } },
              { description: { contains: term } },
              { category: { contains: term } }
            ]
          }))
        },
        take: 3
      });

      matchingAssets.forEach(asset => {
        recommendations.push({
          id: asset.id,
          type: asset.type.toLowerCase(), // 'video', 'book', 'interactive'
          title: asset.title,
          description: asset.description,
          mediaUrl: asset.mediaUrl,
          category: asset.category
        });
      });
    }

    // Fetch matching meditations from MeditationSession
    const matchingMeditations = await prisma.meditationSession.findMany({
      where: searchTerms.length > 0 ? {
        OR: searchTerms.map(term => ({
          OR: [
            { title: { contains: term } },
            { category: { contains: term } }
          ]
        }))
      } : {},
      take: 2
    });

    matchingMeditations.forEach(med => {
      recommendations.push({
        id: med.id,
        type: 'meditation',
        title: med.title,
        description: med.category,
        mediaUrl: med.audioUrl,
        category: med.category,
        duration: med.duration
      });
    });

    // Fallback: If no recommendations were found, fetch default content assets
    if (recommendations.length === 0) {
      const defaultAssets = await prisma.contentAsset.findMany({
        where: { status: 'Published' },
        take: 2
      });
      defaultAssets.forEach(asset => {
        recommendations.push({
          id: asset.id,
          type: asset.type.toLowerCase(),
          title: asset.title,
          description: asset.description,
          mediaUrl: asset.mediaUrl,
          category: asset.category
        });
      });
    }
  } catch (recErr) {
    logger.error(`Error querying checkin recommendations: ${recErr.message}`);
  }

  return {
    success: true,
    ai_response: aiReplyObj.supportiveResponse,
    mood_logged: {
      id: moodEntry.id,
      mood_type: moodEntry.moodType,
      intensity: moodEntry.intensity,
      logged_at: moodEntry.loggedAt
    },
    recommendations
  };
};

module.exports = {
  getProfile,
  updateProfile,
  getDashboard,
  logMood,
  dailyCheckIn,
  getMoodLogs,
  createTodo,
  updateTodo,
  getTodos,
  createTransaction,
  getTransactions,
  updateTransaction,
  deleteTransaction,
  exportFinanceReport,
  getAffirmations
};
