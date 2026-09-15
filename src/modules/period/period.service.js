const periodRepository = require('./period.repository');
const { ApiError } = require('../../middlewares/errorHandler');
const prisma = require('../../config/database');
const predictionEngine = require('./predictionEngine');

const { normalizeToMidnight, addDays, differenceInDays, formatDateUTC, getPredictions } = predictionEngine;

const monthNamesHelper = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// Validation helpers
const validateProfileData = (data) => {
  if (data.cycleLength !== undefined) {
    const len = parseInt(data.cycleLength, 10);
    if (isNaN(len) || len < 21 || len > 45) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Cycle length must be between 21 and 45 days.');
    }
  }
  if (data.periodLength !== undefined) {
    const len = parseInt(data.periodLength, 10);
    if (isNaN(len) || len < 2 || len > 10) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Period length must be between 2 and 10 days.');
    }
  }
  if (data.lastPeriodDate !== undefined) {
    const parsedDate = normalizeToMidnight(data.lastPeriodDate);
    const today = normalizeToMidnight(new Date());
    if (parsedDate > today) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Last period date cannot be in the future.');
    }
  }
};

const validateLogData = async (userId, start, end) => {
  const today = normalizeToMidnight(new Date());
  const normStart = normalizeToMidnight(start);
  const normEnd = end ? normalizeToMidnight(end) : normStart;

  if (normStart > today) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Start date cannot be in the future.');
  }
  if (end && normEnd < normStart) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'End date cannot be before start date.');
  }

  // Get all existing period logs to check for overlaps/duplicates
  const existingLogs = await prisma.periodLog.findMany({
    where: { userId }
  });

  for (const log of existingLogs) {
    const eStart = normalizeToMidnight(log.startDate);
    const eEnd = log.endDate ? normalizeToMidnight(log.endDate) : eStart;

    if (normStart.getTime() === eStart.getTime()) {
      throw new ApiError(400, 'OVERLAP_ERROR', 'A period log with this start date already exists.', { overlappingLogId: log.id });
    }

    // Overlap condition: start <= eEnd && end >= eStart
    if (normStart <= eEnd && normEnd >= eStart) {
      throw new ApiError(400, 'OVERLAP_ERROR', 'The selected dates overlap with an existing period log.', { overlappingLogId: log.id });
    }
  }
};

const getOrCreateProfile = async (userId) => {
  let profile = await periodRepository.getProfileByUserId(userId);
  if (!profile) {
    try {
      profile = await periodRepository.createProfile({
        userId,
        cycleLength: 28,
        periodLength: 5,
        lastPeriodDate: normalizeToMidnight(new Date())
      });
    } catch (err) {
      if (err.code === 'P2002') {
        profile = await periodRepository.getProfileByUserId(userId);
      } else {
        throw err;
      }
    }
  }
  return profile;
};

// ── GET PROFILE ──────────────────────────────────────────────────────────────
const getProfile = async (userId) => {
  return await getOrCreateProfile(userId);
};

// ── SETUP PROFILE ────────────────────────────────────────────────────────────
const setupProfile = async (userId, profileData) => {
  const existingProfile = await periodRepository.getProfileByUserId(userId);
  if (existingProfile) {
    throw new ApiError(400, 'PROFILE_EXISTS', 'Period profile already exists for this user.');
  }

  validateProfileData(profileData);

  const cycleLength = parseInt(profileData.cycleLength, 10) || 28;
  const periodLength = parseInt(profileData.periodLength, 10) || 5;
  const lastPeriodDate = normalizeToMidnight(profileData.lastPeriodDate);

  const profile = await periodRepository.createProfile({
    userId,
    cycleLength,
    periodLength,
    lastPeriodDate
  });

  // Automatically create a period log for the setup lastPeriodDate
  await prisma.periodLog.create({
    data: {
      userId,
      logDate: lastPeriodDate,
      startDate: lastPeriodDate,
      endDate: addDays(lastPeriodDate, periodLength - 1),
      periodLength,
      flow: 'Medium',
      notes: 'Initial setup cycle'
    }
  });

  return profile;
};

// ── OPTIMIZED PAYLOAD GENERATOR ──────────────────────────────────────────────
const getOptimizedPayload = async (userId, targetDateInput, month, year) => {
  const profile = await getOrCreateProfile(userId);
  const targetDate = targetDateInput ? normalizeToMidnight(targetDateInput) : normalizeToMidnight(new Date());

  const dashboard = await getDashboardData(userId, profile, targetDate);
  const calendar = await getCalendarData(userId, profile, month || (targetDate.getUTCMonth() + 1), year || targetDate.getUTCFullYear());
  const history = await getLogs(userId, 50, 0);

  return {
    profile,
    dashboard,
    calendar,
    history
  };
};

// ── UPDATE PROFILE ───────────────────────────────────────────────────────────
const updateProfile = async (userId, updateData, month, year) => {
  const profile = await getOrCreateProfile(userId);

  validateProfileData(updateData);

  const dataToUpdate = {};
  if (updateData.cycleLength !== undefined) dataToUpdate.cycleLength = parseInt(updateData.cycleLength, 10);
  if (updateData.periodLength !== undefined) dataToUpdate.periodLength = parseInt(updateData.periodLength, 10);
  if (updateData.lastPeriodDate !== undefined) dataToUpdate.lastPeriodDate = normalizeToMidnight(updateData.lastPeriodDate);

  const updatedProfile = await periodRepository.updateProfile(userId, dataToUpdate);

  // If lastPeriodDate changed, also ensure we update or log it appropriately
  if (updateData.lastPeriodDate !== undefined) {
    const normLast = normalizeToMidnight(updateData.lastPeriodDate);
    // Check if there is an existing log around that date, else create one
    const existing = await prisma.periodLog.findFirst({
      where: {
        userId,
        startDate: normLast
      }
    });
    if (!existing) {
      // Find and delete the virtual or initial setup log to prevent duplicate clutter
      await prisma.periodLog.deleteMany({
        where: {
          userId,
          notes: 'Initial setup cycle'
        }
      });

      await prisma.periodLog.create({
        data: {
          userId,
          logDate: normLast,
          startDate: normLast,
          endDate: addDays(normLast, updatedProfile.periodLength - 1),
          periodLength: updatedProfile.periodLength,
          flow: 'Medium',
          notes: 'Initial setup cycle'
        }
      });
    }
  }

  return await getOptimizedPayload(userId, new Date(), month, year);
};

// ── START PERIOD ─────────────────────────────────────────────────────────────
const startPeriod = async (userId, startDateData, month, year) => {
  const profile = await getOrCreateProfile(userId);

  const start = normalizeToMidnight(startDateData.startDate);
  let end = startDateData.endDate ? normalizeToMidnight(startDateData.endDate) : null;

  let duration = 5;
  if (end) {
    duration = differenceInDays(end, start) + 1;
  } else {
    // Default to profile period length
    duration = profile.periodLength;
    end = addDays(start, duration - 1);
  }

  if (startDateData.deleteLogId) {
    await prisma.periodLog.delete({
      where: { id: startDateData.deleteLogId }
    });
  }

  if (!startDateData.deleteLogId) {
    const startYear = start.getUTCFullYear();
    const startMonth = start.getUTCMonth();

    const sameMonthLogs = await prisma.periodLog.findMany({
      where: { userId }
    });

    const duplicatesInMonth = sameMonthLogs.filter(log => {
      const logStart = normalizeToMidnight(log.startDate);
      return logStart.getUTCFullYear() === startYear && logStart.getUTCMonth() === startMonth;
    });

    if (duplicatesInMonth.length >= 2) {
      const formattedLogs = duplicatesInMonth.map(log => {
        const dStart = new Date(log.startDate);
        const dEnd = log.endDate ? new Date(log.endDate) : dStart;
        const formattedDates = `${dStart.getUTCDate()}-${dEnd.getUTCDate()} ${monthNamesHelper[dStart.getUTCMonth()]}`;
        return {
          id: log.id,
          startDate: log.startDate,
          endDate: log.endDate,
          formattedDates
        };
      });
      throw new ApiError(400, 'MAX_MONTHLY_LOGS_REACHED', 'A month can have a maximum of 2 logged periods. Please select which existing period to replace.', { existingLogs: formattedLogs });
    } else if (duplicatesInMonth.length === 1 && !startDateData.keepBoth) {
      const duplicateInMonth = duplicatesInMonth[0];
      const dStart = new Date(duplicateInMonth.startDate);
      const dEnd = duplicateInMonth.endDate ? new Date(duplicateInMonth.endDate) : dStart;
      const formattedDates = `${dStart.getUTCDate()}-${dEnd.getUTCDate()} ${monthNamesHelper[dStart.getUTCMonth()]}`;
      throw new ApiError(400, 'SAME_MONTH_WARNING', `You already have a logged period in this month (${formattedDates}). Do you want to replace it?`, { existingLogId: duplicateInMonth.id });
    }
  }

  await validateLogData(userId, start, end);

  await prisma.periodLog.create({
    data: {
      userId,
      logDate: start,
      startDate: start,
      endDate: end,
      periodLength: duration,
      flow: 'Medium',
      notes: 'Logged via Period Tracker Modal'
    }
  });

  // Update profile lastPeriodDate and periodLength based on the absolute latest log's start date
  const latestLog = await prisma.periodLog.findFirst({
    where: { userId },
    orderBy: { startDate: 'desc' }
  });

  if (latestLog) {
    await periodRepository.updateProfile(userId, {
      lastPeriodDate: normalizeToMidnight(latestLog.startDate),
      periodLength: latestLog.periodLength || profile.periodLength
    });
  }

  return await getOptimizedPayload(userId, new Date(), month, year);
};

