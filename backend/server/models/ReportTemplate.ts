import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IReportTemplate extends Document {
  name: string;
  type: 'phil-iri-summary' | 'reading-level-distribution' | 'teacher-isr-submissions' | string;
  description?: string;
  filtersSchema: Record<string, any>;
  category: 'academic' | 'performance' | 'administrative' | string;
  visibility: {
    rolesAllowed: string[];
    userIds?: string[];
  };
  settings: {
    exportFormats: string[];
    aiInsightsEnabled: boolean;
    quickActions: string[];
    notifications: boolean;
  };
  favoriteBy: string[];
  isArchived: boolean;
  createdBy?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const visibilitySchema = new Schema(
  {
    rolesAllowed: { type: [String], default: ['admin'] },
    userIds: { type: [String], default: [] },
  },
  { _id: false }
);

const settingsSchema = new Schema(
  {
    exportFormats: { type: [String], default: ['pdf'] },
    aiInsightsEnabled: { type: Boolean, default: false },
    quickActions: { type: [String], default: [] },
    notifications: { type: Boolean, default: false },
  },
  { _id: false }
);

const reportTemplateSchema = new Schema<IReportTemplate>(
  {
    name: { type: String, required: true },
    type: { type: String, required: true },
    description: { type: String },
    filtersSchema: { type: Schema.Types.Mixed, default: {} },
    category: { type: String, default: 'academic' },
    visibility: { type: visibilitySchema, default: () => ({}) },
    settings: { type: settingsSchema, default: () => ({}) },
    favoriteBy: { type: [String], default: [] },
    isArchived: { type: Boolean, default: false },
    createdBy: { type: String },
    updatedBy: { type: String },
  },
  {
    timestamps: true,
    collection: 'ReportTemplates',
  }
);

reportTemplateSchema.index({ type: 1 }, { unique: false });

export const ReportTemplate: Model<IReportTemplate> =
  mongoose.models.ReportTemplate ||
  mongoose.model<IReportTemplate>('ReportTemplate', reportTemplateSchema);

export default ReportTemplate;

