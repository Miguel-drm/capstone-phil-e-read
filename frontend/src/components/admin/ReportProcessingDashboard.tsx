import React, { useState, useEffect } from 'react';
import {
  DocumentTextIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  EyeIcon,
  ChatBubbleLeftRightIcon,
  FlagIcon,
  UserGroupIcon,
  ChartBarIcon,
  BellIcon,
  ArrowTrendingUpIcon
} from '@heroicons/react/24/outline';
import { reportProcessingService } from '../../services/reportProcessingService';
import type { ReportValidationResult } from '../../services/reportProcessingService';
import { isrService } from '../../services/isrService';

interface ReportProcessingDashboardProps {
  adminId: string;
  adminName: string;
}

interface DashboardStats {
  totalReports: number;
  pendingReports: number;
  approvedReports: number;
  rejectedReports: number;
  averageProcessingTime: number;
  topPerformingTeachers: string[];
  flaggedIssues: string[];
  recommendations: string[];
}

const ReportProcessingDashboard: React.FC<ReportProcessingDashboardProps> = ({
  adminId,
  adminName
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'pending' | 'processed' | 'analytics'>('overview');
  const [pendingReports, setPendingReports] = useState<any[]>([]);
  const [processedReports, setProcessedReports] = useState<any[]>([]);
  const [selectedReports, setSelectedReports] = useState<string[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingReport, setProcessingReport] = useState<string | null>(null);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [validationResult, setValidationResult] = useState<ReportValidationResult | null>(null);
  const [selectedReportForAction, setSelectedReportForAction] = useState<any>(null);
  const [actionComments, setActionComments] = useState('');
  const [showBulkActions, setShowBulkActions] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Load pending reports
      const pending = await isrService.getISRSubmissions('pending');
      setPendingReports(pending);

      // Load processed reports (approved and rejected)
      const approved = await isrService.getISRSubmissions('approved');
      const rejected = await isrService.getISRSubmissions('rejected');
      setProcessedReports([...approved, ...rejected]);

      // Load dashboard statistics
      const stats = await reportProcessingService.generateSystemInsights();
      setDashboardStats(stats);

    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleValidateReport = async (report: any) => {
    try {
      setProcessingReport(report.id);
      const validation = await reportProcessingService.validateReport(report);
      setValidationResult(validation);
      setSelectedReportForAction(report);
      setShowValidationModal(true);
    } catch (error) {
      console.error('Error validating report:', error);
    } finally {
      setProcessingReport(null);
    }
  };

  const handleProcessReport = async (
    reportId: string, 
    action: 'approve' | 'reject' | 'request_revision'
  ) => {
    try {
      setProcessingReport(reportId);
      
      const success = await reportProcessingService.processReport(
        reportId,
        action,
        adminId,
        adminName,
        actionComments
      );

      if (success) {
        await loadDashboardData(); // Refresh data
        setShowValidationModal(false);
        setActionComments('');
        setSelectedReportForAction(null);
      }
    } catch (error) {
      console.error('Error processing report:', error);
    } finally {
      setProcessingReport(null);
    }
  };

  const handleBulkProcess = async (action: 'approve' | 'reject' | 'flag_review') => {
    try {
      const success = await reportProcessingService.bulkProcessReports(
        {
          action,
          reportIds: selectedReports,
          comments: actionComments
        },
        adminId,
        adminName
      );

      if (success) {
        await loadDashboardData();
        setSelectedReports([]);
        setShowBulkActions(false);
        setActionComments('');
      }
    } catch (error) {
      console.error('Error bulk processing reports:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircleIcon className="h-5 w-5 text-emerald-500" />;
      case 'rejected':
        return <XCircleIcon className="h-5 w-5 text-rose-500" />;
      case 'needs_revision':
        return <ExclamationTriangleIcon className="h-5 w-5 text-amber-500" />;
      default:
        return <ClockIcon className="h-5 w-5 text-slate-400" />;
    }
  };

  const getValidationScoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-600 bg-emerald-50';
    if (score >= 70) return 'text-amber-600 bg-amber-50';
    return 'text-rose-600 bg-rose-50';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-slate-200 border-t-indigo-600 mx-auto"></div>
          <p className="mt-4 text-slate-600 font-medium">Loading Report Processing Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Report Processing Center</h1>
              <p className="text-slate-600">Manage and analyze teacher report submissions</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowBulkActions(!showBulkActions)}
                disabled={selectedReports.length === 0}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectedReports.length > 0
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
              >
                Bulk Actions ({selectedReports.length})
              </button>
              <button
                onClick={loadDashboardData}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6">
          <nav className="flex space-x-8">
            {[
              { id: 'overview', label: 'Overview', icon: ChartBarIcon },
              { id: 'pending', label: 'Pending Reports', icon: ClockIcon },
              { id: 'processed', label: 'Processed Reports', icon: CheckCircleIcon },
              { id: 'analytics', label: 'Analytics', icon: ArrowTrendingUpIcon }
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-1 py-4 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
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

      {/* Bulk Actions Panel */}
      {showBulkActions && selectedReports.length > 0 && (
        <div className="bg-indigo-50 border-b border-indigo-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="font-medium text-indigo-900">
                {selectedReports.length} reports selected
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => handleBulkProcess('approve')}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Bulk Approve
                </button>
                <button
                  onClick={() => handleBulkProcess('reject')}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Bulk Reject
                </button>
                <button
                  onClick={() => handleBulkProcess('flag_review')}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Flag for Review
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Add comments for bulk action..."
                value={actionComments}
                onChange={(e) => setActionComments(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={() => {
                  setSelectedReports([]);
                  setShowBulkActions(false);
                }}
                className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="p-6">
        {/* Overview Tab */}
        {activeTab === 'overview' && dashboardStats && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Total Reports</p>
                    <p className="text-3xl font-bold text-slate-900">{dashboardStats.totalReports}</p>
                  </div>
                  <div className="p-3 bg-indigo-100 rounded-lg">
                    <DocumentTextIcon className="h-6 w-6 text-indigo-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Pending Review</p>
                    <p className="text-3xl font-bold text-amber-600">{dashboardStats.pendingReports}</p>
                  </div>
                  <div className="p-3 bg-amber-100 rounded-lg">
                    <ClockIcon className="h-6 w-6 text-amber-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Approved</p>
                    <p className="text-3xl font-bold text-emerald-600">{dashboardStats.approvedReports}</p>
                  </div>
                  <div className="p-3 bg-emerald-100 rounded-lg">
                    <CheckCircleIcon className="h-6 w-6 text-emerald-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Avg. Processing</p>
                    <p className="text-3xl font-bold text-slate-900">
                      {dashboardStats.averageProcessingTime.toFixed(1)}d
                    </p>
                  </div>
                  <div className="p-3 bg-slate-100 rounded-lg">
                    <ChartBarIcon className="h-6 w-6 text-slate-600" />
                  </div>
                </div>
              </div>
            </div>

            {/* Insights and Recommendations */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Flagged Issues */}
              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-rose-100 rounded-lg">
                    <ExclamationTriangleIcon className="h-5 w-5 text-rose-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">Flagged Issues</h3>
                </div>
                <div className="space-y-3">
                  {dashboardStats.flaggedIssues.length > 0 ? (
                    dashboardStats.flaggedIssues.map((issue, index) => (
                      <div key={index} className="flex items-start gap-3 p-3 bg-rose-50 rounded-lg">
                        <FlagIcon className="h-4 w-4 text-rose-500 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-rose-800">{issue}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500 italic">No issues detected</p>
                  )}
                </div>
              </div>

              {/* Recommendations */}
              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-emerald-100 rounded-lg">
                    <BellIcon className="h-5 w-5 text-emerald-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">Recommendations</h3>
                </div>
                <div className="space-y-3">
                  {dashboardStats.recommendations.map((recommendation, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 bg-emerald-50 rounded-lg">
                      <CheckCircleIcon className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-emerald-800">{recommendation}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Top Performing Teachers */}
            {dashboardStats.topPerformingTeachers.length > 0 && (
              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <UserGroupIcon className="h-5 w-5 text-indigo-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">Top Performing Teachers</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {dashboardStats.topPerformingTeachers.map((teacher, index) => (
                    <div key={index} className="text-center p-4 bg-indigo-50 rounded-lg">
                      <div className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center mx-auto mb-2 text-sm font-bold">
                        {index + 1}
                      </div>
                      <p className="text-sm font-medium text-slate-900">{teacher}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Pending Reports Tab */}
        {activeTab === 'pending' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Pending Reports</h3>
              <p className="text-sm text-slate-600">Reports awaiting admin review and approval</p>
            </div>

            {pendingReports.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={selectedReports.length === pendingReports.length && pendingReports.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedReports(pendingReports.map(r => r.id));
                            } else {
                              setSelectedReports([]);
                            }
                          }}
                          className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                        />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Teacher & Class
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Students
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Submitted
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {pendingReports.map(report => (
                      <tr key={report.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={selectedReports.includes(report.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedReports(prev => [...prev, report.id]);
                              } else {
                                setSelectedReports(prev => prev.filter(id => id !== report.id));
                              }
                            }}
                            className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-medium text-slate-900">{report.teacherName}</p>
                            <p className="text-sm text-slate-600">{report.className}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {report.studentCount} students
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {report.submissionDate.toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(report.status)}
                            <span className="text-sm font-medium text-slate-700 capitalize">
                              {report.status}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleValidateReport(report)}
                              disabled={processingReport === report.id}
                              className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50"
                              title="Validate & Review"
                            >
                              {processingReport === report.id ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-indigo-600 border-t-transparent"></div>
                              ) : (
                                <EyeIcon className="h-4 w-4" />
                              )}
                            </button>
                            <button
                              className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="Quick Approve"
                            >
                              <CheckCircleIcon className="h-4 w-4" />
                            </button>
                            <button
                              className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Reject"
                            >
                              <XCircleIcon className="h-4 w-4" />
                            </button>
                            <button
                              className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                              title="Request Revision"
                            >
                              <ChatBubbleLeftRightIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <ClockIcon className="h-16 w-16 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">No Pending Reports</h3>
                <p className="text-slate-600">All reports have been processed.</p>
              </div>
            )}
          </div>
        )}

        {/* Processed Reports Tab */}
        {activeTab === 'processed' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Processed Reports</h3>
              <p className="text-sm text-slate-600">Previously reviewed and processed reports</p>
            </div>

            {processedReports.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Teacher & Class
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Students
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Processed
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Reviewed By
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {processedReports.map(report => (
                      <tr key={report.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-medium text-slate-900">{report.teacherName}</p>
                            <p className="text-sm text-slate-600">{report.className}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {report.studentCount} students
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {report.reviewedAt?.toLocaleDateString() || 'N/A'}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(report.status)}
                            <span className="text-sm font-medium text-slate-700 capitalize">
                              {report.status}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {report.reviewedBy || 'System'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <DocumentTextIcon className="h-16 w-16 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">No Processed Reports</h3>
                <p className="text-slate-600">No reports have been processed yet.</p>
              </div>
            )}
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Processing Analytics</h3>
              <p className="text-slate-600">Advanced analytics and insights coming soon...</p>
            </div>
          </div>
        )}
      </div>

      {/* Validation Modal */}
      {showValidationModal && validationResult && selectedReportForAction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">Report Validation Results</h3>
                  <p className="text-slate-600">{selectedReportForAction.teacherName} - {selectedReportForAction.className}</p>
                </div>
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${getValidationScoreColor(validationResult.score)}`}>
                  Quality Score: {validationResult.score}%
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Validation Issues */}
              {validationResult.issues.length > 0 && (
                <div>
                  <h4 className="font-semibold text-slate-900 mb-3">Issues Found</h4>
                  <div className="space-y-2">
                    {validationResult.issues.map((issue, index) => (
                      <div key={index} className={`p-3 rounded-lg border-l-4 ${
                        issue.severity === 'high' ? 'bg-rose-50 border-rose-400' :
                        issue.severity === 'medium' ? 'bg-amber-50 border-amber-400' :
                        'bg-blue-50 border-blue-400'
                      }`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-medium px-2 py-1 rounded ${
                            issue.severity === 'high' ? 'bg-rose-100 text-rose-800' :
                            issue.severity === 'medium' ? 'bg-amber-100 text-amber-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {issue.severity.toUpperCase()}
                          </span>
                          <span className="text-xs text-slate-500">{issue.type.replace('_', ' ')}</span>
                        </div>
                        <p className="text-sm text-slate-700">{issue.description}</p>
                        {issue.field && (
                          <p className="text-xs text-slate-500 mt-1">Field: {issue.field}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggestions */}
              {validationResult.suggestions.length > 0 && (
                <div>
                  <h4 className="font-semibold text-slate-900 mb-3">Suggestions</h4>
                  <div className="space-y-2">
                    {validationResult.suggestions.map((suggestion, index) => (
                      <div key={index} className="flex items-start gap-3 p-3 bg-emerald-50 rounded-lg">
                        <CheckCircleIcon className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-emerald-800">{suggestion}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Comments */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Admin Comments (Optional)
                </label>
                <textarea
                  value={actionComments}
                  onChange={(e) => setActionComments(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Add comments for the teacher..."
                />
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex items-center justify-between">
              <button
                onClick={() => {
                  setShowValidationModal(false);
                  setValidationResult(null);
                  setSelectedReportForAction(null);
                  setActionComments('');
                }}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => handleProcessReport(selectedReportForAction.id, 'request_revision')}
                  disabled={processingReport === selectedReportForAction.id}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  Request Revision
                </button>
                <button
                  onClick={() => handleProcessReport(selectedReportForAction.id, 'reject')}
                  disabled={processingReport === selectedReportForAction.id}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  Reject
                </button>
                <button
                  onClick={() => handleProcessReport(selectedReportForAction.id, 'approve')}
                  disabled={processingReport === selectedReportForAction.id}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {processingReport === selectedReportForAction.id ? 'Processing...' : 'Approve'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportProcessingDashboard;