import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  MagnifyingGlassIcon, 
  FunnelIcon, 
  ArrowLeftIcon,
  DocumentTextIcon,
  UserGroupIcon,
  CalendarIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  EyeIcon
} from '@heroicons/react/24/outline';
import { isrService, type ISRSubmissionData, type ISRStudentData } from '../../services/isrService';
import DepEdISRViewer from '../../components/admin/DepEdISRViewer';

const ISRManagement: React.FC = () => {
  const [allRecords, setAllRecords] = useState<ISRSubmissionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'approved' | 'pending' | 'rejected'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<ISRStudentData | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ISRSubmissionData | null>(null);
  const [showStudentDetails, setShowStudentDetails] = useState(false);

  useEffect(() => {
    fetchISRRecords();
  }, []);

  // Memoized filtered and searched records
  const filteredRecords = useMemo(() => {
    let filtered = allRecords;
    
    // Filter by status
    if (filter !== 'all') {
      filtered = filtered.filter(record => record.status === filter);
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(record => 
        record.teacherName.toLowerCase().includes(query) ||
        record.className.toLowerCase().includes(query) ||
        `grade ${record.grade}`.toLowerCase().includes(query) ||
        `section ${record.section}`.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [allRecords, filter, searchQuery]);

  // Memoized statistics
  const statistics = useMemo(() => {
    const pending = allRecords.filter(r => r.status === 'pending').length;
    const approved = allRecords.filter(r => r.status === 'approved').length;
    const rejected = allRecords.filter(r => r.status === 'rejected').length;
    const total = allRecords.length;
    
    return { pending, approved, rejected, total };
  }, [allRecords]);

  const fetchISRRecords = useCallback(async () => {
    try {
      setLoading(true);
      const records = await isrService.getISRSubmissions('all');
      
      // Sort records by status priority: pending first, then approved, then rejected
      const sortedRecords = records.sort((a, b) => {
        const statusPriority = { 'pending': 0, 'approved': 1, 'rejected': 2 };
        const priorityA = statusPriority[a.status as keyof typeof statusPriority] ?? 3;
        const priorityB = statusPriority[b.status as keyof typeof statusPriority] ?? 3;
        
        if (priorityA !== priorityB) {
          return priorityA - priorityB;
        }
        
        // If same status, sort by submission date (newest first)
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



  // Enhanced status styling with modern colors
  const getStatusConfig = useCallback((status: string) => {
    switch (status) {
      case 'approved':
        return {
          badge: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
          border: 'border-l-emerald-500',
          hover: 'hover:bg-emerald-50',
          icon: CheckCircleIcon,
          color: 'text-emerald-600'
        };
      case 'pending':
        return {
          badge: 'bg-amber-50 text-amber-700 border border-amber-200',
          border: 'border-l-amber-500',
          hover: 'hover:bg-amber-50',
          icon: ClockIcon,
          color: 'text-amber-600'
        };
      case 'rejected':
        return {
          badge: 'bg-rose-50 text-rose-700 border border-rose-200',
          border: 'border-l-rose-500',
          hover: 'hover:bg-rose-50',
          icon: XCircleIcon,
          color: 'text-rose-600'
        };
      default:
        return {
          badge: 'bg-slate-50 text-slate-700 border border-slate-200',
          border: 'border-l-slate-500',
          hover: 'hover:bg-slate-50',
          icon: ClockIcon,
          color: 'text-slate-600'
        };
    }
  }, []);

  const getStatusText = useCallback((status: string) => {
    switch (status) {
      case 'approved': return 'Approved';
      case 'pending': return 'Pending';
      case 'rejected': return 'Rejected';
      default: return 'Pending';
    }
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-slate-200 border-t-blue-600"></div>
          <DocumentTextIcon className="absolute inset-0 m-auto h-8 w-8 text-blue-600" />
        </div>
        <p className="mt-4 text-slate-600 font-medium">Loading ISR Records...</p>
      </div>
    );
  }

  if (showStudentDetails && selectedClass) {
    const statusConfig = getStatusConfig(selectedClass.status);
    const StatusIcon = statusConfig.icon;
    
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="p-6 max-w-7xl mx-auto">
          {/* Enhanced Header with Back Button */}
          <div className="mb-8">
            <button
              onClick={handleBackToList}
              className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6 font-medium transition-colors"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Back to ISR Records
            </button>
            
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-blue-100 rounded-xl">
                    <DocumentTextIcon className="h-8 w-8 text-blue-600" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">
                      Grade {selectedClass.grade} - Section {selectedClass.section}
                    </h1>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
                      <div className="flex items-center gap-2">
                        <UserGroupIcon className="h-4 w-4" />
                        Teacher: {selectedClass.teacherName}
                      </div>
                      <div className="flex items-center gap-2">
                        <UserGroupIcon className="h-4 w-4" />
                        {selectedClass.studentCount} students
                      </div>
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="h-4 w-4" />
                        Submitted: {selectedClass.submissionDate.toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${statusConfig.badge}`}>
                  <StatusIcon className="h-4 w-4" />
                  <span className="font-semibold">{getStatusText(selectedClass.status)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Student Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {selectedClass.students.map((student, index) => {
              const getReadingLevel = (data: any) => {
                if (data.wordReading.ind && data.comprehension.ind) return { level: 'Independent', color: 'text-emerald-700 bg-emerald-50' };
                if (data.wordReading.ins && data.comprehension.ins) return { level: 'Instructional', color: 'text-amber-700 bg-amber-50' };
                return { level: 'Frustration', color: 'text-rose-700 bg-rose-50' };
              };
              
              const readingLevel = student.readingData[0] ? getReadingLevel(student.readingData[0]) : null;
              
              return (
                <div
                  key={student.studentId || index}
                  className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <UserGroupIcon className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-slate-900">
                            {student.studentName}
                          </h3>
                          <p className="text-sm text-slate-600">
                            {student.age ? `Age: ${student.age}` : 'Age not specified'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 mb-6">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">Language:</span>
                        <span className="font-medium text-slate-900">{student.language}</span>
                      </div>
                      
                      {readingLevel && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-600">Reading Level:</span>
                          <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${readingLevel.color}`}>
                            {readingLevel.level}
                          </span>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => handleViewStudentISR(student)}
                      className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-3 px-4 rounded-lg transition-colors"
                    >
                      <EyeIcon className="h-4 w-4" />
                      View Full ISR
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ISR Viewer Modal - View Only */}
          {isViewerOpen && selectedStudent && (
            <DepEdISRViewer
              data={selectedStudent}
              onClose={() => {
                setIsViewerOpen(false);
                setSelectedStudent(null);
              }}
              viewOnly={true}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-6 max-w-7xl mx-auto">
        {/* Enhanced Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <DocumentTextIcon className="h-8 w-8 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">ISR Records Management</h1>
              <p className="text-slate-600">Manage Individual Summary Records submitted by teachers</p>
            </div>
          </div>
          
          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 rounded-lg">
                  <DocumentTextIcon className="h-5 w-5 text-slate-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600">Total Records</p>
                  <p className="text-2xl font-bold text-slate-900">{statistics.total}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl p-4 border border-amber-200 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <ClockIcon className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-amber-700">Pending</p>
                  <p className="text-2xl font-bold text-amber-900">{statistics.pending}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl p-4 border border-emerald-200 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <CheckCircleIcon className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-emerald-700">Approved</p>
                  <p className="text-2xl font-bold text-emerald-900">{statistics.approved}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl p-4 border border-rose-200 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-100 rounded-lg">
                  <XCircleIcon className="h-5 w-5 text-rose-600" />
                </div>
                <div>
                  <p className="text-sm text-rose-700">Rejected</p>
                  <p className="text-2xl font-bold text-rose-900">{statistics.rejected}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Filters and Search */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            {/* Filter Tabs */}
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'all', label: 'All Records', count: statistics.total, icon: DocumentTextIcon },
                { key: 'pending', label: 'Pending', count: statistics.pending, icon: ClockIcon },
                { key: 'approved', label: 'Approved', count: statistics.approved, icon: CheckCircleIcon },
                { key: 'rejected', label: 'Rejected', count: statistics.rejected, icon: XCircleIcon }
              ].map(tab => {
                const Icon = tab.icon;
                const isActive = filter === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setFilter(tab.key as any)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                      isActive
                        ? 'bg-blue-100 text-blue-700 border-2 border-blue-200'
                        : 'bg-slate-50 text-slate-600 border-2 border-transparent hover:bg-slate-100 hover:text-slate-700'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      isActive ? 'bg-blue-200 text-blue-800' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Search Bar */}
            <div className="relative w-full lg:w-80">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="text"
                placeholder="Search by teacher, class, grade, or section..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg leading-5 bg-white placeholder-slate-500 focus:outline-none focus:placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
          </div>
        </div>

        {/* ISR Records List */}
        {filteredRecords.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="text-center py-16">
              <div className="mx-auto w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <DocumentTextIcon className="h-12 w-12 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No ISR Records Found</h3>
              <p className="text-slate-500 max-w-md mx-auto">
                {searchQuery ? 'No records match your search criteria. Try adjusting your search terms.' : 'No ISR records match the current filter.'}
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
                >
                  Clear search
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Results Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FunnelIcon className="h-5 w-5 text-slate-500" />
                <span className="text-sm text-slate-600">
                  Showing {filteredRecords.length} of {statistics.total} records
                  {searchQuery && ` for "${searchQuery}"`}
                </span>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Enhanced Table Header */}
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
                <div className="grid grid-cols-12 gap-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <div className="col-span-4 flex items-center gap-2">
                    <DocumentTextIcon className="h-4 w-4" />
                    Class Information
                  </div>
                  <div className="col-span-2 flex items-center gap-2">
                    <UserGroupIcon className="h-4 w-4" />
                    Teacher
                  </div>
                  <div className="col-span-2 flex items-center gap-2">
                    <UserGroupIcon className="h-4 w-4" />
                    Students
                  </div>
                  <div className="col-span-2 flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    Submitted
                  </div>
                  <div className="col-span-2">Status & Actions</div>
                </div>
              </div>

              {/* Enhanced Table Body */}
              <div className="divide-y divide-slate-100">
                {filteredRecords.map(record => {
                  const statusConfig = getStatusConfig(record.status);
                  const StatusIcon = statusConfig.icon;
                  return (
                  <div
                    key={record.id}
                    className={`group px-6 py-5 transition-all duration-200 border-l-4 ${statusConfig.border} ${statusConfig.hover} hover:shadow-sm`}
                  >
                    <div className="grid grid-cols-12 gap-4 items-center">
                      {/* Class Information */}
                      <div className="col-span-4">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-slate-100 rounded-lg group-hover:bg-white transition-colors">
                            <DocumentTextIcon className="h-5 w-5 text-slate-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="text-sm font-semibold text-slate-900 truncate">
                              Grade {record.grade} - Section {record.section}
                            </h3>
                            <p className="text-sm text-slate-600 truncate">{record.className}</p>
                          </div>
                        </div>
                      </div>

                      {/* Teacher */}
                      <div className="col-span-2">
                        <div className="text-sm font-medium text-slate-900">{record.teacherName}</div>
                      </div>

                      {/* Students */}
                      <div className="col-span-2">
                        <div className="flex items-center gap-2">
                          <UserGroupIcon className="h-4 w-4 text-slate-500" />
                          <span className="text-sm font-medium text-slate-900">{record.studentCount}</span>
                          <span className="text-xs text-slate-500">students</span>
                        </div>
                      </div>

                      {/* Submitted */}
                      <div className="col-span-2">
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="h-4 w-4 text-slate-500" />
                          <span className="text-sm text-slate-700">{record.submissionDate.toLocaleDateString()}</span>
                        </div>
                      </div>

                      {/* Status & Actions */}
                      <div className="col-span-2">
                        <div className="flex items-center gap-3">
                          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold ${statusConfig.badge}`}>
                            <StatusIcon className="h-3.5 w-3.5" />
                            {getStatusText(record.status)}
                          </div>
                          <button
                            onClick={() => handleClassClick(record)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="View details"
                          >
                            <EyeIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ISRManagement;