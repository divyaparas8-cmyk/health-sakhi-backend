const prisma = require('../../config/database');
const { ApiError } = require('../../middlewares/errorHandler');
const { sendMail } = require('../../utils/mailer');
const logger = require('../../utils/logger');

/**
 * Get all notifications for a user
 */
const getNotifications = async (userId) => {
  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' }
  });

  return {
    success: true,
    notifications: notifications.map(n => ({
      id: n.id,
      title: n.title,
      message: n.message,
      type: n.type,
      is_read: n.isRead,
      read_at: n.readAt,
      created_at: n.createdAt
    }))
  };
};

/**
 * Mark a single notification as read
 */
const markAsRead = async (userId, notificationId) => {
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, userId }
  });

  if (!notification) {
    throw new ApiError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found.');
  }

  await prisma.notification.update({
    where: { id: notificationId },
    data: {
      isRead: true,
      readAt: new Date()
    }
  });

  return { success: true, message: 'Notification marked as read.' };
};

/**
 * Mark all notifications as read for a user
 */
const markAllAsRead = async (userId) => {
  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: {
      isRead: true,
      readAt: new Date()
    }
  });

  return { success: true, message: 'All notifications marked as read.' };
};

/**
 * Send/Create a push/system notification
 */
const sendPushNotification = async (userId, title, message, type = 'system') => {
  const notification = await prisma.notification.create({
    data: {
      userId,
      title,
      message,
      type
    }
  });

  // Simulated WebPush / WebSocket push alert hook
  logger.info(`Push/System alert triggered for User: ${userId} | Title: ${title}`);

  return {
    success: true,
    notification: {
      id: notification.id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      created_at: notification.createdAt
    }
  };
};

/**
 * Send an email notification (async fire-and-forget helper wrapper)
 */
const sendEmailNotification = async (to, subject, content) => {
  // Fire email dispatch asynchronously to keep server response snappy
  sendMail(to, subject, content, `<p>${content.replace(/\n/g, '<br>')}</p>`)
    .catch(err => logger.error(`Error sending email to ${to}: ${err.message}`));

  return { success: true, message: 'Email dispatch initiated.' };
};

/**
 * Create a new campaign template notification
 */
const createCampaign = async (data) => {
  const { name, targetRole, channel, subject, content, scheduledAt } = data;

  const campaign = await prisma.campaign.create({
    data: {
      name,
      targetRole,
      channel,
      subject: subject || null,
      content,
      status: scheduledAt ? 'scheduled' : 'draft',
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null
    }
  });

  return {
    success: true,
    campaign: {
      id: campaign.id,
      name: campaign.name,
      target_role: campaign.targetRole,
      channel: campaign.channel,
      status: campaign.status,
      scheduled_at: campaign.scheduledAt,
      created_at: campaign.createdAt
    }
  };
};

/**
 * List campaigns
 */
const getCampaigns = async () => {
  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: 'desc' }
  });

  return {
    success: true,
    campaigns: campaigns.map(c => ({
      id: c.id,
      name: c.name,
      target_role: c.targetRole,
      channel: c.channel,
      subject: c.subject,
      content: c.content,
      status: c.status,
      scheduled_at: c.scheduledAt,
      sent_at: c.sentAt,
      created_at: c.createdAt
    }))
  };
};

/**
 * Trigger immediate execution of a campaign
 */
const triggerCampaign = async (campaignId) => {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId }
  });

  if (!campaign) {
    throw new ApiError(404, 'CAMPAIGN_NOT_FOUND', 'Campaign not found.');
  }

  if (campaign.status === 'sent') {
    throw new ApiError(400, 'CAMPAIGN_ALREADY_SENT', 'This campaign has already been sent.');
  }

  // Find target users by querying their roles
  let whereClause = { deletedAt: null, isApproved: true };

  if (campaign.targetRole !== 'all') {
    // Find the Role record matching the targetRole name
    const roleRecord = await prisma.role.findFirst({
      where: {
        name: {
          equals: campaign.targetRole,
        }
      }
    });

    if (roleRecord) {
      whereClause.roleId = roleRecord.id;
    } else {
      // Role not found, fallback to no-op
      whereClause.roleId = 'non-existent-role';
    }
  }

  const targetUsers = await prisma.user.findMany({
    where: whereClause,
    include: { profile: true }
  });

  logger.info(`Triggering campaign "${campaign.name}" to ${targetUsers.length} target users via ${campaign.channel}`);

  if (campaign.channel === 'push') {
    // Generate notification records in DB
    const notificationsData = targetUsers.map(user => ({
      userId: user.id,
      title: campaign.subject || campaign.name,
      message: campaign.content,
      type: 'campaign'
    }));

    if (notificationsData.length > 0) {
      await prisma.notification.createMany({
        data: notificationsData
      });
    }
  } else if (campaign.channel === 'email') {
    // Dispatch emails asynchronously
    for (const user of targetUsers) {
      if (user.email) {
        sendMail(
          user.email,
          campaign.subject || campaign.name,
          campaign.content,
          `<p>${campaign.content.replace(/\n/g, '<br>')}</p>`
        ).catch(err => logger.error(`Campaign Email failed for ${user.email}: ${err.message}`));
      }
    }
  }

  // Update campaign status
  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      status: 'sent',
      sentAt: new Date()
    }
  });

  return {
    success: true,
    message: `Campaign successfully dispatched to ${targetUsers.length} users.`
  };
};

