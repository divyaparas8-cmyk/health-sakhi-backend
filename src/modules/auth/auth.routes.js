const express = require('express');
const authController = require('./auth.controller');
const { loginValidator, verifyOtpValidator, refreshTokenValidator } = require('./auth.validator');
const authenticate = require('../../middlewares/authenticate');

const router = express.Router();

// Public login - initiate OTP
router.post('/login', loginValidator, authController.login);

// Public verification - validate OTP
router.post('/verify-otp', verifyOtpValidator, authController.verifyOtp);

// Public/Session refreshing - renew JWT token
router.post('/refresh-token', refreshTokenValidator, authController.refreshToken);

// Public signup - register with optional referral code
router.post('/register', authController.register);

// Authenticated session logout
router.post('/logout', authenticate, authController.logout);

module.exports = router;
