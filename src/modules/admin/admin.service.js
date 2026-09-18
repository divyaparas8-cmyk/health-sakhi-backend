const prisma = require('../../config/database');
const { ApiError } = require('../../middlewares/errorHandler');
const logger = require('../../utils/logger');
const crypto = require('crypto');

function hashString(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

/**
 * 1. Gather dashboard statistics
 */
const getDashboardStats = async () => {
  // Count Users by Status
  const totalUsers = await prisma.user.count({
    where: {
      deletedAt: null,
      role: {
        name: {
          notIn: ['Admin', 'admin']
        }
      }
    }
  });
  
  const pendingUsers = await prisma.user.count({
    where: { isApproved: false, isSuspended: false, deletedAt: null }
  });
  
  const activeUsers = await prisma.user.count({
    where: { isApproved: true, isSuspended: false, deletedAt: null }
  });
  
  const suspendedUsers = await prisma.user.count({
    where: { isSuspended: true, deletedAt: null }
  });

  // Count Advisors by Status
  const totalAdvisors = await prisma.advisor.count({ where: { deletedAt: null } });
  
  const pendingAdvisors = await prisma.advisor.count({
    where: { status: 'pending', deletedAt: null }
  });
  
  const approvedAdvisors = await prisma.advisor.count({
    where: { status: 'approved', deletedAt: null }
  });
  
  const suspendedAdvisors = await prisma.advisor.count({
    where: { status: 'suspended', deletedAt: null }
  });

  // Total active plans count
  const activePlansCount = await prisma.plan.count({
    where: { status: 'ACTIVE', deletedAt: null }
  });

  // Revenue trends (Sum of all PAID invoices)
  const paidInvoices = await prisma.invoice.aggregate({
    _sum: { amount: true },
    where: { status: 'PAID' }
  });
  const totalRevenue = paidInvoices._sum.amount ? Number(paidInvoices._sum.amount) : 0;

  // Recent audit logs
  const recentLogs = await prisma.auditLog.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: {
          email: true,
          profile: { select: { fullName: true } }
        }
      }
    }
  });

  // System usage metrics (AI tokens & Chat interactions)
  const totalAiMessages = await prisma.aIChatMessage.count().catch(() => 0);
  const totalChatLogs = await prisma.chatLog.count().catch(() => 0);
  const rawTokenCount = (totalAiMessages + totalChatLogs) * 45;
  const formattedTokens = rawTokenCount >= 1000 ? `${(rawTokenCount / 1000).toFixed(1)}k` : String(rawTokenCount);

  return {
    success: true,
    stats: {
      users: {
        total: totalUsers,
        pending: pendingUsers,
        active: activeUsers,
        suspended: suspendedUsers
      },
      advisors: {
        total: totalAdvisors,
        pending: pendingAdvisors,
        approved: approvedAdvisors,
        suspended: suspendedAdvisors
      },
      plans: {
        active: activePlansCount
      },
      financials: {
        totalRevenue
      },
      system: {
        platformUptime: '99.9%',
        dailyTokens: formattedTokens
      }
    },
    recentActivity: recentLogs.map(log => ({
      id: log.id,
      adminEmail: log.user.email,
      adminName: log.user.profile ? log.user.profile.fullName : 'Admin',
      action: log.action,
      targetTable: log.targetTable,
      targetId: log.targetId,
      createdAt: log.createdAt
    }))
  };
};

/**
 * 2. Get filtered user list (with pagination)
 */
