const express = require('express');
const authenticate = require('../../middlewares/authenticate');
const authorize = require('../../middlewares/authorize');
const controller = require('./controller');

const router = express.Router();

// Public endpoint for marketing page content
router.get('/public/landing-page', controller.getPublicLandingPage);
router.get('/public/feedbacks', controller.getApprovedFeedbacks);

// Public contact submission
router.post('/public/contact', controller.submitContactMessage);

// Admin-restricted endpoints
router.get('/admin/landing-page', authenticate, authorize(['Admin', 'admin']), controller.getAdminLandingPage);
router.post('/admin/landing-page/section', authenticate, authorize(['Admin', 'admin']), controller.createAdminSection);
router.put('/admin/landing-page/section/:key', authenticate, authorize(['Admin', 'admin']), controller.updateAdminSection);
router.post('/admin/landing-page/reset/:key', authenticate, authorize(['Admin', 'admin']), controller.resetAdminSection);
router.post('/admin/landing-page/upload', authenticate, authorize(['Admin', 'admin']), controller.uploadMiddleware, controller.uploadImage);

// Admin contact messages management
router.get('/admin/contact-messages', authenticate, authorize(['Admin', 'admin']), controller.getContactMessages);
router.put('/admin/contact-messages/:id/approve', authenticate, authorize(['Admin', 'admin']), controller.approveContactMessage);
router.put('/admin/contact-messages/:id/read', authenticate, authorize(['Admin', 'admin']), controller.markContactMessageAsRead);
router.delete('/admin/contact-messages/:id', authenticate, authorize(['Admin', 'admin']), controller.deleteContactMessage);

module.exports = router;
