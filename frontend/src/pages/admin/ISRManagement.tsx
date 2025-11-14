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
  TableCellsIcon
} from '@heroicons/react/24/outline';
import * as XLSX from 'xlsx';
import { isrService, type ISRSubmissionData, type ISRStudentData } from '../../services/isrService';
import DepEdISRViewer from '../../components/admin/DepEdISRViewer';
import AdminLoader from '../../components/admin/AdminLoader';

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
      className="bg-white rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <UserGroupIcon className="h-4 w-4 text-indigo-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">{student.studentName}</h3>
            <p className="text-xs text-slate-600">{student.language}</p>
          </div>
        </div>
      </div>

      <button
        onClick={() => onViewISR(student)}
        className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium py-2 px-3 rounded-lg transition-colors"
      >
        <EyeIcon className="h-3 w-3" />
        View ISR
      </button>
    </div>
  );
});

// Simplified Record Card - Essential info only
const RecordCard = memo(({
  record,
  statusConfig,
  onClassClick
}: {
  record: ISRSubmissionData;
  statusConfig: StatusConfig;
  onClassClick: (record: ISRSubmissionData) => void;
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
                ? `Grade ${record.grade} - ${record.section}`
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

      <button
        onClick={() => onClassClick(record)}
        className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium py-2 px-3 rounded-lg transition-colors"
      >
        <EyeIcon className="h-3 w-3" />
        View Details
      </button>
    </div>
  );
});

const ISRManagement: React.FC = () => {
  // Essential state only
  const [allRecords, setAllRecords] = useState<ISRSubmissionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<ISRStudentData | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ISRSubmissionData | null>(null);
  const [showStudentDetails, setShowStudentDetails] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');

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

            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <DocumentTextIcon className="h-6 w-6 text-indigo-600" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-slate-900">
                      {selectedClass.status === 'approved'
                        ? `Grade ${selectedClass.grade} - ${selectedClass.section}`
                        : 'Class Information Hidden'
                      }
                    </h1>
                    <p className="text-sm text-slate-600">
                      {selectedClass.status === 'approved'
                        ? `${selectedClass.teacherName} • ${selectedClass.studentCount} students`
                        : 'Pending Admin Approval • Student details hidden'
                      }
                    </p>
                  </div>
                </div>

                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${statusConfig.badge}`}>
                  <StatusIcon className="h-4 w-4" />
                  <span className="font-semibold text-sm">{getStatusText(selectedClass.status)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Simplified student grid - only show if approved */}
          {selectedClass.status === 'approved' ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
              {selectedClass.students.map((student, index) => (
                <StudentCard
                  key={`${student.studentId || 'student'}-${student.studentName || 'unknown'}-${index}`}
                  student={student}
                  index={index}
                  onViewISR={handleViewStudentISR}
                />
              ))}
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
      <div className="p-4 max-w-7xl mx-auto">
        {/* Simplified header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <DocumentTextIcon className="h-6 w-6 text-indigo-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">ISR Management</h1>
                <p className="text-slate-600 text-sm">Individual Summary Records management</p>
              </div>
            </div>

            <button
              onClick={exportToExcel}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              Export
            </button>
          </div>

          {/* Essential statistics only - 5 most important cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 rounded-lg">
                  <DocumentTextIcon className="h-5 w-5 text-slate-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-600">Total</p>
                  <p className="text-2xl font-bold text-slate-900">{statistics.total}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 border border-amber-200 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <ClockIcon className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-amber-700">Pending</p>
                  <p className="text-2xl font-bold text-amber-900">{statistics.pending}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 border border-emerald-200 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <CheckCircleIcon className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-emerald-700">Approved</p>
                  <p className="text-2xl font-bold text-emerald-900">{statistics.approved}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 border border-rose-200 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-100 rounded-lg">
                  <XCircleIcon className="h-5 w-5 text-rose-600" />
                </div>
                <div>
                  <p className="text-xs text-rose-700">Rejected</p>
                  <p className="text-2xl font-bold text-rose-900">{statistics.rejected}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 border border-blue-200 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <UserGroupIcon className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-blue-700">Students</p>
                  <p className="text-2xl font-bold text-blue-900">{statistics.totalStudents}</p>
                </div>
              </div>
            </div>
          </div>
        </div>        {
/* Simplified status filter tabs */}
        <div className="flex flex-wrap gap-2 mb-4">
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

        {/* Simplified search and view controls */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm mb-4">
          <div className="p-4">
            <div className="flex items-center justify-between">
              {/* Simple search bar */}
              <div className="relative flex-1 max-w-md">
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
              <div className="flex items-center gap-1 ml-4">
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

            {/* Grid View - Simplified */}
            {viewMode === 'grid' && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredRecords.map(record => (
                  <RecordCard
                    key={record.id}
                    record={record}
                    statusConfig={getStatusConfig(record.status)}
                    onClassClick={handleClassClick}
                  />
                ))}
              </div>
            )}

            {/* Table View - Simplified */}
            {viewMode === 'table' && (
              <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                {/* Simple table header */}
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                  <div className="grid grid-cols-12 gap-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    <div className="col-span-4 flex items-center gap-2">
                      <DocumentTextIcon className="h-3 w-3" />
                      Class Information
                    </div>
                    <div className="col-span-2 flex items-center gap-2">
                      <UserGroupIcon className="h-3 w-3" />
                      Teacher
                    </div>
                    <div className="col-span-1 flex items-center gap-2">
                      <UserGroupIcon className="h-3 w-3" />
                      Students
                    </div>
                    <div className="col-span-2 flex items-center gap-2">
                      <CalendarIcon className="h-3 w-3" />
                      Submitted
                    </div>
                    <div className="col-span-3">Status & Actions</div>
                  </div>
                </div>

                {/* Simple table body */}
                <div className="divide-y divide-slate-100">
                  {filteredRecords.map(record => {
                    const statusConfig = getStatusConfig(record.status);

                    return (
                      <div
                        key={record.id}
                        className={`px-4 py-3 transition-all duration-200 border-l-4 ${statusConfig.border} ${statusConfig.hover} hover:shadow-sm`}
                      >
                        <div className="grid grid-cols-12 gap-4 items-center">
                          <div className="col-span-4">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 bg-slate-100 rounded">
                                <DocumentTextIcon className="h-3 w-3 text-slate-600" />
                              </div>
                              <div>
                                <h3 className="text-sm font-semibold text-slate-900">
                                  {record.status === 'approved'
                                    ? `Grade ${record.grade} - ${record.section}`
                                    : 'Class Information Hidden'
                                  }
                                </h3>
                                <p className="text-xs text-slate-600">
                                  {record.status === 'approved'
                                    ? record.className
                                    : 'Pending Admin Approval'
                                  }
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="col-span-2">
                            <div className="text-sm font-medium text-slate-900">
                              {record.status === 'approved'
                                ? record.teacherName
                                : 'Hidden'
                              }
                            </div>
                          </div>

                          <div className="col-span-1">
                            <span className="text-sm font-medium text-slate-900">{record.studentCount}</span>
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
                              <button
                                onClick={() => handleClassClick(record)}
                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                title="View details"
                              >
                                <EyeIcon className="h-3 w-3" />
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
    </div>
  );
};

export default ISRManagement;