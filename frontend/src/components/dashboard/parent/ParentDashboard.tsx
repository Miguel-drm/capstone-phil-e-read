import React, { useEffect, useState, memo, useMemo } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { studentService, type Student } from '../../../services/studentService';

import ParentProgressChart from './ParentProgressChart';
import { useNavigate } from 'react-router-dom';
import {
  BookOpenIcon,
  UsersIcon,
  ChartBarIcon,
  ArrowRightIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import { formatDateHuman } from '@/utils/date';
import { db } from '../../../config/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';

// Children Overview Widget
const ChildrenOverviewWidget: React.FC<{
  children: Student[];
  isLoading: boolean;
  avgPerformancePct: number;
}> = ({ children, isLoading, avgPerformancePct }) => {
  const stats = useMemo(() => {
    if (children.length === 0) return null;

    const activeChildren = children.filter(c => c.status === 'active');
    // Average reading level from DB values only
    const numericLevels = children
      .map(child => parseInt(child.readingLevel || ''))
      .filter(v => !isNaN(v));
    const avgReadingLevel = numericLevels.length
      ? numericLevels.reduce((a, b) => a + b, 0) / numericLevels.length
      : NaN;

    return {
      total: children.length,
      active: activeChildren.length,
      avgLevel: Math.round(avgReadingLevel) || 'N/A',
      avgPerf: Math.round(avgPerformancePct)
    };

  }, [children, avgPerformancePct]);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
            <UsersIcon className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Children Overview</h3>
            <p className="text-sm text-gray-500">Active</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500"></div>
          <span className="text-xs px-2 py-0.5 rounded-full border bg-gray-50 text-gray-700">{stats?.total || 0}</span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="group relative overflow-hidden bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-4 transition-all hover:shadow-sm">
          <div className="absolute -right-4 -top-4 w-16 h-16 rounded-full bg-blue-200/40 blur-xl group-hover:scale-110 transition-transform" />
          <div className="relative">
            <div className="text-sm font-medium text-blue-900 mb-1">Total Children</div>
            {isLoading ? (
              <div className="h-8 bg-blue-200 rounded animate-pulse"></div>
            ) : (
              <div className="text-2xl font-bold text-blue-900">
                {stats?.total || 0}
              </div>
            )}
            <div className="text-xs text-blue-700">Registered</div>
          </div>
        </div>

        <div className="group relative overflow-hidden bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-xl p-4 transition-all hover:shadow-sm">
          <div className="absolute -right-4 -top-4 w-16 h-16 rounded-full bg-green-200/40 blur-xl group-hover:scale-110 transition-transform" />
          <div className="relative">
            <div className="text-sm font-medium text-green-900 mb-1">Active Students</div>
            {isLoading ? (
              <div className="h-8 bg-green-200 rounded animate-pulse"></div>
            ) : (
              <div className="text-2xl font-bold text-green-900">
                {stats?.active || 0}
              </div>
            )}
            <div className="text-xs text-green-700">Currently enrolled</div>
          </div>
        </div>

        <div className="group relative overflow-hidden bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-xl p-4 transition-all hover:shadow-sm">
          <div className="absolute -right-4 -top-4 w-16 h-16 rounded-full bg-purple-200/40 blur-xl group-hover:scale-110 transition-transform" />
          <div className="relative">
            <div className="text-sm font-medium text-purple-900 mb-1">Avg. Reading Level</div>
            {isLoading ? (
              <div className="h-8 bg-purple-200 rounded animate-pulse"></div>
            ) : (
              <div className="text-2xl font-bold text-purple-900">
                {stats?.avgLevel || 'N/A'}
              </div>
            )}
            <div className="text-xs text-purple-700">Current level</div>
          </div>
        </div>

        <div className="group relative overflow-hidden bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 rounded-xl p-4 transition-all hover:shadow-sm">
          <div className="absolute -right-4 -top-4 w-16 h-16 rounded-full bg-orange-200/40 blur-xl group-hover:scale-110 transition-transform" />
          <div className="relative">
            <div className="text-sm font-medium text-orange-900 mb-1">Avg. Performance</div>
            {isLoading ? (
              <div className="h-8 bg-orange-200 rounded animate-pulse"></div>
            ) : (
              <div className="text-2xl font-bold text-orange-900">
                {stats?.avgPerf || 0}%
              </div>
            )}
            <div className="text-xs text-orange-700">Overall progress</div>
          </div>
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-gray-100">
        <div className="text-xs text-gray-500 flex items-center gap-1">
          <ClockIcon className="h-3 w-3" />
          Last updated: {formatDateHuman(new Date())}
        </div>
      </div>
    </div>
  );
};


