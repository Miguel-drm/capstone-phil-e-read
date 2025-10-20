import React, { useEffect, useState, memo } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { studentService, type Student } from '../../../services/studentService';
import { type ClassGrade } from '../../../services/gradeService';
import PerformanceChart from '../teacher/PerformanceChart';
import { useNavigate } from 'react-router-dom';
import { BookOpenIcon, UsersIcon, ChartBarIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import { formatDateHuman } from '@/utils/date';

// Parent Profile widget removed per request

// Children Overview Widget - Admin Dashboard Style
const ChildrenOverviewWidget: React.FC<{ 
  children: Student[]; 
  isLoading: boolean; 
}> = ({ children, isLoading }) => (
  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 h-full flex flex-col">
    <div className="flex items-center justify-between mb-6">
      <h3 className="text-lg font-semibold text-gray-900">Children Overview</h3>
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-green-500"></div>
        <span className="text-sm text-gray-600">Active</span>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-4 flex-1">
      {/* Total Children */}
      <div className="p-4 bg-blue-50 rounded-xl">
        <div className="text-sm font-medium text-gray-900 mb-1">Total Children</div>
        {isLoading ? (
          <div className="h-8 bg-blue-200 rounded animate-pulse mb-1"></div>
        ) : (
          <div className="text-2xl font-bold text-blue-600">{children.length}</div>
        )}
        <div className="text-xs text-gray-600">Registered</div>
      </div>

      {/* Active Students */}
      <div className="p-4 bg-green-50 rounded-xl">
        <div className="text-sm font-medium text-gray-900 mb-1">Active Students</div>
        {isLoading ? (
          <div className="h-8 bg-green-200 rounded animate-pulse mb-1"></div>
        ) : (
          <div className="text-2xl font-bold text-green-600">{children.filter(c => c.status === 'active').length}</div>
        )}
        <div className="text-xs text-gray-600">Currently enrolled</div>
      </div>

      {/* Reading Level */}
      <div className="p-4 bg-purple-50 rounded-xl">
        <div className="text-sm font-medium text-gray-900 mb-1">Avg. Reading Level</div>
        {isLoading ? (
          <div className="h-8 bg-purple-200 rounded animate-pulse mb-1"></div>
        ) : (
          <div className="text-2xl font-bold text-purple-600">
            {children.length > 0 ? children[0].readingLevel || 'N/A' : 'N/A'}
          </div>
        )}
        <div className="text-xs text-gray-600">Current level</div>
      </div>

      {/* Performance */}
      <div className="p-4 bg-amber-50 rounded-xl">
        <div className="text-sm font-medium text-gray-900 mb-1">Avg. Performance</div>
        {isLoading ? (
          <div className="h-8 bg-amber-200 rounded animate-pulse mb-1"></div>
        ) : (
          <div className="text-2xl font-bold text-amber-600">85%</div>
        )}
        <div className="text-xs text-gray-600">Overall progress</div>
      </div>
    </div>

    <div className="mt-4 pt-4 border-t border-gray-200">
      <div className="text-xs text-gray-500">
        Last updated: {formatDateHuman(new Date())}
      </div>
    </div>
  </div>
);

// Quick Actions Widget - Admin Dashboard Style
const QuickActionsWidget: React.FC = () => {
  const navigate = useNavigate();

  const actions = [
    {
      id: 'start-practice',
      title: 'Start Practice',
      description: 'Begin reading session',
      icon: '📚',
      color: 'blue',
      bgColor: 'bg-blue-50',
      hoverColor: 'hover:bg-blue-100',
      iconColor: 'text-blue-600',
      onClick: () => navigate('/parent/reading')
    },
    {
      id: 'view-reports',
      title: 'View Reports',
      description: 'Check progress',
      icon: '📊',
      color: 'green',
      bgColor: 'bg-green-50',
      hoverColor: 'hover:bg-green-100',
      iconColor: 'text-green-600',
      onClick: () => navigate('/parent/reports')
    },
    {
      id: 'manage-children',
      title: 'Manage Children',
      description: 'Update profiles',
      icon: '👥',
      color: 'purple',
      bgColor: 'bg-purple-50',
      hoverColor: 'hover:bg-purple-100',
      iconColor: 'text-purple-600',
      onClick: () => navigate('/parent/children')
    }
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500"></div>
          <span className="text-sm text-gray-600">Available</span>
        </div>
      </div>

      <div className="space-y-3 flex-1">
        {actions.map((action) => (
          <button
            key={action.id}
            onClick={action.onClick}
            className={`w-full p-4 rounded-xl border border-gray-200 ${action.bgColor} ${action.hoverColor} transition-colors group`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg ${action.bgColor} flex items-center justify-center text-xl`}>
                {action.icon}
              </div>
              <div className="flex-1 text-left">
                <div className="font-semibold text-gray-900">{action.title}</div>
                <div className="text-sm text-gray-600">{action.description}</div>
              </div>
              <ArrowRightIcon className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

// Mock data for chart (replace with real data if available)
const mockChartData = {
  weeks: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6'],
  studentScores: [80, 85, 78, 90, 88, 92],
  classAverages: [75, 80, 77, 85, 83, 87],
};

const mockGrades: ClassGrade[] = [
  {
    id: 'grade1',
    name: 'Grade 1',
    description: 'First grade students - ages 6-7',
    ageRange: '6-7 years',
    studentCount: 20,
    color: 'blue',
    isActive: true,
  },
];

// (Removed unused OverviewCard to satisfy linter)

const ChildCard = memo(({ child }: { child: Student }) => (
  <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex flex-col">
    <div className="flex items-center mb-2">
      <div className="h-10 w-10 rounded-full bg-blue-200 flex items-center justify-center text-lg font-bold text-blue-700 mr-3">
        {child.name?.[0] || '?'}
      </div>
      <div>
        <div className="font-semibold text-gray-900 text-lg">{child.name}</div>
        <div className="text-xs text-gray-500">{child.grade}</div>
      </div>
    </div>
    <div className="flex flex-col gap-1 mt-2">
      <div className="text-sm"><span className="font-medium text-gray-700">Reading Level:</span> {child.readingLevel}</div>
      <div className="text-sm">
        <span className="font-medium text-gray-700">Performance:</span>
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
          child.performance === 'Excellent'
            ? 'bg-green-100 text-green-700'
            : child.performance === 'Good'
            ? 'bg-blue-100 text-blue-700'
            : 'bg-red-100 text-red-700'
        }`}>{child.performance}</span>
      </div>
    </div>
  </div>
));

const ParentDashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [children, setChildren] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchChildren = async () => {
      if (!currentUser?.uid) return;
      setLoading(true);
      try {
        const students = await studentService.getStudentsByParent(currentUser.uid);
        if (isMounted) setChildren(students);
      } catch {
        if (isMounted) setChildren([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchChildren();
    return () => { isMounted = false; };
  }, [currentUser?.uid]);

  return (
    <div className="space-y-6">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border border-gray-100">
        <div className="px-6 py-6 sm:px-8 sm:py-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-blue-900">Welcome back</h2>
              <p className="mt-1 text-sm text-blue-700">Track your children’s progress and start a new practice anytime.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button aria-label="Start Practice" onClick={() => navigate('/parent/reading')} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-400 transition">
                <BookOpenIcon className="h-5 w-5" /> Start Practice
              </button>
              <button aria-label="View Reports" onClick={() => navigate('/parent/reports')} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-blue-700 bg-white border border-blue-100 hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-200 transition">
                <ChartBarIcon className="h-5 w-5" /> View Reports
              </button>
              <button aria-label="Manage Children" onClick={() => navigate('/parent/children')} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-blue-700 bg-white border border-blue-100 hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-200 transition">
                <UsersIcon className="h-5 w-5" /> Manage Children
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* No Children Banner */}
      {children.length === 0 && !loading && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <UsersIcon className="h-5 w-5 text-blue-600" />
      </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-blue-900">No children registered yet</h3>
              <p className="text-sm text-blue-700">Link a child to your account to start tracking their reading progress.</p>
        </div>
            <button 
              onClick={() => navigate('/parent/children')} 
              className="px-4 py-2 text-sm font-medium text-blue-700 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              Manage Children
            </button>
          </div>
          </div>
        )}


      {/* Main Content Sections - Admin Dashboard Style */}
      <div className="flex flex-col gap-4">
        {/* Quick Actions and Children Overview - equal height containers */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="flex">
            <QuickActionsWidget />
          </div>
          <div className="flex">
            <ChildrenOverviewWidget 
              children={children}
              isLoading={loading}
            />
          </div>
      </div>

        {/* Children Overview moved above with Quick Actions */}

        {/* Children cards - only show if children exist */}
        {children.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {children.map((child) => (
              <ChildCard key={child.id} child={child} />
            ))}
          </div>
        )}

        {/* Progress Charts per child - only show if children exist */}
        {children.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {children.map((child) => (
            <PerformanceChart
              key={child.id}
                data={mockChartData as any}
              grades={mockGrades}
              students={[child]}
              title={child.name}
              targetLine={85}
            />
            ))}
          </div>
        )}


        {/* Recent Activity Feed */}
        {children.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
              <button 
                onClick={() => navigate('/parent/progress')}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                View All
              </button>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                  <BookOpenIcon className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">Reading Session Completed</div>
                  <div className="text-sm text-gray-600">Emma finished "The Magic Tree" - 15 minutes</div>
                  <div className="text-xs text-gray-500">2 hours ago</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-green-600">92%</div>
                  <div className="text-xs text-gray-500">Accuracy</div>
                </div>
              </div>
              
              <div className="flex items-center gap-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                  <ChartBarIcon className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">Progress Milestone Reached</div>
                  <div className="text-sm text-gray-600">Emma improved reading speed by 15%</div>
                  <div className="text-xs text-gray-500">Yesterday</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-blue-600">+15%</div>
                  <div className="text-xs text-gray-500">Improvement</div>
                </div>
              </div>

              <div className="flex items-center gap-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
                <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-lg">🏆</span>
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">Achievement Unlocked</div>
                  <div className="text-sm text-gray-600">"Reading Streak Master" - 5 days in a row!</div>
                  <div className="text-xs text-gray-500">3 days ago</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-purple-600">5 days</div>
                  <div className="text-xs text-gray-500">Streak</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Performance Overview - 2 column layout */}
        {children.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Total Reading Time */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                    <BookOpenIcon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-900">2h 45m</div>
                    <div className="text-sm text-blue-700">Total Reading Time</div>
                  </div>
                </div>
              </div>

              {/* Average Performance */}
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                    <ChartBarIcon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-900">87%</div>
                    <div className="text-sm text-green-700">Average Performance</div>
                  </div>
                </div>
              </div>

              {/* Reading Streak */}
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold">🔥</span>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-purple-900">5 days</div>
                    <div className="text-sm text-purple-700">Reading Streak</div>
                  </div>
                </div>
              </div>

              {/* Words Per Minute */}
              <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-4 border border-amber-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold">⚡</span>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-amber-900">65 WPM</div>
                    <div className="text-sm text-amber-700">Reading Speed</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Learning Tips */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Today's Learning Tip</h3>
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center mt-0.5">
                      <span className="text-white text-sm">💡</span>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">Encourage Daily Reading</div>
                      <div className="text-sm text-gray-600 mt-1">
                        Set aside 15-20 minutes each day for reading practice. Consistency is key to building strong reading skills.
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center mt-0.5">
                      <span className="text-white text-sm">📚</span>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">Read Together</div>
                      <div className="text-sm text-gray-600 mt-1">
                        Take turns reading paragraphs. This helps with comprehension and makes reading more enjoyable.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Achievements & Milestones */}
        {children.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Achievements</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl border border-yellow-200">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm">🏆</span>
                  </div>
                  <div className="font-medium text-gray-900">Reading Streak</div>
                </div>
                <div className="text-sm text-gray-600">5 days in a row!</div>
                <div className="text-xs text-gray-500 mt-1">Unlocked 2 days ago</div>
              </div>

              <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm">📈</span>
                  </div>
                  <div className="font-medium text-gray-900">Speed Boost</div>
                </div>
                <div className="text-sm text-gray-600">15% faster reading</div>
                <div className="text-xs text-gray-500 mt-1">Achieved yesterday</div>
              </div>

              <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm">⭐</span>
                  </div>
                  <div className="font-medium text-gray-900">Perfect Score</div>
                </div>
                <div className="text-sm text-gray-600">100% accuracy</div>
                <div className="text-xs text-gray-500 mt-1">Last session</div>
              </div>
            </div>
          </div>
        )}

        {/* Upcoming Tasks & Reminders */}
        {children.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Upcoming Tasks</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm">📅</span>
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">Daily Reading Practice</div>
                  <div className="text-sm text-gray-600">Recommended: 20 minutes today</div>
                </div>
                <button 
                  onClick={() => navigate('/parent/reading')}
                  className="px-3 py-1 text-sm bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors"
                >
                  Start Now
                </button>
              </div>

              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm">📊</span>
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">Weekly Progress Review</div>
                  <div className="text-sm text-gray-600">Due in 2 days - Check Emma's progress</div>
                </div>
                <button 
                  onClick={() => navigate('/parent/reports')}
                  className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                >
                  View Report
                </button>
              </div>

              <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm">📚</span>
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">New Stories Available</div>
                  <div className="text-sm text-gray-600">3 new reading materials added</div>
                </div>
                <button 
                  onClick={() => navigate('/parent/reading')}
                  className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                >
                  Explore
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Quick Insights & Recommendations */}
        {children.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Insights</h3>
              <div className="space-y-4">
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center mt-0.5">
                      <span className="text-white text-xs">✓</span>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">Great Progress!</div>
                      <div className="text-sm text-gray-600">Emma's reading speed improved by 15% this week</div>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center mt-0.5">
                      <span className="text-white text-xs">💡</span>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">Focus Area</div>
                      <div className="text-sm text-gray-600">Practice comprehension questions for better understanding</div>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center mt-0.5">
                      <span className="text-white text-xs">🎯</span>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">Next Goal</div>
                      <div className="text-sm text-gray-600">Aim for 70 WPM reading speed</div>
                    </div>
                  </div>
                </div>
              </div>
      </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recommendations</h3>
        <div className="space-y-4">
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center mt-0.5">
                      <span className="text-white text-xs">📖</span>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">Try New Stories</div>
                      <div className="text-sm text-gray-600">"Adventure Tales" series matches Emma's level</div>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center mt-0.5">
                      <span className="text-white text-xs">⏰</span>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">Best Practice Time</div>
                      <div className="text-sm text-gray-600">Emma performs best in the morning (9-11 AM)</div>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center mt-0.5">
                      <span className="text-white text-xs">🎯</span>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">Focus on Fluency</div>
                      <div className="text-sm text-gray-600">Practice reading aloud for better pronunciation</div>
                    </div>
                  </div>
                </div>
        </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default ParentDashboard; 