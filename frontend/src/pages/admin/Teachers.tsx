import React, { useEffect, useState } from 'react';
import { getAllTeachers, deleteTeacher } from '../../services/authService';
import EditTeacherDetailsModal from '../../components/admin/EditTeacherDetailsModal';
import { Menu } from '@headlessui/react';
import { EllipsisVerticalIcon, FunnelIcon, MagnifyingGlassIcon } from '@heroicons/react/24/solid';
import ConfirmDeleteModal from '../../components/admin/ConfirmDeleteModal';
import Loader from '../../components/Loader';

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
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  const fetchTeachers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAllTeachers();
      setTeachers(data);
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

  return (
    <div className="p-8">
      {viewTeacher ? (
        <div className="bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.12)] p-2 sm:p-6">
          <div className="flex justify-between mb-4 items-center">
            <h2 className="text-2xl font-bold text-gray-800">Teacher Details</h2>
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
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Basic Information</h3>
              <p><span className="font-medium text-gray-900">Name:</span> {viewTeacher.displayName || 'N/A'}</p>
              <p><span className="font-medium text-gray-900">Email:</span> {viewTeacher.email || 'N/A'}</p>
              <p><span className="font-medium text-gray-900">Phone:</span> {viewTeacher.phoneNumber || 'N/A'}</p>
              <p><span className="font-medium text-gray-900">School:</span> {viewTeacher.school || 'N/A'}</p>
              <p><span className="font-medium text-gray-900">Grade Level:</span> {viewTeacher.gradeLevel || 'N/A'}</p>
            </div>
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Profile Image</h3>
              {viewTeacher.profileImage ? (
                <img src={viewTeacher.profileImage} alt={viewTeacher.displayName || 'Profile'} className="w-full h-40 object-cover rounded-lg" />
              ) : (
                <div className="w-full h-40 bg-gray-200 flex items-center justify-center rounded-lg text-gray-500">No Image</div>
              )}
            </div>
          </div>
        </div>
      ) : loading ? (
        <Loader label="Loading teachers..." />
      ) : error ? (
        <div className="text-red-500">{error}</div>
      ) : teachers.length === 0 ? (
        <div className="text-gray-500">No teachers found.</div>
      ) : (
          <div className="bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.12)] p-2 sm:p-6">
          <div className="flex justify-between mb-4 items-center">
            <h2 className="text-2xl font-bold text-gray-800">Teachers</h2>
          </div>
          <div className="overflow-visible">
            <table className="min-w-full rounded-2xl">
              <thead>
                <tr className="bg-white shadow-sm rounded-t-2xl sticky top-0 z-10">
                  <th className="px-6 py-5 text-left text-sm font-bold text-gray-700 uppercase tracking-wider rounded-tl-2xl border-b border-gray-200">Name</th>
                  <th className="px-6 py-5 text-left text-sm font-bold text-gray-700 uppercase tracking-wider border-b border-gray-200">School</th>
                  <th className="px-6 py-5 text-center text-sm font-bold text-gray-700 uppercase tracking-wider border-b border-gray-200">Grade Level</th>
                  <th className="px-6 py-5 text-right text-sm font-bold text-gray-700 uppercase tracking-wider border-b border-gray-200" colSpan={2}>
                    <div className="flex justify-end items-center gap-2">
              <button
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 p-2 rounded-full shadow flex items-center justify-center"
                onClick={() => setFilterOpen(f => !f)}
                title="Filter"
              >
                <FunnelIcon className="w-5 h-5" />
              </button>
              <button
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 p-2 rounded-full shadow flex items-center justify-center"
                onClick={() => setSearchOpen(s => !s)}
                title="Search"
              >
                <MagnifyingGlassIcon className="w-5 h-5" />
              </button>
              {searchOpen && (
                <input
                  type="text"
                          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 transition-all duration-150 ml-2"
                  placeholder="Search by name..."
                  value={searchValue}
                  onChange={e => setSearchValue(e.target.value)}
                  autoFocus
                  style={{ minWidth: 180 }}
                />
              )}
              {filterOpen && (
                <div className="absolute right-24 top-12 bg-white border border-gray-200 rounded-lg shadow-lg z-20 w-48">
                  <button
                    className={`w-full text-left px-4 py-2 hover:bg-blue-50 ${filterType === 'az' ? 'font-bold text-blue-700' : ''}`}
                    onClick={() => { setFilterType('az'); setFilterOpen(false); }}
                  >
                    Name: A to Z
                  </button>
                  <button
                    className={`w-full text-left px-4 py-2 hover:bg-blue-50 ${filterType === 'za' ? 'font-bold text-blue-700' : ''}`}
                    onClick={() => { setFilterType('za'); setFilterOpen(false); }}
                  >
                    Name: Z to A
                  </button>
                  <button
                    className={`w-full text-left px-4 py-2 hover:bg-blue-50 ${filterType === 'newest' ? 'font-bold text-blue-700' : ''}`}
                    onClick={() => { setFilterType('newest'); setFilterOpen(false); }}
                  >
                    Newest Teacher
                  </button>
                  <button
                    className={`w-full text-left px-4 py-2 hover:bg-blue-50 ${filterType === 'oldest' ? 'font-bold text-blue-700' : ''}`}
                    onClick={() => { setFilterType('oldest'); setFilterOpen(false); }}
                  >
                    Oldest Teacher
                  </button>
                </div>
              )}
              <button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-5 rounded-lg shadow transition-all duration-150">+ Add Teacher</button>
            </div>
                  </th>
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
                        ) : null}
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