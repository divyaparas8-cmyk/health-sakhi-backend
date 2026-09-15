const service = require('./contentAsset.service');
const progressService = require('./contentProgress.service');
const imagekit = require('../../config/imagekit');
const multer = require('multer');

// Multer storage engine configuration (using memoryStorage to avoid saving on server disk)
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit
});

// ── Asset CRUD Handlers ───────────────────────────────────────────────────────

const createAsset = async (req, res, next) => {
  try {
    const { title, type, category, language, languageCode, groupKey, status, mediaUrl, description, showOnLanding } = req.body;
    const asset = await service.createAsset({ title, type, category, language, languageCode, groupKey, status, mediaUrl, description, showOnLanding });
    res.status(201).json({ success: true, data: asset });
  } catch (err) {
    next(err);
  }
};

const listAdminAssets = async (req, res, next) => {
  try {
    const { category, type, language, languageCode, groupKey, search } = req.query;
    const assets = await service.getAssets({ category, type, language, languageCode, groupKey, search });
    res.status(200).json({ success: true, data: assets });
  } catch (err) {
    next(err);
  }
};

const listPublicAssets = async (req, res, next) => {
  try {
    const { category, type, language, languageCode, groupKey, search } = req.query;
    const assets = await service.getAssets({ status: 'Published', category, type, language, languageCode, groupKey, search });
    res.status(200).json({ success: true, data: assets });
  } catch (err) {
    next(err);
  }
};

const getAssetById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const asset = await service.getAssetById(id);
    if (!asset) return res.status(404).json({ success: false, error: 'Content asset not found.' });
    res.status(200).json({ success: true, data: asset });
  } catch (err) {
    next(err);
  }
};

const updateAsset = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, type, category, language, languageCode, groupKey, status, mediaUrl, description, showOnLanding } = req.body;
    const updated = await service.updateAsset(id, { title, type, category, language, languageCode, groupKey, status, mediaUrl, description, showOnLanding });
    res.status(200).json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

const deleteAsset = async (req, res, next) => {
  try {
    const { id } = req.params;
    await service.deleteAsset(id);
    res.status(200).json({ success: true, message: 'Asset deleted successfully.' });
  } catch (err) {
    next(err);
  }
};

const uploadMedia = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    
    // Try uploading to ImageKit CDN
    let uploadRes;
    try {
      uploadRes = await imagekit.upload({
        file: req.file.buffer,
        fileName: `${Date.now()}-${req.file.originalname}`,
        folder: '/healthsakhi_content'
      });
    } catch (ikError) {
      console.warn("ImageKit upload failed, falling back to local upload:", ikError.message);
      // Fallback to local upload simulation
      const fileName = `${Date.now()}-${req.file.originalname}`;
      uploadRes = {
        url: `http://localhost:5000/uploads/${fileName}`,
        name: fileName
      };
    }

    // Fallback: If in mock mode or fallback happened, write buffer to local uploads folder
    if (uploadRes.url.includes('localhost:5000/uploads')) {
      const fs = require('fs');
      const path = require('path');
      const uploadsDir = path.join(__dirname, '../../../uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      fs.writeFileSync(path.join(uploadsDir, uploadRes.name), req.file.buffer);
    }

    res.status(200).json({ success: true, url: uploadRes.url, filePath: uploadRes.url.replace('http://localhost:5000', '') });
  } catch (err) {
    next(err);
  }
};

// ── Progress Handlers ─────────────────────────────────────────────────────────

/**
 * POST /content-assets/:id/progress
 * Body: { position: number, completed: boolean, contentType: 'Video'|'Book' }
 */
const saveProgress = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Authentication required.' });
    const { id: contentId } = req.params;
    const { position = 0, completed = false, contentType = 'Video' } = req.body;
    const record = await progressService.upsertProgress(userId, contentId, contentType, position, completed);
    res.status(200).json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /content-assets/:id/progress
 */
const loadProgress = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Authentication required.' });
    const { id: contentId } = req.params;
    const record = await progressService.getProgress(userId, contentId);
    res.status(200).json({ success: true, data: record || { position: 0, completed: false } });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /content-progress/all
 */
const getUserAllProgress = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Authentication required.' });
    const records = await progressService.getUserAllProgress(userId);
    res.status(200).json({ success: true, data: records });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /content-assets/:id/feedback
 * Body: { rating: number, comment: string }
 */
const submitFeedback = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Authentication required.' });
    const { id: contentId } = req.params;
    const { rating, comment } = req.body;
    const feedback = await service.upsertFeedback(userId, contentId, rating, comment);
    res.status(200).json({ success: true, data: feedback });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /content-assets/:id/feedbacks
 */
const getBookFeedbacks = async (req, res, next) => {
  try {
    const { id: contentId } = req.params;
    const feedbacks = await service.getBookFeedbacks(contentId);
    
    const formatted = feedbacks.map(fb => ({
      memberName: fb.user?.profile?.fullName || 'HealthSakhi Member',
      rating: fb.rating,
      comment: fb.comment,
      submittedAt: fb.createdAt
    }));
    
    res.status(200).json({ success: true, data: formatted });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createAsset,
  listAdminAssets,
  listPublicAssets,
  getAssetById,
  updateAsset,
  deleteAsset,
  uploadMedia,
  saveProgress,
  loadProgress,
  getUserAllProgress,
  submitFeedback,
  getBookFeedbacks,
  uploadMiddleware: upload.single('mediaFile')
};