/**
 * Member reply to admin notification
 */
const sendMemberReply = async (userId, message, title) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true }
  });

  const senderName = user?.profile?.fullName || user?.email || 'Member';
  const replyTitle = title || `Reply from ${senderName}`;

  const notification = await prisma.notification.create({
    data: {
      userId,
      title: replyTitle,
      message,
      type: 'member_reply',
      isRead: false
    }
  });

  // Notify admin users with member_reply type containing the member's userId
  await createAdminNotification(
    replyTitle,
    message,
    `member_reply:${userId}`
  );

  return {
    success: true,
    notification: {
      id: notification.id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      created_at: notification.createdAt
    }
  };
};

/**
 * Get map of unread member replies for Admin dashboard indicators
 */
const getUnreadReplies = async () => {
  const unreadReplies = await prisma.notification.findMany({
    where: { type: 'member_reply', isRead: false },
    select: { userId: true, createdAt: true, message: true, title: true }
  });

  const userReplyMap = {};
  unreadReplies.forEach(r => {
    if (!userReplyMap[r.userId]) {
      userReplyMap[r.userId] = { count: 0, latestMessage: r.message, latestTime: r.createdAt };
    }
    userReplyMap[r.userId].count += 1;
  });

  return {
    success: true,
    userReplyMap
  };
};

/**
 * Get chronological chat history between admin and member, and mark member replies read
 */
const getUserChatThread = async (userId) => {
  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' }
  });

  await prisma.notification.updateMany({
    where: { userId, type: 'member_reply', isRead: false },
    data: { isRead: true, readAt: new Date() }
  });

  return {
    success: true,
    messages: notifications.map(n => ({
      id: n.id,
      title: n.title,
      message: n.message,
      type: n.type,
      is_read: n.isRead,
      created_at: n.createdAt,
      is_member: n.type === 'member_reply'
    }))
  };
};

/**
 * Delete a specific notification/message
 */
const deleteNotification = async (id, userId = null, isAdmin = false) => {
  const whereClause = isAdmin ? { id } : { id, userId };
  const notification = await prisma.notification.findFirst({
    where: whereClause
  });

  if (!notification) {
    throw new ApiError(404, 'NOTIFICATION_NOT_FOUND', 'Message not found or unauthorized.');
  }

  await prisma.notification.delete({
    where: { id }
  });

  return { success: true, message: 'Message deleted successfully.' };
};

/**
 * Create a notification for all admin users
 */
const createAdminNotification = async (title, message, type = 'system') => {
  try {
    const admins = await prisma.user.findMany({
      where: {
        role: {
          name: 'admin'
        }
      }
    });

    if (admins.length > 0) {
      const notificationsData = admins.map(admin => ({
        userId: admin.id,
        title,
        message,
        type,
        isRead: false
      }));

      await prisma.notification.createMany({
        data: notificationsData
      });
    }
  } catch (err) {
    logger.error(`[Admin Notification Error] ${err.message}`);
  }
};

/**
 * Find sender member's user ID for an admin notification
 */
const getNotificationSender = async (id) => {
  const notification = await prisma.notification.findUnique({
    where: { id }
  });

  if (!notification) {
    throw new ApiError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found.');
  }

  // 1. Check if type contains member_reply:[userId]
  if (notification.type && notification.type.startsWith('member_reply:')) {
    const userId = notification.type.split(':')[1];
    return { success: true, userId };
  }

  // 2. Otherwise find a notification with same message and type 'member_reply' that belongs to a member
  const memberNotification = await prisma.notification.findFirst({
    where: {
      message: notification.message,
      type: 'member_reply',
      NOT: {
        userId: notification.userId
      }
    },
    select: {
      userId: true
    }
  });

  if (memberNotification) {
    return { success: true, userId: memberNotification.userId };
  }

  // 3. Fallback: Parse the title "Reply from [Name]" or "Reply from [Email]"
  if (notification.title && notification.title.startsWith('Reply from ')) {
    const nameOrEmail = notification.title.replace('Reply from ', '').trim();
    if (nameOrEmail && nameOrEmail.toLowerCase() !== 'member') {
      // Find user by fullName or email
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { email: nameOrEmail },
            { profile: { fullName: nameOrEmail } }
          ]
        },
        select: {
          id: true
        }
      });
      if (user) {
        return { success: true, userId: user.id };
      }
    }
  }

  return { success: true, userId: null };
};

/**
 * Dispatch a notification to all registered members
 */
const notifyAllMembers = async (title, message, type = 'system') => {
  try {
    const members = await prisma.user.findMany({
      where: {
        role: { name: 'Member' },
        deletedAt: null
      },
      select: {
        id: true
      }
    });

    if (members.length > 0) {
      const notificationsData = members.map(m => ({
        userId: m.id,
        title,
        message,
        type,
        isRead: false
      }));

      await prisma.notification.createMany({
        data: notificationsData
      });
    }
  } catch (err) {
    logger.error(`[Notify All Members Error] ${err.message}`);
  }
};

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  sendPushNotification,
  sendEmailNotification,
  createCampaign,
  getCampaigns,
  triggerCampaign,
  sendMemberReply,
  getUnreadReplies,
  getUserChatThread,
  deleteNotification,
  createAdminNotification,
  getNotificationSender,
  notifyAllMembers
};

