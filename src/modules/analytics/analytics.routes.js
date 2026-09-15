const express = require('express');
const analyticsController = require('./analytics.controller');
const authenticate = require('../../middlewares/authenticate');
const authorize = require('../../middlewares/authorize');
const jwt = require('jsonwebtoken');
const environment = require('../../config/environment');
const {
  trackEventValidator,
  queryDateRangeValidator
} = require('./analytics.validator');

const router = express.Router();

// Light-weight optional authentication for client event logging
const optionalAuthenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, environment.jwt.secret);
      req.user = { id: decoded.userId };
    } catch (err) {
      // Fail silently to register as guest event
    }
  }
  next();
};

// 1. PUBLIC/USER: Log custom client interaction events (clicks, page views)
router.post('/event', optionalAuthenticate, trackEventValidator, analyticsController.trackEvent);

// ─── ADMIN ANALYTICS METRICS (Admins only) ────────────────────────────────────
router.use(authenticate);
router.use(authorize(['Admin', 'admin']));

router.get('/dashboard', analyticsController.getDashboardAnalytics);
router.get('/revenue', queryDateRangeValidator, analyticsController.getRevenueAnalytics);
router.get('/users', analyticsController.getUserAnalytics);
router.get('/content', analyticsController.getContentAnalytics);

module.exports = router;
