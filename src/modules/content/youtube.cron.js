/**
 * youtube.cron.js
 * Schedules automatic YouTube meditation video sync every 12 hours.
 * Call startYoutubeCron() once on server startup.
 */
const cron = require('node-cron');
const { syncAllMeditationVideos } = require('./youtube.service');
const logger = require('../../utils/logger');

let cronJob = null;

/**
 * Start the 12-hour cron schedule.
 * Also triggers an immediate first sync on startup so videos
 * are available right away without waiting 12 hours.
 */
const startYoutubeCron = () => {
  logger.info('[YouTube Cron] Initializing meditation video sync scheduler...');

  // Immediate first run on server start (non-blocking)
  setImmediate(async () => {
    try {
      await syncAllMeditationVideos();
    } catch (err) {
      logger.error('[YouTube Cron] Initial sync failed:', err.message);
    }
  });

  // Schedule: every 12 hours at minute 0  (0:00, 12:00)
  // Cron pattern: '0 */12 * * *'
  cronJob = cron.schedule('0 */12 * * *', async () => {
    logger.info('[YouTube Cron] 12-hour scheduled sync triggered.');
    try {
      await syncAllMeditationVideos();
    } catch (err) {
      logger.error('[YouTube Cron] Scheduled sync failed:', err.message);
    }
  });

  logger.info('[YouTube Cron] Scheduler active — syncing every 12 hours.');
};

/**
 * Stop the cron job (useful for graceful shutdown).
 */
const stopYoutubeCron = () => {
  if (cronJob) {
    cronJob.stop();
    logger.info('[YouTube Cron] Scheduler stopped.');
  }
};

module.exports = { startYoutubeCron, stopYoutubeCron };
