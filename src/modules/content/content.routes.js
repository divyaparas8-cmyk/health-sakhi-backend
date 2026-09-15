const express = require('express');
const contentController = require('./content.controller');
const authenticate = require('../../middlewares/authenticate');
const authorize = require('../../middlewares/authorize');
const {
  getBookValidator,
  getChapterValidator,
  saveBookProgressValidator,
  saveVideoProgressValidator
} = require('./content.validator');

const router = express.Router();

// Enforce auth & member/admin role restrictions on all content endpoints
router.use(authenticate);
router.use(authorize(['Member', 'member', 'Admin', 'admin']));

// Books library endpoints
router.get('/books', contentController.listBooks);
router.get('/books/:id', getBookValidator, contentController.getBook);
router.get('/books/:bookId/chapters/:chapterId', getChapterValidator, contentController.getChapter);
router.post('/books/:bookId/progress', saveBookProgressValidator, contentController.saveBookProgress);

// Videos endpoints
router.get('/videos', contentController.listVideos);
router.post('/videos/:videoId/progress', saveVideoProgressValidator, contentController.saveVideoProgress);

// Meditation Sessions endpoints
router.get('/meditations/youtube', contentController.listYoutubeVideos);
router.get('/meditations', contentController.listMeditations);

// Affirmations endpoints
router.get('/affirmations', contentController.listAffirmations);

// Sakhi Content CMS endpoints
router.get('/sakhi-content', contentController.listSakhiContent);

module.exports = router;
