import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IGeneratedReport extends Document {
  templateId: Schema.Types.ObjectId;
  templateSnapshot: {
    name: string;
    type: string;
    version?: string;
  };
  filtersUsed: Record<string, any>;
  generatedBy?: string;
  generatedAt: Date;
  status: 'pending' | 'success' | 'failed';
  files: {
    pdfUrl?: string;
    csvUrl?: string;
    pngUrl?: string;
    pdfFileId?: string;
    csvFileId?: string;
    pngFileId?: string;
  };
  aiInsights?: string[];
  dataQualityWarnings: string[];
  favoriteByUserIds: string[];
  sharedWith: string[];
  scheduleId?: Schema.Types.ObjectId;
  errorMessage?: string;
}

const generatedReportSchema = new Schema<IGeneratedReport>(
  {
    templateId: { type: Schema.Types.ObjectId, ref: 'ReportTemplate', required: true },
    templateSnapshot: {
      name: { type: String, required: true },
      type: { type: String, required: true },
      version: { type: String },
    },
    filtersUsed: { type: Schema.Types.Mixed, default: {} },
    generatedBy: { type: String },
    generatedAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['pending', 'success', 'failed'], default: 'pending' },
    files: {
      pdfUrl: { type: String },
      csvUrl: { type: String },
      pngUrl: { type: String },
      pdfFileId: { type: String },
      csvFileId: { type: String },
      pngFileId: { type: String },
    },
    aiInsights: { type: [String], default: [] },
    dataQualityWarnings: { type: [String], default: [] },
    favoriteByUserIds: { type: [String], default: [] },
    sharedWith: { type: [String], default: [] },
    scheduleId: { type: Schema.Types.ObjectId, ref: 'ScheduledReport' },
    errorMessage: { type: String },
  },
  {
    collection: 'GeneratedReports',
    timestamps: true,
  }
);

generatedReportSchema.index({ templateId: 1, generatedAt: -1 });

export const GeneratedReport: Model<IGeneratedReport> =
  mongoose.models.GeneratedReport ||
  mongoose.model<IGeneratedReport>('GeneratedReport', generatedReportSchema);

export default GeneratedReport;

