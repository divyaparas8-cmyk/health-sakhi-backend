const express = require('express');
const advisorsController = require('./advisors.controller');
const authenticate = require('../../middlewares/authenticate');
const authorize = require('../../middlewares/authorize');
const {
  createAvailabilityValidator,
  bookAppointmentValidator,
  submitNotesValidator,
  rescheduleAppointmentValidator,
  cancelAppointmentValidator,
  uuidParamValidator
} = require('./advisors.validator');

const router = express.Router();

// 1. Advisor Profile Search
router.get('/advisors', authenticate, authorize(['Member', 'member']), advisorsController.searchAdvisors);

// 12. View advisor own availability slots (Advisors only)
router.get(
  '/advisors/me/availability',
  authenticate,
  authorize(['Advisor', 'advisor']),
  advisorsController.getMeAvailability
);

// 2. Advisor Schedule slots view (Public access for members/admins/advisors)
router.get(
  '/advisors/:id/availability',
  authenticate,
  authorize(['Member', 'member', 'Admin', 'admin', 'Advisor', 'advisor']),
  uuidParamValidator('id'),
  advisorsController.getAvailability
);


// 3. Configure schedule slot availability (Advisors only)
router.post(
  '/advisors/availability',
  authenticate,
  authorize(['Advisor', 'advisor']),
  createAvailabilityValidator,
  advisorsController.createAvailability
);

router.post(
  '/advisors/availability/bulk',
  authenticate,
  authorize(['Advisor', 'advisor']),
  advisorsController.bulkSaveAvailability
);

// 4. View earnings metrics (Advisors only)
router.get('/advisors/earnings', authenticate, authorize(['Advisor', 'advisor']), advisorsController.getEarnings);
router.post('/advisors/payouts', authenticate, authorize(['Advisor', 'advisor']), advisorsController.requestPayout);

// 5. Reserve an appointment slot (Members only - gated by tier check)
router.post(
  '/appointments',
  authenticate,
  authorize(['Member', 'member']),
  bookAppointmentValidator,
  advisorsController.bookAppointment
);

// 6. View appointments listings (Members, Advisors & Admins)
router.get(
  '/appointments',
  authenticate,
  authorize(['Member', 'member', 'Advisor', 'advisor', 'Admin', 'admin']),
  advisorsController.getAppointments
);

// 7. Submit consultation notes to complete appointment (Advisors only)
router.post(
  '/appointments/:id/notes',
  authenticate,
  authorize(['Advisor', 'advisor']),
  submitNotesValidator,
  advisorsController.submitNotes
);

// 8. Reschedule an appointment (Members & Advisors)
router.patch(
  '/appointments/:id/reschedule',
  authenticate,
  authorize(['Member', 'member', 'Advisor', 'advisor']),
  rescheduleAppointmentValidator,
  advisorsController.rescheduleAppointment
);

// 9. Cancel an appointment (Members & Advisors)
router.patch(
  '/appointments/:id/cancel',
  authenticate,
  authorize(['Member', 'member', 'Advisor', 'advisor']),
  cancelAppointmentValidator,
  advisorsController.cancelAppointment
);

// 10. Confirm an appointment (Advisors only)
router.patch(
  '/appointments/:id/confirm',
  authenticate,
  authorize(['Advisor', 'advisor']),
  advisorsController.confirmAppointment
);

// 11. View advisor dashboard stats (Advisors only)
router.get(
  '/advisors/dashboard',
  authenticate,
  authorize(['Advisor', 'advisor']),
  advisorsController.getDashboardData
);



// 13. Chat Hub routes (Members & Advisors)
router.get(
  '/chats/threads',
  authenticate,
  authorize(['Member', 'member', 'Advisor', 'advisor']),
  advisorsController.getChatThreads
);

router.get(
  '/chats/messages',
  authenticate,
  authorize(['Member', 'member', 'Advisor', 'advisor']),
  advisorsController.getChatMessages
);

router.post(
  '/chats/messages',
  authenticate,
  authorize(['Member', 'member', 'Advisor', 'advisor']),
  advisorsController.sendChatMessage
);

router.post(
  '/chats/upload',
  authenticate,
  authorize(['Member', 'member', 'Advisor', 'advisor']),
  advisorsController.uploadChatFileMiddleware,
  advisorsController.uploadChatFile
);

module.exports = router;
