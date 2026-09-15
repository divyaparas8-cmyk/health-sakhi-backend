const membersService = require('./members.service');

const getProfile = async (req, res, next) => {
  try {
    const result = await membersService.getProfile(req.user.id);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const result = await membersService.updateProfile(req.user.id, req.body);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const getDashboard = async (req, res, next) => {
  try {
    const result = await membersService.getDashboard(req.user.id);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const logMood = async (req, res, next) => {
  try {
    const result = await membersService.logMood(req.user.id, req.body);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const dailyCheckIn = async (req, res, next) => {
  try {
    const result = await membersService.dailyCheckIn(req.user.id, req.body);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const getMoodLogs = async (req, res, next) => {
  try {
    const result = await membersService.getMoodLogs(req.user.id);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const createTodo = async (req, res, next) => {
  try {
    const result = await membersService.createTodo(req.user.id, req.body);
    return res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

const updateTodo = async (req, res, next) => {
  try {
    const { is_completed } = req.body;
    const result = await membersService.updateTodo(req.user.id, req.params.id, is_completed);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const getTodos = async (req, res, next) => {
  try {
    const result = await membersService.getTodos(req.user.id, req.query);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const createTransaction = async (req, res, next) => {
  try {
    const result = await membersService.createTransaction(req.user.id, req.body);
    return res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

const getTransactions = async (req, res, next) => {
  try {
    const result = await membersService.getTransactions(req.user.id);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const exportFinance = async (req, res, next) => {
  try {
    const result = await membersService.exportFinanceReport(req.user.id);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const getAffirmations = async (req, res, next) => {
  try {
    const { category, mood } = req.query;
    const result = await membersService.getAffirmations(category, mood);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const updateTransaction = async (req, res, next) => {
  try {
    const result = await membersService.updateTransaction(req.user.id, req.params.id, req.body);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const deleteTransaction = async (req, res, next) => {
  try {
    const result = await membersService.deleteTransaction(req.user.id, req.params.id);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProfile,
  updateProfile,
  getDashboard,
  logMood,
  dailyCheckIn,
  getMoodLogs,
  createTodo,
  updateTodo,
  getTodos,
  createTransaction,
  getTransactions,
  updateTransaction,
  deleteTransaction,
  exportFinance,
  getAffirmations
};
