const prisma = require('../../config/database');
const { ApiError } = require('../../middlewares/errorHandler');
const logger = require('../../utils/logger');

/**
 * 1. Search and list active advisors
 */
const searchAdvisors = async (filters) => {
  const whereClause = {
    status: 'approved',
    deletedAt: null
  };

  if (filters.specialization) {
    whereClause.specializations = {
      some: {
        specializationName: {
          contains: filters.specialization
        }
      }
    };
  }

  if (filters.search) {
    whereClause.OR = [
      { user: { profile: { fullName: { contains: filters.search } } } },
      { qualification: { contains: filters.search } }
    ];
  }

  const advisors = await prisma.advisor.findMany({
    where: whereClause,
    include: {
      user: {
        include: { profile: true }
      },
      specializations: true
    }
  });

  return {
    success: true,
    advisors: advisors.map(adv => ({
      id: adv.id,
      name: adv.user.profile ? adv.user.profile.fullName : 'Advisor User',
      rating: Number(adv.rating),
      reviews_count: adv.totalReviews,
      specializations: adv.specializations.map(s => s.specializationName),
      photo_url: adv.photoUrl,
      qualification: adv.qualification,
      hourly_rate: Number(adv.hourlyRate)
    }))
  };
};

/**
 * 2. Get available schedule slots of an advisor
 */
const getAvailability = async (advisorId, queryDate) => {
  const advisor = await prisma.advisor.findUnique({
    where: { id: advisorId }
  });

  if (!advisor) {
    throw new ApiError(404, 'ADVISOR_NOT_FOUND', 'Advisor not found.');
  }

  const slots = Array.isArray(advisor.availability) ? advisor.availability : [];
  
  // Filter for 'available' status
  let filteredSlots = slots.filter(s => s.status === 'available');

  if (queryDate) {
    const dateStr = new Date(queryDate).toISOString().split('T')[0];
    filteredSlots = filteredSlots.filter(s => s.date === dateStr);
  }

  // Sort by startTime
  filteredSlots.sort((a, b) => a.startTime.localeCompare(b.startTime));

  return {
    success: true,
    slots: filteredSlots.map(s => ({
      id: s.id,
      date: s.date,
      start_time: s.startTime,
      end_time: s.endTime,
      status: s.status
    }))
  };
};

/**
 * 3. Create a schedule slot (Advisor action)
 */
const createAvailability = async (userId, data) => {
  const advisor = await prisma.advisor.findFirst({
    where: { userId, deletedAt: null }
  });

  if (!advisor) {
    throw new ApiError(404, 'ADVISOR_NOT_FOUND', 'Advisor profile not found.');
  }

  const { date, startTime, endTime } = data;
  let slots = Array.isArray(advisor.availability) ? advisor.availability : [];
  
  const existingIndex = slots.findIndex(s => s.date === date && s.startTime === startTime);

  const { randomUUID } = require('crypto');

  let newSlot;
  if (existingIndex > -1) {
    slots[existingIndex].endTime = endTime;
    slots[existingIndex].status = 'available';
    newSlot = slots[existingIndex];
  } else {
    newSlot = {
      id: randomUUID(),
      date,
      startTime,
      endTime,
      status: 'available'
    };
    slots.push(newSlot);
  }

  await prisma.advisor.update({
    where: { id: advisor.id },
    data: { availability: slots }
  });

  return {
    success: true,
    slot: {
      id: newSlot.id,
      date: newSlot.date,
      start_time: newSlot.startTime,
      end_time: newSlot.endTime,
      status: newSlot.status
    }
  };
};

/**
 * 4. Reserve a consultation slot (Member action)
 */
