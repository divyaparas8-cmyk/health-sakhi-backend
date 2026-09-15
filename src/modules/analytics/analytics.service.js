const prisma = require('../../config/database');

/**
 * 1. Dashboard Analytics Summary
 */
const getDashboardAnalytics = async () => {
  // Count users
  const totalUsers = await prisma.user.count({ where: { deletedAt: null } });
  const activeMembers = await prisma.user.count({
    where: {
      deletedAt: null,
      isApproved: true,
      isSuspended: false,
      role: { name: { in: ['Member', 'member'] } }
    }
  });

  // Count active advisors
  const approvedAdvisors = await prisma.advisor.count({
    where: { status: 'approved', deletedAt: null }
  });

  // Active paid subscriptions
  const activeSubs = await prisma.memberSubscription.count({
    where: {
      status: 'ACTIVE',
      deletedAt: null,
      plan: {
        price: { gt: 0 }
      }
    }
  });

  // Revenue Summary (PAID invoices)
  const invoices = await prisma.invoice.findMany({
    where: { status: 'PAID' },
    select: { amount: true }
  });
  const totalRevenue = invoices.reduce((acc, curr) => acc + Number(curr.amount), 0);

  // System usage
  const totalAiChats = await prisma.aIChatMessage.count();
  const totalBookings = await prisma.appointment.count();

  return {
    success: true,
    summary: {
      total_users: totalUsers,
      active_members: activeMembers,
      approved_advisors: approvedAdvisors,
      active_subscriptions: activeSubs,
      total_revenue: totalRevenue,
      system_usage: {
        total_ai_chats: totalAiChats,
        total_bookings: totalBookings
      }
    }
  };
};

/**
 * 2. Revenue Analytics
 */
const getRevenueAnalytics = async (startDate, endDate) => {
  const where = { status: 'PAID' };
  if (startDate || endDate) {
    where.paidAt = {};
    if (startDate) where.paidAt.gte = new Date(startDate);
    if (endDate) where.paidAt.lte = new Date(endDate);
  }

  // Get paid invoices
  const paidInvoices = await prisma.invoice.findMany({
    where,
    include: {
      user: {
        include: { profile: true }
      },
      subscription: {
        include: { plan: true }
      }
    },
    orderBy: { paidAt: 'desc' }
  });

  // Aggregate sums
  const totalRevenue = paidInvoices.reduce((acc, curr) => acc + Number(curr.amount), 0);

  // Revenue breakdown by Plan Type
  const planRevenueBreakdown = {};
  paidInvoices.forEach(inv => {
    const planName = inv.subscription?.plan?.name || 'Unknown Plan';
    planRevenueBreakdown[planName] = (planRevenueBreakdown[planName] || 0) + Number(inv.amount);
  });

  // Count of active subscriptions by plan
  const activeSubsByPlan = await prisma.memberSubscription.groupBy({
    by: ['planId'],
    where: { status: 'ACTIVE', deletedAt: null },
    _count: { _all: true }
  });

  // Resolve plan names
  const planCounts = [];
  for (const item of activeSubsByPlan) {
    const plan = await prisma.plan.findUnique({ where: { id: item.planId } });
    planCounts.push({
      plan_name: plan ? plan.name : 'Unknown Plan',
      count: item._count._all
    });
  }

  // Pending Payouts Sum
  const totalPendingPayouts = 0;

  return {
    success: true,
    revenue: {
      total_paid_revenue: totalRevenue,
      total_pending_payouts: totalPendingPayouts,
      plan_revenue_breakdown: planRevenueBreakdown,
      active_subscriptions_breakdown: planCounts,
      transactions: paidInvoices.map(inv => ({
        invoice_id: inv.id,
        invoice_number: inv.invoiceNumber,
        amount: Number(inv.amount),
        paid_at: inv.paidAt,
        user: {
          email: inv.user.email,
          full_name: inv.user.profile?.fullName || 'Anonymous'
        },
        plan: inv.subscription?.plan?.name || 'N/A'
      }))
    }
  };
};

