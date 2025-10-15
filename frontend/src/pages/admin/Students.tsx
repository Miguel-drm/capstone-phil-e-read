import React, { useEffect, useState } from 'react';
import * as StudentServiceModule from '../../services/studentService'; // Import as a namespace
import { gradeService, type ClassGrade } from '../../services/gradeService';
import { FunnelIcon, MagnifyingGlassIcon, EllipsisVerticalIcon } from '@heroicons/react/24/solid';
import type { Student } from '../../services/studentService';
import ReactDOM from 'react-dom';
import Loader from '../../components/Loader';
import Swal from 'sweetalert2';
import { useAuth } from '../../contexts/AuthContext';
import { Menu } from '@headlessui/react';

// Add this type for merged student data
export type MergedStudent = Student & { studentId?: string };

const Students: React.FC = () => {
  const { userRole } = useAuth();
  const [students, setStudents] = useState<MergedStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [grades, setGrades] = useState<ClassGrade[]>([]);
  const [selectedGradeId, setSelectedGradeId] = useState<string | 'all' | ''>('all');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [parents, setParents] = useState<{ id: string; displayName?: string; email?: string }[]>([]);
  const [deletingStudentId, setDeletingStudentId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState<boolean>(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [viewStudent, setViewStudent] = useState<MergedStudent | null>(null);
  const [filterType, setFilterType] = useState<'az' | 'za' | 'newest' | 'oldest'>('az');

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      setError(null);
      try {
        const allGrades = await gradeService.getAllClassGrades();
        setGrades(allGrades);

        if (selectedGradeId === 'all') {
          const allStudents = await StudentServiceModule.studentService.getAllStudents();
          const filtered = allStudents.filter(s => showArchived ? (s as any).archived : !(s as any).archived);
          setStudents(filtered.map(s => ({ ...s })) as MergedStudent[]);
        } else if (selectedGradeId) {
          // Find the grade name for the selectedGradeId
          const gradeObj = grades.find(g => g.id === selectedGradeId);
          const gradeName = gradeObj?.name;
          if (!gradeName) {
            setStudents([]);
            return;
          }
          // Fetch all students and filter by grade name
          const allStudents = await StudentServiceModule.studentService.getAllStudents();
          const filtered = allStudents.filter(s => s.grade === gradeName).filter(s => showArchived ? (s as any).archived : !(s as any).archived);
          setStudents(filtered.map(s => ({ ...s })) as MergedStudent[]);
        }
      } catch (err) {
        setError('Failed to load data.');
        console.error('Error loading data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, [selectedGradeId, showArchived]);

  useEffect(() => {
    // Fetch parents for linking
    import('../../services/authService').then(mod => {
      mod.getAllParents().then(data => {
        setParents(data.map((p: any) => ({ id: p.id, displayName: p.displayName, email: p.email })));
      });
    });
  }, []);

  const handleGradeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedGradeId(e.target.value);
  };

  const handleDeleteStudent = async (student: MergedStudent) => {
    if (userRole !== 'admin') return false;
    const { isConfirmed } = await Swal.fire({
      icon: 'warning',
      title: 'Delete Student',
      html: `<div class="text-left">
        <p class="mb-2">This will permanently remove <b>${student.name}</b> and their progress.</p>
        <p class="mb-2">Type <b>Delete</b> to confirm.</p>
      </div>`,
      input: 'text',
      inputPlaceholder: 'Type Delete',
      inputValidator: (value) => {
        if (!value) {
          return 'Please type Delete to confirm';
        }
        if (value.trim().toLowerCase() !== 'delete') {
          return 'Please type Delete to confirm';
        }
        return null;
      },
      showCancelButton: true,
      confirmButtonText: 'Delete',
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      inputAttributes: {
        style: `
          border: 2px solid #e5e7eb;
          border-radius: 8px;
          padding: 12px;
          font-size: 16px;
          transition: all 0.3s ease;
        `
      },
      didOpen: () => {
        const input = document.querySelector('.swal2-input') as HTMLInputElement;
        if (input) {
          input.addEventListener('input', (e) => {
            const target = e.target as HTMLInputElement;
            if (target.value.trim().toLowerCase() === 'delete') {
              target.style.borderColor = '#dc2626';
              target.style.backgroundColor = '#fef2f2';
              target.style.color = '#dc2626';
              target.style.fontWeight = '600';
            } else {
              target.style.borderColor = '#e5e7eb';
              target.style.backgroundColor = '#ffffff';
              target.style.color = '#374151';
              target.style.fontWeight = 'normal';
            }
          });
        }
      }
    });
    if (!isConfirmed) return false;
    
    setDeletingStudentId(student.studentId ?? student.id ?? '');
    await StudentServiceModule.studentService.deleteStudent((student.studentId ?? student.id ?? ''));
    setStudents(prev => prev.filter(s => (s.studentId || s.id) !== (student.studentId || student.id)));
    setDeletingStudentId(null);
    
    // Show deletion confirmation message
    await Swal.fire({
      icon: 'warning',
      title: 'Student Removed',
      text: `${student.name} has been permanently removed from the system.`,
      confirmButtonColor: '#6b7280',
      confirmButtonText: 'Understood',
      timer: 3000,
      timerProgressBar: true,
      showConfirmButton: true
    });
    
    return true; // Return true to indicate successful deletion
  };

  const handleLinkParent = async (student: MergedStudent, parentId: string) => {
    const parent = parents.find(p => p.id === parentId);
    if (!parent) return;
    await StudentServiceModule.studentService.updateStudent((student.studentId ?? student.id ?? ''), {
      parentId: parent.id,
      parentName: parent.displayName || parent.email || '',
    });
    setStudents(prev =>
      prev.map(s =>
        (s.studentId || s.id) === (student.studentId || student.id)
          ? { ...s, parentId: parent.id, parentName: parent.displayName || parent.email || '' }
          : s
      )
    );
  };

  const handleUpdateStudent = async (student: MergedStudent, updates: Partial<MergedStudent>) => {
    await StudentServiceModule.studentService.updateStudent((student.studentId ?? student.id ?? ''), updates);
    setStudents(prev =>
      prev.map(s =>
        (s.studentId || s.id) === (student.studentId || student.id)
          ? { ...s, ...updates }
          : s
      )
    );
  };

  const handleUnlinkParent = async (student: MergedStudent) => {
    await StudentServiceModule.studentService.updateStudent((student.studentId ?? student.id ?? ''), {
      parentId: '',
      parentName: '',
    });
    setStudents(prev =>
      prev.map(s =>
        (s.studentId || s.id) === (student.studentId || student.id)
          ? { ...s, parentId: '', parentName: '' }
          : s
      )
    );
  };

  // Combine search and filter
  let displayedStudents = [...students];
  if (searchValue) {
    displayedStudents = displayedStudents.filter(s =>
      s.name?.toLowerCase().includes(searchValue.toLowerCase()) ||
      s.lrn?.toLowerCase().includes(searchValue.toLowerCase()) ||
      s.parentName?.toLowerCase().includes(searchValue.toLowerCase())
    );
  }
  if (filterType === 'az') {
    displayedStudents.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  } else if (filterType === 'za') {
    displayedStudents.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
  } else if (filterType === 'newest') {
    displayedStudents.sort((a, b) => (b.id || '').localeCompare(a.id || ''));
  } else if (filterType === 'oldest') {
    displayedStudents.sort((a, b) => (a.id || '').localeCompare(b.id || ''));
  }

  return (
    <div className="p-8">
      {viewStudent ? (
        <div className="bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.12)] p-2 sm:p-6">
          <div className="flex justify-between mb-4 items-center">
            <h2 className="text-2xl font-bold text-gray-800">Student Details</h2>
            <button
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 p-2 rounded-full shadow flex items-center justify-center"
              onClick={() => setViewStudent(null)}
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
              <p><span className="font-medium text-gray-900">Name:</span> {viewStudent.name || 'N/A'}</p>
              <p><span className="font-medium text-gray-900">LRN:</span> {viewStudent.lrn || 'N/A'}</p>
              <p><span className="font-medium text-gray-900">Grade:</span> {viewStudent.grade || 'N/A'}</p>
              <p><span className="font-medium text-gray-900">Status:</span> {viewStudent.status || 'N/A'}</p>
              <p><span className="font-medium text-gray-900">Performance:</span> {viewStudent.performance || 'N/A'}</p>
            </div>
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Parent Information</h3>
              <p><span className="font-medium text-gray-900">Linked Parent:</span> {viewStudent.parentName || 'N/A'}</p>
              <div className="mt-4">
                <h4 className="text-md font-semibold text-gray-800 mb-2">Profile Image</h4>
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold">
                  {viewStudent.name?.charAt(0)?.toUpperCase() || 'S'}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : loading ? (
        <Loader label="Loading students..." />
      ) : error ? (
        <div className="text-red-500">{error}</div>
      ) : students.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-4 px-4 min-h-[360px]">
          {/* GIF Image Only - Perfectly Centered */}
          <img 
            src="/src/assets/img/nothing-archived-yet.png" 
            alt="Nothing Archived Yet" 
            className="max-w-2xl w-full h-auto"
          />
          {showArchived && (
            <button
              className="-mt-2 inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 underline underline-offset-2"
              onClick={() => setShowArchived(false)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              <span className="font-medium">Go back</span>
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.12)] p-2 sm:p-6">
          <div className="flex justify-between mb-4 items-center">
            <h2 className="text-2xl font-bold text-gray-800">Students</h2>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setShowArchived(s => !s)}
                className={`text-sm px-3 py-2 rounded-lg border shadow-sm transition-colors ${showArchived ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'}`}
                title={showArchived ? 'Show Active Students' : 'Show Archived Students'}
              >
                {showArchived ? 'Show Active' : 'Show Archived'}
              </button>
              <div className="relative">
              <select
                value={selectedGradeId}
                onChange={handleGradeChange}
                  className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-8 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm transition-all duration-150 hover:border-gray-400"
                disabled={loading}
              >
                <option value="all">All Grades</option>
                {grades.map((grade) => (
                  <option key={grade.id} value={grade.id}>
                    {grade.name}
                  </option>
                ))}
              </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-2">
                <span className="bg-gray-100 text-gray-700 p-2 rounded-full shadow flex items-center justify-center" title="Search">
                  <MagnifyingGlassIcon className="w-5 h-5" />
              </span>
                <div className="w-56">
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400"
                    placeholder="Search by name, LRN, or parent..."
                    value={searchValue}
                    onChange={e => setSearchValue(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="overflow-visible">
            <table className="min-w-full rounded-2xl">
              <thead>
                <tr className="bg-white shadow-sm rounded-t-2xl sticky top-0 z-10">
                  <th className="px-6 py-5 text-left text-sm font-bold text-gray-700 uppercase tracking-wider rounded-tl-2xl border-b border-gray-200">Name</th>
                  <th className="px-6 py-5 text-left text-sm font-bold text-gray-700 uppercase tracking-wider border-b border-gray-200">LRN</th>
                  <th className="px-6 py-5 text-left text-sm font-bold text-gray-700 uppercase tracking-wider border-b border-gray-200">Grade</th>
                  <th className="px-6 py-5 text-left text-sm font-bold text-gray-700 uppercase tracking-wider border-b border-gray-200">Parent</th>
                  <th className="px-6 py-5 text-center text-sm font-bold text-gray-700 uppercase tracking-wider border-b border-gray-200">Status</th>
                  <th className="px-6 py-5 text-right text-sm font-bold text-gray-700 uppercase tracking-wider border-b border-gray-200" colSpan={2}>
                    <div className="flex justify-end items-center gap-2">
                      <button
                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 p-2 rounded-full shadow flex items-center justify-center"
                        onClick={() => setFilterOpen(f => !f)}
                        title="Filter"
                      >
                        <FunnelIcon className="w-5 h-5" />
                      </button>
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
                            Newest Student
                          </button>
                          <button
                            className={`w-full text-left px-4 py-2 hover:bg-blue-50 ${filterType === 'oldest' ? 'font-bold text-blue-700' : ''}`}
                            onClick={() => { setFilterType('oldest'); setFilterOpen(false); }}
                          >
                            Oldest Student
                          </button>
                        </div>
                      )}
                      {/* Removed duplicate toggleable search; single search lives in header controls */}
                      <button
                        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-5 rounded-lg shadow transition-all duration-150"
                onClick={() => setEditModalOpen(true)}
              >
                        + Edit Students
              </button>
            </div>
                  </th>
                  </tr>
                </thead>
                <tbody>
                {displayedStudents.map((student) => (
                  <tr
                    key={student.studentId || student.id}
                    className="transition-all duration-200 hover:bg-blue-200/70 hover:shadow-2xl hover:-translate-y-1 hover:border-blue-400 border-b border-gray-100 last:border-b-0 group"
                  >
                    <td
                      className="px-6 py-6 whitespace-nowrap flex items-center gap-4 cursor-pointer"
                      onClick={() => setViewStudent(student)}
                    >
                      <span className="w-16 h-16 rounded-full bg-white border border-gray-200 shadow flex items-center justify-center overflow-hidden mr-2">
                        <div className="w-full h-full rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold">
                          {student.name?.charAt(0)?.toUpperCase() || 'S'}
                        </div>
                      </span>
                      <div className="flex flex-col">
                        <span className="font-extrabold text-lg text-gray-900">{student.name || 'N/A'}</span>
                        <span className="text-xs text-gray-400">{student.grade || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-6 whitespace-nowrap text-sm text-gray-700 align-middle cursor-pointer" onClick={() => setViewStudent(student)}>{student.lrn || 'N/A'}</td>
                    <td className="px-6 py-6 whitespace-nowrap text-sm text-gray-700 align-middle cursor-pointer" onClick={() => setViewStudent(student)}>{student.grade || 'N/A'}</td>
                    <td className="px-6 py-6 whitespace-nowrap text-sm text-gray-700 align-middle cursor-pointer" onClick={() => setViewStudent(student)}>{student.parentName || 'N/A'}</td>
                    <td className="px-6 py-6 whitespace-nowrap text-sm text-gray-700 text-center align-middle cursor-pointer" onClick={() => setViewStudent(student)}>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        student.status === 'active' ? 'bg-green-100 text-green-800' :
                        student.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {student.status || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-6 whitespace-nowrap text-right text-sm font-medium relative align-middle">
                      <Menu as="div" className="relative inline-block text-left">
                        <Menu.Button className="flex items-center p-2 rounded-full hover:bg-gray-100 focus:outline-none">
                          <EllipsisVerticalIcon className="w-5 h-5 text-gray-500" />
                        </Menu.Button>
                        <Menu.Items className="origin-top-right absolute right-0 mt-2 w-32 rounded-lg shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-10 p-1 flex flex-col gap-1">
                          <Menu.Item>
                            {({ active }) => (
                              <button
                                onClick={() => setViewStudent(student)}
                                className={`w-full text-left px-4 py-2 text-sm rounded-md transition-colors ${active ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
                              >
                                View
                              </button>
                            )}
                          </Menu.Item>
                          <Menu.Item>
                            {({ active }) => (
                              <button
                                onClick={() => setEditModalOpen(true)}
                                className={`w-full text-left px-4 py-2 text-sm rounded-md transition-colors ${active ? 'bg-green-50 text-green-700' : 'text-gray-700'}`}
                              >
                                Edit
                              </button>
                            )}
                          </Menu.Item>
                        {showArchived ? (
                            <Menu.Item>
                              {({ active }) => (
                          <button
                            onClick={async () => {
                              const sid = (student.id || student.studentId)!;
                              await StudentServiceModule.studentService.batchSetArchived([sid], false);
                              try {
                                const grade = grades.find(g => g.name === student.grade);
                                if (grade) {
                                  await gradeService.addStudentToGrade(grade.id!, sid);
                                  const updated = await gradeService.getStudentsInGrade(grade.id!);
                                  await gradeService.updateStudentCount(grade.id!, updated.length);
                                }
                              } catch {}
                              setStudents(prev => prev.filter(s => (s.id || s.studentId) !== (student.id || student.studentId)));
                            }}
                                  className={`w-full text-left px-4 py-2 text-sm rounded-md transition-colors ${active ? 'bg-green-50 text-green-700' : 'text-green-600'}`}
                          >
                                  Restore
                          </button>
                              )}
                            </Menu.Item>
                        ) : (
                          <>
                              <Menu.Item>
                                {({ active }) => (
                            <button
                              onClick={async () => {
                                const sid = (student.id || student.studentId)!;
                                      await StudentServiceModule.studentService.batchSetArchived([sid], true, true);
                                try {
                                  const grade = grades.find(g => g.name === student.grade);
                                  if (grade) {
                                    await gradeService.removeStudentFromGrade(grade.id!, sid);
                                    const updated = await gradeService.getStudentsInGrade(grade.id!);
                                    await gradeService.updateStudentCount(grade.id!, updated.length);
                                  }
                                } catch {}
                                setStudents(prev => prev.filter(s => (s.id || s.studentId) !== (student.id || student.studentId)));
                              }}
                                    className={`w-full text-left px-4 py-2 text-sm rounded-md transition-colors ${active ? 'bg-yellow-50 text-yellow-700' : 'text-yellow-600'}`}
                            >
                                    Archive
                            </button>
                                )}
                              </Menu.Item>
                            {userRole === 'admin' && (
                                <Menu.Item>
                                  {({ active }) => (
                              <button
                                onClick={() => handleDeleteStudent(student)}
                                      className={`w-full text-left px-4 py-2 text-sm rounded-md transition-colors ${active ? 'bg-red-50 text-red-700' : 'text-red-600'}`}
                              >
                                      Delete
                              </button>
                                  )}
                                </Menu.Item>
                            )}
                          </>
                        )}
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
      <EditStudentModal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        students={students}
        onDelete={handleDeleteStudent}
        parents={parents}
        onLinkParent={handleLinkParent}
        onUpdate={handleUpdateStudent}
        onUnlinkParent={handleUnlinkParent}
        deletingStudentId={deletingStudentId}
      />
    </div>
  );
};

const EditStudentModal: React.FC<{
  open: boolean;
  onClose: () => void;
  students: MergedStudent[];
  onDelete: (student: MergedStudent) => Promise<boolean>;
  parents: { id: string; displayName?: string; email?: string }[];
  onLinkParent: (student: MergedStudent, parentId: string) => void;
  onUpdate: (student: MergedStudent, updates: Partial<MergedStudent>) => void;
  onUnlinkParent: (student: MergedStudent) => void;
  deletingStudentId?: string | null;
}> = ({ open, onClose, students, onDelete, parents, onLinkParent, onUpdate, onUnlinkParent, deletingStudentId }) => {
  const [selectedStudent, setSelectedStudent] = useState<MergedStudent | null>(null);
  const [showParentDropdown, setShowParentDropdown] = useState(false);
  const [selectedParentId, setSelectedParentId] = useState<string>('');
  const [editFields, setEditFields] = useState<{ [id: string]: Partial<MergedStudent> }>({});
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const [linkSuccess, setLinkSuccess] = useState(false);
  const [parentSearch, setParentSearch] = useState('');

  useEffect(() => {
    if (open) {
      document.body.classList.add('overflow-hidden');
    } else {
      document.body.classList.remove('overflow-hidden');
      setDeleteSuccess(false); // Reset success banner when modal closes
    }
    return () => {
      document.body.classList.remove('overflow-hidden');
    };
  }, [open]);

  // Wrap onDelete to show success banner
  const handleDelete = async (student: MergedStudent) => {
    const result = await onDelete(student);
    // Only show success if delete was actually confirmed
    if (result) {
    setDeleteSuccess(true);
    setTimeout(() => setDeleteSuccess(false), 2000);
    }
  };

  // Helper: Get students linked to a parent
  const getLinkedStudents = (parentId: string) =>
    students.filter(s => s.parentId === parentId).map(s => s.name).join(', ');

  // Local handler for linking parent
  const handleLinkParent = () => {
    if (selectedStudent && selectedParentId) {
      onLinkParent(selectedStudent, selectedParentId);
      setLinkSuccess(true);
      setTimeout(() => setLinkSuccess(false), 2000);
      setShowParentDropdown(false);
      setSelectedParentId('');
      setParentSearch('');
    }
  };

  if (!open) return null;
  return ReactDOM.createPortal(
    <>
      {/* Backdrop Overlay: z-1050 (below SweetAlert2) */}
      <div
        className="fixed inset-0 bg-black bg-opacity-40 z-[1050]"
        aria-hidden="true"
        onClick={onClose}
      />
      {/* Modal Content: z-1051 (below SweetAlert2) */}
      <div className="fixed inset-0 z-[1051] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[80vh] p-6 flex flex-col">
          {deleteSuccess && (
            <div className="mb-4 p-2 bg-gray-100 text-gray-700 rounded text-center font-medium border border-gray-300">
              Student removed successfully
            </div>
          )}
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-800">Edit Students</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">Grade</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">Linked Parent</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
                <tbody className="divide-y divide-gray-200">
                {students.map(student => {
                  const id = student.studentId || student.id || '';
                  const fields = editFields[id] || {};
                  return (
                      <tr key={id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
                              {student.name?.charAt(0)?.toUpperCase() || 'S'}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">{student.name}</div>
                              <div className="text-xs text-gray-500">{student.lrn || 'No LRN'}</div>
                            </div>
                          </div>
                      </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                            {student.grade}
                          </span>
                      </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                        <select
                            className="block w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                          value={fields.status ?? student.status}
                          onChange={e => setEditFields(f => ({ ...f, [id]: { ...f[id], status: e.target.value as any } }))}
                        >
                            <option value="active">Active</option>
                            <option value="pending">Pending</option>
                            <option value="inactive">Inactive</option>
                        </select>
                      </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          <div className="flex items-center gap-2">
                            <span>{student.parentName || 'No parent linked'}</span>
                        {student.parentName && (
                          <button
                                className="text-xs text-red-600 hover:text-red-800 hover:underline font-medium"
                            onClick={() => onUnlinkParent(student)}
                          >
                            Unlink
                          </button>
                        )}
                          </div>
                      </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center gap-2">
                        <button
                              className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          onClick={() => onUpdate(student, fields)}
                          disabled={Object.keys(fields).length === 0}
                        >
                          Save
                        </button>
                        <button
                              className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          onClick={() => handleDelete(student)}
                          disabled={deletingStudentId === (student.studentId || student.id)}
                        >
                          {deletingStudentId === (student.studentId || student.id) ? 'Deleting...' : 'Delete'}
                        </button>
                        <button
                              className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          onClick={() => {
                            setSelectedStudent(student);
                            setShowParentDropdown(true);
                          }}
                        >
                          {student.parentName ? 'Change Parent' : 'Link Parent'}
                        </button>
                          </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
          {showParentDropdown && selectedStudent && (
            <div className="mb-4 p-6 bg-white rounded-2xl shadow-lg border border-gray-200 max-w-lg mx-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Link Parent to {selectedStudent.name}</h3>
                <button
                  onClick={() => {
                    setShowParentDropdown(false);
                    setSelectedParentId('');
                    setParentSearch('');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Search Parent</label>
              <input
                type="text"
                    className="block w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Search by name or email..."
                value={parentSearch}
                onChange={e => setParentSearch(e.target.value)}
              />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Parent</label>
              <select
                    className="block w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                value={selectedParentId}
                onChange={e => setSelectedParentId(e.target.value)}
              >
                <option value="">-- Select Parent --</option>
                {parents
                  .filter(parent =>
                    (parent.displayName || '').toLowerCase().includes(parentSearch.toLowerCase()) ||
                    (parent.email || '').toLowerCase().includes(parentSearch.toLowerCase())
                  )
                  .map(parent => (
                    <option key={parent.id} value={parent.id}>
                      {parent.displayName || parent.email || parent.id}
                      {parent.email ? ` (${parent.email})` : ''}
                    </option>
                  ))}
              </select>
                </div>
                
              {selectedParentId && (
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <div className="text-sm text-blue-800">
                  <span className="font-medium">Already linked students:</span> {getLinkedStudents(selectedParentId) || 'None'}
                    </div>
                </div>
              )}
                
                <div className="flex items-center justify-end gap-3 pt-4">
                <button
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                  onClick={() => {
                    setShowParentDropdown(false);
                    setSelectedParentId('');
                    setParentSearch('');
                  }}
                >
                  Cancel
                </button>
                  <button
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleLinkParent}
                    disabled={!selectedParentId}
                  >
                    Link Parent
                </button>
              </div>
                
              {linkSuccess && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="text-sm text-green-800 font-medium text-center">
                  Parent linked successfully!
                </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>,
    document.body
  );
};

export default Students; 