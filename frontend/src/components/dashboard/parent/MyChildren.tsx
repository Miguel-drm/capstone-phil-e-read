import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { studentService, type Student } from '../../../services/studentService';
import { useNavigate } from 'react-router-dom';
import { BookOpenIcon, ChartBarIcon, MagnifyingGlassIcon, PlusCircleIcon } from '@heroicons/react/24/outline';

const MyChildren: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [children, setChildren] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState<string>('');

  useEffect(() => {
    const fetchChildren = async () => {
      if (!currentUser?.uid) return;
      setLoading(true);
      try {
        const students = await studentService.getStudentsByParent(currentUser.uid);
        setChildren(students);
      } catch (err) {
        setChildren([]);
      } finally {
        setLoading(false);
      }
    };
    fetchChildren();
  }, [currentUser?.uid]);

  const grades = useMemo(() => Array.from(new Set(children.map(c => c.grade).filter(Boolean))), [children]);
  const filtered = useMemo(() => {
    return children.filter(c => (
      (!gradeFilter || c.grade === gradeFilter) &&
      (!search || (c.name?.toLowerCase().includes(search.toLowerCase())))
    ));
  }, [children, gradeFilter, search]);

  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <h3 className="text-lg font-semibold text-gray-900">My Children</h3>
        <div className="flex items-center gap-2">
          <div className="relative">
            <MagnifyingGlassIcon className="h-4 w-4 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name..."
              className="pl-7 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white"
          >
            <option value="">All Grades</option>
            {grades.map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
          <button
            onClick={() => navigate('/parent/children')}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-xl text-blue-700 bg-white border border-blue-100 hover:bg-blue-50"
          >
            <PlusCircleIcon className="h-4 w-4" /> Link Child
          </button>
        </div>
      </div>
      {loading ? (
        <div className="text-gray-500">Loading...</div>
      ) : children.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8">
          <img src="https://cdn.jsdelivr.net/gh/edent/SuperTinyIcons/images/svg/child.svg" alt="No children" className="w-16 h-16 mb-2 opacity-60" />
          <p className="text-gray-500">No children linked to your account yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(child => (
            <div key={child.id} className="group relative overflow-hidden bg-gradient-to-br from-blue-50 to-white border border-blue-100 rounded-2xl p-5 flex flex-col transition-all">
              <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-blue-100/60 blur-2xl group-hover:scale-110 transition-transform" />
              <div className="flex items-center mb-2">
                <div className="h-12 w-12 rounded-xl bg-white/80 border border-blue-100 flex items-center justify-center text-lg font-bold text-blue-700 mr-3">
                  {child.name?.[0] || '?'}
                </div>
                <div>
                  <div className="font-semibold text-gray-900 text-lg">{child.name}</div>
                  <div className="text-xs text-gray-500">{child.grade}</div>
                </div>
              </div>
              <div className="flex flex-col gap-1 mt-2">
                <div className="text-sm"><span className="font-medium text-gray-700">Reading Level:</span> {child.readingLevel}</div>
                <div className="text-sm"><span className="font-medium text-gray-700">Performance:</span> <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${child.performance === 'Excellent' ? 'bg-green-100 text-green-700' : child.performance === 'Good' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>{child.performance}</span></div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => navigate('/parent/reading-practice', { state: { childId: child.id, childName: child.name } })}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg text-white bg-gradient-to-r from-blue-500 to-purple-500"
                  >
                    <BookOpenIcon className="h-4 w-4" /> Practice
                  </button>
                  <button
                    onClick={() => navigate('/parent/progress', { state: { childId: child.id } })}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg text-blue-700 bg-white border border-blue-100 hover:bg-blue-50"
                  >
                    <ChartBarIcon className="h-4 w-4" /> Progress
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyChildren; 