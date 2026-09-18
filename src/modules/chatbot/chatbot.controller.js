const jwt = require('jsonwebtoken');
const prisma = require('../../config/database');
const environment = require('../../config/environment');
const authService = require('../auth/auth.service');
const chatbotService = require('./chatbot.service');
const { ApiError } = require('../../middlewares/errorHandler');

const handleChatMessage = async (req, res, next) => {
  try {
    const { message, sessionId, langCode } = req.body;
    
    if (!message) {
      throw new ApiError(400, 'MISSING_MESSAGE', 'Message content is required.');
    }

    // Optional authentication check: check if Bearer token exists and is valid
    let userId = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, environment.jwt.secret);
        userId = decoded.userId;
      } catch (err) {
        // Token invalid or expired: treat as demo user
      }
    }

    const aiResponse = await chatbotService.getBotResponse(message, sessionId, userId, langCode);
    
    return res.status(200).json({
      success: true,
      response: aiResponse
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Handle user registration requests from the chatbot
 */
const handleUserSignup = async (req, res, next) => {
  try {
    const { name, email, password, role, specialty, plan } = req.body;

    if (!email || !password || !role) {
      throw new ApiError(400, 'MISSING_FIELDS', 'Email, password, and role are required.');
    }

    // 1. Create a record in signup_requests table for tracking/analytics
    await prisma.signupRequest.create({
      data: {
        name: name || email.split('@')[0],
        email: email.toLowerCase().trim(),
        role: role.toLowerCase().trim(),
        plan: plan || null,
        specialty: specialty || null,
        status: 'pending'
      }
    });

    // 2. Map role for internal registration service (member/advisor/partner -> partner matches affiliate)
    let mappedRole = role.toLowerCase().trim();
    if (mappedRole === 'partner') {
      mappedRole = 'affiliate';
    }

    // 3. Register user via existing auth service
    const result = await authService.registerUser({
      email: email.toLowerCase().trim(),
      fullName: name || email.split('@')[0],
      role: mappedRole,
      specialty: specialty || 'Hormonal Health',
      password
    });

    return res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Handle user login requests from the chatbot
 */
const handleUserLogin = async (req, res, next) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password || !role) {
      throw new ApiError(400, 'MISSING_FIELDS', 'Email, password, and role are required.');
    }

    // Map role for login (partner matches affiliate)
    let mappedRole = role.toLowerCase().trim();
    if (mappedRole === 'partner') {
      mappedRole = 'affiliate';
    }

    const result = await authService.loginWithPassword(email, password, mappedRole, req);
    
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Get accessible features for logged-in user
 */
const handleGetFeatures = async (req, res, next) => {
  try {
    // req.user is populated by authenticate middleware
    const userRole = req.user.role.toLowerCase();

    let features = [];
    if (userRole === 'member') {
      features = [
        { name: 'Period Tracker', description: 'Ovulation prediction, symptoms log, cycle history and graphs.', path: '/app/period-tracker' },
        { name: 'Home Budget Sakhi', description: 'Financial planning, daily budget tracking, and custom reports.', path: '/app/budget-tracker' },
        { name: 'AI Sakhi Health Helper', description: 'Dynamic chatbot support for daily health and lifestyle guidance.', path: '/app/ai-sakhi' },
        { name: 'Wellness Center & Academy', description: 'Interactive courses, daily affirmations, and meditation sessions.', path: '/app/wellness' }
      ];
    } else if (userRole === 'advisor') {
      features = [
        { name: 'Slot Management', description: 'Create and update availability slots for consultation bookings.', path: '/app/slots' },
        { name: 'Consultation Room', description: 'Access user details and write advisor consultation summaries.', path: '/app/consultations' },
        { name: 'Appointments Manager', description: 'Review and manage upcoming schedules and patient appointments.', path: '/app/appointments' }
      ];
    } else if (userRole === 'affiliate' || userRole === 'partner' || userRole === 'admin') {
      features = [
        { name: 'Referral Code Generator', description: 'Create unique shareable referral links to promote the platform.', path: '/app/referral' },
        { name: 'Wallet & Earnings Panel', description: 'Check total referred signups, conversions, and withdraw payouts.', path: '/app/earnings' },
        { name: 'Marketing Toolkits', description: 'Download banners, brochures, and email marketing copy templates.', path: '/app/marketing' }
      ];
    }

    return res.status(200).json({
      success: true,
      role: userRole,
      features
    });
  } catch (error) {
    next(error);
  }
};

const handleChatAsk = async (req, res, next) => {
  try {
    const { userId, message } = req.body;

    let finalUserId = userId;
    
    // Optional authentication check: check if Bearer token exists and is valid
    if (!finalUserId) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
          const decoded = jwt.verify(token, environment.jwt.secret);
          finalUserId = decoded.userId;
        } catch (err) {
          // Token invalid or expired
        }
      }
    }

    if (!finalUserId) {
      throw new ApiError(400, 'MISSING_USER_ID', 'userId is required.');
    }
    if (!message) {
      throw new ApiError(400, 'MISSING_MESSAGE', 'message is required.');
    }

    const chatService = require('../ai/services/chat.service');
    const result = await chatService.handleChat(finalUserId, message, null, null);

    return res.status(200).json({
      reply: result.reply,
      source: result.source || 'ai',
      suggestions: result.suggestions || []
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  handleChatMessage,
  handleUserSignup,
  handleUserLogin,
  handleGetFeatures,
  handleChatAsk
};
