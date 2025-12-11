import React, { useState, useEffect } from 'react';
import ParentProgressChart from '../../components/dashboard/parent/ParentProgressChart';
import type { Student } from '../../services/studentService';
import ParentLoader from '../../components/parent/ParentLoader';
import { formatDateHuman } from '@/utils/date';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../config/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { UserGroupIcon, BookOpenIcon, ChartBarIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import DepEdISRViewer from '../../components/admin/DepEdISRViewer';

interface ParentChild {
  id: string;
  name: string;
  grade: string;
  readingLevel: string;
  performance: string;
  lastAssessment: string;
  status: string;
  teacherId: string;
}

interface ReadingResult {
  id: string;
  studentId: string;
  gradeId: string;
  gradeName: string;
  teacherId: string;
  type?: 'reading-session' | 'test';
  oralReadingScore?: number;
  comprehension?: number;
  readingLevel?: string;
  book?: string;
  sessionTitle?: string;
  elapsedTime?: number;
  readingTime?: number;
  duration?: number;
  createdAt: any;
}

interface SharedISRReport {
  id: string;
  parentId: string;
  studentId: string;
  studentName: string;
  teacherId: string;
  teacherName: string;
  school: string;
  language: string;
  levelStarted: string;
  readingData: any[];
  observations: any;
  sharedAt: any;
  isRead: boolean;
}

const ProgressPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [children, setChildren] = useState<ParentChild[]>([]);
  const [loading, setLoading] = useState(true);
  const [readingResults, setReadingResults] = useState<ReadingResult[]>([]);
  const [selectedChild, setSelectedChild] = useState<string>('');
  const [sharedISRReports, setSharedISRReports] = useState<SharedISRReport[]>([]);
  const [selectedISRReport, setSelectedISRReport] = useState<SharedISRReport | null>(null);
  const [isISRModalOpen, setIsISRModalOpen] = useState(false);


  // Fetch parent's children (realtime, from students by parentId)
  useEffect(() => {
    if (!currentUser?.uid) return;
    setLoading(true);
    const studentsRef = collection(db, 'students');
    const qStudents = query(studentsRef, where('parentId', '==', currentUser.uid));
    const unsub = onSnapshot(qStudents, (snapshot) => {
      const childrenData: ParentChild[] = snapshot.docs.map(doc => {
        const d: any = doc.data();
        return {
          id: doc.id,
          name: d.name || 'Unknown',
          grade: d.grade || 'Unknown',
          readingLevel: d.readingLevel || '',
          performance: d.performance || '',
          lastAssessment: d.lastAssessment || '',
          status: d.status || 'active',
          teacherId: d.teacherId || ''
        };
      });
      setChildren(childrenData);
      setLoading(false);
    }, () => {
      setChildren([]);
      setLoading(false);
    });
    return () => unsub();
  }, [currentUser?.uid]);

  // Fetch reading results for selected child
  useEffect(() => {
    const unsubscribers: (() => void)[] = [];
    
    // Clear results when dependencies change to prevent stale data
    setReadingResults([]);

    const attachListenerForChild = (childId: string) => {
      const resultsRef = collection(db, 'readingResults');
      const resultsQuery = query(resultsRef, where('studentId', '==', childId));

      const unsubscribe = onSnapshot(resultsQuery, (snapshot) => {
        const results: ReadingResult[] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as ReadingResult[];

        // Use functional update to avoid race conditions
        setReadingResults((prev) => {
          // Remove old results for this child
          const others = prev.filter(r => r.studentId !== childId);
          // Add new results
          return [...others, ...results];
        });
      }, () => {
        // Remove results for this child on error
        setReadingResults((prev) => prev.filter(r => r.studentId !== childId));
      });

      unsubscribers.push(unsubscribe);
    };

    if (selectedChild) {
      // Only attach listener for selected child
      attachListenerForChild(selectedChild);
    } else if (children.length > 0) {
      // Attach listeners for all children
      children.forEach((child) => attachListenerForChild(child.id));
    }

    // Cleanup all listeners when dependencies change
    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [selectedChild, children]);

  // Fetch shared ISR reports for parent
  useEffect(() => {
    if (!currentUser?.uid) return;

    const isrRef = collection(db, 'sharedISRReports');
    const isrQuery = query(isrRef, where('parentId', '==', currentUser.uid));

    const unsubscribe = onSnapshot(isrQuery, (snapshot) => {
      const reports: SharedISRReport[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SharedISRReport[];

      // Sort by sharedAt date (newest first)
      const sortedReports = reports.sort((a, b) => {
        const aDate = a.sharedAt?.toDate?.() || new Date(0);
        const bDate = b.sharedAt?.toDate?.() || new Date(0);
        return bDate.getTime() - aDate.getTime();
      });

      setSharedISRReports(sortedReports);
    }, () => {
      setSharedISRReports([]);
    });

    return () => unsubscribe();
  }, [currentUser?.uid]);

  const handleMarkISRAsRead = async (reportId: string) => {
    try {
      await updateDoc(doc(db, 'sharedISRReports', reportId), {
        isRead: true
      });
    } catch {
      // Silently fail - not critical if marking as read fails
    }
  };

  const handleViewISR = (report: SharedISRReport) => {
    setSelectedISRReport(report);
    setIsISRModalOpen(true);
    // Mark as read when viewing
    if (!report.isRead) {
      handleMarkISRAsRead(report.id);
    }
  };

  const handleCloseISRModal = () => {
    setIsISRModalOpen(false);
    setSelectedISRReport(null);
  };

  // Transform shared ISR report to DepEdISRViewer format
  const transformISRData = (report: SharedISRReport) => {
    // Get student's grade from children list
    const studentChild = children.find(c => c.id === report.studentId);
    
    return {
      studentName: report.studentName,
      age: '', // Age not stored in shared report, could be added later
      gradeSection: studentChild?.grade || '',
      school: report.school || '',
      teacher: report.teacherName || '',
      language: (report.language || 'English') as 'English' | 'Filipino',
      levelStarted: report.levelStarted || '',
      readingData: (report.readingData || []).map((entry: any) => ({
        level: entry.level || '',
        levelStarted: entry.level === report.levelStarted,
        set: entry.set || '',
        wordReading: {
          ind: entry.wordReading?.ind || false,
          ins: entry.wordReading?.ins || false,
          frus: entry.wordReading?.frus || false
        },
        comprehension: {
          ind: entry.comprehension?.ind || false,
          ins: entry.comprehension?.ins || false,
          frus: entry.comprehension?.frus || false
        },
        dateTaken: entry.dateTaken || ''
      })),
      observations: report.observations || {
        wordByWord: false,
        lacksExpression: false,
        hardlyAudible: false,
        disregardsPunctuation: false,
        pointsToWords: false,
        littleAnalysis: false,
        otherObservations: ''
      }
    };
  };






  // Per-child chart data from DB results
  const chartDataForChild = React.useCallback((childId: string) => {
    const rows = readingResults.filter(r => r.studentId === childId);
    if (rows.length === 0) return { assessmentPeriods: [], oralReadingScores: [], comprehensionScores: [], readingLevels: [] };
    const sorted = rows.sort((a, b) => {
      const ad = new Date((a as any).createdAt?.toDate?.() || (a as any).createdAt).getTime();
      const bd = new Date((b as any).createdAt?.toDate?.() || (b as any).createdAt).getTime();
      return ad - bd;
    });
    const labels = sorted.map(r => r.gradeName || r.gradeId || '');
    const oral = sorted.map(r => Math.max(0, Math.min(100, r.oralReadingScore || 0)));
    const comp = sorted.map(r => Math.max(0, Math.min(100, r.comprehension || 0)));
    const levels = sorted.map(r => (r.readingLevel || ''));
    return { assessmentPeriods: labels, oralReadingScores: oral, comprehensionScores: comp, readingLevels: levels };
  }, [readingResults]);

  if (loading) {
    return <ParentLoader label="Loading your child's progress..." fullScreen />;
  }

  if (children.length === 0) {
    return (
      <div className="p-6 space-y-6">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border border-gray-100">
          <div className="px-6 py-6 sm:px-8 sm:py-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-extrabold text-blue-900">Progress</h2>
              <p className="text-sm text-blue-700 mt-1">Track your child's reading progress and achievements.</p>
            </div>
          </div>
        </div>

        {/* No Children Connected */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
              <UserGroupIcon className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Children Connected</h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              You don't have any children linked to your account yet. Contact your child's teacher to get them connected to your parent account.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => window.location.href = '/parent/children'}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <UserGroupIcon className="w-4 h-4" />
                Manage Children
              </button>
              <button
                onClick={() => window.location.href = '/parent/dashboard'}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <BookOpenIcon className="w-4 h-4" />
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const visibleChildren = selectedChild ? children.filter(c => c.id === selectedChild) : children;
  const visibleISRReports = selectedChild
    ? sharedISRReports.filter(r => r.studentId === selectedChild)
    : sharedISRReports;

  return (
    <div className="p-6 space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border border-gray-100">
        <div className="px-6 py-6 sm:px-8 sm:py-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold text-blue-900">Progress</h2>
            <p className="text-sm text-blue-700 mt-1">Track your child's reading progress and achievements.</p>
          </div>
          {/* Child filter */}
          <div className="flex items-center gap-3 bg-white/60 backdrop-blur-sm border border-indigo-100 rounded-xl px-3 py-2 shadow-sm">
            <label className="text-sm font-medium text-gray-700">Show progress for</label>
            <select
              value={selectedChild}
              onChange={(e) => setSelectedChild(e.target.value)}
              className="text-sm border border-indigo-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 min-w-[180px]"
            >
              <option value="">All children</option>
              {children.map(child => (
                <option key={child.id} value={child.id}>
                  {child.name} — {child.grade}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Performance Charts for All Children */}
      <div className="grid grid-cols-1 gap-4">
        {children.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-gray-50 text-gray-400 flex items-center justify-center mb-4">
                <ChartBarIcon className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Children Linked Yet</h3>
              <p className="text-gray-600 mb-4">
                You haven't linked any children to your account yet.
                Once you link your children, you'll see their progress here.
              </p>
              <button
                onClick={() => window.location.href = '/parent/my-children'}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <BookOpenIcon className="w-4 h-4" />
                Link Your Children
              </button>
            </div>
          </div>
        ) : (
          visibleChildren.map(child => (
            <ParentProgressChart
              key={child.id}
              data={chartDataForChild(child.id)}
              students={[child as unknown as Student]}
              title={`${child.name}'s Learning Progress`}
            />
          ))
        )}
      </div>

      {/* Shared ISR Reports */}
      {visibleISRReports.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <DocumentTextIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Individual Summary Records (ISR)</h3>
                  <p className="text-sm text-indigo-100">Comprehensive reading assessment reports</p>
                </div>
              </div>
              {visibleISRReports.filter(r => !r.isRead).length > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full">
                  <span className="w-2 h-2 bg-yellow-300 rounded-full animate-pulse"></span>
                  <span className="text-sm font-semibold text-white">
                    {visibleISRReports.filter(r => !r.isRead).length} new
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Reports List */}
          <div className="p-6">
            <div className="space-y-4">
              {visibleISRReports.map((report) => {
                const sharedDate = report.sharedAt?.toDate?.() || new Date();
                const isNew = !report.isRead;
                
                return (
                  <div
                    key={report.id}
                    className={`group relative border-2 rounded-xl p-5 transition-all duration-200 ${
                      isNew
                        ? 'bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-300 shadow-md hover:shadow-lg'
                        : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-md'
                    }`}
                  >
                    {/* New Badge */}
                    {isNew && (
                      <div className="absolute top-4 right-4">
                        <span className="px-3 py-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-bold rounded-full shadow-md">
                          NEW
                        </span>
                      </div>
                    )}

                    <div className="flex items-start gap-4">
                      {/* Icon */}
                      <div className={`flex-shrink-0 p-3 rounded-lg ${
                        isNew 
                          ? 'bg-gradient-to-br from-indigo-500 to-purple-500' 
                          : 'bg-gray-100'
                      }`}>
                        <DocumentTextIcon className={`w-6 h-6 ${
                          isNew ? 'text-white' : 'text-gray-600'
                        }`} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h4 className="text-lg font-bold text-gray-900 mb-2">
                              ISR Report for {report.studentName}
                            </h4>
                            
                            {/* Info Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                              <div className="flex items-center gap-2 text-sm">
                                <span className="font-semibold text-gray-700 min-w-[80px]">School:</span>
                                <span className="text-gray-600">{report.school || 'N/A'}</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <span className="font-semibold text-gray-700 min-w-[80px]">Teacher:</span>
                                <span className="text-gray-600">{report.teacherName || 'N/A'}</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <span className="font-semibold text-gray-700 min-w-[80px]">Language:</span>
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  report.language === 'English' 
                                    ? 'bg-blue-100 text-blue-700' 
                                    : 'bg-green-100 text-green-700'
                                }`}>
                                  {report.language || 'English'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <span className="font-semibold text-gray-700 min-w-[80px]">Level Started:</span>
                                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-semibold">
                                  {report.levelStarted || 'N/A'}
                                </span>
                              </div>
                            </div>

                            {/* Date */}
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span>Shared {formatDateHuman(sharedDate)}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Action Button */}
                      <div className="flex-shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewISR(report);
                          }}
                          className={`px-6 py-3 rounded-lg font-semibold text-sm transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 ${
                            isNew
                              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700'
                              : 'bg-gray-700 text-white hover:bg-gray-800'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            View ISR
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ISR Viewer Modal */}
      {isISRModalOpen && selectedISRReport && (
        <DepEdISRViewer
          data={transformISRData(selectedISRReport)}
          onClose={handleCloseISRModal}
        />
      )}

      {/* Recent Sessions */}
      {readingResults.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Reading Sessions</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600 border-b">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Score</th>
                  <th className="py-2 pr-4">Comprehension</th>
                  <th className="py-2 pr-4">Level</th>
                </tr>
              </thead>
              <tbody>
                {readingResults.slice(-10).reverse().map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-2 pr-4 text-gray-700">{r.createdAt?.toDate?.() ? formatDateHuman(r.createdAt.toDate()) : '—'}</td>
                    <td className="py-2 pr-4 text-blue-700 font-semibold">{typeof r.oralReadingScore === 'number' ? `${r.oralReadingScore}%` : '—'}</td>
                    <td className="py-2 pr-4 text-green-700 font-semibold">{typeof r.comprehension === 'number' ? `${r.comprehension}%` : '—'}</td>
                    <td className="py-2 pr-4 text-gray-700">{r.readingLevel || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProgressPage; 