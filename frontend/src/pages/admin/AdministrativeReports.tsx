import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import adminReportService from '../../services/adminReportService';
import type {
  AdminReportTemplate,
  AnalyticsOverview,
  GeneratedReportSummary,
  ScheduledReportSummary,
} from '../../services/adminReportService';
import { useAuth } from '../../contexts/AuthContext';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

const FEATURE_FLAG = import.meta.env.VITE_FEATURE_ADMIN_REPORTS === 'true';
const REPORTS_API_HELP_TEXT =
  'Administrative Reports API is unavailable. Start the backend with ADMIN_REPORTS_ENABLED=true and point VITE_ADMIN_REPORTS_API_URL to that instance (e.g., http://localhost:5000).';

type AxiosLikeError = {
  response?: {
    status?: number;
  };
};

const isNotFoundError = (error: unknown): boolean => {
  return Boolean((error as AxiosLikeError)?.response?.status === 404);
};

const tabs = [
  { id: 'templates', label: 'Report Templates' },
  { id: 'history', label: 'Generated Reports' },
  { id: 'schedules', label: 'Scheduled Reports' },
  { id: 'management', label: 'Report Management' },
] as const;

const quickActions = [
  {
    id: 'student-report',
    title: 'Student Report',
    description: 'Jump to detailed student performance dashboards.',
    route: '/admin/reports',
  },
  {
    id: 'teacher-activity',
    title: 'Teacher Activity',
    description: 'Review teacher ISR submissions & compliance.',
    route: '/admin/isr',
  },
  {
    id: 'system-usage',
    title: 'System Usage',
    description: 'Monitor daily platform activity.',
    route: '/admin/dashboard',
  },
];

type TabId = (typeof tabs)[number]['id'];

interface ConfirmationState {
  template: AdminReportTemplate;
  warnings: string[];
}

const AdministrativeReportsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<TabId>('templates');
  const [templates, setTemplates] = useState<AdminReportTemplate[]>([]);
  const [history, setHistory] = useState<GeneratedReportSummary[]>([]);
  const [schedules, setSchedules] = useState<ScheduledReportSummary[]>([]);
  const [analyticsOverview, setAnalyticsOverview] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [scheduleForm, setScheduleForm] = useState({
    templateId: '',
    frequency: 'weekly',
    timeOfDayLocal: '02:00',
    recipients: '',
  });
  const handleDownload = (reportId: string, format: 'pdf' | 'csv' | 'png') => {
    const url = adminReportService.getDownloadUrl(reportId, format);
    window.open(url, '_blank', 'noopener');
  };

  const featureEnabled = FEATURE_FLAG;

  const loadTemplates = useCallback(async () => {
    if (!featureEnabled) return;
    try {
      setLoading(true);
      const params = categoryFilter === 'all' ? undefined : { category: categoryFilter };
      const data = await adminReportService.listTemplates(params);
      setTemplates(data);
    } catch (err) {
      console.error('[AdminReports] Failed to load templates', err);
      setError(isNotFoundError(err) ? REPORTS_API_HELP_TEXT : 'Unable to load templates right now.');
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, featureEnabled]);

  const loadHistory = useCallback(async () => {
    if (!featureEnabled) return;
    try {
      const data = await adminReportService.fetchHistory();
      setHistory(data);
    } catch (err) {
      console.error('[AdminReports] Failed to load history', err);
      if (isNotFoundError(err)) {
        setError(REPORTS_API_HELP_TEXT);
      }
    }
  }, [featureEnabled]);

  const loadSchedules = useCallback(async () => {
    if (!featureEnabled) return;
    try {
      const data = await adminReportService.fetchSchedules();
      setSchedules(data);
    } catch (err) {
      console.error('[AdminReports] Failed to load schedules', err);
      if (isNotFoundError(err)) {
        setError(REPORTS_API_HELP_TEXT);
      }
    }
  }, [featureEnabled]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    loadHistory();
    loadSchedules();
  }, [loadHistory, loadSchedules]);

  const loadAnalytics = useCallback(async () => {
    if (!featureEnabled) return;
    try {
      const overview = await adminReportService.getAnalyticsOverview();
      setAnalyticsOverview(overview);
    } catch (err) {
      console.error('[AdminReports] Failed to load analytics overview', err);
      if (isNotFoundError(err)) {
        setError(REPORTS_API_HELP_TEXT);
      }
    }
  }, [featureEnabled]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const filteredTemplates = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();
    return templates.filter((template) => {
      const matchesSearch =
        !normalized ||
        template.name.toLowerCase().includes(normalized) ||
        template.description?.toLowerCase().includes(normalized) ||
        template.type.toLowerCase().includes(normalized);
      return matchesSearch;
    });
  }, [templates, searchTerm]);

  const distributionChartData = useMemo(() => {
    const source = analyticsOverview?.distribution ?? [];
    if (source.length === 0) {
      return {
        labels: ['No data'],
        datasets: [
          { label: 'Independent %', data: [0], backgroundColor: '#22c55e' },
          { label: 'Instructional %', data: [0], backgroundColor: '#fbbf24' },
          { label: 'Frustration %', data: [0], backgroundColor: '#f87171' },
        ],
      };
    }

    const toPercent = (value: number, total: number) =>
      total > 0 ? Number(((value / total) * 100).toFixed(1)) : 0;

    return {
      labels: source.map((item) => item.grade || 'Unspecified'),
      datasets: [
        {
          label: 'Independent %',
          data: source.map((item) => toPercent(item.independent, item.total)),
          backgroundColor: '#22c55e',
        },
        {
          label: 'Instructional %',
          data: source.map((item) => toPercent(item.instructional, item.total)),
          backgroundColor: '#fbbf24',
        },
        {
          label: 'Frustration %',
          data: source.map((item) => toPercent(item.frustration, item.total)),
          backgroundColor: '#f87171',
        },
      ],
    };
  }, [analyticsOverview]);

  const readingLevelPieData = useMemo(() => {
    const overall = analyticsOverview?.overallLevels;
    if (!overall || overall.total === 0) {
      return {
        labels: ['Independent', 'Instructional', 'Frustration'],
        datasets: [
          {
            data: [0, 0, 0],
            backgroundColor: ['#22c55e', '#fbbf24', '#f87171'],
          },
        ],
      };
    }
    return {
      labels: ['Independent', 'Instructional', 'Frustration'],
      datasets: [
        {
          data: [overall.independent, overall.instructional, overall.frustration],
          backgroundColor: ['#22c55e', '#fbbf24', '#f87171'],
        },
      ],
    };
  }, [analyticsOverview]);

  const handleFavoriteToggle = async (template: AdminReportTemplate, favorite: boolean) => {
    if (!currentUser?.uid) {
      setToast('Please sign in again to favorite reports.');
      return;
    }
    try {
      const updated = await adminReportService.toggleFavorite(template._id, currentUser.uid, favorite);
      setTemplates((prev) => prev.map((tpl) => (tpl._id === updated._id ? updated : tpl)));
    } catch (err) {
      console.error('[AdminReports] Failed to toggle favorite', err);
      setToast('Unable to update favorite status.');
    }
  };

  const handleQuickGenerate = async (template: AdminReportTemplate, overrideForce = false) => {
    try {
      const response = await adminReportService.generateReport({
        templateId: template._id,
        force: overrideForce,
      });
      if (!overrideForce && response.warnings && response.warnings.length > 0) {
        setConfirmation({ template, warnings: response.warnings });
        return;
      }
      setToast(response.message || 'Report generation queued.');
      loadHistory();
    } catch (err) {
      console.error('[AdminReports] Failed to generate report', err);
      setToast('Unable to generate report right now.');
    }
  };

  const handleScheduleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!scheduleForm.templateId) {
      setToast('Please select a template.');
      return;
    }
    try {
      await adminReportService.createSchedule({
        templateId: scheduleForm.templateId,
        frequency: scheduleForm.frequency as 'daily' | 'weekly' | 'monthly',
        timeOfDayLocal: scheduleForm.timeOfDayLocal,
        recipients: scheduleForm.recipients
          .split(',')
          .map((email) => email.trim())
          .filter(Boolean),
      });
      setToast('Schedule saved.');
      setScheduleForm({
        templateId: '',
        frequency: 'weekly',
        timeOfDayLocal: '02:00',
        recipients: '',
      });
      loadSchedules();
    } catch (err) {
      console.error('[AdminReports] Failed to create schedule', err);
      setToast('Unable to create schedule.');
    }
  };

  const handleTemplateSettingChange = async (
    templateId: string,
    updates: Partial<AdminReportTemplate>
  ) => {
    try {
      const updated = await adminReportService.updateTemplate(templateId, updates);
      setTemplates((prev) => prev.map((tpl) => (tpl._id === updated._id ? updated : tpl)));
      setToast('Template updated.');
    } catch (err) {
      console.error('[AdminReports] Failed to update template', err);
      setToast('Unable to update template.');
    }
  };

  const renderTemplatesTab = () => (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        {quickActions.map((action) => (
          <button
            key={action.id}
            onClick={() => navigate(action.route)}
            className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:shadow-md"
          >
            <div className="text-sm font-semibold text-slate-500 uppercase tracking-wide">{action.title}</div>
            <div className="mt-2 text-base text-slate-700">{action.description}</div>
            <div className="mt-4 text-sm font-medium text-indigo-600">Open →</div>
          </button>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-800">Reading Level Distribution</h3>
            <span className="text-sm text-slate-500">
              {analyticsOverview ? 'Live data' : 'Awaiting data'}
            </span>
          </div>
          <Bar data={distributionChartData} options={{ responsive: true, plugins: { legend: { position: 'bottom' } } }} />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800">Overall Levels</h3>
          <Doughnut data={readingLevelPieData} options={{ plugins: { legend: { position: 'bottom' } } }} />
        </div>
      </section>

      {analyticsOverview && (
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Teacher Compliance</h3>
            <p className="text-sm text-slate-600">Latest ISR submissions overview</p>
            <div className="mt-6 grid grid-cols-3 gap-4">
              <div>
                <div className="text-2xl font-bold text-slate-900">{analyticsOverview.teacherCompliance.submitted}</div>
                <div className="text-xs uppercase tracking-wide text-slate-500">Submitted</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{analyticsOverview.teacherCompliance.late}</div>
                <div className="text-xs uppercase tracking-wide text-slate-500">Late</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-emerald-600">
                  {analyticsOverview.teacherCompliance.complianceScore}%
                </div>
                <div className="text-xs uppercase tracking-wide text-slate-500">Compliance</div>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm overflow-x-auto">
            <h3 className="text-lg font-semibold text-slate-900">Latest Assessments</h3>
            <table className="mt-4 min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-2 pr-4">Student</th>
                  <th className="py-2 pr-4">Grade</th>
                  <th className="py-2 pr-4">WPM</th>
                  <th className="py-2 pr-4">Comp.</th>
                </tr>
              </thead>
              <tbody>
                {analyticsOverview.trends.slice(-5).map((trend) => (
                  <tr key={`${trend.studentName}-${trend.assessmentDate}`} className="border-t border-slate-100 text-slate-700">
                    <td className="py-2 pr-4">{trend.studentName}</td>
                    <td className="py-2 pr-4">{trend.gradeSection || '—'}</td>
                    <td className="py-2 pr-4">{trend.wpm}</td>
                    <td className="py-2 pr-4">{trend.comprehensionLevel}</td>
                  </tr>
                ))}
                {analyticsOverview.trends.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-slate-500">
                      No assessments recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="space-y-4">
        {filteredTemplates.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
            No templates found. Adjust filters or add a new template.
          </div>
        )}
        {filteredTemplates.map((template) => {
          const isFavorite = currentUser?.uid
            ? template.favoriteBy?.includes(currentUser.uid)
            : false;
          return (
            <article
              key={template._id}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500">{template.category}</div>
                  <h3 className="text-xl font-semibold text-slate-900">{template.name}</h3>
                  <p className="mt-1 text-sm text-slate-600">{template.description}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                    {(template.settings?.exportFormats || []).map((format) => (
                      <span key={format} className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                        {format.toUpperCase()}
                      </span>
                    ))}
                    {template.settings?.aiInsightsEnabled && (
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-600">
                        AI Insights
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col space-y-3">
                  <button
                    onClick={() => handleQuickGenerate(template)}
                    className="rounded-full bg-indigo-600 px-6 py-2 text-sm font-medium text-white shadow hover:bg-indigo-700"
                  >
                    Quick Generate
                  </button>
                  <button
                    onClick={() => handleFavoriteToggle(template, !isFavorite)}
                    className="rounded-full border border-slate-200 px-6 py-2 text-sm font-medium text-slate-700 hover:border-indigo-200 hover:text-indigo-600"
                  >
                    {isFavorite ? '❤️ Favorited' : '♡ Favorite'}
                  </button>
                  <button
                    onClick={() => {
                      const shareLink = `${window.location.origin}/admin/administrative-reports?template=${template._id}`;
                      void navigator.clipboard?.writeText(shareLink);
                      setToast('Share link copied to clipboard.');
                    }}
                    className="text-sm font-medium text-slate-500 hover:text-indigo-600"
                  >
                    Share link
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );

  const renderHistoryTab = () => (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Template
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Generated
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {history.map((report) => (
              <tr key={report._id}>
                <td className="px-4 py-3 text-sm text-slate-700">{report.templateSnapshot.name}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      report.status === 'success'
                        ? 'bg-emerald-50 text-emerald-700'
                        : report.status === 'pending'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-rose-50 text-rose-700'
                    }`}
                  >
                    {report.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">
                  {new Date(report.generatedAt).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 disabled:opacity-50"
                      disabled={!report.files?.pdfFileId}
                      onClick={() => report.files?.pdfFileId && handleDownload(report._id, 'pdf')}
                    >
                      PDF
                    </button>
                    <button
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 disabled:opacity-50"
                      disabled={!report.files?.csvFileId}
                      onClick={() => report.files?.csvFileId && handleDownload(report._id, 'csv')}
                    >
                      CSV
                    </button>
                    <button
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 disabled:opacity-50"
                      disabled={!report.files?.pngFileId}
                      onClick={() => report.files?.pngFileId && handleDownload(report._id, 'png')}
                    >
                      PNG
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {history.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-slate-500">
                  No generated reports yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderSchedulesTab = () => (
    <div className="space-y-6">
      <form onSubmit={handleScheduleSubmit} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2">
        <div>
          <label className="text-sm font-semibold text-slate-600">Report Template</label>
          <select
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            value={scheduleForm.templateId}
            onChange={(event) => setScheduleForm((prev) => ({ ...prev, templateId: event.target.value }))}
          >
            <option value="">Select template</option>
            {templates.map((template) => (
              <option key={template._id} value={template._id}>
                {template.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-semibold text-slate-600">Frequency</label>
          <select
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            value={scheduleForm.frequency}
            onChange={(event) => setScheduleForm((prev) => ({ ...prev, frequency: event.target.value }))}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-semibold text-slate-600">Send Time (Local)</label>
          <input
            type="time"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            value={scheduleForm.timeOfDayLocal}
            onChange={(event) => setScheduleForm((prev) => ({ ...prev, timeOfDayLocal: event.target.value }))}
          />
        </div>
        <div>
          <label className="text-sm font-semibold text-slate-600">Recipients (comma separated)</label>
          <input
            type="text"
            placeholder="admin@school.edu, head@school.edu"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            value={scheduleForm.recipients}
            onChange={(event) => setScheduleForm((prev) => ({ ...prev, recipients: event.target.value }))}
          />
        </div>
        <div className="md:col-span-2">
          <button
            type="submit"
            className="rounded-full bg-indigo-600 px-6 py-2 text-sm font-medium text-white shadow hover:bg-indigo-700"
          >
            Save Schedule
          </button>
        </div>
      </form>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Template
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Frequency
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Time
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Recipients
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {schedules.map((schedule) => {
                const templateName = templates.find((tpl) => tpl._id === schedule.templateId)?.name || '—';
                return (
                  <tr key={schedule._id}>
                    <td className="px-4 py-3 text-sm text-slate-700">{templateName}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 capitalize">{schedule.frequency}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{schedule.timeOfDayLocal}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{schedule.recipients.join(', ')}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {schedule.enabled ? (
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
                          Active
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                          Paused
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {schedules.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">
                    No schedules yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderManagementTab = () => (
    <div className="space-y-4">
      {templates.map((template) => (
        <div key={template._id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">{template.name}</h3>
              <p className="text-sm text-slate-600">{template.description}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={template.settings?.aiInsightsEnabled}
                  onChange={(event) =>
                    handleTemplateSettingChange(template._id, {
                      settings: { ...(template.settings || {}), aiInsightsEnabled: event.target.checked },
                    })
                  }
                />
                AI Insights
              </label>
              <select
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                value={template.category}
                onChange={(event) => handleTemplateSettingChange(template._id, { category: event.target.value })}
              >
                <option value="academic">Academic</option>
                <option value="performance">Performance</option>
                <option value="administrative">Administrative</option>
              </select>
              <button
                className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700"
                onClick={() =>
                  handleTemplateSettingChange(template._id, { isArchived: !template.isArchived })
                }
              >
                {template.isArchived ? 'Restore' : 'Archive'}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  if (!featureEnabled) {
    return (
      <div className="p-8">
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
          <h2 className="text-xl font-semibold text-slate-800">Administrative Reports</h2>
          <p className="mt-2 text-sm text-slate-600">
            This feature is currently disabled. Set <code>VITE_FEATURE_ADMIN_REPORTS=true</code> to enable.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Administrative Reports</p>
          <h1 className="text-2xl font-bold text-slate-900">Phil-IRI Intelligence Suite</h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <button className="rounded-full border border-slate-200 px-5 py-2 text-sm font-medium text-slate-700 hover:border-indigo-200 hover:text-indigo-600">
            Test PDF
          </button>
          <button className="rounded-full border border-slate-200 px-5 py-2 text-sm font-medium text-slate-700 hover:border-indigo-200 hover:text-indigo-600">
            Analytics
          </button>
          <button className="rounded-full bg-indigo-600 px-5 py-2 text-sm font-medium text-white shadow hover:bg-indigo-700">
            New Report
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 gap-3">
          <input
            type="search"
            placeholder="Search templates..."
            className="w-full rounded-full border border-slate-200 px-4 py-2 text-sm"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
          <select
            className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
          >
            <option value="all">All categories</option>
            <option value="academic">Academic</option>
            <option value="performance">Performance</option>
            <option value="administrative">Administrative</option>
          </select>
        </div>
        <div className="flex gap-3">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                activeTab === tab.id ? 'bg-indigo-600 text-white shadow' : 'bg-white text-slate-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500 shadow-sm">
          Loading report templates...
        </div>
      ) : (
        <>
          {activeTab === 'templates' && renderTemplatesTab()}
          {activeTab === 'history' && renderHistoryTab()}
          {activeTab === 'schedules' && renderSchedulesTab()}
          {activeTab === 'management' && renderManagementTab()}
        </>
      )}

      {confirmation && (
        <DataQualityModal
          templateName={confirmation.template.name}
          warnings={confirmation.warnings}
          onCancel={() => setConfirmation(null)}
          onContinue={() => {
            void handleQuickGenerate(confirmation.template, true);
            setConfirmation(null);
          }}
        />
      )}

      {toast && (
        <div
          className="fixed bottom-6 right-6 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-lg"
          role="status"
        >
          {toast}
          <button className="ml-3 text-xs text-indigo-200" onClick={() => setToast(null)}>
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
};

interface DataQualityModalProps {
  templateName: string;
  warnings: string[];
  onCancel: () => void;
  onContinue: () => void;
}

const DataQualityModal: React.FC<DataQualityModalProps> = ({ templateName, warnings, onCancel, onContinue }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
    <div className="max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
      <h3 className="text-lg font-semibold text-slate-900">Data Quality Checks</h3>
      <p className="mt-1 text-sm text-slate-600">
        We detected potential issues while generating <strong>{templateName}</strong>. Review before continuing.
      </p>
      <ul className="mt-4 space-y-2 text-sm text-slate-700">
        {warnings.map((warning) => (
          <li key={warning} className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">
            {warning}
          </li>
        ))}
      </ul>
      <div className="mt-6 flex justify-end gap-3">
        <button className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600" onClick={onCancel}>
          Cancel
        </button>
        <button className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow" onClick={onContinue}>
          Continue anyway
        </button>
      </div>
    </div>
  </div>
);

export default AdministrativeReportsPage;

