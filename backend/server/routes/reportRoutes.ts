import { Router, Request, Response } from 'express';
import ReportTemplate from '../models/ReportTemplate.js';
import GeneratedReport from '../models/GeneratedReport.js';
import ScheduledReport from '../models/ScheduledReport.js';
import {
  getAnalyticsOverview,
  getTemplatePreviewData,
} from '../services/reportAnalyticsService.js';
import GridFSService from '../services/gridfsService.js';
import { generateReport } from '../services/reportGenerationService.js';
import { updateScheduleNextRun } from '../services/scheduleUtils.js';

const router = Router();

const DEFAULT_TEMPLATES = [
  {
    name: 'Phil-IRI Assessment Summary',
    type: 'phil-iri-summary',
    description: 'Reading level, WPM, accuracy, errors, comprehension per student.',
    category: 'academic',
    settings: {
      exportFormats: ['pdf', 'csv'],
      aiInsightsEnabled: true,
      quickActions: ['student-report'],
      notifications: false,
    },
  },
  {
    name: 'Reading Level Distribution',
    type: 'reading-level-distribution',
    description: 'Independent vs Instructional vs Frustration percentages per grade.',
    category: 'performance',
    settings: {
      exportFormats: ['pdf', 'png', 'csv'],
      aiInsightsEnabled: true,
      quickActions: ['analytics'],
      notifications: false,
    },
  },
  {
    name: 'Teacher ISR Submissions',
    type: 'teacher-isr-submissions',
    description: 'Submitted, pending, late ISR forms with compliance scoring.',
    category: 'administrative',
    settings: {
      exportFormats: ['pdf', 'csv'],
      aiInsightsEnabled: false,
      quickActions: ['teacher-activity'],
      notifications: true,
    },
  },
];

let initializedTemplates = false;
const ensureDefaultTemplates = async () => {
  if (initializedTemplates) return;
  const count = await ReportTemplate.countDocuments();
  if (count === 0) {
    await ReportTemplate.insertMany(DEFAULT_TEMPLATES);
  }
  initializedTemplates = true;
};

// Templates
router.get('/templates', async (req: Request, res: Response) => {
  try {
    await ensureDefaultTemplates();
    const { category, includeArchived } = req.query;
    const filter: Record<string, any> = {};
    if (category) filter.category = category;
    if (!includeArchived) filter.isArchived = false;
    const templates = await ReportTemplate.find(filter).lean();
    res.json({ templates });
  } catch (error) {
    console.error('[Reports] Failed to list templates', error);
    res.status(500).json({ error: 'Failed to fetch report templates' });
  }
});

router.post('/templates', async (req: Request, res: Response) => {
  try {
    const template = await ReportTemplate.create(req.body);
    res.status(201).json(template);
  } catch (error) {
    console.error('[Reports] Failed to create template', error);
    res.status(400).json({ error: 'Unable to create template' });
  }
});

router.patch('/templates/:id', async (req: Request, res: Response) => {
  try {
    const template = await ReportTemplate.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );
    if (!template) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }
    res.json(template);
  } catch (error) {
    console.error('[Reports] Failed to update template', error);
    res.status(400).json({ error: 'Unable to update template' });
  }
});

router.post('/templates/:id/archive', async (req: Request, res: Response) => {
  try {
    const template = await ReportTemplate.findByIdAndUpdate(
      req.params.id,
      { isArchived: req.body.isArchived ?? true },
      { new: true }
    );
    if (!template) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }
    res.json(template);
  } catch (error) {
    console.error('[Reports] Failed to archive template', error);
    res.status(400).json({ error: 'Unable to archive template' });
  }
});

router.post('/templates/:id/favorite', async (req: Request, res: Response) => {
  try {
    const { userId, favorite } = req.body;
    if (!userId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }
    const update = favorite
      ? { $addToSet: { favoriteBy: userId } }
      : { $pull: { favoriteBy: userId } };
    const template = await ReportTemplate.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!template) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }
    res.json(template);
  } catch (error) {
    console.error('[Reports] Failed to toggle favorite', error);
    res.status(400).json({ error: 'Unable to update favorite state' });
  }
});

router.get('/templates/:id/preview', async (req: Request, res: Response) => {
  try {
    const template = await ReportTemplate.findById(req.params.id);
    if (!template) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    const preview = await getTemplatePreviewData(template.type);
    res.json({ templateId: template._id, type: template.type, preview });
  } catch (error) {
    console.error('[Reports] Failed to fetch template preview', error);
    res.status(500).json({ error: 'Unable to fetch preview data' });
  }
});

