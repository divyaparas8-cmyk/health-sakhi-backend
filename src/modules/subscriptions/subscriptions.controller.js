const subscriptionsService = require('./subscriptions.service');

const getPlans = async (req, res, next) => {
  try {
    const result = await subscriptionsService.getPlans();
    res.json(result);
  } catch (err) { next(err); }
};

const getMySubscription = async (req, res, next) => {
  try {
    const result = await subscriptionsService.getMySubscription(req.user.id);
    res.json(result);
  } catch (err) { next(err); }
};

const createOrder = async (req, res, next) => {
  try {
    const result = await subscriptionsService.createOrder(req.user.id, req.body);
    res.json(result);
  } catch (err) { next(err); }
};

const verifyPayment = async (req, res, next) => {
  try {
    const result = await subscriptionsService.verifyPayment(req.user.id, req.body);
    res.json(result);
  } catch (err) { next(err); }
};

const handlePaymentFailure = async (req, res, next) => {
  try {
    const result = await subscriptionsService.handlePaymentFailure(req.user.id, req.body);
    res.json(result);
  } catch (err) { next(err); }
};

const cancelSubscription = async (req, res, next) => {
  try {
    const result = await subscriptionsService.cancelSubscription(req.user.id);
    res.json(result);
  } catch (err) { next(err); }
};

const renewSubscription = async (req, res, next) => {
  try {
    const result = await subscriptionsService.renewSubscription(req.user.id);
    res.json(result);
  } catch (err) { next(err); }
};

const validateCoupon = async (req, res, next) => {
  try {
    const result = await subscriptionsService.validateCoupon(req.user.id, req.body);
    res.json(result);
  } catch (err) { next(err); }
};

const getInvoice = async (req, res, next) => {
  try {
    const result = await subscriptionsService.getInvoice(req.user.id, req.params.id);
    res.json(result);
  } catch (err) { next(err); }
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