const getUsers = async (filters) => {
  const page = parseInt(filters.page || '1', 10);
  const limit = parseInt(filters.limit || '10', 10);
  const skip = (page - 1) * limit;

  const whereClause = { deletedAt: null };

  // Apply search query (email or profile name)
  if (filters.search) {
    whereClause.OR = [
      { email: { contains: filters.search } },
      { profile: { fullName: { contains: filters.search } } }
    ];
  }

  // Apply role filter
  if (filters.role) {
    const capitalizedRole = filters.role.charAt(0).toUpperCase() + filters.role.slice(1).toLowerCase();
    whereClause.role = { name: capitalizedRole };
  }

  // Apply status filter: active, inactive/suspended
  if (filters.status) {
    const status = filters.status.toLowerCase();
    if (status === 'active') {
      whereClause.isApproved = true;
      whereClause.isSuspended = false;
    } else if (status === 'suspended' || status === 'inactive') {
      whereClause.isSuspended = true;
    }
  }

  const total = await prisma.user.count({ where: whereClause });
  const users = await prisma.user.findMany({
    where: whereClause,
    include: {
      role: true,
      profile: true,
      subscriptions: {
        where: { deletedAt: null },
        include: { plan: true },
        orderBy: { endsAt: 'desc' },
        take: 1
      },
      affiliate: true
    },
    skip,
    take: limit,
    orderBy: { createdAt: 'desc' }
  });

  const userIds = users.map(user => user.id);
  const progressRecords = await prisma.userContentProgress.findMany({
    where: {
      userId: { in: userIds },
      contentType: 'Book'
    }
  }).catch(() => []);

  return {
    success: true,
    users: users.map(user => {
      // Determine user status
      let status = 'active';
      if (user.isSuspended) status = 'inactive';

      const activeSub = user.subscriptions[0] || null;

      const userProgress = progressRecords
        .filter(p => p.userId === user.id)
        .map(p => ({
          contentId: p.contentId,
          position: p.position,
          completed: p.completed
        }));

      return {
        id: user.id,
        email: user.email,
        phone: user.phone,
        role: user.role.name,
        isApproved: user.isApproved,
        isSuspended: user.isSuspended,
        status,
        fullName: user.profile ? user.profile.fullName : null,
        streakCount: user.profile ? user.profile.streakCount : 0,
        wellnessScore: user.profile ? user.profile.wellnessScore : 0,
        activePlan: activeSub ? activeSub.plan.name : 'Free Sakhi',
        createdAt: user.createdAt,
        referralCode: user.affiliate ? user.affiliate.referralCode : null,
        totalEarnings: user.affiliate ? Number(user.affiliate.totalEarnings) : 0,
        bookProgress: userProgress
      };
    }),
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * 3. Retrieve user by ID
 */
const getUserById = async (id) => {
  const user = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    include: {
      role: true,
      profile: true,
      subscriptions: {
        where: { deletedAt: null },
        include: { plan: true },
        orderBy: { createdAt: 'desc' }
      },
      invoices: {
        orderBy: { createdAt: 'desc' }
      },
      planRequests: {
        include: { plan: true },
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found.');
  }

  let status = 'active';
  if (user.isSuspended) status = 'inactive';

  return {
    success: true,
    user: {
      id: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role.name,
      isApproved: user.isApproved,
      isSuspended: user.isSuspended,
      status,
      profile: user.profile,
      subscriptions: user.subscriptions,
      invoices: user.invoices,
      planRequests: user.planRequests,
      createdAt: user.createdAt
    }
  };
};

/**
 * 4. Update general user details
 */
const updateUser = async (id, data, adminId) => {
  const user = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    include: { profile: true, subscriptions: { where: { deletedAt: null }, orderBy: { endsAt: 'desc' }, take: 1 } }
  });

  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found.');
  }

  const oldValues = { isApproved: user.isApproved, isSuspended: user.isSuspended };
  const updateData = {};

  // Map status string to boolean fields
  if (data.status !== undefined) {
    const s = (data.status || '').toLowerCase();
    if (s === 'active') { updateData.isApproved = true; updateData.isSuspended = false; }
    else if (s === 'suspended' || s === 'inactive') { updateData.isSuspended = true; updateData.isApproved = true; }
  }
  if (data.isApproved !== undefined) updateData.isApproved = data.isApproved;
  if (data.isSuspended !== undefined) updateData.isSuspended = data.isSuspended;

  // Perform transaction updates
  const updatedUser = await prisma.$transaction(async (tx) => {
    // Update main user fields
    const updated = await tx.user.update({
      where: { id },
      data: updateData,
      include: { profile: true }
    });

    // Update profile fields
    if (updated.profile && (data.fullName !== undefined || data.bio !== undefined)) {
      const profileData = {};
      if (data.fullName !== undefined) profileData.fullName = data.fullName;
      if (data.bio !== undefined) profileData.bio = data.bio;

      await tx.userProfile.update({
        where: { id: updated.profile.id },
        data: profileData
      });
    }

    // Handle subscription plan change if planSlug is provided
    if (data.planSlug) {
      const plan = await tx.plan.findFirst({ where: { slug: data.planSlug, deletedAt: null } });
      if (!plan) throw new ApiError(404, 'PLAN_NOT_FOUND', 'Plan not found.');
      
      // Cancel all existing active subscriptions for this user
      await tx.memberSubscription.updateMany({
        where: { userId: id, status: 'ACTIVE' },
        data: { status: 'CANCELLED' }
      });
      
      // Create new active subscription (30 days)
      const startsAt = new Date();
      const endsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await tx.memberSubscription.create({
        data: {
          userId: id,
          planId: plan.id,
          status: 'ACTIVE',
          startsAt,
          endsAt,
          autoRenew: true
        }
      });
    }

    // Write audit log entry
    await tx.auditLog.create({
      data: {
        userId: adminId,
        action: 'USER_UPDATE',
        targetTable: 'users',
        targetId: id,
        changes: {
          before: oldValues,
          after: data
        }
      }
    });

    return tx.user.findUnique({
      where: { id },
      include: { role: true, profile: true }
    });
  });

  return {
    success: true,
    message: 'User details updated successfully.',
    user: updatedUser
  };
};

/**
 * 5. Toggle user account suspension
 */
const suspendUser = async (id, suspend, reason, adminId) => {
  const user = await prisma.user.findFirst({
    where: { id, deletedAt: null }
  });

  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found.');
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: { isSuspended: suspend }
    });

    await tx.auditLog.create({
      data: {
        userId: adminId,
        action: suspend ? 'USER_SUSPEND' : 'USER_UNSUSPEND',
        targetTable: 'users',
        targetId: id,
        changes: {
          isSuspended: suspend,
          reason: reason || 'N/A'
        }
      }
    });
  });

  return {
    success: true,
    message: suspend ? 'User account has been suspended.' : 'User account has been unsuspended.'
  };
};