// ── GET DASHBOARD DATA (INTERNAL) ────────────────────────────────────────────
const getDashboardData = async (userId, profile, targetDate) => {
  const logCount = await prisma.periodLog.count({ where: { userId } });
  if (logCount === 0) {
    return {
      hasData: false,
      cycleDay: null,
      cycleLength: profile ? profile.cycleLength : 28,
      periodLength: profile ? profile.periodLength : 5,
      nextPeriodDate: null,
      nextPeriodIn: null,
      ovulationDate: null,
      fertilityStatus: null,
      currentPhase: null,
      wellnessMessage: 'No period logged yet. Click "+ Log Period" to start tracking!'
    };
  }

  const preds = getPredictions(profile, targetDate);
  if (!preds) {
    return {
      hasData: false,
      cycleDay: null,
      cycleLength: profile ? profile.cycleLength : 28,
      periodLength: profile ? profile.periodLength : 5,
      nextPeriodDate: null,
      nextPeriodIn: null,
      ovulationDate: null,
      fertilityStatus: null,
      currentPhase: null,
      wellnessMessage: 'No period logged yet. Click "+ Log Period" to start tracking!'
    };
  }

  return {
    hasData: true,
    cycleDay: preds.cycleDay,
    cycleLength: preds.cycleLength,
    periodLength: preds.periodLength,
    nextPeriodDate: preds.nextPeriodDate,
    nextPeriodIn: preds.daysRemaining,
    ovulationDate: preds.ovulationDate,
    fertilityStatus: preds.fertilityStatus,
    currentPhase: preds.currentPhase,
    fertilityStart: preds.fertilityStart,
    fertilityEnd: preds.fertilityEnd,
    wellnessMessage: preds.wellnessMessage
  };
};

const getDashboard = async (userId, targetDateInput) => {
  const profile = await getOrCreateProfile(userId);
  const targetDate = targetDateInput ? normalizeToMidnight(targetDateInput) : normalizeToMidnight(new Date());
  return await getDashboardData(userId, profile, targetDate);
};

