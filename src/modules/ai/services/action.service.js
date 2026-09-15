const prisma = require('../../../config/database');
const { ApiError } = require('../../../middlewares/errorHandler');
const logger = require('../../../utils/logger');
const memoryService = require('./memory.service');

/**
 * Register a pending action parsed during user conversation.
 */
const createPendingAction = async (sessionId, actionType, payload) => {
  try {
    const action = await prisma.aIAction.create({
      data: {
        sessionId,
        actionType,
        payload,
        status: 'pending'
      }
    });
    return action;
  } catch (error) {
    logger.error(`Error creating pending AI Action: ${error.message}`);
    throw error;
  }
};

/**
 * Execute an existing AI action from the database.
 */
const executeActionById = async (actionId, userId) => {
  const action = await prisma.aIAction.findUnique({
    where: { id: actionId },
    include: { session: true }
  });

  if (!action) {
    throw new ApiError(404, 'ACTION_NOT_FOUND', 'AI action not found.');
  }

  if (action.session.userId !== userId) {
    throw new ApiError(403, 'FORBIDDEN', 'Access denied. You do not own this chat session.');
  }

  if (action.status === 'completed') {
    return {
      success: true,
      message: 'Action was already completed.',
      action
    };
  }

  // Run polymorphic runner
  const result = await runPolymorphicAction(action.actionType, action.payload, userId);

  // Update status
  const updatedAction = await prisma.aIAction.update({
    where: { id: actionId },
    data: {
      status: 'completed',
      result,
      completedAt: new Date()
    }
  });

  return {
    success: true,
    message: `Action ${action.actionType} executed successfully.`,
    action: updatedAction
  };
};

/**
 * Execute a direct action payload (creates and completes in one invocation).
 */
const executeDirectAction = async (actionType, sessionId, payload, userId) => {
  const session = await prisma.aIChatSession.findFirst({
    where: { id: sessionId, userId }
  });

  if (!session) {
    throw new ApiError(404, 'SESSION_NOT_FOUND', 'Chat session not found or does not belong to user.');
  }

  const action = await prisma.aIAction.create({
    data: {
      sessionId,
      actionType,
      payload,
      status: 'pending'
    }
  });

  const result = await runPolymorphicAction(actionType, payload, userId);

  const updatedAction = await prisma.aIAction.update({
    where: { id: action.id },
    data: {
      status: 'completed',
      result,
      completedAt: new Date()
    }
  });

  return {
    success: true,
    message: `Action ${actionType} executed successfully.`,
    action: updatedAction
  };
};

/**
 * Polymorphic dispatch router
 */
const runPolymorphicAction = async (actionType, payload, userId) => {
  switch (actionType) {
    case 'LOG_MOOD':
      return await executeLogMood(payload, userId);
    case 'CREATE_EXPENSE':
      return await executeCreateExpense(payload, userId);
    case 'LOG_PERIOD':
      return await executeLogPeriod(payload, userId);
    case 'BOOK_ADVISOR':
      return await executeBookAdvisor(payload, userId);
    default:
      throw new ApiError(400, 'INVALID_ACTION_TYPE', `Action type ${actionType} is not supported.`);
  }
};

const executeLogMood = async (payload, userId) => {
  const { mood_type, intensity, notes } = payload;
  if (!mood_type || intensity === undefined) {
    throw new ApiError(400, 'BAD_REQUEST', 'mood_type and intensity are required for LOG_MOOD action.');
  }

  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    include: { profile: true }
  });

  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User profile not found.');
  }

  const result = await prisma.$transaction(async (tx) => {
    // Log mood
    const moodEntry = await tx.moodLog.create({
      data: {
        userId,
        moodType: mood_type,
        intensity: parseInt(intensity, 10),
        notes: notes || null
      }
    });

    // Boost wellness score (+5)
    if (user.profile) {
      const newScore = Math.min(100, (user.profile.wellnessScore || 0) + 5);
      await tx.userProfile.update({
        where: { userId },
        data: {
          wellnessScore: newScore,
          lastActiveDate: new Date()
        }
      });
    }

    return moodEntry;
  });

  return result;
};