/**
 * 5b. Permanent delete user account (Soft delete)
 */
const deleteUser = async (id, adminId) => {
  const user = await prisma.user.findFirst({
    where: { id, deletedAt: null }
  });

  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found.');
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: { deletedAt: new Date() }
    });

    await tx.auditLog.create({
      data: {
        userId: adminId,
        action: 'USER_DELETE',
        targetTable: 'users',
        targetId: id,
        changes: {
          email: user.email,
          phone: user.phone
        }
      }
    });
  });

  return {
    success: true,
    message: 'User account permanently deleted.'
  };
};

/**
 * 6. Retrieve advisors list
 */
const getAdvisors = async (filters) => {
  const page = parseInt(filters.page || '1', 10);
  const limit = parseInt(filters.limit || '10', 10);
  const skip = (page - 1) * limit;

  const whereClause = { deletedAt: null };

  if (filters.status) {
    whereClause.status = filters.status;
  }

  if (filters.search) {
    whereClause.OR = [
      { qualification: { contains: filters.search } },
      { user: { email: { contains: filters.search } } },
      { user: { profile: { fullName: { contains: filters.search } } } }
    ];
  }

  const total = await prisma.advisor.count({ where: whereClause });
  const advisors = await prisma.advisor.findMany({
    where: whereClause,
    include: {
      user: {
        include: { profile: true }
      }
    },
    skip,
    take: limit,
    orderBy: { createdAt: 'desc' }
  });

  return {
    success: true,
    advisors: advisors.map(adv => ({
      id: adv.id,
      userId: adv.userId,
      email: adv.user.email,
      fullName: adv.user.profile ? adv.user.profile.fullName : 'Advisor User',
      qualification: adv.qualification,
      bio: adv.bio,
      photoUrl: adv.photoUrl,
      status: adv.status,
      hourlyRate: Number(adv.hourlyRate),
      rating: Number(adv.rating),
      totalReviews: adv.totalReviews,
      createdAt: adv.createdAt
    })),
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * 7. Approve or change advisor status
 */
const updateAdvisorStatus = async (id, status, adminId) => {
  const advisor = await prisma.advisor.findFirst({
    where: { id, deletedAt: null },
    include: { user: true }
  });

  if (!advisor) {
    throw new ApiError(404, 'ADVISOR_NOT_FOUND', 'Advisor profile not found.');
  }

  const updatedAdvisor = await prisma.$transaction(async (tx) => {
    const updated = await tx.advisor.update({
      where: { id },
      data: { status }
    });

    // If advisor is approved, automatically verify user approval scope
    if (status === 'approved' && !advisor.user.isApproved) {
      await tx.user.update({
        where: { id: advisor.userId },
        data: { isApproved: true }
      });
    }

    await tx.auditLog.create({
      data: {
        userId: adminId,
        action: 'ADVISOR_STATUS_UPDATE',
        targetTable: 'advisors',
        targetId: id,
        changes: { status }
      }
    });

    return updated;
  });

  return {
    success: true,
    message: `Advisor status updated to ${status}.`,
    advisor: updatedAdvisor
  };
};

/**
 * 8. Edit advisor profile details
 */
const updateAdvisor = async (id, data, adminId) => {
  const advisor = await prisma.advisor.findFirst({
    where: { id, deletedAt: null }
  });

  if (!advisor) {
    throw new ApiError(404, 'ADVISOR_NOT_FOUND', 'Advisor profile not found.');
  }

  const updateData = {};
  if (data.qualification !== undefined) updateData.qualification = data.qualification;
  if (data.hourlyRate !== undefined) updateData.hourlyRate = data.hourlyRate;
  if (data.bio !== undefined) updateData.bio = data.bio;

  const updated = await prisma.$transaction(async (tx) => {
    const adv = await tx.advisor.update({
      where: { id },
      data: updateData
    });

    await tx.auditLog.create({
      data: {
        userId: adminId,
        action: 'ADVISOR_UPDATE',
        targetTable: 'advisors',
        targetId: id,
        changes: data
      }
    });

    return adv;
  });

  return {
    success: true,
    message: 'Advisor profile details updated successfully.',
    advisor: updated
  };
};

/**
 * 9. Get Plan Listing
 */
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
      status: p.status,
      maxAiChatsPerDay: p.maxAiChatsPerDay,
      advisorCredits: p.advisorCredits,
      features: p.features.map(f => ({
        id: f.id,
        name: f.featureName,
        value: f.featureValue
      }))
    }))
  };
};

/**
 * 10. Create new membership Plan
 */
