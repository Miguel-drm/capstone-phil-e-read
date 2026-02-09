import React, { useState, useEffect, useCallback } from 'react';
import Swal from 'sweetalert2';
import { useAuth } from '../../contexts/AuthContext';
import { gradeService, type ClassGrade } from '../../services/gradeService';
import { studentService, type Student } from '../../services/studentService';
import { readingSessionService, type ReadingSession } from '../../services/readingSessionService';
import { UnifiedStoryService } from '../../services/UnifiedStoryService';
import { getUserProfile } from '../../services/authService';
import type { Story } from '../../types/Story';
import { useNavigate } from 'react-router-dom';
import TeacherLoader from '../../components/teacher/TeacherLoader';


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
  const [teacherGradeLevel, setTeacherGradeLevel] = useState<string | null>(null);
  const [sessionResults, setSessionResults] = useState<Map<string, any[]>>(new Map());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedStoryFilter, setSelectedStoryFilter] = useState<string>('all');
  
  // Multi-delete state
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  const loadSessions = useCallback(async () => {
    if (!currentUser?.uid) return;
    try {
      console.log('🔍 Loading sessions for teacher:', currentUser.uid);
      const sessions = await readingSessionService.getTeacherSessions(currentUser.uid);
      console.log('📚 Loaded sessions:', sessions.length);
      console.log('Sessions details:', sessions.map(s => ({ 
        id: s.id, 
        title: s.title, 
        teacherId: s.teacherId,
        matchesCurrentTeacher: s.teacherId === currentUser.uid 
      })));
      
      // ADDITIONAL FILTER: Ensure only sessions for this teacher are shown
      const filteredSessions = sessions.filter(s => s.teacherId === currentUser.uid);
      console.log('✅ Filtered sessions:', filteredSessions.length);
      
      setReadingSessions(filteredSessions);
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
  }, [currentUser?.uid]);

  const loadTeacherProfile = useCallback(async () => {
    try {
      const profile = await getUserProfile();
      const gradeLevel = profile?.gradeLevel;
      if (gradeLevel) {
        // Extract just the number from grade level (e.g., "Grade 4" -> "4", "4" -> "4")
        const gradeNumber = gradeLevel.toString().replace(/[^0-9]/g, '');
        setTeacherGradeLevel(gradeNumber);
        console.log('Teacher grade level:', gradeNumber);
      }
    } catch (error) {
      console.error('Error loading teacher profile:', error);
    }
  }, []);

  const loadStories = useCallback(async () => {
    try {
      setStoriesLoading(true);
      setStoriesError(null);
      const fetchedStories = await UnifiedStoryService.getInstance().getStories({}); // Fetch all stories initially
      
      // Filter stories based on teacher's grade level
      let filteredStories = fetchedStories;
      if (teacherGradeLevel) {
        // Normalize both values for comparison (remove spaces, convert to string, compare numbers)
        filteredStories = fetchedStories.filter(story => {
          const storyGrade = String(story.grade || '').replace(/[^0-9]/g, '').trim();
          const teacherGrade = String(teacherGradeLevel).replace(/[^0-9]/g, '').trim();
          return storyGrade === teacherGrade;
        });
        console.log(`✅ Filtered stories for Grade ${teacherGradeLevel}:`, filteredStories.length, 'out of', fetchedStories.length);
        console.log('📖 Filtered stories details:', filteredStories.map(s => ({ title: s.title, grade: s.grade, set: s.storySet, language: s.language })));
      }
      
      // Map IStory[] to Story[] to ensure type compatibility and add pdfUrl
      setStories(filteredStories.map(story => ({
        ...story,
        _id: story._id?.toString(),
        createdBy: story.createdBy?.toString?.() ?? story.createdBy,
        language: story.language as 'english' | 'tagalog',
        pdfUrl: story._id ? UnifiedStoryService.getInstance().getStoryPdfUrl(story._id) : undefined
      })));
    } catch (error) {
      console.error('Error loading stories:', error);
      setStoriesError('Failed to load stories. Please try again.');
      Swal.fire('Error', 'Failed to load stories', 'error');
    } finally {
      setStoriesLoading(false);
    }
  }, [teacherGradeLevel]);

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
      // Results fetching removed - MongoDB results service no longer available
      const resultsMap = new Map<string, any[]>();
      
      // Set empty arrays for all sessions
      for (const session of readingSessions) {
        if (session.id) {
          resultsMap.set(session.id, []);
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
      loadTeacherProfile();
    }
  }, [currentUser?.uid, loadGrades, loadStudents, loadSessions, loadTeacherProfile]);

  // Load stories when teacher grade level is available
  useEffect(() => {
    if (teacherGradeLevel !== null) {
      loadStories();
    }
  }, [teacherGradeLevel, loadStories]);

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
        title: `
          <div class="flex items-center justify-center gap-1 sm:gap-1.5">
            <div class="text-left">
              <h2 class="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 !leading-tight">Create Reading Session</h2>
            </div>
          </div>
        `,
        html: `
          <div class="text-left px-1 sm:px-2">
            <!-- Progress Steps -->
            <div class="mb-3 sm:mb-4 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 rounded-lg sm:rounded-xl p-2 sm:p-3 border border-blue-100">
              <div class="flex items-center justify-between">
                <div class="flex flex-col items-center flex-1">
                  <div class="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center font-bold text-[10px] sm:text-xs shadow-md">
                    1
                  </div>
                  <span class="mt-1 sm:mt-1.5 text-[10px] sm:text-xs font-semibold text-gray-700">Session Info</span>
                </div>
                <div class="flex-1 h-0.5 sm:h-1 bg-gradient-to-r from-blue-300 to-purple-300 mx-1 sm:mx-2 rounded-full"></div>
                <div class="flex flex-col items-center flex-1">
                  <div class="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 text-white flex items-center justify-center font-bold text-[10px] sm:text-xs shadow-md">
                    2
                  </div>
                  <span class="mt-1 sm:mt-1.5 text-[10px] sm:text-xs font-semibold text-gray-700">Select Story</span>
                </div>
                <div class="flex-1 h-0.5 sm:h-1 bg-gradient-to-r from-purple-300 to-green-300 mx-1 sm:mx-2 rounded-full"></div>
                <div class="flex flex-col items-center flex-1">
                  <div class="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 rounded-full bg-gradient-to-br from-green-500 to-green-600 text-white flex items-center justify-center font-bold text-[10px] sm:text-xs shadow-md">
                    3
                  </div>
                  <span class="mt-1 sm:mt-1.5 text-[10px] sm:text-xs font-semibold text-gray-700">Choose Student</span>
                </div>
              </div>
            </div>

            <!-- Two Column Layout - Responsive -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mb-3 sm:mb-4">
              <!-- Left Column -->
              <div class="space-y-3 sm:space-y-4">
                <!-- Story Selection -->
                <div class="bg-white rounded-lg sm:rounded-xl border-2 border-gray-200 p-3 sm:p-4 hover:border-purple-300 transition-all duration-200 shadow-sm">
                  <label class="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-bold text-gray-800 mb-1.5 sm:mb-2">
                    <div class="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-purple-100 flex items-center justify-center">
                      <svg class="w-3 h-3 sm:w-3.5 sm:h-3.5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                    <span class="text-xs sm:text-sm">Select Story</span>
                  </label>
                  <select 
                    id="session-story" 
                    class="w-full px-2.5 sm:px-3 py-1.5 sm:py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-xs sm:text-sm bg-white transition-all"
                  >
                    <option value="">Choose a story...</option>
                    ${stories.map(story => `
                      <option value="${story.title}" data-url="${story.pdfUrl}">📖 ${story.title}</option>
                    `).join('')}
                  </select>
                  <p class="mt-1 sm:mt-1.5 text-[10px] sm:text-xs text-gray-500">Select the reading material for this session</p>
                </div>

                <!-- Class Selection -->
                <div class="bg-white rounded-lg sm:rounded-xl border-2 border-gray-200 p-3 sm:p-4 hover:border-green-300 transition-all duration-200 shadow-sm">
                  <label class="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-bold text-gray-800 mb-1.5 sm:mb-2">
                    <div class="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-green-100 flex items-center justify-center">
                      <svg class="w-3 h-3 sm:w-3.5 sm:h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <span class="text-xs sm:text-sm">Class/Grade</span>
                  </label>
                  <select 
                    id="session-grade" 
                    class="w-full px-2.5 sm:px-3 py-1.5 sm:py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-xs sm:text-sm bg-white transition-all"
                  >
                    <option value="">Select a class...</option>
                    ${grades.map(grade => `
                      <option value="${grade.id}">${grade.name}</option>
                    `).join('')}
                  </select>
                  <p class="mt-1 sm:mt-1.5 text-[10px] sm:text-xs text-gray-500">Choose the class to load students from</p>
                </div>
              </div>

              <!-- Right Column - Student Selection -->
              <div class="bg-gradient-to-br from-gray-50 to-blue-50 rounded-lg sm:rounded-xl border-2 border-gray-200 p-3 sm:p-4 shadow-sm">
                <div class="flex items-center justify-between mb-2 sm:mb-3">
                  <label class="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-bold text-gray-800">
                    <div class="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-orange-100 flex items-center justify-center">
                      <svg class="w-3 h-3 sm:w-3.5 sm:h-3.5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <span class="text-xs sm:text-sm">Select Student</span>
                  </label>
                  <div id="student-count-display" class="px-2 sm:px-2.5 py-0.5 bg-white rounded-full border border-gray-300 text-[10px] sm:text-xs font-semibold text-gray-600">
                    0 students
                  </div>
                </div>

                <!-- Search Bar -->
                <div class="relative mb-2 sm:mb-3">
                  <input 
                    id="student-search" 
                    placeholder="Search student by name..." 
                    class="w-full px-2.5 sm:px-3 py-1.5 sm:py-2 pl-8 sm:pl-9 border-2 border-gray-300 rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white transition-all" 
                  />
                  <div class="absolute inset-y-0 left-0 pl-2.5 sm:pl-3 flex items-center pointer-events-none">
                    <svg class="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                    </svg>
                  </div>
                </div>

                <!-- Student List -->
                <div id="student-display" class="space-y-1.5 sm:space-y-2 max-h-48 sm:max-h-56 md:max-h-64 overflow-y-auto bg-white rounded-lg border-2 border-gray-200 p-2 sm:p-3 custom-scrollbar">
                  <div class="flex flex-col items-center justify-center py-6 sm:py-8 text-gray-400">
                    <svg class="w-10 h-10 sm:w-12 sm:h-12 mb-1.5 sm:mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <p class="text-[10px] sm:text-xs font-medium">No students available</p>
                    <p class="text-[10px] sm:text-xs mt-0.5">Select a class to view students</p>
                  </div>
                </div>

                <!-- Info Note -->
                <div class="mt-2 sm:mt-3 flex items-start gap-1.5 sm:gap-2 bg-blue-50 border border-blue-200 rounded-lg p-2 sm:p-2.5">
                  <svg class="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                  </svg>
                  <p class="text-[10px] sm:text-xs text-blue-800 leading-relaxed">
                    <span class="font-semibold">Individual Session:</span> Only one student can be selected for this reading assessment.
                  </p>
                </div>
              </div>
            </div>

            <style>
              .custom-scrollbar::-webkit-scrollbar {
                width: 8px;
              }
              .custom-scrollbar::-webkit-scrollbar-track {
                background: #f1f5f9;
                border-radius: 4px;
              }
              .custom-scrollbar::-webkit-scrollbar-thumb {
                background: #cbd5e1;
                border-radius: 4px;
              }
              .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                background: #94a3b8;
              }
            </style>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: '<span class="flex items-center gap-1.5 sm:gap-2"><svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg> <span class="text-xs sm:text-sm">Start Session</span></span>',
        cancelButtonText: 'Cancel',
        focusConfirm: false,
        backdrop: 'rgba(0,0,0,0.7)',
        width: typeof window !== 'undefined' && window.innerWidth < 768 ? '95%' : typeof window !== 'undefined' && window.innerWidth < 1024 ? '90%' : '850px',
        customClass: {
          popup: 'rounded-2xl shadow-2xl !max-w-[95vw] sm:!max-w-[90vw] md:!max-w-[850px]',
          title: '!text-xs sm:!text-sm md:!text-base !font-semibold text-gray-900 border-b border-gray-200 !pb-1 sm:!pb-1.5 !mb-0',
          htmlContainer: 'overflow-visible',
          confirmButton: 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-1.5 sm:py-2 px-4 sm:px-5 rounded-lg shadow-lg transition-all duration-200 transform hover:scale-105 text-xs sm:text-sm',
          cancelButton: 'bg-white hover:bg-gray-100 text-gray-700 font-semibold py-1.5 sm:py-2 px-4 sm:px-5 rounded-lg border-2 border-gray-300 transition-all duration-200 text-xs sm:text-sm'
        },
        didOpen: () => {
          const gradeSelect = document.getElementById('session-grade') as HTMLSelectElement;
          const studentDisplay = document.getElementById('student-display') as HTMLDivElement;
          const studentSearch = document.getElementById('student-search') as HTMLInputElement;
          let currentStudents: { id?: string; name: string }[] = [];

          const render = (list: typeof currentStudents) => {
            const countDisplay = document.getElementById('student-count-display');
            if (countDisplay) {
              countDisplay.innerHTML = `${list.length} student${list.length !== 1 ? 's' : ''}`;
            }

            // Get selected story to check for existing sessions
            const storySelect = document.getElementById('session-story') as HTMLSelectElement;
            const selectedStory = storySelect?.value || '';

            // Check which students already have sessions for the selected story
            const studentsWithSessions = new Set<string>();
            if (selectedStory) {
              readingSessions.forEach(session => {
                if (session.book === selectedStory && session.students) {
                  session.students.forEach((student: any) => {
                    const studentId = typeof student === 'string' ? student : student.id;
                    if (studentId) {
                      studentsWithSessions.add(studentId);
                    }
                  });
                }
              });
            }

            studentDisplay.innerHTML = list.length
              ? `
                <div class="space-y-1.5 sm:space-y-2">
                  ${list.map((s) => {
                    const hasSession = studentsWithSessions.has(s.id || '');
                    const isDisabled = hasSession;
                    return `
                    <label class="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg border-2 ${isDisabled ? 'border-gray-300 bg-gray-100 opacity-60 cursor-not-allowed' : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50 cursor-pointer'} transition-all duration-200 group">
                      <input 
                        type="radio" 
                        name="selected-student" 
                        value="${s.id || s.name}" 
                        class="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-600 focus:ring-2 focus:ring-blue-500" 
                        ${isDisabled ? 'disabled' : ''}
                      />
                      <div class="flex items-center gap-1.5 sm:gap-2 flex-1">
                        <div class="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br ${isDisabled ? 'from-gray-300 to-gray-400' : 'from-blue-400 to-indigo-500'} flex items-center justify-center text-white font-bold text-[10px] sm:text-xs shadow-md">
                          ${s.name.charAt(0).toUpperCase()}
                        </div>
                        <div class="flex-1 min-w-0">
                          <p class="text-[10px] sm:text-xs font-semibold ${isDisabled ? 'text-gray-500' : 'text-gray-800 group-hover:text-blue-700'} truncate">${s.name}</p>
                          ${hasSession ? '<p class="text-[9px] sm:text-[10px] text-gray-500 italic">Already has session for this story</p>' : ''}
                        </div>
                      </div>
                      ${isDisabled ? 
                        `<svg class="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fill-rule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clip-rule="evenodd" />
                        </svg>` :
                        `<svg class="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-300 group-hover:text-blue-500 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                        </svg>`
                      }
                    </label>
                  `;
                  }).join('')}
                </div>
              `
              : `
                <div class="flex flex-col items-center justify-center py-6 sm:py-8 text-gray-400">
                  <svg class="w-10 h-10 sm:w-12 sm:h-12 mb-1.5 sm:mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <p class="text-[10px] sm:text-xs font-medium">No students found</p>
                  <p class="text-[10px] sm:text-xs mt-0.5">Try selecting a different class</p>
                </div>
              `;
          };

          if (gradeSelect && studentDisplay) {
            // Listen for story selection changes to update disabled students
            const storySelect = document.getElementById('session-story') as HTMLSelectElement;
            if (storySelect) {
              storySelect.addEventListener('change', () => {
                // Re-render student list when story changes to update disabled states
                if (currentStudents.length > 0) {
                  render(currentStudents);
                }
              });
            }

            gradeSelect.addEventListener('change', async (e) => {
              const gradeId = (e.target as HTMLSelectElement).value;
              if (gradeId) {
                const gradeStudents = await loadStudentsByGrade(gradeId);
                currentStudents = gradeStudents;
                render(currentStudents);
                if (studentSearch) {
                  studentSearch.oninput = () => {
                    const q = studentSearch.value.toLowerCase();
                    render(currentStudents.filter(s => s.name.toLowerCase().includes(q)));
                  };
                }
              } else {
                currentStudents = [];
                const countDisplay = document.getElementById('student-count-display');
                if (countDisplay) {
                  countDisplay.innerHTML = '0 students';
                }
                studentDisplay.innerHTML = `
                  <div class="flex flex-col items-center justify-center py-6 sm:py-8 text-gray-400">
                    <svg class="w-10 h-10 sm:w-12 sm:h-12 mb-1.5 sm:mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <p class="text-[10px] sm:text-xs font-medium">No students available</p>
                    <p class="text-[10px] sm:text-xs mt-0.5">Select a class to view students</p>
                  </div>
                `;
              }
            });
          }
        },
        preConfirm: () => {
          const storySelect = document.getElementById('session-story') as HTMLSelectElement;
          const book = storySelect.value;
          const storyUrl = storySelect.options[storySelect.selectedIndex].getAttribute('data-url') || '';
          const gradeId = (document.getElementById('session-grade') as HTMLSelectElement).value;

          const selectedRadio = document.querySelector('input[name="selected-student"]:checked') as HTMLInputElement | null;
          const selectedStudentKey = selectedRadio?.value || '';

          if (!book || !gradeId || !selectedStudentKey) {
            Swal.showValidationMessage('Please complete all fields and select a student');
            return false;
          }

          // Build single-student session
          return loadStudentsByGrade(gradeId).then(gradeStudents => {
            const found = gradeStudents.find(s => (s.id || s.name) === selectedStudentKey);
            // Store both student ID and name in the students array
            const selectedStudentId = found?.id || selectedStudentKey;
            const selectedStudentName = found?.name || selectedStudentKey;
            if (!selectedStudentId || !selectedStudentName) {
              Swal.showValidationMessage('Student ID and name are required');
              return false;
            }
            // Auto-generate title from student name
            const title = `Reading Session - ${selectedStudentName}`;
            return {
              title,
              book,
              storyUrl,
              gradeId,
              students: [{ id: selectedStudentId, name: selectedStudentName }], // Store both ID and name
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




  const handleOpenSession = (sessionId: string) => {
    if (!sessionId) return;
    navigate(`/teacher/reading-session/${sessionId}`);
  };

  const handleDeleteSession = async (sessionId: string, studentName: string) => {
    if (!sessionId) return;

    const result = await Swal.fire({
      title: 'Delete Reading Session?',
      html: `Are you sure you want to delete the reading session for <strong>${studentName}</strong>?<br><br>This action cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it',
      cancelButtonText: 'Cancel',
      customClass: {
        confirmButton: 'bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg',
        cancelButton: 'bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-lg'
      }
    });

    if (result.isConfirmed) {
      try {
        await readingSessionService.deleteSession(sessionId);
        
        // Remove the session from local state
        setReadingSessions(prev => prev.filter(session => session.id !== sessionId));
        
        // Also remove from sessionResults if it exists
        setSessionResults(prev => {
          const newMap = new Map(prev);
          newMap.delete(sessionId);
          return newMap;
        });

        await Swal.fire({
          icon: 'success',
          title: 'Deleted!',
          text: 'The reading session has been deleted.',
          timer: 2000,
          showConfirmButton: false
        });
      } catch (error) {
        console.error('Error deleting session:', error);
        await Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to delete the reading session. Please try again.',
        });
      }
    }
  };

  // Multi-delete handlers
  const handleToggleSession = (sessionId: string) => {
    setSelectedSessions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sessionId)) {
        newSet.delete(sessionId);
      } else {
        newSet.add(sessionId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    const filteredSessionIds = readingSessions
      .filter(session => selectedStoryFilter === 'all' || session.book === selectedStoryFilter)
      .map(session => session.id)
      .filter((id): id is string => !!id);
    
    if (selectedSessions.size === filteredSessionIds.length) {
      // Deselect all
      setSelectedSessions(new Set());
    } else {
      // Select all filtered sessions
      setSelectedSessions(new Set(filteredSessionIds));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedSessions.size === 0) return;

    const result = await Swal.fire({
      title: 'Delete Multiple Sessions?',
      html: `Are you sure you want to delete <strong>${selectedSessions.size}</strong> reading session${selectedSessions.size > 1 ? 's' : ''}?<br><br>This action cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete them',
      cancelButtonText: 'Cancel',
      customClass: {
        confirmButton: 'bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg',
        cancelButton: 'bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-lg'
      }
    });

    if (result.isConfirmed) {
      setIsDeleting(true);
      try {
        // Delete all selected sessions in parallel
        const deletePromises = Array.from(selectedSessions).map(sessionId =>
          readingSessionService.deleteSession(sessionId)
        );
        
        const results = await Promise.allSettled(deletePromises);
        
        // Count successes and failures
        const successCount = results.filter(r => r.status === 'fulfilled').length;
        const failureCount = results.filter(r => r.status === 'rejected').length;
        
        // Remove successfully deleted sessions from local state
        setReadingSessions(prev => prev.filter(session => !selectedSessions.has(session.id || '')));
        
        // Remove from sessionResults
        setSessionResults(prev => {
          const newMap = new Map(prev);
          selectedSessions.forEach(id => newMap.delete(id));
          return newMap;
        });
        
        // Clear selection
        setSelectedSessions(new Set());

        if (failureCount === 0) {
          await Swal.fire({
            icon: 'success',
            title: 'Deleted!',
            text: `Successfully deleted ${successCount} session${successCount > 1 ? 's' : ''}.`,
            timer: 2000,
            showConfirmButton: false
          });
        } else {
          await Swal.fire({
            icon: 'warning',
            title: 'Partially Completed',
            text: `Deleted ${successCount} session${successCount > 1 ? 's' : ''}, but ${failureCount} failed.`,
          });
        }
      } catch (error) {
        console.error('Error deleting sessions:', error);
        await Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to delete sessions. Please try again.',
        });
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const handleRefresh = async () => {
    if (!currentUser?.uid || isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      // Refresh all data in parallel
      await Promise.all([
        loadGrades(),
        loadStudents(),
        loadSessions(),
        loadTeacherProfile()
      ]);
      
      // Load stories after teacher grade level is available
      if (teacherGradeLevel !== null) {
        await loadStories();
      }
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setIsRefreshing(false);
    }
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 py-6 sm:py-8">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 mb-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                  <i className="fas fa-book-reader text-white text-xl"></i>
                </div>
                <div>
                  <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    Reading Sessions
                  </h1>
                  {teacherGradeLevel && (
                    <span className="inline-flex items-center mt-1 text-sm font-semibold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200">
                      Grade {teacherGradeLevel}
                    </span>
                  )}
                </div>
              </div>
              <p className="text-slate-600 mt-2 text-sm sm:text-base">
                {teacherGradeLevel 
                  ? `Manage reading sessions and explore Grade ${teacherGradeLevel} stories`
                  : 'Manage reading sessions and explore stories'
                }
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl shadow-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Refresh data"
              >
                <i className={`fas fa-sync-alt ${isRefreshing ? 'animate-spin' : ''}`}></i>
                <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
              </button>
              <button
                onClick={handleScheduleSession}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
              >
                <i className="fas fa-plus"></i>
                <span>Start New Session</span>
              </button>
            </div>
          </div>
        </div>

        {/* Tabs with Filter */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-2 mb-6">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            {/* Tabs */}
            <nav className="flex space-x-2">
              <button
                onClick={() => setActiveTab('sessions')}
                className={`px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${
                  activeTab === 'sessions'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Active Sessions
              </button>
              <button
                onClick={() => setActiveTab('stories')}
                className={`px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${
                  activeTab === 'stories'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Stories
              </button>
            </nav>

            {/* Story Filter - Only show on Active Sessions tab */}
            {activeTab === 'sessions' && readingSessions.length > 0 && (
              <div className="flex items-center gap-3 w-full lg:w-auto">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-600 whitespace-nowrap">
                  <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  <span>Filter by Story:</span>
                </label>
                <select
                  value={selectedStoryFilter}
                  onChange={(e) => setSelectedStoryFilter(e.target.value)}
                  className="flex-1 lg:w-[280px] px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white transition-all"
                >
                  <option value="all">All Stories ({readingSessions.length} sessions)</option>
                  {Array.from(new Set(readingSessions.map(s => s.book)))
                    .sort()
                    .map(storyTitle => {
                      const count = readingSessions.filter(s => s.book === storyTitle).length;
                      return (
                        <option key={storyTitle} value={storyTitle}>
                          {storyTitle} ({count})
                        </option>
                      );
                    })}
                </select>
                {selectedStoryFilter !== 'all' && (
                  <button
                    onClick={() => setSelectedStoryFilter('all')}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
                    title="Clear filter"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        {activeTab === 'sessions' && (
          <div>
            {readingSessions.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="fas fa-book-open text-slate-400 text-3xl"></i>
                </div>
                <p className="text-slate-500 text-lg font-medium mb-2">No reading sessions yet</p>
                <p className="text-slate-400 text-sm mb-6">Start a new session to begin tracking student progress</p>
                <button
                  onClick={handleScheduleSession}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  <i className="fas fa-plus"></i>
                  <span>Create First Session</span>
                </button>
              </div>
            ) : (
              <>
                {/* Bulk Actions Bar */}
                {selectedSessions.size > 0 && (
                  <div className="bg-indigo-50 border-2 border-indigo-200 rounded-xl p-4 mb-6 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                          {selectedSessions.size}
                        </div>
                        <span className="text-indigo-900 font-semibold">
                          {selectedSessions.size} session{selectedSessions.size > 1 ? 's' : ''} selected
                        </span>
                      </div>
                      <button
                        onClick={() => setSelectedSessions(new Set())}
                        className="text-indigo-600 hover:text-indigo-800 text-sm font-medium underline"
                      >
                        Clear selection
                      </button>
                    </div>
                    <button
                      onClick={handleDeleteSelected}
                      disabled={isDeleting}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isDeleting ? (
                        <>
                          <i className="fas fa-spinner fa-spin"></i>
                          <span>Deleting...</span>
                        </>
                      ) : (
                        <>
                          <i className="fas fa-trash"></i>
                          <span>Delete Selected</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Select All Checkbox */}
                {readingSessions.filter(session => selectedStoryFilter === 'all' || session.book === selectedStoryFilter).length > 0 && (
                  <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedSessions.size > 0 && selectedSessions.size === readingSessions.filter(session => selectedStoryFilter === 'all' || session.book === selectedStoryFilter).length}
                      onChange={handleSelectAll}
                      className="w-5 h-5 text-indigo-600 border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    />
                    <label className="text-sm font-medium text-slate-700 cursor-pointer" onClick={handleSelectAll}>
                      Select all sessions
                    </label>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                  {readingSessions
                    .filter(session => selectedStoryFilter === 'all' || session.book === selectedStoryFilter)
                    .map((session) => {
                    // Get students for this session (with safety check)
                  // Handle both old format (string[]) and new format ({id, name}[])
                  const sessionStudents = (session.students || []).map((student) => {
                    // If it's already the new format (object with id and name), use it directly
                    if (typeof student === 'object' && student !== null && 'id' in student && 'name' in student) {
                      return { id: student.id, name: student.name };
                    }
                    // Old format: string (student name or ID), try to find the student
                    const studentName = typeof student === 'string' ? student : '';
                    const foundStudent = students.find(s => s.name === studentName || s.id === studentName);
                    return {
                      id: foundStudent?.id || studentName,
                      name: foundStudent?.name || studentName
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

                  const pendingCount = sessionStudents.filter(s => !completedStudentIds.has(s.id)).length;
                  const completedCount = sessionStudents.length - pendingCount;
                  const isSessionCompleted = (session as any).status === 'completed' || (pendingCount === 0 && completedCount > 0);

                  // Get the first student's name to display instead of title
                  const displayName = sessionStudents.length > 0 ? sessionStudents[0].name : 'No Student';
                  const isSelected = selectedSessions.has(session.id || '');

                  return (
                    <div 
                      key={session.id} 
                      className={`group bg-white rounded-2xl shadow-sm hover:shadow-xl border-2 overflow-hidden flex flex-col h-full transition-all duration-300 ${
                        isSelected 
                          ? 'border-indigo-500 ring-2 ring-indigo-200' 
                          : 'border-slate-200 hover:border-indigo-300'
                      }`}
                    >
                      <div className="p-5 sm:p-6 flex-grow flex flex-col">
                        {/* Checkbox and Header */}
                        <div className="flex items-start gap-3 mb-4">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSession(session.id || '')}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-1 w-5 h-5 text-indigo-600 border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 cursor-pointer flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shadow-md flex-shrink-0">
                                {displayName.charAt(0).toUpperCase()}
                              </div>
                              <h3 className="text-lg font-bold text-slate-900 line-clamp-1 flex-1">{displayName}</h3>
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSession(session.id || '', displayName);
                            }}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 flex-shrink-0 opacity-0 group-hover:opacity-100"
                            title="Delete session"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>

                        {/* Story badge */}
                        <div className="mb-4">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-blue-50 to-indigo-50 text-indigo-700 border border-indigo-200">
                            <i className="fas fa-book text-indigo-600"></i>
                            <span className="line-clamp-1">{session.book}</span>
                          </span>
                        </div>

                        {/* Status and action button */}
                        <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                          <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold ${
                            isSessionCompleted 
                              ? 'bg-green-100 text-green-700 border border-green-200' 
                              : (session as any).status === 'in-progress' 
                                ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                                : 'bg-amber-100 text-amber-700 border border-amber-200'
                          }`}>
                            {isSessionCompleted ? (
                              <>
                                <i className="fas fa-check-circle mr-1.5"></i>
                                Completed
                              </>
                            ) : (session as any).status === 'in-progress' ? (
                              <>
                                <i className="fas fa-spinner fa-spin mr-1.5"></i>
                                In Progress
                              </>
                            ) : (
                              <>
                                <i className="fas fa-clock mr-1.5"></i>
                                Pending
                              </>
                            )}
                          </span>
                          <button
                            onClick={() => handleOpenSession(session.id || '')}
                            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105 ${
                              isSessionCompleted 
                                ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white' 
                                : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white'
                            }`}
                          >
                            <span>View</span>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
                {/* No Results Message */}
                {readingSessions.filter(session => selectedStoryFilter === 'all' || session.book === selectedStoryFilter).length === 0 && selectedStoryFilter !== 'all' && (
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center mt-6">
                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-slate-500 text-lg font-medium mb-2">No sessions found</p>
                    <p className="text-slate-400 text-sm mb-6">No sessions match the selected story filter</p>
                    <button
                      onClick={() => setSelectedStoryFilter('all')}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span>Show All Sessions</span>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'stories' && (
          <div>
            {storiesLoading ? (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12">
                <TeacherLoader label="Loading stories..." />
              </div>
            ) : storiesError ? (
              <div className="bg-white rounded-2xl shadow-sm border border-red-200 p-12 text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="fas fa-exclamation-triangle text-red-600 text-2xl"></i>
                </div>
                <p className="text-red-600 font-semibold mb-2">Error Loading Stories</p>
                <p className="text-slate-500 text-sm">{storiesError}</p>
              </div>
            ) : stories.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="fas fa-book text-slate-400 text-3xl"></i>
                </div>
                <p className="text-slate-600 font-semibold text-lg mb-2">
                  {teacherGradeLevel 
                    ? `No Grade ${teacherGradeLevel} stories available`
                    : 'No stories available'
                  }
                </p>
                {teacherGradeLevel && (
                  <p className="text-slate-400 text-sm">
                    Contact your administrator to add Grade {teacherGradeLevel} stories to the system.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-8">
                {/* English Stories Row */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                  <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                    <span>English Stories</span>
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {['A', 'B', 'C', 'D'].map((set) => {
                      const story = stories.find(s => {
                        const lang = String(s.language || '').toLowerCase();
                        // Check for english and legacy value (en)
                        const isEnglish = lang === 'english' || lang === 'en';
                        const matchesSet = s.storySet === set;
                        return isEnglish && matchesSet;
                      });
                      return (
                        <div key={`english-${set}`} className="bg-gradient-to-br from-slate-50 to-white rounded-xl shadow-sm hover:shadow-lg border border-slate-200 hover:border-blue-300 overflow-hidden transition-all duration-300 group">
                          <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-5 text-center">
                            <div className="w-16 h-16 mx-auto bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mb-3 shadow-lg">
                              <span className="text-3xl font-bold text-white">{set}</span>
                            </div>
                            <h3 className="text-white font-bold text-lg">Set {set}</h3>
                          </div>
                          {story ? (
                            <div className="p-5">
                              <div className="flex items-start gap-3 mb-3">
                                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                  </svg>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-bold text-slate-900 text-sm line-clamp-2 mb-1">{story.title}</h4>
                                  <p className="text-xs text-slate-500 line-clamp-2">{story.description || 'No description available'}</p>
                                </div>
                              </div>
                              <button
                                onClick={() => handleViewStoryDetails(story)}
                                className="w-full bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 text-blue-700 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-200 border border-blue-200 hover:border-blue-300"
                              >
                                View Details
                              </button>
                            </div>
                          ) : (
                            <div className="p-5 text-center">
                              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                              </div>
                              <p className="text-slate-400 text-sm font-medium">No story assigned</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Filipino/Tagalog Stories Row */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                  <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-md">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                    <span>Filipino Stories</span>
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {['A', 'B', 'C', 'D'].map((set) => {
                      const story = stories.find(s => {
                        const lang = String(s.language || '').toLowerCase();
                        // Check for tagalog and legacy values (none, tl, filipino, fil)
                        const isTagalog = lang === 'tagalog' || lang === 'none' || lang === 'tl' || lang === 'filipino' || lang === 'fil';
                        const matchesSet = s.storySet === set;
                        return isTagalog && matchesSet;
                      });
                      return (
                        <div key={`tagalog-${set}`} className="bg-gradient-to-br from-slate-50 to-white rounded-xl shadow-sm hover:shadow-lg border border-slate-200 hover:border-green-300 overflow-hidden transition-all duration-300 group">
                          <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-5 text-center">
                            <div className="w-16 h-16 mx-auto bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mb-3 shadow-lg">
                              <span className="text-3xl font-bold text-white">{set}</span>
                            </div>
                            <h3 className="text-white font-bold text-lg">Set {set}</h3>
                          </div>
                          {story ? (
                            <div className="p-5">
                              <div className="flex items-start gap-3 mb-3">
                                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                  </svg>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-bold text-slate-900 text-sm line-clamp-2 mb-1">{story.title}</h4>
                                  <p className="text-xs text-slate-500 line-clamp-2">{story.description || 'No description available'}</p>
                                </div>
                              </div>
                              <button
                                onClick={() => handleViewStoryDetails(story)}
                                className="w-full bg-gradient-to-r from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 text-green-700 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-200 border border-green-200 hover:border-green-300"
                              >
                                View Details
                              </button>
                            </div>
                          ) : (
                            <div className="p-5 text-center">
                              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                              </div>
                              <p className="text-slate-400 text-sm font-medium">No story assigned</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Reading;