import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { studentService, type Student } from '../../../services/studentService';

const MyChildren: React.FC = () => {
  const { currentUser } = useAuth();
  const [children, setChildren] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm">
      <h3 className="text-lg font-medium text-gray-900 mb-4">My Children</h3>
      {loading ? (
        <div className="text-gray-500">Loading...</div>
      ) : children.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8">
          <img src="https://cdn.jsdelivr.net/gh/edent/SuperTinyIcons/images/svg/child.svg" alt="No children" className="w-16 h-16 mb-2 opacity-60" />
          <p className="text-gray-500">No children linked to your account yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {children.map(child => (
            <div key={child.id} className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex flex-col shadow-sm">
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
                <div className="text-sm"><span className="font-medium text-gray-700">Performance:</span> <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${child.performance === 'Excellent' ? 'bg-green-100 text-green-700' : child.performance === 'Good' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>{child.performance}</span></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyChildren; 