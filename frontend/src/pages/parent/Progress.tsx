import React, { useState, useEffect } from 'react';
import ParentProgressChart from '../../components/dashboard/parent/ParentProgressChart';
import type { Student } from '../../services/studentService';
import Loader from '../../components/Loader';
import { formatDateHuman } from '@/utils/date';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../config/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { UserGroupIcon, BookOpenIcon, ChartBarIcon, ClockIcon } from '@heroicons/react/24/outline';

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
  oralReadingScore?: number;
  comprehension?: number;
  readingLevel?: string;
  createdAt: any;
}

const ProgressPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [children, setChildren] = useState<ParentChild[]>([]);
  const [loading, setLoading] = useState(true);
  const [readingResults, setReadingResults] = useState<ReadingResult[]>([]);
  const [selectedChild, setSelectedChild] = useState<string>('');


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
      if (!selectedChild && childrenData.length > 0) setSelectedChild(childrenData[0].id);
      setLoading(false);
    }, () => {
      setChildren([]);
      setLoading(false);
    });
    return () => unsub();
  }, [currentUser?.uid]);

  // Fetch reading results for selected child
  useEffect(() => {
    if (!selectedChild) return;

    const resultsRef = collection(db, 'readingResults');
    const resultsQuery = query(resultsRef, where('studentId', '==', selectedChild));

    const unsubscribe = onSnapshot(resultsQuery, (snapshot) => {
      const results: ReadingResult[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ReadingResult[];

      setReadingResults(results);
    }, (error) => {
      console.error('Error fetching reading results:', error);
      setReadingResults([]);
    });

    return () => unsubscribe();
  }, [selectedChild]);



  // Calculate real metrics from database reading results
  const calculateMetrics = () => {
    if (readingResults.length === 0) {
      return {
        booksRead: 0,
        totalReadingTime: 0,
        averageAccuracy: 0,
        currentLevel: 'Beginner',
        sessionsThisMonth: 0,
        minutesThisWeek: 0
      };
    }

    // Get current date for time-based calculations
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Start of current week

    // Filter results for time periods
    const thisMonthResults = readingResults.filter(r => {
      const resultDate = new Date((r as any).createdAt?.toDate?.() || (r as any).createdAt);
      return resultDate >= startOfMonth;
    });

    const thisWeekResults = readingResults.filter(r => {
      const resultDate = new Date((r as any).createdAt?.toDate?.() || (r as any).createdAt);
      return resultDate >= startOfWeek;
    });

    // Calculate books read (total sessions)
    const booksRead = readingResults.length;

    // Calculate total reading time from database (if available) or estimate
    const totalReadingTime = readingResults.reduce((total, r) => {
      // Try to get actual reading time from database
      const sessionTime = (r as any).elapsedTime || (r as any).readingTime || (r as any).duration;
      if (sessionTime) {
        // Convert to minutes if it's in seconds
        return total + (sessionTime > 1000 ? Math.round(sessionTime / 60) : sessionTime);
      }
      // Fallback: estimate 15 minutes per session
      return total + 15;
    }, 0);

    // Calculate average accuracy from comprehension scores
    const comprehensionScores = readingResults.filter(r => typeof r.comprehension === 'number');
    const averageAccuracy = comprehensionScores.length > 0
      ? Math.round(comprehensionScores.reduce((sum, r) => sum + (r.comprehension || 0), 0) / comprehensionScores.length)
      : 0;

    // Get current reading level from selected child data
    const currentLevel = selectedChildData?.readingLevel || 'Beginner';

    // Sessions this month
    const sessionsThisMonth = thisMonthResults.length;

    // Minutes this week
    const minutesThisWeek = thisWeekResults.reduce((total, r) => {
      const sessionTime = (r as any).elapsedTime || (r as any).readingTime || (r as any).duration;
      if (sessionTime) {
        return total + (sessionTime > 1000 ? Math.round(sessionTime / 60) : sessionTime);
      }
      return total + 15; // Estimate 15 minutes per session
    }, 0);

    return {
      booksRead,
      totalReadingTime,
      averageAccuracy,
      currentLevel,
      sessionsThisMonth,
      minutesThisWeek
    };
  };

  const metrics = calculateMetrics();
  const selectedChildData = children.find(c => c.id === selectedChild);





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
    return (
      <div className="p-6 space-y-6">
        <Loader label="Loading your child's progress..." />
      </div>
    );
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

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl p-4 bg-white border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <BookOpenIcon className="w-4 h-4 text-blue-600" />
            <div className="text-xs text-gray-500">Books Read</div>
          </div>
          <div className="text-2xl font-extrabold text-blue-700">{metrics.sessionsThisMonth}</div>
          <div className="text-xs text-gray-500 mt-1">This month</div>
        </div>
        <div className="rounded-2xl p-4 bg-white border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <ClockIcon className="w-4 h-4 text-green-600" />
            <div className="text-xs text-gray-500">Reading Time</div>
          </div>
          <div className="text-2xl font-extrabold text-green-700">{metrics.minutesThisWeek}</div>
          <div className="text-xs text-gray-500 mt-1">Minutes this week</div>
        </div>
        <div className="rounded-2xl p-4 bg-white border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <ChartBarIcon className="w-4 h-4 text-purple-600" />
            <div className="text-xs text-gray-500">Progress</div>
          </div>
          <div className="text-2xl font-extrabold text-purple-700">{metrics.averageAccuracy}%</div>
          <div className="text-xs text-gray-500 mt-1">Average accuracy</div>
        </div>
      </div>



      {/* Performance Charts for All Children */}
      <div className="grid grid-cols-1 gap-6">
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
          children.map(child => (
            <ParentProgressChart
              key={child.id}
              data={chartDataForChild(child.id)}
              students={[child as unknown as Student]}
              title={`${child.name}'s Learning Progress`}
            />
          ))
        )}
      </div>

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