const prisma = require('../../config/database');
const { ApiError } = require('../../middlewares/errorHandler');
const logger = require('../../utils/logger');

// ─── MOCK RAZORPAY SERVICE ────────────────────────────────────────────────────
const mockRazorpay = {
  createOrder: ({ amount, currency = 'INR', planSlug }) => {
    const orderId = `order_MOCK_${Date.now()}_${Math.random().toString(36).substr(2, 8).toUpperCase()}`;
    logger.info(`[MockRazorpay] Created order ${orderId} for ₹${amount / 100}`);
    return {
      id: orderId,
      amount,
      currency,
      status: 'created',
      planSlug,
      notes: { platform: 'HealthSakhi', mode: 'TEST' }
    };
  },

  verifyPayment: ({ orderId, paymentId, signature }) => {
    // Always succeeds in TEST mode
    logger.info(`[MockRazorpay] Verified payment ${paymentId} for order ${orderId}`);
    return { verified: true, mode: 'TEST' };
  }
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const generateInvoiceNumber = () =>
  `INV-HS-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

const getPlanDuration = (interval) => {
  if (interval === 'YEARLY') return 365 * 24 * 60 * 60 * 1000;
  return 30 * 24 * 60 * 60 * 1000; // MONTHLY default
};

// ─── 1. GET ALL PLANS ─────────────────────────────────────────────────────────
const getPlans = async () => {
  const plans = await prisma.plan.findMany({
    where: { status: 'ACTIVE', deletedAt: null },
    include: { features: true },
    orderBy: { price: 'asc' }
  });
  return {
    success: true,
    plans: plans.map(p => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: Number(p.price),
      originalPrice: p.originalPrice ? Number(p.originalPrice) : null,
      interval: p.interval,
      maxAiChatsPerDay: p.maxAiChatsPerDay,
      advisorCredits: p.advisorCredits,
      features: p.features.map(f => ({ name: f.featureName, value: f.featureValue }))
    }))
  };
};

// ─── 2. GET MY SUBSCRIPTION ───────────────────────────────────────────────────
const getMySubscription = async (userId) => {
  let sub = await prisma.memberSubscription.findFirst({
    where: { 
      userId, 
      status: { in: ['ACTIVE', 'CANCELLED'] }, 
      deletedAt: null,
      endsAt: { gte: new Date() },
      plan: { slug: { not: 'free-sakhi' } }
    },
    include: {
      plan: { include: { features: true } }
    },
    orderBy: { endsAt: 'desc' }
  });

  if (!sub) {
    sub = await prisma.memberSubscription.findFirst({
      where: { 
        userId, 
        status: { in: ['ACTIVE', 'CANCELLED'] }, 
        deletedAt: null,
        endsAt: { gte: new Date() }
      },
      include: {
        plan: { include: { features: true } }
      },
      orderBy: { endsAt: 'desc' }
    });
  }

  const invoices = await prisma.invoice.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 10
  });

  return {
    success: true,
    subscription: sub ? {
      id: sub.id,
      plan: {
        id: sub.plan.id,
        name: sub.plan.name,
        slug: sub.plan.slug,
        price: Number(sub.plan.price),
        interval: sub.plan.interval,
        features: sub.plan.features.map(f => ({ name: f.featureName, value: f.featureValue }))
      },
      status: sub.status,
      startsAt: sub.startsAt,
      endsAt: sub.endsAt,
      autoRenew: sub.autoRenew
    } : null,
    invoices: invoices.map(inv => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      amount: Number(inv.amount),
      discountAmount: Number(inv.discountAmount || 0),
      tax: Number(inv.tax),
      status: inv.status,
      paidAt: inv.paidAt,
      dueDate: inv.dueDate,
      createdAt: inv.createdAt
    }))
  };
};

// ─── 3. CREATE RAZORPAY ORDER (MOCK) ─────────────────────────────────────────
const createOrder = async (userId, { planSlug, couponCode }) => {
  const plan = await prisma.plan.findFirst({
    where: { slug: planSlug, status: 'ACTIVE', deletedAt: null }
  });
  if (!plan) throw new ApiError(404, 'PLAN_NOT_FOUND', 'Plan not found.');

  let finalAmount = Number(plan.price);
  let discountAmount = 0;
  let appliedCoupon = null;

  // Apply coupon if provided
  if (couponCode) {
    const couponResult = await _validateAndApplyCoupon(userId, couponCode, finalAmount, planSlug);
    discountAmount = couponResult.discountAmount;
    finalAmount = couponResult.finalAmount;
    appliedCoupon = couponResult.coupon;
  }

  // Free plan: no payment needed
  if (finalAmount <= 0 || plan.slug === 'free-sakhi') {
    const sub = await _createSubscription(userId, plan, 0, discountAmount, couponCode);
    return {
      success: true,
      free: true,
      subscription: sub,
      message: 'Free plan activated successfully.'
    };
  }

  // Create mock Razorpay order
  const order = mockRazorpay.createOrder({
    amount: Math.round(finalAmount * 100), // paise
    currency: 'INR',
    planSlug
  });

  // Save pending payment record
  await prisma.payment.create({
    data: {
      userId,
      razorpayOrderId: order.id,
      amount: finalAmount,
      currency: 'INR',
      status: 'CREATED',
      planSlug,
      couponCode: couponCode || null,
      discountAmount
    }
  });

  return {
    success: true,
    free: false,
    order: {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      status: order.status,
      planName: plan.name,
      originalAmount: Number(plan.price),
      discountAmount,
      finalAmount
    },
    coupon: appliedCoupon ? {
      code: appliedCoupon.code,
      discountType: appliedCoupon.discountType,
      discountValue: Number(appliedCoupon.discountValue),
      discountAmount
    } : null
  };
};

// ─── 4. VERIFY PAYMENT & ACTIVATE SUBSCRIPTION ───────────────────────────────
const verifyPayment = async (userId, { orderId, paymentId, signature }) => {
  const payment = await prisma.payment.findUnique({ where: { razorpayOrderId: orderId } });
  if (!payment) throw new ApiError(404, 'PAYMENT_NOT_FOUND', 'Payment order not found.');
  if (payment.userId !== userId) throw new ApiError(403, 'FORBIDDEN', 'Payment does not belong to this user.');

  // Mock verify - always succeeds
  const verified = mockRazorpay.verifyPayment({ orderId, paymentId: paymentId || `pay_MOCK_${Date.now()}`, signature });

  const plan = await prisma.plan.findFirst({
    where: { slug: payment.planSlug, deletedAt: null }
  });
  if (!plan) throw new ApiError(404, 'PLAN_NOT_FOUND', 'Plan not found.');

  const mockPaymentId = paymentId || `pay_MOCK_${Date.now()}_${Math.random().toString(36).substr(2, 8).toUpperCase()}`;

  // Create subscription and invoice in transaction
  const result = await prisma.$transaction(async (tx) => {
    // Cancel old active subscriptions
    await tx.memberSubscription.updateMany({
      where: { userId, status: 'ACTIVE' },
      data: { status: 'CANCELLED' }
    });

    // Create new subscription
    const startsAt = new Date();
    const endsAt = new Date(Date.now() + getPlanDuration(plan.interval));
    const sub = await tx.memberSubscription.create({
      data: { userId, planId: plan.id, status: 'ACTIVE', startsAt, endsAt, autoRenew: true }
    });

    // Update payment status
    await tx.payment.update({
      where: { razorpayOrderId: orderId },
      data: { status: 'SUCCESS', razorpayPaymentId: mockPaymentId, subscriptionId: sub.id }
    });

    // Apply coupon usage if coupon was used
    if (payment.couponCode) {
      const coupon = await tx.coupon.findUnique({ where: { code: payment.couponCode } });
      if (coupon) {
        await tx.coupon.update({ where: { id: coupon.id }, data: { usageCount: { increment: 1 } } });
        await tx.couponUsage.upsert({
          where: { couponId_userId: { couponId: coupon.id, userId } },
          update: {},
          create: { couponId: coupon.id, userId }
        });
      }
    }

    // Generate invoice
    const invoiceNumber = generateInvoiceNumber();
    const taxAmount = Number(payment.amount) * 0.18;
    const invoice = await tx.invoice.create({
      data: {
        userId,
        subscriptionId: sub.id,
        invoiceNumber,
        amount: payment.amount,
        discountAmount: payment.discountAmount,
        tax: taxAmount,
        status: 'PAID',
        dueDate: endsAt,
        paidAt: new Date()
      }
    });

    // Approve user if not approved
    await tx.user.update({ where: { id: userId }, data: { isApproved: true } });

    // Credit affiliate commission if referred
    const referral = await tx.referralTracking.findUnique({
      where: { referredUserId: userId }
    });

    if (referral && referral.conversionStatus === 'SIGNED_UP') {
      await tx.referralTracking.update({
        where: { id: referral.id },
        data: { conversionStatus: 'PAID' }
      });

      let commissionPercent = 10;
      const slug = payment.planSlug ? payment.planSlug.toLowerCase() : '';
      if (slug.includes('family') || slug.includes('wellness') || slug === 'elite') {
        commissionPercent = 15;
      } else if (slug.includes('premium') || slug.includes('pro')) {
        commissionPercent = 15;
      }

      const commissionAmount = (Number(payment.amount) * commissionPercent) / 100;

      if (commissionAmount > 0) {
        const affiliate = await tx.affiliate.findUnique({
          where: { referralCode: referral.referralCode }
        });

        if (affiliate) {
          await tx.affiliate.update({
            where: { id: affiliate.id },
            data: { totalEarnings: { increment: commissionAmount } }
          });

          await tx.affiliateWallet.update({
            where: { affiliateId: affiliate.id },
            data: { balance: { increment: commissionAmount } }
          });
        }
      }
    }

    return { sub, invoice, mockPaymentId };
  });

  // Trigger admin notification for plan subscription
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true }
    });
    const userName = user?.profile?.fullName || user?.email || 'A user';
    const { createAdminNotification } = require('../notifications/notifications.service');
    await createAdminNotification(
      `Plan Subscribed: ${plan.name}`,
      `${userName} (${user?.email || ''}) has successfully purchased/activated plan: ${plan.name}.`,
      'billing'
    );
  } catch (err) {
    logger.error(`[Admin Notification Error] ${err.message}`);
  }

  return {
    success: true,
    paymentId: result.mockPaymentId,
    subscription: { id: result.sub.id, status: result.sub.status, endsAt: result.sub.endsAt },
    invoice: {
      id: result.invoice.id,
      invoiceNumber: result.invoice.invoiceNumber,
      amount: Number(result.invoice.amount),
      discountAmount: Number(result.invoice.discountAmount),
      tax: Number(result.invoice.tax),
      status: result.invoice.status
    },
    message: 'Payment verified and subscription activated successfully.'
  };
};

// ─── 5. PAYMENT FAILURE HANDLER ───────────────────────────────────────────────
const handlePaymentFailure = async (userId, { orderId, reason }) => {
  await prisma.payment.updateMany({
    where: { razorpayOrderId: orderId, userId },
    data: { status: 'FAILED', failureReason: reason || 'Payment failed by user' }
  });
  return { success: true, message: 'Payment failure recorded.' };
};

// ─── 6. CANCEL SUBSCRIPTION ───────────────────────────────────────────────────
const cancelSubscription = async (userId) => {
  const sub = await prisma.memberSubscription.findFirst({
    where: { userId, status: 'ACTIVE', deletedAt: null }
  });
  if (!sub) throw new ApiError(404, 'NO_ACTIVE_SUBSCRIPTION', 'No active subscription found.');

  await prisma.memberSubscription.update({
    where: { id: sub.id },
    data: { status: 'CANCELLED', autoRenew: false }
  });

  // Activate free plan fallback
  const freePlan = await prisma.plan.findFirst({ where: { slug: 'free-sakhi', deletedAt: null } });
  if (freePlan) {
    await prisma.memberSubscription.create({
      data: {
        userId, planId: freePlan.id, status: 'ACTIVE',
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        autoRenew: false
      }
    });
  }

  return { success: true, message: 'Subscription cancelled. Free plan activated.' };
};

// ─── 7. RENEW SUBSCRIPTION ────────────────────────────────────────────────────
const renewSubscription = async (userId) => {
  const sub = await prisma.memberSubscription.findFirst({
    where: { userId, status: 'ACTIVE', deletedAt: null },
    include: { plan: true }
  });
  if (!sub) throw new ApiError(404, 'NO_ACTIVE_SUBSCRIPTION', 'No active subscription to renew.');

  const newEndsAt = new Date(new Date(sub.endsAt).getTime() + getPlanDuration(sub.plan.interval));
  await prisma.memberSubscription.update({ where: { id: sub.id }, data: { endsAt: newEndsAt } });

  return { success: true, message: 'Subscription renewed successfully.', newEndsAt };
};

// ─── 8. VALIDATE COUPON ───────────────────────────────────────────────────────
const validateCoupon = async (userId, { code, planSlug, amount }) => {
  const result = await _validateAndApplyCoupon(userId, code, amount, planSlug);
  return {
    success: true,
    coupon: {
      code: result.coupon.code,
      discountType: result.coupon.discountType,
      discountValue: Number(result.coupon.discountValue),
      discountAmount: result.discountAmount,
      finalAmount: result.finalAmount
    }
  };
};

// ─── 9. GET INVOICE BY ID ─────────────────────────────────────────────────────
const getInvoice = async (userId, invoiceId) => {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, userId },
    include: {
      user: { include: { profile: true } },
      subscription: { include: { plan: true } }
    }
  });
  if (!invoice) throw new ApiError(404, 'INVOICE_NOT_FOUND', 'Invoice not found.');

  return {
    success: true,
    invoice: {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      amount: Number(invoice.amount),
      discountAmount: Number(invoice.discountAmount || 0),
      tax: Number(invoice.tax),
      totalPayable: Number(invoice.amount) - Number(invoice.discountAmount || 0) + Number(invoice.tax),
      status: invoice.status,
      paidAt: invoice.paidAt,
      dueDate: invoice.dueDate,
      createdAt: invoice.createdAt,
      user: {
        name: invoice.user?.profile?.fullName || 'N/A',
        email: invoice.user?.email
      },
      plan: invoice.subscription ? {
        name: invoice.subscription.plan.name,
        slug: invoice.subscription.plan.slug,
        interval: invoice.subscription.plan.interval
      } : null
    }
  };
};

// ─── INTERNAL HELPERS ─────────────────────────────────────────────────────────
const _createSubscription = async (userId, plan, finalAmount, discountAmount, couponCode) => {
  const sub = await prisma.$transaction(async (tx) => {
    await tx.memberSubscription.updateMany({
      where: { userId, status: 'ACTIVE' },
      data: { status: 'CANCELLED' }
    });

    const startsAt = new Date();
    const endsAt = new Date(Date.now() + getPlanDuration(plan.interval));
    const createdSub = await tx.memberSubscription.create({
      data: { userId, planId: plan.id, status: 'ACTIVE', startsAt, endsAt, autoRenew: false }
    });

    const invoiceNumber = generateInvoiceNumber();
    await tx.invoice.create({
      data: {
        userId, subscriptionId: createdSub.id, invoiceNumber,
        amount: finalAmount, discountAmount: discountAmount || 0,
        tax: 0, status: 'PAID', dueDate: endsAt, paidAt: new Date()
      }
    });

    await tx.user.update({ where: { id: userId }, data: { isApproved: true } });
    return createdSub;
  });

  // Trigger admin notification for plan activation
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true }
    });
    const userName = user?.profile?.fullName || user?.email || 'A user';
    const { createAdminNotification } = require('../notifications/notifications.service');
    await createAdminNotification(
      `Plan Activated: ${plan.name}`,
      `${userName} (${user?.email || ''}) has activated the plan: ${plan.name}.`,
      'billing'
    );
  } catch (err) {
    logger.error(`[Admin Notification Error] ${err.message}`);
  }

  return sub;
};

const _validateAndApplyCoupon = async (userId, code, amount, planSlug) => {
  const coupon = await prisma.coupon.findUnique({ where: { code: code.toUpperCase() } });
  if (!coupon) throw new ApiError(404, 'COUPON_NOT_FOUND', 'Coupon code not found.');
  if (!coupon.isActive) throw new ApiError(400, 'COUPON_INACTIVE', 'This coupon is no longer active.');
  if (coupon.expiresAt && new Date() > coupon.expiresAt) throw new ApiError(400, 'COUPON_EXPIRED', 'This coupon has expired.');
  if (coupon.usageCount >= coupon.maxUsageTotal) throw new ApiError(400, 'COUPON_EXHAUSTED', 'This coupon has reached its maximum usage limit.');
  if (coupon.applicablePlan && coupon.applicablePlan !== planSlug) throw new ApiError(400, 'COUPON_NOT_APPLICABLE', `This coupon is only valid for ${coupon.applicablePlan} plan.`);
  if (Number(coupon.minOrderAmount) > 0 && amount < Number(coupon.minOrderAmount)) throw new ApiError(400, 'MIN_ORDER_NOT_MET', `Minimum order amount of ₹${coupon.minOrderAmount} required.`);

  // Check per-user usage
  const userUsage = await prisma.couponUsage.findUnique({
    where: { couponId_userId: { couponId: coupon.id, userId } }
  });
  if (userUsage) throw new ApiError(400, 'COUPON_ALREADY_USED', 'You have already used this coupon.');

  let discountAmount = 0;
  if (coupon.discountType === 'PERCENTAGE') {
    discountAmount = (amount * Number(coupon.discountValue)) / 100;
  } else {
    discountAmount = Math.min(Number(coupon.discountValue), amount);
  }
  const finalAmount = Math.max(0, amount - discountAmount);

  return { coupon, discountAmount: parseFloat(discountAmount.toFixed(2)), finalAmount: parseFloat(finalAmount.toFixed(2)) };
};

module.exports = {
  getPlans,
  getMySubscription,
  createOrder,
  verifyPayment,
  handlePaymentFailure,
  cancelSubscription,
  renewSubscription,
  validateCoupon,
  getInvoice
};
