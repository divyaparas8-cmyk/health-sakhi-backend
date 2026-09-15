const axios = require('axios');
const prisma = require('../../config/database');
const logger = require('../../utils/logger');

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const YOUTUBE_SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';

// List of default library videos with their categories
const LIBRARY_VIDEOS = [
  { title: 'Estrogen & Progesterone 101', category: 'Women Health', defaultId: 'QJm-48rC-E8', description: 'Understanding the primary female sex hormones, their roles in the menstrual cycle, and how they impact mood and energy.' },
  { title: 'Thyroid Health in Women', category: 'Women Health', defaultId: 'y6yE7QG1y58', description: 'Exploring thyroid hormones, symptoms of hypothyroidism and hyperthyroidism, and nutrition tips for supporting thyroid function.' },
  { title: 'The Four Phases Explained', category: 'Women Health', defaultId: 'gJ246S_76rE', description: 'A deep dive into the follicular, ovulatory, luteal, and menstrual phases, and how to optimize your lifestyle for each phase.' },
  { title: 'Natural PMS Relief', category: 'Women Health', defaultId: '02f2b3wJtQs', description: 'Gentle and natural strategies to ease premenstrual syndrome symptoms including bloating, cramps, mood swings, and fatigue.' },
  { title: 'Managing BP Naturally', category: 'Heart Care', defaultId: 'Ab9OZsDECZw', description: 'Practical and lifestyle-based approaches to maintaining healthy blood pressure through diet, exercise, and stress reduction.' },
  { title: 'The Heart-Brain Connection', category: 'Heart Care', defaultId: 'WhxjXduD8qw', description: 'How emotions and mental stress affect your cardiovascular system, and physical practices to sync heart rate variability.' },
  { title: '5-Minute SOS Breathwork', category: 'Mental Healing', defaultId: 'tEmt1MP_Zsk', description: 'A quick, guided box breathing session designed to instantly calm the nervous system and relieve acute stress or anxiety.' },
  { title: 'Overcoming Overthinking', category: 'Mental Healing', defaultId: 'yqR77sa4EVE', description: 'Cognitive techniques and mindfulness practices to quiet a busy mind, reduce worry, and ground yourself in the present moment.' },
  { title: 'How to Say No', category: 'Relationships', defaultId: 'wL-L2tZ3q1g', description: 'Assertiveness training for women to establish healthy personal and professional boundaries without feeling guilty.' },
  { title: 'Navigating Conflict', category: 'Relationships', defaultId: 'c9nS5Z-C2uQ', description: 'Effective communication strategies for resolving disputes in relationships with empathy, active listening, and constructive responses.' },
  { title: 'Hormonal Hunger vs Emotional Hunger', category: 'Cravings', defaultId: 'aP12n6-8qgM', description: 'Learning to identify physical hunger cues driven by hormones versus emotional cravings triggered by stress or boredom.' },
  { title: 'The Sugar Cycle', category: 'Cravings', defaultId: 'lHJVfxqW76k', description: 'How sugar consumption spikes insulin, triggers energy crashes, creates constant cravings, and how to gently break the loop.' }
];

/**
 * Searches YouTube API for a video matching the query.
 * Falls back to defaultId on failure or if key is missing.
 */
const searchYoutubeVideo = async (query, defaultId) => {
  if (!YOUTUBE_API_KEY || YOUTUBE_API_KEY === 'YOUR_YOUTUBE_API_KEY_HERE') {
    return defaultId;
  }

  try {
    const { data } = await axios.get(YOUTUBE_SEARCH_URL, {
      params: {
        part: 'snippet',
        q: `${query} women health education`,
        type: 'video',
        videoEmbeddable: 'true',
        maxResults: 1,
        key: YOUTUBE_API_KEY
      }
    });

    const videoId = data.items?.[0]?.id?.videoId;
    if (videoId) {
      logger.info(`[Library Video Resolver] Dynamically found YouTube video for "${query}": ${videoId}`);
      return videoId;
    }
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    logger.warn(`[Library Video Resolver] Search failed for "${query}" (falling back to ${defaultId}): ${msg}`);
  }
  return defaultId;
};

/**
 * Initializes and seeds baseline library videos in the database.
 */
const initializeLibraryVideos = async () => {
  logger.info('[Library Video Resolver] Checking baseline library videos...');
  let seededCount = 0;
  let updatedCount = 0;

  try {
    for (const item of LIBRARY_VIDEOS) {
      // For baseline library videos, we use the handpicked defaultId to guarantee 
      // 100% embeddable, public, high-quality, and highly relevant content.
      const videoId = item.defaultId;
      const embedUrl = `https://www.youtube.com/embed/${videoId}`;

      // Check if this video title already exists in the database
      const existing = await prisma.contentAsset.findFirst({
        where: {
          title: item.title,
          type: 'Video'
        }
      });

      if (!existing) {
        await prisma.contentAsset.create({
          data: {
            title: item.title,
            type: 'Video',
            category: item.category,
            status: 'Published',
            mediaUrl: embedUrl,
            description: item.description
          }
        });
        seededCount++;
      } else {
        // Overwrite URL and description if they are different from the verified list
        if (existing.mediaUrl !== embedUrl) {
          await prisma.contentAsset.update({
            where: { id: existing.id },
            data: {
              mediaUrl: embedUrl,
              description: item.description
            }
          });
          updatedCount++;
        }
      }
    }

    if (seededCount > 0 || updatedCount > 0) {
      logger.info(`[Library Video Resolver] Seeded ${seededCount} new, updated ${updatedCount} existing library videos in ContentAsset table.`);
    } else {
      logger.info('[Library Video Resolver] All library videos already initialized and up to date.');
    }
  } catch (err) {
    logger.error('[Library Video Resolver] Failed to initialize library videos:', err.message);
  }
};

module.exports = {
  initializeLibraryVideos
};
