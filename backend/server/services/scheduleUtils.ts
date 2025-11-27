import type { IScheduledReport } from '../models/ScheduledReport.js';

const clampTime = (time?: string) => {
  if (!time) return { hours: 2, minutes: 0 };
  const [rawHours, rawMinutes] = time.split(':').map((value) => Number.parseInt(value, 10));
  const hours = Number.isFinite(rawHours) ? Math.min(Math.max(rawHours, 0), 23) : 2;
  const minutes = Number.isFinite(rawMinutes) ? Math.min(Math.max(rawMinutes, 0), 59) : 0;
  return { hours, minutes };
};

export const computeNextRunAt = (
  frequency: IScheduledReport['frequency'],
  timeOfDayLocal: string,
  referenceDate: Date = new Date(),
): Date => {
  const next = new Date(referenceDate);
  const { hours, minutes } = clampTime(timeOfDayLocal);
  next.setSeconds(0, 0);
  next.setHours(hours, minutes, 0, 0);

  if (frequency === 'daily') {
    if (next <= referenceDate) {
      next.setDate(next.getDate() + 1);
    }
    return next;
  }

  if (frequency === 'weekly') {
    while (next <= referenceDate) {
      next.setDate(next.getDate() + 7);
    }
    return next;
  }

  // Monthly by default
  while (next <= referenceDate) {
    next.setMonth(next.getMonth() + 1);
  }
  return next;
};

export const shouldRunNow = (schedule: IScheduledReport, now: Date = new Date()): boolean => {
  if (!schedule.enabled) return false;
  if (!schedule.nextRunAt) return true;
  return schedule.nextRunAt.getTime() <= now.getTime();
};

export const updateScheduleNextRun = (schedule: IScheduledReport, fromDate?: Date) => {
  schedule.nextRunAt = computeNextRunAt(schedule.frequency, schedule.timeOfDayLocal, fromDate);
};

