const periodService = require('./period.service');

const setupProfile = async (req, res, next) => {
  try {
    await periodService.setupProfile(req.user.id, req.body);
    const payload = await periodService.getOptimizedPayload(req.user.id, new Date());
    res.status(201).json({
      success: true,
      message: 'Period profile setup successfully.',
      ...payload
    });
  } catch (error) {
    next(error);
  }
};

const getProfile = async (req, res, next) => {
  try {
    const profile = await periodService.getProfile(req.user.id);
    res.status(200).json({
      success: true,
      profile
    });
  } catch (error) {
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const month = parseInt(req.query.month || req.body.month, 10);
    const year = parseInt(req.query.year || req.body.year, 10);
    const payload = await periodService.updateProfile(req.user.id, req.body, month, year);
    res.status(200).json({
      success: true,
      message: 'Period profile updated successfully.',
      ...payload
    });
  } catch (error) {
    next(error);
  }
};

const logPeriod = async (req, res, next) => {
  try {
    const log = await periodService.logPeriod(req.user.id, req.body);
    res.status(201).json({
      success: true,
      message: 'Period log added successfully.',
      log
    });
  } catch (error) {
    next(error);
  }
};

const getLogs = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 100;
    const offset = parseInt(req.query.offset, 10) || 0;
    const logs = await periodService.getLogs(req.user.id, limit, offset);
    res.status(200).json({
      success: true,
      logs
    });
  } catch (error) {
    next(error);
  }
};

const getDashboard = async (req, res, next) => {
  try {
    const targetDate = req.query.date ? new Date(req.query.date) : new Date();
    const dashboardData = await periodService.getDashboard(req.user.id, targetDate);
    res.status(200).json({
      success: true,
      ...dashboardData
    });
  } catch (error) {
    next(error);
  }
};

const getCalendar = async (req, res, next) => {
  try {
    const month = parseInt(req.query.month, 10);
    const year = parseInt(req.query.year, 10);
    const calendarData = await periodService.getCalendar(req.user.id, month, year);
    res.status(200).json({
      success: true,
      ...calendarData
    });
  } catch (error) {
    next(error);
  }
};

const startPeriod = async (req, res, next) => {
  try {
    const month = parseInt(req.query.month || req.body.month, 10);
    const year = parseInt(req.query.year || req.body.year, 10);
    const payload = await periodService.startPeriod(req.user.id, req.body, month, year);
    res.status(200).json({
      success: true,
      message: 'New period cycle started successfully.',
      ...payload
    });
  } catch (error) {
    next(error);
  }
};

const resetMonth = async (req, res, next) => {
  try {
    const month = parseInt(req.body.month || req.query.month, 10);
    const year = parseInt(req.body.year || req.query.year, 10);
    const payload = await periodService.resetMonth(req.user.id, month, year);
    res.status(200).json({
      success: true,
      message: 'Month logs reset successfully.',
      ...payload
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  setupProfile,
  getProfile,
  updateProfile,
  logPeriod,
  getLogs,
  getDashboard,
  getCalendar,
  startPeriod,
  resetMonth
};
