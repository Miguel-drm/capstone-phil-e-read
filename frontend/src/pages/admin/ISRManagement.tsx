import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import {
  MagnifyingGlassIcon,
  ArrowLeftIcon,
  DocumentTextIcon,
  UserGroupIcon,
  CalendarIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  EyeIcon,
  ArrowDownTrayIcon,
  TableCellsIcon,
  AcademicCapIcon,
  UserIcon,
  UsersIcon
} from '@heroicons/react/24/outline';
import * as XLSX from 'xlsx';
import { isrService, type ISRSubmissionData, type ISRStudentData } from '../../services/isrService';
import DepEdISRViewer from '../../components/admin/DepEdISRViewer';
import AdminLoader from '../../components/admin/AdminLoader';
import { useAuth } from '../../contexts/AuthContext';
import { showSuccess, showError } from '../../services/alertService';

// Essential types only
interface FilterOptions {
  status: 'all' | 'approved' | 'pending' | 'rejected';
}

interface StatusConfig {
  badge: string;
  border: string;
  hover: string;
  icon: React.ComponentType<any>;
}

// Essential constants
const STATUS_PRIORITY = { pending: 0, approved: 1, rejected: 2 } as const;

// Simplified Status Badge
const StatusBadge = memo(({ status, config }: { status: string; config: StatusConfig }) => {
  const StatusIcon = config.icon;
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${config.badge}`}>
      <StatusIcon className="h-3.5 w-3.5" />
      <span className="text-xs font-semibold">{status}</span>
    </div>
  );
});

// Simplified Student Card - Essential info only
const StudentCard = memo(({
  student,
  index,
  onViewISR
}: {
  student: ISRStudentData;
  index: number;
  onViewISR: (student: ISRStudentData) => void;
}) => {
  const uniqueKey = `${student.studentId || 'student'}-${student.studentName || 'unknown'}-${index}`;

  return (
    <div
      key={uniqueKey}
      className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-lg hover:border-indigo-300 transition-all duration-200 p-5 group"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3 flex-1">
          <div className="p-2.5 bg-gradient-to-br from-indigo-100 to-indigo-50 rounded-lg border border-indigo-200 group-hover:from-indigo-200 group-hover:to-indigo-100 transition-colors">
            <UsersIcon className="h-5 w-5 text-indigo-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-900 text-sm mb-1 truncate">{student.studentName}</h3>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700">
                {student.language}
              </span>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={() => onViewISR(student)}
        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white text-sm font-semibold py-2.5 px-4 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
      >
        <EyeIcon className="h-5 w-5 stroke-2" />
        View ISR
      </button>
    </div>
  );
});

// Simplified Record Card - Essential info only
const RecordCard = memo(({
  record,
  statusConfig,
  onClassClick,
  onApprove,
  onReject,
  isProcessing
}: {
  record: ISRSubmissionData;
  statusConfig: StatusConfig;
  onClassClick: (record: ISRSubmissionData) => void;
  onApprove?: (record: ISRSubmissionData) => void;
  onReject?: (record: ISRSubmissionData) => void;
  isProcessing?: boolean;
}) => {
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <DocumentTextIcon className="h-4 w-4 text-indigo-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">
              {record.status === 'approved'
                ? record.section && record.section !== 'N/A' && record.section.trim() !== ''
                  ? `Grade ${record.grade} - ${record.section}`
                  : `Grade ${record.grade}`
                : 'Class Information Hidden'
              }
            </h3>
            <p className="text-xs text-slate-600">
              {record.status === 'approved'
                ? record.teacherName
                : 'Pending Admin Approval'
              }
            </p>
          </div>
        </div>
        <StatusBadge status={record.status} config={statusConfig} />
      </div>

      <div className="flex items-center justify-between mb-3 text-xs text-slate-600">
        <span>{record.studentCount} students</span>
        <span>{record.submissionDate.toLocaleDateString()}</span>
      </div>

      {record.status === 'pending' && onApprove && onReject ? (
        <div className="flex gap-2">
          <button
            onClick={() => onApprove(record)}
            disabled={isProcessing}
            className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium py-2 px-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircleIcon className="h-4 w-4 stroke-2" />
            Approve
          </button>
          <button
            onClick={() => onReject(record)}
            disabled={isProcessing}
            className="flex-1 flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium py-2 px-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <XCircleIcon className="h-4 w-4 stroke-2" />
            Reject
          </button>
        </div>
      ) : (
        <button
          onClick={() => onClassClick(record)}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium py-2 px-3 rounded-lg transition-colors"
        >
          <EyeIcon className="h-4 w-4 stroke-2" />
          View Details
        </button>
      )}
    </div>
  );
});

const ISRManagement: React.FC = () => {
  const { currentUser } = useAuth();
  // Essential state only
  const [allRecords, setAllRecords] = useState<ISRSubmissionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<ISRStudentData | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ISRSubmissionData | null>(null);
  const [showStudentDetails, setShowStudentDetails] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [detailViewMode, setDetailViewMode] = useState<'grid' | 'table'>('grid');
  const [processingRecordId, setProcessingRecordId] = useState<string | null>(null);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [recordToApprove, setRecordToApprove] = useState<ISRSubmissionData | null>(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [recordToReject, setRecordToReject] = useState<ISRSubmissionData | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const [filters, setFilters] = useState<FilterOptions>({
    status: 'all'
  });

  // Essential status configurations
  const statusConfigs = useMemo(() => ({
    approved: {
      badge: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
      border: 'border-l-emerald-500',
      hover: 'hover:bg-emerald-50',
      icon: CheckCircleIcon
    },
    pending: {
      badge: 'bg-amber-50 text-amber-700 border border-amber-200',
      border: 'border-l-amber-500',
      hover: 'hover:bg-amber-50',
      icon: ClockIcon
    },
    rejected: {
      badge: 'bg-rose-50 text-rose-700 border border-rose-200',
      border: 'border-l-rose-500',
      hover: 'hover:bg-rose-50',
      icon: XCircleIcon
    },
    default: {
      badge: 'bg-slate-50 text-slate-700 border border-slate-200',
      border: 'border-l-slate-500',
      hover: 'hover:bg-slate-50',
      icon: ClockIcon
    }
  }), []);

  // Simplified filtering
  const filteredRecords = useMemo(() => {
    let filtered = allRecords;

    if (filters.status !== 'all') {
      filtered = filtered.filter(record => record.status === filters.status);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(record =>
        record.teacherName.toLowerCase().includes(query) ||
        record.className.toLowerCase().includes(query) ||
        `grade ${record.grade}`.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [allRecords, filters, searchQuery]);

  // Essential statistics only
  const statistics = useMemo(() => {
    const pending = allRecords.filter(r => r.status === 'pending').length;
    const approved = allRecords.filter(r => r.status === 'approved').length;
    const rejected = allRecords.filter(r => r.status === 'rejected').length;
    const total = allRecords.length;
    const totalStudents = allRecords.reduce((sum, record) => sum + record.studentCount, 0);
    const uniqueTeachers = new Set(allRecords.map(r => r.teacherId)).size;

    // Recent activity (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const recentSubmissions = allRecords.filter(r =>
      new Date(r.submissionDate) >= weekAgo
    ).length;

    const averageStudentsPerClass = total > 0 ? Math.round(totalStudents / total) : 0;

    return {
      pending,
      approved,
      rejected,
      total,
      totalStudents,
      uniqueTeachers,
      recentSubmissions,
      averageStudentsPerClass
    };
  }, [allRecords]);
  // Essential event handlers
  const fetchISRRecords = useCallback(async () => {
    try {
      setLoading(true);
      const records = await isrService.getISRSubmissions('all');

      const sortedRecords = records.sort((a, b) => {
        const priorityA = STATUS_PRIORITY[a.status as keyof typeof STATUS_PRIORITY] ?? 4;
        const priorityB = STATUS_PRIORITY[b.status as keyof typeof STATUS_PRIORITY] ?? 4;

        if (priorityA !== priorityB) {
          return priorityA - priorityB;
        }

        return new Date(b.submissionDate).getTime() - new Date(a.submissionDate).getTime();
      });

      setAllRecords(sortedRecords);
    } catch (error) {
      console.error('Error fetching ISR records:', error);
    } finally {
      setLoading(false);
    }
  }, []);



  const handleClassClick = useCallback((record: ISRSubmissionData) => {
    setSelectedClass(record);
    setShowStudentDetails(true);
  }, []);

  const handleViewStudentISR = useCallback((student: ISRStudentData) => {
    setSelectedStudent(student);
    setIsViewerOpen(true);
  }, []);

  const handleBackToList = useCallback(() => {
    setSelectedClass(null);
    setShowStudentDetails(false);
  }, []);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);

  const handleFilterChange = useCallback((key: keyof FilterOptions, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value as FilterOptions[typeof key] }));
  }, []);

  const exportToExcel = useCallback(() => {
    const exportData = filteredRecords.map(record => ({
      'Teacher Name': record.teacherName,
      'Class Name': record.className,
      'Grade': record.grade,
      'Section': record.section,
      'Student Count': record.studentCount,
      'Submission Date': record.submissionDate.toLocaleDateString(),
      'Status': record.status
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ISR Records');

    const fileName = `ISR_Records_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }, [filteredRecords]);

  const getStatusConfig = useCallback((status: string): StatusConfig => {
    return statusConfigs[status as keyof typeof statusConfigs] || statusConfigs.default;
  }, [statusConfigs]);

  const getStatusText = useCallback((status: string) => {
    const statusMap = {
      approved: 'Approved',
      pending: 'Pending',
      rejected: 'Rejected'
    };
    return statusMap[status as keyof typeof statusMap] || 'Pending';
  }, []);

  // Handle approve ISR - open confirmation modal
  const handleApproveISR = useCallback((record: ISRSubmissionData) => {
    if (!currentUser) {
      showError('Error', 'You must be logged in to approve ISR records');
      return;
    }
    setRecordToApprove(record);
    setApprovalModalOpen(true);
  }, [currentUser]);

  // Confirm approval after modal confirmation
  const confirmApproveISR = useCallback(async () => {
    if (!currentUser || !recordToApprove) return;

    setApprovalModalOpen(false);
    setProcessingRecordId(recordToApprove.id);
    
    try {
      const success = await isrService.approveISR(
        recordToApprove.id,
        currentUser.uid,
        currentUser.displayName || 'Admin'
      );

      if (success) {
        showSuccess('Approved', 'ISR submission has been approved successfully');
        await fetchISRRecords(); // Refresh the records
      } else {
        showError('Failed', 'Failed to approve ISR submission');
      }
    } catch (error) {
      console.error('Error approving ISR:', error);
      showError('Error', 'An error occurred while approving the ISR submission');
    } finally {
      setProcessingRecordId(null);
      setRecordToApprove(null);
    }
  }, [currentUser, recordToApprove, fetchISRRecords]);

  // Handle reject ISR - open confirmation modal
  const handleRejectISR = useCallback((record: ISRSubmissionData) => {
    if (!currentUser) {
      showError('Error', 'You must be logged in to reject ISR records');
      return;
    }
    setRecordToReject(record);
    setRejectReason('');
    setRejectModalOpen(true);
  }, [currentUser]);

  // Confirm rejection after modal confirmation
  const confirmRejectISR = useCallback(async () => {
    if (!currentUser || !recordToReject) return;

    setRejectModalOpen(false);
    setProcessingRecordId(recordToReject.id);
    
    try {
      const success = await isrService.rejectISR(
        recordToReject.id,
        currentUser.uid,
        currentUser.displayName || 'Admin',
        rejectReason.trim() || undefined
      );

      if (success) {
        showSuccess('Rejected', 'ISR submission has been rejected');
        await fetchISRRecords(); // Refresh the records
      } else {
        showError('Failed', 'Failed to reject ISR submission');
      }
    } catch (error) {
      console.error('Error rejecting ISR:', error);
      showError('Error', 'An error occurred while rejecting the ISR submission');
    } finally {
      setProcessingRecordId(null);
      setRecordToReject(null);
      setRejectReason('');
    }
  }, [currentUser, recordToReject, rejectReason, fetchISRRecords]);



  useEffect(() => {
    fetchISRRecords();
  }, [fetchISRRecords]);

  // Loading state
  if (loading) {
    return <AdminLoader label="Loading ISR Management..." fullScreen size="lg" />;
  }

  // Student details view - simplified
  if (showStudentDetails && selectedClass) {
    const statusConfig = getStatusConfig(selectedClass.status);
    const StatusIcon = statusConfig.icon;

    return (
      <div className="min-h-screen bg-slate-50">
        <div className="p-4 max-w-7xl mx-auto">
          <div className="mb-6">
            <button
              onClick={handleBackToList}
              className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 mb-4 font-medium transition-colors"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Back to ISR Records
            </button>

            <div className="bg-gradient-to-r from-white to-indigo-50/30 rounded-xl border-2 border-indigo-200 shadow-lg p-6 mb-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl shadow-md">
                    <AcademicCapIcon className="h-8 w-8 text-white" />
                  </div>
                  <div className="flex-1">
                    <h1 className="text-2xl font-bold text-slate-900 mb-1">
                      {selectedClass.status === 'approved'
                        ? selectedClass.section && selectedClass.section !== 'N/A' && selectedClass.section.trim() !== ''
                          ? `Grade ${selectedClass.grade} - ${selectedClass.section}`
                          : `Grade ${selectedClass.grade}`
                        : 'Class Information Hidden'
                      }
                    </h1>
                    <div className="flex items-center gap-4 flex-wrap">
                      <p className="text-base text-slate-600 flex items-center gap-2">
                        <UserIcon className="h-4 w-4 text-slate-500" />
                        {selectedClass.status === 'approved'
                          ? selectedClass.teacherName
                          : 'Pending Admin Approval'
                        }
                      </p>
                      {selectedClass.status === 'approved' && (
                        <p className="text-base text-slate-600 flex items-center gap-2">
                          <UsersIcon className="h-4 w-4 text-slate-500" />
                          {selectedClass.studentCount} students
                        </p>
                      )}
                      <p className="text-base text-slate-600 flex items-center gap-2">
                        <CalendarIcon className="h-4 w-4 text-slate-500" />
                        {selectedClass.submissionDate.toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>

                <div className={`flex items-center gap-2 px-4 py-2 rounded-lg shadow-sm ${statusConfig.badge}`}>
                  <StatusIcon className="h-5 w-5" />
                  <span className="font-semibold text-base">{getStatusText(selectedClass.status)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Simplified student grid - only show if approved */}
          {selectedClass.status === 'approved' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <UsersIcon className="h-5 w-5 text-indigo-600" />
                  Student Records ({selectedClass.students.length})
                </h2>
                
                {/* View toggle buttons */}
                <div className="flex items-center gap-1 bg-white rounded-lg border border-slate-200 p-1 shadow-sm">
                  <button
                    onClick={() => setDetailViewMode('grid')}
                    className={`p-2 rounded-md transition-all duration-200 ${
                      detailViewMode === 'grid'
                        ? 'bg-indigo-100 text-indigo-700 shadow-sm'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                    title="Grid View"
                  >
                    <TableCellsIcon className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setDetailViewMode('table')}
                    className={`p-2 rounded-md transition-all duration-200 ${
                      detailViewMode === 'table'
                        ? 'bg-indigo-100 text-indigo-700 shadow-sm'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                    title="Table View"
                  >
                    <DocumentTextIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Grid View */}
              {detailViewMode === 'grid' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {selectedClass.students.map((student, index) => (
                    <StudentCard
                      key={`${student.studentId || 'student'}-${student.studentName || 'unknown'}-${index}`}
                      student={student}
                      index={index}
                      onViewISR={handleViewStudentISR}
                    />
                  ))}
                </div>
              )}

              {/* Table View */}
              {detailViewMode === 'table' && (
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                            <div className="flex items-center gap-2">
                              <UsersIcon className="h-4 w-4 text-indigo-600" />
                              Student Name
                            </div>
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                            Language
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedClass.students.map((student, index) => (
                          <tr
                            key={`${student.studentId || 'student'}-${student.studentName || 'unknown'}-${index}`}
                            className="hover:bg-slate-50 transition-colors"
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="p-1.5 bg-indigo-50 rounded-lg border border-indigo-100">
                                  <UsersIcon className="h-4 w-4 text-indigo-600" />
                                </div>
                                <span className="text-sm font-semibold text-slate-900">{student.studentName}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700">
                                {student.language}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => handleViewStudentISR(student)}
                                className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white text-sm font-semibold py-2 px-4 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
                              >
                                <EyeIcon className="h-4 w-4 stroke-2" />
                                View ISR
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-8">
              <div className="text-center">
                <div className="mx-auto w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
                  <ClockIcon className="h-8 w-8 text-amber-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Pending Admin Approval</h3>
                <p className="text-slate-600 max-w-md mx-auto">
                  Student information and ISR data will be visible once this submission is approved by an administrator.
                </p>
              </div>
            </div>
          )}

          {/* ISR Viewer Modal */}
          {isViewerOpen && selectedStudent && (
            <DepEdISRViewer
              data={selectedStudent}
              onClose={() => {
                setIsViewerOpen(false);
                setSelectedStudent(null);
              }}
            />
          )}
        </div>
      </div>
    );
  }

  // Main view - simplified
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-3 sm:p-4 lg:p-6 max-w-7xl mx-auto">
        {/* Simplified header - Responsive */}
        <div className="mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-4">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <div className="p-2 bg-indigo-100 rounded-lg flex-shrink-0">
                <DocumentTextIcon className="h-5 w-5 sm:h-6 sm:w-6 text-indigo-600" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 truncate">ISR Management</h1>
                <p className="text-slate-600 text-xs sm:text-sm truncate">Individual Summary Records management</p>
              </div>
            </div>

            <button
              onClick={exportToExcel}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm sm:text-base font-medium transition-colors w-full sm:w-auto justify-center"
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Export</span>
              <span className="sm:hidden">Export to Excel</span>
            </button>
          </div>

          {/* Essential statistics only - 5 most important cards - Responsive */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 lg:gap-4 mb-4 sm:mb-6">
            <div className="bg-white rounded-lg p-3 sm:p-4 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-slate-100 rounded-lg flex-shrink-0">
                  <DocumentTextIcon className="h-4 w-4 sm:h-5 sm:w-5 text-slate-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-600 truncate">Total</p>
                  <p className="text-xl sm:text-2xl font-bold text-slate-900">{statistics.total}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-3 sm:p-4 border border-amber-200 shadow-sm">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-amber-100 rounded-lg flex-shrink-0">
                  <ClockIcon className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-amber-700 truncate">Pending</p>
                  <p className="text-xl sm:text-2xl font-bold text-amber-900">{statistics.pending}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-3 sm:p-4 border border-emerald-200 shadow-sm">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-emerald-100 rounded-lg flex-shrink-0">
                  <CheckCircleIcon className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-emerald-700 truncate">Approved</p>
                  <p className="text-xl sm:text-2xl font-bold text-emerald-900">{statistics.approved}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-3 sm:p-4 border border-rose-200 shadow-sm">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-rose-100 rounded-lg flex-shrink-0">
                  <XCircleIcon className="h-4 w-4 sm:h-5 sm:w-5 text-rose-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-rose-700 truncate">Rejected</p>
                  <p className="text-xl sm:text-2xl font-bold text-rose-900">{statistics.rejected}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-3 sm:p-4 border border-blue-200 shadow-sm">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg flex-shrink-0">
                  <UserGroupIcon className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-blue-700 truncate">Students</p>
                  <p className="text-xl sm:text-2xl font-bold text-blue-900">{statistics.totalStudents}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Simplified status filter tabs - Responsive */}
        <div className="flex flex-wrap gap-2 mb-3 sm:mb-4 overflow-x-auto scrollbar-hide pb-2 -mx-3 sm:-mx-0 px-3 sm:px-0">
          {[
            { key: 'all', label: 'All', count: statistics.total },
            { key: 'pending', label: 'Pending', count: statistics.pending },
            { key: 'approved', label: 'Approved', count: statistics.approved },
            { key: 'rejected', label: 'Rejected', count: statistics.rejected }
          ].map(tab => {
            const isActive = filters.status === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => handleFilterChange('status', tab.key)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium text-sm transition-all duration-200 ${isActive
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
              >
                {tab.label}
                <span className={`px-1.5 py-0.5 rounded-full text-xs font-semibold ${isActive ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-700'
                  }`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Simplified search and view controls - Responsive */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm mb-3 sm:mb-4">
          <div className="p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
              {/* Simple search bar */}
              <div className="relative flex-1 min-w-0">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MagnifyingGlassIcon className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search by teacher, class, grade..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  className="block w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm bg-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              {/* Simple view toggle */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-2 rounded-lg transition-colors ${viewMode === 'table' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  title="Table View"
                >
                  <TableCellsIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  title="Grid View"
                >
                  <DocumentTextIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Results */}
        {filteredRecords.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
            <div className="text-center py-12">
              <div className="mx-auto w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <DocumentTextIcon className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No ISR Records Found</h3>
              <p className="text-slate-500 max-w-md mx-auto">
                {searchQuery || filters.status !== 'all'
                  ? 'No records match your current search and filter criteria.'
                  : 'No ISR records have been submitted yet.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Simple results header */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">
                Showing {filteredRecords.length} of {statistics.total} records
              </span>
            </div>

            {/* Grid View - Simplified - Responsive */}
            {viewMode === 'grid' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {filteredRecords.map(record => (
                  <RecordCard
                    key={record.id}
                    record={record}
                    statusConfig={getStatusConfig(record.status)}
                    onClassClick={handleClassClick}
                    onApprove={record.status === 'pending' ? handleApproveISR : undefined}
                    onReject={record.status === 'pending' ? handleRejectISR : undefined}
                    isProcessing={processingRecordId === record.id}
                  />
                ))}
              </div>
            )}

            {/* Table View - Simplified - Responsive */}
            {viewMode === 'table' && (
              <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                {/* Simple table header - Hidden on mobile */}
                <div className="hidden md:block bg-slate-50 px-4 py-3 border-b border-slate-200">
                  <div className="grid grid-cols-12 gap-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    <div className="col-span-4 flex items-center gap-2">
                      <AcademicCapIcon className="h-4 w-4 text-indigo-600" />
                      Class Information
                    </div>
                    <div className="col-span-2 flex items-center gap-2">
                      <UserIcon className="h-4 w-4 text-indigo-600" />
                      Teacher
                    </div>
                    <div className="col-span-1 flex items-center gap-2">
                      <UsersIcon className="h-4 w-4 text-indigo-600" />
                      Students
                    </div>
                    <div className="col-span-2 flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4 text-indigo-600" />
                      Submitted
                    </div>
                    <div className="col-span-3 flex items-center gap-2">
                      <CheckCircleIcon className="h-4 w-4 text-indigo-600" />
                      Status & Actions
                    </div>
                  </div>
                </div>

                {/* Simple table body */}
                <div className="divide-y divide-slate-100">
                  {filteredRecords.map(record => {
                    const statusConfig = getStatusConfig(record.status);

                    return (
                      <div
                        key={record.id}
                        className={`px-3 sm:px-4 py-3 transition-all duration-200 border-l-4 ${statusConfig.border} ${statusConfig.hover} hover:shadow-sm`}
                      >
                        {/* Mobile View - Stacked */}
                        <div className="md:hidden space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <div className="p-1.5 bg-indigo-50 rounded-lg border border-indigo-100 flex-shrink-0">
                                <AcademicCapIcon className="h-4 w-4 text-indigo-600" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <h3 className="text-sm font-semibold text-slate-900 truncate">
                                  {record.status === 'approved'
                                    ? record.section && record.section !== 'N/A' && record.section.trim() !== ''
                                      ? `Grade ${record.grade} - ${record.section}`
                                      : `Grade ${record.grade}`
                                    : 'Class Information Hidden'
                                  }
                                </h3>
                                <p className="text-xs text-slate-600 mt-0.5 truncate">
                                  {record.status === 'approved'
                                    ? record.className
                                    : 'Pending Admin Approval'
                                  }
                                </p>
                              </div>
                            </div>
                            <StatusBadge status={getStatusText(record.status)} config={statusConfig} />
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div className="flex items-center gap-2">
                              <UserIcon className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
                              <span className="text-slate-700 truncate">
                                {record.status === 'approved' ? record.teacherName : 'Hidden'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <UsersIcon className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
                              <span className="text-slate-700">{record.studentCount} students</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <CalendarIcon className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
                              <span className="text-slate-700">{record.submissionDate.toLocaleDateString()}</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 flex-wrap">
                            {record.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => handleApproveISR(record)}
                                  disabled={processingRecordId === record.id}
                                  className="flex-1 sm:flex-none px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg transition-all duration-200 hover:shadow-sm border border-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium"
                                  title="Approve ISR"
                                >
                                  <CheckCircleIcon className="h-4 w-4 inline mr-1" />
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleRejectISR(record)}
                                  disabled={processingRecordId === record.id}
                                  className="flex-1 sm:flex-none px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-lg transition-all duration-200 hover:shadow-sm border border-rose-300 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium"
                                  title="Reject ISR"
                                >
                                  <XCircleIcon className="h-4 w-4 inline mr-1" />
                                  Reject
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => handleClassClick(record)}
                              className="flex-1 sm:flex-none px-3 py-1.5 bg-slate-100 hover:bg-indigo-100 text-slate-600 hover:text-indigo-700 rounded-lg transition-all duration-200 hover:shadow-sm border border-slate-200 hover:border-indigo-300 text-xs font-medium"
                              title="View details"
                            >
                              <EyeIcon className="h-4 w-4 inline mr-1" />
                              View
                            </button>
                          </div>
                        </div>
                        
                        {/* Desktop View - Grid */}
                        <div className="hidden md:grid grid-cols-12 gap-4 items-center">
                          <div className="col-span-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-indigo-50 rounded-lg border border-indigo-100">
                                <AcademicCapIcon className="h-4 w-4 text-indigo-600" />
                              </div>
                              <div>
                                <h3 className="text-sm font-semibold text-slate-900">
                                  {record.status === 'approved'
                                    ? record.section && record.section !== 'N/A' && record.section.trim() !== ''
                                      ? `Grade ${record.grade} - ${record.section}`
                                      : `Grade ${record.grade}`
                                    : 'Class Information Hidden'
                                  }
                                </h3>
                                <p className="text-xs text-slate-600 mt-0.5">
                                  {record.status === 'approved'
                                    ? record.className
                                    : 'Pending Admin Approval'
                                  }
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="col-span-2">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 bg-slate-50 rounded-lg">
                                <UserIcon className="h-3.5 w-3.5 text-slate-600" />
                              </div>
                              <span className="text-sm font-medium text-slate-900">
                                {record.status === 'approved'
                                  ? record.teacherName
                                  : 'Hidden'
                                }
                              </span>
                            </div>
                          </div>

                          <div className="col-span-1">
                            <div className="flex items-center gap-2">
                              <UsersIcon className="h-3.5 w-3.5 text-slate-500" />
                              <span className="text-sm font-medium text-slate-900">{record.studentCount}</span>
                            </div>
                          </div>

                          <div className="col-span-2">
                            <div className="flex items-center gap-1">
                              <CalendarIcon className="h-3 w-3 text-slate-500" />
                              <span className="text-sm text-slate-700">{record.submissionDate.toLocaleDateString()}</span>
                            </div>
                          </div>

                          <div className="col-span-3">
                            <div className="flex items-center gap-2">
                              <StatusBadge status={getStatusText(record.status)} config={statusConfig} />
                              {record.status === 'pending' && (
                                <>
                                  <button
                                    onClick={() => handleApproveISR(record)}
                                    disabled={processingRecordId === record.id}
                                    className="p-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg transition-all duration-200 hover:shadow-sm border border-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Approve ISR"
                                  >
                                    <CheckCircleIcon className="h-5 w-5 stroke-2" />
                                  </button>
                                  <button
                                    onClick={() => handleRejectISR(record)}
                                    disabled={processingRecordId === record.id}
                                    className="p-2 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-lg transition-all duration-200 hover:shadow-sm border border-rose-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Reject ISR"
                                  >
                                    <XCircleIcon className="h-5 w-5 stroke-2" />
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => handleClassClick(record)}
                                className="p-2 bg-slate-100 hover:bg-indigo-100 text-slate-600 hover:text-indigo-700 rounded-lg transition-all duration-200 hover:shadow-sm border border-slate-200 hover:border-indigo-300"
                                title="View details"
                              >
                                <EyeIcon className="h-5 w-5 stroke-2" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Approval Confirmation Modal */}
      {approvalModalOpen && recordToApprove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md relative border border-gray-200 shadow-xl">
            <button
              className="absolute top-3 right-4 text-gray-400 hover:text-red-500 text-2xl font-bold transition-colors"
              onClick={() => {
                setApprovalModalOpen(false);
                setRecordToApprove(null);
              }}
              title="Close"
            >
              ×
            </button>
            
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
                <CheckCircleIcon className="w-8 h-8 text-emerald-600" />
              </div>
            </div>
            
            <h2 className="text-2xl font-bold text-gray-900 text-center mb-4">
              Approve ISR Submission
            </h2>
            
            <p className="text-gray-600 text-center mb-6">
              Are you sure you want to approve this ISR submission for{' '}
              <span className="font-semibold text-gray-900">
                {recordToApprove.className || 'this class'}
              </span>?
            </p>
            
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="flex justify-between mb-2">
                <span className="text-gray-600 font-medium">Class:</span>
                <span className="text-gray-900 font-semibold">{recordToApprove.className || 'N/A'}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-600 font-medium">Students:</span>
                <span className="text-gray-900 font-semibold">{recordToApprove.studentCount || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 font-medium">Teacher:</span>
                <span className="text-gray-900 font-semibold">{recordToApprove.teacherName || 'N/A'}</span>
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setApprovalModalOpen(false);
                  setRecordToApprove(null);
                }}
                className="px-6 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmApproveISR}
                disabled={processingRecordId === recordToApprove.id}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {processingRecordId === recordToApprove.id ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircleIcon className="w-5 h-5" />
                    Approve
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Confirmation Modal */}
      {rejectModalOpen && recordToReject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md relative border border-gray-200 shadow-xl">
            <button
              className="absolute top-3 right-4 text-gray-400 hover:text-red-500 text-2xl font-bold transition-colors"
              onClick={() => {
                setRejectModalOpen(false);
                setRecordToReject(null);
                setRejectReason('');
              }}
              title="Close"
            >
              ×
            </button>
            
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center">
                <XCircleIcon className="w-8 h-8 text-rose-600" />
              </div>
            </div>
            
            <h2 className="text-2xl font-bold text-gray-900 text-center mb-4">
              Reject ISR Submission
            </h2>
            
            <p className="text-gray-600 text-center mb-6">
              Are you sure you want to reject this ISR submission for{' '}
              <span className="font-semibold text-gray-900">
                {recordToReject.className || 'this class'}
              </span>?
            </p>
            
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="flex justify-between mb-2">
                <span className="text-gray-600 font-medium">Class:</span>
                <span className="text-gray-900 font-semibold">{recordToReject.className || 'N/A'}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-600 font-medium">Students:</span>
                <span className="text-gray-900 font-semibold">{recordToReject.studentCount || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 font-medium">Teacher:</span>
                <span className="text-gray-900 font-semibold">{recordToReject.teacherName || 'N/A'}</span>
              </div>
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Please provide a reason (optional):
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter rejection reason..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-rose-500 focus:border-transparent resize-none"
                rows={3}
              />
            </div>
            
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setRejectModalOpen(false);
                  setRecordToReject(null);
                  setRejectReason('');
                }}
                className="px-6 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmRejectISR}
                disabled={processingRecordId === recordToReject.id}
                className="px-6 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {processingRecordId === recordToReject.id ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <XCircleIcon className="w-5 h-5" />
                    Reject
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ISRManagement;