/**
 * 3. User Analytics & Cohort Metrics
 */
const getUserAnalytics = async () => {
  // Distribution by Role
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    include: { role: true }
  });

  const roleDistribution = {};
  users.forEach(u => {
    const roleName = u.role.name;
    roleDistribution[roleName] = (roleDistribution[roleName] || 0) + 1;
  });

  // Approved vs Suspended — members only (exclude admin/advisor roles)
  const memberUsers = users.filter(u => u.role && ['member', 'Member'].includes(u.role.name));
  const suspendedCount = memberUsers.filter(u => u.isSuspended).length;
  const pendingCount = memberUsers.filter(u => !u.isApproved).length;
  const activeCount = memberUsers.filter(u => u.isApproved && !u.isSuspended).length;

  // Profiles health metrics
  const profiles = await prisma.userProfile.findMany({
    where: { deletedAt: null },
    select: { streakCount: true, wellnessScore: true }
  });

  const avgStreak = profiles.length > 0
    ? profiles.reduce((acc, curr) => acc + curr.streakCount, 0) / profiles.length
    : 0;

  const avgWellnessScore = profiles.length > 0
    ? profiles.reduce((acc, curr) => acc + curr.wellnessScore, 0) / profiles.length
    : 0;

  return {
    success: true,
    user_metrics: {
      role_distribution: roleDistribution,
      status_distribution: {
        active: activeCount,
        pending_approval: pendingCount,
        suspended: suspendedCount
      },
      engagement: {
        average_streak: Math.round(avgStreak * 10) / 10,
        average_wellness_score: Math.round(avgWellnessScore * 10) / 10
      }
    }
  };
};

/**
 * 4. Content Analytics
 */
const getContentAnalytics = async () => {
  // 1. Book progress stats
  const bookProgressCount = await prisma.bookProgress.groupBy({
    by: ['bookId'],
    _count: { _all: true }
  });

  const popularBooks = [];
  for (const item of bookProgressCount) {
    const book = await prisma.book.findUnique({ where: { id: item.bookId } });
    if (book) {
      popularBooks.push({
        id: book.id,
        title: book.title,
        author: book.author,
        readers_count: item._count._all
      });
    }
  }
  popularBooks.sort((a, b) => b.readers_count - a.readers_count);

  // 2. Video progress stats
  const videoProgressCount = await prisma.videoProgress.groupBy({
    by: ['videoId'],
    _count: { _all: true }
  });

  const popularVideos = [];
  for (const item of videoProgressCount) {
    const video = await prisma.video.findUnique({ where: { id: item.videoId } });
    if (video) {
      popularVideos.push({
        id: video.id,
        title: video.title,
        playlist: video.playlistName,
        viewers_count: item._count._all
      });
    }
  }
  popularVideos.sort((a, b) => b.viewers_count - a.viewers_count);

  // 3. Mood tracking logs analysis (mental health indicator trends)
  const moodDistribution = await prisma.moodLog.groupBy({
    by: ['moodType'],
    _count: { _all: true }
  });

  return {
    success: true,
    content_metrics: {
      popular_books: popularBooks.slice(0, 10),
      popular_videos: popularVideos.slice(0, 10),
      mood_logs_distribution: moodDistribution.map(m => ({
        mood: m.moodType,
        count: m._count._all
      }))
    }
  };
};

/**
 * 5. Track Custom Client Event
 */
const trackEvent = async (userId, eventName, eventData, ipAddress) => {
  await prisma.analyticsEvent.create({
    data: {
      userId: userId || null,
      eventName,
      eventData: eventData || null,
      ipAddress: ipAddress || null
    }
  });

  return { success: true };
};

module.exports = {
  getDashboardAnalytics,
  getRevenueAnalytics,
  getUserAnalytics,
  getContentAnalytics,
  trackEvent
};
