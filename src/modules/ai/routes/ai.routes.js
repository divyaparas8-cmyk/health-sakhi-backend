const express = require('express');
const aiController = require('../controllers/ai.controller');
const authenticate = require('../../../middlewares/authenticate');
const authorize = require('../../../middlewares/authorize');
const {
  validateChat,
  validateAction,
  validateHistory,
  validateMemories
} = require('../validators/ai.validator');

const router = express.Router();

// Secure all AI Orchestrator endpoints behind auth and member check
router.use(authenticate);
router.use(authorize(['Member', 'member']));

// Define routes
router.post('/chat', validateChat, aiController.chat);
router.post('/action', validateAction, aiController.action);
router.get('/history', validateHistory, aiController.getHistory);
router.delete('/history/:sessionId', aiController.deleteSession);
router.get('/memories', validateMemories, aiController.getMemories);
router.post('/affirmation', aiController.generateAffirmation);
router.post('/spiritual-quote', aiController.generateSpiritualQuote);

module.exports = router;