const bookAppointment = async (userId, data) => {
  const member = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    include: {
      subscriptions: {
        where: {
          deletedAt: null,
          status: 'ACTIVE',
          endsAt: { gte: new Date() }
        },
        include: { plan: true },
        orderBy: { endsAt: 'desc' },
        take: 1
      }
    }
  });

  if (!member) {
    throw new ApiError(404, 'MEMBER_NOT_FOUND', 'Member user not found.');
  }

  let activePlanSlug = 'free-sakhi';
  if (member.subscriptions && member.subscriptions.length > 0) {
    activePlanSlug = member.subscriptions[0].plan.slug;
  }

  if (activePlanSlug === 'free-sakhi') {
    throw new ApiError(403, 'BOOKING_BLOCKED', 'Advisor booking is blocked on your Free tier. Upgrade to Premium Pro to schedule sessions.');
  }

  const { advisor_id, availability_id } = data;

  const advisor = await prisma.advisor.findFirst({
    where: { id: advisor_id, deletedAt: null }
  });

  if (!advisor) {
    throw new ApiError(404, 'ADVISOR_NOT_FOUND', 'Advisor not found.');
  }

  const slots = Array.isArray(advisor.availability) ? advisor.availability : [];
  const slotIndex = slots.findIndex(s => s.id === availability_id);

  if (slotIndex === -1) {
    throw new ApiError(404, 'SLOT_NOT_FOUND', 'Schedule slot not found.');
  }

  const slot = slots[slotIndex];

  if (slot.status !== 'available') {
    throw new ApiError(400, 'SLOT_UNAVAILABLE', 'The selected slot has already been booked or is inactive.');
  }

  const hourlyRateVal = Number(advisor.hourlyRate);

  const appointment = await prisma.$transaction(async (tx) => {
    slots[slotIndex].status = 'booked';
    await tx.advisor.update({
      where: { id: advisor.id },
      data: { availability: slots }
    });

    let appt = await tx.appointment.create({
      data: {
        userId,
        advisorId: advisor_id,
        availabilityId: availability_id,
        date: new Date(slot.date),
        startTime: slot.startTime,
        endTime: slot.endTime,
        status: 'pending',
        meetingLink: '',
        amountPaid: hourlyRateVal
      }
    });

    appt = await tx.appointment.update({
      where: { id: appt.id },
      data: {
        meetingLink: `https://meet.jit.si/health-sakhi-${appt.id}`
      }
    });

    return appt;
  });

  // Send notifications
  try {
    const memberProfile = await prisma.userProfile.findUnique({
      where: { userId }
    });
    const memberName = memberProfile?.fullName || 'Sakhi Member';
    const notificationsService = require('../notifications/notifications.service');
    
    // Notify Advisor
    if (advisor.userId) {
      await notificationsService.sendPushNotification(
        advisor.userId,
        `New Appointment Booked`,
        `Appointment requested by ${memberName} for ${new Date(slot.date).toLocaleDateString()} at ${slot.startTime}.`,
        'appointment'
      );
    }
    
    // Notify Member
    await notificationsService.sendPushNotification(
      userId,
      `Appointment Requested`,
      `Your booking request for ${new Date(slot.date).toLocaleDateString()} at ${slot.startTime} has been submitted.`,
      'appointment'
    );
  } catch (err) {
    console.error('Failed to create notification for appointment booking:', err);
  }

  return {
    success: true,
    appointment: {
      id: appointment.id,
      date: appointment.date,
      start_time: appointment.startTime,
      end_time: appointment.endTime,
      meeting_link: appointment.meetingLink,
      status: appointment.status
    }
  };
};

/**
 * 5. Retrieve appointment list
 */
const getAppointments = async (userId, role) => {
  const isAdvisor = role === 'advisor' || role === 'Advisor';
  const isAdmin = role === 'admin' || role === 'Admin';

  let whereClause = {};
  let includeRelation = {};

  if (isAdmin) {
    includeRelation = {
      user: {
        include: { profile: true }
      },
      advisor: {
        include: {
          user: { include: { profile: true } }
        }
      },
      notes: true
    };
  } else if (isAdvisor) {
    const advisor = await prisma.advisor.findFirst({
      where: { userId, deletedAt: null }
    });
    if (!advisor) {
      throw new ApiError(404, 'ADVISOR_NOT_FOUND', 'Advisor profile not found.');
    }
    whereClause.advisorId = advisor.id;
    includeRelation = {
      user: {
        include: { profile: true }
      },
      notes: true
    };
  } else {
    whereClause.userId = userId;
    includeRelation = {
      advisor: {
        include: {
          user: { include: { profile: true } }
        }
      },
      notes: true
    };
  }

  const appts = await prisma.appointment.findMany({
    where: whereClause,
    include: includeRelation,
    orderBy: { date: 'asc' }
  });

  return {
    success: true,
    appointments: appts.map(appt => {
      const isApptAdvisor = isAdvisor || (isAdmin && appt.advisorId === userId);
      
      return {
        id: appt.id,
        date: appt.date,
        time: appt.startTime,
        start_time: appt.startTime,
        end_time: appt.endTime,
        status: appt.status,
        meeting_link: appt.meetingLink,
        amount_paid: Number(appt.amountPaid),
        participantName: isApptAdvisor
          ? (appt.user?.profile ? appt.user.profile.fullName : 'Member')
          : (appt.advisor?.user?.profile ? appt.advisor.user.profile.fullName : 'Advisor'),
        participantUserId: isApptAdvisor ? appt.userId : appt.advisor?.userId,
        user: appt.user?.profile ? appt.user.profile.fullName : 'Member User',
        advisor: appt.advisor?.user?.profile ? appt.advisor.user.profile.fullName : 'Advisor User',
        email: appt.user?.email || 'member@gmail.com',
        type: 'Video',
        duration: '30 min',
        notes: appt.notes ? {
          id: appt.notes.id,
          symptoms: appt.notes.symptoms,
          diagnosis: appt.notes.diagnosis,
          treatment_plan: appt.notes.treatmentPlan,
          prescriptions: appt.notes.prescriptions,
          created_at: appt.notes.createdAt
        } : null
      };
    })
  };
};