const createPlan = async (data, adminId) => {
  const existing = await prisma.plan.findFirst({
    where: { slug: data.slug, deletedAt: null }
  });

  if (existing) {
    throw new ApiError(400, 'PLAN_EXISTS', `Plan with slug '${data.slug}' already exists.`);
  }

  const newPlan = await prisma.$transaction(async (tx) => {
    const plan = await tx.plan.create({
      data: {
        name: data.name,
        slug: data.slug,
        price: data.price,
        originalPrice: data.originalPrice,
        interval: data.interval,
        status: data.status || 'ACTIVE',
        maxAiChatsPerDay: data.maxAiChatsPerDay !== undefined ? data.maxAiChatsPerDay : 5,
        advisorCredits: data.advisorCredits !== undefined ? data.advisorCredits : 0
      }
    });

    if (data.features && data.features.length > 0) {
      await tx.planFeature.createMany({
        data: data.features.map(f => ({
          planId: plan.id,
          featureName: f.featureName,
          featureValue: f.featureValue
        }))
      });
    }

    await tx.auditLog.create({
      data: {
        userId: adminId,
        action: 'PLAN_CREATE',
        targetTable: 'plans',
        targetId: plan.id,
        changes: data
      }
    });

    return tx.plan.findUnique({
      where: { id: plan.id },
      include: { features: true }
    });
  });

  return {
    success: true,
    message: 'Membership plan created successfully.',
    plan: newPlan
  };
};

/**
 * 11. Update plan specifications
 */
const updatePlan = async (id, data, adminId) => {
  const plan = await prisma.plan.findFirst({
    where: { id, deletedAt: null }
  });

  if (!plan) {
    throw new ApiError(404, 'PLAN_NOT_FOUND', 'Membership plan not found.');
  }

  const updateData = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.slug !== undefined) updateData.slug = data.slug;
  if (data.price !== undefined) updateData.price = data.price;
  if (data.originalPrice !== undefined) updateData.originalPrice = data.originalPrice;
  if (data.interval !== undefined) updateData.interval = data.interval;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.maxAiChatsPerDay !== undefined) updateData.maxAiChatsPerDay = data.maxAiChatsPerDay;
  if (data.advisorCredits !== undefined) updateData.advisorCredits = data.advisorCredits;

  const updatedPlan = await prisma.$transaction(async (tx) => {
    const updated = await tx.plan.update({
      where: { id },
      data: updateData
    });

    // If features are supplied, delete and recreate
    if (data.features) {
      await tx.planFeature.deleteMany({ where: { planId: id } });
      if (data.features.length > 0) {
        await tx.planFeature.createMany({
          data: data.features.map(f => ({
            planId: id,
            featureName: f.featureName,
            featureValue: f.featureValue
          }))
        });
      }
    }

    await tx.auditLog.create({
      data: {
        userId: adminId,
        action: 'PLAN_UPDATE',
        targetTable: 'plans',
        targetId: id,
        changes: data
      }
    });

    return tx.plan.findUnique({
      where: { id },
      include: { features: true }
    });
  });

  return {
    success: true,
    message: 'Membership plan updated successfully.',
    plan: updatedPlan
  };
};

/**
 * 12. Soft delete membership Plan
 */
const deletePlan = async (id, adminId) => {
  const plan = await prisma.plan.findFirst({
    where: { id, deletedAt: null }
  });

  if (!plan) {
    throw new ApiError(404, 'PLAN_NOT_FOUND', 'Membership plan not found.');
  }

  await prisma.$transaction(async (tx) => {
    await tx.plan.update({
      where: { id },
      data: { deletedAt: new Date() }
    });

    await tx.auditLog.create({
      data: {
        userId: adminId,
        action: 'PLAN_DELETE',
        targetTable: 'plans',
        targetId: id,
        changes: { slug: plan.slug }
      }
    });
  });

  return {
    success: true,
    message: 'Membership plan deleted (archived) successfully.'
  };
};

/**
 * 13. Fetch Member Approvals Queue
 */
const getApprovalsQueue = async () => {
  // Awaiting manual registration approvals (Member role, isApproved false, active account)
  const pendingMembers = await prisma.user.findMany({
    where: {
      role: { name: 'Member' },
      isApproved: false,
      isSuspended: false,
      deletedAt: null
    },
    include: {
      profile: true,
      planRequests: {
        where: { status: 'PENDING' },
        include: { plan: true }
      }
    },
    orderBy: { createdAt: 'asc' }
  });

  return {
    success: true,
    queue: pendingMembers.map(user => {
      const pendingRequest = user.planRequests[0] || null;
      return {
        userId: user.id,
        email: user.email,
        fullName: user.profile ? user.profile.fullName : 'New Member',
        requestedPlan: pendingRequest ? pendingRequest.plan.name : 'Free Sakhi',
        requestedPlanSlug: pendingRequest ? pendingRequest.plan.slug : 'free-sakhi',
        notes: pendingRequest ? pendingRequest.notes : 'Standard registration',
        createdAt: user.createdAt
      };
    })
  };
};

/**
 * 14. Approve Member registration request
 */
