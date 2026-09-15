const prisma = require('../../config/database');
const { ApiError } = require('../../middlewares/errorHandler');

// ─── BOOK LIBRARY ────────────────────────────────────────────────────────────

/**
 * List all published books with user reading progress
 */
const listBooks = async (userId, search) => {
  const where = { status: 'published', deletedAt: null };
  if (search) {
    where.OR = [
      { title: { contains: search } },
      { author: { contains: search } }
    ];
  }

  const books = await prisma.book.findMany({
    where,
    include: {
      progress: {
        where: { userId },
        take: 1
      }
    }
  });

  return {
    success: true,
    books: books.map(b => ({
      id: b.id,
      title: b.title,
      author: b.author,
      cover_url: b.coverUrl,
      total_chapters: b.totalChapters,
      progress_percent: b.progress[0]
        ? Number(b.progress[0].completionPercentage)
        : 0
    }))
  };
};

/**
 * Get single book detail with chapters and available translation languages
 */
const getBook = async (bookId) => {
  const book = await prisma.book.findFirst({
    where: { id: bookId, deletedAt: null },
    include: {
      chapters: {
        orderBy: { chapterNumber: 'asc' }
      },
      translations: {
        select: { languageCode: true },
        distinct: ['languageCode']
      }
    }
  });

  if (!book) throw new ApiError(404, 'BOOK_NOT_FOUND', 'Book not found.');

  return {
    success: true,
    book: {
      id: book.id,
      title: book.title,
      author: book.author,
      cover_url: book.coverUrl,
      description: book.description,
      languages: [...new Set(book.translations.map(t => t.languageCode))],
      chapters: book.chapters.map(c => ({
        id: c.id,
        chapter_number: c.chapterNumber,
        title: c.title
      }))
    }
  };
};

/**
 * Get chapter content — serve translation if lang param is provided and exists;
 * fall back to English content_url otherwise.
 */
const getChapter = async (bookId, chapterId, lang) => {
  const chapter = await prisma.bookChapter.findFirst({
    where: { id: chapterId, bookId }
  });

  if (!chapter) throw new ApiError(404, 'CHAPTER_NOT_FOUND', 'Chapter not found.');

  let contentUrl = chapter.contentUrl;
  let title = chapter.title;
  let resolvedLang = 'en';

  if (lang && lang !== 'en') {
    const translation = await prisma.bookTranslation.findUnique({
      where: {
        chapterId_languageCode: {
          chapterId,
          languageCode: lang
        }
      }
    });

    if (translation) {
      contentUrl = translation.translatedContentUrl;
      title = translation.translatedTitle;
      resolvedLang = lang;
    }
    // Else fall back to English silently (as per RULES.md)
  }

  return {
    success: true,
    chapter_id: chapter.id,
    chapter_number: chapter.chapterNumber,
    language: resolvedLang,
    title,
    content_url: contentUrl
  };
};

/**
 * Upsert reading progress for a user-book pair
 */
const saveBookProgress = async (userId, bookId, data) => {
  const { chapter_id, last_read_page, completion_percentage } = data;

  // Verify book and chapter belong together
  const chapter = await prisma.bookChapter.findFirst({
    where: { id: chapter_id, bookId }
  });
  if (!chapter) throw new ApiError(404, 'CHAPTER_NOT_FOUND', 'Chapter not found in this book.');

  await prisma.bookProgress.upsert({
    where: { userId_bookId: { userId, bookId } },
    update: {
      chapterId: chapter_id,
      lastReadPage: last_read_page,
      completionPercentage: completion_percentage
    },
    create: {
      userId,
      bookId,
      chapterId: chapter_id,
      lastReadPage: last_read_page,
      completionPercentage: completion_percentage
    }
  });

  return { success: true, message: 'Reading progress updated.' };
};

// ─── VIDEOS ──────────────────────────────────────────────────────────────────

/**
 * List videos. Premium-locked videos expose `unlocked` flag based on user plan.
 */