/**
 * 6. Submit consultation notes and close session (Advisor action)
 */
const submitNotes = async (userId, appointmentId, data) => {
  const advisor = await prisma.advisor.findFirst({
    where: { userId, deletedAt: null }
  });

  if (!advisor) {
    throw new ApiError(404, 'ADVISOR_NOT_FOUND', 'Advisor profile not found.');
  }

  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, advisorId: advisor.id }
  });

  if (!appointment) {
    throw new ApiError(404, 'APPOINTMENT_NOT_FOUND', 'Consultation appointment not found.');
  }

  const existingNotes = await prisma.consultationNotes.findUnique({
    where: { appointmentId }
  });

  const { symptoms, diagnosis, treatment_plan, prescriptions } = data;

  await prisma.$transaction(async (tx) => {
    if (existingNotes) {
      await tx.consultationNotes.update({
        where: { appointmentId },
        data: {
          symptoms: symptoms || null,
          diagnosis: diagnosis || null,
          treatmentPlan: treatment_plan,
          prescriptions: prescriptions || null
        }
      });
    } else {
      await tx.consultationNotes.create({
        data: {
          appointmentId,
          symptoms: symptoms || null,
          diagnosis: diagnosis || null,
          treatmentPlan: treatment_plan,
          prescriptions: prescriptions || null
        }
      });
    }

    if (appointment.status !== 'completed') {
      const amountPaidVal = Number(appointment.amountPaid);
      const commissionVal = amountPaidVal * 0.15; // 15% commission fee

      await tx.appointment.update({
        where: { id: appointmentId },
        data: { status: 'completed' }
      });

      await tx.advisorEarnings.create({
        data: {
          advisorId: advisor.id,
          appointmentId,
          amount: amountPaidVal - commissionVal, // Net earnings
          commission: commissionVal,
          payoutStatus: 'pending'
        }
      });
    }
  });

  return {
    success: true,
    message: 'Consultation closed, notes dispatched to member.'
  };
};

/**
 * 7. Retrieve earnings metrics (Advisor action)
 */
