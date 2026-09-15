const prisma = require('../../config/database');
const { ApiError } = require('../../middlewares/errorHandler');

/**
 * Middleware to enforce daily chat message limits for Free tier members.
 */
const checkChatLimit = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // Retrieve user and active paid subscriptions
    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: {
        subscriptions: {
          where: {
            deletedAt: null,
            endsAt: { gte: new Date() }
          },
          include: { plan: true },
          take: 1
        }
      }
    });

    if (!user) {
      throw new ApiError(404, 'USER_NOT_FOUND', 'User account not found.');
    }

    let isFree = true;
    if (user.subscriptions && user.subscriptions.length > 0) {
      const activeSub = user.subscriptions[0];
      if (activeSub.status === 'ACTIVE' && activeSub.plan.slug !== 'free-sakhi') {
        isFree = false;
      }
    }

    // Gate requests if user is on Free plan and daily limit of 5 is exceeded
    if (isFree && process.env.NODE_ENV !== 'development') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const usage = await prisma.aIUsageLimit.findUnique({
        where: {
          userId_chatDate: {
            userId,
            chatDate: today
          }
        }
      });

      if (usage && usage.count >= 5) {
        throw new ApiError(403, 'CHAT_LIMIT_EXCEEDED', 'You have exhausted your daily limit of 5 free AI chats. Upgrade to Premium Pro for unlimited access.');
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { checkChatLimit };