// Generated report history
router.get('/history', async (req: Request, res: Response) => {
  try {
    const { templateType } = req.query;
    const filter: Record<string, any> = {};
    if (templateType) filter['templateSnapshot.type'] = templateType;
    const history = await GeneratedReport.find(filter)
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json({ reports: history });
  } catch (error) {
    console.error('[Reports] Failed to fetch history', error);
    res.status(500).json({ error: 'Unable to fetch generated reports' });
  }
});

// Placeholder generate endpoint
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { templateId, filters = {}, force, requestedBy } = req.body;
    const result = await generateReport({
      templateId,
      filters,
      force,
      initiatedBy: requestedBy,
    });

    res.status(202).json({
      reportId: result.report._id,
      message: result.requiresConfirmation ? 'Warnings detected, confirmation required.' : 'Report generated.',
      warnings: result.warnings,
      requiresConfirmation: result.requiresConfirmation,
    });
  } catch (error) {
    console.error('[Reports] Failed to generate report', error);
    res.status(500).json({ error: 'Unable to start report generation' });
  }
});

router.get('/analytics/overview', async (_req: Request, res: Response) => {
  try {
    const overview = await getAnalyticsOverview();
    res.json(overview);
  } catch (error) {
    console.error('[Reports] Failed to fetch analytics overview', error);
    res.status(500).json({ error: 'Unable to fetch analytics overview' });
  }
});

router.get('/history/:id/download', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const format = (String(req.query.format || 'pdf').toLowerCase() as 'pdf' | 'csv' | 'png');
    const report = await GeneratedReport.findById(id);
    if (!report) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }

    const fileId =
      format === 'csv'
        ? report.files?.csvFileId
        : format === 'png'
          ? report.files?.pngFileId
          : report.files?.pdfFileId;

    if (!fileId) {
      res.status(404).json({ error: 'Requested file not available for this report' });
      return;
    }

    const file = await GridFSService.downloadFile(fileId);
    const filename = `${report.templateSnapshot.name || 'report'}.${format}`;
    res.setHeader('Content-Type', file.metadata?.contentType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(file.buffer);
  } catch (error) {
    console.error('[Reports] Failed to download report file', error);
    res.status(500).json({ error: 'Unable to download report file' });
  }
});

// Scheduling
router.get('/schedules', async (_req: Request, res: Response) => {
  try {
    const schedules = await ScheduledReport.find({}).lean();
    res.json({ schedules });
  } catch (error) {
    console.error('[Reports] Failed to fetch schedules', error);
    res.status(500).json({ error: 'Unable to fetch schedules' });
  }
});

router.post('/schedules', async (req: Request, res: Response) => {
  try {
    const template = await ReportTemplate.findById(req.body.templateId);
    if (!template) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    const schedule = new ScheduledReport({
      ...req.body,
      templateSnapshot: {
        name: template.name,
        type: template.type,
      },
    });

    if (!schedule.nextRunAt) {
      updateScheduleNextRun(schedule);
    }

    await schedule.save();
    res.status(201).json(schedule);
  } catch (error) {
    console.error('[Reports] Failed to create schedule', error);
    res.status(400).json({ error: 'Unable to create schedule' });
  }
});

router.patch('/schedules/:id', async (req: Request, res: Response) => {
  try {
    const schedule = await ScheduledReport.findById(req.params.id);
    if (!schedule) {
      res.status(404).json({ error: 'Schedule not found' });
      return;
    }

    if (req.body.templateId) {
      const template = await ReportTemplate.findById(req.body.templateId);
      if (!template) {
        res.status(404).json({ error: 'Template not found' });
        return;
      }
      schedule.templateId = template._id;
      schedule.templateSnapshot = {
        name: template.name,
        type: template.type,
      };
    }

    const updatableFields: (keyof typeof schedule)[] = [
      'frequency',
      'timeOfDayLocal',
      'recipients',
      'filtersPreset',
      'enabled',
      'createdBy',
    ];

    updatableFields.forEach((field) => {
      if (field in req.body) {
        // @ts-expect-error - dynamic assignment
        schedule[field] = req.body[field];
      }
    });

    if (!schedule.nextRunAt || req.body.frequency || req.body.timeOfDayLocal || req.body.resetNextRun || req.body.enabled) {
      updateScheduleNextRun(schedule);
    }

    await schedule.save();
    res.json(schedule);
  } catch (error) {
    console.error('[Reports] Failed to update schedule', error);
    res.status(400).json({ error: 'Unable to update schedule' });
  }
});

router.delete('/schedules/:id', async (req: Request, res: Response) => {
  try {
    const schedule = await ScheduledReport.findByIdAndDelete(req.params.id);
    if (!schedule) {
      res.status(404).json({ error: 'Schedule not found' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    console.error('[Reports] Failed to delete schedule', error);
    res.status(400).json({ error: 'Unable to delete schedule' });
  }
});

export default router;

