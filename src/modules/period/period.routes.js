const express = require('express');
const periodController = require('./period.controller');
const authenticate = require('../../middlewares/authenticate');
const authorize = require('../../middlewares/authorize');
const {
  setupProfileValidator,
  updateProfileValidator,
  logPeriodValidator,
  getCalendarValidator,
  startPeriodValidator
} = require('./period.validator');

const router = express.Router();

// Enforce auth & member role restrictions on all endpoints
router.use(authenticate);
router.use(authorize(['Member', 'member']));

/**
 * @swagger
 * /api/v1/period/dashboard:
 *   get:
 *     summary: Get period dashboard calculations
 *     description: Returns the calculated cycle day, next period, and fertility status based on profile.
 *     tags: [Period]
 *     responses:
 *       200:
 *         description: Dashboard data retrieved successfully
 *       404:
 *         description: Profile not found
 */
router.get('/dashboard', periodController.getDashboard);

/**
 * @swagger
 * /api/v1/period/calendar:
 *   get:
 *     summary: Get period calendar for a specific month
 *     description: Returns the calculated period days, fertility days, and ovulation day for the given month and year.
 *     tags: [Period]
 *     parameters:
 *       - in: query
 *         name: month
 *         required: true
 *         schema:
 *           type: integer
 *         description: Month number (1-12)
 *       - in: query
 *         name: year
 *         required: true
 *         schema:
 *           type: integer
 *         description: Year (e.g. 2026)
 *     responses:
 *       200:
 *         description: Calendar data retrieved successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Profile not found
 */
router.get('/calendar', getCalendarValidator, periodController.getCalendar);

/**
 * @swagger
 * /api/v1/period/setup:
 *   post:
 *     summary: Setup period profile
 *     description: Creates a new period tracking profile for the authenticated user.
 *     tags: [Period]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - lastPeriodDate
 *             properties:
 *               cycleLength:
 *                 type: integer
 *                 example: 28
 *               periodLength:
 *                 type: integer
 *                 example: 5
 *               lastPeriodDate:
 *                 type: string
 *                 format: date-time
 *                 example: "2023-10-01T00:00:00.000Z"
 *     responses:
 *       201:
 *         description: Profile setup successfully
 *       400:
 *         description: Validation error or profile already exists
 */
router.post('/setup', setupProfileValidator, periodController.setupProfile);

/**
 * @swagger
 * /api/v1/period/profile:
 *   get:
 *     summary: Get period profile
 *     description: Retrieves the period tracking profile of the authenticated user.
 *     tags: [Period]
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *       404:
 *         description: Profile not found
 */
router.get('/profile', periodController.getProfile);

/**
 * @swagger
 * /api/v1/period/profile:
 *   put:
 *     summary: Update period profile
 *     description: Updates the period tracking profile of the authenticated user.
 *     tags: [Period]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               cycleLength:
 *                 type: integer
 *                 example: 29
 *               periodLength:
 *                 type: integer
 *                 example: 6
 *               lastPeriodDate:
 *                 type: string
 *                 format: date-time
 *                 example: "2023-10-28T00:00:00.000Z"
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Profile not found
 */
router.put('/profile', updateProfileValidator, periodController.updateProfile);

/**
 * @swagger
 * /api/v1/period/log:
 *   post:
 *     summary: Log period data
 *     description: Adds a new daily log for the user's period tracking.
 *     tags: [Period]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - logDate
 *             properties:
 *               logDate:
 *                 type: string
 *                 format: date-time
 *                 example: "2023-10-29T00:00:00.000Z"
 *               mood:
 *                 type: string
 *                 example: "Happy"
 *               pain:
 *                 type: string
 *                 example: "Mild"
 *               flow:
 *                 type: string
 *                 example: "Medium"
 *               energy:
 *                 type: string
 *                 example: "High"
 *               notes:
 *                 type: string
 *                 example: "Felt good today."
 *     responses:
 *       201:
 *         description: Log added successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Profile not found
 */
router.post('/log', logPeriodValidator, periodController.logPeriod);

/**
 * @swagger
 * /api/v1/period/logs:
 *   get:
 *     summary: Get period logs
 *     description: Retrieves the daily period logs of the authenticated user.
 *     tags: [Period]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of logs to retrieve
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *         description: Number of logs to skip
 *     responses:
 *       200:
 *         description: Logs retrieved successfully
 */
router.get('/logs', periodController.getLogs);

/**
 * @swagger
 * /api/v1/period/start:
 *   post:
 *     summary: Log the start of a new period
 *     description: Creates a new cycle entry, updates the last period date, and automatically recalculates predictions.
 *     tags: [Period]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - startDate
 *             properties:
 *               startDate:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-06-20T00:00:00.000Z"
 *     responses:
 *       200:
 *         description: New period cycle started successfully
 *       400:
 *         description: Validation error or invalid date
 *       404:
 *         description: Profile not found
 */
router.post('/start', startPeriodValidator, periodController.startPeriod);
router.post('/reset-month', periodController.resetMonth);

module.exports = router;
