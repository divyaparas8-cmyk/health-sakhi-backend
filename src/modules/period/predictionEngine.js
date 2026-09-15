const normalizeToMidnight = (dateInput) => {
  const date = new Date(dateInput);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
};

const addDays = (date, days) => {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
};

const differenceInDays = (date1, date2) => {
  const d1 = normalizeToMidnight(date1);
  const d2 = normalizeToMidnight(date2);
  const diffTime = d1.getTime() - d2.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
};

const formatDateUTC = (date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getPredictions = (profile, targetDateInput) => {
  if (!profile || !profile.lastPeriodDate) {
    return null;
  }

  const cycleLength = profile.cycleLength || 28;
  const periodLength = profile.periodLength || 5;
  const lastPeriodDate = normalizeToMidnight(profile.lastPeriodDate);
  const targetDate = normalizeToMidnight(targetDateInput || new Date());

  // Calculations
  const nextPeriodDate = addDays(lastPeriodDate, cycleLength);
  const ovulationDate = addDays(nextPeriodDate, -14);
  const fertilityStart = addDays(ovulationDate, -5);
  const fertilityEnd = addDays(ovulationDate, 1);

  const cycleDay = differenceInDays(targetDate, lastPeriodDate) + 1;
  const daysRemaining = differenceInDays(nextPeriodDate, targetDate);

  // Phase calculation
  let currentPhase = 'Luteal';
  let fertilityStatus = 'Low';
  let wellnessMessage = 'Your cycle is healthy, Sakhi. Keep tracking!';

  const periodEnd = addDays(lastPeriodDate, periodLength - 1);

  if (targetDate >= lastPeriodDate && targetDate <= periodEnd) {
    currentPhase = 'Period';
    fertilityStatus = 'Low';
    wellnessMessage = 'Your period is currently active. Take proper rest and stay hydrated.';
  } else if (targetDate.getTime() === ovulationDate.getTime()) {
    currentPhase = 'Ovulation';
    fertilityStatus = 'High';
    wellnessMessage = 'Ovulation is today.';
  } else if (targetDate >= fertilityStart && targetDate <= fertilityEnd) {
    currentPhase = 'Fertile Window';
    fertilityStatus = 'High';
    wellnessMessage = 'You are currently in your fertile window.';
  } else if (targetDate > periodEnd && targetDate < fertilityStart) {
    currentPhase = 'Follicular';
    fertilityStatus = 'Low';
    wellnessMessage = 'You are in your follicular phase. Energy levels are rising!';
  } else {
    currentPhase = 'Luteal';
    fertilityStatus = 'Low';
    if (daysRemaining === 0) {
      wellnessMessage = 'Period expected today.';
    } else if (daysRemaining === 1) {
      wellnessMessage = 'Your next period starts tomorrow.';
    } else if (daysRemaining > 1 && daysRemaining <= 5) {
      wellnessMessage = `Your next period starts in ${daysRemaining} days.`;
    } else {
      wellnessMessage = 'You are in your luteal phase. Take care of your body.';
    }
  }

  // Double check "Ovulation is tomorrow" message condition
  const tomorrow = addDays(targetDate, 1);
  if (tomorrow.getTime() === ovulationDate.getTime() && currentPhase !== 'Period') {
    wellnessMessage = 'Ovulation is tomorrow.';
  }

  return {
    cycleDay: cycleDay > 0 ? cycleDay : null,
    cycleLength,
    periodLength,
    lastPeriodDate: formatDateUTC(lastPeriodDate),
    nextPeriodDate: formatDateUTC(nextPeriodDate),
    daysRemaining,
    ovulationDate: formatDateUTC(ovulationDate),
    fertilityStart: formatDateUTC(fertilityStart),
    fertilityEnd: formatDateUTC(fertilityEnd),
    fertilityStatus,
    currentPhase,
    wellnessMessage
  };
};

module.exports = {
  normalizeToMidnight,
  addDays,
  differenceInDays,
  formatDateUTC,
  getPredictions
};
