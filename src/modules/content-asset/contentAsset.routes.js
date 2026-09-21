const express = require('express');
const controller = require('./contentAsset.controller');
const authenticate = require('../../middlewares/authenticate');
const authorize = require('../../middlewares/authorize');

const router = express.Router();

// ── Public / Member Endpoints ─────────────────────────────────────────────────
// List published assets (filter by type, category)
router.get('/content-assets', controller.listPublicAssets);

// AI-Assisted Find a Book Search endpoint
router.get('/content-assets/find-a-book', controller.findABook);
router.post('/content-assets/find-a-book', controller.findABook);

// Semantic Book Topic Search endpoint (uses Gemini key from .env)
router.post('/content-assets/search-book-topics', controller.searchBookTopics);

// Get single published asset by ID
router.get('/content-assets/:id', controller.getAssetById);

// Save member progress for a content asset
router.post('/content-assets/:id/progress', authenticate, controller.saveProgress);

// Load member progress for a content asset
router.get('/content-assets/:id/progress', authenticate, controller.loadProgress);

// Save member feedback/rating for a content asset
router.post('/content-assets/:id/feedback', authenticate, controller.submitFeedback);

// Load feedbacks/ratings for a specific content asset
router.get('/content-assets/:id/feedbacks', authenticate, controller.getBookFeedbacks);

// Load all member progress records
router.get('/content-progress/all', authenticate, controller.getUserAllProgress);

// ── Admin-Restricted Endpoints ────────────────────────────────────────────────
router.get('/admin/content-assets', authenticate, authorize(['Admin', 'admin']), controller.listAdminAssets);
router.post('/admin/content-assets', authenticate, authorize(['Admin', 'admin']), controller.createAsset);
router.put('/admin/content-assets/:id', authenticate, authorize(['Admin', 'admin']), controller.updateAsset);
router.delete('/admin/content-assets/:id', authenticate, authorize(['Admin', 'admin']), controller.deleteAsset);
router.post('/admin/content-assets/upload', authenticate, controller.uploadMiddleware, controller.uploadMedia);

module.exports = router;