const executeCreateExpense = async (payload, userId) => {
  const { amount, category_name, description, transaction_date } = payload;
  if (amount === undefined || !category_name) {
    throw new ApiError(400, 'BAD_REQUEST', 'amount and category_name are required for CREATE_EXPENSE action.');
  }

  const dateVal = transaction_date ? new Date(transaction_date) : new Date();

  const result = await prisma.$transaction(async (tx) => {
    let category = await tx.financeCategory.findUnique({
      where: { name: category_name }
    });

    if (!category) {
      category = await tx.financeCategory.create({
        data: {
          name: category_name,
          type: 'expense'
        }
      });
    }

    const transaction = await tx.financeTransaction.create({
      data: {
        userId,
        categoryId: category.id,
        type: 'expense',
        amount: Number(amount),
        description: description || null,
        transactionDate: dateVal
      }
    });

    return transaction;
  });

  return {
    transaction_id: result.id,
    amount: Number(result.amount),
    category: category_name,
    description: result.description,
    date: result.transactionDate
  };
};

const executeLogPeriod = async (payload, userId) => {
  const { start_date, end_date, symptoms, flow_intensity } = payload;
  if (!start_date) {
    throw new ApiError(400, 'BAD_REQUEST', 'start_date is required for LOG_PERIOD action.');
  }

  const periodValue = {
    start_date,
    end_date: end_date || null,
    symptoms: symptoms || [],
    flow_intensity: flow_intensity || 'medium'
  };

  const memory = await memoryService.saveMemory(
    userId,
    'CYCLE',
    'last_period_log',
    periodValue,
    1.0,
    `Logged period starting on ${start_date}`
  );

  return {
    memory_id: memory.id,
    logged_data: periodValue
  };
};

const executeBookAdvisor = async (payload, userId) => {
  const { advisor_id, availability_id } = payload;
  if (!advisor_id || !availability_id) {
    throw new ApiError(400, 'BAD_REQUEST', 'advisor_id and availability_id are required for BOOK_ADVISOR action.');
  }

  const advisor = await prisma.advisor.findFirst({
    where: { id: advisor_id, status: 'approved' }
  });

  if (!advisor) {
    throw new ApiError(404, 'ADVISOR_NOT_FOUND', 'Advisor not found or not approved.');
  }

  const slots = Array.isArray(advisor.availability) ? advisor.availability : [];
  const slotIndex = slots.findIndex(s => s.id === availability_id);

  if (slotIndex === -1) {
    throw new ApiError(404, 'AVAILABILITY_NOT_FOUND', 'Advisor availability slot not found.');
  }

  const availability = slots[slotIndex];

  if (availability.status !== 'available') {
    throw new ApiError(400, 'SLOT_NOT_AVAILABLE', 'Selected availability slot is already booked or inactive.');
  }

  const appointment = await prisma.$transaction(async (tx) => {
    slots[slotIndex].status = 'booked';
    await tx.advisor.update({
      where: { id: advisor.id },
      data: { availability: slots }
    });

    const appt = await tx.appointment.create({
      data: {
        userId,
        advisorId: advisor_id,
        availabilityId: availability_id,
        date: new Date(availability.date),
        startTime: availability.startTime,
        endTime: availability.endTime,
        status: 'scheduled',
        amountPaid: advisor.hourlyRate,
        meetingLink: `https://telehealth.healthsakhi.com/rooms/${advisor.id}`
      }
    });

    return appt;
  });

  return {
    appointment_id: appointment.id,
    date: appointment.date,
    start_time: appointment.startTime,
    end_time: appointment.endTime,
    meeting_link: appointment.meetingLink,
    status: appointment.status
  };
};

module.exports = {
  createPendingAction,
  executeActionById,
  executeDirectAction
};
