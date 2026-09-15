const prisma = require('../../config/database');

/**
 * Creates a new content asset
 */
const createAsset = async (data) => {
  if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
    throw new Error('Title is required and must be a string');
  }
  if (!data.type || !['Video', 'Book', 'Interactive'].includes(data.type)) {
    throw new Error('Type must be either "Video", "Book", or "Interactive"');
  }
  if (!data.category || typeof data.category !== 'string') {
    throw new Error('Category is required');
  }
  if (!data.status || !['Published', 'Draft', 'Archived'].includes(data.status)) {
    throw new Error('Invalid status specified');
  }

  const asset = await prisma.contentAsset.create({
    data: {
      title: data.title.trim(),
      type: data.type,
      category: data.category.trim(),
      language: data.language ? data.language.trim() : 'English',
      languageCode: data.languageCode ? data.languageCode.trim() : 'en',
      groupKey: data.groupKey ? data.groupKey.trim() : null,
      showOnLanding: data.showOnLanding !== undefined ? !!data.showOnLanding : false,
      status: data.status,
      mediaUrl: data.mediaUrl ? data.mediaUrl.trim() : null,
      description: data.description ? data.description.trim() : null
    }
  });

  if (asset.status === 'Published') {
    try {
      const { notifyAllMembers } = require('../notifications/notifications.service');
      const prefix = asset.type === 'Video' ? 'New Video Uploaded 🎥' : 'New Book/Content Uploaded 📚';
      await notifyAllMembers(
        prefix,
        asset.title,
        asset.type === 'Video' ? 'community' : 'book'
      );
    } catch (err) {
      console.error(`[Content Asset Notification Error]`, err);
    }
  }

  return asset;
};

/**
 * Retrieves content assets with optional filtering
 */
const getAssets = async (filters = {}) => {
  const where = {};

  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.category) {
    where.category = filters.category;
  }
  if (filters.type) {
    where.type = filters.type;
  }
  if (filters.language) {
    where.language = filters.language;
  }
  if (filters.languageCode) {
    where.languageCode = filters.languageCode;
  }
  if (filters.groupKey) {
    where.groupKey = filters.groupKey;
  }
  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search } },
      { description: { contains: filters.search } }
    ];
  }

  return prisma.contentAsset.findMany({
    where,
    orderBy: { createdAt: 'desc' }
  });
};

/**
 * Finds a single content asset by ID
 */
const getAssetById = async (id) => {
  if (!id) throw new Error('ID parameter is required');
  return prisma.contentAsset.findUnique({
    where: { id }
  });
};

/**
 * Updates an existing content asset record
 */
const updateAsset = async (id, data) => {
  if (!id) throw new Error('ID parameter is required');

  const updateData = {};
  if (data.title !== undefined) {
    if (typeof data.title !== 'string' || data.title.trim().length === 0) {
      throw new Error('Title cannot be empty');
    }
    updateData.title = data.title.trim();
  }
  if (data.type !== undefined) {
    if (!['Video', 'Book', 'Interactive'].includes(data.type)) {
      throw new Error('Type must be either "Video", "Book", or "Interactive"');
    }
    updateData.type = data.type;
  }
  if (data.category !== undefined) {
    updateData.category = data.category.trim();
  }
  if (data.language !== undefined) {
    updateData.language = data.language.trim();
  }
  if (data.languageCode !== undefined) {
    updateData.languageCode = data.languageCode.trim();
  }
  if (data.groupKey !== undefined) {
    updateData.groupKey = data.groupKey ? data.groupKey.trim() : null;
  }
  if (data.status !== undefined) {
    if (!['Published', 'Draft', 'Archived'].includes(data.status)) {
      throw new Error('Invalid status specified');
    }
    updateData.status = data.status;
  }
  if (data.mediaUrl !== undefined) {
    updateData.mediaUrl = data.mediaUrl ? data.mediaUrl.trim() : null;
  }
  if (data.description !== undefined) {
    updateData.description = data.description ? data.description.trim() : null;
  }
  if (data.showOnLanding !== undefined) {
    updateData.showOnLanding = !!data.showOnLanding;
  }

  return prisma.contentAsset.update({
    where: { id },
    data: updateData
  });
};

/**
 * Deletes a content asset by ID
 */
const deleteAsset = async (id) => {
  if (!id) throw new Error('ID parameter is required');
  return prisma.contentAsset.delete({
    where: { id }
  });
};

/**
 * Upserts member rating/feedback for a book
 */
const upsertFeedback = async (userId, contentId, rating, comment) => {
  if (!userId || !contentId) {
    throw new Error('User ID and Content ID are required');
  }
  if (!rating || rating < 1 || rating > 5) {
    throw new Error('Rating must be between 1 and 5');
  }

  return prisma.bookFeedback.upsert({
    where: {
      userId_contentId: {
        userId,
        contentId
      }
    },
    update: {
      rating,
      comment: comment ? comment.trim() : null
    },
    create: {
      userId,
      contentId,
      rating,
      comment: comment ? comment.trim() : null
    }
  });
};

/**
 * Retrieves all feedbacks/ratings for a specific book with member profile names
 */
const getBookFeedbacks = async (contentId) => {
  if (!contentId) throw new Error('Content ID is required');

  return prisma.bookFeedback.findMany({
    where: { contentId },
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: {
          profile: {
            select: {
              fullName: true
            }
          }
        }
      }
    }
  });
};

module.exports = {
  createAsset,
  getAssets,
  getAssetById,
  updateAsset,
  deleteAsset,
  upsertFeedback,
  getBookFeedbacks
};
