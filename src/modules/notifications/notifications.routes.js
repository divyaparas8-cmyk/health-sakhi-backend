const express = require('express');
const notificationsController = require('./notifications.controller');
const authenticate = require('../../middlewares/authenticate');
const authorize = require('../../middlewares/authorize');
const {
  sendDirectEmailValidator,
  createCampaignValidator,
  sendDirectNotificationValidator,
  uuidParamValidator
} = require('./notifications.validator');

const router = express.Router();

// Enforce authentication on all endpoints
router.use(authenticate);

// ─── USER ALERTS (Any authenticated user) ────────────────────────────────────
router.get('/', notificationsController.getNotifications);
router.post('/reply', notificationsController.sendMemberReply);
router.delete('/:id', uuidParamValidator('id'), notificationsController.deleteNotification);
router.patch('/:id/read', uuidParamValidator('id'), notificationsController.markAsRead);
router.patch('/read-all', notificationsController.markAllAsRead);

// ─── ADMIN CAMPAIGNS & DISPATCH (Admins only) ──────────────────────────────────
router.use(authorize(['Admin', 'admin']));

router.get('/unread-replies', notificationsController.getUnreadReplies);
router.get('/:id/sender', uuidParamValidator('id'), notificationsController.getNotificationSender);
router.get('/user/:userId/chat', uuidParamValidator('userId'), notificationsController.getUserChatThread);
router.get('/user/:userId', uuidParamValidator('userId'), notificationsController.getUserNotifications);
router.post('/email', sendDirectEmailValidator, notificationsController.sendDirectEmail);
router.post('/direct', sendDirectNotificationValidator, notificationsController.sendDirectNotification);
router.post('/campaigns', createCampaignValidator, notificationsController.createCampaign);
router.get('/campaigns', notificationsController.getCampaigns);
router.post('/campaigns/:id/trigger', uuidParamValidator('id'), notificationsController.triggerCampaign);

module.exports = router;
