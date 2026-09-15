const express = require('express');
const i18nController = require('./i18n.controller');
const authenticate = require('../../middlewares/authenticate');
const authorize = require('../../middlewares/authorize');

const router = express.Router();

// Secure all i18n endpoints behind standard authentication and authorization inline
router.get('/user/language', authenticate, authorize(['Member', 'member', 'Admin', 'admin', 'Advisor', 'advisor', 'Affiliate', 'affiliate']), i18nController.getLanguagePreference);
router.post('/user/language', authenticate, authorize(['Member', 'member', 'Admin', 'admin', 'Advisor', 'advisor', 'Affiliate', 'affiliate']), i18nController.setLanguagePreference);
router.post('/i18n/tts', i18nController.generateTts);
router.post('/i18n/translate', i18nController.translateTexts);

module.exports = router;
