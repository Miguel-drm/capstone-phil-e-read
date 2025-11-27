import React, { useEffect, useState } from 'react';
import { getAllTeachers, deleteTeacher } from '../../services/authService';
import EditTeacherDetailsModal from '../../components/admin/EditTeacherDetailsModal';
import { Menu } from '@headlessui/react';
import { EllipsisVerticalIcon, FunnelIcon, MagnifyingGlassIcon } from '@heroicons/react/24/solid';
import ConfirmDeleteModal from '../../components/admin/ConfirmDeleteModal';
import AdminLoader from '../../components/admin/AdminLoader';
import { profileImageService } from '../../services/profileImageService';

interface Teacher {
  id: string;
  displayName?: string;
  email?: string;
  phoneNumber?: string;
  school?: string;
  gradeLevel?: string;
  profileImage?: string;
}

const Teachers: React.FC = () => {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [teacherToDelete, setTeacherToDelete] = useState<Teacher | null>(null);
  const [viewTeacher, setViewTeacher] = useState<Teacher | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterType, setFilterType] = useState<'az' | 'za' | 'newest' | 'oldest'>('az');
  // Search is always visible now
  const [searchValue, setSearchValue] = useState('');

  const fetchTeachers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAllTeachers();

      // Fetch profile images from MongoDB for each teacher (by firebase UID)
      const withImages = await Promise.all(
        data.map(async (t) => {
          try {
            const base64 = await profileImageService.getTeacherProfileImage(t.id);
            return base64
              ? { ...t, profileImage: profileImageService.convertBase64ToDataUrl(base64) }
              : t;
          } catch {
            return t;
          }
        })
      );

      setTeachers(withImages);
    } catch (err) {
      setError('Failed to load teachers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeachers();
  }, []);

  useEffect(() => {
    if (viewTeacher) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [viewTeacher]);

  const handleEdit = (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedTeacher(null);
  };

  const handleSaveSuccess = async () => {
    await fetchTeachers();
    handleModalClose();
  };


  const handleDeleteClick = (teacher: Teacher) => {
    setTeacherToDelete(teacher);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!teacherToDelete) return;
    setActionLoading(true);
    try {
      await deleteTeacher(teacherToDelete.id);
      setTeachers(prev => prev.filter(t => t.id !== teacherToDelete.id));
      setIsDeleteModalOpen(false);
      setTeacherToDelete(null);
    } catch (err) {
      // Optionally show error modal or toast
    } finally {
      setActionLoading(false);
    }
  };

  // Combine search and filter
  let displayedTeachers = [...teachers];
  if (searchValue) {
    displayedTeachers = displayedTeachers.filter(t =>
      t.displayName?.toLowerCase().includes(searchValue.toLowerCase())
    );
  }
  if (filterType === 'az') {
    displayedTeachers.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
  } else if (filterType === 'za') {
    displayedTeachers.sort((a, b) => (b.displayName || '').localeCompare(a.displayName || ''));
  } else if (filterType === 'newest') {
    displayedTeachers.sort((a, b) => (b.id || '').localeCompare(a.id || ''));
  } else if (filterType === 'oldest') {
    displayedTeachers.sort((a, b) => (a.id || '').localeCompare(b.id || ''));
  }

  const teacherStats = [
    { label: 'Total Teachers', value: teachers.length },
    { label: 'Profile Photos', value: teachers.filter((t) => Boolean(t.profileImage)).length },
    { label: 'Schools', value: new Set(teachers.map((t) => t.school || 'Unknown')).size },
  ];

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {viewTeacher ? (
        <div className="bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.12)] p-4 sm:p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Overview</p>
              <h2 className="text-2xl font-bold text-gray-900">Teacher Details</h2>
            </div>
            <button
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 p-2 rounded-full shadow flex items-center justify-center"
              onClick={() => setViewTeacher(null)}
              title="Back"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-50 rounded-xl p-6 space-y-3">
              <h3 className="text-lg font-semibold text-gray-800">Basic Information</h3>
              <div className="space-y-2 text-sm text-gray-700">
                <p><span className="font-medium text-gray-900">Name:</span> {viewTeacher.displayName || 'N/A'}</p>
                <p><span className="font-medium text-gray-900">Email:</span> {viewTeacher.email || 'N/A'}</p>
                <p><span className="font-medium text-gray-900">Phone:</span> {viewTeacher.phoneNumber || 'N/A'}</p>
                <p><span className="font-medium text-gray-900">School:</span> {viewTeacher.school || 'N/A'}</p>
                <p><span className="font-medium text-gray-900">Grade Level:</span> {viewTeacher.gradeLevel || 'N/A'}</p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-6 flex flex-col md:flex-row items-center gap-4">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center text-white text-2xl font-bold overflow-hidden">
                {viewTeacher.profileImage ? (
                  <img src={viewTeacher.profileImage} alt={viewTeacher.displayName || 'Profile'} className="w-full h-full object-cover" />
                ) : (
                  viewTeacher.displayName?.charAt(0)?.toUpperCase() ||
                  viewTeacher.email?.charAt(0)?.toUpperCase() ||
                  'T'
                )}
              </div>
              <div className="space-y-2 text-sm text-gray-700 w-full">
                <h3 className="text-lg font-semibold text-gray-800">Profile & Status</h3>
                <p><span className="font-medium text-gray-900">Last Updated:</span> {new Date().toLocaleDateString()}</p>
                <p><span className="font-medium text-gray-900">Role:</span> Teacher</p>
              </div>
            </div>
          </div>
        </div>
      ) : loading ? (
        <AdminLoader label="Loading teachers..." fullScreen />
      ) : error ? (
        <div className="text-red-500">{error}</div>
      ) : teachers.length === 0 ? (
        <div className="text-gray-500">No teachers found.</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {teacherStats.map((stat) => (
              <div key={stat.label} className="rounded-2xl bg-white shadow-sm border border-gray-100 px-5 py-4">
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className="text-2xl font-semibold text-gray-900 mt-1">{stat.value}</p>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.12)] p-2 sm:p-6 space-y-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">Teachers</h2>
                <p className="text-sm text-gray-500 mt-1">Manage teacher profiles, schools, and grade assignments.</p>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                <div className="relative w-full sm:w-64">
                  <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Search by name or school..."
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                  />
                </div>
                <div className="relative">
                  <button
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    onClick={() => setFilterOpen((f) => !f)}
                  >
                    <FunnelIcon className="w-5 h-5 text-gray-500" />
                    Sort
                  </button>
                  {filterOpen && (
                    <div className="absolute right-0 mt-2 bg-white border border-gray-200 rounded-2xl shadow-xl z-20 w-56 overflow-hidden">
                      {[
                        { key: 'az', label: 'Name: A to Z' },
                        { key: 'za', label: 'Name: Z to A' },
                        { key: 'newest', label: 'Newest Teacher' },
                        { key: 'oldest', label: 'Oldest Teacher' },
                      ].map((option) => (
                        <button
                          key={option.key}
                          className={`w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 ${filterType === option.key ? 'font-semibold text-blue-700' : 'text-gray-700'}`}
                          onClick={() => {
                            setFilterType(option.key as typeof filterType);
                            setFilterOpen(false);
                          }}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="overflow-visible">
            <table className="min-w-full rounded-2xl">
              <thead>
                <tr className="bg-white shadow-sm rounded-t-2xl sticky top-0 z-10">
                  <th className="px-6 py-5 text-left text-sm font-bold text-gray-700 uppercase tracking-wider rounded-tl-2xl border-b border-gray-200">Name</th>
                  <th className="px-6 py-5 text-left text-sm font-bold text-gray-700 uppercase tracking-wider border-b border-gray-200">School</th>
                  <th className="px-6 py-5 text-center text-sm font-bold text-gray-700 uppercase tracking-wider border-b border-gray-200">Grade Level</th>
                  <th className="px-6 py-5 text-right text-sm font-bold text-gray-700 uppercase tracking-wider border-b border-gray-200" colSpan={2}></th>
                </tr>
              </thead>
              <tbody>
                {displayedTeachers.map((teacher) => (
                  <tr
                    key={teacher.id}
                    className="transition-all duration-200 hover:bg-blue-200/70 hover:shadow-2xl hover:-translate-y-1 hover:border-blue-400 border-b border-gray-100 last:border-b-0 group"
                  >
                    <td
                      className="px-6 py-6 whitespace-nowrap flex items-center gap-4 cursor-pointer"
                      onClick={() => setViewTeacher(teacher)}
                    >
                      <span className="w-16 h-16 rounded-full bg-white border border-gray-200 shadow flex items-center justify-center overflow-hidden mr-2">
                        {teacher.profileImage ? (
                          <img src={teacher.profileImage} alt={teacher.displayName || 'Profile'} className="w-full h-full object-cover rounded-full" />
                        ) : (
                          <div className="w-full h-full rounded-full bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center text-white text-xl font-semibold">
                            {(teacher.displayName || teacher.email || 'T').charAt(0).toUpperCase()}
                          </div>
                        )}
                      </span>
                      <div className="flex flex-col">
                        <span className="font-extrabold text-lg text-gray-900">{teacher.displayName || 'N/A'}</span>
                        <span className="text-xs text-gray-400">{teacher.email || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-6 whitespace-nowrap text-sm text-gray-700 align-middle cursor-pointer" onClick={() => setViewTeacher(teacher)}>{teacher.school || 'N/A'}</td>
                    <td className="px-6 py-6 whitespace-nowrap text-sm text-gray-700 text-center align-middle cursor-pointer" onClick={() => setViewTeacher(teacher)}>{teacher.gradeLevel || 'N/A'}</td>
                    <td className="px-6 py-6 whitespace-nowrap text-right text-sm font-medium relative align-middle">
                      <Menu as="div" className="relative inline-block text-left">
                        <Menu.Button className="flex items-center p-2 rounded-full hover:bg-gray-100 focus:outline-none">
                          <EllipsisVerticalIcon className="w-5 h-5 text-gray-500" />
                        </Menu.Button>
                        <Menu.Items className="origin-top-right absolute right-0 mt-2 w-32 rounded-lg shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-10 p-1 flex flex-col gap-1">
                          <Menu.Item>
                            {({ active }) => (
                              <button
                                onClick={() => handleEdit(teacher)}
                                className={`w-full text-left px-4 py-2 text-sm rounded-md transition-colors ${active ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
                                disabled={actionLoading}
                              >
                                Edit
                              </button>
                            )}
                          </Menu.Item>
                          <Menu.Item>
                            {({ active }) => (
                              <button
                                onClick={() => handleDeleteClick(teacher)}
                                className={`w-full text-left px-4 py-2 text-sm rounded-md transition-colors ${active ? 'bg-red-50 text-red-700' : 'text-red-600'}`}
                                disabled={actionLoading}
                              >
                                Delete
                              </button>
                            )}
                          </Menu.Item>
                        </Menu.Items>
                      </Menu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}

      {selectedTeacher && (
        <EditTeacherDetailsModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          teacher={selectedTeacher}
          onSaveSuccess={handleSaveSuccess}
        />
      )}


      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        loading={actionLoading}
        message={teacherToDelete ? `Are you sure you want to delete ${teacherToDelete.displayName || teacherToDelete.email || 'this teacher'}? This action cannot be undone.` : ''}
      />
    </div>
  );
};

export default Teachers; 