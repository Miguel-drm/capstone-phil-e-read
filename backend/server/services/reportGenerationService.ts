import ReportTemplate, { type IReportTemplate } from '../models/ReportTemplate.js';
import GeneratedReport, { type IGeneratedReport } from '../models/GeneratedReport.js';
import { runDataQualityChecks, getTemplatePreviewData } from './reportAnalyticsService.js';
import { reportExportService } from './reportExportService.js';

interface GenerateReportOptions {
  templateId?: string;
  template?: IReportTemplate | null;
  filters?: Record<string, any>;
  initiatedBy?: string;
  force?: boolean;
  scheduleId?: string;
}

export interface GenerateReportResult {
  report: IGeneratedReport;
  warnings: string[];
  requiresConfirmation: boolean;
}

const resolveTemplate = async (options: GenerateReportOptions) => {
  if (options.template) return options.template;
  if (!options.templateId) {
    throw new Error('templateId is required when template is not provided');
  }
  const template = await ReportTemplate.findById(options.templateId);
  if (!template) {
    throw new Error('Template not found');
  }
  return template;
};

const buildDownloadUrls = (reportId: string) => {
  const base = `/api/reports/history/${reportId}/download`;
  return {
    pdfUrl: `${base}?format=pdf`,
    csvUrl: `${base}?format=csv`,
    pngUrl: `${base}?format=png`,
  };
};

export const generateReport = async (options: GenerateReportOptions): Promise<GenerateReportResult> => {
  const template = await resolveTemplate(options);
  const warnings = await runDataQualityChecks();
  const requiresConfirmation = warnings.length > 0 && !options.force;

  if (requiresConfirmation) {
    const pendingReport = await GeneratedReport.create({
      templateId: template._id,
      templateSnapshot: {
        name: template.name,
        type: template.type,
      },
      filtersUsed: options.filters ?? {},
      generatedBy: options.initiatedBy,
      status: 'pending',
      dataQualityWarnings: warnings,
    });

    return {
      report: pendingReport,
      warnings,
      requiresConfirmation: true,
    };
  }

  const report = await GeneratedReport.create({
    templateId: template._id,
    templateSnapshot: {
      name: template.name,
      type: template.type,
    },
    filtersUsed: options.filters ?? {},
    generatedBy: options.initiatedBy,
    status: 'processing',
    scheduleId: options.scheduleId,
    dataQualityWarnings: warnings,
  });

  try {
    const dataset = await getTemplatePreviewData(template.type);
    const exportResult = await reportExportService.generateExports({
      template,
      dataset,
      filters: options.filters ?? {},
    });

    const downloads = buildDownloadUrls(report._id.toString());

    report.files = {
      pdfFileId: exportResult.pdfFileId,
      csvFileId: exportResult.csvFileId,
      pngFileId: exportResult.pngFileId,
      pdfUrl: downloads.pdfUrl,
      csvUrl: downloads.csvUrl,
      pngUrl: downloads.pngUrl,
    };

    report.status = 'success';
    await report.save();

    return {
      report,
      warnings,
      requiresConfirmation: false,
    };
  } catch (error) {
    report.status = 'failed';
    report.errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await report.save();
    throw error;
  }
};

