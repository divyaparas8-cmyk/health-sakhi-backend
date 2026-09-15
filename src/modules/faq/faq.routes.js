const express = require('express');
const router = express.Router();
const controller = require('./faq.controller');
const authenticate = require('../../middlewares/authenticate');
const authorize = require('../../middlewares/authorize');

// Public endpoints
router.get('/faqs', controller.listPublicFaqs);
router.get('/faqs/:id', controller.getFaqById);
router.post('/faqs/:id/feedback', controller.submitFeedback);

// Admin endpoints (Role Protected)
router.get('/admin/faqs', authenticate, authorize(['Admin', 'admin']), controller.listAdminFaqs);
router.post('/admin/faqs', authenticate, authorize(['Admin', 'admin']), controller.createFaq);
router.put('/admin/faqs/:id', authenticate, authorize(['Admin', 'admin']), controller.updateFaq);
router.delete('/admin/faqs/:id', authenticate, authorize(['Admin', 'admin']), controller.deleteFaq);

module.exports = router;
