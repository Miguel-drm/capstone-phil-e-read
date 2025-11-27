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

            studentDisplay.innerHTML = list.length
              ? `
                <div class="space-y-1.5 sm:space-y-2">
                  ${list.map((s) => `
                    <label class="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 cursor-pointer transition-all duration-200 group">
                      <input type="radio" name="selected-student" value="${s.id || s.name}" class="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-600 focus:ring-2 focus:ring-blue-500" />
                      <div class="flex items-center gap-1.5 sm:gap-2 flex-1">
                        <div class="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold text-[10px] sm:text-xs shadow-md">
                          ${s.name.charAt(0).toUpperCase()}
                        </div>
                        <div class="flex-1 min-w-0">
                          <p class="text-[10px] sm:text-xs font-semibold text-gray-800 group-hover:text-blue-700 truncate">${s.name}</p>
                        </div>
                      </div>
                      <svg class="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-300 group-hover:text-blue-500 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                      </svg>
                    </label>
                  `).join('')}
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center py-2 sm:py-6">
      <div className="w-full px-2 sm:px-4 md:px-6 lg:px-8 bg-white/90 rounded-2xl shadow-lg p-4 sm:p-8 border border-blue-100">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 border-b border-blue-100 pb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-blue-900 tracking-tight flex items-center gap-2">
              <i className="fas fa-book-reader text-blue-400"></i> Reading
              {teacherGradeLevel && (
                <span className="text-lg font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                  Grade {teacherGradeLevel}
                </span>
              )}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {teacherGradeLevel 
                ? `Manage reading sessions and explore Grade ${teacherGradeLevel} stories`
                : 'Manage reading sessions and explore stories'
              }
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="w-full sm:w-auto bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-lg shadow transition-all duration-200 flex items-center justify-center text-base gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Refresh data"
            >
              <i className={`fas fa-sync-alt ${isRefreshing ? 'animate-spin' : ''}`}></i>
              <span className="hidden sm:inline">{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
            <button
              onClick={handleScheduleSession}
              className="w-full sm:w-auto bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-semibold py-2 px-6 rounded-lg shadow transition-all duration-200 flex items-center justify-center text-base gap-2"
            >
              <i className="fas fa-plus"></i>
              Start New Session
            </button>
          </div>
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
          <div className="pt-4 border-t border-blue-100">
            {readingSessions.length === 0 ? (
              <div className="text-center py-10 text-gray-400 italic">No sessions found. Click + to add a session.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 md:gap-6">
                {readingSessions.map((session) => {
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

                  return (
                    <div key={session.id} className="bg-white rounded-xl shadow-md border border-blue-50 overflow-hidden flex flex-col h-full">
                      <div className="p-4 flex-grow flex flex-col">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="text-lg font-semibold text-blue-900 line-clamp-1">{displayName}</h3>
                        </div>
                        <div className="mb-3">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-blue-100 text-blue-700">{session.book}</span>
                        </div>
                        <div className="mt-auto flex items-center justify-between">
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${isSessionCompleted ? 'bg-green-100 text-green-800' : (session as any).status === 'in-progress' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'}`}>
                            {isSessionCompleted ? 'Completed' : (session as any).status === 'in-progress' ? 'In Progress' : 'Pending'}
                          </span>
                          <button
                            onClick={() => handleOpenSession(session.id || '')}
                            className={`inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${isSessionCompleted ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-yellow-500 text-white hover:bg-yellow-600'}`}
                          >
                            <span>Go to Session</span>
                            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'stories' && (
          <div>
            {storiesLoading ? (
              <TeacherLoader label="Loading stories..." />
            ) : storiesError ? (
              <div className="text-center py-10 text-red-500">{storiesError}</div>
            ) : stories.length === 0 ? (
              <div className="text-center py-10">
                <div className="text-gray-500 mb-2">
                  {teacherGradeLevel 
                    ? `No Grade ${teacherGradeLevel} stories available.`
                    : 'No stories available.'
                  }
                </div>
                {teacherGradeLevel && (
                  <p className="text-sm text-gray-400">
                    Contact your administrator to add Grade {teacherGradeLevel} stories to the system.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-8">
                {/* English Stories Row */}
                <div>
                  <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    English
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
                        <div key={`english-${set}`} className="bg-white rounded-xl shadow-md border border-blue-100 overflow-hidden">
                          <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-4 text-center">
                            <div className="w-16 h-16 mx-auto bg-white/20 rounded-full flex items-center justify-center mb-2">
                              <span className="text-3xl font-bold text-white">{set}</span>
                            </div>
                            <h3 className="text-white font-semibold text-lg">Set {set}</h3>
                          </div>
                          {story ? (
                            <div className="p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <svg className="w-4 h-4 text-gray-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                                <h4 className="font-semibold text-gray-900 text-sm line-clamp-2">{story.title}</h4>
                              </div>
                              <p className="text-xs text-gray-500 mb-3 line-clamp-2">{story.description || 'No description'}</p>
                              <button
                                onClick={() => handleViewStoryDetails(story)}
                                className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 py-2 px-3 rounded-lg text-sm font-medium transition-colors"
                              >
                                View Details
                              </button>
                            </div>
                          ) : (
                            <div className="p-4 text-center">
                              <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                              </svg>
                              <p className="text-gray-400 text-sm">No story assigned</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Filipino/Tagalog Stories Row */}
                <div>
                  <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    Filipino
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
                        <div key={`tagalog-${set}`} className="bg-white rounded-xl shadow-md border border-green-100 overflow-hidden">
                          <div className="bg-gradient-to-br from-green-500 to-green-600 p-4 text-center">
                            <div className="w-16 h-16 mx-auto bg-white/20 rounded-full flex items-center justify-center mb-2">
                              <span className="text-3xl font-bold text-white">{set}</span>
                            </div>
                            <h3 className="text-white font-semibold text-lg">Set {set}</h3>
                          </div>
                          {story ? (
                            <div className="p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <svg className="w-4 h-4 text-gray-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                                <h4 className="font-semibold text-gray-900 text-sm line-clamp-2">{story.title}</h4>
                              </div>
                              <p className="text-xs text-gray-500 mb-3 line-clamp-2">{story.description || 'No description'}</p>
                              <button
                                onClick={() => handleViewStoryDetails(story)}
                                className="w-full bg-green-50 hover:bg-green-100 text-green-700 py-2 px-3 rounded-lg text-sm font-medium transition-colors"
                              >
                                View Details
                              </button>
                            </div>
                          ) : (
                            <div className="p-4 text-center">
                              <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                              </svg>
                              <p className="text-gray-400 text-sm">No story assigned</p>
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