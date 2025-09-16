import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { studentService, type Student } from '../../services/studentService';
import { resultService } from '../../services/resultsService';

const Reports: React.FC<{ setIsHeaderDarkened?: (v: boolean) => void }> = ({ setIsHeaderDarkened }) => {
  const { currentUser } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedReport, setSelectedReport] = useState('overview');
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [studentMetrics, setStudentMetrics] = useState<Record<string, any>>({});
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [progressOpen, setProgressOpen] = useState(false);
  const [progressData, setProgressData] = useState<any>(null);
  const [progressLoading, setProgressLoading] = useState(false);
  const [studentCombinedResults, setStudentCombinedResults] = useState<Record<string, any[]>>({});
  const [studentReadingResults, setStudentReadingResults] = useState<Record<string, any[]>>({});
  const [studentTestResults, setStudentTestResults] = useState<Record<string, any[]>>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'reading' | 'test' | null>(null);
  const [modalStudent, setModalStudent] = useState<Student | null>(null);
  const [modalSearchTerm, setModalSearchTerm] = useState('');

  useEffect(() => {
    const fetchStudents = async () => {
      if (!currentUser?.uid) return;
      try {
        const fetchedStudents = await studentService.getStudents(currentUser.uid);
        setStudents(fetchedStudents);
      } catch (error) {
        setStudents([]);
      }
    };
    fetchStudents();
  }, [currentUser?.uid]);

  useEffect(() => {
    const fetchMetrics = async () => {
      const metrics: Record<string, any> = {};
      for (const student of students) {
        if (student.id) {
          try {
            metrics[student.id] = await resultService.getStudentCombinedMetrics(student.id);
          } catch (e) {
            metrics[student.id] = {};
          }
        }
      }
      setStudentMetrics(metrics);
    };
    if (students.length > 0) fetchMetrics();
  }, [students]);

  useEffect(() => {
    const fetchCombinedResults = async () => {
      const combined: Record<string, any[]> = {};
      for (const student of students) {
        if (student.id) {
          try {
            combined[student.id] = await resultService.getCombinedResults(student.id);
          } catch (e) {
            combined[student.id] = [];
          }
        }
      }
      setStudentCombinedResults(combined);
    };
    if (students.length > 0) fetchCombinedResults();
  }, [students]);

  useEffect(() => {
    const fetchResults = async () => {
      const reading: Record<string, any[]> = {};
      const test: Record<string, any[]> = {};
      for (const student of students) {
        if (student.id) {
          try {
            reading[student.id] = await resultService.getReadingResults(student.id);
          } catch (e) {
            reading[student.id] = [];
          }
          try {
            test[student.id] = await resultService.getTestResults(student.id);
          } catch (e) {
            test[student.id] = [];
          }
        }
      }
      setStudentReadingResults(reading);
      setStudentTestResults(test);
    };
    if (students.length > 0) fetchResults();
  }, [students]);

  const classStats = {
    totalStudents: students.length,
    averageReadingLevel: 2.3,
    totalReadingSessions: 156,
    completedAssessments: 89,
    improvementRate: 15.2
  };

  const studentPerformance = [
    {
      id: 1,
      name: 'Emma Wilson',
      readingLevel: 2,
      progress: 85,
      assessments: 8,
      avgScore: 88,
      trend: 'up'
    },
    {
      id: 2,
      name: 'Jack Davis',
      readingLevel: 1,
      progress: 65,
      assessments: 6,
      avgScore: 72,
      trend: 'up'
    },
    {
      id: 3,
      name: 'Sarah Miller',
      readingLevel: 2,
      progress: 78,
      assessments: 9,
      avgScore: 85,
      trend: 'stable'
    },
    {
      id: 4,
      name: 'Tim Wilson',
      readingLevel: 1,
      progress: 45,
      assessments: 5,
      avgScore: 68,
      trend: 'down'
    }
  ];

  const monthlyData = [
    { month: 'Sep', readingLevel: 1.8 },
    { month: 'Oct', readingLevel: 1.9 },
    { month: 'Nov', readingLevel: 2.1 },
    { month: 'Dec', readingLevel: 2.2 },
    { month: 'Jan', readingLevel: 2.3 }
  ];

  const handleExportReport = (reportType: string) => {
    // showInfo('Export Report', `${reportType} report export will be available in the next update.`);
  };

  const handleGenerateReport = (reportType: string) => {
    // showInfo('Generate Report', `${reportType} report generation will be available in the next update.`);
  };

  const handleViewProgress = async (student: Student) => {
    if (!student.id) return; // Ensure id is defined
    setSelectedStudent(student);
    setProgressOpen(true);
    setProgressLoading(true);
    setIsHeaderDarkened?.(true);
    try {
      const data = await resultService.getStudentCombinedMetrics(student.id);
      setProgressData(data);
    } catch (e) {
      setProgressData(null);
    }
    setProgressLoading(false);
  };

  const handleOpenModal = (student: Student, type: 'reading' | 'test') => {
    setModalStudent(student);
    setModalType(type);
    setModalOpen(true);
    setIsHeaderDarkened?.(true);
  };
  const handleCloseModal = () => {
    setModalOpen(false);
    setModalType(null);
    setModalStudent(null);
    setIsHeaderDarkened?.(false);
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <i className="fas fa-arrow-up text-green-500"></i>;
      case 'down':
        return <i className="fas fa-arrow-down text-red-500"></i>;
      case 'stable':
        return <i className="fas fa-minus text-gray-500"></i>;
      default:
        return null;
    }
  };

  // Ensure header is not darkened on unmount
  useEffect(() => {
    return () => {
      setIsHeaderDarkened?.(false);
    };
  }, [setIsHeaderDarkened]);

  // When progress modal closes
  useEffect(() => {
    if (!progressOpen) setIsHeaderDarkened?.(false);
  }, [progressOpen, setIsHeaderDarkened]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-gray-600 mt-1">Comprehensive insights into your class performance</p>
        </div>
        <div className="mt-4 sm:mt-0 flex space-x-3">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
          </select>
          <button
            onClick={() => handleExportReport('comprehensive')}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <i className="fas fa-download mr-2"></i>
            Export
          </button>
        </div>
      </div>

      {/* Report Type Selector */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedReport('overview')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedReport === 'overview'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <i className="fas fa-chart-pie mr-2"></i>
            Overview
          </button>
          <button
            onClick={() => setSelectedReport('performance')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedReport === 'performance'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <i className="fas fa-user-graduate mr-2"></i>
            Student Performance
          </button>
          <button
            onClick={() => setSelectedReport('assessments')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedReport === 'assessments'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <i className="fas fa-clipboard-check mr-2"></i>
            Assessments
          </button>
        </div>
      </div>

      {/* Overview Report */}
      {selectedReport === 'overview' && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <i className="fas fa-users text-blue-600 text-xl"></i>
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-600">Total Students</p>
                  <p className="text-2xl font-bold text-gray-900">{classStats.totalStudents}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <i className="fas fa-book text-purple-600 text-xl"></i>
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-600">Avg Reading Level</p>
                  <p className="text-2xl font-bold text-gray-900">{classStats.averageReadingLevel}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <i className="fas fa-clock text-yellow-600 text-xl"></i>
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-600">Reading Sessions</p>
                  <p className="text-2xl font-bold text-gray-900">{classStats.totalReadingSessions}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <i className="fas fa-clipboard-check text-indigo-600 text-xl"></i>
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-600">Completed Assessments</p>
                  <p className="text-2xl font-bold text-gray-900">{classStats.completedAssessments}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-pink-100 rounded-lg flex items-center justify-center">
                  <i className="fas fa-trending-up text-pink-600 text-xl"></i>
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-600">Improvement Rate</p>
                  <p className="text-2xl font-bold text-gray-900">+{classStats.improvementRate}%</p>
                </div>
              </div>
            </div>
          </div>

          {/* Monthly Progress Chart */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Progress</h3>
            <div className="space-y-4">
              {monthlyData.map((data, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 w-12">{data.month}</span>
                  <div className="flex-1 mx-4">
                    <div className="flex items-center space-x-4">
                      <div className="flex-1">
                        <div className="flex justify-between text-xs text-gray-600 mb-1">
                          <span>Reading Level</span>
                          <span>{data.readingLevel}</span>
                        </div>
                        {/* Remove progress bar for readingLevel as a number */}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Student Performance Report */}
      {selectedReport === 'performance' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">Student Performance Report</h2>
            <button
              onClick={() => handleGenerateReport('performance')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <i className="fas fa-file-alt mr-2"></i>
              Generate Report
            </button>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Student
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Reading Session Results
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Test Results
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {students.map((student, rowIdx) => (
                    student.id ? (
                    <tr key={student.id} className={rowIdx % 2 === 0 ? "bg-white hover:bg-gray-50" : "bg-gray-50 hover:bg-gray-100"}>
                      <td className="px-6 py-4 whitespace-nowrap flex items-center gap-3">
                        <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-200 text-blue-700 font-bold text-lg shadow">
                          {student.name.replace(/\|/g, ' ').trim().charAt(0).toUpperCase()}
                        </span>
                        <div>
                          <div className="font-semibold text-gray-900">{student.name.replace(/\|/g, ' ')}</div>
                          <div className="text-xs text-gray-500">{student.grade || ''}{student.readingLevel ? ` • Level ${student.readingLevel}` : ''}</div>
                        </div>
                      </td>
                      {/* Reading Session Results Column */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {studentReadingResults[student.id as string] && studentReadingResults[student.id as string].length > 0 ? (
                          <button
                            className="bg-blue-100 hover:bg-blue-200 text-blue-700 font-semibold px-4 py-2 rounded shadow text-sm"
                            onClick={() => handleOpenModal(student, 'reading')}
                          >
                            View ({studentReadingResults[student.id as string].length})
                          </button>
                        ) : (
                          <span className="text-gray-400 text-sm flex items-center gap-1"><i className="fas fa-info-circle"></i> No reading session results</span>
                        )}
                      </td>
                      {/* Test Results Column */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {studentTestResults[student.id as string] && studentTestResults[student.id as string].length > 0 ? (
                          <button
                            className="bg-yellow-100 hover:bg-yellow-200 text-yellow-700 font-semibold px-4 py-2 rounded shadow text-sm"
                            onClick={() => handleOpenModal(student, 'test')}
                          >
                            View ({studentTestResults[student.id as string].length})
                          </button>
                        ) : (
                          <span className="text-gray-400 text-sm flex items-center gap-1"><i className="fas fa-info-circle"></i> No test results</span>
                        )}
                      </td>
                    </tr>
                    ) : null
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Assessments Report */}
      {selectedReport === 'assessments' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">Assessment Report</h2>
            <button
              onClick={() => handleGenerateReport('assessments')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <i className="fas fa-file-alt mr-2"></i>
              Generate Report
            </button>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="text-center py-8">
              <i className="fas fa-clipboard-check text-4xl text-gray-400 mb-4"></i>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Assessment Analytics</h3>
              <p className="text-gray-600 mb-4">Comprehensive assessment results and analysis will be available in the next update.</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <div className="bg-indigo-50 rounded-lg p-4">
                  <p className="text-2xl font-bold text-indigo-600">{classStats.completedAssessments}</p>
                  <p className="text-sm text-gray-600">Completed Assessments</p>
                </div>
                <div className="bg-yellow-50 rounded-lg p-4">
                  <p className="text-2xl font-bold text-yellow-600">85%</p>
                  <p className="text-sm text-gray-600">Average Score</p>
                </div>
                <div className="bg-pink-50 rounded-lg p-4">
                  <p className="text-2xl font-bold text-pink-600">+{classStats.improvementRate}%</p>
                  <p className="text-sm text-gray-600">Improvement Rate</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {progressOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md relative">
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-red-500"
              onClick={() => setProgressOpen(false)}
              title="Close"
            >
              ×
            </button>
            <h2 className="text-xl font-bold mb-4">
              {selectedStudent?.name}'s Progress
            </h2>
            {progressLoading ? (
              <div>Loading...</div>
            ) : progressData ? (
              <div className="space-y-2">
                <div><strong>Miscues:</strong> {progressData.miscues ?? '-'}</div>
                <div><strong>Accuracy (Oral Reading Score):</strong> {progressData.oralReadingScore ?? '-'}</div>
                <div><strong>Total Words:</strong> {progressData.totalWords ?? '-'}</div>
                <div><strong>Reading Speed:</strong> {progressData.readingSpeed ?? '-'}</div>
                <div><strong>Comprehension:</strong> {progressData.comprehension ?? '-'}</div>
              </div>
            ) : (
              <div>No progress data found.</div>
            )}
          </div>
        </div>
      )}

      {/* Modal for viewing all results */}
      {modalOpen && modalStudent && modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
          <div className="bg-white rounded-2xl shadow-2xl p-10 w-full max-w-3xl relative max-h-[90vh] overflow-y-auto border border-gray-200">
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-red-500 text-2xl font-bold"
              onClick={handleCloseModal}
              title="Close"
            >
              ×
            </button>
            <h2 className="text-2xl font-extrabold mb-6 text-gray-900 tracking-tight flex items-center gap-2">
              {modalType === 'reading' ? (
                <i className="fas fa-book-reader text-blue-500 text-2xl"></i>
              ) : (
                <i className="fas fa-clipboard-check text-yellow-600 text-2xl"></i>
              )}
              {modalType === 'reading' ? 'Reading Session Results' : 'Test Results'} for <span className="text-blue-700">{modalStudent.name}</span>
            </h2>
            {/* Search Bar */}
            <div className="mb-4">
              <input
                type="text"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Search results..."
                value={modalSearchTerm}
                onChange={e => setModalSearchTerm(e.target.value)}
              />
            </div>
            {/* Scrollable Results List */}
            <div className="flex flex-col gap-6 max-h-[55vh] overflow-y-auto pr-2">
              {((modalType === 'reading' ? studentReadingResults[modalStudent.id as string] : studentTestResults[modalStudent.id as string]) || [])
                .filter((result: any) => {
                  const term = modalSearchTerm.toLowerCase();
                  if (!term) return true;
                  if (modalType === 'reading') {
                    return (
                      (result.sessionTitle && result.sessionTitle.toLowerCase().includes(term)) ||
                      (result.book && result.book.toLowerCase().includes(term)) ||
                      (result.wordsRead && String(result.wordsRead).includes(term)) ||
                      (result.miscues && String(result.miscues).includes(term)) ||
                      (result.oralReadingScore && String(result.oralReadingScore).includes(term)) ||
                      (result.readingSpeed && String(result.readingSpeed).includes(term))
                    );
                  } else {
                    return (
                      (result.testName && result.testName.toLowerCase().includes(term)) ||
                      (result.score && String(result.score).includes(term)) ||
                      (result.comprehension && String(result.comprehension).includes(term)) ||
                      (result.totalQuestions && String(result.totalQuestions).includes(term)) ||
                      (result.correctAnswers && String(result.correctAnswers).includes(term))
                    );
                  }
                })
                .map((result: any, idx: number) => (
                  <div key={result._id || result.id || idx} className={
                   (modalType === 'reading'
                     ? "bg-blue-50 border-l-8 border-blue-400"
                     : "bg-yellow-50 border-l-8 border-yellow-400"
                   ) + " p-6 rounded-xl shadow-md flex flex-col gap-2"
                 }>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-base font-semibold text-gray-700">
                        {new Date(result.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                      {modalType === 'reading' ? (
                        <i className="fas fa-book-reader text-blue-500 text-lg"></i>
                      ) : (
                        <i className="fas fa-clipboard-check text-yellow-600 text-lg"></i>
                      )}
                    </div>
                    <div className="text-base text-gray-800">
                      {modalType === 'reading' ? (
                        <>
                          {result.sessionTitle ? (<div className="mb-1"><span className="font-semibold">Session Title:</span> {result.sessionTitle}</div>) : null}
                          {result.book ? (<div className="mb-1"><span className="font-semibold">Story:</span> {result.book}</div>) : null}
                          <div className="mb-1"><span className="font-semibold">Words:</span> <span className="text-lg font-bold">{result.wordsRead ?? '-'}</span></div>
                          <div className="mb-1"><span className="font-semibold">Miscues:</span> <span className="text-lg font-bold">{result.miscues ?? '-'}</span></div>
                          <div className="mb-1"><span className="font-semibold">Score:</span> <span className="text-lg font-bold">{result.oralReadingScore ?? '-'}{(result.oralReadingScore !== undefined && result.oralReadingScore !== null && result.oralReadingScore !== '-') ? '%' : ''}</span></div>
                          <div className="mb-1"><span className="font-semibold">Speed:</span> <span className="text-lg font-bold">{result.readingSpeed ?? '-'} wpm</span></div>
                          {/* Level based on oralReadingScore for reading results only */}
                          {modalType === 'reading' && (typeof result.oralReadingScore === 'number' || (typeof result.oralReadingScore === 'string' && result.oralReadingScore !== undefined)) ? (
                            <div className="mb-1">
                              <span className="font-semibold">Level:</span> <span className="text-lg font-bold">
                                {(() => {
                                  const score = typeof result.oralReadingScore === 'string' ? parseFloat(result.oralReadingScore) : result.oralReadingScore;
                                  if (isNaN(score)) return '-';
                                  if (score >= 95) return 'Independent';
                                  if (score >= 90) return 'Instructional';
                                  return 'Frustrational';
                                })()}
                              </span>
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <>
                          {result.testName ? (<div className="mb-1"><span className="font-semibold">Test:</span> {result.testName}</div>) : null}
                          <div className="mb-1"><span className="font-semibold">Score:</span> <span className="text-lg font-bold">{result.score ?? '-'}</span></div>
                          <div className="mb-1"><span className="font-semibold">Comprehension:</span> <span className="text-lg font-bold">{result.comprehension ?? '-'}{(result.comprehension !== undefined && result.comprehension !== null && result.comprehension !== '-') ? '%' : ''}</span></div>
                          <div className="mb-1"><span className="font-semibold">Questions:</span> <span className="text-lg font-bold">{result.totalQuestions ?? '-'}</span></div>
                          <div className="mb-1"><span className="font-semibold">Correct:</span> <span className="text-lg font-bold">{result.correctAnswers ?? '-'}</span></div>
                          {/* Level based on comprehension for test results only */}
                          {modalType === 'test' && (typeof result.comprehension === 'number' || (typeof result.comprehension === 'string' && result.comprehension !== undefined)) ? (
                            <div className="mb-1">
                              <span className="font-semibold">Level:</span> <span className="text-lg font-bold">
                                {(() => {
                                  const score = typeof result.comprehension === 'string' ? parseFloat(result.comprehension) : result.comprehension;
                                  if (isNaN(score)) return '-';
                                  if (score >= 80) return 'Independent';
                                  if (score >= 59) return 'Instructional';
                                  return 'Frustrational';
                                })()}
                              </span>
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports; 