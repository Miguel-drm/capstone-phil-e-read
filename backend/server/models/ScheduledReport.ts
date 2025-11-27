import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IScheduledReport extends Document {
  templateId: Schema.Types.ObjectId;
  templateSnapshot?: {
    name: string;
    type: string;
  };
  frequency: 'daily' | 'weekly' | 'monthly';
  timeOfDayLocal: string;
  recipients: string[];
  filtersPreset: Record<string, any>;
  nextRunAt?: Date;
  lastRunAt?: Date;
  lastRunStatus?: 'success' | 'failed' | 'pending';
  lastRunReportId?: Schema.Types.ObjectId;
  enabled: boolean;
  createdBy?: string;
}

const scheduledReportSchema = new Schema<IScheduledReport>(
  {
    templateId: { type: Schema.Types.ObjectId, ref: 'ReportTemplate', required: true },
    templateSnapshot: {
      name: { type: String },
      type: { type: String },
    },
    frequency: { type: String, enum: ['daily', 'weekly', 'monthly'], required: true },
    timeOfDayLocal: { type: String, default: '02:00' },
    recipients: { type: [String], default: [] },
    filtersPreset: { type: Schema.Types.Mixed, default: {} },
    nextRunAt: { type: Date },
    lastRunAt: { type: Date },
    lastRunStatus: { type: String, enum: ['success', 'failed', 'pending'], default: 'pending' },
    lastRunReportId: { type: Schema.Types.ObjectId, ref: 'GeneratedReport' },
    enabled: { type: Boolean, default: true },
    createdBy: { type: String },
  },
  {
    collection: 'ScheduledReports',
    timestamps: true,
  }
);

scheduledReportSchema.index({ templateId: 1, enabled: 1 });
scheduledReportSchema.index({ nextRunAt: 1, enabled: 1 });

export const ScheduledReport: Model<IScheduledReport> =
  mongoose.models.ScheduledReport ||
  mongoose.model<IScheduledReport>('ScheduledReport', scheduledReportSchema);

export default ScheduledReport;

