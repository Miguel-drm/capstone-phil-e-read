import axios from 'axios';

const ensureReportsPath = (baseUrl: string): string => {
  const trimmed = baseUrl.replace(/\/$/, '');
  if (trimmed.endsWith('/api/reports')) {
    return trimmed;
  }
  if (trimmed.endsWith('/reports')) {
    return trimmed;
  }
  if (trimmed.endsWith('/api')) {
    return `${trimmed}/reports`;
  }
  return `${trimmed}/api/reports`;
};

const resolveApiBaseUrl = (): string => {
  const explicitReportsUrl = import.meta.env.VITE_ADMIN_REPORTS_API_URL;
  if (explicitReportsUrl && explicitReportsUrl.trim()) {
    return ensureReportsPath(explicitReportsUrl.trim());
  }

  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && String(envUrl).trim()) {
    return ensureReportsPath(String(envUrl).trim());
  }

  if (typeof window !== 'undefined') {
    const { hostname, origin } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return ensureReportsPath(origin);
    }
  }

  // Fallback to hosted API (requires backend flag enabled in production)
  return ensureReportsPath('https://phileread-api.onrender.com');
};

const API_BASE_URL = resolveApiBaseUrl();

export interface AdminReportTemplate {
  _id: string;
  name: string;
  type: string;
  description?: string;
  category: string;
  filtersSchema?: Record<string, any>;
  settings?: {
    exportFormats?: string[];
    aiInsightsEnabled?: boolean;
    quickActions?: string[];
    notifications?: boolean;
  };
  favoriteBy?: string[];
  isArchived?: boolean;
}

export interface GeneratedReportSummary {
  _id: string;
  templateId: string;
  templateSnapshot: {
    name: string;
    type: string;
    version?: string;
  };
  status: 'pending' | 'success' | 'failed';
  generatedAt: string;
  generatedBy?: string;
  files?: {
    pdfUrl?: string;
    csvUrl?: string;
    pngUrl?: string;
    pdfFileId?: string;
    csvFileId?: string;
    pngFileId?: string;
  };
  dataQualityWarnings?: string[];
}

export interface ScheduledReportSummary {
  _id: string;
  templateId: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  timeOfDayLocal: string;
  recipients: string[];
  enabled: boolean;
  nextRunAt?: string;
  lastRunStatus?: 'success' | 'failed' | 'pending';
}

export interface GenerateReportResponse {
  reportId: string;
  message: string;
  warnings?: string[];
}

export interface AnalyticsOverview {
  distribution: Array<{
    grade: string;
    independent: number;
    instructional: number;
    frustration: number;
    total: number;
  }>;
  overallLevels: {
    independent: number;
    instructional: number;
    frustration: number;
    total: number;
  };
  trends: Array<{
    studentName: string;
    gradeSection?: string;
    assessmentDate: string;
    wpm: number;
    comprehensionLevel: string;
    wordReadingLevel: string;
  }>;
  teacherCompliance: {
    submitted: number;
    late: number;
    complianceScore: number;
  };
}

export interface TemplatePreviewResponse {
  templateId: string;
  type: string;
  preview: unknown;
}

const adminReportService = {
  async listTemplates(params?: { category?: string; includeArchived?: boolean }) {
    const response = await axios.get(`${API_BASE_URL}/templates`, { params });
    return response.data.templates as AdminReportTemplate[];
  },

  async toggleFavorite(templateId: string, userId: string, favorite: boolean) {
    const response = await axios.post(`${API_BASE_URL}/templates/${templateId}/favorite`, {
      userId,
      favorite,
    });
    return response.data as AdminReportTemplate;
  },

  async updateTemplate(templateId: string, updates: Partial<AdminReportTemplate>) {
    const response = await axios.patch(`${API_BASE_URL}/templates/${templateId}`, updates);
    return response.data as AdminReportTemplate;
  },

  async fetchHistory(params?: { templateType?: string }) {
    const response = await axios.get(`${API_BASE_URL}/history`, { params });
    return response.data.reports as GeneratedReportSummary[];
  },

  async generateReport(payload: { templateId: string; filters?: Record<string, any>; force?: boolean }) {
    const response = await axios.post(`${API_BASE_URL}/generate`, payload);
    return response.data as GenerateReportResponse;
  },

  async fetchSchedules() {
    const response = await axios.get(`${API_BASE_URL}/schedules`);
    return response.data.schedules as ScheduledReportSummary[];
  },

  async createSchedule(payload: {
    templateId: string;
    frequency: 'daily' | 'weekly' | 'monthly';
    timeOfDayLocal: string;
    recipients: string[];
    filtersPreset?: Record<string, any>;
  }) {
    const response = await axios.post(`${API_BASE_URL}/schedules`, payload);
    return response.data as ScheduledReportSummary;
  },

  async updateSchedule(scheduleId: string, updates: Partial<ScheduledReportSummary>) {
    const response = await axios.patch(`${API_BASE_URL}/schedules/${scheduleId}`, updates);
    return response.data as ScheduledReportSummary;
  },

  async deleteSchedule(scheduleId: string) {
    await axios.delete(`${API_BASE_URL}/schedules/${scheduleId}`);
    return true;
  },

  async getAnalyticsOverview() {
    const response = await axios.get(`${API_BASE_URL}/analytics/overview`);
    return response.data as AnalyticsOverview;
  },

  async getTemplatePreview(templateId: string) {
    const response = await axios.get(`${API_BASE_URL}/templates/${templateId}/preview`);
    return response.data as TemplatePreviewResponse;
  },

  getDownloadUrl(reportId: string, format: 'pdf' | 'csv' | 'png' = 'pdf') {
    const url = new URL(`${API_BASE_URL}/history/${reportId}/download`);
    url.searchParams.set('format', format);
    return url.toString();
  },
};

export default adminReportService;

