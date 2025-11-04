import React, { useState, useEffect } from 'react';
import {
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  UserGroupIcon,
  DocumentTextIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  AcademicCapIcon,
  FunnelIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';
import { reportProcessingService } from '../../services/reportProcessingService';
import { isrService } from '../../services/isrService';

interface AnalyticsData {
  overview: {
    totalReports: number;
    pendingReports: number;
    approvedReports: number;
    rejectedReports: number;
    averageProcessingTime: number;
    qualityScoreAverage: number;
  };
  trends: {
    submissionTrend: { date: string; count: number }[];
    processingTrend: { date: string; approved: number; rejected: number }[];
    qualityTrend: { date: string; score: number }[];
  };
  teacherPerformance: {
    teacherId: string;
    teacherName: string;
    totalSubmissions: number;
    approvalRate: number;
    averageQuality: number;
    averageProcessingTime: number;
  }[];
  gradeAnalysis: {
    grade: string;
    totalStudents: number;
    independentRate: number;
    instructionalRate: number;
    frustrationRate: number;
    improvement: number;
  }[];
  insights: {
    type: 'positive' | 'negative' | 'neutral';
    title: string;
    description: string;
    metric?: string;
    value?: number;
  }[];
}

interface ReportAnalyticsProps {
  adminId: string;
}

const ReportAnalytics: React.FC<ReportAnalyticsProps> = () => {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadAnalyticsData();
  }, [selectedTimeRange, selectedGrade]);

  const loadAnalyticsData = async () => {
    setLoading(true);
    try {
      // Get system insights
      const systemInsights = await reportProcessingService.generateSystemInsights();
      
      // Get ISR submissions for analysis
      const allSubmissions = await isrService.getISRSubmissions('all');
      const approvedSubmissions = await isrService.getApprovedISRRecords();

      // Process data for analytics
      const analyticsData = processAnalyticsData(systemInsights, allSubmissions, approvedSubmissions);
      setAnalyticsData(analyticsData);

    } catch (error) {
      console.error('Error loading analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  const processAnalyticsData = (systemInsights: any, allSubmissions: any[], approvedSubmissions: any[]): AnalyticsData => {
    // Calculate overview metrics
    const overview = {
      totalReports: systemInsights.totalReports,
      pendingReports: systemInsights.pendingReports,
      approvedReports: systemInsights.approvedReports,
      rejectedReports: systemInsights.rejectedReports,
      averageProcessingTime: systemInsights.averageProcessingTime,
      qualityScoreAverage: 85 // Mock data - would calculate from validation results
    };

    // Generate trends (mock data for demonstration)
    const trends = {
      submissionTrend: generateMockTrendData(),
      processingTrend: generateMockProcessingTrend(),
      qualityTrend: generateMockQualityTrend()
    };

    // Analyze teacher performance
    const teacherStats: Record<string, any> = {};
    
    allSubmissions.forEach(submission => {
      const teacherName = submission.teacherName;
      if (!teacherStats[teacherName]) {
        teacherStats[teacherName] = {
          teacherId: submission.teacherId,
          teacherName,
          totalSubmissions: 0,
          approved: 0,
          totalQuality: 0,
          totalProcessingTime: 0
        };
      }
      
      teacherStats[teacherName].totalSubmissions++;
      if (submission.status === 'approved') {
        teacherStats[teacherName].approved++;
      }
      
      // Mock quality and processing time data
      teacherStats[teacherName].totalQuality += Math.random() * 40 + 60; // 60-100 range
      teacherStats[teacherName].totalProcessingTime += Math.random() * 5 + 1; // 1-6 days
    });

    const teacherPerformance = Object.values(teacherStats).map((stats: any) => ({
      teacherId: stats.teacherId,
      teacherName: stats.teacherName,
      totalSubmissions: stats.totalSubmissions,
      approvalRate: stats.totalSubmissions > 0 ? (stats.approved / stats.totalSubmissions) * 100 : 0,
      averageQuality: stats.totalSubmissions > 0 ? stats.totalQuality / stats.totalSubmissions : 0,
      averageProcessingTime: stats.totalSubmissions > 0 ? stats.totalProcessingTime / stats.totalSubmissions : 0
    }));

    // Analyze grade performance
    const gradeStats: Record<string, any> = {};
    
    approvedSubmissions.forEach(submission => {
      if (submission.students && Array.isArray(submission.students)) {
        submission.students.forEach((student: any) => {
          const grade = student.gradeSection || submission.grade || 'Unknown';
          
          if (!gradeStats[grade]) {
            gradeStats[grade] = {
              totalStudents: 0,
              independent: 0,
              instructional: 0,
              frustration: 0
            };
          }
          
          gradeStats[grade].totalStudents++;
          
          const reading = student.readingData?.[0];
          if (reading?.wordReading?.ind && reading?.comprehension?.ind) {
            gradeStats[grade].independent++;
          } else if (reading?.wordReading?.ins && reading?.comprehension?.ins) {
            gradeStats[grade].instructional++;
          } else {
            gradeStats[grade].frustration++;
          }
        });
      }
    });

    const gradeAnalysis = Object.entries(gradeStats).map(([grade, stats]: [string, any]) => ({
      grade,
      totalStudents: stats.totalStudents,
      independentRate: stats.totalStudents > 0 ? (stats.independent / stats.totalStudents) * 100 : 0,
      instructionalRate: stats.totalStudents > 0 ? (stats.instructional / stats.totalStudents) * 100 : 0,
      frustrationRate: stats.totalStudents > 0 ? (stats.frustration / stats.totalStudents) * 100 : 0,
      improvement: Math.random() * 20 - 10 // Mock improvement data (-10 to +10)
    }));

    // Generate insights
    const insights = generateInsights(overview, teacherPerformance, gradeAnalysis);

    return {
      overview,
      trends,
      teacherPerformance,
      gradeAnalysis,
      insights
    };
  };

  const generateMockTrendData = () => {
    const data = [];
    const days = selectedTimeRange === '7d' ? 7 : selectedTimeRange === '30d' ? 30 : selectedTimeRange === '90d' ? 90 : 365;
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      data.push({
        date: date.toISOString().split('T')[0],
        count: Math.floor(Math.random() * 10) + 1
      });
    }
    return data;
  };

  const generateMockProcessingTrend = () => {
    const data = [];
    const days = selectedTimeRange === '7d' ? 7 : selectedTimeRange === '30d' ? 30 : selectedTimeRange === '90d' ? 90 : 365;
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const approved = Math.floor(Math.random() * 8) + 1;
      const rejected = Math.floor(Math.random() * 3);
      data.push({
        date: date.toISOString().split('T')[0],
        approved,
        rejected
      });
    }
    return data;
  };

  const generateMockQualityTrend = () => {
    const data = [];
    const days = selectedTimeRange === '7d' ? 7 : selectedTimeRange === '30d' ? 30 : selectedTimeRange === '90d' ? 90 : 365;
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      data.push({
        date: date.toISOString().split('T')[0],
        score: Math.random() * 30 + 70 // 70-100 range
      });
    }
    return data;
  };

  const generateInsights = (overview: any, teacherPerformance: any[], gradeAnalysis: any[]) => {
    const insights = [];

    // Processing time insight
    if (overview.averageProcessingTime > 5) {
      insights.push({
        type: 'negative' as const,
        title: 'Long Processing Times',
        description: 'Reports are taking longer than expected to process. Consider streamlining the review process.',
        metric: 'Average Processing Time',
        value: overview.averageProcessingTime
      });
    } else if (overview.averageProcessingTime < 2) {
      insights.push({
        type: 'positive' as const,
        title: 'Efficient Processing',
        description: 'Reports are being processed quickly, maintaining good workflow efficiency.',
        metric: 'Average Processing Time',
        value: overview.averageProcessingTime
      });
    }

    // Quality score insight
    if (overview.qualityScoreAverage > 90) {
      insights.push({
        type: 'positive' as const,
        title: 'High Quality Submissions',
        description: 'Teachers are consistently submitting high-quality reports with minimal issues.',
        metric: 'Average Quality Score',
        value: overview.qualityScoreAverage
      });
    } else if (overview.qualityScoreAverage < 70) {
      insights.push({
        type: 'negative' as const,
        title: 'Quality Concerns',
        description: 'Report quality scores are below target. Consider providing additional training.',
        metric: 'Average Quality Score',
        value: overview.qualityScoreAverage
      });
    }

    // Teacher performance insight
    const topPerformer = teacherPerformance.reduce((best, current) => 
      current.approvalRate > best.approvalRate ? current : best, teacherPerformance[0]);
    
    if (topPerformer && topPerformer.approvalRate > 95) {
      insights.push({
        type: 'positive' as const,
        title: 'Excellent Teacher Performance',
        description: `${topPerformer.teacherName} has achieved ${topPerformer.approvalRate.toFixed(1)}% approval rate.`,
        metric: 'Top Approval Rate',
        value: topPerformer.approvalRate
      });
    }

    // Grade analysis insight
    const strugglingGrades = gradeAnalysis.filter(grade => grade.frustrationRate > 40);
    if (strugglingGrades.length > 0) {
      insights.push({
        type: 'negative' as const,
        title: 'Grades Needing Support',
        description: `${strugglingGrades.length} grade level(s) have high frustration rates requiring intervention.`,
        metric: 'Grades at Risk',
        value: strugglingGrades.length
      });
    }

    return insights;
  };

  const exportAnalytics = () => {
    if (!analyticsData) return;
    
    // Create CSV data
    const csvData = [
      ['Analytics Report - Generated on', new Date().toLocaleDateString()],
      [''],
      ['Overview Metrics'],
      ['Total Reports', analyticsData.overview.totalReports],
      ['Pending Reports', analyticsData.overview.pendingReports],
      ['Approved Reports', analyticsData.overview.approvedReports],
      ['Rejected Reports', analyticsData.overview.rejectedReports],
      ['Average Processing Time (days)', analyticsData.overview.averageProcessingTime.toFixed(2)],
      ['Average Quality Score', analyticsData.overview.qualityScoreAverage.toFixed(1)],
      [''],
      ['Teacher Performance'],
      ['Teacher Name', 'Total Submissions', 'Approval Rate (%)', 'Average Quality', 'Avg Processing Time (days)'],
      ...analyticsData.teacherPerformance.map(teacher => [
        teacher.teacherName,
        teacher.totalSubmissions,
        teacher.approvalRate.toFixed(1),
        teacher.averageQuality.toFixed(1),
        teacher.averageProcessingTime.toFixed(1)
      ]),
      [''],
      ['Grade Analysis'],
      ['Grade', 'Total Students', 'Independent Rate (%)', 'Instructional Rate (%)', 'Frustration Rate (%)', 'Improvement (%)'],
      ...analyticsData.gradeAnalysis.map(grade => [
        grade.grade,
        grade.totalStudents,
        grade.independentRate.toFixed(1),
        grade.instructionalRate.toFixed(1),
        grade.frustrationRate.toFixed(1),
        grade.improvement.toFixed(1)
      ])
    ];

    // Convert to CSV string
    const csvString = csvData.map(row => row.join(',')).join('\n');
    
    // Download CSV
    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `report_analytics_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-slate-200 border-t-indigo-600 mx-auto"></div>
          <p className="mt-4 text-slate-600 font-medium">Loading Analytics...</p>
        </div>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <ExclamationTriangleIcon className="h-16 w-16 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Unable to Load Analytics</h3>
          <p className="text-slate-600">Please try refreshing the page.</p>
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
              <h1 className="text-2xl font-bold text-slate-900">Report Analytics</h1>
              <p className="text-slate-600">Comprehensive insights into report processing and performance</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <FunnelIcon className="h-4 w-4" />
                Filters
              </button>
              <button
                onClick={exportAnalytics}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
              >
                <ArrowDownTrayIcon className="h-4 w-4" />
                Export
              </button>
            </div>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="mt-4 p-4 bg-slate-50 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Time Range</label>
                  <select
                    value={selectedTimeRange}
                    onChange={(e) => setSelectedTimeRange(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                    <option value="90d">Last 90 days</option>
                    <option value="1y">Last year</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Grade Level</label>
                  <select
                    value={selectedGrade}
                    onChange={(e) => setSelectedGrade(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="all">All Grades</option>
                    <option value="1">Grade 1</option>
                    <option value="2">Grade 2</option>
                    <option value="3">Grade 3</option>
                    <option value="4">Grade 4</option>
                    <option value="5">Grade 5</option>
                    <option value="6">Grade 6</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={loadAnalyticsData}
                    className="w-full px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Apply Filters
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="p-6 space-y-8">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Total Reports</p>
                <p className="text-2xl font-bold text-slate-900">{analyticsData.overview.totalReports}</p>
              </div>
              <div className="p-3 bg-indigo-100 rounded-lg">
                <DocumentTextIcon className="h-6 w-6 text-indigo-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Pending</p>
                <p className="text-2xl font-bold text-amber-600">{analyticsData.overview.pendingReports}</p>
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
                <p className="text-2xl font-bold text-emerald-600">{analyticsData.overview.approvedReports}</p>
              </div>
              <div className="p-3 bg-emerald-100 rounded-lg">
                <CheckCircleIcon className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Rejected</p>
                <p className="text-2xl font-bold text-rose-600">{analyticsData.overview.rejectedReports}</p>
              </div>
              <div className="p-3 bg-rose-100 rounded-lg">
                <ExclamationTriangleIcon className="h-6 w-6 text-rose-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Avg. Processing</p>
                <p className="text-2xl font-bold text-slate-900">
                  {analyticsData.overview.averageProcessingTime.toFixed(1)}d
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
                <p className="text-2xl font-bold text-indigo-600">
                  {analyticsData.overview.qualityScoreAverage.toFixed(1)}%
                </p>
              </div>
              <div className="p-3 bg-indigo-100 rounded-lg">
                <AcademicCapIcon className="h-6 w-6 text-indigo-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Insights */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Key Insights</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {analyticsData.insights.map((insight, index) => (
              <div key={index} className={`p-4 rounded-lg border-l-4 ${
                insight.type === 'positive' ? 'bg-emerald-50 border-emerald-400' :
                insight.type === 'negative' ? 'bg-rose-50 border-rose-400' :
                'bg-blue-50 border-blue-400'
              }`}>
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${
                    insight.type === 'positive' ? 'bg-emerald-100' :
                    insight.type === 'negative' ? 'bg-rose-100' :
                    'bg-blue-100'
                  }`}>
                    {insight.type === 'positive' ? (
                      <ArrowTrendingUpIcon className={`h-5 w-5 ${
                        insight.type === 'positive' ? 'text-emerald-600' : 'text-rose-600'
                      }`} />
                    ) : insight.type === 'negative' ? (
                      <ArrowTrendingDownIcon className="h-5 w-5 text-rose-600" />
                    ) : (
                      <ChartBarIcon className="h-5 w-5 text-blue-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-slate-900 mb-1">{insight.title}</h4>
                    <p className="text-sm text-slate-600 mb-2">{insight.description}</p>
                    {insight.metric && insight.value !== undefined && (
                      <div className="text-xs text-slate-500">
                        {insight.metric}: <span className="font-medium">{insight.value}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Teacher Performance */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <UserGroupIcon className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Teacher Performance</h3>
                <p className="text-sm text-slate-600">Analysis of teacher submission quality and approval rates</p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Teacher
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Submissions
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Approval Rate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Quality Score
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Avg. Processing
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {analyticsData.teacherPerformance.slice(0, 10).map((teacher, index) => (
                  <tr key={index} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{teacher.teacherName}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {teacher.totalSubmissions}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          teacher.approvalRate >= 90 ? 'bg-emerald-500' :
                          teacher.approvalRate >= 70 ? 'bg-amber-500' :
                          'bg-rose-500'
                        }`}></div>
                        <span className="text-sm font-medium text-slate-900">
                          {teacher.approvalRate.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        teacher.averageQuality >= 90 ? 'bg-emerald-100 text-emerald-800' :
                        teacher.averageQuality >= 70 ? 'bg-amber-100 text-amber-800' :
                        'bg-rose-100 text-rose-800'
                      }`}>
                        {teacher.averageQuality.toFixed(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {teacher.averageProcessingTime.toFixed(1)} days
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Grade Analysis */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <AcademicCapIcon className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Grade Level Analysis</h3>
                <p className="text-sm text-slate-600">Reading performance distribution by grade level</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {analyticsData.gradeAnalysis.map((grade, index) => (
                <div key={index} className="border border-slate-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-slate-900">{grade.grade}</h4>
                    <span className="text-sm text-slate-600">{grade.totalStudents} students</span>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-slate-600">Independent</span>
                        <span className="font-medium text-emerald-600">{grade.independentRate.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div 
                          className="bg-emerald-500 h-2 rounded-full" 
                          style={{ width: `${grade.independentRate}%` }}
                        ></div>
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-slate-600">Instructional</span>
                        <span className="font-medium text-amber-600">{grade.instructionalRate.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div 
                          className="bg-amber-500 h-2 rounded-full" 
                          style={{ width: `${grade.instructionalRate}%` }}
                        ></div>
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-slate-600">Frustration</span>
                        <span className="font-medium text-rose-600">{grade.frustrationRate.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div 
                          className="bg-rose-500 h-2 rounded-full" 
                          style={{ width: `${grade.frustrationRate}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-200">
                    <div className="flex items-center gap-2">
                      {grade.improvement > 0 ? (
                        <ArrowTrendingUpIcon className="h-4 w-4 text-emerald-500" />
                      ) : grade.improvement < 0 ? (
                        <ArrowTrendingDownIcon className="h-4 w-4 text-rose-500" />
                      ) : (
                        <div className="h-4 w-4 flex items-center justify-center">
                          <div className="w-3 h-0.5 bg-slate-400"></div>
                        </div>
                      )}
                      <span className={`text-sm font-medium ${
                        grade.improvement > 0 ? 'text-emerald-600' :
                        grade.improvement < 0 ? 'text-rose-600' :
                        'text-slate-600'
                      }`}>
                        {grade.improvement > 0 ? '+' : ''}{grade.improvement.toFixed(1)}% change
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportAnalytics;