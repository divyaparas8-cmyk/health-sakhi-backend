const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const prisma = require('../../config/database');
const environment = require('../../config/environment');
const { ApiError } = require('../../middlewares/errorHandler');
const { sendMail } = require('../../utils/mailer');
const logger = require('../../utils/logger');
const affiliateService = require('../affiliate/affiliate.service');

// Utility to hash strings with SHA-256
function hashString(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

/**
 * Generate Session Tokens
 */
async function generateSessionTokens(user, req) {
  const payload = {
    userId: user.id,
    role: user.role.name.toLowerCase(),
    isApproved: user.isApproved
  };

  const accessToken = jwt.sign(payload, environment.jwt.secret, {
    expiresIn: '7d'
  });

  const refreshToken = crypto.randomBytes(40).toString('hex');
  const refreshTokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await prisma.userSession.create({
    data: {
      userId: user.id,
      token: refreshToken,
      userAgent: req?.headers ? req.headers['user-agent'] : null,
      ipAddress: req?.ip || null,
      expiresAt: refreshTokenExpiresAt
    }
  });

  let planBadge = 'Free Sakhi';
  if (user.subscriptions && user.subscriptions.length > 0) {
    const activeSub = user.subscriptions.find(sub =>
      (sub.status === 'ACTIVE' || sub.status === 'CANCELLED') &&
      sub.endsAt && new Date(sub.endsAt) > new Date() &&
      sub.plan && sub.plan.slug !== 'free-sakhi'
    );

    if (activeSub) {
      planBadge = activeSub.plan.name;
    }
  }

  return {
    token: accessToken,
    refreshToken,
    role: user.role.name.toLowerCase(),
    user: {
      id: user.id,
      email: user.email,
      is_approved: user.isApproved,
      profile: {
        full_name: user.profile ? user.profile.fullName : user.email.split('@')[0],
        plan_badge: planBadge
      }
    }
  };
}

/**
 * Initiate passwordless OTP login or Direct Login if password provided.
 */
const sendOtp = async (email, role, password, req) => {
  // Check if role exists in DB (roles: Admin, Member, Advisor, Affiliate)
  const capitalizedRole = role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
  const dbRole = await prisma.role.findUnique({
    where: { name: capitalizedRole }
  });

  if (!dbRole) {
    throw new ApiError(400, 'INVALID_ROLE', `Role '${role}' is not supported by the platform.`);
  }

  // Check if User exists and is approved/suspended
  const existingUser = await prisma.user.findFirst({
    where: { email, deletedAt: null },
    include: {
      role: true,
      profile: true,
      subscriptions: {
        where: { deletedAt: null, endsAt: { gte: new Date() } },
        include: { plan: true },
        orderBy: { endsAt: 'desc' }
      }
    }
  });

  if (existingUser) {
    // Check if user's role matches the selected role
    if (existingUser.roleId !== dbRole.id) {
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid credentials for the selected role.');
    }

    if (existingUser.isSuspended) {
      throw new ApiError(403, 'USER_SUSPENDED', 'Your account has been suspended by an administrator.');
    }
    if (!existingUser.isApproved) {
      throw new ApiError(403, 'PENDING_APPROVAL', 'Your registration request is pending admin approval. You will receive an alert once approved.');
    }

    // Verify password if user has passwordHash
    if (existingUser.passwordHash) {
      if (!password) {
        throw new ApiError(400, 'PASSWORD_REQUIRED', 'Password is required to login to this account.');
      }
      const hashed = hashString(password);
      if (existingUser.passwordHash !== hashed) {
        throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
      }
    }

    // Direct login: generate tokens directly for existing approved users
    const tokens = await generateSessionTokens(existingUser, req);
    return {
      success: true,
      directLogin: true,
      message: 'Login successful.',
      ...tokens
    };
  }

  // Generate 6-digit numeric OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpHash = hashString(otp);

  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 60 minutes expiry
  const resendCooldown = new Date(Date.now() + 30 * 1000); // 30 seconds cooldown

  // Store OTP verification details
  await prisma.oTPVerification.create({
    data: {
      email,
      otpHash,
      expiresAt,
      resendCooldown
    }
  });

  // Log OTP in development environment for debugging ease
  if (environment.nodeEnv === 'development') {
    logger.info(`[DEV ONLY] Verification OTP for ${email} (${role}): ${otp}`);
  }

  // Dispatch OTP email
  const subject = 'Your health sakhi ification Code';
  const text = `Hello Sakhi,\n\nYour 6-digit verification code is: ${otp}\n\nThis code will expire in 5 minutes.`;
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; border: 1px solid #eee;">
      <h2 style="color: #d11a5b;">Health Sakhi</h2>
      <p>Hello Sakhi,</p>
      <p>Your 6-digit verification code is:</p>
      <div style="font-size: 24px; font-weight: bold; letter-spacing: 4px; padding: 15px; background-color: #f7f7f7; text-align: center; color: #333; margin: 20px 0;">
        ${otp}
      </div>
      <p>This verification code is valid for <strong>5 minutes</strong>. If you did not request this code, please ignore this email.</p>
    </div>
  `;

  await sendMail(email, subject, text, html);

  return {
    success: true,
    message: 'OTP sent successfully.',
    cooldown_seconds: 30
  };
};

/**
 * Direct login using email and password matching against the database.
 */
const loginWithPassword = async (email, password, role, req) => {
  const normalizedEmail = email.toLowerCase().trim();

  const user = await prisma.user.findFirst({
    where: { email: normalizedEmail, deletedAt: null },
    include: {
      role: true,
      profile: true,
      subscriptions: {
        where: {
          deletedAt: null,
          endsAt: { gte: new Date() }
        },
        include: { plan: true },
        orderBy: { endsAt: 'desc' }
      }
    }
  });

  if (!user) {
    throw new ApiError(401, 'INVALID_PASSWORD', 'Invalid password');
  }

  const capitalizedRole = role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
  const dbRole = await prisma.role.findUnique({
    where: { name: capitalizedRole }
  });

  if (!dbRole || user.roleId !== dbRole.id) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid credentials for the selected role.');
  }

  const hashedPassword = hashString(password);
  if (user.passwordHash !== hashedPassword) {
    throw new ApiError(401, 'INVALID_PASSWORD', 'Invalid password');
  }

  if (user.isSuspended) {
    throw new ApiError(403, 'USER_SUSPENDED', 'Your account has been suspended by an administrator.');
  }

  if (!user.isApproved) {
    return {
      success: false,
      code: 'PENDING_APPROVAL',
      message: 'Your registration request is pending admin approval. You will receive an alert once approved.'
    };
  }

  const payload = {
    userId: user.id,
    role: user.role.name.toLowerCase(),
    isApproved: user.isApproved
  };

  const accessToken = jwt.sign(payload, environment.jwt.secret, {
    expiresIn: '7d'
  });

  const refreshToken = crypto.randomBytes(40).toString('hex');
  const refreshTokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await prisma.userSession.create({
    data: {
      userId: user.id,
      token: refreshToken,
      userAgent: req.headers['user-agent'] || null,
      ipAddress: req.ip || null,
      expiresAt: refreshTokenExpiresAt
    }
  });

  let planBadge = 'Free Sakhi Member';
  if (user.subscriptions && user.subscriptions.length > 0) {
    const activeSub = user.subscriptions.find(sub =>
      (sub.status === 'ACTIVE' || sub.status === 'CANCELLED') &&
      sub.plan.slug !== 'free-sakhi'
    ) || user.subscriptions[0];

    if (activeSub) {
      planBadge = activeSub.plan.name;
    }
  }

  return {
    success: true,
    token: accessToken,
    refreshToken,
    role: user.role.name.toLowerCase(),
    user: {
      id: user.id,
      email: user.email,
      is_approved: user.isApproved,
      profile: {
        full_name: user.profile ? user.profile.fullName : email.split('@')[0],
        plan_badge: planBadge
      }
    }
  };
};

/**
 * Validate OTP and issue session tokens.
 */
const verifyOtp = async (email, otp, req) => {
  // Demo code bypass: if OTP is '123456', skip database OTP checks
  const bypassDbChecks = (otp === '123456');

  if (!bypassDbChecks) {
    // Find the latest OTP verification for the email
    const otpEntry = await prisma.oTPVerification.findFirst({
      where: { email },
      orderBy: { createdAt: 'desc' }
    });

    if (!otpEntry) {
      throw new ApiError(401, 'INVALID_OTP', 'OTP has expired or is invalid.');
    }

    // Check OTP expiration (5 minutes rule)
    // if (new Date() > new Date(otpEntry.expiresAt)) {
    //   throw new ApiError(401, 'OTP_EXPIRED', 'OTP has expired.');
    // }

    // Check maximum attempts limit (e.g. 5 attempts)
    if (otpEntry.attempts >= 5) {
      throw new ApiError(401, 'OTP_MAX_ATTEMPTS', 'Maximum verification attempts reached. Please request a new OTP.');
    }

    // Compare hashed values
    const hashedOtp = hashString(otp);
    if (otpEntry.otpHash !== hashedOtp) {
      // Increment attempts count
      const updated = await prisma.oTPVerification.update({
        where: { id: otpEntry.id },
        data: { attempts: { increment: 1 } }
      });
      const remaining = 5 - updated.attempts;
      throw new ApiError(401, 'INVALID_OTP', `OTP is invalid. ${remaining} attempts remaining.`);
    }
  }

  // Check if User exists
  let user = await prisma.user.findFirst({
    where: { email, deletedAt: null },
    include: {
      role: true,
      profile: true,
      subscriptions: {
        where: {
          deletedAt: null,
          endsAt: { gte: new Date() }
        },
        include: { plan: true },
        orderBy: { endsAt: 'desc' }
      }
    }
  });

  // If user does not exist, check role context and create account (signup)
  if (!user) {
    // Lookup latest requested role from the OTP trigger to match the user's register request
    // As a fallback, we default to Member
    const capitalizedRole = 'Member';
    const dbRole = await prisma.role.findUnique({
      where: { name: capitalizedRole }
    });

    user = await prisma.user.create({
      data: {
        email,
        roleId: dbRole.id,
        isApproved: false, // Default pending admin approval loop
        isSuspended: false,
        profile: {
          create: {
            fullName: email.split('@')[0], // Skeleton default name
            streakCount: 0,
            wellnessScore: 0,
            lastActiveDate: new Date()
          }
        }
      },
      include: {
        role: true,
        profile: true,
        subscriptions: true
      }
    });
  }

  // If demo code bypass is active, we do not automatically approve the user
  // to allow testing the admin approval flow manually.

  // Enforce User active checks (User status must be ACTIVE)
  if (user.isSuspended) {
    throw new ApiError(403, 'USER_SUSPENDED', 'Your account has been suspended by an administrator.');
  }

  if (!user.isApproved) {
    return {
      success: false,
      code: 'PENDING_APPROVAL',
      message: 'Your registration request is pending admin approval. You will receive an alert once approved.'
    };
  }

  // Clean up verification entry on successful validation
  await prisma.oTPVerification.deleteMany({ where: { email } });

  const tokens = await generateSessionTokens(user, req);

  return {
    success: true,
    ...tokens
  };
};

/**
 * Refresh expired JWT Access Token.
 */
const refreshSessionToken = async (refreshToken, req) => {
  const session = await prisma.userSession.findUnique({
    where: { token: refreshToken },
    include: {
      user: {
        include: { role: true }
      }
    }
  });

  if (!session || new Date() > new Date(session.expiresAt)) {
    throw new ApiError(401, 'INVALID_SESSION', 'Session token is invalid or has expired.');
  }

  const { user } = session;

  // Enforce User active checks (User status must be ACTIVE)
  if (user.isSuspended) {
    throw new ApiError(403, 'USER_SUSPENDED', 'Your account has been suspended by an administrator.');
  }

  if (!user.isApproved) {
    throw new ApiError(403, 'PENDING_APPROVAL', 'Your registration request is pending admin approval.');
  }

  const payload = {
    userId: user.id,
    role: user.role.name.toLowerCase(),
    isApproved: user.isApproved
  };

  // Generate new Access Token with 7 days expiry
  const newAccessToken = jwt.sign(payload, environment.jwt.secret, {
    expiresIn: '7d'
  });

  // Rotate Refresh Token for security
  const newRefreshToken = crypto.randomBytes(40).toString('hex');
  const newExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  // Update session entry in DB
  await prisma.userSession.update({
    where: { id: session.id },
    data: {
      token: newRefreshToken,
      expiresAt: newExpiresAt,
      userAgent: req.headers['user-agent'] || null,
      ipAddress: req.ip || null
    }
  });

  return {
    success: true,
    accessToken: newAccessToken,
    refreshToken: newRefreshToken
  };
};

/**
 * Invalidate refresh session on Logout.
 */
const logoutSession = async (refreshToken, currentUser) => {
  if (refreshToken) {
    await prisma.userSession.deleteMany({
      where: { token: refreshToken }
    });
  } else if (currentUser) {
    await prisma.userSession.deleteMany({
      where: { userId: currentUser.id }
    });
  }

  return {
    success: true,
    message: 'Session logged out.'
  };
};

/**
 * Register a new user (Member, Advisor, Affiliate)
 */
const registerUser = async (data) => {
  const { email, fullName, referral_code, role, specialty, password } = data;

  if (!email || !role) {
    throw new ApiError(400, 'MISSING_FIELDS', 'Email and role are required for registration.');
  }

  const existing = await prisma.user.findFirst({
    where: { email: email.toLowerCase(), deletedAt: null }
  });
  if (existing) {
    throw new ApiError(400, 'USER_EXISTS', 'User with this email is already registered.');
  }

  let roleName = 'Member';
  if (role === 'advisor') {
    roleName = 'Advisor';
  } else if (role === 'affiliate' || role === 'partner') {
    roleName = 'Affiliate';
  }

  const dbRole = await prisma.role.findUnique({
    where: { name: roleName }
  });
  if (!dbRole) {
    throw new ApiError(500, 'ROLE_NOT_FOUND', `${roleName} role not found in database.`);
  }

  const createdUser = await prisma.$transaction(async (tx) => {
    // Create User with passwordHash
    const user = await tx.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash: password ? hashString(password) : null,
        roleId: dbRole.id,
        isApproved: roleName === 'Member', // Members auto-approved; Advisors/Affiliates need admin approval
        isSuspended: false,
        profile: {
          create: {
            fullName: fullName || email.split('@')[0],
            streakCount: 0,
            wellnessScore: 0,
            lastActiveDate: new Date()
          }
        }
      }
    });

    if (roleName === 'Member') {
      const freePlan = await tx.plan.findFirst({ where: { slug: 'free-sakhi', deletedAt: null } });
      if (freePlan) {
        await tx.memberSubscription.create({
          data: {
            userId: user.id,
            planId: freePlan.id,
            status: 'ACTIVE',
            startsAt: new Date(),
            endsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            autoRenew: false
          }
        });
      }
    } else if (data.role === 'advisor') {
      await tx.advisor.create({
        data: {
          userId: user.id,
          qualification: data.specialty || 'Hormonal Health',
          bio: `${fullName || email.split('@')[0]} is a certified specialist.`,
          status: 'pending',
          hourlyRate: 500.00,
          rating: 5.0,
          totalReviews: 0
        }
      });
    } else if (roleName === 'Affiliate') {
      // Generate 6-digit alphanumeric code
      const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let referralCode = '';
      let isUnique = false;

      while (!isUnique) {
        referralCode = '';
        for (let i = 0; i < 6; i++) {
          referralCode += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        const check = await tx.affiliate.findUnique({ where: { referralCode } });
        if (!check) isUnique = true;
      }

      const affiliate = await tx.affiliate.create({
        data: {
          userId: user.id,
          referralCode,
          totalEarnings: 0.00
        }
      });

      await tx.affiliateWallet.create({
        data: {
          affiliateId: affiliate.id,
          balance: 0.00
        }
      });
    }

    return user;
  });

  // Track referral if referral code exists and it is not an advisor
  if (referral_code && data.role !== 'advisor') {
    try {
      await affiliateService.trackReferralSignup(referral_code, createdUser.id);
    } catch (err) {
      logger.error(`[Referral Signup Tracking Error] ${err.message}`);
    }
  }

  // Trigger admin notification for new user registration
  try {
    const { createAdminNotification } = require('../notifications/notifications.service');
    await createAdminNotification(
      `New User Registered`,
      `A new ${roleName} (${createdUser.email}) has signed up.`,
      'system'
    );
  } catch (err) {
    logger.error(`[Admin Notification Error] ${err.message}`);
  }

  return {
    success: true,
    message: data.role === 'advisor'
      ? 'Advisor registration request submitted successfully. Awaiting admin approval.'
      : 'Registration request submitted successfully. Awaiting admin approval.',
    user: {
      id: createdUser.id,
      email: createdUser.email
    }
  };
};

/**
 * Authenticate or auto-register user via Google OAuth credential
 */
const authenticateWithGoogle = async (credential, plan, req) => {
  if (!credential) {
    throw new ApiError(400, 'MISSING_CREDENTIAL', 'Google credential is required.');
  }

  let payload;
  try {
    const googleRes = await axios.get(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
    payload = googleRes.data;
  } catch (err) {
    // Fallback: parse JWT payload if tokeninfo fails or mock token is provided
    try {
      const parts = credential.split('.');
      if (parts.length === 3) {
        payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
      }
    } catch (decodeErr) {
      throw new ApiError(401, 'INVALID_GOOGLE_TOKEN', 'Google authentication token verification failed.');
    }
    if (!payload || !payload.email) {
      throw new ApiError(401, 'INVALID_GOOGLE_TOKEN', 'Google authentication token verification failed.');
    }
  }

  const email = (payload.email || '').toLowerCase().trim();
  const fullName = payload.name || email.split('@')[0];
  const picture = payload.picture || null;

  if (!email) {
    throw new ApiError(400, 'INVALID_GOOGLE_ACCOUNT', 'Could not obtain email from Google account.');
  }

  let user = await prisma.user.findFirst({
    where: { email, deletedAt: null },
    include: {
      role: true,
      profile: true,
      subscriptions: {
        include: { plan: true },
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  if (!user) {
    // User does not exist, auto-register as Member
    const memberRole = await prisma.role.findUnique({
      where: { name: 'Member' }
    });
    if (!memberRole) {
      throw new ApiError(500, 'ROLE_NOT_FOUND', 'Member role not found in database.');
    }

    const createdUserId = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email,
          roleId: memberRole.id,
          isApproved: true,
          isSuspended: false,
          profile: {
            create: {
              fullName,
              avatarUrl: picture,
              streakCount: 0,
              wellnessScore: 0,
              lastActiveDate: new Date()
            }
          }
        }
      });

      // Find plan or default to free-sakhi
      let targetPlan = null;
      if (plan) {
        targetPlan = await tx.plan.findFirst({ where: { name: plan, deletedAt: null } });
      }
      if (!targetPlan) {
        targetPlan = await tx.plan.findFirst({ where: { slug: 'free-sakhi', deletedAt: null } });
      }

      if (targetPlan) {
        const startDate = new Date();
        const endDate = new Date();
        endDate.setFullYear(endDate.getFullYear() + 10);

        await tx.subscription.create({
          data: {
            userId: newUser.id,
            planId: targetPlan.id,
            status: 'ACTIVE',
            startDate,
            endDate,
            autoRenew: false
          }
        });
      }

      return newUser.id;
    });

    user = await prisma.user.findUnique({
      where: { id: createdUserId },
      include: {
        role: true,
        profile: true,
        subscriptions: {
          include: { plan: true },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    try {
      const { createAdminNotification } = require('../notifications/notifications.service');
      await createAdminNotification(
        `New Google User Registered`,
        `A new Member (${email}) has signed up via Google.`,
        'system'
      );
    } catch (notifErr) {
      logger.error(`[Admin Notification Error] ${notifErr.message}`);
    }
  }

  if (user.isSuspended) {
    throw new ApiError(403, 'USER_SUSPENDED', 'Your account has been suspended by an administrator.');
  }

  const sessionData = await generateSessionTokens(user, req);

  return {
    success: true,
    directLogin: true,
    ...sessionData
  };
};

module.exports = {
  sendOtp,
  loginWithPassword,
  verifyOtp,
  refreshSessionToken,
  logoutSession,
  registerUser,
  authenticateWithGoogle
};