const approveMember = async (id, notes, adminId) => {
  const user = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    include: {
      planRequests: { where: { status: 'PENDING' } }
    }
  });

  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found.');
  }

  if (user.isApproved) {
    throw new ApiError(400, 'ALREADY_APPROVED', 'User account is already active and approved.');
  }

  await prisma.$transaction(async (tx) => {
    // Approve User
    await tx.user.update({
      where: { id },
      data: { isApproved: true }
    });

    // Check if there is an active pending plan request
    const pendingRequest = user.planRequests[0];
    let selectedPlanSlug = 'free-sakhi';
    let selectedPlanId = null;

    if (pendingRequest) {
      // Approve the requested plan request
      await tx.memberPlanRequest.update({
        where: { id: pendingRequest.id },
        data: {
          status: 'APPROVED',
          reviewedBy: adminId,
          reviewedAt: new Date()
        }
      });
      selectedPlanId = pendingRequest.requestedPlanId;
    } else {
      // Default to Free Sakhi plan
      const defaultPlan = await tx.plan.findFirst({
        where: { slug: 'free-sakhi', deletedAt: null }
      });
      if (defaultPlan) {
        selectedPlanId = defaultPlan.id;
        selectedPlanSlug = defaultPlan.slug;
      }
    }

    // Provision subscription if plan is mapped
    if (selectedPlanId) {
      const startsAt = new Date();
      const endsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days subscription

      const sub = await tx.memberSubscription.create({
        data: {
          userId: id,
          planId: selectedPlanId,
          status: 'ACTIVE',
          startsAt,
          endsAt,
          autoRenew: true
        }
      });

      // Find the plan pricing detail
      const planDetails = await tx.plan.findUnique({ where: { id: selectedPlanId } });
      const priceVal = Number(planDetails.price);

      // Issue invoice matching subscription
      const invoiceNumber = `INV-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
      await tx.invoice.create({
        data: {
          userId: id,
          subscriptionId: sub.id,
          invoiceNumber,
          amount: priceVal,
          tax: priceVal * 0.18, // 18% tax
          status: priceVal > 0 ? 'UNPAID' : 'PAID', // Paid if free, unpaid if premium (paid online later)
          dueDate: endsAt,
          paidAt: priceVal > 0 ? null : new Date()
        }
      });
    }

    // Write audit log entry
    await tx.auditLog.create({
      data: {
        userId: adminId,
        action: 'USER_APPROVE',
        targetTable: 'users',
        targetId: id,
        changes: {
          notes: notes || 'N/A',
          planSlug: selectedPlanSlug
        }
      }
    });
  });

  return {
    success: true,
    message: 'User verified successfully. Sign-in access unlocked.'
  };
};

/**
 * 15. Reject Member registration request
 */
const rejectMember = async (id, notes, adminId) => {
  const user = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    include: {
      planRequests: { where: { status: 'PENDING' } }
    }
  });

  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found.');
  }

  await prisma.$transaction(async (tx) => {
    // If pending request exists, mark as REJECTED
    const pendingRequest = user.planRequests[0];
    if (pendingRequest) {
      await tx.memberPlanRequest.update({
        where: { id: pendingRequest.id },
        data: {
          status: 'REJECTED',
          reviewedBy: adminId,
          reviewedAt: new Date(),
          notes: notes || 'Rejected by Admin'
        }
      });
    }

    // Soft-delete the user to remove them from the approvals queue and system
    await tx.user.update({
      where: { id },
      data: { deletedAt: new Date() }
    });

    // Create Audit Log
    await tx.auditLog.create({
      data: {
        userId: adminId,
        action: 'USER_REJECT',
        targetTable: 'users',
        targetId: id,
        changes: {
          notes: notes || 'N/A'
        }
      }
    });
  });

  return {
    success: true,
    message: 'User registration request rejected.'
  };
};

/**
 * 16. Onboard a new member directly from admin
 */
const createUser = async (data, adminId) => {
  const existing = await prisma.user.findFirst({
    where: { email: data.email, deletedAt: null }
  });

  if (existing) {
    throw new ApiError(400, 'USER_EXISTS', 'User with this email is already registered.');
  }

  const targetRole = data.role === 'Affiliate' || data.role === 'affiliate' ? 'Affiliate' : 'Member';
  const role = await prisma.role.findUnique({
    where: { name: targetRole }
  });

  if (!role) {
    throw new ApiError(500, 'ROLE_NOT_FOUND', `${targetRole} role not found in database.`);
  }

  const createdUser = await prisma.$transaction(async (tx) => {
    const userPayload = {
      email: data.email,
      roleId: role.id,
      isApproved: true,
      isSuspended: false,
      profile: {
        create: {
          fullName: data.fullName,
          streakCount: 0,
          wellnessScore: 0,
          lastActiveDate: new Date()
        }
      }
    };

    if (data.password) {
      userPayload.passwordHash = hashString(data.password);
    }

    const user = await tx.user.create({
      data: userPayload,
      include: { profile: true }
    });

    if (targetRole === 'Affiliate') {
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

    let planSlug = data.planSlug;
    if (!planSlug) {
      if (data.plan) {
        if (data.plan.includes('Premium')) planSlug = 'premium-pro';
        else if (data.plan.includes('Connect')) planSlug = 'elite';
        else planSlug = 'free-sakhi';
      } else {
        planSlug = 'free-sakhi';
      }
    }

    const plan = await tx.plan.findFirst({
      where: { slug: planSlug, deletedAt: null }
    });

    if (plan) {
      const startsAt = new Date();
      const endsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const isFree = Number(plan.price) === 0;

      const subStatus = isFree ? 'ACTIVE' : 'PENDING';
      const invoiceStatus = isFree ? 'PAID' : 'UNPAID';

      const sub = await tx.memberSubscription.create({
        data: {
          userId: user.id,
          planId: plan.id,
          status: subStatus,
          startsAt,
          endsAt,
          autoRenew: true
        }
      });

      const invoiceNumber = `INV-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
      await tx.invoice.create({
        data: {
          userId: user.id,
          subscriptionId: sub.id,
          invoiceNumber,
          amount: plan.price,
          tax: Number(plan.price) * 0.18,
          status: invoiceStatus,
          dueDate: endsAt,
          paidAt: isFree ? new Date() : null
        }
      });
    }

    await tx.auditLog.create({
      data: {
        userId: adminId,
        action: 'USER_CREATE',
        targetTable: 'users',
        targetId: user.id,
        changes: {
          email: data.email,
          fullName: data.fullName,
          planSlug
        }
      }
    });

    return user;
  });

  return {
    success: true,
    message: 'New member onboarded successfully.',
    user: createdUser
  };
};