// Build real chart data from backend results for a student
type ChartData = { assessmentPeriods: string[]; oralReadingScores: number[]; comprehensionScores: number[]; readingLevels: string[] };


// Assessment period labels are derived from the database (e.g., gradeName)

const normalizeLevelName = (raw?: string): string => {
  if (typeof raw === 'string') {
    const lower = raw.toLowerCase();
    if (lower.includes('independent')) return 'Independent';
    if (lower.includes('instruction')) return 'Instructional';
    if (lower.includes('frustrat')) return 'Frustration';
  }
  // No inference from accuracy; return empty when DB has no reading level
  return '';
};


// Child Card Component
const ChildCard = memo(({ child }: { child: Student }) => {
  const navigate = useNavigate();



  const getPerformanceText = (performance: string) => {
    switch (performance) {
      case 'Excellent': return 'Advanced';
      case 'Good': return 'On Track';
      case 'Needs Improvement': return 'Support Needed';
      default: return performance;
    }
  };





  return (
    <div
      className="group relative overflow-hidden bg-white border border-gray-200 rounded-2xl p-5 flex flex-col transition-all hover:shadow-sm cursor-pointer"
      onClick={() => navigate('/parent/children')}
      role="button"
      tabIndex={0}
      aria-label={`View details for ${child.name}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigate('/parent/children');
        }
      }}
    >
      <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-blue-100/60 blur-2xl group-hover:scale-110 transition-transform" />
      <div className="relative flex items-center mb-2">
        <div className="h-12 w-12 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center text-lg font-bold text-gray-700 mr-3">
          {child.name?.[0] || '?'}
        </div>
        <div>
          <div className="font-semibold text-gray-900 text-lg">{child.name}</div>
          <div className="text-xs text-gray-500">{child.grade}</div>
        </div>
      </div>

      <div className="relative flex flex-col gap-1 mt-2">
        <div className="text-sm flex items-center gap-2">
          <span className="font-medium text-gray-700">Reading Level:</span>
          <span className="px-2 py-0.5 rounded-full bg-gray-50 border border-gray-200 text-xs text-gray-700">
            {child.readingLevel || 'N/A'}
          </span>
        </div>
        <div className="text-sm flex items-center gap-2">
          <span className="font-medium text-gray-700">Performance:</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${child.performance === 'Excellent' ? 'bg-green-100 text-green-700' :
            child.performance === 'Good' ? 'bg-blue-100 text-blue-700' :
              'bg-yellow-100 text-yellow-800'
            }`}>
            {getPerformanceText(child.performance) || '—'}
          </span>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate('/parent/reading', { state: { childId: child.id, childName: child.name } });
            }}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg text-white bg-blue-600 hover:bg-blue-700"
          >
            <BookOpenIcon className="h-4 w-4" /> Practice
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate('/parent/progress', { state: { childId: child.id } });
            }}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg text-blue-700 bg-white border border-blue-200 hover:bg-blue-50"
          >
            <ChartBarIcon className="h-4 w-4" /> Progress
          </button>
        </div>
      </div>
    </div>
  );
});

const ParentDashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [children, setChildren] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartsByStudentId, setChartsByStudentId] = useState<Record<string, ChartData>>({});

  const [metrics, setMetrics] = useState<{ totalReadingMinutes: number; avgPerformance: number; avgWpm: number; streakDays: number; lastActivityAt?: Date }>({ totalReadingMinutes: 0, avgPerformance: 0, avgWpm: 0, streakDays: 0 });


  // Realtime subscription to children list for this parent
  useEffect(() => {
    if (!currentUser?.uid) return;
    setLoading(true);
    const q = query(collection(db, studentService.getCollectionName()), where('parentId', '==', currentUser.uid));
    const unsub = onSnapshot(q, (snap) => {
      const list: Student[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Student[];
      setChildren(list);
      setLoading(false);
    }, () => {
      setChildren([]);
      setLoading(false);
    });
    return () => unsub();
  }, [currentUser?.uid]);

  // Build realtime chart data per child from Firestore readingResults when children change
  useEffect(() => {
    let isActive = true;
    if (children.length === 0) {
      if (isActive) {
        setChartsByStudentId({});
        setMetrics({ totalReadingMinutes: 0, avgPerformance: 0, avgWpm: 0, streakDays: 0 });
      }
      return;
    }

    // Subscribe to readingResults for all children
    const childIds = children.map(c => c.id).filter(Boolean) as string[];
    if (childIds.length === 0) return;

    const q = query(collection(db, 'readingResults'), where('studentId', 'in', childIds));
    const unsub = onSnapshot(q, (snap) => {
      if (!isActive) return;

      const allResults: Array<{ r: any; childName: string }> = [];
      snap.forEach(doc => {
        const data = doc.data() as any;
        const child = children.find(c => c.id === data.studentId);
        if (child) {
          allResults.push({ r: data, childName: child.name });
        }
      });

      // Build chart data per child
      const map: Record<string, ChartData> = {};

      children.forEach(child => {
        const childResults = allResults.filter(x => x.r.studentId === child.id);

        // Derive assessment periods directly from DB fields
        const rawLabels = childResults
          .map(({ r }) => r.gradeName || r.gradeId || child.grade)
          .filter((v: any) => typeof v === 'string' && v.trim().length > 0) as string[];
        const labels: string[] = Array.from(new Set(rawLabels));

        // Build index map for fast lookups
        const labelToIndex: Record<string, number> = {};

        labels.forEach((l, i) => { labelToIndex[l] = i; });

        const length = labels.length;
        const oralSums = Array(length).fill(0);
        const oralCounts = Array(length).fill(0);
        const compSums = Array(length).fill(0);
        const compCounts = Array(length).fill(0);
        // Only show levels that exist in the database; no mock defaults
        const levels: string[] = Array(length).fill('');

        childResults.forEach(({ r }) => {
          const key: string | undefined = r.gradeName || r.gradeId || child.grade;
          if (!key || !(key in labelToIndex)) return;
          const idx = labelToIndex[key];

          // Get reading level directly from database (no derivation)
          const rl: string | undefined = r.readingLevel || r.readingLevelName || r.level;
          if (rl) {
            levels[idx] = normalizeLevelName(rl);
          }

          const accuracy: number | undefined = r.oralReadingScore ?? r.accuracy ?? r.score;
          if (typeof accuracy === 'number') {
            oralSums[idx] += Math.max(0, Math.min(100, accuracy));
            oralCounts[idx] += 1;
          }

          const comp: number | undefined = r.comprehension ?? (typeof r.correctAnswers === 'number' && typeof r.totalQuestions === 'number' && r.totalQuestions > 0 ? (r.correctAnswers / r.totalQuestions) * 100 : undefined);
          if (typeof comp === 'number') {
            compSums[idx] += Math.max(0, Math.min(100, comp));
            compCounts[idx] += 1;
          }
        });

        const avg = (s: number[], c: number[]) => s.map((v, i) => c[i] ? Number((v / c[i]).toFixed(2)) : 0);

        const oral = avg(oralSums, oralCounts);
        const comp = avg(compSums, compCounts);

        map[child.id as string] = {
          assessmentPeriods: labels,
          oralReadingScores: oral,
          comprehensionScores: comp,
          readingLevels: levels
        };

      });

      setChartsByStudentId(map);

      // Aggregate metrics
      const readingSessions = allResults.filter((x: { r: any }) => x.r.type === 'reading-session');
      const totalMinutes = readingSessions.reduce((sum: number, x: { r: any }) => sum + Math.max(0, Math.round(((x.r.elapsedTime as number) || 0) / 60)), 0);
      const avgPerfArr = readingSessions.map(x => x.r.oralReadingScore).filter((n: any) => typeof n === 'number') as number[];
      const avgPerf = avgPerfArr.length ? Number((avgPerfArr.reduce((a, b) => a + b, 0) / avgPerfArr.length).toFixed(0)) : 0;
      const wpmArr = readingSessions.map(x => x.r.readingSpeed).filter((n: any) => typeof n === 'number') as number[];
      const avgWpm = wpmArr.length ? Number((wpmArr.reduce((a, b) => a + b, 0) / wpmArr.length).toFixed(0)) : 0;
      const dates = readingSessions.map(x => new Date(x.r.createdAt || x.r.sessionDate || x.r.testDate || x.r.updatedAt)).filter(d => !isNaN(d.getTime())).sort((a, b) => b.getTime() - a.getTime());
      const lastAt = dates[0];

      // streak based on consecutive days including most recent
      let streak = 0;
      if (dates.length) {
        let anchor = new Date(dates[0]);
        anchor.setHours(0, 0, 0, 0);
        streak = 1;
        for (let i = 1; i < dates.length; i++) {
          const d = new Date(dates[i]); d.setHours(0, 0, 0, 0);
          const diffDays = Math.round((anchor.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays === 1) { streak += 1; anchor = d; } else if (diffDays === 0) { continue; } else { break; }
        }
      }
      setMetrics({ totalReadingMinutes: totalMinutes, avgPerformance: avgPerf, avgWpm, streakDays: streak, lastActivityAt: lastAt });




    }, (error) => {
      console.warn('Reading results subscription error:', error);
      if (isActive) {
        setChartsByStudentId({});
        setMetrics({ totalReadingMinutes: 0, avgPerformance: 0, avgWpm: 0, streakDays: 0 });
      }
    });

    return () => {
      isActive = false;
      unsub();
    };

  }, [children]);

  return (
    <div className="p-6 space-y-6">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border border-gray-100">
        <div className="px-6 py-6 sm:px-8 sm:py-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold text-blue-900 mb-2">
              Welcome back, {currentUser?.displayName?.split(' ')[0] || 'Parent'}!
            </h2>
            <p className="text-sm text-blue-700 mt-1">
              See how your children are growing as readers and start new learning adventures.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs inline-flex items-center px-2 py-1 rounded-full bg-white/60 border border-white text-blue-700">
              Updated {formatDateHuman(new Date())}
            </span>
            <button
              aria-label="Start Practice Session"
              onClick={() => navigate('/parent/reading')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-blue-700 bg-white/80 hover:bg-white hover:text-blue-800 transition-all duration-200 font-medium shadow-sm hover:shadow-md border border-white/50"
            >
              <BookOpenIcon className="h-4 w-4" />
              Start Reading
            </button>
            <button
              aria-label="View Progress Reports"
              onClick={() => navigate('/parent/reports')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-blue-700 bg-white/80 hover:bg-white hover:text-blue-800 transition-all duration-200 font-medium shadow-sm hover:shadow-md border border-white/50"
            >
              <ChartBarIcon className="h-4 w-4" />
              View Reports
            </button>
            <button
              aria-label="Manage Children Profiles"
              onClick={() => navigate('/parent/children')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-blue-700 bg-white/80 hover:bg-white hover:text-blue-800 transition-all duration-200 font-medium shadow-sm hover:shadow-md border border-white/50"
            >
              <UsersIcon className="h-4 w-4" />
              Manage Kids
            </button>
          </div>
        </div>
      </div>

      {/* No Children Banner */}
      {children.length === 0 && !loading && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <UsersIcon className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-blue-900">No children added yet</h3>
              <p className="text-sm text-blue-700">Add your child to start tracking their reading journey.</p>
            </div>
            <button
              onClick={() => navigate('/parent/children')}
              className="px-4 py-2 text-sm font-medium text-blue-700 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
            >
              Add Child
            </button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg border p-6">
            <div className="animate-pulse">
              <div className="h-6 bg-gray-200 rounded mb-4"></div>
              <div className="space-y-3">
                <div className="h-16 bg-gray-200 rounded"></div>
                <div className="h-16 bg-gray-200 rounded"></div>
                <div className="h-16 bg-gray-200 rounded"></div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border p-6">
            <div className="animate-pulse">
              <div className="h-6 bg-gray-200 rounded mb-4"></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="h-20 bg-gray-200 rounded"></div>
                <div className="h-20 bg-gray-200 rounded"></div>
                <div className="h-20 bg-gray-200 rounded"></div>
                <div className="h-20 bg-gray-200 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      {children.length > 0 && !loading && (
        <>
          {/* Children Overview */}
          <ChildrenOverviewWidget
            children={children}
            isLoading={loading}
            avgPerformancePct={metrics.avgPerformance}
          />

          {/* Children Cards */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <UsersIcon className="h-5 w-5 text-gray-600" />
                Your Children
              </h2>
              <button
                onClick={() => navigate('/parent/children')}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
              >
                Manage All
                <ArrowRightIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {children.map((child) => (
                <ChildCard key={child.id} child={child} />
              ))}
            </div>
          </div>

          {/* Progress Charts */}
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <ChartBarIcon className="h-5 w-5 text-gray-600" />
                Your Child's Learning Journey
              </h2>
            </div>
            <div className="space-y-6">
              {children.map((child) => (
                <ParentProgressChart
                  key={child.id}
                  data={chartsByStudentId[child.id as string] || { assessmentPeriods: [], oralReadingScores: [], comprehensionScores: [], readingLevels: [] }}
                  students={[child]}
                  title={`${child.name}'s Learning Progress`}
                />
              ))}
            </div>
          </div>




        </>
      )}
    </div>
  );
};

export default ParentDashboard;