import React, { useState, useEffect } from 'react';
import {
  DocumentTextIcon,
  CogIcon,
  ChartBarIcon,
  BellIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  PlayIcon
} from '@heroicons/react/24/outline';
import ReportProcessingDashboard from '../../components/admin/ReportProcessingDashboard';
import AutomatedWorkflowManager from '../../components/admin/AutomatedWorkflowManager';
import ReportAnalytics from '../../components/admin/ReportAnalytics';
import { reportProcessingService } from '../../services/reportProcessingService';
import { isrService } from '../../services/isrService';
import AdminLoader from '../../components/admin/AdminLoader';

interface ReportManagementHubProps {
  adminId: string;
  adminName: string;
}

interface QuickStats {
  pendingReports: number;
  todaySubmissions: number;
  activeWorkflows: number;
  avgProcessingTime: number;
  qualityScore: number;
  urgentItems: number;
}

const ReportManagementHub: React.FC<ReportManagementHubProps> = ({
  adminId,
  adminName
}) => {
  const [activeView, setActiveView] = useState<'dashboard' | 'processing' | 'workflows' | 'analytics'>('dashboard');
  const [quickStats, setQuickStats] = useState<QuickStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Load quick stats
      const [pendingReports, systemInsights] = await Promise.all([
        isrService.getISRSubmissions('pending'),
        reportProcessingService.generateSystemInsights()
      ]);

      const stats: QuickStats = {
        pendingReports: pendingReports.length,
        todaySubmissions: pendingReports.filter(r => {
          const today = new Date();
          const submissionDate = r.submissionDate;
          return submissionDate.toDateString() === today.toDateString();
        }).length,
        activeWorkflows: 3, // Mock data - would come from workflow service
        avgProcessingTime: systemInsights.averageProcessingTime,
        qualityScore: 85, // Mock data - would calculate from validation results
        urgentItems: pendingReports.filter(r => {
          const daysSince = Math.floor((new Date().getTime() - r.submissionDate.getTime()) / (1000 * 60 * 60 * 24));
          return daysSince > 3;
        }).length
      };

      setQuickStats(stats);

      // Generate recent activity (mock data)
      const activity = [
        {
          id: '1',
          type: 'report_approved',
          message: 'Report from Maria Santos approved',
          timestamp: new Date(Date.now() - 30 * 60 * 1000),
          icon: CheckCircleIcon,
          color: 'text-emerald-600'
        },
        {
          id: '2',
          type: 'workflow_triggered',
          message: 'Auto-approval workflow triggered for high-quality report',
          timestamp: new Date(Date.now() - 45 * 60 * 1000),
          icon: CogIcon,
          color: 'text-indigo-600'
        },
        {
          id: '3',
          type: 'report_flagged',
          message: 'Report from John Doe flagged for review',
          timestamp: new Date(Date.now() - 60 * 60 * 1000),
          icon: ExclamationTriangleIcon,
          color: 'text-amber-600'
        },
        {
          id: '4',
          type: 'report_submitted',
          message: 'New ISR report submitted by Ana Cruz',
          timestamp: new Date(Date.now() - 90 * 60 * 1000),
          icon: DocumentTextIcon,
          color: 'text-blue-600'
        },
        {
          id: '5',
          type: 'report_rejected',
          message: 'Report from Pedro Garcia rejected - revision requested',
          timestamp: new Date(Date.now() - 120 * 60 * 1000),
          icon: ExclamationTriangleIcon,
          color: 'text-rose-600'
        }
      ];

      setRecentActivity(activity);

    } catch {
      // Dashboard data loading failed
    } finally {
      setLoading(false);
    }
  };

  const formatTimeAgo = (timestamp: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - timestamp.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)}h ago`;
    } else {
      return `${Math.floor(diffInMinutes / 1440)}d ago`;
    }
  };

  if (loading) {
    return <AdminLoader label="Loading Report Management Hub..." fullScreen size="lg" />;
  }

  // Render specific views
  if (activeView === 'processing') {
    return <ReportProcessingDashboard adminId={adminId} adminName={adminName} />;
  }

  if (activeView === 'workflows') {
    return <AutomatedWorkflowManager adminId={adminId} adminName={adminName} />;
  }

  if (activeView === 'analytics') {
    return <ReportAnalytics adminId={adminId} />;
  }

  // Main dashboard view
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Report Management Hub</h1>
              <p className="text-slate-600">Comprehensive report processing and analytics center</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={loadDashboardData}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors"
              >
                Refresh
              </button>
              <div className="relative">
                <BellIcon className="h-6 w-6 text-slate-600" />
                {quickStats && quickStats.urgentItems > 0 && (
                  <div className="absolute -top-1 -right-1 bg-rose-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {quickStats.urgentItems}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="px-6">
          <nav className="flex space-x-8">
            {[
              { id: 'dashboard', label: 'Overview', icon: ChartBarIcon },
              { id: 'processing', label: 'Report Processing', icon: DocumentTextIcon },
              { id: 'workflows', label: 'Automated Workflows', icon: CogIcon },
              { id: 'analytics', label: 'Analytics', icon: ArrowTrendingUpIcon }
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveView(tab.id as any)}
                  className={`flex items-center gap-2 px-1 py-4 border-b-2 font-medium text-sm transition-colors ${
                    activeView === tab.id
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="p-6">
        {/* Quick Stats */}
        {quickStats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-8">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Pending Reports</p>
                  <p className="text-3xl font-bold text-amber-600">{quickStats.pendingReports}</p>
                </div>
                <div className="p-3 bg-amber-100 rounded-lg">
                  <ClockIcon className="h-6 w-6 text-amber-600" />
                </div>
              </div>
              <div className="mt-2">
                <span className="text-xs text-slate-500">
                  {quickStats.urgentItems} urgent (3+ days)
                </span>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Today's Submissions</p>
                  <p className="text-3xl font-bold text-blue-600">{quickStats.todaySubmissions}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <DocumentTextIcon className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Active Workflows</p>
                  <p className="text-3xl font-bold text-indigo-600">{quickStats.activeWorkflows}</p>
                </div>
                <div className="p-3 bg-indigo-100 rounded-lg">
                  <CogIcon className="h-6 w-6 text-indigo-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Avg. Processing</p>
                  <p className="text-3xl font-bold text-slate-900">
                    {quickStats.avgProcessingTime.toFixed(1)}d
                  </p>
                </div>
                <div className="p-3 bg-slate-100 rounded-lg">
                  <ChartBarIcon className="h-6 w-6 text-slate-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Quality Score</p>
                  <p className="text-3xl font-bold text-emerald-600">{quickStats.qualityScore}%</p>
                </div>
                <div className="p-3 bg-emerald-100 rounded-lg">
                  <CheckCircleIcon className="h-6 w-6 text-emerald-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">System Health</p>
                  <p className="text-3xl font-bold text-emerald-600">Good</p>
                </div>
                <div className="p-3 bg-emerald-100 rounded-lg">
                  <ArrowTrendingUpIcon className="h-6 w-6 text-emerald-600" />
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Quick Actions */}
          <div className="lg:col-span-2 space-y-6">
            {/* Action Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">Process Reports</h3>
                    <p className="text-indigo-100 text-sm">Review and approve pending submissions</p>
                  </div>
                  <DocumentTextIcon className="h-8 w-8 text-indigo-200" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">{quickStats?.pendingReports || 0}</span>
                  <button
                    onClick={() => setActiveView('processing')}
                    className="px-4 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg font-medium transition-colors"
                  >
                    View All
                  </button>
                </div>
              </div>

              <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">Manage Workflows</h3>
                    <p className="text-emerald-100 text-sm">Configure automated processing rules</p>
                  </div>
                  <CogIcon className="h-8 w-8 text-emerald-200" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">{quickStats?.activeWorkflows || 0}</span>
                  <button
                    onClick={() => setActiveView('workflows')}
                    className="px-4 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg font-medium transition-colors"
                  >
                    Configure
                  </button>
                </div>
              </div>

              <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">View Analytics</h3>
                    <p className="text-amber-100 text-sm">Comprehensive performance insights</p>
                  </div>
                  <ChartBarIcon className="h-8 w-8 text-amber-200" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">{quickStats?.qualityScore || 0}%</span>
                  <button
                    onClick={() => setActiveView('analytics')}
                    className="px-4 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg font-medium transition-colors"
                  >
                    Analyze
                  </button>
                </div>
              </div>

              <div className="bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">Urgent Items</h3>
                    <p className="text-rose-100 text-sm">Reports requiring immediate attention</p>
                  </div>
                  <ExclamationTriangleIcon className="h-8 w-8 text-rose-200" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">{quickStats?.urgentItems || 0}</span>
                  <button
                    onClick={() => setActiveView('processing')}
                    className="px-4 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg font-medium transition-colors"
                  >
                    Review
                  </button>
                </div>
              </div>
            </div>

            {/* System Status */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">System Status</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <CheckCircleIcon className="h-8 w-8 text-emerald-600" />
                  </div>
                  <h4 className="font-semibold text-slate-900">Processing Engine</h4>
                  <p className="text-sm text-emerald-600">Operational</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <PlayIcon className="h-8 w-8 text-emerald-600" />
                  </div>
                  <h4 className="font-semibold text-slate-900">Automated Workflows</h4>
                  <p className="text-sm text-emerald-600">Active</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <ChartBarIcon className="h-8 w-8 text-emerald-600" />
                  </div>
                  <h4 className="font-semibold text-slate-900">Analytics Engine</h4>
                  <p className="text-sm text-emerald-600">Running</p>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Recent Activity</h3>
              <button className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                View All
              </button>
            </div>
            <div className="space-y-4">
              {recentActivity.map(activity => {
                const Icon = activity.icon;
                return (
                  <div key={activity.id} className="flex items-start gap-3">
                    <div className="p-2 bg-slate-100 rounded-lg flex-shrink-0">
                      <Icon className={`h-4 w-4 ${activity.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-900">{activity.message}</p>
                      <p className="text-xs text-slate-500">{formatTimeAgo(activity.timestamp)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Performance Summary */}
        <div className="mt-8 bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Performance Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center p-4 bg-slate-50 rounded-lg">
              <div className="text-2xl font-bold text-slate-900 mb-1">
                {quickStats ? Math.round((quickStats.pendingReports / (quickStats.pendingReports + 50)) * 100) : 0}%
              </div>
              <div className="text-sm text-slate-600">Processing Efficiency</div>
            </div>
            <div className="text-center p-4 bg-slate-50 rounded-lg">
              <div className="text-2xl font-bold text-slate-900 mb-1">
                {quickStats?.qualityScore || 0}%
              </div>
              <div className="text-sm text-slate-600">Average Quality Score</div>
            </div>
            <div className="text-center p-4 bg-slate-50 rounded-lg">
              <div className="text-2xl font-bold text-slate-900 mb-1">
                {quickStats ? quickStats.avgProcessingTime.toFixed(1) : 0}
              </div>
              <div className="text-sm text-slate-600">Avg. Processing Days</div>
            </div>
            <div className="text-center p-4 bg-slate-50 rounded-lg">
              <div className="text-2xl font-bold text-slate-900 mb-1">
                {quickStats ? Math.max(0, 100 - quickStats.urgentItems * 10) : 100}%
              </div>
              <div className="text-sm text-slate-600">System Health</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportManagementHub;