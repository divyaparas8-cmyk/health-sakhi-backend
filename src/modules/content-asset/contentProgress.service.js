const prisma = require('../../config/database');

/**
 * Upsert user content progress (create or update)
 */
const upsertProgress = async (userId, contentId, contentType, position, completed = false) => {
  if (!userId || !contentId) throw new Error('userId and contentId are required');

  return prisma.userContentProgress.upsert({
    where: {
      userId_contentId: { userId, contentId }
    },
    update: {
      position: parseFloat(position) || 0,
      completed: Boolean(completed)
    },
    create: {
      userId,
      contentId,
      contentType,
      position: parseFloat(position) || 0,
      completed: Boolean(completed)
    }
  });
};

/**
 * Get progress for a specific user + content pair
 */
const getProgress = async (userId, contentId) => {
  if (!userId || !contentId) throw new Error('userId and contentId are required');

  return prisma.userContentProgress.findUnique({
    where: {
      userId_contentId: { userId, contentId }
    }
  });
};

/**
 * Get all progress records for a user
 */
const getUserAllProgress = async (userId) => {
  if (!userId) throw new Error('userId is required');

  return prisma.userContentProgress.findMany({
    where: { userId },
    include: { content: { select: { title: true, type: true, category: true } } },
    orderBy: { updatedAt: 'desc' }
  });
};

module.exports = {
  upsertProgress,
  getProgress,
  getUserAllProgress
};
