import React, { useEffect, useState, memo } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { studentService, type Student } from '../../../services/studentService';
import { type ClassGrade } from '../../../services/gradeService';
import PerformanceChart from '../teacher/PerformanceChart';
import { useNavigate } from 'react-router-dom';
import { BookOpenIcon, UsersIcon, ChartBarIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import { profileImageService } from '../../../services/profileImageService';

// Parent Profile Widget - Admin Dashboard Style
const ParentProfileWidget: React.FC<{ 
  currentUser: any; 
  isLoading: boolean; 
}> = ({ currentUser, isLoading }) => {
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(true);

  useEffect(() => {
    const fetchProfileImage = async () => {
      if (!currentUser?.uid) return;
      
      setImageLoading(true);
      try {
        // Try to fetch from parent endpoint first, then fallback to teacher endpoint
        let imageBase64 = await profileImageService.getParentProfileImage(currentUser.uid);
        if (!imageBase64) {
          // Fallback to teacher endpoint if parent doesn't exist
          imageBase64 = await profileImageService.getTeacherProfileImage(currentUser.uid);
        }
        
        if (imageBase64) {
          const dataUrl = profileImageService.convertBase64ToDataUrl(imageBase64);
          setProfileImage(dataUrl);
        }
      } catch (error) {
        console.warn('Failed to fetch profile image:', error);
      } finally {
        setImageLoading(false);
      }
    };

    fetchProfileImage();
  }, [currentUser?.uid]);

  return (
  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
    <div className="flex items-center justify-between mb-6">
      <h3 className="text-lg font-semibold text-gray-900">Parent Profile</h3>
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-green-500"></div>
        <span className="text-sm text-gray-600">Active</span>
      </div>
    </div>

    <div className="flex items-center gap-4 mb-6">
      {/* Profile Image */}
      <div className="w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-green-500 to-blue-600 flex items-center justify-center text-white text-xl font-bold">
        {isLoading || imageLoading ? (
          <div className="w-16 h-16 bg-gray-200 rounded-full animate-pulse"></div>
        ) : profileImage ? (
          <img 
            src={profileImage} 
            alt={currentUser?.displayName || 'Parent'} 
            className="w-full h-full object-cover"
            onError={(e) => {
              // Fallback to initial if image fails to load
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) {
                parent.innerHTML = currentUser?.displayName?.charAt(0)?.toUpperCase() || 'P';
              }
            }}
          />
        ) : currentUser?.photoURL || currentUser?.profilePhoto ? (
          <img 
            src={currentUser.photoURL || currentUser.profilePhoto} 
            alt={currentUser?.displayName || 'Parent'} 
            className="w-full h-full object-cover"
            onError={(e) => {
              // Fallback to initial if image fails to load
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) {
                parent.innerHTML = currentUser?.displayName?.charAt(0)?.toUpperCase() || 'P';
              }
            }}
          />
        ) : (
          currentUser?.displayName?.charAt(0)?.toUpperCase() || 'P'
        )}
      </div>
      
      {/* Profile Info */}
      <div className="flex-1">
        {isLoading ? (
          <div className="space-y-2">
            <div className="h-6 bg-gray-200 rounded animate-pulse w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2"></div>
          </div>
        ) : (
          <>
            <h4 className="text-xl font-semibold text-gray-900">
              {currentUser?.displayName || 'Parent Name'}
            </h4>
            <p className="text-sm text-gray-600">
              {currentUser?.email || 'parent@school.com'}
            </p>
          </>
        )}
      </div>
    </div>

    {/* Profile Stats */}
    <div className="grid grid-cols-2 gap-4">
      <div className="p-3 bg-green-50 rounded-lg">
        <div className="text-xs font-medium text-gray-600 mb-1">Role</div>
        <div className="text-sm font-semibold text-green-600">Parent</div>
      </div>
      <div className="p-3 bg-blue-50 rounded-lg">
        <div className="text-xs font-medium text-gray-600 mb-1">Status</div>
        <div className="text-sm font-semibold text-blue-600">Active</div>
      </div>
    </div>

    <div className="mt-4 pt-4 border-t border-gray-200">
      <div className="text-xs text-gray-500">
        Last login: {formatDateHuman(new Date())}
      </div>
    </div>
  </div>
  );
};

// Children Overview Widget - Admin Dashboard Style
const ChildrenOverviewWidget: React.FC<{ 
  children: Student[]; 
  isLoading: boolean; 
}> = ({ children, isLoading }) => (
  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
    <div className="flex items-center justify-between mb-6">
      <h3 className="text-lg font-semibold text-gray-900">Children Overview</h3>
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-green-500"></div>
        <span className="text-sm text-gray-600">Active</span>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-4">
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
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500"></div>
          <span className="text-sm text-gray-600">Available</span>
        </div>
      </div>

      <div className="space-y-3">
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

const OverviewCard = memo(({ title, value, icon: Icon, accent }: { title: string; value: number | string; icon: React.ElementType; accent: string }) => (
  <div className="group relative overflow-hidden rounded-2xl bg-white border border-gray-100 transition-all duration-200">
    <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r ${accent} pointer-events-none`} />
    <div className="relative p-5 flex items-center gap-4">
      <div className="h-12 w-12 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-600 group-hover:bg-white/90 transition-colors">
        <Icon className="h-6 w-6" />
      </div>
      <div className="flex-1">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{title}</h3>
        <p className="mt-1 text-3xl font-extrabold text-gray-900">{value}</p>
      </div>
      <ArrowRightIcon className="h-5 w-5 text-gray-300 group-hover:text-gray-600 transition-colors" />
    </div>
  </div>
));

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
              <button onClick={() => navigate('/parent/reading')} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white bg-gradient-to-r from-blue-500 to-purple-500 transition">
                <BookOpenIcon className="h-5 w-5" /> Start Practice
              </button>
              <button onClick={() => navigate('/parent/reports')} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-blue-700 bg-white border border-blue-100 hover:bg-blue-50 transition">
                <ChartBarIcon className="h-5 w-5" /> View Reports
              </button>
              <button onClick={() => navigate('/parent/children')} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-blue-700 bg-white border border-blue-100 hover:bg-blue-50 transition">
                <UsersIcon className="h-5 w-5" /> Manage Children
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Sections - Admin Dashboard Style */}
      <div className="flex flex-col gap-3">
        {/* Parent Profile and Quick Actions - top row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="lg:col-span-1">
            <ParentProfileWidget 
              currentUser={currentUser}
              isLoading={loading}
            />
          </div>
          <div className="lg:col-span-2">
            <QuickActionsWidget />
          </div>
      </div>

        {/* Children Overview - full width */}
        <div>
          <ChildrenOverviewWidget 
            children={children}
            isLoading={loading}
          />
        </div>

        {/* Children cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {loading ? (
            <div className="col-span-full text-center py-8 text-gray-500">Loading children...</div>
        ) : children.length === 0 ? (
            <div className="col-span-full text-center py-8 text-gray-500">No children registered yet</div>
          ) : (
            children.map((child) => (
              <ChildCard key={child.id} child={child} />
            ))
        )}
      </div>

      {/* Progress Charts per child */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {children.length === 0 ? (
          <PerformanceChart data={mockChartData} grades={mockGrades} students={children} title="All Students" targetLine={85} />
        ) : (
          children.map((child) => (
            <PerformanceChart
              key={child.id}
              data={mockChartData}
              grades={mockGrades}
              students={[child]}
              title={child.name}
              targetLine={85}
            />
          ))
        )}
      </div>

      {/* Recent Activity */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
        <div className="space-y-4">
          <p className="text-gray-500">No recent activity</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ParentDashboard; 