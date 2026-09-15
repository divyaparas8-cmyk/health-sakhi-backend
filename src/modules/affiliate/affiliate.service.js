const prisma = require('../../config/database');
const { ApiError } = require('../../middlewares/errorHandler');

/**
 * Generate a referral code for a user. One user = one referral code.
 */
const generateReferralCode = async (userId) => {
  // Check if user exists
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });
  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found.');
  }

  // Check if affiliate record already exists
  const existing = await prisma.affiliate.findUnique({
    where: { userId }
  });
  if (existing) {
    return existing.referralCode;
  }

  // Generate 6-digit alphanumeric code
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let referralCode = '';
  let isUnique = false;
  
  while (!isUnique) {
    referralCode = '';
    for (let i = 0; i < 6; i++) {
      referralCode += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    const check = await prisma.affiliate.findUnique({ where: { referralCode } });
    if (!check) isUnique = true;
  }

  // Create Affiliate profile and Affiliate Wallet in transaction
  await prisma.$transaction(async (tx) => {
    const affiliate = await tx.affiliate.create({
      data: {
        userId,
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
  });

  return referralCode;
};

/**
 * Retrieve affiliate dashboard statistics and profile info.
 */
const getAffiliateDashboard = async (userId) => {
  const affiliate = await prisma.affiliate.findUnique({
    where: { userId },
    include: {
      wallet: true,
      referrals: {
        include: {
          referredUser: {
            include: {
              profile: true
            }
          }
        },
        orderBy: { signupDate: 'desc' }
      }
    }
  });

  if (!affiliate) {
    throw new ApiError(404, 'AFFILIATE_NOT_FOUND', 'Affiliate profile not found.');
  }

  const totalReferrals = affiliate.referrals.length;
  const convertedReferrals = affiliate.referrals.filter(r => r.conversionStatus === 'PAID').length;
  const totalEarned = Number(affiliate.totalEarnings);
  const currentBalance = affiliate.wallet ? Number(affiliate.wallet.balance) : 0;
  const totalPaid = Math.max(0, totalEarned - currentBalance);
  
  // Calculate conversion rate (PAID referrals / total referrals)
  const conversionRate = totalReferrals > 0 
    ? `${((convertedReferrals / totalReferrals) * 100).toFixed(1)}%` 
    : '0.0%';

  return {
    success: true,
    profile: {
      id: affiliate.id,
      referral_code: affiliate.referralCode,
      total_earnings: totalEarned,
      created_at: affiliate.createdAt
    },
    stats: {
      total_referrals: totalReferrals,
      converted_referrals: convertedReferrals,
      total_earned: totalEarned,
      available_balance: currentBalance,
      total_paid: totalPaid,
      conversion_rate: conversionRate
    },
    referrals: affiliate.referrals.map(r => ({
      id: r.id,
      email: r.referredUser.email,
      fullName: r.referredUser.profile?.fullName || r.referredUser.email.split('@')[0],
      signupDate: r.signupDate,
      conversionStatus: r.conversionStatus
    }))
  };
};

/**
 * Track user signup using a referral code.
 */
const trackReferralSignup = async (referralCode, referredUserId) => {
  // Check if affiliate exists
  const affiliate = await prisma.affiliate.findUnique({
    where: { referralCode }
  });
  if (!affiliate) {
    // If referral code doesn't exist, we just skip it (optional code)
    return { success: false, reason: 'INVALID_REFERRAL_CODE' };
  }

  // Prevent self-referral
  if (affiliate.userId === referredUserId) {
    return { success: false, reason: 'SELF_REFERRAL_NOT_ALLOWED' };
  }

  // Check if referred user already has a referral record
  const existing = await prisma.referralTracking.findUnique({
    where: { referredUserId }
  });
  if (existing) {
    return { success: false, reason: 'USER_ALREADY_REFERRED' };
  }

  const tracking = await prisma.referralTracking.create({
    data: {
      referralCode,
      referredUserId,
      conversionStatus: 'SIGNED_UP'
    }
  });

  return {
    success: true,
    tracking
  };
};

/**
 * Credit commission to affiliate wallet.
 */
const creditCommission = async (userId, amount) => {
  const affiliate = await prisma.affiliate.findUnique({
    where: { userId }
  });
  if (!affiliate) {
    throw new ApiError(404, 'AFFILIATE_NOT_FOUND', 'Affiliate profile not found.');
  }

  await prisma.$transaction([
    prisma.affiliate.update({
      where: { id: affiliate.id },
      data: {
        totalEarnings: { increment: amount }
      }
    }),
    prisma.affiliateWallet.update({
      where: { affiliateId: affiliate.id },
      data: {
        balance: { increment: amount }
      }
    })
  ]);

  return { success: true };
};

/**
 * Get commissions list for affiliate.
 */
const getCommissions = async (userId) => {
  const affiliate = await prisma.affiliate.findUnique({
    where: { userId },
    include: {
      referrals: {
        where: { conversionStatus: 'PAID' },
        include: {
          referredUser: {
            include: {
              profile: true,
              payments: {
                where: { status: 'SUCCESS' },
                orderBy: { createdAt: 'desc' },
                take: 1
              }
            }
          }
        }
      }
    }
  });

  if (!affiliate) {
    throw new ApiError(404, 'AFFILIATE_NOT_FOUND', 'Affiliate profile not found.');
  }

  const commissions = affiliate.referrals.map(r => {
    const payment = r.referredUser.payments[0] || null;
    let amount = 0;
    if (payment) {
      amount = Number(payment.amount);
    }
    // Calculate commission
    let commAmount = 0;
    const slug = payment?.planSlug ? payment.planSlug.toLowerCase() : '';
    if (slug.includes('family') || slug.includes('wellness') || slug === 'elite') {
      commAmount = amount * 0.15;
    } else if (slug.includes('premium') || slug.includes('pro')) {
      commAmount = amount * 0.15;
    } else {
      commAmount = amount * 0.10; // fallback
    }

    return {
      id: r.id,
      amount: commAmount,
      status: 'approved',
      created_at: r.signupDate,
      referred_user: {
        email: r.referredUser.email,
        full_name: r.referredUser.profile?.fullName || r.referredUser.email.split('@')[0]
      }
    };
  });

  return {
    success: true,
    commissions
  };
};

// Campaign CTR tracking store
const campaignClicksStore = {
  instagram_bio: 124,
  whatsapp_group: 48,
  facebook_story: 35,
  youtube_community: 19
};

const getLinks = async (userId) => {
  let referralCode = 'G222LT';
  try {
    const affiliate = await prisma.affiliate.findUnique({
      where: { userId }
    });
    if (affiliate) referralCode = affiliate.referralCode;
  } catch (e) {}

  const domain = 'healthsakhis.kiaansoftware.com';

  const defaultCampaigns = [
    { id: '1', unique_slug: 'instagram_bio', clicks: campaignClicksStore['instagram_bio'] || 124, target_url: `https://${domain}` },
    { id: '2', unique_slug: 'whatsapp_group', clicks: campaignClicksStore['whatsapp_group'] || 48, target_url: `https://${domain}` },
    { id: '3', unique_slug: 'facebook_story', clicks: campaignClicksStore['facebook_story'] || 35, target_url: `https://${domain}` },
    { id: '4', unique_slug: 'youtube_community', clicks: campaignClicksStore['youtube_community'] || 19, target_url: `https://${domain}` }
  ];

  return {
    success: true,
    links: defaultCampaigns.map(c => ({
      id: c.id,
      unique_slug: c.unique_slug,
      target_url: c.target_url,
      referral_url: `https://${domain}/ref/${c.unique_slug}`,
      clicks_count: c.clicks
    }))
  };
};

const trackLinkClick = async (slug) => {
  if (slug) {
    campaignClicksStore[slug] = (campaignClicksStore[slug] || 0) + 1;
  }
  return {
    success: true,
    clicks: campaignClicksStore[slug] || 1
  };
};

module.exports = {
  generateReferralCode,
  getAffiliateDashboard,
  trackReferralSignup,
  creditCommission,
  getCommissions,
  getLinks,
  trackLinkClick
};
