import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { getAllParents, getTeachersCount, getParentsCount } from '../../services/authService';
import { studentService } from '../../services/studentService';
import { gradeService } from '../../services/gradeService';
import { UnifiedStoryService } from '../../services/UnifiedStoryService';
// import { resultsService } from '../../services/resultsService';
import * as XLSX from 'xlsx';

const tabs = [
  { label: 'Students', value: 'students' },
  { label: 'Teachers', value: 'teachers' },
  { label: 'Parents', value: 'parents' },
  { label: 'Stories', value: 'stories' },
  { label: 'Performance', value: 'performance' },
];

interface ReportData {
  students: any[];
  teachers: any[];
  parents: any[];
  stories: any[];
  performance: any[];
  loading: boolean;
  error: string | null;
}

const Reports: React.FC = () => {
  const [activeTab, setActiveTab] = useState('students');
  const [reportData, setReportData] = useState<ReportData>({
    students: [],
    teachers: [],
    parents: [],
    stories: [],
    performance: [],
    loading: true,
    error: null
  });
  const [dateRange, setDateRange] = useState('all');
  const [isExporting, setIsExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<string>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    fetchReportData();
  }, [activeTab, dateRange]);

  const fetchReportData = async () => {
    setReportData(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const data: Partial<ReportData> = {};

      switch (activeTab) {
        case 'students':
          data.students = await fetchStudentsData();
          break;
        case 'teachers':
          data.teachers = await fetchTeachersData();
          break;
        case 'parents':
          data.parents = await fetchParentsData();
          break;
        case 'stories':
          data.stories = await fetchStoriesData();
          break;
        case 'performance':
          data.performance = await fetchPerformanceData();
          break;
      }

      setReportData(prev => ({ ...prev, ...data, loading: false }));
    } catch (error) {
      console.error('Error fetching report data:', error);
      setReportData(prev => ({ 
        ...prev, 
        loading: false, 
        error: 'Failed to load report data' 
      }));
    }
  };

  const fetchStudentsData = async () => {
    const students = await studentService.getAllStudents();
    const grades = await gradeService.getAllClassGrades();
    
    return students.map(student => ({
      name: student.name,
      grade: student.grade,
      readingLevel: student.readingLevel,
      performance: student.performance,
      status: student.status,
      lastAssessment: student.lastAssessment,
      parentName: student.parentName || 'Not linked',
      createdAt: student.createdAt?.toDate?.() || student.createdAt,
      teacherId: student.teacherId
    }));
  };

  const fetchTeachersData = async () => {
    const q = query(collection(db, 'users'), where('role', '==', 'teacher'));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      displayName: doc.data().displayName,
      email: doc.data().email,
      createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
      lastLogin: doc.data().lastLogin?.toDate?.() || doc.data().lastLogin,
      status: doc.data().status || 'active'
    }));
  };

  const fetchParentsData = async () => {
    const parents = await getAllParents();
    
    return parents.map(parent => ({
      id: parent.id,
      displayName: parent.displayName,
      email: parent.email,
      childrenCount: parent.children?.length || 0,
      children: parent.children?.map(child => child.name).join(', ') || 'None',
      createdAt: parent.createdAt?.toDate?.() || parent.createdAt,
      lastLogin: parent.lastLogin?.toDate?.() || parent.lastLogin
    }));
  };

  const fetchStoriesData = async () => {
    const stories = await UnifiedStoryService.getInstance().getStories();
    
    return stories.map(story => ({
      title: story.title,
      description: story.description,
      language: story.language,
      gradeLevel: story.gradeLevel,
      isActive: story.isActive,
      createdAt: story.createdAt,
      updatedAt: story.updatedAt,
      wordCount: story.wordCount || 'N/A'
    }));
  };

  const fetchPerformanceData = async () => {
    try {
      // Fetch from readingResults collection in Firebase
      const readingResultsQuery = query(collection(db, 'readingResults'));
      const readingResultsSnapshot = await getDocs(readingResultsQuery);
      
      const results = readingResultsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          type: 'reading-session',
          studentName: data.studentName || 'N/A',
          teacherId: data.teacherId || 'N/A',
          score: data.oralReadingScore || data.comprehension || 'N/A',
          comprehension: data.comprehension || 'N/A',
          readingSpeed: data.readingSpeed || 'N/A',
          testName: data.sessionTitle || data.book || 'N/A',
          date: data.sessionDate || data.createdAt,
          grade: data.gradeId || data.grade || 'N/A'
        };
      });
      
      return results;
    } catch (error) {
      console.error('Error fetching performance data:', error);
      return [];
    }
  };

  const exportToCSV = async () => {
    setIsExporting(true);
    try {
      const data = sanitizeData(reportData[activeTab as keyof ReportData] as any[]);
      if (!data || data.length === 0) {
        alert('No data to export');
        return;
      }

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `${activeTab} Report`);
      
      const fileName = `${activeTab}_report_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export data');
    } finally {
      setIsExporting(false);
    }
  };

  const exportToPDF = () => {
    // For now, we'll use a simple print functionality
    // In a real implementation, you'd use a library like jsPDF
    window.print();
  };

  const formatDateHuman = (date: Date) => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfToday.getDate() - 1);
    const fmt = new Intl.DateTimeFormat(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit'
    });
    if (date >= startOfToday) {
      const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
      return `Today, ${timeFmt.format(date)}`;
    }
    if (date >= startOfYesterday) {
      const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
      return `Yesterday, ${timeFmt.format(date)}`;
    }
    return fmt.format(date);
  };

  const isDateKey = (key: string) => {
    const k = key.toLowerCase();
    return k === 'date' || k.endsWith('date') || k.endsWith('at') || ['createdat','updatedat','lastlogin','lastassessment'].includes(k);
  };

  const formatCellForKey = (key: string, value: any) => {
    if (!value && value !== 0) return 'N/A';
    // Firestore Timestamp like objects
    if (isDateKey(key) && typeof value === 'object' && value?.toDate) {
      try { return formatDateHuman(value.toDate()); } catch { return 'N/A'; }
    }
    if (isDateKey(key) && value instanceof Date) return formatDateHuman(value);
    // ISO string or millis number
    if (isDateKey(key) && (typeof value === 'string' || typeof value === 'number')) {
      const d = new Date(value);
      if (!Number.isNaN(d.getTime())) return formatDateHuman(d);
      return String(value);
    }
    return String(value);
  };

  const isSensitiveKey = (key: string) => {
    const k = key.toLowerCase();
    return (
      k === 'id' ||
      k.endsWith('id') ||
      k.endsWith('_id') ||
      ['uid','userid','teacherid','parentid','studentid','sessionid','storyid','gradeid','docid'].includes(k)
    );
  };

  const sanitizeData = (rows: any[]) => {
    return (rows || []).map(row => {
      const clean: Record<string, any> = {};
      Object.keys(row || {}).forEach(key => {
        if (!isSensitiveKey(key)) clean[key] = row[key];
      });
      return clean;
    });
  };

  const getPreparedData = () => {
    const raw = sanitizeData((reportData[activeTab as keyof ReportData] as any[]) || []);
    // search/filter
    const q = searchQuery.trim().toLowerCase();
    let filtered = !q ? raw : raw.filter(row =>
      Object.values(row).some(v => formatCell(v).toLowerCase().includes(q))
    );
    // sort
    if (sortKey) {
      const dir = sortDir === 'asc' ? 1 : -1;
      filtered = [...filtered].sort((a, b) => {
        const av = formatCell(a[sortKey]);
        const bv = formatCell(b[sortKey]);
        if (av === bv) return 0;
        return av > bv ? dir : -dir;
      });
    }
    return filtered;
  };

  const renderTable = () => {
    const data = getPreparedData();
    
    if (!data || data.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          No data available for {activeTab} report
        </div>
      );
    }

    const columns = Object.keys(data[0] || {}).filter(c => !isSensitiveKey(c));
    
    return (
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full bg-white">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              {columns.map(column => {
                const prettify = (c: string) => {
                  if (c === 'displayName') return 'Name';
                  if (c === 'createdAt') return 'Created';
                  if (c === 'updatedAt') return 'Updated';
                  if (c === 'lastLogin') return 'Last login';
                  if (c === 'lastAssessment') return 'Last assessment';
                  return c.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
                };
                const label = prettify(column);
                const active = sortKey === column;
                return (
                  <th
                    key={column}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer select-none"
                    onClick={() => {
                      if (sortKey === column) setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
                      setSortKey(column);
                    }}
                  >
                    <span className="inline-flex items-center gap-1">
                      {label}
                      {active && (
                        <span className="text-gray-400">{sortDir === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </span>
                  </th>
                );
              })}
      </tr>
    </thead>
          <tbody className="divide-y divide-gray-100">
            {data.slice((page - 1) * pageSize, page * pageSize).map((row, index) => (
              <tr key={index} className="hover:bg-blue-50/40">
                {columns.map(column => (
                  <td key={column} className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {formatCellForKey(column, row[column])}
                  </td>
                ))}
      </tr>
            ))}
    </tbody>
  </table>
        <div className="flex items-center justify-between p-3 text-sm text-gray-600">
          <div>
            Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, data.length)} of {data.length}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={pageSize}
              onChange={e => { setPageSize(parseInt(e.target.value)); setPage(1); }}
              className="px-2 py-1 border border-gray-300 rounded"
            >
              {[10, 25, 50, 100].map(s => (
                <option key={s} value={s}>{s}/page</option>
              ))}
            </select>
            <button
              className="px-3 py-1 rounded border border-gray-300 disabled:opacity-50"
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >Prev</button>
            <button
              className="px-3 py-1 rounded border border-gray-300 disabled:opacity-50"
              disabled={page * pageSize >= data.length}
              onClick={() => setPage(p => p + 1)}
            >Next</button>
          </div>
        </div>
      </div>
    );
  };

  const renderChart = () => {
    const data = reportData[activeTab as keyof ReportData] as any[];
    
    if (!data || data.length === 0) {
      return (
        <div className="bg-gray-100 rounded h-48 flex items-center justify-center text-gray-400 mb-4">
          No data available for chart
        </div>
      );
    }

    // Simple chart representation based on data type
    switch (activeTab) {
      case 'students':
        const gradeDistribution = data.reduce((acc, student) => {
          acc[student.grade] = (acc[student.grade] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        return (
          <div className="bg-white rounded-lg p-6 mb-4">
            <h3 className="text-lg font-semibold mb-4">Students by Grade</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(gradeDistribution).map(([grade, count]) => (
                <div key={grade} className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{count}</div>
                  <div className="text-sm text-gray-600">{grade}</div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'performance':
        const avgScore = data.reduce((sum, result) => {
          const score = typeof result.score === 'number' ? result.score : 0;
          return sum + score;
        }, 0) / data.length;
        
        return (
          <div className="bg-white rounded-lg p-6 mb-4">
            <h3 className="text-lg font-semibold mb-4">Performance Overview</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{Math.round(avgScore)}%</div>
                <div className="text-sm text-gray-600">Average Score</div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{data.length}</div>
                <div className="text-sm text-gray-600">Total Assessments</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {data.filter(r => (r.score || 0) >= 80).length}
                </div>
                <div className="text-sm text-gray-600">Passing Rate</div>
              </div>
            </div>
  </div>
);

      default:
        return (
          <div className="bg-white rounded-lg p-6 mb-4">
            <h3 className="text-lg font-semibold mb-4">{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Summary</h3>
            <div className="text-center p-8">
              <div className="text-3xl font-bold text-blue-600 mb-2">{data.length}</div>
              <div className="text-gray-600">Total {activeTab}</div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">Admin Reports</h1>
      
      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-4 items-center">
        <div className="flex space-x-4 border-b">
        {tabs.map(tab => (
          <button
            key={tab.value}
            className={`px-4 py-2 font-medium border-b-2 transition-colors duration-200 ${
              activeTab === tab.value
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-blue-600'
            }`}
            onClick={() => setActiveTab(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden md:flex items-center gap-2 bg-white rounded-full border border-gray-200 p-1">
            {[
              { v: 'today', l: 'Today' },
              { v: '7d', l: '7 Days' },
              { v: '30d', l: '30 Days' },
              { v: 'all', l: 'All Time' }
            ].map(opt => (
              <button
                key={opt.v}
                onClick={() => setDateRange(opt.v)}
                className={`px-3 py-1.5 rounded-full text-sm ${dateRange === opt.v ? 'bg-blue-600 text-white shadow' : 'text-gray-600 hover:bg-gray-100'}`}
              >{opt.l}</button>
            ))}
          </div>
          <input
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
            placeholder="Search..."
            className="px-3 py-2 border border-gray-300 rounded-md text-sm w-48"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-700">
            {tabs.find(t => t.value === activeTab)?.label} Report
          </h2>
          <div className="space-x-2">
            <button 
              onClick={exportToCSV}
              disabled={isExporting || reportData.loading}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-50"
            >
              {isExporting ? 'Exporting...' : 'Export CSV'}
            </button>
            <button 
              onClick={exportToPDF}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
            >
              Export PDF
            </button>
          </div>
        </div>

        {reportData.loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            Loading report data...
          </div>
        ) : reportData.error ? (
          <div className="text-red-500 text-center py-8">{reportData.error}</div>
        ) : (
          <>
            {renderChart()}
            {renderTable()}
          </>
        )}
      </div>
    </div>
  );
};

export default Reports; 