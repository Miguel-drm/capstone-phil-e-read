import React, { useState, useEffect, useCallback } from 'react';
import Swal from 'sweetalert2';
import { useAuth } from '../../contexts/AuthContext';
import { gradeService, type ClassGrade } from '../../services/gradeService';
import { studentService, type Student } from '../../services/studentService';
import { readingSessionService, type ReadingSession } from '../../services/readingSessionService';
import { resultService, type Result } from '../../services/resultsService';
import { UnifiedStoryService } from '../../services/UnifiedStoryService';
import type { Story } from '../../types/Story';
import { useNavigate } from 'react-router-dom';
import Loader from '../../components/Loader';


const Reading: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'sessions' | 'stories'>('sessions');
  const [grades, setGrades] = useState<ClassGrade[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [readingSessions, setReadingSessions] = useState<ReadingSession[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [storiesLoading, setStoriesLoading] = useState(true);
  const [storiesError, setStoriesError] = useState<string | null>(null);
  const [sessionResults, setSessionResults] = useState<Map<string, Result[]>>(new Map());

  const loadSessions = useCallback(async () => {
    if (!currentUser?.uid) return;
    try {
      const sessions = await readingSessionService.getTeacherSessions(currentUser.uid);
      setReadingSessions(sessions);
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
  }, [currentUser?.uid]);

  const loadStories = useCallback(async () => {
    try {
      setStoriesLoading(true);
      setStoriesError(null);
      const fetchedStories = await UnifiedStoryService.getInstance().getStories({}); // Fetch all stories initially
      // Map IStory[] to Story[] to ensure type compatibility
      setStories(fetchedStories.map(story => ({
        ...story,
        _id: story._id?.toString(),
        createdBy: story.createdBy?.toString?.() ?? story.createdBy,
        language: story.language as 'english' | 'tagalog',
      })));
    } catch (error) {
      console.error('Error loading stories:', error);
      setStoriesError('Failed to load stories. Please try again.');
      Swal.fire('Error', 'Failed to load stories', 'error');
    } finally {
      setStoriesLoading(false);
    }
  }, []);

  const loadGrades = useCallback(async () => {
    try {
      const gradesData = await gradeService.getActiveGrades();
      setGrades(gradesData);
    } catch (error) {
      console.error('Error loading grades:', error);
    }
  }, []);

  const loadStudents = useCallback(async () => {
    if (!currentUser?.uid) return;
    try {
      const fetchedStudents = await studentService.getStudents(currentUser.uid);
      setStudents(fetchedStudents);
    } catch (error) {
      console.error('Error loading students:', error);
    }
  }, [currentUser?.uid]);

  const loadSessionResults = useCallback(async () => {
    if (!currentUser?.uid || readingSessions.length === 0) return;
    try {
      const resultsMap = new Map<string, Result[]>();
      
      // Load results for each session
      for (const session of readingSessions) {
        if (session.id) {
          try {
            const results = await resultService.getReadingSessionResults(session.id);
            resultsMap.set(session.id, results);
          } catch (error) {
            console.error(`Error loading results for session ${session.id}:`, error);
            resultsMap.set(session.id, []);
          }
        }
      }
      
      setSessionResults(resultsMap);
    } catch (error) {
      console.error('Error loading session results:', error);
    }
  }, [currentUser?.uid, readingSessions]);

  // Load grades, students, and sessions on component mount
  useEffect(() => {
    if (currentUser?.uid) {
      loadGrades();
      loadStudents();
      loadSessions();
      loadStories();
    }
  }, [currentUser?.uid, loadGrades, loadStudents, loadSessions, loadStories]);

  // Load session results when sessions change
  useEffect(() => {
    if (readingSessions.length > 0) {
      loadSessionResults();
    }
  }, [readingSessions, loadSessionResults]);

  const loadStudentsByGrade = async (gradeId: string) => {
    try {
      const studentsInGrade = await gradeService.getStudentsInGrade(gradeId);
      const studentIds = studentsInGrade.map(s => s.studentId);
      const gradeStudents = students.filter(student => studentIds.includes(student.id || ''));
      return gradeStudents;
    } catch (error) {
      console.error('Error loading students for grade:', error);
      return [];
    }
  };

  const handleScheduleSession = async () => {
    try {
      const { value: formValues } = await Swal.fire({
        title: 'Reading Session',
        html: `
          <div class="flex gap-6 p-4">
            <!-- Left side - Form (50% width) -->
            <div class="w-1/2 text-left">
            <div class="mb-6">
              <label class="block text-sm font-medium text-gray-700 mb-2">Session Title</label>
              <input 
                id="session-title" 
                class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                placeholder="e.g., Group A - Level 2 Reading"
              >
            </div>
            <div class="mb-6">
              <label class="block text-sm font-medium text-gray-700 mb-2">Select Story</label>
              <select 
                id="session-story" 
                class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select a story</option>
                ${stories.map(story => `
                  <option value="${story.title}" data-url="${story.pdfUrl}">${story.title}</option>
                `).join('')}
              </select>
            </div>
            <div class="mb-6">
              <label class="block text-sm font-medium text-gray-700 mb-2">Class/Grade</label>
              <select 
                id="session-grade" 
                class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select a class</option>
                ${grades.map(grade => `
                  <option value="${grade.id}">${grade.name}</option>
                `).join('')}
              </select>
            </div>
            </div>
            
            <!-- Right side - Students (50% width) -->
            <div class="w-1/2">
              <h3 class="text-lg font-semibold text-gray-700 mb-4">Grade and section</h3>
              <div id="student-display" class="space-y-4">
                <p class="text-sm text-gray-500 italic text-center">Select a class to view students</p>
              </div>
            </div>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Start Session',
        cancelButtonText: 'Cancel',
        focusConfirm: false,
        backdrop: 'rgba(0,0,0,0.6)',
        customClass: {
          popup: 'rounded-lg shadow-xl w-full max-w-6xl',
          title: 'text-xl font-semibold text-gray-900',
          confirmButton: 'bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md',
          cancelButton: 'bg-white hover:bg-gray-50 text-gray-700 font-medium py-2 px-4 rounded-md border border-gray-300'
        },
        didOpen: () => {
          const gradeSelect = document.getElementById('session-grade') as HTMLSelectElement;
          const studentDisplay = document.getElementById('student-display') as HTMLDivElement;
          
          if (gradeSelect && studentDisplay) {
            gradeSelect.addEventListener('change', async (e) => {
              const gradeId = (e.target as HTMLSelectElement).value;
              if (gradeId) {
                const gradeStudents = await loadStudentsByGrade(gradeId);
                
                if (gradeStudents.length > 0) {
                  // Display students as individual buttons in vertical list
                  studentDisplay.innerHTML = `
                    <div class="space-y-2">
                      ${gradeStudents.map(student => `
                        <div class="w-full px-3 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium text-center cursor-default">
                          ${student.name}
                        </div>
                      `).join('')}
                    </div>
                    <div class="mt-3 text-xs text-gray-600 font-medium text-center">
                      Total: ${gradeStudents.length} student${gradeStudents.length !== 1 ? 's' : ''}
                        </div>
                  `;
                } else {
                  studentDisplay.innerHTML = '<p class="text-sm text-gray-500 italic">No students in this class</p>';
                }
              } else {
                studentDisplay.innerHTML = '<p class="text-sm text-gray-500 italic">Select a class to view students</p>';
              }
            });
          }
        },
        preConfirm: () => {
          const title = (document.getElementById('session-title') as HTMLInputElement).value;
          const storySelect = document.getElementById('session-story') as HTMLSelectElement;
          const book = storySelect.value;
          const storyUrl = storySelect.options[storySelect.selectedIndex].getAttribute('data-url') || '';
          const gradeId = (document.getElementById('session-grade') as HTMLSelectElement).value;

          if (!title || !book || !gradeId) {
            Swal.showValidationMessage('Please fill in all required fields');
            return false;
          }

          // Get all students from the selected class by loading them again
          // This ensures we have the most up-to-date student list
          return loadStudentsByGrade(gradeId).then(gradeStudents => {
            const allStudents = gradeStudents.map(student => student.name);

          return {
            title,
            book,
            storyUrl,
            gradeId,
              students: allStudents, // Include all students from the class
            status: 'pending' as const,
            teacherId: currentUser?.uid
          };
          });
        }
      });

      if (formValues && currentUser?.uid) {
        try {
          const sessionData = {
            ...formValues,
            teacherId: currentUser.uid,
            status: 'pending' as const
          };

          const sessionId = await readingSessionService.createSession(sessionData);
          const newSession = {
            id: sessionId,
            ...sessionData,
            createdAt: new Date()
          };

          setReadingSessions(prev => [...prev, newSession]);

          await Swal.fire({
            icon: 'success',
            title: 'Session Created!',
            text: 'The reading session has been created successfully.',
            timer: 2000,
            showConfirmButton: false
          });
        } catch (error) {
          console.error('Error creating session:', error);
          await Swal.fire({
            icon: 'error',
            title: 'Permission Error',
            text: 'You may not have permission to create reading sessions. Please check your role and try again.',
          });
        }
      }
    } catch (error) {
      console.error('Error in handleScheduleSession:', error);
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'An unexpected error occurred. Please try again.',
      });
    }
  };


  const handleViewStoryDetails = async (story: Story) => {
    await Swal.fire({
      title: story.title,
      html: `
        <div class="text-left">
        <div class="mb-4">
          <h3 class="text-sm font-semibold text-gray-600 mb-1">Language</h3>
          <p class="text-gray-800">${story.language || 'Not specified'}</p>
        </div>
          <div class="mb-4">
            <h3 class="text-sm font-semibold text-gray-600 mb-1">Description</h3>
            <p class="text-gray-800">${story.description || 'No description available'}</p>
          </div>
          <div class="mt-6">
            ${story.pdfUrl ? `
              <div class="space-y-3">
                <a href="${story.pdfUrl}" 
                   target="_blank" 
                   class="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
                   onclick="setTimeout(() => { window.close(); }, 1000);"
                >
                  <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  View PDF
                </a>
                <p class="text-xs text-gray-500 italic">
                  PDF may not be available. The story text content is available in the reading session.
                </p>
              </div>
            ` : '<p class="text-red-500">No PDF available</p>'}
          </div>
        </div>
      `,
      showCloseButton: true,
      showConfirmButton: false,
      width: '32rem',
      customClass: {
        container: 'story-details-modal',
        popup: 'rounded-lg shadow-xl',
        htmlContainer: 'p-6'
      }
    });
  };

  // Student card handlers
  const handleStudentProceed = (studentId: string, studentName: string, sessionId: string) => {
    // Navigate to reading session page
    navigate(`/teacher/reading-session/${sessionId}`, {
      state: {
        studentId,
        studentName,
        teacherId: currentUser?.uid
      }
    });
  };

  const handleStudentEdit = async (studentId: string, studentName: string) => {
    try {
      // Get the current student data
      const student = await studentService.getStudent(studentId);
      if (!student) {
        await Swal.fire('Error', 'Student not found', 'error');
        return;
      }

      // Show edit form using SweetAlert2
      const { value: formValues } = await Swal.fire({
        title: 'Edit Student',
        html: `
          <div class="text-left space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Student Name</label>
              <input 
                id="edit-name" 
                class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                value="${student.name}"
                placeholder="Enter student name"
              >
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Grade</label>
              <select 
                id="edit-grade" 
                class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select a grade</option>
                ${grades.map(grade => `
                  <option value="${grade.name}" ${grade.name === student.grade ? 'selected' : ''}>${grade.name}</option>
                `).join('')}
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Reading Level</label>
              <select 
                id="edit-reading-level" 
                class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="Beginner" ${student.readingLevel === 'Beginner' ? 'selected' : ''}>Beginner</option>
                <option value="Intermediate" ${student.readingLevel === 'Intermediate' ? 'selected' : ''}>Intermediate</option>
                <option value="Advanced" ${student.readingLevel === 'Advanced' ? 'selected' : ''}>Advanced</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Performance</label>
              <select 
                id="edit-performance" 
                class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="Excellent" ${student.performance === 'Excellent' ? 'selected' : ''}>Excellent</option>
                <option value="Good" ${student.performance === 'Good' ? 'selected' : ''}>Good</option>
                <option value="Needs Improvement" ${student.performance === 'Needs Improvement' ? 'selected' : ''}>Needs Improvement</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select 
                id="edit-status" 
                class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="active" ${student.status === 'active' ? 'selected' : ''}>Active</option>
                <option value="pending" ${student.status === 'pending' ? 'selected' : ''}>Pending</option>
                <option value="inactive" ${student.status === 'inactive' ? 'selected' : ''}>Inactive</option>
              </select>
            </div>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Update Student',
        cancelButtonText: 'Cancel',
        focusConfirm: false,
        backdrop: 'rgba(0,0,0,0.6)',
        customClass: {
          popup: 'rounded-lg shadow-xl w-full max-w-md',
          title: 'text-xl font-semibold text-gray-900',
          confirmButton: 'bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md',
          cancelButton: 'bg-white hover:bg-gray-50 text-gray-700 font-medium py-2 px-4 rounded-md border border-gray-300'
        },
        preConfirm: () => {
          const name = (document.getElementById('edit-name') as HTMLInputElement).value;
          const grade = (document.getElementById('edit-grade') as HTMLSelectElement).value;
          const readingLevel = (document.getElementById('edit-reading-level') as HTMLSelectElement).value;
          const performance = (document.getElementById('edit-performance') as HTMLSelectElement).value;
          const status = (document.getElementById('edit-status') as HTMLSelectElement).value;

          if (!name || !grade || !readingLevel || !performance || !status) {
            Swal.showValidationMessage('Please fill in all fields');
            return false;
          }

          return {
            name,
            grade,
            readingLevel,
            performance,
            status
          };
        }
      });

      if (formValues) {
        // Update the student
        await studentService.updateStudent(studentId, formValues);
        
        // Reload students to reflect changes
        await loadStudents();
        
        await Swal.fire({
          icon: 'success',
          title: 'Student Updated!',
          text: `${studentName} has been updated successfully.`,
          timer: 2000,
          showConfirmButton: false
        });
      }
    } catch (error) {
      console.error('Error editing student:', error);
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to update student. Please try again.',
      });
    }
  };

  const handleStudentDelete = async (studentName: string, sessionId: string) => {
    try {
      // Show confirmation dialog
      const result = await Swal.fire({
        title: 'Remove Student from Session',
        text: `Are you sure you want to remove ${studentName} from this reading session? This will not delete the student from your class list.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Yes, remove from session!',
        cancelButtonText: 'Cancel',
        backdrop: 'rgba(0,0,0,0.6)',
        customClass: {
          popup: 'rounded-lg shadow-xl',
          title: 'text-xl font-semibold text-gray-900',
          confirmButton: 'bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-md',
          cancelButton: 'bg-white hover:bg-gray-50 text-gray-700 font-medium py-2 px-4 rounded-md border border-gray-300'
        }
      });

      if (result.isConfirmed) {
        // Show loading
        Swal.fire({
          title: 'Removing...',
          text: 'Please wait while we remove the student from the session.',
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          }
        });

        // Remove the student from the session only
        await readingSessionService.removeStudentFromSession(sessionId, studentName);
        
        // Reload sessions to reflect changes
        await loadSessions();
        
        await Swal.fire({
          icon: 'success',
          title: 'Student Removed!',
          text: `${studentName} has been removed from this reading session.`,
          timer: 2000,
          showConfirmButton: false
        });
      }
    } catch (error) {
      console.error('Error removing student from session:', error);
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error instanceof Error ? error.message : 'Failed to remove student from session. Please try again.',
      });
    }
  };

  // Student Card Component
  const StudentCard: React.FC<{
    student: { id: string; name: string };
    status: 'pending' | 'completed';
    onProceed: () => void;
    onEdit: () => void;
    onDelete: () => void;
  }> = ({ student, status, onProceed, onEdit, onDelete }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
      <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center">
              <i className="fas fa-user text-gray-600 text-xs"></i>
            </div>
            <span className="text-sm font-medium text-gray-800">{student.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
              status === 'completed' 
                ? 'bg-green-100 text-green-800' 
                : 'bg-yellow-100 text-yellow-800'
            }`}>
              {status === 'completed' ? 'Completed' : 'Pending'}
            </span>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-gray-400 hover:text-gray-600"
            >
              <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'} text-xs`}></i>
            </button>
          </div>
        </div>
        
        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <button
                onClick={onProceed}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                <i className="fas fa-play text-xs"></i>
                Proceed
              </button>
              <button
                onClick={onEdit}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-yellow-500 text-white rounded hover:bg-yellow-600"
              >
                <i className="fas fa-edit text-xs"></i>
                Edit
              </button>
              <button
                onClick={onDelete}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
              >
                <i className="fas fa-trash text-xs"></i>
                Delete
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center py-2\ sm:py-6">
      <div className="w-full px-2 sm:px-4 md:px-6 lg:px-8 bg-white/90 rounded-2xl shadow-lg p-4 sm:p-8 border border-blue-100">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 border-b border-blue-100 pb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-blue-900 tracking-tight flex items-center gap-2">
              <i className="fas fa-book-reader text-blue-400"></i> Reading
            </h1>
            <p className="mt-1 text-sm text-gray-500">Manage reading sessions and explore stories</p>
          </div>
          <button
            onClick={handleScheduleSession}
            className="w-full sm:w-auto bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-semibold py-2 px-6 rounded-lg shadow transition-all duration-200 flex items-center justify-center text-base gap-2"
          >
            <i className="fas fa-plus"></i>
            Start New Session
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-blue-100 mb-8">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('sessions')}
              className={`py-3 px-1 border-b-2 font-semibold text-sm transition-all duration-150 ${activeTab === 'sessions'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-blue-700 hover:border-blue-300'
                }`}
            >
              Active Sessions
            </button>
            <button
              onClick={() => setActiveTab('stories')}
              className={`py-3 px-1 border-b-2 font-semibold text-sm transition-all duration-150 ${activeTab === 'stories'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-blue-700 hover:border-blue-300'
                }`}
            >
              Stories
            </button>
          </nav>
        </div>

        {/* Content */}
        {activeTab === 'sessions' && (
          <div className="space-y-6">
            {readingSessions.length === 0 ? (
              <div className="text-center py-10 text-gray-400 italic">No sessions found. Click + to add a session.</div>
            ) : (
              readingSessions.map((session) => {
                // Get students for this session
                const sessionStudents = session.students.map((studentName: string) => {
                  const student = students.find(s => s.name === studentName);
                  return {
                    id: student?.id || studentName,
                    name: student?.name || studentName
                  };
                });

                // Get results for this session
                const sessionResultsData = sessionResults.get(session.id || '') || [];
                
                // Split students into pending and completed based on real data
                const completedStudentIds = new Set(
                  sessionResultsData
                    .filter(result => result.type === 'reading-session' && result.studentId)
                    .map(result => result.studentId!)
                );

                const pendingStudents = sessionStudents.filter(student => 
                  !completedStudentIds.has(student.id)
                );
                const completedStudents = sessionStudents.filter(student => 
                  completedStudentIds.has(student.id)
                );

                return (
                <div
                  key={session.id}
                    className="bg-blue-100 rounded-2xl p-6 shadow-lg border border-blue-200"
                  >
                    {/* Grade Header */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                        <i className="fas fa-graduation-cap text-white text-sm"></i>
                      </div>
                      <h3 className="text-lg font-semibold text-blue-900">{session.title}</h3>
                      <span className="text-sm text-blue-600 bg-blue-200 px-2 py-1 rounded-full">
                        {session.book}
                    </span>
                    </div>

                    {/* Two Column Layout */}
                    <div className="grid grid-cols-2 gap-6">
                      {/* Left Column - Pending Students */}
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                          <span className="w-3 h-3 bg-yellow-400 rounded-full"></span>
                          Pending ({pendingStudents.length})
                        </h4>
                        <div className="space-y-2">
                          {pendingStudents.map((student, studentIdx) => (
                            <StudentCard
                              key={student.id || studentIdx}
                              student={student}
                              status="pending"
                              onProceed={() => handleStudentProceed(student.id, student.name, session.id || '')}
                              onEdit={() => handleStudentEdit(student.id, student.name)}
                              onDelete={() => handleStudentDelete(student.name, session.id || '')}
                            />
                          ))}
                    </div>
                  </div>

                      {/* Right Column - Completed Students */}
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                          <span className="w-3 h-3 bg-green-400 rounded-full"></span>
                          Completed ({completedStudents.length})
                        </h4>
                        <div className="space-y-2">
                          {completedStudents.map((student, studentIdx) => (
                            <StudentCard
                              key={student.id || studentIdx}
                              student={student}
                              status="completed"
                              onProceed={() => handleStudentProceed(student.id, student.name, session.id || '')}
                              onEdit={() => handleStudentEdit(student.id, student.name)}
                              onDelete={() => handleStudentDelete(student.name, session.id || '')}
                            />
                          ))}
                  </div>
                    </div>
                  </div>
                </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'stories' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 md:gap-6">
            {storiesLoading ? (
              <Loader label="Loading stories..." />
            ) : storiesError ? (
              <div className="col-span-full text-center py-10 text-red-500">{storiesError}</div>
            ) : stories.length === 0 ? (
              <div className="col-span-full text-center py-10 text-gray-500">No stories available.</div>
            ) : (
              stories.map((story) => (
                <div key={story._id} className="bg-white rounded-xl shadow-md border border-blue-50 overflow-hidden flex flex-col h-full">
                  <div className="relative pb-[56.25%] bg-blue-100 flex items-center justify-center">
                    {/* You might want to add a placeholder or actual cover image logic here if stories have one */}
                    <div className="absolute inset-0 flex items-center justify-center text-blue-300 text-lg">
                      No Image
                    </div>
                  </div>
                  <div className="p-4 flex-grow flex flex-col">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-semibold text-blue-900 line-clamp-1">{story.title}</h3>
                    </div>
                    <p className="text-sm text-gray-500 mb-4 line-clamp-2">
                      {story.description || 'No description available'}
                    </p>
                    <div className="flex items-center justify-between mt-auto">
                      <button
                        onClick={() => handleViewStoryDetails(story)}
                        className="inline-flex items-center text-blue-600 hover:text-white hover:bg-blue-500 px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                      >
                        <span>View Details</span>
                        <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Reading;