import React, { useState, useEffect } from 'react';
import PerformanceChart from '../../components/dashboard/teacher/PerformanceChart';
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
  const [benchmark, setBenchmark] = useState<{ avgScore: number; avgAccuracy: number; sessions: number }>({ avgScore: 0, avgAccuracy: 0, sessions: 0 });

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

  // Local "benchmark" based on the selected child's recent results to avoid cross-student reads
  useEffect(() => {
    if (!readingResults || readingResults.length === 0) {
      setBenchmark({ avgScore: 0, avgAccuracy: 0, sessions: 0 });
      return;
    }
    const lastN = [...readingResults]
      .filter(r => typeof r.oralReadingScore === 'number' || typeof r.comprehension === 'number')
      .sort((a, b) => {
        const ad = new Date((a as any).createdAt?.toDate?.() || (a as any).createdAt).getTime();
        const bd = new Date((b as any).createdAt?.toDate?.() || (b as any).createdAt).getTime();
        return bd - ad;
      })
      .slice(0, 10); // recent window

    const scores = lastN.map(r => r.oralReadingScore || 0).filter(n => typeof n === 'number');
    const comps = lastN.map(r => r.comprehension || 0).filter(n => typeof n === 'number');
    const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length) : 0;

    setBenchmark({
      avgScore: avg(scores),
      avgAccuracy: avg(comps),
      sessions: lastN.length
    });
  }, [readingResults]);

  // Calculate metrics from reading results
  const calculateMetrics = () => {
    if (readingResults.length === 0) {
      return {
        averageScore: 0,
        readingSpeed: 0,
        accuracy: 0,
        sessions: 0
      };
    }

    const validScores = readingResults.filter(r => typeof r.oralReadingScore === 'number');
    const averageScore = validScores.length > 0 
      ? Math.round(validScores.reduce((sum, r) => sum + (r.oralReadingScore || 0), 0) / validScores.length)
      : 0;

    const comprehensionScores = readingResults.filter(r => typeof r.comprehension === 'number');
    const accuracy = comprehensionScores.length > 0
      ? Math.round(comprehensionScores.reduce((sum, r) => sum + (r.comprehension || 0), 0) / comprehensionScores.length)
      : 0;

    return {
      averageScore,
      readingSpeed: 0, // WPM not available in current data structure
      accuracy,
      sessions: readingResults.length
    };
  };

  const metrics = calculateMetrics();
  const selectedChildData = children.find(c => c.id === selectedChild);

  // Derived insights from realtime results
  const insights = React.useMemo(() => {
    if (readingResults.length < 2) return { change: 0, trend: 'stable' as 'up'|'down'|'stable', streakDays: 0 };
    const sorted = [...readingResults].sort((a, b) => {
      const ad = new Date((a as any).createdAt?.toDate?.() || (a as any).createdAt).getTime();
      const bd = new Date((b as any).createdAt?.toDate?.() || (b as any).createdAt).getTime();
      return ad - bd;
    });
    const last4 = sorted.slice(-4);
    const prev4 = sorted.slice(-8, -4);
    const avg = (arr: typeof sorted) => {
      const vals = arr.map(r => r.oralReadingScore || 0);
      return vals.length ? Math.round(vals.reduce((a,b)=>a+b,0)/vals.length) : 0;
    };
    const recent = avg(last4);
    const prior = avg(prev4);
    const change = recent - prior;

    // Streak based on consecutive days
    const dates = sorted
      .map(r => new Date((r as any).createdAt?.toDate?.() || (r as any).createdAt))
      .filter(d => !isNaN(d.getTime()))
      .sort((a,b)=> b.getTime()-a.getTime());
    let streak = 0;
    if (dates.length) {
      let anchor = new Date(dates[0]); anchor.setHours(0,0,0,0); streak = 1;
      for (let i=1;i<dates.length;i++) {
        const d = new Date(dates[i]); d.setHours(0,0,0,0);
        const diff = Math.round((anchor.getTime()-d.getTime())/(1000*60*60*24));
        if (diff === 1) { streak += 1; anchor = d; } else if (diff === 0) { continue; } else { break; }
      }
    }
    return { change, trend: change > 0 ? 'up' : change < 0 ? 'down' : 'stable', streakDays: streak };
  }, [readingResults]);

  const levelHistory = React.useMemo(() => {
    const seen = new Set<string>();
    return [...readingResults]
      .sort((a,b)=>{
        const ad = new Date((a as any).createdAt?.toDate?.() || (a as any).createdAt).getTime();
        const bd = new Date((b as any).createdAt?.toDate?.() || (b as any).createdAt).getTime();
        return ad-bd;
      })
      .map(r=>({ when: (r as any).createdAt, level: r.readingLevel || '' }))
      .filter(x=>{
        if (!x.level) return false; 
        const key = x.level; if (seen.has(key)) return false; seen.add(key); return true;
      });
  }, [readingResults]);

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
          <div className="flex gap-2">
            <select 
              value={selectedChild} 
              onChange={(e) => setSelectedChild(e.target.value)}
              className="border border-blue-200 rounded-xl px-3 py-2 bg-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {children.map(child => (
                <option key={child.id} value={child.id}>{child.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl p-4 bg-white border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <ChartBarIcon className="w-4 h-4 text-blue-600" />
            <div className="text-xs text-gray-500">Average Score</div>
          </div>
          <div className="text-2xl font-extrabold text-blue-700">{metrics.averageScore}%</div>
          <div className="text-xs text-gray-500 mt-1">Recent avg: {benchmark.avgScore}%</div>
        </div>
        <div className="rounded-2xl p-4 bg-white border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <BookOpenIcon className="w-4 h-4 text-green-600" />
            <div className="text-xs text-gray-500">Accuracy</div>
          </div>
          <div className="text-2xl font-extrabold text-green-700">{metrics.accuracy}%</div>
          <div className="text-xs text-gray-500 mt-1">Recent avg: {benchmark.avgAccuracy}%</div>
        </div>
        <div className="rounded-2xl p-4 bg-white border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <ClockIcon className="w-4 h-4 text-purple-600" />
            <div className="text-xs text-gray-500">Sessions</div>
          </div>
          <div className="text-2xl font-extrabold text-purple-700">{metrics.sessions}</div>
          <div className="text-xs text-gray-500 mt-1">Recent count: {benchmark.sessions}</div>
        </div>
        <div className="rounded-2xl p-4 bg-white border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <UserGroupIcon className="w-4 h-4 text-yellow-600" />
            <div className="text-xs text-gray-500">Reading Level</div>
          </div>
          <div className="text-2xl font-extrabold text-yellow-700">{selectedChildData?.readingLevel || '—'}</div>
        </div>
      </div>

      {/* Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-2xl p-4 bg-white border border-gray-100 shadow-sm">
          <div className="text-sm font-semibold text-gray-800 mb-1">Trend</div>
          <div className={`text-sm ${insights.trend==='up'?'text-green-700':insights.trend==='down'?'text-red-700':'text-gray-700'}`}>
            {insights.trend==='up' && `Accuracy improved by ${Math.abs(insights.change)}% over recent sessions.`}
            {insights.trend==='down' && `Accuracy decreased by ${Math.abs(insights.change)}% over recent sessions.`}
            {insights.trend==='stable' && 'Accuracy is stable across recent sessions.'}
          </div>
        </div>
        <div className="rounded-2xl p-4 bg-white border border-gray-100 shadow-sm">
          <div className="text-sm font-semibold text-gray-800 mb-1">Reading Streak</div>
          <div className="text-sm text-gray-700">{insights.streakDays > 0 ? `${insights.streakDays} day${insights.streakDays>1?'s':''} in a row` : 'No current streak'}</div>
        </div>
        <div className="rounded-2xl p-4 bg-white border border-gray-100 shadow-sm">
          <div className="text-sm font-semibold text-gray-800 mb-2">Level History</div>
          <div className="flex flex-wrap gap-2">
            {levelHistory.length === 0 ? (
              <span className="text-xs text-gray-500">No level changes yet</span>
            ) : (
              levelHistory.map((h, i) => (
                <span key={i} className="px-2 py-0.5 rounded-full border text-xs text-gray-700 bg-gray-50">
                  {h.level}
                </span>
              ))
            )}
          </div>
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
              <PerformanceChart 
                key={child.id}
              data={chartDataForChild(child.id)}
                grades={[]} 
              students={[child as unknown as Student]}
              title={`${child.name}'s Learning Progress`}
                targetLine={85} 
              showStaticStudentInfo={true}
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
                    <td className="py-2 pr-4 text-blue-700 font-semibold">{typeof r.oralReadingScore==='number' ? `${r.oralReadingScore}%` : '—'}</td>
                    <td className="py-2 pr-4 text-green-700 font-semibold">{typeof r.comprehension==='number' ? `${r.comprehension}%` : '—'}</td>
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