/**
 * 17. Recruit a new Advisor directly from admin
 */
const createAdvisor = async (data, adminId) => {
  const existing = await prisma.user.findFirst({
    where: { email: data.email, deletedAt: null }
  });

  if (existing) {
    throw new ApiError(400, 'USER_EXISTS', 'User with this email is already registered.');
  }

  const role = await prisma.role.findUnique({
    where: { name: 'Advisor' }
  });

  if (!role) {
    throw new ApiError(500, 'ROLE_NOT_FOUND', 'Advisor role not found in database.');
  }

  const result = await prisma.$transaction(async (tx) => {
    const userPayload = {
      email: data.email,
      roleId: role.id,
      isApproved: true,
      isSuspended: false,
      profile: {
        create: {
          fullName: data.name,
          streakCount: 0,
          wellnessScore: 0
        }
      }
    };

    if (data.password) {
      userPayload.passwordHash = hashString(data.password);
    }

    const user = await tx.user.create({
      data: userPayload
    });

    const status = data.status === 'Review' ? 'pending' : (data.status.toLowerCase() === 'approved' ? 'approved' : 'pending');

    const advisor = await tx.advisor.create({
      data: {
        userId: user.id,
        qualification: data.specialty,
        bio: `${data.name} is a certified specialist in ${data.specialty}.`,
        status: status,
        hourlyRate: 500.00,
        rating: 5.0,
        totalReviews: 0
      }
    });

    await tx.auditLog.create({
      data: {
        userId: adminId,
        action: 'ADVISOR_CREATE',
        targetTable: 'advisors',
        targetId: advisor.id,
        changes: {
          email: data.email,
          fullName: data.name,
          specialty: data.specialty,
          status
        }
      }
    });

    return {
      id: advisor.id,
      userId: user.id,
      email: user.email,
      fullName: data.name,
      qualification: advisor.qualification,
      status: advisor.status,
      createdAt: advisor.createdAt
    };
  });

  return {
    success: true,
    message: 'Advisor recruited successfully.',
    advisor: result
  };
};

/**
 * 18. Retrieve all invoices
 */
const getInvoices = async () => {
  const invoices = await prisma.invoice.findMany({
    include: {
      user: {
        include: {
          profile: true,
          referredBy: true
        }
      },
      subscription: {
        include: { plan: true }
      }
    }
  });

  return {
    success: true,
    invoices: invoices.map(inv => {
      const planName = inv.subscription?.plan?.name || 'Manual Plan';
      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        user: inv.user.profile?.fullName || inv.user.email,
        email: inv.user.email,
        plan: planName,
        amount: `₹${Number(inv.amount).toFixed(2)}`,
        status: inv.status === 'PAID' ? 'Success' : inv.status === 'UNPAID' ? 'Pending' : inv.status === 'VOID' ? 'Failed' : inv.status,
        date: inv.createdAt,
        method: inv.subscription ? 'Online' : 'Manual',
        gst: `₹${Number(inv.tax).toFixed(2)}`,
        isReferred: !!inv.user.referredBy,
        referralCode: inv.user.referredBy?.referralCode || null
      };
    })
  };
};

const getPayouts = async () => {
  const payouts = await prisma.advisorEarnings.findMany({
    include: {
      advisor: {
        include: {
          user: {
            include: { profile: true }
          }
        }
      },
      appointment: true
    },
    orderBy: { createdAt: 'desc' }
  });

  return {
    success: true,
    payouts: payouts.map(p => ({
      id: p.id,
      advisorId: p.advisorId,
      advisorName: p.advisor.user.profile ? p.advisor.user.profile.fullName : 'Expert Advisor',
      advisorEmail: p.advisor.user.email,
      specialty: p.advisor.qualification,
      amount: Number(p.amount),
      commission: Number(p.commission),
      payoutStatus: p.payoutStatus,
      payoutDate: p.payoutDate,
      createdAt: p.createdAt,
      appointmentId: p.appointmentId,
      appointmentDate: p.appointment.date
    }))
  };
};

