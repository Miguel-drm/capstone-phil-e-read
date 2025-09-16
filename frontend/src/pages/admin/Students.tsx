import React, { useEffect, useState } from 'react';
import * as StudentServiceModule from '../../services/studentService'; // Import as a namespace
import { gradeService, type ClassGrade } from '../../services/gradeService';
import { PencilSquareIcon } from '@heroicons/react/24/solid';
import type { Student } from '../../services/studentService';
import ReactDOM from 'react-dom';
import Loader from '../../components/Loader';

// Add this type for merged student data
export type MergedStudent = Student & { studentId?: string };

const Students: React.FC = () => {
  const [students, setStudents] = useState<MergedStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [grades, setGrades] = useState<ClassGrade[]>([]);
  const [selectedGradeId, setSelectedGradeId] = useState<string | 'all' | ''>('all');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [parents, setParents] = useState<{ id: string; displayName?: string; email?: string }[]>([]);
  const [deletingStudentId, setDeletingStudentId] = useState<string | null>(null);

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      setError(null);
      try {
        const allGrades = await gradeService.getAllClassGrades();
        setGrades(allGrades);

        if (selectedGradeId === 'all') {
          const allStudents = await StudentServiceModule.studentService.getAllStudents();
          setStudents(allStudents.map(s => ({ ...s })) as MergedStudent[]);
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
          const filtered = allStudents.filter(s => s.grade === gradeName);
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
  }, [selectedGradeId]);

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
    setDeletingStudentId(student.studentId ?? student.id ?? '');
    await StudentServiceModule.studentService.deleteStudent((student.studentId ?? student.id ?? ''));
    setStudents(prev => prev.filter(s => (s.studentId || s.id) !== (student.studentId || student.id)));
    setDeletingStudentId(null);
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1920px] mx-auto px-2 sm:px-4 lg:px-6 py-4">
        <div className="bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.12)] p-2 sm:p-6">
          <div className="flex justify-between mb-4 items-center">
            <h2 className="text-2xl font-bold text-gray-800">Grades and Sections</h2>
            <div className="flex items-center space-x-4">
              <select
                value={selectedGradeId}
                onChange={handleGradeChange}
                className="border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                disabled={loading}
              >
                <option value="all">All Grades</option>
                {grades.map((grade) => (
                  <option key={grade.id} value={grade.id}>
                    {grade.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 p-2 rounded-full shadow flex items-center justify-center"
                aria-label="Edit Students"
                onClick={() => setEditModalOpen(true)}
              >
                <PencilSquareIcon className="w-5 h-5" />
              </button>
              <span className="px-2 py-1 text-sm font-medium text-gray-600 bg-gray-100 rounded-full">
                {students.length} students
              </span>
            </div>
          </div>
          <div className="overflow-visible">
            {loading ? (
              <Loader label="Loading students..." />
            ) : error ? (
              <div className="text-red-500 p-8">{error}</div>
            ) : students.length > 0 ? (
              <table className="min-w-full mt-2 bg-white border border-gray-200 rounded-lg">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student ID</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Grade</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Linked Parent</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Performance</th>
                  </tr>
                </thead>
                <tbody>
                  {(students as MergedStudent[]).map((student) => {
                    const sid = student.studentId;
                    return (
                      <tr key={sid || student.id} className="hover:bg-blue-50">
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{student.name}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{sid || student.id}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{student.grade}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{student.parentName || '-'}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{student.status}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{student.performance}</td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="text-gray-500 p-8">No students found for this grade/section.</div>
            )}
          </div>
        </div>
      </div>
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
  onDelete: (student: MergedStudent) => void;
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
    await onDelete(student);
    setDeleteSuccess(true);
    setTimeout(() => setDeleteSuccess(false), 2000);
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
      {/* Backdrop Overlay: z-10500 (well below toast, above sidebar/header) */}
      <div
        className="fixed inset-0 bg-black bg-opacity-40 z-[10500]"
        aria-hidden="true"
        onClick={onClose}
      />
      {/* Modal Content: z-11001 (above toast and overlay) */}
      <div className="fixed inset-0 z-[11001] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[80vh] p-6 flex flex-col">
          {deleteSuccess && (
            <div className="mb-4 p-2 bg-green-100 text-green-800 rounded text-center font-medium">
              Student deleted successfully!
            </div>
          )}
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-800">Edit Students</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <table className="min-w-full mb-4">
              <thead>
                <tr>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Grade</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Linked Parent</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map(student => {
                  const id = student.studentId || student.id || '';
                  const fields = editFields[id] || {};
                  return (
                    <tr key={id}>
                      <td className="px-2 py-2 text-sm text-gray-900">
                        <span>{student.name}</span>
                      </td>
                      <td className="px-2 py-2 text-sm text-gray-900">
                        <span>{student.grade}</span>
                      </td>
                      <td className="px-2 py-2 text-sm text-gray-900">
                        <select
                          className="border border-gray-300 rounded px-2 py-1"
                          value={fields.status ?? student.status}
                          onChange={e => setEditFields(f => ({ ...f, [id]: { ...f[id], status: e.target.value as any } }))}
                        >
                          <option value="active">active</option>
                          <option value="pending">pending</option>
                          <option value="inactive">inactive</option>
                        </select>
                      </td>
                      <td className="px-2 py-2 text-sm text-gray-900">
                        {student.parentName || '-'}
                        {student.parentName && (
                          <button
                            className="ml-2 text-xs text-red-600 hover:underline"
                            onClick={() => onUnlinkParent(student)}
                          >
                            Unlink
                          </button>
                        )}
                      </td>
                      <td className="px-2 py-2 text-sm text-gray-900 flex gap-2">
                        <button
                          className="bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200"
                          onClick={() => onUpdate(student, fields)}
                          disabled={Object.keys(fields).length === 0}
                        >
                          Save
                        </button>
                        <button
                          className="bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200"
                          onClick={() => handleDelete(student)}
                          disabled={deletingStudentId === (student.studentId || student.id)}
                        >
                          {deletingStudentId === (student.studentId || student.id) ? 'Deleting...' : 'Delete'}
                        </button>
                        <button
                          className="bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
                          onClick={() => {
                            setSelectedStudent(student);
                            setShowParentDropdown(true);
                          }}
                        >
                          {student.parentName ? 'Change Parent' : 'Link Parent'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {showParentDropdown && selectedStudent && (
            <div className="mb-4 p-4 bg-gray-50 rounded shadow-md max-w-md mx-auto">
              <label className="block mb-1 text-sm font-medium text-gray-700">Select Parent</label>
              <input
                type="text"
                className="border border-gray-300 rounded px-2 py-1 mb-2 w-full"
                placeholder="Search parent by name or email..."
                value={parentSearch}
                onChange={e => setParentSearch(e.target.value)}
              />
              <select
                className="border border-gray-300 rounded px-2 py-1 w-full"
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
              {selectedParentId && (
                <div className="text-xs text-gray-600 mt-2">
                  <span className="font-medium">Already linked students:</span> {getLinkedStudents(selectedParentId) || 'None'}
                </div>
              )}
              <div className="mt-3 flex items-center gap-2">
                <button
                  className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 disabled:opacity-50"
                  onClick={handleLinkParent}
                  disabled={!selectedParentId}
                >
                  Link
                </button>
                <button
                  className="text-gray-500 hover:text-gray-700"
                  onClick={() => {
                    setShowParentDropdown(false);
                    setSelectedParentId('');
                    setParentSearch('');
                  }}
                >
                  Cancel
                </button>
              </div>
              {linkSuccess && (
                <div className="mt-2 p-2 bg-green-100 text-green-800 rounded text-center font-medium">
                  Parent linked successfully!
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>,
    document.body
  );
};

export default Students; 