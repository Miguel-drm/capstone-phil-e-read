import React, { useEffect, useState, memo, useMemo } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { studentService, type Student } from '../../../services/studentService';
import { type ClassGrade } from '../../../services/gradeService';
import PerformanceChart from '../teacher/PerformanceChart';
import { useNavigate } from 'react-router-dom';
import { 
  BookOpenIcon, 
  UsersIcon, 
  ChartBarIcon, 
  ArrowRightIcon,
  ClockIcon,
  TrophyIcon,
  LightBulbIcon,
  AcademicCapIcon,
  CalendarIcon,
  CheckCircleIcon
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
      ? numericLevels.reduce((a,b)=>a+b,0) / numericLevels.length
      : NaN;

    return {
      total: children.length,
      active: activeChildren.length,
      avgLevel: Math.round(avgReadingLevel) || 'N/A',
      avgPerf: Math.round(avgPerformancePct)
    };
  }, [children, avgPerformancePct]);

  return (
    <div className="bg-white rounded-lg border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <UsersIcon className="h-5 w-5 text-gray-600" />
          Children Overview
        </h3>
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-green-500"></div>
        <span className="text-sm text-gray-600">Active</span>
      </div>
    </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-gray-50 rounded-lg">
        <div className="text-sm font-medium text-gray-900 mb-1">Total Children</div>
        {isLoading ? (
            <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
        ) : (
            <div className="text-2xl font-bold text-gray-900">
              {stats?.total || 0}
            </div>
        )}
        <div className="text-xs text-gray-600">Registered</div>
      </div>

        <div className="p-4 bg-gray-50 rounded-lg">
        <div className="text-sm font-medium text-gray-900 mb-1">Active Students</div>
        {isLoading ? (
            <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
        ) : (
            <div className="text-2xl font-bold text-gray-900">
              {stats?.active || 0}
            </div>
        )}
        <div className="text-xs text-gray-600">Currently enrolled</div>
      </div>

        <div className="p-4 bg-gray-50 rounded-lg">
        <div className="text-sm font-medium text-gray-900 mb-1">Avg. Reading Level</div>
        {isLoading ? (
            <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
        ) : (
            <div className="text-2xl font-bold text-gray-900">
              {stats?.avgLevel || 'N/A'}
          </div>
        )}
        <div className="text-xs text-gray-600">Current level</div>
      </div>

        <div className="p-4 bg-gray-50 rounded-lg">
        <div className="text-sm font-medium text-gray-900 mb-1">Avg. Performance</div>
        {isLoading ? (
            <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
        ) : (
            <div className="text-2xl font-bold text-gray-900">
              {stats?.avgPerf || 0}%
            </div>
        )}
        <div className="text-xs text-gray-600">Overall progress</div>
      </div>
    </div>

    <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="text-xs text-gray-500 flex items-center gap-1">
          <ClockIcon className="h-3 w-3" />
        Last updated: {formatDateHuman(new Date())}
      </div>
    </div>
  </div>
);
};

