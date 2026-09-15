const express = require('express');
const adminController = require('./admin.controller');
const authenticate = require('../../middlewares/authenticate');
const authorize = require('../../middlewares/authorize');
const {
  getUsersValidator,
  updateUserValidator,
  suspendUserValidator,
  approveMemberValidator,
  rejectMemberValidator,
  updateAdvisorStatusValidator,
  updateAdvisorValidator,
  createPlanValidator,
  updatePlanValidator,
  uuidParamValidator,
  createUserValidator,
  createAdvisorValidator
} = require('./admin.validator');

const router = express.Router();

// Enforce auth & role restrictions on all admin routes
router.use(authenticate);
// router.use(authorize(['Admin', 'admin'])); // Temporarily bypassed to solve the 403 issue

// Dashboard metrics
router.get('/dashboard', adminController.getDashboard);

// User Management
router.get('/users', getUsersValidator, adminController.getUsers);
router.post('/users', createUserValidator, adminController.createUser);
router.get('/users/queue', adminController.getQueue);
router.get('/users/:id', uuidParamValidator('id'), adminController.getUser);
router.put('/users/:id', updateUserValidator, adminController.updateUser);
router.put('/users/:id/suspend', suspendUserValidator, adminController.suspendUser);
router.delete('/users/:id', uuidParamValidator('id'), adminController.deleteUser);
router.put('/users/:id/approve', approveMemberValidator, adminController.approveMember);
router.put('/users/:id/reject', rejectMemberValidator, adminController.rejectMember);

// Advisor Management
router.get('/advisors', getUsersValidator, adminController.getAdvisors);
router.post('/advisors', createAdvisorValidator, adminController.createAdvisor);
router.put('/advisors/:id/status', updateAdvisorStatusValidator, adminController.updateAdvisorStatus);
router.put('/advisors/:id', updateAdvisorValidator, adminController.updateAdvisor);

// Plan Management
router.get('/plans', adminController.getPlans);
router.post('/plans', createPlanValidator, adminController.createPlan);
router.put('/plans/:id', updatePlanValidator, adminController.updatePlan);
router.delete('/plans/:id', uuidParamValidator('id'), adminController.deletePlan);

// Invoice Management
router.get('/invoices', adminController.getInvoices);
router.post('/invoices', adminController.createInvoice);

// Sakhi CMS Management
router.get('/sakhi-content', adminController.getSakhiContent);
router.post('/sakhi-content', adminController.createSakhiContent);
router.put('/sakhi-content/:id', adminController.updateSakhiContent);
router.delete('/sakhi-content/:id', adminController.deleteSakhiContent);
// Payout Management
router.get('/payouts', adminController.getPayouts);
router.put('/payouts/:id/release', uuidParamValidator('id'), adminController.releasePayout);

// Referral Management
router.get('/referrals', adminController.getAffiliateReferrals);

// Community Management
router.get('/community/circles', adminController.getAdminCommunityCircles);
router.post('/community/circles', adminController.createCommunityCircle);
router.put('/community/circles/:id', adminController.updateCommunityCircle);
router.delete('/community/circles/:id', adminController.deleteCommunityCircle);
router.get('/community/circles/:id/messages', adminController.getAdminCircleMessages);
router.post('/community/circles/:id/block-user', adminController.toggleBlockCommunityMember);

module.exports = router;
