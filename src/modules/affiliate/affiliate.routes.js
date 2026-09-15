const express = require('express');
const affiliateController = require('./affiliate.controller');
const authenticate = require('../../middlewares/authenticate');
const authorize = require('../../middlewares/authorize');

const router = express.Router();

// Enforce auth & roles on all affiliate endpoints
router.use(authenticate);
router.use(authorize(['Affiliate', 'affiliate', 'Member', 'member', 'Admin', 'admin']));

// 1. Onboarding/Registration
router.post('/register', affiliateController.registerAffiliate);

// 2. Dashboard Metrics
router.get('/dashboard', affiliateController.getAffiliateDashboard);

// 3. Referral Link Retrieval
router.get('/referral-link', affiliateController.getReferralLink);

// 4. Commissions / Earnings History
router.get('/earnings', affiliateController.getCommissions);
router.get('/commissions', affiliateController.getCommissions);

// 5. Campaign Links & Live CTR Tracking
router.get('/links', affiliateController.getLinks);
router.post('/links', affiliateController.getLinks);
router.post('/links/click', affiliateController.trackLinkClick);

// 6. Payout Requests
router.post('/payouts', affiliateController.requestPayout);
router.get('/payouts', affiliateController.getPayouts);

module.exports = router;
