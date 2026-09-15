const express = require('express');
const aiSakhiController = require('./ai-sakhi.controller');
const authenticate = require('../../middlewares/authenticate');
const authorize = require('../../middlewares/authorize');
const { createSessionValidator, sendMessageValidator } = require('./ai-sakhi.validator');
const { checkChatLimit } = require('./ai-sakhi.middleware');

const router = express.Router();

// Enforce auth and member role check on all AI Sakhi routes
router.use(authenticate);
router.use(authorize(['Member', 'member']));

// Session creation and list history
router.post('/sessions', createSessionValidator, aiSakhiController.createSession);
router.get('/sessions', aiSakhiController.getSessions);

// Get chat messages in a session
router.get('/sessions/:session_id/messages', aiSakhiController.getMessages);

// Send message to chat (gated by checkChatLimit middleware for Free members)
router.post('/chat', checkChatLimit, sendMessageValidator, aiSakhiController.chat);

module.exports = router;