const listVideos = async (userId, playlist) => {
  const where = { deletedAt: null };
  if (playlist) where.playlistName = { contains: playlist };

  // Check if user has active premium subscription
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    include: {
      subscriptions: {
        where: { deletedAt: null, endsAt: { gte: new Date() } },
        include: { plan: true },
        take: 1
      }
    }
  });

  let isPremiumUser = false;
  if (user?.subscriptions?.[0]?.status === 'ACTIVE') {
    isPremiumUser = user.subscriptions[0].plan.slug !== 'free-sakhi';
  }

  const videos = await prisma.video.findMany({
    where,
    include: {
      progress: { where: { userId }, take: 1 }
    }
  });

  return {
    success: true,
    videos: videos.map(v => ({
      id: v.id,
      title: v.title,
      video_url: v.videoUrl,
      duration: v.duration,
      playlist_name: v.playlistName,
      is_premium: v.isPremium,
      unlocked: !v.isPremium || isPremiumUser,
      last_watched: v.progress[0]?.lastWatchedTimestamp ?? 0,
      completed: v.progress[0]?.completed ?? false
    }))
  };
};

/**
 * Upsert video watch progress
 */
const saveVideoProgress = async (userId, videoId, data) => {
  const video = await prisma.video.findFirst({
    where: { id: videoId, deletedAt: null }
  });
  if (!video) throw new ApiError(404, 'VIDEO_NOT_FOUND', 'Video not found.');

  await prisma.videoProgress.upsert({
    where: { userId_videoId: { userId, videoId } },
    update: {
      lastWatchedTimestamp: data.last_watched_timestamp,
      completed: data.completed
    },
    create: {
      userId,
      videoId,
      lastWatchedTimestamp: data.last_watched_timestamp,
      completed: data.completed
    }
  });

  return { success: true };
};

// ─── MEDITATION SESSIONS ─────────────────────────────────────────────────────

/**
 * List meditation sessions filtered by optional category
 */
const listMeditations = async (category) => {
  const where = { deletedAt: null };
  if (category) where.category = { contains: category };

  const sessions = await prisma.meditationSession.findMany({
    where,
    orderBy: { createdAt: 'desc' }
  });

  return {
    success: true,
    meditations: sessions.map(s => ({
      id: s.id,
      title: s.title,
      category: s.category,
      audio_url: s.audioUrl,
      duration: s.duration
    }))
  };
};

// ─── AFFIRMATIONS ─────────────────────────────────────────────────────────────

/**
 * List affirmations filtered by category and/or mood trigger
 */
const listAffirmations = async (category, mood) => {
  const where = {};
  if (category) where.category = category;
  if (mood) where.moodTrigger = mood;

  const items = await prisma.affirmation.findMany({ where });

  if (items.length === 0) {
    return {
      success: true,
      affirmations: [
        { id: 'default-1', text: 'I choose self-love and wellness today.', category: 'Self-Love', mood_trigger: null },
        { id: 'default-2', text: 'Every breath I take balances my mind and body.', category: 'Health', mood_trigger: null },
        { id: 'default-3', text: 'I am strong, capable, and confident.', category: 'Confidence', mood_trigger: null }
      ]
    };
  }

  return {
    success: true,
    affirmations: items.map(a => ({
      id: a.id,
      text: a.text,
      category: a.category,
      mood_trigger: a.moodTrigger
    }))
  };
};

/**
 * List custom Sakhi CMS content filtered by tab/module
 */
const listSakhiContent = async (filters) => {
  const where = { status: 'Published' };
  if (filters.tab) {
    where.tab = filters.tab;
  }

  const content = await prisma.sakhiContent.findMany({
    where,
    orderBy: { createdAt: 'desc' }
  });

  return {
    success: true,
    content
  };
};

module.exports = {
  listBooks,
  getBook,
  getChapter,
  saveBookProgress,
  listVideos,
  saveVideoProgress,
  listMeditations,
  listAffirmations,
  listSakhiContent
};
