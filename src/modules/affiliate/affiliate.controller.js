const affiliateService = require('./affiliate.service');

const registerAffiliate = async (req, res, next) => {
  try {
    const referralCode = await affiliateService.generateReferralCode(req.user.id);
    return res.status(201).json({
      success: true,
      message: 'Affiliate onboarding complete.',
      referral_code: referralCode
    });
  } catch (error) {
    next(error);
  }
};

const getAffiliateDashboard = async (req, res, next) => {
  try {
    const result = await affiliateService.getAffiliateDashboard(req.user.id);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const getReferralLink = async (req, res, next) => {
  try {
    const referralCode = await affiliateService.generateReferralCode(req.user.id);
    const domain = req.get('host') || 'healthsakhi.com';
    const protocol = req.protocol || 'https';
    return res.status(200).json({
      success: true,
      referral_code: referralCode,
      referral_link: `${protocol}://${domain}/register?ref=${referralCode}`
    });
  } catch (error) {
    next(error);
  }
};

const getCommissions = async (req, res, next) => {
  try {
    const result = await affiliateService.getCommissions(req.user.id);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const requestPayout = async (req, res, next) => {
  try {
    const { amount } = req.body;
    const prisma = require('../../config/database');
    const affiliate = await prisma.affiliate.findUnique({
      where: { userId: req.user.id },
      include: { wallet: true }
    });
    if (!affiliate) {
      return res.status(404).json({ success: false, message: 'Affiliate not found.' });
    }
    if (Number(affiliate.wallet.balance) < amount) {
      return res.status(400).json({ success: false, message: 'Insufficient balance.' });
    }
    // Decrement wallet balance
    await prisma.affiliateWallet.update({
      where: { affiliateId: affiliate.id },
      data: { balance: { decrement: amount } }
    });
    return res.status(201).json({
      success: true,
      message: 'Payout request processed successfully.'
    });
  } catch (error) {
    next(error);
  }
};

const getPayouts = async (req, res, next) => {
  try {
    return res.status(200).json({
      success: true,
      payouts: []
    });
  } catch (error) {
    next(error);
  }
};

const getLinks = async (req, res, next) => {
  try {
    const result = await affiliateService.getLinks(req.user.id);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const trackLinkClick = async (req, res, next) => {
  try {
    const { slug } = req.body;
    const result = await affiliateService.trackLinkClick(slug);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registerAffiliate,
  getAffiliateDashboard,
  getReferralLink,
  getCommissions,
  requestPayout,
  getPayouts,
  getLinks,
  trackLinkClick
};