const getAffiliateReferrals = async () => {
  const referrals = await prisma.referralTracking.findMany({
    include: {
      affiliate: {
        include: {
          user: {
            include: { profile: true }
          }
        }
      },
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
    },
    orderBy: { signupDate: 'desc' }
  });

  return {
    success: true,
    referrals: referrals.map(r => {
      const payment = r.referredUser.payments[0] || null;
      const amount = payment ? Number(payment.amount) : 0;
      let commAmount = 0;
      if (payment) {
        const slug = payment.planSlug ? payment.planSlug.toLowerCase() : '';
        if (slug.includes('family') || slug.includes('wellness') || slug === 'elite') {
          commAmount = amount * 0.15;
        } else {
          commAmount = amount * 0.10;
        }
      }
      return {
        id: r.id,
        referrerName: r.affiliate.user.profile?.fullName || r.affiliate.user.email,
        referrerEmail: r.affiliate.user.email,
        referredName: r.referredUser.profile?.fullName || r.referredUser.email,
        referredEmail: r.referredUser.email,
        conversionStatus: r.conversionStatus,
        signupDate: r.signupDate,
        amount: amount,
        commission: commAmount
      };
    })
  };
};
/**
 * 19. Create manual invoice
 */
const createInvoice = async (data, adminId) => {
  const { userId, planId, amount, status } = data;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      subscriptions: {
        where: { status: 'ACTIVE', deletedAt: null },
        take: 1
      }
    }
  });

  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found.');
  }

  let subscriptionId = user.subscriptions[0]?.id || null;

  if (planId) {
    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) {
      throw new ApiError(404, 'PLAN_NOT_FOUND', 'Selected plan not found.');
    }

    if (!subscriptionId || user.subscriptions[0]?.planId !== planId) {
      // Cancel previous active subscriptions
      await prisma.memberSubscription.updateMany({
        where: { userId, status: 'ACTIVE' },
        data: { status: 'CANCELLED' }
      });

      const startsAt = new Date();
      const endsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const newSub = await prisma.memberSubscription.create({
        data: {
          userId,
          planId: plan.id,
          status: status === 'PAID' ? 'ACTIVE' : 'PENDING',
          startsAt,
          endsAt,
          autoRenew: true
        }
      });
      subscriptionId = newSub.id;
    }
  }

  const invoiceNumber = `INV-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
  const baseAmount = Number(amount || 0);
  const gstAmount = baseAmount * 0.18;

  const invoice = await prisma.invoice.create({
    data: {
      userId,
      subscriptionId,
      invoiceNumber,
      amount: baseAmount,
      tax: gstAmount,
      status: status || 'UNPAID',
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      paidAt: status === 'PAID' ? new Date() : null
    }
  });

  await prisma.auditLog.create({
    data: {
      userId: adminId,
      action: 'INVOICE_CREATE',
      targetTable: 'invoices',
      targetId: invoice.id,
      changes: {
        invoiceNumber,
        userId,
        planId,
        amount,
        status
      }
    }
  });

  return {
    success: true,
    message: 'Invoice created successfully.',
    invoice
  };
};

/**
 * 20. Sakhi Content CMS Methods
 */
const getSakhiContent = async (filters) => {
  const where = {};
  if (filters.tab) {
    where.tab = filters.tab;
  }
  if (filters.status) {
    where.status = filters.status;
  }

  const content = await prisma.sakhiContent.findMany({
    where,
    orderBy: { createdAt: 'desc' }
  });

  return {
    success: true,
    content
  };
};

const createSakhiContent = async (data) => {
  const content = await prisma.sakhiContent.create({
    data: {
      title: data.title,
      description: data.description || null,
      duration: data.duration || null,
      category: data.category || null,
      scripture: data.scripture || null,
      focus: data.focus || null,
      topic: data.topic || null,
      author: data.author || null,
      status: data.status || 'Published',
      mediaUrl: data.mediaUrl || null,
      tab: data.tab
    }
  });

  return {
    success: true,
    message: 'Content published successfully.',
    content
  };
};

const updateSakhiContent = async (id, data) => {
  const content = await prisma.sakhiContent.update({
    where: { id },
    data: {
      title: data.title,
      description: data.description !== undefined ? data.description : null,
      duration: data.duration !== undefined ? data.duration : null,
      category: data.category !== undefined ? data.category : null,
      scripture: data.scripture !== undefined ? data.scripture : null,
      focus: data.focus !== undefined ? data.focus : null,
      topic: data.topic !== undefined ? data.topic : null,
      author: data.author !== undefined ? data.author : null,
      status: data.status !== undefined ? data.status : 'Published',
      mediaUrl: data.mediaUrl !== undefined ? data.mediaUrl : null
    }
  });

  return {
    success: true,
    message: 'Content updated successfully.',
    content
  };
};

const deleteSakhiContent = async (id) => {
  await prisma.sakhiContent.delete({
    where: { id }
  });

  return {
    success: true,
    message: 'Content deleted successfully.'
  };
};



const releasePayout = async (id, adminId) => {
  const payout = await prisma.advisorEarnings.findUnique({
    where: { id }
  });

  if (!payout) {
    throw new ApiError(404, 'PAYOUT_NOT_FOUND', 'Advisor earning record not found.');
  }

  if (payout.payoutStatus === 'paid') {
    throw new ApiError(400, 'PAYOUT_ALREADY_PAID', 'Payout has already been released.');
  }

  await prisma.$transaction(async (tx) => {
    await tx.advisorEarnings.update({
      where: { id },
      data: {
        payoutStatus: 'paid',
        payoutDate: new Date()
      }
    });

    await tx.auditLog.create({
      data: {
        userId: adminId,
        action: 'PAYOUT_RELEASE',
        targetTable: 'advisor_earnings',
        targetId: id,
        changes: {
          amount: Number(payout.amount),
          advisorId: payout.advisorId
        }
      }
    });
  });

  return {
    success: true,
    message: 'Payout successfully released to advisor.'
  };
};

/**
 * Community Management Services
 */
const getAdminCommunityCircles = async () => {
  const circles = await prisma.communityCircle.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: {
          members: true,
          messages: true
        }
      }
    }
  });

  return {
    success: true,
    circles: circles.map(c => ({
      id: c.id,
      name: c.name,
      description: c.description,
      icon: c.icon || 'Users',
      color: c.color || '#ff69b4',
      memberCount: c._count.members,
      messageCount: c._count.messages,
      createdAt: c.createdAt
    }))
  };
};

const createCommunityCircle = async (data) => {
  if (!data.name || !data.name.trim()) {
    throw new ApiError(400, 'NAME_REQUIRED', 'Circle name is required.');
  }

  const circle = await prisma.communityCircle.create({
    data: {
      name: data.name.trim(),
      description: data.description ? data.description.trim() : null,
      icon: data.icon || 'Users',
      color: data.color || '#ff69b4'
    }
  });

  return { success: true, circle };
};

const updateCommunityCircle = async (id, data) => {
  const circle = await prisma.communityCircle.findUnique({ where: { id } });
  if (!circle) {
    throw new ApiError(404, 'CIRCLE_NOT_FOUND', 'Community circle not found.');
  }

  const updated = await prisma.communityCircle.update({
    where: { id },
    data: {
      name: data.name !== undefined ? data.name.trim() : circle.name,
      description: data.description !== undefined ? data.description.trim() : circle.description,
      icon: data.icon !== undefined ? data.icon : circle.icon,
      color: data.color !== undefined ? data.color : circle.color
    }
  });

  return { success: true, circle: updated };
};

const deleteCommunityCircle = async (id) => {
  const circle = await prisma.communityCircle.findUnique({ where: { id } });
  if (!circle) {
    throw new ApiError(404, 'CIRCLE_NOT_FOUND', 'Community circle not found.');
  }

  await prisma.communityCircle.delete({ where: { id } });
  return { success: true, message: 'Community circle deleted successfully.' };
};

const getAdminCircleMessages = async (circleId) => {
  const circle = await prisma.communityCircle.findUnique({ where: { id: circleId } });
  if (!circle) {
    throw new ApiError(404, 'CIRCLE_NOT_FOUND', 'Community circle not found.');
  }

  const [messages, members] = await Promise.all([
    prisma.communityCircleMessage.findMany({
      where: { circleId },
      orderBy: { createdAt: 'asc' },
      take: 100,
      include: {
        user: {
          include: {
            profile: {
              select: { fullName: true }
            }
          }
        }
      }
    }),
    prisma.communityCircleMember.findMany({
      where: { circleId },
      include: {
        user: {
          include: {
            profile: {
              select: { fullName: true }
            }
          }
        }
      }
    })
  ]);

  const blockedMap = new Set(
    members.filter(m => m.isBlocked).map(m => m.userId)
  );

  return {
    success: true,
    circle,
    members: members.map(m => ({
      userId: m.userId,
      fullName: m.user?.profile?.fullName || m.user?.email || 'Member',
      email: m.user?.email,
      isBlocked: Boolean(m.isBlocked),
      joinedAt: m.joinedAt
    })),
    messages: messages.map(msg => ({
      id: msg.id,
      userId: msg.userId,
      message: msg.message,
      isAnonymous: msg.isAnonymous,
      senderName: msg.user?.profile?.fullName || msg.user?.email || 'Member',
      isBlocked: blockedMap.has(msg.userId),
      createdAt: msg.createdAt
    }))
  };
};

const toggleBlockCommunityMember = async (circleId, userId, isBlocked) => {
  await prisma.communityCircleMember.upsert({
    where: {
      circleId_userId: { circleId, userId }
    },
    update: {
      isBlocked: Boolean(isBlocked)
    },
    create: {
      circleId,
      userId,
      isBlocked: Boolean(isBlocked)
    }
  });

  return {
    success: true,
    message: isBlocked ? 'Member restricted from circle' : 'Member unrestricted'
  };
};

module.exports = {
  getDashboardStats,
  getUsers,
  getUserById,
  updateUser,
  suspendUser,
  deleteUser,
  getAdvisors,
  updateAdvisorStatus,
  updateAdvisor,
  getPlans,
  createPlan,
  updatePlan,
  deletePlan,
  getApprovalsQueue,
  approveMember,
  rejectMember,
  createUser,
  createAdvisor,
  getInvoices,
  createInvoice,
  getSakhiContent,
  createSakhiContent,
  updateSakhiContent,
  deleteSakhiContent,
  getPayouts,
  releasePayout,
  getAffiliateReferrals,
  getAdminCommunityCircles,
  createCommunityCircle,
  updateCommunityCircle,
  deleteCommunityCircle,
  getAdminCircleMessages,
  toggleBlockCommunityMember
};
