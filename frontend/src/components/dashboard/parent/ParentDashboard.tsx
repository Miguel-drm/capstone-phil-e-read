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
import ParentLoader from '../../parent/ParentLoader';

// Children Overview Widget
const ChildrenOverviewWidget: React.FC<{
  children: Student[];
  isLoading: boolean;
  avgPerformancePct: number;
  chartsByStudentId: Record<string, ChartData>;
}> = ({ children, isLoading, avgPerformancePct, chartsByStudentId }) => {
  const stats = useMemo(() => {
    if (children.length === 0) return null;

    const activeChildren = children.filter(c => c.status === 'active');
    
    // Debug: Log chart data to see what we have
    console.log('📊 Children Overview - Chart Data:', {
      childrenCount: children.length,
      chartDataKeys: Object.keys(chartsByStudentId),
      chartData: chartsByStudentId
    });
    
    // Calculate average reading level from actual assessment data (database-dependent)
    let avgReadingLevel: number | string = 'N/A';
    
    // Try to get levels from assessment data first
    const childrenWithData = children.filter(child => {
      const chartData = chartsByStudentId[child.id as string];
      if (!chartData || !chartData.readingLevels) return false;
      
      // Check if there's at least one non-empty reading level
      const hasValidLevel = chartData.readingLevels.some(level => 
        level && level.trim() !== '' && 
        (level === 'Independent' || level === 'Instructional' || level === 'Frustration')
      );
      return hasValidLevel;
    });

    if (childrenWithData.length > 0) {
      // Get the most recent reading level for each child from their chart data
      const levels = childrenWithData
        .map(child => {
          const chartData = chartsByStudentId[child.id as string];
          // Get the last non-empty reading level from the chart
          const validLevels = chartData.readingLevels.filter(level => 
            level && level.trim() !== ''
          );
          
          if (validLevels.length === 0) return null;
          
          const recentLevel = validLevels[validLevels.length - 1];
          
          // Convert reading level to numeric value for averaging
          // Independent = 3, Instructional = 2, Frustration = 1
          if (recentLevel === 'Independent') return 3;
          if (recentLevel === 'Instructional') return 2;
          if (recentLevel === 'Frustration') return 1;
          return null;
        })
        .filter((v): v is number => v !== null);

      if (levels.length > 0) {
        const avgNumeric = levels.reduce((a, b) => a + b, 0) / levels.length;
        // Convert back to reading level label
        if (avgNumeric >= 2.5) {
          avgReadingLevel = 'Independent';
        } else if (avgNumeric >= 1.5) {
          avgReadingLevel = 'Instructional';
        } else {
          avgReadingLevel = 'Frustration';
        }
      }
    }
    
    // Fallback: If no assessment data, try to calculate from child.readingLevel field
    if (avgReadingLevel === 'N/A' && children.length > 0) {
      const numericLevels = children
        .map(child => {
          const level = child.readingLevel;
          if (!level) return null;
          
          // Try to parse as number (e.g., "4", "5")
          const num = parseInt(level);
          if (!isNaN(num)) return num;
          
          // Try to parse as grade level (e.g., "Grade 4")
          const gradeMatch = level.match(/(\d+)/);
          if (gradeMatch) return parseInt(gradeMatch[1]);
          
          return null;
        })
        .filter((v): v is number => v !== null);
      
      if (numericLevels.length > 0) {
        const avg = numericLevels.reduce((a, b) => a + b, 0) / numericLevels.length;
        avgReadingLevel = Math.round(avg);
      }
    }

    return {
      total: children.length,
      active: activeChildren.length,
      avgLevel: avgReadingLevel,
      avgPerf: Math.round(avgPerformancePct)
    };

  }, [children, avgPerformancePct, chartsByStudentId]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-md transition-all duration-300 hover:shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
            <UsersIcon className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h3 className="text-2xl font-semibold text-gray-900">Children Overview</h3>
            <p className="text-lg text-gray-500">Active</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500"></div>
          <span className="text-xs px-2 py-0.5 rounded-full border bg-gray-50 text-gray-700">{stats?.total || 0}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="group relative overflow-hidden bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-3 sm:p-4 transition-all hover:shadow-md hover:scale-[1.02]">
          <div className="absolute -right-4 -top-4 w-16 h-16 rounded-full bg-blue-200/40 blur-xl group-hover:scale-110 transition-transform" />
          <div className="relative">
            <div className="text-lg font-medium text-blue-900 mb-1">Total Children</div>
            {isLoading ? (
              <div className="h-8 bg-blue-200 rounded animate-pulse"></div>
            ) : (
              <div className="text-3xl font-bold text-blue-900">
                {stats?.total || 0}
              </div>
            )}
            <div className="text-base text-blue-700">Registered</div>
          </div>
        </div>

        <div className="group relative overflow-hidden bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-xl p-3 sm:p-4 transition-all hover:shadow-md hover:scale-[1.02]">
          <div className="absolute -right-4 -top-4 w-16 h-16 rounded-full bg-green-200/40 blur-xl group-hover:scale-110 transition-transform" />
          <div className="relative">
            <div className="text-lg font-medium text-green-900 mb-1">Active Students</div>
            {isLoading ? (
              <div className="h-8 bg-green-200 rounded animate-pulse"></div>
            ) : (
              <div className="text-3xl font-bold text-green-900">
                {stats?.active || 0}
              </div>
            )}
            <div className="text-base text-green-700">Currently enrolled</div>
          </div>
        </div>

        <div className="group relative overflow-hidden bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-xl p-3 sm:p-4 transition-all hover:shadow-md hover:scale-[1.02]">
          <div className="absolute -right-4 -top-4 w-16 h-16 rounded-full bg-purple-200/40 blur-xl group-hover:scale-110 transition-transform" />
          <div className="relative">
            <div className="text-lg font-medium text-purple-900 mb-1">Avg. Reading Level</div>
            {isLoading ? (
              <div className="h-8 bg-purple-200 rounded animate-pulse"></div>
            ) : (
              <div className={`text-2xl font-bold ${
                stats?.avgLevel === 'Independent' ? 'text-green-700' :
                stats?.avgLevel === 'Instructional' ? 'text-yellow-700' :
                stats?.avgLevel === 'Frustration' ? 'text-red-700' :
                'text-purple-900'
              }`}>
                {stats?.avgLevel || 'N/A'}
              </div>
            )}
            <div className="text-base text-purple-700">From assessments</div>
          </div>
        </div>

        <div className="group relative overflow-hidden bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 rounded-xl p-3 sm:p-4 transition-all hover:shadow-md hover:scale-[1.02]">
          <div className="absolute -right-4 -top-4 w-16 h-16 rounded-full bg-orange-200/40 blur-xl group-hover:scale-110 transition-transform" />
          <div className="relative">
            <div className="text-lg font-medium text-orange-900 mb-1">Avg. Performance</div>
            {isLoading ? (
              <div className="h-8 bg-orange-200 rounded animate-pulse"></div>
            ) : (
              <div className="text-3xl font-bold text-orange-900">
                {stats?.avgPerf || 0}%
              </div>
            )}
            <div className="text-base text-orange-700">Overall progress</div>
          </div>
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-gray-100">
        <div className="text-base text-gray-500 flex items-center gap-1">
          <ClockIcon className="h-4 w-4" />
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

  const getPerformanceColor = (performance: string) => {
    switch (performance) {
      case 'Excellent': return 'bg-green-100 text-green-800 border-green-200';
      case 'Good': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Needs Improvement': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="group relative overflow-hidden bg-white border border-gray-200 rounded-xl p-6 shadow-md transition-all duration-300 hover:shadow-lg hover:scale-[1.01]">
      {/* Decorative gradient */}
      <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 opacity-50 blur-2xl group-hover:scale-110 transition-transform" />
      
      {/* Header with Avatar and Name */}
      <div className="relative flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xl font-bold text-white shadow-md">
            {child.name?.[0]?.toUpperCase() || '?'}
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-lg leading-tight">{child.name}</h3>
            <p className="text-sm text-gray-600 mt-0.5">{child.grade}</p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="relative space-y-3 mb-4">
        <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-100">
          <span className="text-sm font-medium text-gray-700">Reading Level</span>
          <span className="px-3 py-1 rounded-full bg-white border border-gray-200 text-sm font-semibold text-gray-900">
            {child.readingLevel || 'N/A'}
          </span>
        </div>
        
        <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-100">
          <span className="text-sm font-medium text-gray-700">Performance</span>
          <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${getPerformanceColor(child.performance)}`}>
            {getPerformanceText(child.performance) || 'Not assessed'}
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="relative grid grid-cols-2 gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate('/parent/reading', { state: { childId: child.id, childName: child.name } });
          }}
          className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm"
        >
          <BookOpenIcon className="h-4 w-4" />
          Practice
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate('/parent/progress', { state: { childId: child.id } });
          }}
          className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors"
        >
          <ChartBarIcon className="h-4 w-4" />
          Progress
        </button>
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
        <div className="px-6 py-6 sm:px-8 sm:py-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h2 className="text-3xl font-extrabold text-blue-900 mb-2">
                Welcome back, {currentUser?.displayName?.split(' ')[0] || 'Parent'}!
              </h2>
              <p className="text-lg text-blue-700 mt-1">
                See how your children are growing as readers and start new learning adventures.
              </p>
            </div>
            <span className="text-xs inline-flex items-center px-2 py-1 rounded-full bg-white/60 border border-white text-blue-700">
              Updated {formatDateHuman(new Date())}
            </span>
          </div>
        </div>
      </div>

      {/* Quick Actions Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
        <button
          onClick={() => navigate('/parent/reading')}
          className="group relative overflow-hidden bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-left shadow-md transition-all duration-300 hover:shadow-lg hover:scale-[1.01]"
        >
          <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/10 blur-2xl group-hover:scale-110 transition-transform" />
          <div className="relative">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center mb-4">
              <BookOpenIcon className="h-6 w-6 text-white" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Start Reading</h3>
            <p className="text-blue-100 text-sm mb-4">Begin a new reading session with your child</p>
            <div className="flex items-center text-white text-sm font-medium">
              Start Now
              <ArrowRightIcon className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </button>

        <button
          onClick={() => navigate('/parent/progress')}
          className="group relative overflow-hidden bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-left shadow-md transition-all duration-300 hover:shadow-lg hover:scale-[1.01]"
        >
          <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/10 blur-2xl group-hover:scale-110 transition-transform" />
          <div className="relative">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center mb-4">
              <ChartBarIcon className="h-6 w-6 text-white" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">View Progress</h3>
            <p className="text-green-100 text-sm mb-4">Track your child's reading journey and achievements</p>
            <div className="flex items-center text-white text-sm font-medium">
              View Details
              <ArrowRightIcon className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </button>

        <button
          onClick={() => navigate('/parent/children')}
          className="group relative overflow-hidden bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-left shadow-md transition-all duration-300 hover:shadow-lg hover:scale-[1.01]"
        >
          <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/10 blur-2xl group-hover:scale-110 transition-transform" />
          <div className="relative">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center mb-4">
              <UsersIcon className="h-6 w-6 text-white" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Manage Children</h3>
            <p className="text-purple-100 text-sm mb-4">Add or update your children's profiles</p>
            <div className="flex items-center text-white text-sm font-medium">
              Manage
              <ArrowRightIcon className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </button>
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
        <ParentLoader label="Loading dashboard..." fullScreen />
      )}

      {/* Main Content */}
      {children.length > 0 && !loading && (
        <>
          {/* Children Overview */}
          <ChildrenOverviewWidget
            children={children}
            isLoading={loading}
            avgPerformancePct={metrics.avgPerformance}
            chartsByStudentId={chartsByStudentId}
          />

          {/* Divider */}
          <div className="border-t border-gray-200"></div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Left Column - Children Cards */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
                  <UsersIcon className="h-6 w-6 text-gray-600" />
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {children.map((child) => (
                  <ChildCard key={child.id} child={child} />
                ))}
              </div>
            </div>

            {/* Right Column - Recent Activity & Tips */}
            <div className="space-y-4">
              {/* Recent Activity */}
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-md transition-all duration-300">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                    <ClockIcon className="h-5 w-5 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
                </div>
                
                {metrics.lastActivityAt ? (
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
                      <div className="w-2 h-2 rounded-full bg-green-500 mt-2"></div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">Last Reading Session</p>
                        <p className="text-xs text-gray-600 mt-1">
                          {formatDateHuman(metrics.lastActivityAt)}
                        </p>
                      </div>
                    </div>
                    
                    {metrics.streakDays > 0 && (
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-orange-50">
                        <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                          <svg className="h-4 w-4 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            {metrics.streakDays} Day Streak! 🔥
                          </p>
                          <p className="text-xs text-gray-600 mt-1">
                            Keep the momentum going!
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                      <ClockIcon className="h-6 w-6 text-gray-400" />
                    </div>
                    <p className="text-sm text-gray-600">No recent activity</p>
                    <button
                      onClick={() => navigate('/parent/reading')}
                      className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Start a session
                    </button>
                  </div>
                )}
              </div>

              {/* Reading Tips */}
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-200 p-6 shadow-md transition-all duration-300">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                    <svg className="h-5 w-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Reading Tip</h3>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">
                  <strong className="text-indigo-900">Daily Practice:</strong> Reading for just 15-20 minutes each day can significantly improve your child's fluency and comprehension skills.
                </p>
              </div>

              {/* Quick Links */}
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-md transition-all duration-300">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Quick Links</h3>
                <div className="space-y-1">
                  <button
                    onClick={() => navigate('/parent/reports')}
                    className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-blue-50 hover:border-blue-200 border border-transparent transition-all text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gray-100 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
                        <svg className="h-4 w-4 text-gray-600 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <span className="text-sm font-medium text-gray-900">View Reports</span>
                    </div>
                    <ArrowRightIcon className="h-4 w-4 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                  </button>
                  
                  <button
                    onClick={() => navigate('/parent/settings')}
                    className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-blue-50 hover:border-blue-200 border border-transparent transition-all text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gray-100 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
                        <svg className="h-4 w-4 text-gray-600 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <span className="text-sm font-medium text-gray-900">Settings</span>
                    </div>
                    <ArrowRightIcon className="h-4 w-4 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200"></div>

          {/* Progress Charts - Full Width */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
                <ChartBarIcon className="h-6 w-6 text-gray-600" />
                Learning Progress
              </h2>
              <button
                onClick={() => navigate('/parent/progress')}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
              >
                View All
                <ArrowRightIcon className="h-4 w-4" />
              </button>
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