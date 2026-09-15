const express = require('express');
const controller = require('./chatbot.controller');
const authenticate = require('../../middlewares/authenticate');

const router = express.Router();

// Chat message endpoint
router.post('/chat/message', controller.handleChatMessage);

// New Chat ask matching API for admin/user training matching logic
router.post('/chat/ask', controller.handleChatAsk);

// Signup requests via chatbot
router.post('/user/signup', controller.handleUserSignup);

// Login requests via chatbot
router.post('/user/login', controller.handleUserLogin);

// Accessible features retrieval (needs login check)
router.get('/user/features', authenticate, controller.handleGetFeatures);

module.exports = router;