// Quick Actions Widget
const QuickActionsWidget: React.FC = () => {
  const navigate = useNavigate();

  const actions = [
    {
      id: 'start-practice',
      title: 'Start Practice',
      description: 'Begin reading session',
      icon: BookOpenIcon,
      onClick: () => navigate('/parent/reading')
    },
    {
      id: 'view-reports',
      title: 'View Reports',
      description: 'Check progress',
      icon: ChartBarIcon,
      onClick: () => navigate('/parent/reports')
    },
    {
      id: 'manage-children',
      title: 'Manage Children',
      description: 'Update profiles',
      icon: UsersIcon,
      onClick: () => navigate('/parent/children')
    }
  ];

  return (
    <div className="bg-white rounded-lg border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <BookOpenIcon className="h-5 w-5 text-gray-600" />
          Quick Actions
        </h3>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500"></div>
          <span className="text-sm text-gray-600">Available</span>
        </div>
      </div>

      <div className="space-y-3">
        {actions.map((action) => {
          const IconComponent = action.icon;
          return (
          <button
            key={action.id}
            onClick={action.onClick}
              className="w-full p-4 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors group text-left"
              aria-label={`${action.title} - ${action.description}`}
          >
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                  <IconComponent className="h-6 w-6 text-gray-600" />
              </div>
                <div className="flex-1">
                <div className="font-semibold text-gray-900">{action.title}</div>
                <div className="text-sm text-gray-600">{action.description}</div>
              </div>
              <ArrowRightIcon className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors" />
            </div>
          </button>
          );
        })}
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
  
  const getPerformanceColor = (performance: string) => {
    switch (performance) {
      case 'Excellent': return 'bg-green-100 text-green-800';
      case 'Good': return 'bg-blue-100 text-blue-800';
      case 'Needs Improvement': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPerformanceText = (performance: string) => {
    switch (performance) {
      case 'Excellent': return 'Advanced';
      case 'Good': return 'On Track';
      case 'Needs Improvement': return 'Support Needed';
      default: return performance;
    }
  };

  const getPerformanceDotColor = (performance: string) => {
    switch (performance) {
      case 'Excellent': return 'bg-green-500';
      case 'Good': return 'bg-blue-500';
      case 'Needs Improvement': return 'bg-yellow-500';
      default: return 'bg-gray-400';
    }
  };

  const getStatusColor = (status: string) => {
    return status === 'active' ? 'bg-green-500' : 'bg-gray-400';
  };

  return (
    <div 
      className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
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
      <div className="flex items-center mb-3">
        <div className="relative">
          <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-lg font-bold text-gray-700 mr-3">
        {child.name?.[0] || '?'}
      </div>
          <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${getStatusColor(child.status)}`}></div>
      </div>
        <div className="flex-1">
          <div className="font-semibold text-gray-900">{child.name}</div>
          <div className="text-sm text-gray-600 flex items-center gap-1">
            <AcademicCapIcon className="h-4 w-4" />
            {child.grade}
    </div>
        </div>
      </div>
      
      <div className="flex flex-col gap-2">
        <div className="text-sm flex items-center gap-2">
          <span className="font-medium text-gray-700">Reading Level:</span> 
          <span className="px-2 py-1 rounded bg-gray-100 text-gray-700 text-xs">
            {child.readingLevel || 'N/A'}
          </span>
        </div>
        <div className="text-sm flex items-center gap-2">
        <span className="font-medium text-gray-700">Progress:</span>
          <div className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${getPerformanceDotColor(child.performance)}`}></div>
            <span className="text-xs font-medium text-gray-700">
              {getPerformanceText(child.performance) || 'Not Available'}
          </span>
          </div>
      </div>
    </div>
      
      <div className="mt-3 pt-3 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Click to manage</span>
          <ArrowRightIcon className="h-4 w-4 text-gray-400" />
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
  const [recentActivities, setRecentActivities] = useState<Array<{ id: string; childName: string; type: 'reading-session' | 'test'; when: Date; summary: string; metricLabel: string; metricValue: string }>>([]);
  const [metrics, setMetrics] = useState<{ totalReadingMinutes: number; avgPerformance: number; avgWpm: number; streakDays: number; lastActivityAt?: Date }>({ totalReadingMinutes: 0, avgPerformance: 0, avgWpm: 0, streakDays: 0 });
  const [achievements, setAchievements] = useState<Array<{ id: string; title: string; description: string; value: string; date: string; type: 'streak' | 'speed' | 'accuracy' }>>([]);
  const [upcomingTasks, setUpcomingTasks] = useState<Array<{ id: string; title: string; description: string; action: string; priority: 'high' | 'medium' | 'low' }>>([]);
  const [learningTips, setLearningTips] = useState<Array<{ id: string; title: string; description: string; category: string }>>([]);

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
        setRecentActivities([]);
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

        const avg = (s: number[], c: number[]) => s.map((v,i)=> c[i] ? Number((v/c[i]).toFixed(2)) : 0);

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
      const avgPerf = avgPerfArr.length ? Number((avgPerfArr.reduce((a,b) => a+b, 0) / avgPerfArr.length).toFixed(0)) : 0;
      const wpmArr = readingSessions.map(x => x.r.readingSpeed).filter((n: any) => typeof n === 'number') as number[];
      const avgWpm = wpmArr.length ? Number((wpmArr.reduce((a,b)=>a+b,0)/wpmArr.length).toFixed(0)) : 0;
      const dates = readingSessions.map(x => new Date(x.r.createdAt || x.r.sessionDate || x.r.testDate || x.r.updatedAt)).filter(d => !isNaN(d.getTime())).sort((a,b)=> b.getTime()-a.getTime());
      const lastAt = dates[0];
      
      // streak based on consecutive days including most recent
      let streak = 0;
      if (dates.length) {
        let anchor = new Date(dates[0]);
        anchor.setHours(0,0,0,0);
        streak = 1;
        for (let i=1;i<dates.length;i++) {
          const d = new Date(dates[i]); d.setHours(0,0,0,0);
          const diffDays = Math.round((anchor.getTime() - d.getTime()) / (1000*60*60*24));
          if (diffDays === 1) { streak += 1; anchor = d; } else if (diffDays === 0) { continue; } else { break; }
        }
      }
      setMetrics({ totalReadingMinutes: totalMinutes, avgPerformance: avgPerf, avgWpm, streakDays: streak, lastActivityAt: lastAt });

      // Recent activity list (latest 3)
      const sortedAll = allResults
        .map(x => ({ ...x, when: new Date(x.r.createdAt || x.r.sessionDate || x.r.testDate || x.r.updatedAt) }))
        .filter(x => !isNaN(x.when.getTime()))
        .sort((a,b)=> b.when.getTime()-a.when.getTime())
        .slice(0,3)
        .map(({ r, childName, when }) => {
          if (r.type === 'reading-session') {
            const acc = typeof r.oralReadingScore === 'number' ? `${Math.round(r.oralReadingScore)}%` : '-';
            return { id: r.id || r._id || Math.random().toString(), childName, type: 'reading-session' as const, when, summary: `${childName} finished a reading session`, metricLabel: 'Accuracy', metricValue: acc };
          }
          const comp = typeof r.comprehension === 'number' ? `${Math.round(r.comprehension)}%` : '-';
          return { id: r.id || r._id || Math.random().toString(), childName, type: 'test' as const, when, summary: `${childName} completed a comprehension test`, metricLabel: 'Comprehension', metricValue: comp };
        });
      setRecentActivities(sortedAll);

      // Generate achievements from real data
      const achievementsList: Array<{ id: string; title: string; description: string; value: string; date: string; type: 'streak' | 'speed' | 'accuracy' }> = [];
      
      if (streak >= 3) {
        achievementsList.push({
          id: 'streak-' + streak,
          title: 'Reading streak champion',
          description: `${streak} days in a row`,
          value: `${streak} days`,
          date: lastAt ? formatDateHuman(lastAt) : 'Recently',
          type: 'streak'
        });
      }
      
      if (avgWpm > 0) {
        achievementsList.push({
          id: 'speed-' + avgWpm,
          title: 'Speed superstar',
          description: `${avgWpm} words per minute`,
          value: `${avgWpm} WPM`,
          date: lastAt ? formatDateHuman(lastAt) : 'Recently',
          type: 'speed'
        });
      }
      
      if (avgPerf >= 90) {
        achievementsList.push({
          id: 'accuracy-' + avgPerf,
          title: 'Perfect score master',
          description: `${avgPerf}% accuracy`,
          value: `${avgPerf}%`,
          date: lastAt ? formatDateHuman(lastAt) : 'Recently',
          type: 'accuracy'
        });
      }
      
      setAchievements(achievementsList);

      // Generate upcoming tasks based on real data
      const tasksList: Array<{ id: string; title: string; description: string; action: string; priority: 'high' | 'medium' | 'low' }> = [];
      
      if (totalMinutes < 60) { // Less than 1 hour total
        tasksList.push({
          id: 'daily-reading',
          title: 'Daily reading time',
          description: 'Recommended: 20 minutes today',
          action: 'Start Reading',
          priority: 'high'
        });
      }
      
      if (avgPerf < 80) {
        tasksList.push({
          id: 'comprehension-practice',
          title: 'Focus on comprehension',
          description: 'Practice understanding questions',
          action: 'Start Practice',
          priority: 'medium'
        });
      }
      
      if (avgWpm < 50) {
        tasksList.push({
          id: 'speed-practice',
          title: 'Improve reading speed',
          description: 'Practice reading aloud for fluency',
          action: 'Start Reading',
          priority: 'medium'
        });
      }
      
      setUpcomingTasks(tasksList);

      // Generate learning tips based on real data
      const tipsList: Array<{ id: string; title: string; description: string; category: string }> = [];
      
      if (avgPerf < 85) {
        tipsList.push({
          id: 'accuracy-tip',
          title: 'Focus on accuracy',
          description: 'Take time to read each word correctly. Speed will improve with practice.',
          category: 'Accuracy'
        });
      }
      
      if (avgWpm < 60) {
        tipsList.push({
          id: 'fluency-tip',
          title: 'Build reading fluency',
          description: 'Practice reading aloud daily. This helps with both speed and comprehension.',
          category: 'Fluency'
        });
      }
      
      if (streak < 3) {
        tipsList.push({
          id: 'consistency-tip',
          title: 'Make reading a habit',
          description: 'Set aside 15-20 minutes each day. Consistency is key to improvement.',
          category: 'Habits'
        });
      }
      
      setLearningTips(tipsList);
    }, (error) => {
      console.warn('Reading results subscription error:', error);
      if (isActive) {
        setChartsByStudentId({});
        setRecentActivities([]);
        setMetrics({ totalReadingMinutes: 0, avgPerformance: 0, avgWpm: 0, streakDays: 0 });
      }
    });

    return () => { 
      isActive = false; 
      unsub();
    };
  }, [children]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Hero Section */}
        <div className="bg-white rounded-lg border p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                Welcome back, {currentUser?.displayName?.split(' ')[0] || 'Parent'}!
              </h1>
              <p className="text-gray-600">
                See how your children are growing as readers and start new learning adventures.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button 
                aria-label="Start Practice Session" 
                onClick={() => navigate('/parent/reading')} 
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors"
              >
                <BookOpenIcon className="h-5 w-5" /> 
                Start Reading
              </button>
              <button 
                aria-label="View Progress Reports" 
                onClick={() => navigate('/parent/reports')} 
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                <ChartBarIcon className="h-5 w-5" /> 
                View Reports
              </button>
              <button 
                aria-label="Manage Children Profiles" 
                onClick={() => navigate('/parent/children')} 
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                <UsersIcon className="h-5 w-5" /> 
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
            {/* Quick Actions and Children Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <QuickActionsWidget />
            <ChildrenOverviewWidget 
              children={children}
              isLoading={loading}
              avgPerformancePct={metrics.avgPerformance}
            />
      </div>

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
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  <ChartBarIcon className="h-5 w-5 text-gray-600" />
                  Your Child's Learning Journey
                </h2>
                <button 
                  onClick={() => navigate('/parent/reports')}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                >
                  View Full Reports
                  <ArrowRightIcon className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-6">
                {children.map((child) => (
                <PerformanceChart
                  key={child.id}
                    data={chartsByStudentId[child.id as string] || { assessmentPeriods: [], oralReadingScores: [], comprehensionScores: [], readingLevels: [] }}
                    grades={[{ id: 'g', name: child.grade, description: '', ageRange: '', studentCount: 0, color: 'blue', isActive: true } as ClassGrade]}
                  students={[child]}
                    title={`${child.name}'s Learning Progress`}
                  targetLine={85}
                  showStaticStudentInfo={true}
                />
                ))}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-lg border p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <ClockIcon className="h-5 w-5 text-gray-600" />
                  What's Been Happening
                </h3>
              <button 
                onClick={() => navigate('/parent/progress')}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
              >
                  See All Activity
                  <ArrowRightIcon className="h-4 w-4" />
              </button>
            </div>
              <div className="space-y-3">
                {recentActivities.length === 0 && (
                  <div className="flex items-center justify-center text-center py-10 bg-gray-50 rounded-lg border border-dashed">
                    <div className="flex flex-col items-center gap-2">
                      <ClockIcon className="h-8 w-8 text-gray-400" />
                      <div className="text-sm text-gray-700 font-medium">No recent activity</div>
                      <div className="text-xs text-gray-500">When your child practices or takes a test, it will show up here.</div>
                    </div>
                  </div>
                )}
              <div className="flex items-center gap-4 p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                  <BookOpenIcon className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                    <div className="font-medium text-gray-900">{recentActivities[0]?.summary || 'Recent activity'}</div>
                    <div className="text-sm text-gray-600">{recentActivities[0]?.childName || ''}</div>
                    <div className="text-xs text-gray-500">{recentActivities[0]?.when ? formatDateHuman(recentActivities[0].when) : ''}</div>
                </div>
                <div className="text-right">
                    <div className="text-sm font-medium text-green-600">{recentActivities[0]?.metricValue || ''}</div>
                    <div className="text-xs text-gray-500">{recentActivities[0]?.metricLabel || ''}</div>
                </div>
              </div>
              
              <div className="flex items-center gap-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <ChartBarIcon className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                    <div className="font-medium text-gray-900">{recentActivities[1]?.summary || ''}</div>
                    <div className="text-sm text-gray-600">{recentActivities[1]?.childName || ''}</div>
                    <div className="text-xs text-gray-500">{recentActivities[1]?.when ? formatDateHuman(recentActivities[1].when) : ''}</div>
                </div>
                <div className="text-right">
                    <div className="text-sm font-medium text-blue-600">{recentActivities[1]?.metricValue || ''}</div>
                    <div className="text-xs text-gray-500">{recentActivities[1]?.metricLabel || ''}</div>
                </div>
              </div>

              <div className="flex items-center gap-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                    <TrophyIcon className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                    <div className="font-medium text-gray-900">{recentActivities[2]?.summary || ''}</div>
                    <div className="text-sm text-gray-600">{recentActivities[2]?.childName || ''}</div>
                    <div className="text-xs text-gray-500">{recentActivities[2]?.when ? formatDateHuman(recentActivities[2].when) : ''}</div>
                </div>
                <div className="text-right">
                    <div className="text-sm font-medium text-purple-600">{recentActivities[2]?.metricValue || ''}</div>
                    <div className="text-xs text-gray-500">{recentActivities[2]?.metricLabel || ''}</div>
                </div>
              </div>
            </div>
          </div>

            {/* Performance Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <ChartBarIcon className="h-5 w-5 text-gray-600" />
                  How Your Child is Doing
                </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4 border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                    <BookOpenIcon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                        <div className="text-xl font-bold text-gray-900">{metrics.totalReadingMinutes}m</div>
                        <div className="text-sm text-gray-600">Time spent reading</div>
                  </div>
                </div>
              </div>

                  <div className="bg-gray-50 rounded-lg p-4 border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                    <ChartBarIcon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                        <div className="text-xl font-bold text-gray-900">{metrics.avgPerformance}%</div>
                        <div className="text-sm text-gray-600">Overall performance</div>
                  </div>
                </div>
              </div>

                  <div className="bg-gray-50 rounded-lg p-4 border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
                        <TrophyIcon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                        <div className="text-xl font-bold text-gray-900">{metrics.streakDays} days</div>
                        <div className="text-sm text-gray-600">Days in a row</div>
                  </div>
                </div>
              </div>

                  <div className="bg-gray-50 rounded-lg p-4 border">
                <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-yellow-500 rounded-lg flex items-center justify-center">
                        <ClockIcon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                        <div className="text-xl font-bold text-gray-900">{metrics.avgWpm} WPM</div>
                        <div className="text-sm text-gray-600">Words per minute</div>
                      </div>
                  </div>
                </div>
              </div>
            </div>

              <div className="bg-white rounded-lg border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <LightBulbIcon className="h-5 w-5 text-gray-600" />
                  Tips for Success
                </h3>
                <div className="space-y-3">
                  {learningTips.map((tip) => (
                    <div key={tip.id} className={`p-3 rounded-lg border ${
                      tip.category === 'Accuracy' ? 'bg-blue-50 border-blue-200' :
                      tip.category === 'Fluency' ? 'bg-green-50 border-green-200' :
                      'bg-purple-50 border-purple-200'
                    }`}>
                  <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center mt-0.5 ${
                          tip.category === 'Accuracy' ? 'bg-blue-500' :
                          tip.category === 'Fluency' ? 'bg-green-500' :
                          'bg-purple-500'
                        }`}>
                          <LightBulbIcon className="h-4 w-4 text-white" />
                    </div>
                    <div>
                          <div className="font-medium text-gray-900">{tip.title}</div>
                          <div className="text-sm text-gray-600 mt-1">{tip.description}</div>
                      </div>
                    </div>
                  </div>
                  ))}
                </div>
                    </div>
                      </div>

            {/* Achievements */}
            <div className="bg-white rounded-lg border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <TrophyIcon className="h-5 w-5 text-gray-600" />
                  Celebrating Success
                </h3>
              {achievements.length === 0 && (
                <div className="flex items-center justify-center text-center py-10 bg-gray-50 rounded-lg border border-dashed">
                  <div className="flex flex-col items-center gap-2">
                    <TrophyIcon className="h-8 w-8 text-gray-400" />
                    <div className="text-sm text-gray-700 font-medium">No achievements yet</div>
                    <div className="text-xs text-gray-500">Consistent practice unlocks achievements.</div>
            </div>
          </div>
        )}
              {achievements.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {achievements.map((achievement) => (
                    <div key={achievement.id} className={`p-4 rounded-lg border ${
                      achievement.type === 'streak' ? 'bg-yellow-50 border-yellow-200' :
                      achievement.type === 'speed' ? 'bg-green-50 border-green-200' :
                      'bg-blue-50 border-blue-200'
                    }`}>
                <div className="flex items-center gap-3 mb-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          achievement.type === 'streak' ? 'bg-yellow-500' :
                          achievement.type === 'speed' ? 'bg-green-500' :
                          'bg-blue-500'
                        }`}>
                          {achievement.type === 'streak' ? <TrophyIcon className="h-4 w-4 text-white" /> :
                           achievement.type === 'speed' ? <ChartBarIcon className="h-4 w-4 text-white" /> :
                           <CheckCircleIcon className="h-4 w-4 text-white" />}
                  </div>
                        <div className="font-medium text-gray-900">{achievement.title}</div>
                </div>
                      <div className="text-sm text-gray-600">{achievement.description}</div>
                      <div className="text-xs text-gray-500 mt-1">{achievement.date}</div>
              </div>
                  ))}
                  </div>
              )}
              </div>

            {/* Upcoming Tasks */}
            <div className="bg-white rounded-lg border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5 text-gray-600" />
                  What's Next
                </h3>
              <div className="space-y-3">
                {upcomingTasks.length === 0 && (
                  <div className="flex items-center justify-center text-center py-10 bg-gray-50 rounded-lg border border-dashed">
                    <div className="flex flex-col items-center gap-2">
                      <CalendarIcon className="h-8 w-8 text-gray-400" />
                      <div className="text-sm text-gray-700 font-medium">All caught up</div>
                      <div className="text-xs text-gray-500">We’ll suggest next steps based on new activity.</div>
            </div>
          </div>
        )}
                {upcomingTasks.map((task) => (
                    <div key={task.id} className={`flex items-center gap-4 p-3 rounded-lg border ${
                      task.priority === 'high' ? 'bg-yellow-50 border-yellow-200' :
                      task.priority === 'medium' ? 'bg-blue-50 border-blue-200' :
                      'bg-green-50 border-green-200'
                    }`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        task.priority === 'high' ? 'bg-yellow-500' :
                        task.priority === 'medium' ? 'bg-blue-500' :
                        'bg-green-500'
                      }`}>
                        <CalendarIcon className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1">
                        <div className="font-medium text-gray-900">{task.title}</div>
                        <div className="text-sm text-gray-600">{task.description}</div>
                </div>
                <button 
                  onClick={() => navigate('/parent/reading')}
                        className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                          task.priority === 'high' ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' :
                          task.priority === 'medium' ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' :
                          'bg-green-100 text-green-700 hover:bg-green-200'
                        }`}
                      >
                        {task.action}
                </button>
              </div>
                ))}
                </div>
              </div>

            {/* Quick Insights */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <CheckCircleIcon className="h-5 w-5 text-gray-600" />
                  What We're Seeing
                </h3>
                <div className="space-y-3">
                  {(metrics.avgPerformance <= 0 && metrics.avgWpm <= 0 && metrics.streakDays <= 0) && (
                    <div className="flex items-center justify-center text-center py-10 bg-gray-50 rounded-lg border border-dashed">
                      <div className="flex flex-col items-center gap-2">
                        <CheckCircleIcon className="h-8 w-8 text-gray-400" />
                        <div className="text-sm text-gray-700 font-medium">No insights yet</div>
                        <div className="text-xs text-gray-500">Start a reading session to see progress here.</div>
            </div>
          </div>
        )}
                  {metrics.avgPerformance > 0 && (
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center mt-0.5">
                          <CheckCircleIcon className="h-3 w-3 text-white" />
                    </div>
                    <div>
                          <div className="font-medium text-gray-900">Current Performance</div>
                          <div className="text-sm text-gray-600">Average accuracy: {Math.round(metrics.avgPerformance)}%</div>
                    </div>
                  </div>
                </div>
                  )}

                  {metrics.avgWpm > 0 && (
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center mt-0.5">
                          <ChartBarIcon className="h-3 w-3 text-white" />
                    </div>
                    <div>
                          <div className="font-medium text-gray-900">Reading Speed</div>
                          <div className="text-sm text-gray-600">Average: {Math.round(metrics.avgWpm)} words per minute</div>
                    </div>
                  </div>
                </div>
                  )}

                  {metrics.streakDays > 0 && (
                <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center mt-0.5">
                          <TrophyIcon className="h-3 w-3 text-white" />
                    </div>
                    <div>
                          <div className="font-medium text-gray-900">Reading Streak</div>
                          <div className="text-sm text-gray-600">{metrics.streakDays} days in a row</div>
                    </div>
                  </div>
                </div>
                  )}
              </div>
      </div>

              <div className="bg-white rounded-lg border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <LightBulbIcon className="h-5 w-5 text-gray-600" />
                  Our Suggestions
                </h3>
                <div className="space-y-3">
                  {learningTips.length === 0 && (
                    <div className="flex items-center justify-center text-center py-10 bg-gray-50 rounded-lg border border-dashed">
                      <div className="flex flex-col items-center gap-2">
                        <LightBulbIcon className="h-8 w-8 text-gray-400" />
                        <div className="text-sm text-gray-700 font-medium">No tips yet</div>
                        <div className="text-xs text-gray-500">Tips will appear based on real reading activity.</div>
                    </div>
                    </div>
                  )}
                  {learningTips.map((tip) => (
                    <div key={tip.id} className={`p-3 rounded-lg border ${
                      tip.category === 'Accuracy' ? 'bg-yellow-50 border-yellow-200' :
                      tip.category === 'Fluency' ? 'bg-green-50 border-green-200' :
                      'bg-blue-50 border-blue-200'
                    }`}>
                  <div className="flex items-start gap-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center mt-0.5 ${
                          tip.category === 'Accuracy' ? 'bg-yellow-500' :
                          tip.category === 'Fluency' ? 'bg-green-500' :
                          'bg-blue-500'
                        }`}>
                          <LightBulbIcon className="h-3 w-3 text-white" />
                    </div>
                    <div>
                          <div className="font-medium text-gray-900">{tip.title}</div>
                          <div className="text-sm text-gray-600">{tip.description}</div>
                    </div>
                  </div>
                </div>
                  ))}
                    </div>
                    </div>
                  </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ParentDashboard; 