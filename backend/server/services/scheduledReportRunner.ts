import cron from 'node-cron';
import ScheduledReport from '../models/ScheduledReport.js';
import ReportTemplate from '../models/ReportTemplate.js';
import { generateReport } from './reportGenerationService.js';
import { notifyTeachersOfScheduledReport } from './reportNotificationService.js';
import { shouldRunNow, updateScheduleNextRun } from './scheduleUtils.js';

const DEFAULT_CRON = process.env.ADMIN_REPORTS_SCHEDULER_CRON || '*/5 * * * *';
const MAX_SCHEDULES_PER_TICK = Number(process.env.ADMIN_REPORTS_SCHEDULER_BATCH || 3);

let runnerStarted = false;
let tickInProgress = false;

const runDueSchedules = async () => {
  if (tickInProgress) {
    return;
  }

  tickInProgress = true;
  try {
    const now = new Date();
    const dueSchedules = await ScheduledReport.find({
      enabled: true,
      $or: [{ nextRunAt: { $exists: false } }, { nextRunAt: { $lte: now } }],
    })
      .sort({ nextRunAt: 1 })
      .limit(MAX_SCHEDULES_PER_TICK);

    for (const schedule of dueSchedules) {
      if (!shouldRunNow(schedule, now)) {
        if (!schedule.nextRunAt) {
          updateScheduleNextRun(schedule, now);
          await schedule.save();
        }
        continue;
      }

      try {
        const template = await ReportTemplate.findById(schedule.templateId);
        if (!template) {
          console.warn('[AdminReports] Scheduled template missing', schedule.templateId);
          schedule.lastRunStatus = 'failed';
          schedule.lastRunAt = new Date();
          updateScheduleNextRun(schedule, now);
          await schedule.save();
          continue;
        }

        schedule.templateSnapshot = {
          name: template.name,
          type: template.type,
        };
        const { report, warnings } = await generateReport({
          template,
          filters: schedule.filtersPreset,
          force: true,
          scheduleId: schedule._id.toString(),
          initiatedBy: 'scheduled-runner',
        });

        schedule.lastRunAt = new Date();
        schedule.lastRunStatus = 'success';
        schedule.lastRunReportId = report._id;
        updateScheduleNextRun(schedule, schedule.lastRunAt);
        await schedule.save();

        await notifyTeachersOfScheduledReport(schedule.recipients, {
          templateName: template.name,
          templateType: template.type,
          reportId: report._id.toString(),
          scheduleId: schedule._id.toString(),
          warnings,
          downloads: {
            pdf: report.files?.pdfUrl,
            csv: report.files?.csvUrl,
            png: report.files?.pngUrl,
          },
        });
      } catch (error) {
        console.error('[AdminReports] Failed to run schedule', schedule._id, error);
        schedule.lastRunAt = new Date();
        schedule.lastRunStatus = 'failed';
        updateScheduleNextRun(schedule, schedule.lastRunAt);
        await schedule.save();
      }
    }
  } finally {
    tickInProgress = false;
  }
};

export const startScheduledReportRunner = () => {
  if (runnerStarted) {
    return;
  }

  if (process.env.ADMIN_REPORTS_SCHEDULER === 'false') {
    console.log('[AdminReports] Scheduled runner disabled via env.');
    return;
  }

  cron.schedule(DEFAULT_CRON, () => {
    void runDueSchedules();
  });

  console.log('[AdminReports] Scheduled report runner started with cron:', DEFAULT_CRON);
  runnerStarted = true;
  // Kick off immediately
  void runDueSchedules();
};

