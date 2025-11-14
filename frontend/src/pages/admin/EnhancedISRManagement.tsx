import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
    AcademicCapIcon
} from '@heroicons/react/24/outline';
import { isrService, type ISRSubmissionData, type ISRStudentData } from '../../services/isrService';
import DepEdISRViewer from '../../components/admin/DepEdISRViewer';
import * as XLSX from 'xlsx';
import AdminLoader from '../../components/admin/AdminLoader';

interface FilterOptions {
    status: 'all' | 'approved' | 'pending' | 'rejected';
    grade: string;
    language: string;
    readingLevel: string;
    dateRange: string;
    teacher: string;
}

const EnhancedISRManagement: React.FC = () => {
    const [allRecords, setAllRecords] = useState<ISRSubmissionData[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStudent, setSelectedStudent] = useState<ISRStudentData | null>(null);
    const [isViewerOpen, setIsViewerOpen] = useState(false);
    const [selectedClass, setSelectedClass] = useState<ISRSubmissionData | null>(null);
    const [showStudentDetails, setShowStudentDetails] = useState(false);

    const [filters, setFilters] = useState<FilterOptions>({
        status: 'all',
        grade: 'all',
        language: 'all',
        readingLevel: 'all',
        dateRange: 'all',
        teacher: 'all'
    });

    useEffect(() => {
        fetchISRRecords();
    }, []);

    const fetchISRRecords = useCallback(async () => {
        try {
            setLoading(true);
            const records = await isrService.getISRSubmissions('all');
            setAllRecords(records);
        } catch (error) {
            console.error('Error fetching ISR records:', error);
        } finally {
            setLoading(false);
        }
    }, []);

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

    const statistics = useMemo(() => {
        const pending = allRecords.filter(r => r.status === 'pending').length;
        const approved = allRecords.filter(r => r.status === 'approved').length;
        const rejected = allRecords.filter(r => r.status === 'rejected').length;
        const total = allRecords.length;
        const totalStudents = allRecords.reduce((sum, record) => sum + record.studentCount, 0);
        const uniqueTeachers = new Set(allRecords.map(r => r.teacherId)).size;

        return { pending, approved, rejected, total, totalStudents, uniqueTeachers };
    }, [allRecords]);

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
        setFilters(prev => ({ ...prev, [key]: value }));
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

    const getStatusConfig = useCallback((status: string) => {
        switch (status) {
            case 'approved':
                return {
                    badge: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
                    border: 'border-l-emerald-500',
                    hover: 'hover:bg-emerald-50',
                    icon: CheckCircleIcon
                };
            case 'pending':
                return {
                    badge: 'bg-amber-50 text-amber-700 border border-amber-200',
                    border: 'border-l-amber-500',
                    hover: 'hover:bg-amber-50',
                    icon: ClockIcon
                };
            case 'rejected':
                return {
                    badge: 'bg-rose-50 text-rose-700 border border-rose-200',
                    border: 'border-l-rose-500',
                    hover: 'hover:bg-rose-50',
                    icon: XCircleIcon
                };
            default:
                return {
                    badge: 'bg-slate-50 text-slate-700 border border-slate-200',
                    border: 'border-l-slate-500',
                    hover: 'hover:bg-slate-50',
                    icon: ClockIcon
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
        return <AdminLoader label="Loading Enhanced ISR Management..." fullScreen size="lg" />;
    }
    if (showStudentDetails && selectedClass) {
        const statusConfig = getStatusConfig(selectedClass.status);
        const StatusIcon = statusConfig.icon;

        return (
            <div className="min-h-screen bg-slate-50">
                <div className="p-6 max-w-7xl mx-auto">
                    <div className="mb-8">
                        <button
                            onClick={handleBackToList}
                            className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 mb-6 font-medium transition-colors"
                        >
                            <ArrowLeftIcon className="h-4 w-4" />
                            Back to ISR Records
                        </button>

                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
                            <div className="flex items-start justify-between mb-6">
                                <div className="flex items-start gap-6">
                                    <div className="p-4 bg-indigo-100 rounded-2xl">
                                        <DocumentTextIcon className="h-10 w-10 text-indigo-600" />
                                    </div>
                                    <div>
                                        <h1 className="text-3xl font-bold text-slate-900 mb-3">
                                            Grade {selectedClass.grade} - Section {selectedClass.section}
                                        </h1>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-slate-100 rounded-lg">
                                                    <UserGroupIcon className="h-4 w-4 text-slate-600" />
                                                </div>
                                                <div>
                                                    <p className="text-slate-500">Teacher</p>
                                                    <p className="font-semibold text-slate-900">{selectedClass.teacherName}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-slate-100 rounded-lg">
                                                    <AcademicCapIcon className="h-4 w-4 text-slate-600" />
                                                </div>
                                                <div>
                                                    <p className="text-slate-500">Students</p>
                                                    <p className="font-semibold text-slate-900">{selectedClass.studentCount} students</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-slate-100 rounded-lg">
                                                    <CalendarIcon className="h-4 w-4 text-slate-600" />
                                                </div>
                                                <div>
                                                    <p className="text-slate-500">Submitted</p>
                                                    <p className="font-semibold text-slate-900">{selectedClass.submissionDate.toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className={`flex items-center gap-3 px-6 py-3 rounded-xl ${statusConfig.badge}`}>
                                    <StatusIcon className="h-5 w-5" />
                                    <span className="font-semibold text-lg">{getStatusText(selectedClass.status)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {selectedClass.students.map((student, index) => {
                            const uniqueKey = `${student.studentId || 'student'}-${student.studentName || 'unknown'}-${index}`;

                            return (
                                <div
                                    key={uniqueKey}
                                    className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden group"
                                >
                                    <div className="p-6">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-3 bg-indigo-100 rounded-xl group-hover:bg-indigo-200 transition-colors">
                                                    <UserGroupIcon className="h-6 w-6 text-indigo-600" />
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                                                        {student.studentName}
                                                    </h3>
                                                    <p className="text-sm text-slate-600">
                                                        {student.age ? `Age: ${student.age}` : 'Age not specified'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-4 mb-6">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-slate-600">Language:</span>
                                                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${student.language === 'English' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                                                    }`}>
                                                    {student.language}
                                                </span>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => handleViewStudentISR(student)}
                                            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-3 px-4 rounded-xl transition-all duration-200 group-hover:shadow-md"
                                        >
                                            <EyeIcon className="h-4 w-4" />
                                            View Complete ISR
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

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
    return (
        <div className="min-h-screen bg-slate-50">
            <div className="p-6 max-w-7xl mx-auto">
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-indigo-100 rounded-xl">
                                <DocumentTextIcon className="h-8 w-8 text-indigo-600" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold text-slate-900">Enhanced ISR Management</h1>
                                <p className="text-slate-600">Advanced Individual Summary Records management</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={exportToExcel}
                                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
                            >
                                <ArrowDownTrayIcon className="h-4 w-4" />
                                Export
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
                        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-slate-100 rounded-lg">
                                    <DocumentTextIcon className="h-5 w-5 text-slate-600" />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-600">Total</p>
                                    <p className="text-xl font-bold text-slate-900">{statistics.total}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl p-4 border border-amber-200 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-amber-100 rounded-lg">
                                    <ClockIcon className="h-5 w-5 text-amber-600" />
                                </div>
                                <div>
                                    <p className="text-xs text-amber-700">Pending</p>
                                    <p className="text-xl font-bold text-amber-900">{statistics.pending}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl p-4 border border-emerald-200 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-emerald-100 rounded-lg">
                                    <CheckCircleIcon className="h-5 w-5 text-emerald-600" />
                                </div>
                                <div>
                                    <p className="text-xs text-emerald-700">Approved</p>
                                    <p className="text-xl font-bold text-emerald-900">{statistics.approved}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl p-4 border border-rose-200 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-rose-100 rounded-lg">
                                    <XCircleIcon className="h-5 w-5 text-rose-600" />
                                </div>
                                <div>
                                    <p className="text-xs text-rose-700">Rejected</p>
                                    <p className="text-xl font-bold text-rose-900">{statistics.rejected}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl p-4 border border-blue-200 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 rounded-lg">
                                    <UserGroupIcon className="h-5 w-5 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-xs text-blue-700">Students</p>
                                    <p className="text-xl font-bold text-blue-900">{statistics.totalStudents}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl p-4 border border-purple-200 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-purple-100 rounded-lg">
                                    <AcademicCapIcon className="h-5 w-5 text-purple-600" />
                                </div>
                                <div>
                                    <p className="text-xs text-purple-700">Teachers</p>
                                    <p className="text-xl font-bold text-purple-900">{statistics.uniqueTeachers}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-6">
                    <div className="p-6">
                        <div className="relative mb-4">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <MagnifyingGlassIcon className="h-5 w-5 text-slate-400" />
                            </div>
                            <input
                                type="text"
                                placeholder="Search by teacher, class, grade, or section..."
                                value={searchQuery}
                                onChange={handleSearchChange}
                                className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-lg leading-5 bg-white placeholder-slate-500 focus:outline-none focus:placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {[
                                { key: 'all', label: 'All Records', count: statistics.total, icon: DocumentTextIcon },
                                { key: 'pending', label: 'Pending', count: statistics.pending, icon: ClockIcon },
                                { key: 'approved', label: 'Approved', count: statistics.approved, icon: CheckCircleIcon },
                                { key: 'rejected', label: 'Rejected', count: statistics.rejected, icon: XCircleIcon }
                            ].map(tab => {
                                const Icon = tab.icon;
                                const isActive = filters.status === tab.key;
                                return (
                                    <button
                                        key={tab.key}
                                        onClick={() => handleFilterChange('status', tab.key)}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${isActive
                                                ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-200 shadow-sm'
                                                : 'bg-slate-50 text-slate-600 border-2 border-transparent hover:bg-slate-100 hover:text-slate-700'
                                            }`}
                                    >
                                        <Icon className="h-4 w-4" />
                                        {tab.label}
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${isActive ? 'bg-indigo-200 text-indigo-800' : 'bg-slate-200 text-slate-700'
                                            }`}>
                                            {tab.count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
                {filteredRecords.length === 0 ? (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                        <div className="text-center py-16">
                            <div className="mx-auto w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                <DocumentTextIcon className="h-12 w-12 text-slate-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-900 mb-2">No ISR Records Found</h3>
                            <p className="text-slate-500 max-w-md mx-auto mb-4">
                                {searchQuery || Object.values(filters).some(f => f !== 'all')
                                    ? 'No records match your current search and filter criteria.'
                                    : 'No ISR records have been submitted yet.'}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-600">
                                Showing {filteredRecords.length} of {statistics.total} records
                                {searchQuery && ` for "${searchQuery}"`}
                            </span>
                        </div>

                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
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
                                    <div className="col-span-1 flex items-center gap-2">
                                        <AcademicCapIcon className="h-4 w-4" />
                                        Students
                                    </div>
                                    <div className="col-span-2 flex items-center gap-2">
                                        <CalendarIcon className="h-4 w-4" />
                                        Submitted
                                    </div>
                                    <div className="col-span-3">Status & Actions</div>
                                </div>
                            </div>

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

                                                <div className="col-span-2">
                                                    <div className="text-sm font-medium text-slate-900">{record.teacherName}</div>
                                                </div>

                                                <div className="col-span-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-medium text-slate-900">{record.studentCount}</span>
                                                    </div>
                                                </div>

                                                <div className="col-span-2">
                                                    <div className="flex items-center gap-2">
                                                        <CalendarIcon className="h-4 w-4 text-slate-500" />
                                                        <span className="text-sm text-slate-700">{record.submissionDate.toLocaleDateString()}</span>
                                                    </div>
                                                </div>

                                                <div className="col-span-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold ${statusConfig.badge}`}>
                                                            <StatusIcon className="h-3.5 w-3.5" />
                                                            {getStatusText(record.status)}
                                                        </div>
                                                        <button
                                                            onClick={() => handleClassClick(record)}
                                                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
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

export default EnhancedISRManagement;