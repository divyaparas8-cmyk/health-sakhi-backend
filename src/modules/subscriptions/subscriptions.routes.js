const express = require('express');
const authenticate = require('../../middlewares/authenticate');
const authorize = require('../../middlewares/authorize');
const controller = require('./subscriptions.controller');

const router = express.Router();

// ── PUBLIC (Members) ──────────────────────────────────────────────────────────
router.get('/plans', controller.getPlans);                          // GET all plans

// All subscription routes require authentication
router.use(authenticate);

router.get('/my', controller.getMySubscription);                    // GET my subscription + invoices
router.post('/order', controller.createOrder);                      // POST create Razorpay order
router.post('/verify', controller.verifyPayment);                   // POST verify payment
router.post('/failure', controller.handlePaymentFailure);           // POST record payment failure
router.post('/cancel', controller.cancelSubscription);              // POST cancel subscription
router.post('/renew', controller.renewSubscription);                // POST renew subscription
router.post('/coupon/validate', controller.validateCoupon);         // POST validate coupon
router.get('/invoice/:id', controller.getInvoice);                  // GET invoice by id

// ── ADMIN ONLY - Coupon Management ───────────────────────────────────────────
router.post('/admin/coupon', authorize(['Admin', 'admin']), async (req, res, next) => {
  try {
    const prisma = require('../../config/database');
    const { code, discountType, discountValue, maxUsageTotal, maxUsagePerUser, minOrderAmount, applicablePlan, expiresAt } = req.body;
    if (!code || !discountValue) return res.status(400).json({ error: 'code and discountValue are required.' });

    const coupon = await prisma.coupon.create({
      data: {
        code: code.toUpperCase(),
        discountType: discountType || 'PERCENTAGE',
        discountValue: parseFloat(discountValue),
        maxUsageTotal: maxUsageTotal || 100,
        maxUsagePerUser: maxUsagePerUser || 1,
        minOrderAmount: parseFloat(minOrderAmount || 0),
        applicablePlan: applicablePlan || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        isActive: true
      }
    });
    res.status(201).json({ success: true, coupon });
  } catch (err) { next(err); }
});

router.get('/admin/coupons', authorize(['Admin', 'admin']), async (req, res, next) => {
  try {
    const prisma = require('../../config/database');
    const coupons = await prisma.coupon.findMany({
      include: { _count: { select: { usages: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, coupons });
  } catch (err) { next(err); }
});

router.delete('/admin/coupon/:id', authorize(['Admin', 'admin']), async (req, res, next) => {
  try {
    const prisma = require('../../config/database');
    await prisma.coupon.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ success: true, message: 'Coupon deactivated.' });
  } catch (err) { next(err); }
});

module.exports = router;