// ── GET CALENDAR DATA (INTERNAL) ─────────────────────────────────────────────
const getCalendarData = async (userId, profile, month, year) => {
  const logs = await prisma.periodLog.findMany({
    where: { userId }
  });

  const loggedPeriodDaysSet = new Set();
  const predictedPeriodDaysSet = new Set();
  const fertilityDaysSet = new Set();
  const ovulationDaysSet = new Set();

  if (logs.length > 0) {
    // Add historical logged period days
    for (const log of logs) {
      const start = normalizeToMidnight(log.startDate);
      const end = log.endDate ? normalizeToMidnight(log.endDate) : start;
      let curr = new Date(start);
      while (curr <= end) {
        loggedPeriodDaysSet.add(formatDateUTC(curr));
        curr = addDays(curr, 1);
      }
    }

  // Calculate exactly ONE future prediction cycle
  const preds = getPredictions(profile, new Date());
  if (preds) {
    const nextStart = normalizeToMidnight(preds.nextPeriodDate);
    const nextEnd = addDays(nextStart, profile.periodLength - 1);

    // Only add prediction if it doesn't overlap logged period days
    let currPred = new Date(nextStart);
    while (currPred <= nextEnd) {
      const formattedPred = formatDateUTC(currPred);
      if (!loggedPeriodDaysSet.has(formattedPred)) {
        predictedPeriodDaysSet.add(formattedPred);
      }
      currPred = addDays(currPred, 1);
    }

    // Ovulation & Fertile days (single prediction cycle)
    const ovulation = normalizeToMidnight(preds.ovulationDate);
    const fertStart = normalizeToMidnight(preds.fertilityStart);
    const fertEnd = normalizeToMidnight(preds.fertilityEnd);

    const formattedOvulation = formatDateUTC(ovulation);
    if (!loggedPeriodDaysSet.has(formattedOvulation) && !predictedPeriodDaysSet.has(formattedOvulation)) {
      ovulationDaysSet.add(formattedOvulation);
    }

    let currFert = new Date(fertStart);
    while (currFert <= fertEnd) {
      const formattedFert = formatDateUTC(currFert);
      if (
        !loggedPeriodDaysSet.has(formattedFert) &&
        !predictedPeriodDaysSet.has(formattedFert) &&
        formattedFert !== formattedOvulation
      ) {
        fertilityDaysSet.add(formattedFert);
      }
      currFert = addDays(currFert, 1);
    }
  }
}

  const targetMonthPrefix = `${year}-${String(month).padStart(2, '0')}`;

  const loggedPeriodDays = Array.from(loggedPeriodDaysSet).filter(d => d.startsWith(targetMonthPrefix));
  const predictedPeriodDays = Array.from(predictedPeriodDaysSet).filter(d => d.startsWith(targetMonthPrefix));
  const fertileDays = Array.from(fertilityDaysSet).filter(d => d.startsWith(targetMonthPrefix));
  const ovulationDays = Array.from(ovulationDaysSet).filter(d => d.startsWith(targetMonthPrefix));

  return {
    loggedPeriodDays,
    predictedPeriodDays,
    fertileDays,
    ovulationDays,
    today: formatDateUTC(new Date())
  };
};

const getCalendar = async (userId, month, year) => {
  const profile = await getOrCreateProfile(userId);
  return await getCalendarData(userId, profile, month, year);
};

// ── GET LOGS ─────────────────────────────────────────────────────────────────
const getLogs = async (userId, limit = 50, offset = 0) => {
  return await prisma.periodLog.findMany({
    where: { userId },
    orderBy: { startDate: 'desc' },
    take: limit,
    skip: offset
  });
};

// ── LOG PERIOD (SYMPTOMS/NOTES) ──────────────────────────────────────────────
const logPeriod = async (userId, logData) => {
  await getOrCreateProfile(userId);

  return await periodRepository.createLog({
    userId,
    logDate: normalizeToMidnight(logData.logDate),
    mood: logData.mood,
    pain: logData.pain,
    flow: logData.flow,
    energy: logData.energy,
    notes: logData.notes
  });
};

// ── RESET MONTH ─────────────────────────────────────────────────────────────
const resetMonth = async (userId, month, year) => {
  const targetMonth = parseInt(month, 10) || (new Date().getUTCMonth() + 1);
  const targetYear = parseInt(year, 10) || new Date().getUTCFullYear();

  const allLogs = await prisma.periodLog.findMany({
    where: { userId }
  });

  const logsToDelete = allLogs.filter(log => {
    const s = normalizeToMidnight(log.startDate);
    return s.getUTCFullYear() === targetYear && (s.getUTCMonth() + 1) === targetMonth;
  });

  if (logsToDelete.length > 0) {
    const ids = logsToDelete.map(l => l.id);
    await prisma.periodLog.deleteMany({
      where: {
        id: { in: ids }
      }
    });
  }

  // Update profile's lastPeriodDate to the latest remaining log's start date
  const latestLog = await prisma.periodLog.findFirst({
    where: { userId },
    orderBy: { startDate: 'desc' }
  });

  if (latestLog) {
    await periodRepository.updateProfile(userId, {
      lastPeriodDate: normalizeToMidnight(latestLog.startDate)
    });
  }

  return await getOptimizedPayload(userId, new Date(), targetMonth, targetYear);
};

module.exports = {
  setupProfile,
  getProfile,
  updateProfile,
  logPeriod,
  getLogs,
  getDashboard,
  getCalendar,
  startPeriod,
  getOptimizedPayload,
  resetMonth
};