const getEarnings = async (userId) => {
  const advisor = await prisma.advisor.findFirst({
    where: { userId, deletedAt: null }
  });

  if (!advisor) {
    throw new ApiError(404, 'ADVISOR_NOT_FOUND', 'Advisor profile not found.');
  }

  const earnings = await prisma.advisorEarnings.findMany({
    where: { advisorId: advisor.id },
    include: {
      appointment: {
        include: {
          user: { include: { profile: true } }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  let totalEarnings = 0;
  let totalCommission = 0;
  let payoutPending = 0;
  let payoutPaid = 0;

  earnings.forEach(e => {
    const amt = Number(e.amount);
    const comm = Number(e.commission);
    totalEarnings += amt;
    totalCommission += comm;

    if (e.payoutStatus === 'pending' || e.payoutStatus === 'processing') {
      payoutPending += amt;
    } else if (e.payoutStatus === 'paid') {
      payoutPaid += amt;
    }
  });

  return {
    success: true,
    summary: {
      net_earnings: totalEarnings,
      total_commission: totalCommission,
      payout_pending: payoutPending,
      payout_paid: payoutPaid
    },
    ledger: earnings.map(e => ({
      id: e.id,
      appointment_id: e.appointmentId,
      patient_name: e.appointment.user.profile ? e.appointment.user.profile.fullName : 'Platform Member',
      session_date: e.appointment.date,
      total_charged: Number(e.appointment.amountPaid),
      commission_cut: Number(e.commission),
      net_credited: Number(e.amount),
      payout_status: e.payoutStatus,
      paid_at: e.payoutDate,
      created_at: e.createdAt
    }))
  };
};

const requestPayout = async (userId, body) => {
  const advisor = await prisma.advisor.findFirst({
    where: { userId, deletedAt: null }
  });

  if (!advisor) {
    throw new ApiError(404, 'ADVISOR_NOT_FOUND', 'Advisor profile not found.');
  }

  const pendingEarnings = await prisma.advisorEarnings.findMany({
    where: {
      advisorId: advisor.id,
      payoutStatus: 'pending'
    }
  });

  if (pendingEarnings.length === 0) {
    throw new ApiError(400, 'NO_PENDING_EARNINGS', 'No pending earnings to request payout for.');
  }

  await prisma.advisorEarnings.updateMany({
    where: {
      advisorId: advisor.id,
      payoutStatus: 'pending'
    },
    data: {
      payoutStatus: 'processing'
    }
  });

  return {
    success: true,
    message: 'Payout requested successfully. Your status is now processing.',
    requested_count: pendingEarnings.length
  };
};

/**
 * 8. Reschedule an existing appointment
 */
/**
 * 8. Reschedule an existing appointment
 */
const rescheduleAppointment = async (appointmentId, newAvailabilityId, userId, role) => {
  const isAdvisor = role === 'advisor' || role === 'Advisor';

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { advisor: true }
  });

  if (!appointment) {
    throw new ApiError(404, 'APPOINTMENT_NOT_FOUND', 'Appointment not found.');
  }

  // Check ownership/authorization
  if (isAdvisor) {
    if (appointment.advisor.userId !== userId) {
      throw new ApiError(403, 'FORBIDDEN', 'Access denied. You do not own this appointment.');
    }
  } else {
    if (appointment.userId !== userId) {
      throw new ApiError(403, 'FORBIDDEN', 'Access denied. You do not own this appointment.');
    }
  }

  if (appointment.status !== 'scheduled') {
    throw new ApiError(400, 'BAD_REQUEST', `Cannot reschedule appointment with status: ${appointment.status}`);
  }

  const advisor = await prisma.advisor.findUnique({
    where: { id: appointment.advisorId }
  });

  if (!advisor) {
    throw new ApiError(404, 'ADVISOR_NOT_FOUND', 'Advisor not found.');
  }

  const slots = Array.isArray(advisor.availability) ? advisor.availability : [];
  const newSlotIndex = slots.findIndex(s => s.id === newAvailabilityId);

  if (newSlotIndex === -1) {
    throw new ApiError(404, 'SLOT_NOT_FOUND', 'New availability slot not found.');
  }

  const newSlot = slots[newSlotIndex];

  if (newSlot.status !== 'available') {
    throw new ApiError(400, 'SLOT_UNAVAILABLE', 'The selected new slot is not available.');
  }

  const updatedAppointment = await prisma.$transaction(async (tx) => {
    // Revert old slot status
    const oldSlotIndex = slots.findIndex(s => s.id === appointment.availabilityId);
    if (oldSlotIndex > -1) {
      slots[oldSlotIndex].status = 'available';
    }

    // Mark new slot as booked
    slots[newSlotIndex].status = 'booked';

    await tx.advisor.update({
      where: { id: advisor.id },
      data: { availability: slots }
    });

    // Update appointment details
    const appt = await tx.appointment.update({
      where: { id: appointmentId },
      data: {
        availabilityId: newAvailabilityId,
        date: new Date(newSlot.date),
        startTime: newSlot.startTime,
        endTime: newSlot.endTime
      }
    });

    return appt;
  });

  return {
    success: true,
    message: 'Appointment rescheduled successfully.',
    appointment: {
      id: updatedAppointment.id,
      date: updatedAppointment.date,
      start_time: updatedAppointment.startTime,
      end_time: updatedAppointment.endTime,
      meeting_link: updatedAppointment.meetingLink,
      status: updatedAppointment.status
    }
  };
};

/**
 * 9. Cancel an existing appointment
 */
const cancelAppointment = async (appointmentId, userId, role) => {
  const isAdvisor = role === 'advisor' || role === 'Advisor';

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { advisor: true }
  });

  if (!appointment) {
    throw new ApiError(404, 'APPOINTMENT_NOT_FOUND', 'Appointment not found.');
  }

  // Check ownership/authorization
  if (isAdvisor) {
    if (appointment.advisor.userId !== userId) {
      throw new ApiError(403, 'FORBIDDEN', 'Access denied. You do not own this appointment.');
    }
  } else {
    if (appointment.userId !== userId) {
      throw new ApiError(403, 'FORBIDDEN', 'Access denied. You do not own this appointment.');
    }
  }

  if (!['scheduled', 'pending'].includes(appointment.status)) {
    throw new ApiError(400, 'BAD_REQUEST', `Cannot cancel appointment with status: ${appointment.status}`);
  }

  await prisma.$transaction(async (tx) => {
    // Revert slot status back to available
    const advisor = await tx.advisor.findUnique({
      where: { id: appointment.advisorId }
    });

    if (advisor) {
      const slots = Array.isArray(advisor.availability) ? advisor.availability : [];
      const slotIndex = slots.findIndex(s => s.id === appointment.availabilityId);
      if (slotIndex > -1) {
        slots[slotIndex].status = 'available';
        await tx.advisor.update({
          where: { id: advisor.id },
          data: { availability: slots }
        });
      }
    }

    // Update appointment status to cancelled
    await tx.appointment.update({
      where: { id: appointmentId },
      data: { status: 'cancelled' }
    });
  });

  // Send notifications
  try {
    const notificationsService = require('../notifications/notifications.service');
    if (isAdvisor) {
      // Advisor cancelled, notify Member
      await notificationsService.sendPushNotification(
        appointment.userId,
        `Appointment Cancelled`,
        `Your appointment scheduled with Advisor has been cancelled.`,
        'appointment'
      );
    } else {
      // Member cancelled, notify Advisor
      if (appointment.advisor.userId) {
        await notificationsService.sendPushNotification(
          appointment.advisor.userId,
          `Appointment Cancelled`,
          `The appointment request with you has been cancelled by the member.`,
          'appointment'
        );
      }
    }
  } catch (err) {
    console.error('Failed to create notification for appointment cancellation:', err);
  }

  return {
    success: true,
    message: 'Appointment cancelled successfully.'
  };
};

/**
 * 10. Confirm an existing appointment (Advisor action)
 */
const confirmAppointment = async (appointmentId, userId, newDate, newTime) => {
  const advisor = await prisma.advisor.findFirst({
    where: { userId, deletedAt: null }
  });

  if (!advisor) {
    throw new ApiError(404, 'ADVISOR_NOT_FOUND', 'Advisor profile not found.');
  }

  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, advisorId: advisor.id }
  });

  if (!appointment) {
    throw new ApiError(404, 'APPOINTMENT_NOT_FOUND', 'Appointment not found.');
  }

  const updateData = {
    status: 'scheduled',
    meetingLink: `https://meet.jit.si/health-sakhi-${appointmentId}`
  };

  if (newDate || newTime) {
    if (newDate) {
      updateData.date = new Date(newDate);
    }
    if (newTime) {
      updateData.startTime = newTime;
      const [h, m] = newTime.split(':').map(Number);
      let eh = h;
      let em = m + 30;
      if (em >= 60) {
        eh += 1;
        em -= 60;
      }
      updateData.endTime = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
    }

    await prisma.$transaction(async (tx) => {
      // Revert/Update slot inside advisor JSON
      const slots = Array.isArray(advisor.availability) ? advisor.availability : [];
      const slotIndex = slots.findIndex(s => s.id === appointment.availabilityId);
      if (slotIndex > -1) {
        if (newDate) {
          slots[slotIndex].date = newDate;
        }
        if (newTime) {
          slots[slotIndex].startTime = updateData.startTime;
          slots[slotIndex].endTime = updateData.endTime;
        }
        await tx.advisor.update({
          where: { id: advisor.id },
          data: { availability: slots }
        });
      }

      await tx.appointment.update({
        where: { id: appointmentId },
        data: updateData
      });
    });
  } else {
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: updateData
    });
  }

  // Send notifications
  try {
    const notificationsService = require('../notifications/notifications.service');
    const advisorProfile = await prisma.userProfile.findUnique({
      where: { userId }
    });
    const advisorName = advisorProfile?.fullName || 'Advisor';
    
    let detailText = `Your appointment with ${advisorName} has been confirmed.`;
    if (newDate || newTime) {
      detailText = `Your appointment with ${advisorName} has been rescheduled and confirmed for ${new Date(updateData.date || appointment.date).toLocaleDateString()} at ${updateData.startTime || appointment.startTime}.`;
    }

    await notificationsService.sendPushNotification(
      appointment.userId,
      `Appointment Confirmed`,
      detailText,
      'appointment'
    );
  } catch (err) {
    console.error('Failed to create notification for appointment confirmation:', err);
  }

  return {
    success: true,
    message: 'Appointment confirmed successfully.'
  };
};

