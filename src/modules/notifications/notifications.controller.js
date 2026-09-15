const notificationsService = require('./notifications.service');

const getNotifications = async (req, res, next) => {
  try {
    const result = await notificationsService.getNotifications(req.user.id);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await notificationsService.markAsRead(req.user.id, id);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const markAllAsRead = async (req, res, next) => {
  try {
    const result = await notificationsService.markAllAsRead(req.user.id);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const sendDirectEmail = async (req, res, next) => {
  try {
    const { to, subject, content } = req.body;
    const result = await notificationsService.sendEmailNotification(to, subject, content);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const createCampaign = async (req, res, next) => {
  try {
    const result = await notificationsService.createCampaign(req.body);
    return res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

const getCampaigns = async (req, res, next) => {
  try {
    const result = await notificationsService.getCampaigns();
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const triggerCampaign = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await notificationsService.triggerCampaign(id);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const sendDirectNotification = async (req, res, next) => {
  try {
    const { userId, title, message } = req.body;
    const result = await notificationsService.sendPushNotification(userId, title, message, 'system');
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const getUserNotifications = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const result = await notificationsService.getNotifications(userId);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const sendMemberReply = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { message, title } = req.body;
    const result = await notificationsService.sendMemberReply(userId, message, title);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const getUnreadReplies = async (req, res, next) => {
  try {
    const result = await notificationsService.getUnreadReplies();
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const getUserChatThread = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const result = await notificationsService.getUserChatThread(userId);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const deleteNotification = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role?.name?.toLowerCase() || '';
    const isAdmin = userRole === 'admin';
    const result = await notificationsService.deleteNotification(id, userId, isAdmin);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const getNotificationSender = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await notificationsService.getNotificationSender(id);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNotifications,
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  sendDirectEmail,
  sendDirectNotification,
  createCampaign,
  getCampaigns,
  triggerCampaign,
  sendMemberReply,
  getUnreadReplies,
  getUserChatThread,
  deleteNotification,
  getNotificationSender
};
