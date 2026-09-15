/**
 * youtube.service.js
 * Fetches meditation-related videos from YouTube Data API v3
 * and saves them to the database (deduped by youtubeId).
 */
const axios = require('axios');
const prisma = require('../../config/database');
const logger = require('../../utils/logger');

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const YOUTUBE_SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';

const MEDITATION_KEYWORDS = [
  // Full videos
  'health motivation',
  'relaxation motivation',
  'sleep motivation',
  'focus motivation',
  'stress motivation',
  'women health',
  'heart care',
  'mental healing',
  'relationships',
  'cravings',
  // Shorts
  'health motivation shorts',
  'relaxation motivation shorts',
  'sleep motivation shorts',
  'focus motivation shorts',
  'stress motivation shorts',
];

/**
 * Fetch videos for a single keyword from YouTube and upsert into DB.
 * Returns the count of new videos inserted.
 */
const fetchAndSaveByKeyword = async (keyword) => {
  if (!YOUTUBE_API_KEY || YOUTUBE_API_KEY === 'YOUR_YOUTUBE_API_KEY_HERE') {
    logger.warn('[YouTube] YOUTUBE_API_KEY is not set. Skipping fetch.');
    return 0;
  }

  try {
    const isShort = keyword.includes('shorts');
    const apiParams = {
      part: 'snippet',
      q: keyword,
      type: 'video',
      maxResults: 10,
      relevanceLanguage: 'en',
      safeSearch: 'moderate',
      key: YOUTUBE_API_KEY,
    };

    if (isShort) {
      apiParams.videoDuration = 'short';
    } else {
      apiParams.videoDuration = 'medium'; // 4-20 minutes
    }

    const { data } = await axios.get(YOUTUBE_SEARCH_URL, {
      params: apiParams,
    });

    const items = data.items || [];
    let newCount = 0;

    for (const item of items) {
      const youtubeId = item.id?.videoId;
      if (!youtubeId) continue;

      const snippet = item.snippet;

      // Use createMany with skipDuplicates is not available for all DBs;
      // use upsert to safely handle duplicates via the unique youtubeId constraint.
      const result = await prisma.youtubeVideo.upsert({
        where: { youtubeId },
        update: {}, // do nothing on conflict — keep existing record
        create: {
          youtubeId,
          title: snippet.title?.slice(0, 500) || 'Untitled',
          description: snippet.description || null,
          thumbnailUrl:
            snippet.thumbnails?.high?.url ||
            snippet.thumbnails?.medium?.url ||
            snippet.thumbnails?.default?.url ||
            '',
          channelTitle: snippet.channelTitle?.slice(0, 255) || 'Unknown Channel',
          publishedAt: new Date(snippet.publishedAt),
          keyword,
        },
      });

      // If createdAt is very recent, it was a new insert
      const isNew = Date.now() - new Date(result.createdAt).getTime() < 5000;
      if (isNew) newCount++;
    }

    logger.info(`[YouTube] Synced keyword "${keyword}": ${newCount} new videos saved.`);
    return newCount;
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    logger.error(`[YouTube] Failed to fetch keyword "${keyword}": ${msg}`);
    return 0;
  }
};

/**
 * Run fetch across all meditation keywords.
 * Called by the cron job and on startup.
 */
const syncAllMeditationVideos = async () => {
  logger.info('[YouTube] Starting full meditation video sync...');
  let total = 0;
  for (const keyword of MEDITATION_KEYWORDS) {
    const count = await fetchAndSaveByKeyword(keyword);
    total += count;
  }
  logger.info(`[YouTube] Sync complete. Total new videos: ${total}`);
  return total;
};

/**
 * List YouTube meditation videos from DB with optional keyword filter.
 * Returns paginated results ordered by publishedAt desc.
 */
const listYoutubeVideos = async ({ keyword, videoType, page = 1, limit = 20, random = true } = {}) => {
  const andConditions = [];

  if (videoType === 'short') {
    andConditions.push({ keyword: { contains: 'shorts' } });
  } else if (videoType === 'full') {
    andConditions.push({ NOT: { keyword: { contains: 'shorts' } } });
  }

  if (keyword) {
    andConditions.push({ keyword: { contains: keyword } });
  }

  const where = andConditions.length > 0 ? { AND: andConditions } : {};

  if (random) {
    // 1. Fetch matching video IDs
    const allVideos = await prisma.youtubeVideo.findMany({
      where,
      select: { id: true },
    });

    const total = allVideos.length;

    // 2. Shuffle IDs using Fisher-Yates algorithm
    const shuffledIds = allVideos.map((v) => v.id);
    for (let i = shuffledIds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledIds[i], shuffledIds[j]] = [shuffledIds[j], shuffledIds[i]];
    }

    // 3. Slice for pagination
    const skip = (page - 1) * limit;
    const paginatedIds = shuffledIds.slice(skip, skip + limit);

    // 4. Fetch full video records
    const videos = await prisma.youtubeVideo.findMany({
      where: {
        id: { in: paginatedIds },
      },
    });

    // 5. Order the retrieved videos to match the shuffled IDs order
    const videoMap = new Map(videos.map((v) => [v.id, v]));
    const orderedVideos = paginatedIds.map((id) => videoMap.get(id)).filter(Boolean);

    return {
      success: true,
      total,
      page,
      limit,
      videos: orderedVideos.map((v) => ({
        id: v.id,
        youtubeId: v.youtubeId,
        title: v.title,
        description: v.description,
        thumbnailUrl: v.thumbnailUrl,
        channelTitle: v.channelTitle,
        publishedAt: v.publishedAt,
        keyword: v.keyword,
        embedUrl: `https://www.youtube.com/embed/${v.youtubeId}?autoplay=1&rel=0`,
        watchUrl: `https://www.youtube.com/watch?v=${v.youtubeId}`,
      })),
    };
  } else {
    const skip = (page - 1) * limit;
    const [videos, total] = await Promise.all([
      prisma.youtubeVideo.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.youtubeVideo.count({ where }),
    ]);

    return {
      success: true,
      total,
      page,
      limit,
      videos: videos.map((v) => ({
        id: v.id,
        youtubeId: v.youtubeId,
        title: v.title,
        description: v.description,
        thumbnailUrl: v.thumbnailUrl,
        channelTitle: v.channelTitle,
        publishedAt: v.publishedAt,
        keyword: v.keyword,
        embedUrl: `https://www.youtube.com/embed/${v.youtubeId}?autoplay=1&rel=0`,
        watchUrl: `https://www.youtube.com/watch?v=${v.youtubeId}`,
      })),
    };
  }
};

module.exports = {
  syncAllMeditationVideos,
  listYoutubeVideos,
  MEDITATION_KEYWORDS,
};