/**
 * 11. Retrieve advisor dashboard stats & queues
 */
const getDashboardData = async (userId) => {
  const advisor = await prisma.advisor.findFirst({
    where: { userId, deletedAt: null }
  });

  if (!advisor) {
    throw new ApiError(404, 'ADVISOR_NOT_FOUND', 'Advisor profile not found.');
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const endOfWeek = new Date();
  endOfWeek.setDate(endOfWeek.getDate() + 7);
  endOfWeek.setHours(23, 59, 59, 999);

  const allAppointments = await prisma.appointment.findMany({
    where: { advisorId: advisor.id },
    include: { user: { include: { profile: true } } },
    orderBy: { startTime: 'asc' }
  });

  const todaySessions = allAppointments.filter(apt => {
    const d = new Date(apt.date);
    return d >= startOfToday && d <= endOfToday;
  });

  const weekSessions = allAppointments.filter(apt => {
    const d = new Date(apt.date);
    return d >= startOfToday && d <= endOfWeek;
  });

  const sessionsToday = todaySessions.length;
  const upcomingCalls = allAppointments.filter(apt => apt.status === 'scheduled' || apt.status === 'pending').length;

  const todayEarningsTx = await prisma.advisorEarnings.findMany({
    where: {
      advisorId: advisor.id,
      createdAt: { gte: startOfToday, lte: endOfToday }
    }
  });
  const todayEarningsVal = todayEarningsTx.reduce((sum, e) => sum + Number(e.amount), 0);

  const completedCount = allAppointments.filter(apt => apt.status === 'completed').length;
  const totalCount = allAppointments.filter(apt => apt.status !== 'cancelled').length;
  const adherenceVal = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 100;

  const formatAptList = (list) => list.map(apt => {
    const formattedDate = new Date(apt.date).toISOString().split('T')[0];
    return {
      id: apt.id,
      name: apt.user.profile ? apt.user.profile.fullName : 'Member User',
      time: apt.startTime,
      date: formattedDate,
      topic: 'Wellness Consultation',
      type: 'Video',
      healthStatus: apt.status === 'scheduled' ? 'Scheduled' : apt.status === 'completed' ? 'Completed' : (apt.status === 'pending' ? 'Pending Approval' : 'Cancelled'),
      mood: 'Focused'
    };
  });

  return {
    success: true,
    stats: {
      Today: [
        { name: 'Sessions Today', value: String(sessionsToday), icon: 'CheckCircle', color: '#ff69b4' },
        { name: 'Upcoming Calls', value: String(upcomingCalls), icon: 'Calendar', color: '#3b82f6' },
        { name: 'Today Earnings', value: `₹${todayEarningsVal.toLocaleString('en-IN')}`, icon: 'DollarSign', color: '#f59e0b' },
        { name: 'Adherence', value: `${adherenceVal}%`, icon: 'TrendingUp', color: '#10b981' }
      ],
      'This Week': [
        { name: 'Sessions Week', value: String(weekSessions.length), icon: 'CheckCircle', color: '#ff69b4' },
        { name: 'Upcoming Calls', value: String(upcomingCalls), icon: 'Calendar', color: '#3b82f6' },
        { name: 'Week Earnings', value: `₹${(todayEarningsVal * 5).toLocaleString('en-IN')}`, icon: 'DollarSign', color: '#f59e0b' },
        { name: 'Advisory Score', value: String(advisor.rating), icon: 'Sparkles', color: '#8b5cf6' }
      ]
    },
    appointments: {
      Today: formatAptList(todaySessions),
      'This Week': formatAptList(weekSessions)
    },
    clinicalExcellence: {
      patientSatisfaction: '98%',
      completionRate: `${adherenceVal}%`,
      avgRating: `${advisor.rating}/5`,
      totalConsultations: allAppointments.length
    }
  };
};

/**
 * 12. Get own availability slots (Advisor action)
 */
const getMeAvailability = async (userId) => {
  const advisor = await prisma.advisor.findFirst({
    where: { userId, deletedAt: null }
  });

  if (!advisor) {
    throw new ApiError(404, 'ADVISOR_NOT_FOUND', 'Advisor profile not found.');
  }

  const slots = Array.isArray(advisor.availability) ? advisor.availability : [];
  
  const filteredSlots = slots.filter(s => ['available', 'booked'].includes(s.status));

  filteredSlots.sort((a, b) => {
    const dComp = a.date.localeCompare(b.date);
    if (dComp !== 0) return dComp;
    return a.startTime.localeCompare(b.startTime);
  });

  return {
    success: true,
    slots: filteredSlots.map(s => ({
      id: s.id,
      date: s.date,
      start_time: s.startTime,
      end_time: s.endTime,
      status: s.status
    }))
  };
};

const bulkSaveAvailability = async (userId, slotsList) => {
  const advisor = await prisma.advisor.findFirst({
    where: { userId, deletedAt: null }
  });

  if (!advisor) {
    throw new ApiError(404, 'ADVISOR_NOT_FOUND', 'Advisor profile not found.');
  }

  if (!Array.isArray(slotsList)) {
    throw new ApiError(400, 'BAD_REQUEST', 'slots list must be an array.');
  }

  const { randomUUID } = require('crypto');

  let slots = Array.isArray(advisor.availability) ? advisor.availability : [];

  const datesToSync = [...new Set(slotsList.map(s => s.date))];

  if (datesToSync.length === 0) {
    const today = new Date();
    today.setHours(0,0,0,0);
    const datesInRange = [];
    for (let i = 0; i <= 7; i++) {
      const d = new Date();
      d.setDate(today.getDate() + i);
      datesInRange.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }

    slots = slots.map(s => {
      if (datesInRange.includes(s.date) && s.status === 'available') {
        return { ...s, status: 'inactive' };
      }
      return s;
    });
  } else {
    const slotsMap = new Map();
    slots.forEach(s => {
      slotsMap.set(`${s.date}_${s.startTime}`, s);
    });

    const incomingKeys = new Set();

    for (const incomingSlot of slotsList) {
      const { date, startTime, endTime } = incomingSlot;
      const key = `${date}_${startTime}`;
      incomingKeys.add(key);

      const existing = slotsMap.get(key);
      if (existing) {
        if (existing.status !== 'booked') {
          existing.endTime = endTime;
          existing.status = 'available';
        }
      } else {
        const newSlot = {
          id: randomUUID(),
          date,
          startTime,
          endTime,
          status: 'available'
        };
        slotsMap.set(key, newSlot);
      }
    }

    for (const [key, slotObj] of slotsMap.entries()) {
      if (datesToSync.includes(slotObj.date) && !incomingKeys.has(key)) {
        if (slotObj.status === 'available') {
          slotObj.status = 'inactive';
        }
      }
    }

    slots = Array.from(slotsMap.values());
  }

  await prisma.advisor.update({
    where: { id: advisor.id },
    data: { availability: slots }
  });

  return {
    success: true,
    message: 'Weekly schedule synchronized successfully.'
  };
};


/**
 * 13. Retrieve chat threads
 */
const getChatThreads = async (userId, role) => {
  const currentUserId = userId;
  const isAdvisor = role.toLowerCase() === 'advisor';
  const partnerIds = new Set();

  const messages = await prisma.advisorChatMessage.findMany({
    where: {
      OR: [
        { senderId: currentUserId },
        { receiverId: currentUserId }
      ]
    },
    orderBy: { createdAt: 'desc' }
  });

  messages.forEach(m => {
    if (m.senderId !== currentUserId) partnerIds.add(m.senderId);
    if (m.receiverId !== currentUserId) partnerIds.add(m.receiverId);
  });

  if (isAdvisor) {
    const advisor = await prisma.advisor.findFirst({
      where: { userId: currentUserId, deletedAt: null }
    });
    if (advisor) {
      const appts = await prisma.appointment.findMany({
        where: { advisorId: advisor.id },
        select: { userId: true }
      });
      appts.forEach(a => partnerIds.add(a.userId));
    }
  } else {
    const appts = await prisma.appointment.findMany({
      where: { userId: currentUserId },
      include: { advisor: true }
    });
    appts.forEach(a => {
      if (a.advisor && a.advisor.userId) {
        partnerIds.add(a.advisor.userId);
      }
    });
  }

  const threads = [];
  for (const partnerId of partnerIds) {
    const partner = await prisma.user.findUnique({
      where: { id: partnerId },
      include: { profile: true, role: true }
    });
    if (!partner) continue;

    const partnerMessages = messages.filter(m =>
      (m.senderId === currentUserId && m.receiverId === partnerId) ||
      (m.senderId === partnerId && m.receiverId === currentUserId)
    );

    const lastMsg = partnerMessages[0];
    const unreadCount = partnerMessages.filter(m => m.receiverId === currentUserId && !m.isRead).length;

    threads.push({
      id: partner.id,
      memberName: partner.profile ? partner.profile.fullName : 'User',
      memberEmail: partner.email,
      advisor: partner.role.name === 'Advisor' ? (partner.profile ? partner.profile.fullName : 'Advisor') : undefined,
      lastMsg: lastMsg
        ? (lastMsg.contentType === 'image' ? '📷 Image' : lastMsg.contentType === 'file' ? '📁 Attachment' : lastMsg.text)
        : 'Session booked. Ready to chat.',
      time: lastMsg ? new Date(lastMsg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'now',
      unread: unreadCount,
      active: true
    });
  }

  return { success: true, threads };
};

/**
 * 14. Retrieve chat messages for a partner
 */
const getChatMessages = async (userId, role, partnerId) => {
  const currentUserId = userId;

  if (!partnerId) {
    throw new ApiError(400, 'BAD_REQUEST', 'Partner ID is required.');
  }

  const messages = await prisma.advisorChatMessage.findMany({
    where: {
      OR: [
        { senderId: currentUserId, receiverId: partnerId },
        { senderId: partnerId, receiverId: currentUserId }
      ]
    },
    orderBy: { createdAt: 'asc' }
  });

  await prisma.advisorChatMessage.updateMany({
    where: {
      senderId: partnerId,
      receiverId: currentUserId,
      isRead: false
    },
    data: { isRead: true }
  });

  return {
    success: true,
    messages: messages.map(m => ({
      id: m.id,
      senderType: m.senderId === currentUserId ? (role.toLowerCase() === 'advisor' ? 'advisor' : 'member') : (role.toLowerCase() === 'advisor' ? 'member' : 'advisor'),
      senderName: m.senderId === currentUserId ? 'You' : 'Partner',
      text: m.text,
      contentType: m.contentType,
      fileUrl: m.fileUrl,
      time: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isMine: m.senderId === currentUserId,
      status: m.isRead ? 'read' : 'sent'
    }))
  };
};

/**
 * 15. Send a chat message
 */
const sendChatMessage = async (userId, role, data) => {
  const currentUserId = userId;
  const { receiverId, text, contentType, fileUrl } = data;

  if (!receiverId || (!text && !fileUrl)) {
    throw new ApiError(400, 'BAD_REQUEST', 'Receiver ID and text or fileUrl are required.');
  }

  const msg = await prisma.advisorChatMessage.create({
    data: {
      senderId: currentUserId,
      receiverId,
      text: text || '',
      contentType: contentType || 'text',
      fileUrl: fileUrl || null,
      isRead: false
    }
  });

  // Create dynamic notification for receiver
  try {
    const senderProfile = await prisma.userProfile.findUnique({
      where: { userId: currentUserId }
    });
    const senderName = senderProfile?.fullName || 'Sakhi';
    const notificationsService = require('../notifications/notifications.service');
    await notificationsService.sendPushNotification(
      receiverId,
      `New chat from ${senderName}`,
      text || 'Sent an attachment',
      'chat'
    );
  } catch (err) {
    console.error('Failed to create notification for advisor chat message:', err);
  }

  return {
    success: true,
    message: {
      id: msg.id,
      senderType: role.toLowerCase() === 'advisor' ? 'advisor' : 'member',
      text: msg.text,
      contentType: msg.contentType,
      fileUrl: msg.fileUrl,
      time: new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  };
};

module.exports = {
  searchAdvisors,
  getAvailability,
  createAvailability,
  bookAppointment,
  getAppointments,
  submitNotes,
  getEarnings,
  requestPayout,
  rescheduleAppointment,
  cancelAppointment,
  confirmAppointment,
  getDashboardData,
  getMeAvailability,
  bulkSaveAvailability,
  getChatThreads,
  getChatMessages,
  sendChatMessage
};
