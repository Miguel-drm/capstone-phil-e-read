import { PDFDocument, StandardFonts } from 'pdf-lib';
import { GridFSService } from './gridfsService.js';
import type { IReportTemplate } from '../models/ReportTemplate.js';

export interface ReportExportParams {
  template: IReportTemplate;
  dataset: any;
  filters?: Record<string, any>;
}

export interface ReportExportResult {
  pdfFileId?: string;
  csvFileId?: string;
  pngFileId?: string;
}

const buildCsvRows = (dataset: any): Record<string, any>[] => {
  if (Array.isArray(dataset)) return dataset;
  if (dataset?.distribution) return dataset.distribution;
  if (dataset?.teacherStats) return dataset.teacherStats;
  if (dataset?.preview) return buildCsvRows(dataset.preview);
  return [{ message: 'No structured data available' }];
};

const toCsvString = (rows: Record<string, any>[]) => {
  if (rows.length === 0) return 'No data';
  const headers = Array.from(
    rows.reduce<Set<string>>((set, row) => {
      Object.keys(row || {}).forEach((key) => set.add(key));
      return set;
    }, new Set())
  );
  const lines = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((field) => {
          const value = row?.[field];
          if (value === null || value === undefined) return '';
          if (value instanceof Date) return value.toISOString();
          const formatted = String(value).replace(/"/g, '""');
          return /[",\n]/.test(formatted) ? `"${formatted}"` : formatted;
        })
        .join(',')
    ),
  ];
  return lines.join('\n');
};

const buildSummaryLines = (template: IReportTemplate, dataset: any, filters?: Record<string, any>) => {
  const lines = [`Template: ${template.name}`, `Type: ${template.type}`];
  if (filters && Object.keys(filters).length > 0) {
    lines.push('Filters applied:');
    Object.entries(filters).forEach(([key, value]) => {
      lines.push(`• ${key}: ${value}`);
    });
  }
  if (dataset?.overallLevels) {
    lines.push(
      `Overall Levels - Independent: ${dataset.overallLevels.independent}, Instructional: ${dataset.overallLevels.instructional}, Frustration: ${dataset.overallLevels.frustration}`
    );
  }
  if (Array.isArray(dataset)) {
    lines.push(`Rows included: ${dataset.length}`);
  }
  return lines;
};

const placeholderPngBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAOklEQVR4nO3PsQkAMAgDQfP+dwcEJWAjJNyv1h1SZXp6enp6enp6erq5cQ35328w5W2vZco0aJFixYtwG9kBNNn+8nGAAAAAElFTkSuQmCC',
  'base64'
);

export const reportExportService = {
  async generateExports({ template, dataset, filters }: ReportExportParams): Promise<ReportExportResult> {
    const rows = buildCsvRows(dataset);

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const { height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const title = `Phil-IRI Report • ${template.name}`;
    page.drawText(title, {
      x: 40,
      y: height - 60,
      size: 18,
      font,
    });

    const summaryLines = buildSummaryLines(template, dataset, filters);
    summaryLines.forEach((line, index) => {
      page.drawText(line, {
        x: 40,
        y: height - 100 - index * 16,
        size: 12,
        font,
      });
    });

    const pdfBytes = await pdfDoc.save();
    const pdfFileId = await GridFSService.uploadFile(Buffer.from(pdfBytes), `report-${template.type}.pdf`, {
      contentType: 'application/pdf',
      templateType: template.type,
    });

    const csvString = toCsvString(rows);
    const csvFileId = await GridFSService.uploadFile(Buffer.from(csvString, 'utf-8'), `report-${template.type}.csv`, {
      contentType: 'text/csv',
      templateType: template.type,
    });

    const pngFileId = await GridFSService.uploadFile(placeholderPngBuffer, `report-${template.type}.png`, {
      contentType: 'image/png',
      templateType: template.type,
      note: 'Placeholder chart image',
    });

    return {
      pdfFileId: pdfFileId.toString(),
      csvFileId: csvFileId.toString(),
      pngFileId: pngFileId.toString(),
    };
  },
};

export default reportExportService;

