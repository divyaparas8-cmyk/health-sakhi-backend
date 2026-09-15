const express = require('express');
const membersController = require('./members.controller');
const authenticate = require('../../middlewares/authenticate');
const authorize = require('../../middlewares/authorize');
const {
  updateProfileValidator,
  logMoodValidator,
  createTodoValidator,
  updateTodoValidator,
  createTransactionValidator,
  updateTransactionValidator,
  deleteTransactionValidator,
  uuidParamValidator,
  dailyCheckInValidator
} = require('./members.validator');

const router = express.Router();

// Enforce auth on all endpoints
router.use(authenticate);

// Profile endpoints (accessible to all authenticated roles)
router.get('/profile', membersController.getProfile);
router.put('/profile', updateProfileValidator, membersController.updateProfile);

// Enforce member role restrictions on all subsequent endpoints
router.use(authorize(['Member', 'member']));

// Dashboard
router.get('/dashboard', membersController.getDashboard);

// Mood tracking
router.post('/mood', logMoodValidator, membersController.logMood);
router.get('/mood', membersController.getMoodLogs);

// Daily AI check-in
router.post('/daily-checkin', dailyCheckInValidator, membersController.dailyCheckIn);

// Todo planner
router.post('/todo', createTodoValidator, membersController.createTodo);
router.put('/todo/:id', updateTodoValidator, membersController.updateTodo);
router.get('/todo', membersController.getTodos);

// Finance manager
router.post('/finance', createTransactionValidator, membersController.createTransaction);
router.put('/finance/:id', updateTransactionValidator, membersController.updateTransaction);
router.delete('/finance/:id', deleteTransactionValidator, membersController.deleteTransaction);
router.get('/finance', membersController.getTransactions);
router.get('/finance/export', membersController.exportFinance);

// Affirmations suggest
router.get('/affirmations', membersController.getAffirmations);

module.exports = router;
