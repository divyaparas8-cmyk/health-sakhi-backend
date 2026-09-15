const analyticsService = require('./analytics.service');

const getDashboardAnalytics = async (req, res, next) => {
  try {
    const result = await analyticsService.getDashboardAnalytics();
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const getRevenueAnalytics = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const result = await analyticsService.getRevenueAnalytics(startDate, endDate);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const getUserAnalytics = async (req, res, next) => {
  try {
    const result = await analyticsService.getUserAnalytics();
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const getContentAnalytics = async (req, res, next) => {
  try {
    const result = await analyticsService.getContentAnalytics();
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const trackEvent = async (req, res, next) => {
  try {
    const userId = req.user ? req.user.id : null;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const { event_name, event_data } = req.body;
    
    const result = await analyticsService.trackEvent(userId, event_name, event_data, ipAddress);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardAnalytics,
  getRevenueAnalytics,
  getUserAnalytics,
  getContentAnalytics,
  trackEvent
};
