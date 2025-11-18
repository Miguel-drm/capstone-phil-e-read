import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { studentService, type Student, type ImportedStudent } from '../../services/studentService';
import { gradeService, type ClassGrade } from '../../services/gradeService';
import * as XLSX from 'xlsx';
import { showError, showSuccess, showConfirmation } from '../../services/alertService';
import Swal from 'sweetalert2';
import { onSnapshot, collection, query as fsQuery, where as fsWhere, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAllParents, getUserProfile } from '../../services/authService';
import { notificationService } from '../../services/notificationService';
import { db } from '../../config/firebase';
import TeacherLoader from '../../components/teacher/TeacherLoader';
import { isrResultService, type ISRResult } from '../../services/ISRresultService';

import PillSelect from '../../components/ui/PillSelect';

const ClassList: React.FC = () => {
  const { currentUser, userRole, isProfileComplete, userProfile } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [isImporting, setIsImporting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [isFilteringStudents, setIsFilteringStudents] = useState<boolean>(false);
  // Track ongoing student action loading state (used for UI disables)
  const [actionLoadingStudentId, setActionLoadingStudentId] = useState<string | null>(null);
  const [rosterCounts, setRosterCounts] = useState<Record<string, number>>({});
  const [importedStudents, setImportedStudents] = useState<ImportedStudent[]>([]);
  // Reference to avoid unused-var warning and keep UI reactive to action state
  useEffect(() => {
    // no-op: actionLoadingStudentId used to disable UI while actions are running
  }, [actionLoadingStudentId]);

  const [duplicateStats, setDuplicateStats] = useState<{ within: number; existing: number }>({ within: 0, existing: 0 });
  const [duplicateDetails, setDuplicateDetails] = useState<{ within: ImportedStudent[]; existing: ImportedStudent[]; unique: ImportedStudent[] }>({ within: [], existing: [], unique: [] });
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [loadingStudentId, setLoadingStudentId] = useState<string | null>(null);
  const [loadingAddStudentToGradeId, setLoadingAddStudentToGradeId] = useState<string | null>(null);
  const [loadingEditGradeId, setLoadingEditGradeId] = useState<string | null>(null);
  const [deletingAllStudents, setDeletingAllStudents] = useState(false);
  const [isCreatingGrade, setIsCreatingGrade] = useState(false);
  const [isAddingStudentToGrade, setIsAddingStudentToGrade] = useState(false);
  const [selectedGrades, setSelectedGrades] = useState<string[]>([]);
  const [showArchived, setShowArchived] = useState<boolean>(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editForm, setEditForm] = useState({ name: '', lrn: '' });
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [selectedFormStudent, setSelectedFormStudent] = useState<Student | null>(null);
  const [formData, setFormData] = useState<any>(null);
  const [hasISRData, setHasISRData] = useState(false);
  // Track which students have completed reading sessions (have ISR results)
  const [studentsWithCompletedSessions, setStudentsWithCompletedSessions] = useState<Set<string>>(new Set());
  const [loadingISRStatus, setLoadingISRStatus] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Extract section name from a grade name like "Grade 4 - Narra" => "Narra"
  const getSectionName = (name: string) => {
    if (!name) return '';
    const parts = name.split('-');
    return parts.length > 1 ? parts[parts.length - 1].trim() : name.trim();
  };
  const [deletingGradeId, setDeletingGradeId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [grades, setGrades] = useState<ClassGrade[]>([]);
  const [selectedGrade, setSelectedGrade] = useState<string>('all');

  // When toggling between Active/Archived, reset selection to 'all' and wait for click
  useEffect(() => {
    setSelectedGrade('all');
  }, [showArchived]);
  // Live active counts per grade from roster subscription (local-only, not Firestore)
  const countsByGrade = useMemo(() => ({ ...rosterCounts }), [rosterCounts]);

  // Compute archived counts per grade for Archived view
  const archivedCountsByGrade = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const g of grades) counts[g.id || ''] = 0;
    for (const s of students) {
      if (!(s as any).archived) continue;
      const g = grades.find(gr => gr.name === s.grade);
      if (g && g.id) counts[g.id] = (counts[g.id] || 0) + 1;
    }
    return counts;
  }, [students, grades]);

  // Helper function to check if the current user has management permissions
  const canManage = (userRole === 'teacher' || userRole === 'admin') && isProfileComplete;

  // Load students on component mount
  useEffect(() => {
    if (currentUser?.uid) {
      console.log('Current User UID:', currentUser.uid); // Add this line
      loadStudents();
      loadClassStatistics();
    }
  }, [currentUser?.uid]);

  // Realtime subscription for students belonging to the current teacher
  useEffect(() => {
    if (!currentUser?.uid) return;
    const q = fsQuery(collection(db, 'students'), fsWhere('teacherId', '==', currentUser.uid));
    const unsub = onSnapshot(q, (snap) => {
      const list: Student[] = [] as any;
      snap.forEach(d => list.push({ id: d.id, ...(d.data() as any) } as Student));
      // Keep the same sort order as loadStudents (newest first by createdAt if present)
      list.sort((a, b) => {
        const dateA = (a as any)?.createdAt?.toDate?.() || new Date(0);
        const dateB = (b as any)?.createdAt?.toDate?.() || new Date(0);
        return (dateB as any).getTime() - (dateA as any).getTime();
      });
      setStudents(list);
      setIsLoading(false);
    });
    return () => unsub();
  }, [currentUser?.uid]);

  // Filter students when search query or filter changes
  useEffect(() => {
    filterStudents();
  }, [students, searchQuery, sortBy, showArchived, selectedGrade]);

  // Fetch ISR results status for filtered students to show who has completed sessions
  useEffect(() => {
    const fetchISRStatus = async () => {
      if (filteredStudents.length === 0) {
        setStudentsWithCompletedSessions(new Set());
        return;
      }

      setLoadingISRStatus(true);
      try {
        const studentIds = filteredStudents
          .map(s => s.id)
          .filter((id): id is string => Boolean(id));

        // Fetch ISR results for all filtered students in parallel
        const isrStatusPromises = studentIds.map(async (studentId) => {
          try {
            const results = await isrResultService.getISRResultsByStudent(studentId);
            return { studentId, hasResults: results && results.length > 0 };
          } catch (error) {
            console.error(`Error fetching ISR results for student ${studentId}:`, error);
            return { studentId, hasResults: false };
          }
        });

        const statuses = await Promise.all(isrStatusPromises);
        const completedSet = new Set<string>();
        statuses.forEach(({ studentId, hasResults }) => {
          if (hasResults) {
            completedSet.add(studentId);
          }
        });

        setStudentsWithCompletedSessions(completedSet);
      } catch (error) {
        console.error('Error fetching ISR status:', error);
      } finally {
        setLoadingISRStatus(false);
      }
    };

    // Only fetch if we have filtered students
    if (filteredStudents.length > 0) {
      fetchISRStatus();
    } else {
      setStudentsWithCompletedSessions(new Set());
    }
  }, [filteredStudents]);

  const loadStudents = async () => {
    if (!currentUser?.uid) return;
    try {
      setIsLoading(true);
      const fetchedStudents = await studentService.getStudents(currentUser.uid);
      setStudents(fetchedStudents);
    } catch (error) {
      console.error('Error loading students:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadClassStatistics = async () => {
    if (!currentUser?.uid) return;
    try {
      // Removed unused stats variable
    } catch (error) {
      console.error('Error loading class statistics:', error);
    }
  };

  const filterStudents = async () => {
    setIsFilteringStudents(true);
    // If no grade is selected or 'all' is selected, filter students should be empty
    if (!selectedGrade || selectedGrade === 'all') {
      setFilteredStudents([]);
      setIsFilteringStudents(false);
      return;
    }

    const gradeObj = grades.find(g => g.id === selectedGrade);
    if (!gradeObj) {
      setFilteredStudents([]);
      setIsFilteringStudents(false);
      return;
    }

    // Use roster membership (grade subcollection) as the source of truth
    let rosterIds: string[] = [];
    try {
      const studentsInGrade = await gradeService.getStudentsInGrade(selectedGrade);
      rosterIds = studentsInGrade.map(sg => sg.studentId).filter(Boolean) as string[];
      // Background reconciliation: ensure all active students with matching grade are linked in the roster
      if (!showArchived) {
        const gradeName = gradeObj?.name;
        const missing = students.filter(s => !!s.id && !((s as any).archived) && s.grade === gradeName && !rosterIds.includes(s.id as string));
        if (missing.length > 0) {
          for (const s of missing) {
            try {
              await gradeService.addStudentToGrade(selectedGrade, { studentId: s.id as string, name: s.name });
            } catch { }
          }
          // Refresh roster ids after linking
          try {
            const refreshed = await gradeService.getStudentsInGrade(selectedGrade);
            rosterIds = refreshed.map(sg => sg.studentId).filter(Boolean) as string[];
          } catch { }
        }
      }
    } catch {
      rosterIds = [];
    }

    let filtered: Student[];
    if (showArchived) {
      // Archived view: don't require roster membership (we remove roster links on archive)
      filtered = students.filter(student =>
        student.grade === gradeObj.name && (student as any).archived === true
      );
    } else {
      // Active view: show ONLY roster membership and exclude archived, to align with realtime roster counts
      const rosterSet = new Set<string>(rosterIds);
      filtered = students.filter(student => !!student.id && rosterSet.has(student.id) && !(student as any).archived);
      // If the stored studentCount differs from computed live count, reconcile in background
      if (gradeObj && typeof (gradeObj as any).studentCount === 'number') {
        const liveCount = countsByGrade[gradeObj.id || ''] ?? filtered.length;
        if ((gradeObj as any).studentCount !== liveCount) {
          // Avoid writing counts to Firestore; we compute locally to prevent racing state
        }
      }
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(student => {
        const matchesName = student.name.toLowerCase().includes(query);
        const matchesGrade = String(student.grade).toLowerCase().includes(query);
        const matchesAge = String(student.age || '').includes(query);
        const matchesLRN = String(student.lrn || '').toLowerCase().includes(query);
        const matchesParentName = String(student.parentName || '').toLowerCase().includes(query);
        return matchesName || matchesGrade || matchesAge || matchesLRN || matchesParentName;
      });
    }
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'readingLevel-desc':
          // Ensure readingLevel is treated as a number for comparison if possible, or string otherwise
          return (Number(b.readingLevel) || 0) - (Number(a.readingLevel) || 0);
        case 'readingLevel-asc':
          return (Number(a.readingLevel) || 0) - (Number(b.readingLevel) || 0);
        case 'age':
          return (a.age || 0) - (b.age || 0);
        default:
          return 0;
      }
    });
    setFilteredStudents(filtered);
    setIsFilteringStudents(false);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file type
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv' // .csv
    ];

    if (!allowedTypes.includes(file.type)) {
      return;
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return;
    }

    setIsImporting(true);

    try {
      const data = await readExcelFile(file);
      setImportedStudents(data);
      // compute duplicate stats (within file and against existing students fetched fresh)
      const keyFromImported = (s: ImportedStudent) => (s.lrn && String(s.lrn).trim()) || ((s.firstName || '').trim().toLowerCase() + ' ' + (s.lastName || '').trim().toLowerCase()).trim();
      const keyFromExisting = (s: Student) => (s.lrn && String(s.lrn).trim()) || (s.name ? s.name.trim().toLowerCase() : '');
      // within-file duplicates
      const seen = new Map<string, ImportedStudent>();
      const withinDup: ImportedStudent[] = [];
      for (const s of data) {
        const k = keyFromImported(s);
        if (!k) continue;
        if (seen.has(k)) withinDup.push(s); else seen.set(k, s);
      }
      // existing duplicates (fetch current list to avoid stale state)
      let existingList: Student[] = [];
      try {
        if (currentUser?.uid) existingList = await studentService.getStudents(currentUser.uid);
      } catch { }
      const existingKeys = new Set<string>((existingList || []).map(keyFromExisting));
      const existingDup: ImportedStudent[] = [];
      const unique: ImportedStudent[] = [];
      for (const s of data) {
        const k = keyFromImported(s);
        if (!k) continue;
        if (existingKeys.has(k)) { existingDup.push(s); continue; }
        if (withinDup.includes(s)) { continue; }
        unique.push(s);
      }
      setDuplicateStats({ within: withinDup.length, existing: existingDup.length });
      setDuplicateDetails({ within: withinDup, existing: existingDup, unique });
      setShowImportPreview(true);
    } catch (error) {
    } finally {
      setIsImporting(false);
    }
  };

  const readExcelFile = (file: File): Promise<ImportedStudent[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          const students = jsonData.map((row: any) => {
            const firstName = (row['First Name'] || row['first name'] || row['FirstName'] || row['firstname'] || '').trim();
            const lastName = (row['Last Name'] || row['last name'] || row['LastName'] || row['lastname'] || '').trim();
            const lrn = (row.LRN || row.lrn || '').trim();
            const age = parseInt((row.Age || row.age || '10').toString().trim()) || 10;

            // Combine first and last name
            const fullName = [firstName, lastName].filter(Boolean).join(' ');

            return {
              name: fullName,
              firstName: firstName,
              lastName: lastName,
              grade: row.Grade || row.grade || '',
              readingLevel: String(row.ReadingLevel || row.readingLevel || '').replace('Level ', '').trim() as string,
              lrn: lrn,
              age: age,
              // parentId and parentName can be added here if available in import
            };
          });
          // Sort A-Z by default (First Name, then Last Name)
          students.sort((a: ImportedStudent, b: ImportedStudent) => {
            const aFirst = (a.firstName || '').toString();
            const bFirst = (b.firstName || '').toString();
            const cmpFirst = aFirst.localeCompare(bFirst, undefined, { sensitivity: 'base' });
            if (cmpFirst !== 0) return cmpFirst;
            const aLast = (a.lastName || '').toString();
            const bLast = (b.lastName || '').toString();
            return aLast.localeCompare(bLast, undefined, { sensitivity: 'base' });
          });
          resolve(students);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsBinaryString(file);
    });
  };

  const handleImportStudents = async () => {
    if (!currentUser?.uid) return;
    if (!selectedGrade || selectedGrade === 'all') {
      await Swal.fire({
        icon: 'warning',
        title: 'No Class Selected',
        text: 'Please select a class before importing students.'
      });
      return;
    }
    // Get the selected grade object
    const gradeObj = grades.find(g => g.id === selectedGrade);
    if (!gradeObj) {
      await Swal.fire({
        icon: 'warning',
        title: 'Invalid Class',
        text: 'The selected class could not be found.'
      });
      return;
    }

    setIsImporting(true);
    // Connectivity helpers: active ping to detect true connectivity (not just navigator.onLine)
    const pingOnline = async (timeoutMs = 2500): Promise<boolean> => {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), timeoutMs);
      try {
        await fetch('https://www.gstatic.com/generate_204', {
          method: 'GET',
          mode: 'no-cors',
          cache: 'no-store',
          signal: controller.signal
        });
        clearTimeout(t);
        return true; // if fetch resolves, assume reachable
      } catch {
        clearTimeout(t);
        return false;
      }
    };

    // Wait until connectivity is restored; returns false if user cancels
    const waitForConnectivity = async (): Promise<boolean> => {
      const show = async () => Swal.fire({
        icon: 'info',
        title: 'Reconnecting... Please wait',
        html: '<div class="text-gray-600">Connection lost. We\'ll resume the import automatically once you\'re back online.</div>',
        allowOutsideClick: false,
        showCancelButton: true,
        cancelButtonText: 'Cancel Import',
        confirmButtonText: 'Waiting...'
      });
      await show();
      return new Promise<boolean>((resolve) => {
        let stopped = false;
        const clearAll = () => { stopped = true; Swal.close(); };
        const tick = async () => {
          if (stopped) return;
          const ok = await pingOnline();
          if (ok) { clearAll(); resolve(true); return; }
          setTimeout(tick, 1500);
        };
        tick();
        // cancel by clicking the cancel button
        (async () => {
          const popup = (Swal as any).getPopup?.();
          if (!popup) return;
          // Observe cancel clicks by intercepting dismissal
          const id = setInterval(() => {
            const isHidden = !document.body.contains(popup);
            if (isHidden && !stopped) { // dismissed
              clearInterval(id);
              stopped = true;
              resolve(false);
            }
          }, 300);
        })();
      });
    };

    try {
      // Filter out duplicates before import (by LRN or Name)
      const key = (s: ImportedStudent) => (s.lrn && String(s.lrn).trim()) || (s.name ? s.name.trim().toLowerCase() : '');
      const existingKeys = new Set<string>((students || []).map(s => (s.lrn && String(s.lrn).trim()) || (s.name ? s.name.trim().toLowerCase() : '')));
      const withinSeen = new Set<string>();
      const uniqueToImport = importedStudents.filter((s) => {
        const k = key(s);
        if (!k) return false;
        if (withinSeen.has(k)) return false;
        withinSeen.add(k);
        if (existingKeys.has(k)) return false;
        return true;
      });

      // Process import in chunks with offline awareness
      const CHUNK = 100;
      const createdStudentIds: string[] = [];
      for (let i = 0; i < uniqueToImport.length; i += CHUNK) {
        // Wait for connectivity before each chunk
        if (!(await pingOnline())) {
          const ok = await waitForConnectivity();
          if (!ok) {
            // Rollback any created docs/links
            try {
              if (createdStudentIds.length) await studentService.batchDeleteStudents(createdStudentIds);
              if (createdStudentIds.length) await gradeService.batchRemoveStudentsFromGrade(selectedGrade, createdStudentIds);
            } catch { }
            showError('Import Cancelled', 'The import was cancelled and any partial data was removed.');
            return;
          }
        }
        const slice = uniqueToImport.slice(i, i + CHUNK);
        // Create/update students, returns ids in order matching slice
        const ids = await studentService.importStudents(
          slice.map(s => ({ ...s, grade: gradeObj.name })),
          currentUser.uid
        );
        createdStudentIds.push(...ids);
        const entries = ids.map((id, idx) => ({ studentId: id, name: slice[idx].name }));
        await gradeService.batchAddStudentsToGrade(selectedGrade, entries);
      }
      // Reload students and statistics
      await loadStudents();
      await loadClassStatistics();
      // No Firestore count write; counts are computed locally from roster subscription
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      showSuccess('Import Complete', 'Students imported successfully!');
    } catch (error) {
      console.error('Error importing students:', error);
      // If currently offline, wait until online and ask the user
      if (!(await pingOnline())) {
        const ok = await waitForConnectivity();
        if (ok) {
          // Retry once by re-invoking the import
          await handleImportStudents();
          return;
        }
        showError('Import Cancelled', 'The import was cancelled while offline.');
      } else {
        showError('Import Failed', 'An error occurred during student import. Please try again.');
      }
    } finally {
      setIsImporting(false);
      setShowImportPreview(false); // Close the preview modal after import attempt
      setImportedStudents([]); // Clear imported students data
    }
  };

  const handleCancelImport = () => {
    setShowImportPreview(false);
    setImportedStudents([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleEditStudent = async (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    if (!student) {
      showError('Not Found', 'Student not found.');
      return;
    }

    setEditingStudent(student);
    setEditForm({
      name: student.name || '',
      lrn: student.lrn || ''
    });
  };

  const handleSaveEdit = async () => {
    if (!editingStudent?.id) return;

    // Validate required fields
    if (!editForm.name.trim()) {
      showError('Validation Error', 'Student name is required.');
      return;
    }

    try {
      setLoadingStudentId(editingStudent.id);

      // Update student with only name (LRN cannot be changed as it's the document ID)
      await studentService.updateStudent(editingStudent.id, {
        name: editForm.name.trim()
        // Note: LRN is not updated as it's the document ID
      });

      // Update local state (LRN remains unchanged)
      setStudents(prev => prev.map(s =>
        s.id === editingStudent.id
          ? { ...s, name: editForm.name.trim() }
          : s
      ));

      // Close modal
      setEditingStudent(null);
      setEditForm({ name: '', lrn: '' });

      showSuccess('Updated', 'Student information updated successfully.');
    } catch (error) {
      console.error('Error updating student:', error);
      showError('Update Failed', 'Failed to update student information.');
    } finally {
      setLoadingStudentId(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingStudent(null);
    setEditForm({ name: '', lrn: '' });
  };

  const handleGenerateForm = useCallback(async (student: Student) => {
    if (!student.id) {
      showError('Invalid Student', 'Student ID is required to generate form.');
      return;
    }

    try {
      setLoadingStudentId(student.id);
      setSelectedFormStudent(student);
      setFormModalOpen(true);

      // Show loading state while generating form data
      setFormData(null);

      // Generate form data asynchronously
      const { formData: generatedFormData, hasISRData: hasData } = await generatePhilIRIForm(student);
      setFormData(generatedFormData);
      setHasISRData(hasData);
    } catch (error) {
      console.error('Error generating form:', error);
      showError('Form Generation Failed', 'Failed to generate Phil-IRI Form 3A. Please try again.');
      setFormModalOpen(false);
      setSelectedFormStudent(null);
    } finally {
      setLoadingStudentId(null);
    }
  }, []);

  const generatePhilIRIForm = useCallback(async (student: Student): Promise<{ formData: any; hasISRData: boolean }> => {
    // Fetch ISR results for this student
    let latestISRResult: ISRResult | null = null;

    try {
      if (student.id) {
        const isrResults = await isrResultService.getISRResultsByStudent(student.id);
        // Get the most recent result (sorted by createdAt descending)
        if (isrResults && isrResults.length > 0) {
          // Sort by createdAt to get the latest
          const sorted = isrResults.sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateB - dateA;
          });
          latestISRResult = sorted[0];
        }
      }
    } catch (error) {
      console.error('Error fetching ISR results:', error);
      // Continue with default values if fetch fails
    }

    // Helper functions for fallback/default values
    const formatReadingTime = (readingTime?: string) => {
      return readingTime || '1:50 minuto';
    };

    const formatReadingRate = (readingRate?: number) => {
      if (readingRate !== undefined && readingRate !== null) {
        return `${readingRate} salita /minuto`;
      }
      return '78 salita /minuto';
    };

    const formatWordReadingScore = (score?: number) => {
      if (score !== undefined && score !== null) {
        return `${score.toFixed(2)}%`;
      }
      return '93.75%';
    };

    // If we have an ISR result, use it; otherwise use defaults
    if (latestISRResult) {
      return {
        formData: {
          studentName: latestISRResult.studentName || student.name || '',
          formTitle: latestISRResult.formTitle || 'Phil-IRI Form 3A',
          sessionTitle: latestISRResult.sessionTitle || '',
          assessmentDate: latestISRResult.assessmentDate || latestISRResult.createdAt || null,
          book: latestISRResult.book || '',
          partA: {
            readingTime: formatReadingTime(latestISRResult.partA.readingTime),
            readingRate: formatReadingRate(latestISRResult.partA.readingRate),
            correctAnswers: latestISRResult.partA.correctAnswers || 0,
            percentage: latestISRResult.partA.percentage || 0,
            comprehensionLevel: latestISRResult.partA.comprehensionLevel || 'Frustration',
            answers: latestISRResult.partA.answers || []
          },
          partB: {
            wordReading: {
              selection: latestISRResult.partB.wordReading.selection || 'Isang Pangako',
              level: latestISRResult.partB.wordReading.level || '4',
              set: latestISRResult.partB.wordReading.set || 'A'
            },
            miscues: {
              mispronunciation: latestISRResult.partB.miscues.mispronunciation || 0,
              omission: latestISRResult.partB.miscues.omission || 0,
              substitution: latestISRResult.partB.miscues.substitution || 0,
              insertion: latestISRResult.partB.miscues.insertion || 0,
              repetition: latestISRResult.partB.miscues.repetition || 0,
              transposition: latestISRResult.partB.miscues.transposition || 0,
              reversal: latestISRResult.partB.miscues.reversal || 0,
              totalMiscues: latestISRResult.partB.miscues.totalMiscues || 0,
              // Note: These fields are in partB in ISR result, but form expects them in miscues
              wordsInPassage: latestISRResult.partB.wordsInPassage || 0,
              wordReadingScore: formatWordReadingScore(latestISRResult.partB.wordReadingScore),
              wordReadingLevel: latestISRResult.partB.wordReadingLevel || 'Frustration'
            }
          }
        },
        hasISRData: true
      };
    }

    // Fallback to blank template if no ISR result found
    return {
      formData: {
        studentName: student.name || '',
        formTitle: 'Phil-IRI Form 3A',
        partA: {
          readingTime: '',
          readingRate: '',
          correctAnswers: 0,
          percentage: 0,
          comprehensionLevel: 'Frustration' as const,
          answers: []
        },
        partB: {
          wordReading: {
            selection: '',
            level: '',
            set: 'A' as const
          },
          miscues: {
            mispronunciation: 0,
            omission: 0,
            substitution: 0,
            insertion: 0,
            repetition: 0,
            transposition: 0,
            reversal: 0,
            totalMiscues: 0,
            wordsInPassage: 0,
            wordReadingScore: '',
            wordReadingLevel: 'Frustration' as const
          }
        }
      },
      hasISRData: false
    };
  }, []);

  const handleCloseForm = () => {
    setFormModalOpen(false);
    setSelectedFormStudent(null);
    setFormData(null);
    setHasISRData(false);
  };

  const handlePrintForm = () => {
    if (!formData) return;

    // Create optimized print styles
    const printStyleId = 'phil-iri-print-styles';
    let existingStyle = document.getElementById(printStyleId);

    if (!existingStyle) {
      const printStyles = document.createElement('style');
      printStyles.id = printStyleId;
      printStyles.textContent = `
        @media print {
          * { 
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          body * { visibility: hidden; }
          .print-content, .print-content * { visibility: visible; }
          .print-content { 
            position: absolute; 
            left: 50% !important;
            top: 50% !important;
            width: 100% !important; 
            max-width: 8.5in !important;
            background: white !important;
            border: 1px solid black !important;
            font-family: 'Courier New', monospace !important;
            font-size: 10px !important;
            line-height: 1.2 !important;
            padding: 0.5in !important;
            margin: 0 !important;
            box-sizing: border-box !important;
            transform: translate(-50%, -50%) scale(0.85) !important;
            transform-origin: center center !important;
          }
          .no-print { display: none !important; }
          @page { 
            margin: 0.5in !important; 
            size: A4 !important;
          }
          table { 
            border-collapse: collapse !important; 
            width: 100% !important;
            font-size: 9px !important;
          }
          table td, table th {
            padding: 4px !important;
            font-size: 9px !important;
          }
          .underline {
            border-bottom: 1px solid black !important;
            text-decoration: none !important;
            display: inline-block !important;
          }
          .mb-6, .mb-8 {
            margin-bottom: 0.5rem !important;
          }
          .mb-4 {
            margin-bottom: 0.3rem !important;
          }
          .space-y-2 > * + * {
            margin-top: 0.2rem !important;
          }
        }
      `;
      document.head.appendChild(printStyles);
    }

    window.print();
  };

  const handleViewProfile = async (studentId: string) => {
    setLoadingStudentId(studentId);
    try {
      // Fetch the student object
      const student = students.find(s => s.id === studentId);
      if (!student) {
        showError('Not Found', 'Student not found.');
        setLoadingStudentId(null);
        return;
      }

      // Prepare parent details if linked
      let parentDetails: import('../../services/authService').UserProfile | null = null;
      if (student.parentId) {
        // Fetch all parents and find the matching one
        const parents = await getAllParents();
        parentDetails = parents.find((p: any) => p.id === student.parentId) as import('../../services/authService').UserProfile | null;
      }

      // Build HTML for modal
      const studentInfoHtml = `
        <div class="p-0 sm:p-2 md:p-4 bg-white rounded-b-xl -mt-4">
          <div class="max-w-2xl mx-auto">
            <div class="mb-6">
              <div class="text-lg font-bold text-gray-900 mb-2">Student Details</div>
              <div class="space-y-2">
                <div class="flex justify-between"><span class="font-semibold text-gray-700">Name</span><span class="text-gray-900">${student.name.replace(/\|/g, ' ')}</span></div>
                <div class="flex justify-between"><span class="font-semibold text-gray-700">Grade</span><span class="text-gray-900">${student.grade}</span></div>
                <div class="flex justify-between"><span class="font-semibold text-gray-700">Reading Level</span><span class="text-gray-900">${student.readingLevel}</span></div>
                <div class="flex justify-between"><span class="font-semibold text-gray-700">Age</span><span class="text-gray-900">${student.age || 'N/A'}</span></div>
                <div class="flex justify-between"><span class="font-semibold text-gray-700">Status</span><span class="text-gray-900">${student.status}</span></div>
                <div class="flex justify-between"><span class="font-semibold text-gray-700">Last Assessment</span><span class="text-gray-900">${student.lastAssessment}</span></div>
              </div>
            </div>
            <hr class="my-4" />
            <div class="mb-2">
              <div class="text-lg font-bold text-gray-900 mb-2">Parent Details</div>
              ${parentDetails ? `
                <div class="space-y-2">
                  <div class="flex justify-between"><span class="font-semibold text-gray-700">Name</span><span class="text-gray-900">${parentDetails.displayName || ''}</span></div>
                  <div class="flex justify-between"><span class="font-semibold text-gray-700">Email</span><span class="text-gray-900">${parentDetails.email || ''}${parentDetails.email ? ' <span style=\'color:green;\'>&#10003;</span>' : ''}</span></div>
                  <div class="flex justify-between"><span class="font-semibold text-gray-700">Phone</span><span class="text-gray-900">${parentDetails.phoneNumber || ''}${parentDetails.phoneNumber ? ' <span style=\'color:green;\'>&#10003;</span>' : ''}</span></div>
                </div>
              ` : '<div class="italic text-gray-500">No parent linked.</div>'}
            </div>
          </div>
        </div>
      `;

      setLoadingStudentId(null); // Stop loading before showing modal
      await Swal.fire({
        title: 'Student Profile',
        html: studentInfoHtml,
        showCloseButton: true,
        showConfirmButton: false,
        customClass: {
          popup: 'rounded-xl',
          title: 'text-white text-xl font-semibold',
        },
        width: '40rem',
        backdrop: 'rgba(0,0,0,0.6)',
        background: '#fff',
        didOpen: (modalElement) => {
          const title = modalElement.querySelector('.swal2-title') as HTMLElement;
          if (title) {
            title.style.background = '#34495E';
            title.style.padding = '1rem 1.5rem';
            title.style.borderRadius = '0.75rem 0.75rem 0 0';
          }
        },
      });
    } catch (error) {
      showError('Error', 'Failed to load student details.');
      setLoadingStudentId(null);
    }
  };

  const handleArchiveAllStudents = async () => {
    const result = await showConfirmation(
      'Archive All Students',
      'Archiving hides students from this class but keeps their records and progress. You can restore them later from Archived.',
      'Archive',
      'Cancel',
      'warning'
    );
    if (result.isConfirmed) {
      setDeletingAllStudents(true);
      try {
        const ids = students.map(s => s.id).filter((id): id is string => Boolean(id));
        if (ids.length > 0) {
          // 1. Flag student docs as archived
          await studentService.batchSetArchived(ids, true);
          // 2. Remove from the grade's subcollection roster
          const studentsInGrade = await gradeService.getStudentsInGrade(selectedGrade);
          for (const s of studentsInGrade) {
            await gradeService.removeStudentFromGrade(selectedGrade, s.studentId);
          }
          // 3. Update count
          const updatedStudentsInGrade = await gradeService.getStudentsInGrade(selectedGrade);
          await gradeService.updateStudentCount(selectedGrade, updatedStudentsInGrade.length);
        }
        await loadGrades();
        await Swal.fire({
          icon: 'success',
          title: 'Archived',
          text: 'All students have been archived. You can restore them later.',
          timer: 1800,
          showConfirmButton: false
        });
        setFilteredStudents([]);
        setStudents([]);
        await loadStudents();
        await loadClassStatistics();
      } catch (error) {
        showError('Failed to Archive', 'An error occurred while archiving students.');
      } finally {
        setDeletingAllStudents(false);
      }
    }
  };

  const handleArchiveStudent = async (studentId: string, studentName: string) => {
    const result = await showConfirmation(
      'Archive Student',
      `Archive ${studentName}? They will be hidden from this class but their progress is kept.`,
      'Archive',
      'Cancel',
      'warning'
    );
    if (!result.isConfirmed) return;
    try {
      // Optimistic update
      setActionLoadingStudentId(studentId);
      setStudents(prev => prev.map(s => s.id === studentId ? ({ ...s, archived: true } as any) : s));
      await studentService.batchSetArchived([studentId], true);
      if (selectedGrade && selectedGrade !== 'all') {
        try {
          await gradeService.removeStudentFromGrade(selectedGrade, studentId);
          // No Firestore count write
        } catch { }
      }
      showSuccess('Archived', `${studentName} was archived.`);
      await loadStudents();
      await loadGrades();
    } catch (e) {
      showError('Failed to Archive', 'Could not archive this student.');
      // Revert optimistic update on error
      setStudents(prev => prev.map(s => s.id === studentId ? ({ ...s, archived: false } as any) : s));
    } finally {
      setActionLoadingStudentId(null);
    }
  };

  const handleRestoreStudent = async (studentId: string, studentName: string) => {
    const result = await showConfirmation(
      'Restore Student',
      `Restore ${studentName} back to this class roster?`,
      'Restore',
      'Cancel',
      'question'
    );
    if (!result.isConfirmed) return;
    try {
      // Optimistic update
      setActionLoadingStudentId(studentId);
      setStudents(prev => prev.map(s => s.id === studentId ? ({ ...s, archived: false } as any) : s));
      await studentService.batchSetArchived([studentId], false);
      if (selectedGrade && selectedGrade !== 'all') {
        try {
          await gradeService.addStudentToGrade(selectedGrade, studentId);
          // No Firestore count write
        } catch { }
      }
      showSuccess('Restored', `${studentName} was restored.`);
      await loadStudents();
      await loadGrades();
    } catch (e) {
      showError('Failed to Restore', 'Could not restore this student.');
      // Revert optimistic update on error
      setStudents(prev => prev.map(s => s.id === studentId ? ({ ...s, archived: true } as any) : s));
    } finally {
      setActionLoadingStudentId(null);
    }
  };

  /* removed unused handleDeleteStudent to satisfy linter */
  /*
  const handleDeleteStudent = async (studentId: string, studentName: string) => {
    const result = await showConfirmation(
      'Delete Student',
      `Are you sure you want to remove ${studentName} from the class? This action cannot be undone.`,
      'Delete',
      'Cancel',
      'warning'
    );
    if (result.isConfirmed) {
      try {
        Swal.fire({
          title: 'Deleting Student',
          text: 'Please wait...', 
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          }
        });
        await studentService.deleteStudent(studentId);
        Swal.close();
        showSuccess('Student Removed', `${studentName} has been removed from the class.`);
        setFilteredStudents(prev => prev.filter(s => s.id !== studentId));
        setStudents(prev => prev.filter(s => s.id !== studentId));
        await loadGrades();
        await loadClassStatistics();
        // No Firestore count write
      } catch (error) {
        Swal.close();
        showError('Failed to Remove', 'An error occurred while removing the student.');
      }
    }
  };
  */


  // Load grades and their student counts
  const loadGrades = async () => {
    if (!currentUser?.uid) return;
    try {
      console.log('🔍 Loading classes for teacher:', currentUser.uid);

      // Get teacher's grade level from profile
      let teacherGradeLevel: string | null = null;
      try {
        const profile = await getUserProfile();
        teacherGradeLevel = profile?.gradeLevel?.toString() || null;
        console.log('👨‍🏫 Teacher grade level:', teacherGradeLevel);
      } catch (error) {
        console.warn('Could not fetch teacher profile:', error);
      }

      const gradesData = await gradeService.getGradesByTeacherAll(currentUser.uid); // include active and archived
      console.log('📚 Loaded classes:', gradesData.length);
      console.log('Classes details:', gradesData.map(g => ({
        id: g.id,
        name: g.name,
        teacherId: g.teacherId,
        matchesCurrentTeacher: g.teacherId === currentUser.uid
      })));

      // FILTER 1: Ensure only classes for this teacher
      let filteredGrades = gradesData.filter(g => g.teacherId === currentUser.uid);

      // FILTER 2: Filter by teacher's grade level
      if (teacherGradeLevel) {
        const gradeNumber = teacherGradeLevel.toString().replace(/[^0-9]/g, '');
        console.log('🎯 Filtering classes for Grade', gradeNumber);

        filteredGrades = filteredGrades.filter(g => {
          // Extract grade number from class name (e.g., "Grade 4 - Narra" -> "4")
          const classGradeMatch = g.name.match(/Grade\s*(\d+)/i) || g.name.match(/^(\d+)/);
          const classGradeNumber = classGradeMatch ? classGradeMatch[1] : null;

          const matches = classGradeNumber === gradeNumber;
          console.log(`  Class "${g.name}" (Grade ${classGradeNumber}) ${matches ? '✓' : '✗'} matches teacher grade ${gradeNumber}`);
          return matches;
        });
      }

      console.log('✅ Filtered classes:', filteredGrades.length);

      // Continue with filtered grades
      console.log('Grades loaded successfully:', filteredGrades);
      // Get all students for the teacher
      let allStudents: Student[] = students;
      if (!allStudents.length && currentUser?.uid) {
        allStudents = await studentService.getStudents(currentUser.uid);
      }
      // Get student counts for each grade
      const gradesWithCounts = await Promise.all(filteredGrades.map(async (grade) => {
        try {
          if (grade.id) {
            // counts handled via realtime subscription; return grade as-is
            return grade;
          }
          return grade;
        } catch (error) {
          console.error(`Error getting students for grade ${grade.name}:`, error);
          return grade;
        }
      }));
      console.log('Grades with counts:', gradesWithCounts);
      setGrades(gradesWithCounts);
      if (gradesWithCounts.length === 0) {
        console.log('No grades found in database');
      }
    } catch (error) {
      console.error('Error loading grades:', error);
      setGrades([]);
    }
  };

  // Handle grade selection
  const handleGradeSelect = async (gradeId: string) => {
    setSelectedGrade(gradeId);
    try {
      const studentsInGrade = await gradeService.getStudentsInGrade(gradeId);
      const studentIds = studentsInGrade.map(s => s.studentId);
      const gradeStudents = students.filter(student => student.id && studentIds.includes(student.id));
      // Sort students by name A-Z
      gradeStudents.sort((a, b) => a.name.localeCompare(b.name));
      setFilteredStudents(gradeStudents);
    } catch (error) {
      setFilteredStudents([]);
    }
  };


  // Archive grade: remove student links but keep students and mark grade inactive
  const handleArchiveGrade = async (gradeId: string, gradeName: string) => {
    const section = getSectionName(gradeName);
    const result = await showConfirmation(
      'Archive Class',
      `This will move "${section}" and all students in it to your Archived classes. You can bring them back anytime from the Archived tab.`,
      'Archive',
      'Cancel',
      'warning'
    );
    if (result.isConfirmed) {
      try {
        await gradeService.archiveGrade(gradeId);
        showSuccess('Class Archived', `"${gradeName}" has been archived.`);
        await loadGrades();
        await loadStudents();
        await loadClassStatistics();
      } catch (error: any) {
        const errorMsg = error && error.message ? error.message : 'An error occurred while archiving the class.';
        showError('Failed to Archive', errorMsg);
      }
    }
  };

  // Permanently delete an archived grade
  const handleDeleteArchivedGrade = async (gradeId: string, gradeName: string) => {
    const section = getSectionName(gradeName);
    const confirm = await Swal.fire({
      title: 'Delete Archived Class',
      html: `This will permanently remove "<strong>${section}</strong>" and all students in it from your account.<br/>To confirm, type <strong>Delete</strong>.`,
      input: 'text',
      inputPlaceholder: 'Delete',
      inputAttributes: { 'aria-label': 'Type Delete to confirm' },
      showCancelButton: true,
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
      icon: 'warning',
      didOpen: () => {
        // Inject lightweight styles for the success animation once
        const styleId = 'swal-match-anim-style';
        if (!document.getElementById(styleId)) {
          const style = document.createElement('style');
          style.id = styleId;
          style.textContent = `
            @keyframes swalPulse { 0%{box-shadow:0 0 0 0 rgba(239,68,68,.6);} 70%{box-shadow:0 0 0 8px rgba(239,68,68,0);} 100%{box-shadow:0 0 0 0 rgba(239,68,68,0);} }
            .swal-input-ok { border-color:#ef4444 !important; color:#ef4444; font-weight:700; animation: swalPulse .9s ease-out 1; }
            .swal-confirm-ok { transform: scale(1.04); transition: transform .15s ease; }
          `;
          document.head.appendChild(style);
        }
        const inputEl = Swal.getInput();
        const btn = Swal.getConfirmButton();
        if (inputEl && btn) {
          inputEl.addEventListener('input', () => {
            const val = (inputEl as HTMLInputElement).value.trim().toLowerCase();
            if (val === 'delete') {
              inputEl.classList.add('swal-input-ok');
              btn.classList.add('swal-confirm-ok');
            } else {
              inputEl.classList.remove('swal-input-ok');
              btn.classList.remove('swal-confirm-ok');
            }
          });
        }
      },
      preConfirm: (value) => {
        if ((value || '').trim().toLowerCase() !== 'delete') {
          Swal.showValidationMessage('Please type Delete to confirm');
          return false;
        }
        return true;
      }
    });
    if (!confirm.isConfirmed) return;

    try {
      await gradeService.deleteArchivedGradeAndStudents(gradeId);
      showSuccess('Deleted', `"${gradeName}" and its students have been permanently removed.`);
      await loadGrades();
      await loadClassStatistics();
    } catch (error: any) {
      const errorMsg = error && error.message ? error.message : 'An error occurred while deleting the archived class.';
      showError('Failed to Delete', errorMsg);
    }
  };

  // Add new grade
  const handleAddGrade = async () => {
    // Set loading state *after* preConfirm, just before API call
    try {
      // Determine teacher's grade level from profile and lock it
      const teacherProfile: any = await (getUserProfile() as Promise<any>);
      const teacherGradeRaw = String(teacherProfile?.gradeLevel || '').trim();
      if (!teacherGradeRaw) {
        await Swal.fire({
          icon: 'warning',
          title: 'Set Grade Level',
          text: 'Please set your Grade Level in your Profile first.',
          confirmButtonText: 'OK'
        });
        return;
      }
      const lockedGradeLevel = teacherGradeRaw.toLowerCase().startsWith('grade')
        ? teacherGradeRaw
        : `Grade ${teacherGradeRaw}`;

      const { value: formValues } = await Swal.fire({
        title: 'Create New Class',
        customClass: {
          popup: 'rounded-2xl shadow-2xl border border-gray-200',
          title: 'text-white text-xl font-bold',
          confirmButton: 'px-5 py-2.5 text-sm font-semibold bg-white text-indigo-600 rounded-lg shadow-md hover:bg-white/90 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200',
          cancelButton: 'px-5 py-2.5 text-sm font-semibold bg-gray-100 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-200 transition-all duration-200',
          closeButton: 'text-white hover:text-white/80',
        },
        backdrop: 'rgba(0,0,0,0.6)',
        background: '#fff',
        showCloseButton: true,
        html: `
          <div class="text-left p-6 bg-white rounded-b-2xl -mt-4">
            <div class="mb-5">
              <label class="block text-sm font-semibold text-gray-700 mb-2">Grade Level</label>
              <input id="grade-level" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg shadow-sm bg-gray-100 text-gray-700 cursor-not-allowed" value="${lockedGradeLevel}" disabled />
            </div>
            <div class="mb-5">
              <label class="block text-sm font-semibold text-gray-700 mb-2">
                Section <span class="text-red-500">*</span>
              </label>
              <input id="grade-section" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all" placeholder="e.g., Athena" />
            </div>
            <div class="mb-5">
              <label class="block text-sm font-semibold text-gray-700 mb-2">Description</label>
              <textarea
                id="grade-description"
                class="w-full px-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all resize-none"
                placeholder="e.g., First grade students"
                rows="3"
              ></textarea>
            </div>
            <div class="mb-5">
              <label class="block text-sm font-semibold text-gray-700 mb-2">
                Color <span class="text-red-500">*</span>
              </label>
              <select id="grade-color" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white">
                <option value="blue">Blue</option>
                <option value="green">Green</option>
                <option value="yellow">Yellow</option>
                <option value="purple">Purple</option>
                <option value="red">Red</option>
                <option value="gray">Gray</option>
              </select>
            </div>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: isCreatingGrade ? '<span class="inline-flex items-center"><span class="loader-spinner mr-2 w-4 h-4 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin"></span> Creating...</span>' : '<i class="fas fa-plus mr-2"></i>Create Grade',
        cancelButtonText: 'Cancel',
        focusConfirm: false,
        allowOutsideClick: !isCreatingGrade,
        didOpen: (modalElement) => {
          const title = modalElement.querySelector('.swal2-title') as HTMLElement;
          if (title) {
            title.style.background = 'linear-gradient(to right, #4f46e5, #7c3aed)';
            title.style.padding = '1.25rem 1.5rem';
            title.style.borderRadius = '0.875rem 0.875rem 0 0';
            title.style.display = 'flex';
            title.style.alignItems = 'center';
            title.style.gap = '0.75rem';
            title.innerHTML = `
              <div class="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-sm">
                <i class="fas fa-layer-group text-white text-lg"></i>
              </div>
              <div>
                <div class="text-xl font-bold">Create New Class</div>
                <div class="text-xs text-indigo-100 mt-0.5 font-normal">Set up a new class for your students</div>
              </div>
            `;
          }
        },
        preConfirm: () => {
          const gradeLevel = lockedGradeLevel;
          const section = (document.getElementById('grade-section') as HTMLInputElement).value.trim();
          const description = (document.getElementById('grade-description') as HTMLTextAreaElement).value;
          const color = (document.getElementById('grade-color') as HTMLSelectElement).value;
          if (!gradeLevel || !section || !color) {
            Swal.showValidationMessage('Please enter Section and select a Color');
            return false;
          }

          // Extract grade level number from the locked grade level
          const gradeLevelNumber = parseInt(gradeLevel.match(/\d+/)?.[0] || '0');
          if (gradeLevelNumber === 0) {
            Swal.showValidationMessage('Invalid grade level');
            return false;
          }

          // Enforce unique section name for this teacher (case-insensitive)
          const normalizedSection = section.toLowerCase();
          const duplicate = grades.some(g => {
            const existingSection = getSectionName(g.name).toLowerCase();
            return existingSection === normalizedSection;
          });
          if (duplicate) {
            Swal.showValidationMessage('Section name already exists. Please choose a different section.');
            return false;
          }
          // Set loading state here, just before the form is confirmed and API call is expected
          setIsCreatingGrade(true);
          return {
            name: `${gradeLevel} - ${section}`, // Keep for backward compatibility
            gradeLevel: gradeLevelNumber,
            section: section,
            description,
            color
          };
        }
      });
      if (formValues) {
        const gradeData = {
          name: formValues.name.trim(),
          description: (formValues.description || '').trim(),
          color: formValues.color,
          isActive: true,
          ageRange: '', // Provide empty string for required field
          studentCount: 0
        };
        await gradeService.createGrade(gradeData);
        await Swal.fire({
          icon: 'success',
          title: 'Grade Created!',
          text: `Successfully created ${gradeData.name}`,
          timer: 2000,
          showConfirmButton: false
        });
        await loadGrades();
      }
    } catch (error) {
      console.error('Error creating grade:', error);
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to create grade. Please try again.'
      });
    } finally {
      setIsCreatingGrade(false);
    }
  };

  // Get color classes for grade cards
  const getGradeColorClasses = (color: string) => {
    const colorMap: { [key: string]: string } = {
      blue: 'from-blue-50 to-indigo-50 border border-blue-200 text-blue-900',
      green: 'from-green-50 to-emerald-50 border border-green-200 text-green-900',
      yellow: 'from-yellow-50 to-orange-50 border border-yellow-200 text-yellow-900',
      purple: 'from-purple-50 to-pink-50 border border-purple-200 text-purple-900',
      red: 'from-red-50 to-rose-50 border border-red-200 text-red-900',
      gray: 'from-gray-50 to-slate-50 border border-gray-200 text-gray-900'
    };
    return colorMap[color] || colorMap.blue;
  };

  // Get badge color classes
  const getBadgeColorClasses = (color: string) => {
    const badgeMap: { [key: string]: string } = {
      blue: 'bg-blue-100 text-blue-800',
      green: 'bg-green-100 text-green-800',
      yellow: 'bg-yellow-100 text-yellow-800',
      purple: 'bg-purple-100 text-purple-800',
      red: 'bg-red-100 text-red-800',
      gray: 'bg-gray-100 text-gray-800'
    };
    return badgeMap[color] || badgeMap.blue;
  };

  // Load grades and subscribe for realtime updates to studentCount
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    (async () => {
      await loadGrades();
      if (currentUser?.uid) {
        unsubscribe = gradeService.subscribeToTeacherGrades(currentUser.uid, (gs) => {
          setGrades(gs);
          // If current selected grade exists, keep it; else switch to first
          if (gs.length > 0 && (!selectedGrade || !gs.find(g => g.id === selectedGrade))) {
            const fallback = showArchived ? gs.find(g => g.isActive === false) : gs.find(g => g.isActive !== false);
            setSelectedGrade(fallback?.id || gs[0].id || '');
          }
        });
      }
    })();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [currentUser?.uid, showArchived]);

  // Do not auto-select any class; wait for user to click a class card
  // Keep 'all' until a grade is explicitly selected
  useEffect(() => {
    if (!selectedGrade) setSelectedGrade('all');
  }, [selectedGrade]);

  const handleDeleteSelectedGrades = async () => {
    if (selectedGrades.length === 0) return;

    for (const gradeId of selectedGrades) {
      await gradeService.deleteGrade(gradeId);
    }

    setSelectedGrades([]);
    await loadGrades();
  };

  const handleRefresh = async () => {
    if (!currentUser?.uid || isRefreshing) return;

    setIsRefreshing(true);
    try {
      // Refresh all data in parallel
      await Promise.all([
        loadStudents(),
        loadGrades(),
        loadClassStatistics()
      ]);
    } catch (error) {
      console.error('Error refreshing data:', error);
      showError('Refresh Failed', 'An error occurred while refreshing data. Please try again.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleLinkParent = async (studentId: string) => {
    // Fetch real parents from Firebase
    const parents: { id: string; name: string; email: string }[] = (await getAllParents()).map((p: any) => ({
      id: p.id,
      name: p.displayName || p.name || '',
      email: p.email || '',
    }));

    let filteredParents = parents;

    const renderParentList = (searchValue: string) => {
      filteredParents = parents.filter(p =>
        p.name.toLowerCase().includes(searchValue.toLowerCase()) ||
        p.email.toLowerCase().includes(searchValue.toLowerCase())
      );
      return `
        <div class="text-left p-6 bg-white rounded-b-2xl -mt-4">
          <div class="relative mb-4">
            <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <i class="fas fa-search text-gray-400"></i>
            </div>
            <input id="swal-parent-search" class="w-full pl-11 pr-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all" placeholder="Search parent by name or email..." value="${searchValue}" />
          </div>
          <div style="max-height:280px;overflow-y:auto;" class="space-y-1">
            ${filteredParents.length === 0 ? `
              <div class="text-center py-8 text-gray-500">
                <i class="fas fa-user-slash text-3xl mb-2 text-gray-300"></i>
                <p class="text-sm">No parents found</p>
              </div>
            ` : filteredParents.map(p => `
              <label for="parent-${p.id}" class="flex items-center space-x-3 py-3 px-4 rounded-lg hover:bg-indigo-50 border border-transparent hover:border-indigo-200 transition-all cursor-pointer">
                <input type="radio" name="parent" value="${p.id}" id="parent-${p.id}" class="accent-indigo-600 w-4 h-4" />
                <div class="flex flex-col flex-1">
                  <span class="font-semibold text-gray-900">${p.name}</span>
                  <span class="text-xs text-gray-500 mt-0.5">${p.email}</span>
                </div>
                <i class="fas fa-check-circle text-indigo-600 opacity-0 parent-check pointer-events-none"></i>
              </label>
            `).join('')}
          </div>
        </div>
      `;
    };

    await Swal.fire({
      title: 'Link Parent',
      customClass: {
        popup: 'rounded-2xl shadow-2xl border border-gray-200',
        title: 'text-white text-xl font-bold',
        confirmButton: 'px-5 py-2.5 text-sm font-semibold bg-white text-indigo-600 rounded-lg shadow-md hover:bg-white/90 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200',
        cancelButton: 'px-5 py-2.5 text-sm font-semibold bg-white/20 text-white border border-white/30 rounded-lg hover:bg-white/30 transition-all duration-200',
        closeButton: 'text-white hover:text-white/80',
      },
      backdrop: 'rgba(0,0,0,0.6)',
      background: '#fff',
      showCloseButton: true,
      html: renderParentList(''),
      showCancelButton: true,
      confirmButtonText: '<i class="fas fa-link mr-2"></i>Link',
      cancelButtonText: 'Cancel',
      focusConfirm: false,
      preConfirm: () => {
        const selected = (Swal.getPopup()?.querySelector('input[name="parent"]:checked') as HTMLInputElement)?.value;
        if (!selected) {
          Swal.showValidationMessage('Please select a parent');
          return false;
        }
        return selected;
      },
      didOpen: (modalElement) => {
        const input = Swal.getPopup()?.querySelector('#swal-parent-search') as HTMLInputElement;
        if (input) {
          input.focus();
          input.addEventListener('input', (e) => {
            const value = (e.target as HTMLInputElement).value;
            Swal.update({ html: renderParentList(value) });
            // Re-attach radio change listeners
            const radios = Swal.getPopup()?.querySelectorAll('input[name="parent"]');
            radios?.forEach(radio => {
              radio.addEventListener('change', function(this: HTMLInputElement) {
                const labels = Swal.getPopup()?.querySelectorAll('label');
                labels?.forEach(label => {
                  const check = label.querySelector('.parent-check');
                  if (check) check.classList.add('opacity-0');
                });
                const selectedLabel = this.closest('label');
                const check = selectedLabel?.querySelector('.parent-check');
                if (check) check.classList.remove('opacity-0');
              });
            });
          });
        }
        // Add radio change listeners
        const radios = Swal.getPopup()?.querySelectorAll('input[name="parent"]');
        radios?.forEach(radio => {
          radio.addEventListener('change', function(this: HTMLInputElement) {
            const labels = Swal.getPopup()?.querySelectorAll('label');
            labels?.forEach(label => {
              const check = label.querySelector('.parent-check');
              if (check) check.classList.add('opacity-0');
            });
            const selectedLabel = this.closest('label');
            const check = selectedLabel?.querySelector('.parent-check');
            if (check) check.classList.remove('opacity-0');
          });
        });
        // Adjust title bar background
        const title = modalElement.querySelector('.swal2-title') as HTMLElement;
        if (title) {
          title.style.background = 'linear-gradient(to right, #4f46e5, #7c3aed)';
          title.style.padding = '1.25rem 1.5rem';
          title.style.borderRadius = '0.875rem 0.875rem 0 0';
          title.style.display = 'flex';
          title.style.alignItems = 'center';
          title.style.gap = '0.75rem';
          title.innerHTML = `
            <div class="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <i class="fas fa-link text-white text-lg"></i>
            </div>
            <div>
              <div class="text-xl font-bold">Link Parent</div>
              <div class="text-xs text-indigo-100 mt-0.5 font-normal">Select a parent to link to this student</div>
            </div>
          `;
        }
      },
    }).then(async (result) => {
      if (result.isConfirmed && result.value) {
        const parent = parents.find(p => p.id === result.value);
        if (!parent) return;
        try {
          // Get student information for the notification
          const student = filteredStudents.find(s => s.id === studentId);
          const studentName = student?.name || 'Student';
          const teacherName = currentUser?.displayName || 'Teacher';

          await studentService.updateStudent(studentId, {
            parentId: parent.id,
            parentName: parent.name,
          });

          // Create notification for the parent
          await notificationService.createNotification({
            type: 'link_approved',
            title: 'Student Linked Successfully',
            message: `Your child ${studentName} has been linked to your account by ${teacherName}.`,
            userId: parent.id,
            isRead: false,
            data: {
              studentId: studentId,
              studentName: studentName,
              teacherName: teacherName,
              teacherId: currentUser?.uid,
              linkedAt: new Date().toISOString(),
              className: selectedGrade ? grades.find(g => g.id === selectedGrade)?.name : 'Class'
            }
          });

          // Also create an entry in parent's inbox for detailed view
          await addDoc(collection(db, 'parentInbox'), {
            recipientId: parent.id,
            senderId: currentUser?.uid,
            senderRole: 'teacher',
            senderName: teacherName,
            type: 'student_linked',
            title: 'Student Account Linked',
            message: `Your child ${studentName} has been successfully linked to your parent account. You can now view their progress and activities.`,
            category: 'link_requests',
            data: {
              studentId: studentId,
              studentName: studentName,
              teacherName: teacherName,
              teacherId: currentUser?.uid,
              linkedAt: serverTimestamp(),
              className: selectedGrade ? grades.find(g => g.id === selectedGrade)?.name : 'Class'
            },
            isRead: false,
            isArchived: false,
            createdAt: serverTimestamp(),
            priority: 'medium'
          });

          showSuccess('Parent linked!', `${parent.name} is now linked to this student and has been notified.`);
          await loadStudents();
        } catch (err) {
          showError('Failed to link parent', 'An error occurred while linking the parent.');
        }
      }
    });
  };

  const handleAddStudentsToGrade = async (gradeId: string, gradeName: string) => {
    setLoadingAddStudentToGradeId(gradeId); // Set loading for the icon here
    try {
      // Fetch all parents
      const parents: { id: string; name: string; email: string }[] = (await getAllParents()).map((p: any) => ({
        id: p.id,
        name: p.displayName || p.name || '',
        email: p.email || '',
      }));

      const { value: formValues } = await Swal.fire({
        title: `Add Student to ${gradeName}`,
        customClass: {
          popup: 'rounded-2xl shadow-2xl border border-gray-200',
          title: 'text-white text-xl font-bold',
          confirmButton: 'px-5 py-2.5 text-sm font-semibold bg-white text-indigo-600 rounded-lg shadow-md hover:bg-white/90 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200',
          cancelButton: 'px-5 py-2.5 text-sm font-semibold bg-gray-100 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-200 transition-all duration-200',
          closeButton: 'text-white hover:text-white/80',
        },
        backdrop: 'rgba(0,0,0,0.6)',
        background: '#fff',
        showCloseButton: true,
        html: `
          <div class="text-left p-6 bg-white rounded-b-2xl -mt-4">
            <div class="mb-5">
              <label class="block text-sm font-semibold text-gray-700 mb-2">
                Name <span class="text-red-500">*</span>
              </label>
              <input id="student-name" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all" placeholder="e.g., Juan Dela Cruz">
            </div>
            <div class="mb-5">
              <label class="block text-sm font-semibold text-gray-700 mb-2">
                LRN (Learner Reference Number) <span class="text-green-600 text-xs">(Auto-generated)</span>
              </label>
              <input id="student-lrn" readonly class="w-full px-4 py-2.5 border border-gray-300 rounded-lg shadow-sm bg-gray-50 text-gray-600 cursor-not-allowed" placeholder="Will be generated automatically">
              <p class="text-xs text-gray-500 mt-1">Format: [SchoolCode][Year][Sequence] - 12 digits, unique, no duplicates</p>
            </div>
            <div class="mb-5">
              <label class="block text-sm font-semibold text-gray-700 mb-2">Age</label>
              <input id="student-age" type="number" min="5" max="18" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all" placeholder="e.g., 10" value="10">
            </div>
            <div class="mb-5">
              <label class="block text-sm font-semibold text-gray-700 mb-2">Parent (optional)</label>
              <select id="student-parent-id" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white">
                <option value="">No parent</option>
                ${parents.map(p => `<option value="${p.id}">${p.name} (${p.email})</option>`).join('')}
              </select>
            </div>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: isAddingStudentToGrade ? '<span class="inline-flex items-center"><span class="loader-spinner mr-2 w-4 h-4 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin"></span> Adding...</span>' : 'Add',
        cancelButtonText: 'Cancel',
        focusConfirm: false,
        allowOutsideClick: !isAddingStudentToGrade,
        didOpen: async (modalElement) => {
          const title = modalElement.querySelector('.swal2-title') as HTMLElement;
          if (title) {
            // Clear any existing content first
            title.textContent = '';
            title.style.background = 'linear-gradient(to right, #4f46e5, #7c3aed)';
            title.style.padding = '1.25rem 1.5rem';
            title.style.borderRadius = '0.875rem 0.875rem 0 0';
            title.style.display = 'flex';
            title.style.alignItems = 'center';
            title.style.gap = '0.75rem';
            title.innerHTML = `
              <div class="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-sm">
                <i class="fas fa-user-plus text-white text-lg"></i>
              </div>
              <div>
                <div class="text-xl font-bold">Add Student to ${gradeName}</div>
                <div class="text-xs text-indigo-100 mt-0.5 font-normal">Fill in the student information below</div>
              </div>
            `;
          }
          
          // Hide any duplicate/invisible buttons or text in actions area
          const actions = modalElement.querySelector('.swal2-actions') as HTMLElement;
          if (actions) {
            // Remove any invisible or duplicate elements
            const allButtons = actions.querySelectorAll('button');
            allButtons.forEach((btn) => {
              // Keep only visible buttons, remove any with opacity-0 or display-none
              const style = window.getComputedStyle(btn);
              if (style.opacity === '0' || style.display === 'none' || style.visibility === 'hidden') {
                btn.style.pointerEvents = 'none';
                btn.style.display = 'none';
              }
            });
            
            // Also check for any invisible text nodes or spans
            const allElements = actions.querySelectorAll('*');
            allElements.forEach((el) => {
              const style = window.getComputedStyle(el);
              if (style.opacity === '0' && style.pointerEvents !== 'none') {
                (el as HTMLElement).style.pointerEvents = 'none';
              }
            });
          }
          
          // Also check the title area for any invisible text
          const titleArea = modalElement.querySelector('.swal2-title-container') as HTMLElement;
          if (titleArea) {
            const allTitleElements = titleArea.querySelectorAll('*');
            allTitleElements.forEach((el) => {
              const style = window.getComputedStyle(el);
              if (style.opacity === '0' && style.pointerEvents !== 'none') {
                (el as HTMLElement).style.pointerEvents = 'none';
              }
            });
          }
          
          // Generate and display LRN when modal opens
          try {
            // Get school code from teacher profile, default to '1023' if not set
            const schoolCode = (userProfile as any)?.schoolCode || '1023';
            if (!schoolCode || schoolCode.length !== 4) {
              console.warn('School code not set or invalid. Using default: 1023');
            }
            const lrn = await studentService.generateUniqueLRN(schoolCode);
            const lrnInput = document.getElementById('student-lrn') as HTMLInputElement;
            if (lrnInput) {
              lrnInput.value = lrn;
            }
          } catch (error) {
            console.error('Error generating LRN on modal open:', error);
          }
        },
        preConfirm: () => {
          // This is for the modal's confirm button loading state
          setIsAddingStudentToGrade(true);

          const name = (document.getElementById('student-name') as HTMLInputElement).value.trim();
          const lrn = (document.getElementById('student-lrn') as HTMLInputElement).value.trim();
          const age = parseInt((document.getElementById('student-age') as HTMLInputElement).value) || 10;
          const parentId = (document.getElementById('student-parent-id') as HTMLSelectElement).value;
          const parent = parents.find(p => p.id === parentId);

          if (!name) {
            Swal.showValidationMessage('Please fill in the student name');
            setIsAddingStudentToGrade(false); // Reset if validation fails
            return false;
          }

          if (!lrn || lrn.length !== 12) {
            Swal.showValidationMessage('LRN is required and must be 12 digits. Please refresh and try again.');
            setIsAddingStudentToGrade(false);
            return false;
          }

          return { name, lrn, age, parentId: parentId || undefined, parentName: parent ? parent.name : '' };
        }
      });

      if (formValues) {
        // Double-check LRN doesn't already exist (safety check)
        const lrnExists = await studentService.lrnExists(formValues.lrn);
        if (lrnExists) {
          showError('Duplicate LRN', 'This LRN already exists. Please try adding the student again.');
          return;
        }

        // Logic to add the student
        const newStudent = {
          name: formValues.name,
          lrn: formValues.lrn,
          grade: gradeName,
          readingLevel: 'Beginner', // Default reading level
          age: formValues.age,
          attendance: 0,
          lastAssessment: new Date().toISOString().split('T')[0],
          status: 'active' as const,
          teacherId: currentUser?.uid || '',
          parentId: formValues.parentId || undefined,
          parentName: formValues.parentName || '',
          performance: 'Good' as Student['performance'],
        };
        const studentId = await studentService.addStudent(newStudent);
        await gradeService.addStudentToGrade(gradeId, { studentId, name: formValues.name });
        showSuccess('Student Added', `${formValues.name} has been added to ${gradeName} with LRN: ${formValues.lrn}`);
        await loadStudents();
        await loadGrades();
        await loadClassStatistics();
      }
    } catch (err) {
      showError('Failed to Add', 'An error occurred while adding the student.');
    } finally {
      // Ensure icon's loading state is reset, even if Swal.fire was dismissed without confirming
      setLoadingAddStudentToGradeId(null);
      // Ensure modal's loading state is reset too if not already
      setIsAddingStudentToGrade(false);
    }
  };

  // Real-time student count updates for each grade
  useEffect(() => {
    if (!currentUser?.uid || grades.length === 0) return;
    const unsubscribes: (() => void)[] = [];
    const updateCounts = (gradeId: string) => {
      const studentsRef = collection(db, 'classGrades', gradeId, 'students');
      const unsubscribe = onSnapshot(studentsRef,
        (snapshot) => {
          // Count only non-archived students that actually exist in the teacher's list
          const studentIdsInRoster = snapshot.docs
            .map(d => (d.data() as any)?.studentId)
            .filter((v: any): v is string => Boolean(v));
          const uniqueRosterIds = Array.from(new Set(studentIdsInRoster));
          const nonArchivedCount = uniqueRosterIds.reduce((acc, sid) => {
            const s = students.find(st => st.id === sid);
            return acc + ((s && !(s as any).archived) ? 1 : 0);
          }, 0);
          setRosterCounts((prev) => ({ ...prev, [gradeId]: nonArchivedCount }));
        },
        (error) => {
          console.warn(`Permission denied for grade ${gradeId} students:`, error);
          // Don't update the count if permission is denied
        }
      );
      unsubscribes.push(unsubscribe);
    };
    grades.forEach((grade) => { if (grade.id) updateCounts(grade.id); });
    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [currentUser?.uid, grades.length, students]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading students...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 overflow-y-auto lg:overflow-hidden lg:h-screen">
      {/* Profile Completion Warning */}
      {!isProfileComplete && (
        <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border-l-4 border-amber-400 shadow-sm p-4 mb-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <i className="fas fa-exclamation-triangle text-amber-500 text-lg"></i>
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm text-amber-800">
                <strong className="font-semibold">Profile Incomplete:</strong> Please complete your profile information to access all features.
                Missing fields: {userRole === 'teacher' ? 'Phone Number, School' : userRole === 'parent' ? 'Phone Number' : 'Phone Number, School'}.
                <a href="/teacher/profile" className="font-semibold text-amber-700 hover:text-amber-900 underline ml-1 transition-colors">
                  Update Profile
                </a>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        {/* Refresh Button - Top Right */}

        <div className="grid grid-cols-12 gap-6">
          {/* Class Grades Section */}
          <div className="col-span-12 lg:col-span-3">
            <div className="bg-white rounded-2xl shadow-xl max-h-[calc(100vh-8rem)] lg:h-[calc(100vh-8rem)] flex flex-col border border-gray-200 overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between rounded-t-2xl bg-gradient-to-r from-blue-50 to-indigo-50">
                <h3 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center shadow-md">
                    <i className="fas fa-layer-group text-white text-sm"></i>
                  </div>
                  <span>Class Grades</span>
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowArchived(v => !v)}
                    className={`inline-flex items-center justify-center h-9 rounded-lg px-3 ${showArchived ? 'bg-amber-500 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-300'} hover:bg-amber-500 hover:text-white hover:shadow-md focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-1 transition-all duration-200`}
                    title={showArchived ? 'Showing Archived' : 'Show Archived'}
                  >
                    <i className={`fas fa-archive text-xs ${showArchived ? 'mr-1.5' : 'mr-1.5'}`}></i>
                    <span className="text-xs font-medium">{showArchived ? 'Archived' : 'Active'}</span>
                  </button>
                  {selectedGrades.length > 0 && (
                    <button
                      onClick={handleDeleteSelectedGrades}
                      className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-red-500 hover:bg-red-600 text-white shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-1 transition-all duration-200"
                      title={`Delete ${selectedGrades.length} selected grade(s)`}
                      disabled={!canManage}
                    >
                      <i className="fas fa-trash text-xs"></i>
                    </button>
                  )}
                  <button
                    onClick={handleAddGrade}
                    className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1 transition-all duration-200"
                    disabled={!canManage}
                    title="Add Grade"
                  >
                    <i className="fas fa-plus text-sm"></i>
                  </button>
                </div>
              </div>
              {/* Improved Grade Cards Container */}
              <div className="flex-1 p-4 overflow-y-auto">
                <div className="flex flex-col gap-3 min-w-0 max-w-full">
                  {grades.length === 0 ? (
                    <div className="text-center text-gray-400 py-12">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                        <i className="fas fa-layer-group text-gray-400 text-2xl"></i>
                      </div>
                      <p className="text-sm font-medium text-gray-500">No classes found</p>
                      <p className="text-xs text-gray-400 mt-1">Click + to add a new class</p>
                    </div>
                  ) : (
                    grades
                      .filter(g => showArchived ? g.isActive === false : g.isActive !== false)
                      .map((grade) => (
                        <div
                          key={grade.id}
                          className={`flex flex-col w-full max-w-full rounded-xl cursor-pointer transition-all duration-300 bg-white shadow-md hover:shadow-lg ${selectedGrade === grade.id ? 'ring-2 ring-blue-500 ring-offset-2 border-2 border-blue-500' : 'border border-gray-200 hover:border-gray-300'} ${selectedGrades.includes(grade.id || '') ? 'bg-red-50 border-red-200' : ''} ${getGradeColorClasses(grade.color)}`}
                          style={{ minWidth: 0 }}
                          onClick={() => grade.id && handleGradeSelect(grade.id)}
                        >
                          <div className="flex items-center gap-3 p-4 pb-3 min-w-0">
                            <div className={`w-12 h-12 flex items-center justify-center rounded-xl text-lg font-bold shadow-sm ${getBadgeColorClasses(grade.color)}`}>
                              {grade.name[0]}
                            </div>
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-base font-bold text-gray-900 truncate">{grade.name}</span>
                              <span className="text-xs text-gray-500 truncate mt-0.5">{grade.description || 'No description'}</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between px-4 pb-4 pt-2 min-w-0 border-t border-gray-100">
                            <span className={`px-3 py-1 text-xs font-semibold rounded-lg ${getBadgeColorClasses(grade.color)} shadow-sm`} title="Student count">
                              <i className="fas fa-users mr-1.5"></i>
                              {selectedGrade === grade.id
                                ? filteredStudents.length
                                : ((showArchived ? archivedCountsByGrade[grade.id || ''] : countsByGrade[grade.id || '']) ?? 0)
                              } students
                            </span>
                            <div className="flex flex-row flex-nowrap items-center gap-1.5 min-w-0">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  grade.id && handleAddStudentsToGrade(grade.id, grade.name);
                                }}
                                className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-green-500 hover:bg-green-600 text-white shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-green-300 focus:ring-offset-1 transition-all duration-200"
                                title="Add Students"
                                disabled={loadingAddStudentToGradeId === grade.id || !canManage}
                              >
                                <i className="fas fa-user-plus text-xs"></i>
                              </button>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (deletingGradeId === grade.id) return;
                                  setDeletingGradeId(grade.id || null);
                                  try {
                                    if (!grade.id) return;
                                    if (grade.isActive === false) {
                                      await gradeService.restoreGrade(grade.id);
                                      showSuccess('Restored', `"${grade.name}" has been restored.`);
                                      await loadGrades();
                                    } else {
                                      await handleArchiveGrade(grade.id, grade.name);
                                    }
                                  } finally {
                                    setDeletingGradeId(null);
                                  }
                                }}
                                className={`inline-flex items-center justify-center w-8 h-8 rounded-lg ${grade.isActive === false ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-amber-500 hover:bg-amber-600 text-white'} shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-1 transition-all duration-200 ${deletingGradeId === grade.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                                title={`${grade.isActive === false ? 'Restore' : 'Archive'} ${grade.name}`}
                                aria-label={`${grade.isActive === false ? 'Restore' : 'Archive'} ${grade.name}`}
                                disabled={deletingGradeId === grade.id}
                              >
                                <i className={`fas ${grade.isActive === false ? 'fa-undo' : 'fa-archive'} text-xs`}></i>
                              </button>
                              {grade.isActive === false && (
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (!grade.id) return;
                                    await handleDeleteArchivedGrade(grade.id, grade.name);
                                  }}
                                  className={`inline-flex items-center justify-center w-8 h-8 rounded-lg bg-red-500 hover:bg-red-600 text-white shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-red-300 focus:ring-offset-1 transition-all duration-200`}
                                  title={`Delete ${grade.name}`}
                                  aria-label={`Delete ${grade.name}`}
                                >
                                  <i className="fas fa-trash text-xs"></i>
                                </button>
                              )}
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  setLoadingEditGradeId(grade.id || null);
                                  try {
                                    const { value: formValues } = await Swal.fire({
                                      title: 'Edit Class Grade',
                                      customClass: {
                                        popup: 'rounded-2xl shadow-2xl border border-gray-200',
                                        title: 'text-white text-xl font-bold',
                                        confirmButton: 'px-5 py-2.5 text-sm font-semibold bg-white text-indigo-600 rounded-lg shadow-md hover:bg-white/90 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200',
                                        cancelButton: 'px-5 py-2.5 text-sm font-semibold bg-gray-100 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-200 transition-all duration-200',
                                        closeButton: 'text-white hover:text-white/80',
                                      },
                                      backdrop: 'rgba(0,0,0,0.6)',
                                      background: '#fff',
                                      showCloseButton: true,
                                      html: `
                                      <div class="text-left p-6 bg-white rounded-b-2xl -mt-4">
                                      <div class="mb-5">
                                      <label class="block text-sm font-semibold text-gray-700 mb-2">Grade Level</label>
                                      <input class="w-full px-4 py-2.5 border border-gray-300 rounded-lg shadow-sm bg-gray-100 text-gray-600 cursor-not-allowed" value="${grade.name.split(' - ')[0] || 'Grade 4'}" readonly />
                                      </div>
                                      <div class="mb-5">
                                      <label class="block text-sm font-semibold text-gray-700 mb-2">
                                        Section Name <span class="text-red-500">*</span>
                                      </label>
                                      <input id="edit-grade-name" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all" value="${grade.name.split(' - ')[1] || ''}" placeholder="e.g., Mango" />
                                      </div>
                                      <div class="mb-5">
                                          <label class="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                                          <textarea id="edit-grade-description" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all resize-none" rows="3">${grade.description || ''}</textarea>
                                          </div>
                                          <div class="mb-5">
                                          <label class="block text-sm font-semibold text-gray-700 mb-2">
                                            Color <span class="text-red-500">*</span>
                                          </label>
                                          <select id="edit-grade-color" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white">
                                          <option value="blue" ${grade.color === 'blue' ? 'selected' : ''}>Blue</option>
                                          <option value="green" ${grade.color === 'green' ? 'selected' : ''}>Green</option>
                                            <option value="yellow" ${grade.color === 'yellow' ? 'selected' : ''}>Yellow</option>
                                            <option value="purple" ${grade.color === 'purple' ? 'selected' : ''}>Purple</option>
                                            <option value="red" ${grade.color === 'red' ? 'selected' : ''}>Red</option>
                                            <option value="gray" ${grade.color === 'gray' ? 'selected' : ''}>Gray</option>
                                          </select>
                                          </div>
                                      </div>
                                      `,
                                      showCancelButton: true,
                                      confirmButtonText: '<i class="fas fa-save mr-2"></i>Save',
                                      cancelButtonText: 'Cancel',
                                      focusConfirm: false,
                                      didOpen: (modalElement) => {
                                        const title = modalElement.querySelector('.swal2-title') as HTMLElement;
                                        if (title) {
                                          title.style.background = 'linear-gradient(to right, #4f46e5, #7c3aed)';
                                          title.style.padding = '1.25rem 1.5rem';
                                          title.style.borderRadius = '0.875rem 0.875rem 0 0';
                                          title.style.display = 'flex';
                                          title.style.alignItems = 'center';
                                          title.style.gap = '0.75rem';
                                          title.innerHTML = `
                                            <div class="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-sm">
                                              <i class="fas fa-edit text-white text-lg"></i>
                                            </div>
                                            <div>
                                              <div class="text-xl font-bold">Edit Class Grade</div>
                                              <div class="text-xs text-indigo-100 mt-0.5 font-normal">Update class information</div>
                                            </div>
                                          `;
                                        }
                                      },
                                      preConfirm: () => {
                                        const sectionName = (document.getElementById('edit-grade-name') as HTMLInputElement).value.trim();
                                        const description = (document.getElementById('edit-grade-description') as HTMLTextAreaElement).value.trim();
                                        const color = (document.getElementById('edit-grade-color') as HTMLSelectElement).value;
                                        const gradeLevel = grade.name.split(' - ')[0] || 'Grade 4';

                                        if (!sectionName || !color) {
                                          Swal.showValidationMessage('Please fill in Section Name and select a Color');
                                          return false;
                                        }

                                        return {
                                          name: `${gradeLevel} - ${sectionName}`,
                                          description,
                                          color
                                        };
                                      }
                                    });
                                    if (formValues) {
                                      await gradeService.updateGrade(grade.id!, {
                                        name: formValues.name,
                                        description: formValues.description,
                                        color: formValues.color
                                      });
                                      showSuccess('Grade Updated', 'Class grade updated successfully.');
                                      await loadGrades();
                                    }
                                  } catch (error) {
                                    showError('Failed to Edit', 'An error occurred while editing the class grade.');
                                  } finally {
                                    setLoadingEditGradeId(null);
                                  }
                                }}
                                className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500 hover:bg-blue-600 text-white shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-1 transition-all duration-200"
                                title="Edit Grade"
                                disabled={loadingEditGradeId === grade.id || !canManage}
                              >
                                <i className="fas fa-edit text-xs"></i>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Students Section */}
          <div className="col-span-12 lg:col-span-9">
            <div className="bg-white rounded-2xl shadow-xl max-h-[calc(100vh-8rem)] lg:h-[calc(100vh-8rem)] flex flex-col border border-gray-200 overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  {/* Left side - Title */}
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center shadow-md">
                      <i className="fas fa-user-graduate text-white text-sm"></i>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">Students</h3>
                      <span className="text-xs text-gray-600 font-medium">
                        {(selectedGrade && selectedGrade !== 'all') ? filteredStudents.length : 0} {showArchived ? 'archived' : 'active'} students
                      </span>
                    </div>
                  </div>

                  {/* Right side - Sort Selector */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleRefresh}
                      disabled={isRefreshing}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-700 bg-white border border-indigo-200 rounded-lg shadow-sm hover:bg-indigo-50 hover:border-indigo-300 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Refresh all data"
                    >
                      <i className={`fas fa-sync-alt ${isRefreshing ? 'animate-spin' : ''}`}></i>
                      <span className="hidden sm:inline">{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
                    </button>
                    <PillSelect
                      value={sortBy}
                      onChange={setSortBy}
                      options={[
                        { value: 'name-asc', label: 'Name (A-Z)' },
                        { value: 'name-desc', label: 'Name (Z-A)' },
                        { value: 'readingLevel-desc', label: 'Reading Level (High to Low)' },
                        { value: 'readingLevel-asc', label: 'Reading Level (Low to High)' },
                        { value: 'age', label: 'Age (Low to High)' }
                      ]}
                      placeholder="Sort Students"
                      className="min-w-[180px]"
                    />
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 border-b border-gray-200 bg-white">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex-1 flex items-center">
                    <div className="relative flex-1 max-w-2xl">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <i className="fas fa-search text-gray-400"></i>
                      </div>
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by name, LRN, parent name, grade, age..."
                        className="block w-full pl-11 pr-4 py-2.5 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-400 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm shadow-sm transition-all"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!showArchived && filteredStudents.length > 0 && (
                      <button
                        onClick={handleArchiveAllStudents}
                        className="inline-flex items-center px-4 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50"
                        disabled={deletingAllStudents || !canManage}
                        title="Archive hides students from the roster without erasing their data"
                      >
                        {deletingAllStudents ? (
                          <span className="loader-spinner mr-2" style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid #f3f3f3', borderTop: '2px solid #d97706', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                        ) : (
                          <i className="fas fa-archive mr-2"></i>
                        )}
                        <span className="hidden sm:inline">Archive All</span>
                      </button>
                    )}

                    {!showArchived && (
                      <>
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-semibold rounded-lg shadow-sm text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 transition-all duration-200 disabled:opacity-50"
                          disabled={!canManage}
                        >
                          <i className="fas fa-file-import mr-2"></i>
                          <span className="hidden sm:inline">Import</span>
                        </button>
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileUpload}
                          accept=".xlsx,.xls,.csv"
                          className="hidden"
                        />
                      </>
                    )}
                    {showArchived && (
                      <button
                        onClick={async () => {
                          const result = await showConfirmation(
                            'Restore All Students',
                            'Restore all archived students back to this class roster?',
                            'Restore',
                            'Cancel',
                            'question'
                          );
                          if (!result.isConfirmed) return;
                          try {
                            const gradeObj = grades.find(g => g.id === selectedGrade);
                            const ids = students
                              .filter((s: any) => s.archived && s.grade === (gradeObj?.name || '') && !(s as any).archivedByAdmin)
                              .map(s => s.id)
                              .filter((id): id is string => Boolean(id));
                            if (ids.length > 0) {
                              await studentService.batchSetArchived(ids, false);
                              // Re-link to grade roster if needed
                              if (gradeObj) {
                                for (const sid of ids) {
                                  await gradeService.addStudentToGrade(selectedGrade, sid);
                                }
                                const updated = await gradeService.getStudentsInGrade(selectedGrade);
                                await gradeService.updateStudentCount(selectedGrade, updated.length);
                              }
                            }
                            showSuccess('Restored', 'All teacher-archived students were restored. Students archived by administrators were not affected.');
                            await loadStudents();
                            await loadGrades();
                          } catch (e) {
                            showError('Failed to Restore', 'Could not restore archived students.');
                          }
                        }}
                        className="inline-flex items-center px-4 py-2 text-sm font-semibold rounded-lg shadow-sm text-white bg-green-600 hover:bg-green-700 transition-all duration-200 disabled:opacity-50"
                        disabled={!canManage}
                      >
                        <i className="fas fa-undo mr-2"></i>
                        <span className="hidden sm:inline">Restore All</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
              {/* Students List */}
              <div className="flex-1 overflow-auto bg-gray-50">
                {isFilteringStudents || isLoading ? (
                  <div className="flex flex-col items-center justify-center h-full bg-white/50">
                    <TeacherLoader label="Fetching students..." />
                  </div>
                ) : filteredStudents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full bg-white">
                    <div className="text-center p-12">
                      <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                        <i className="fas fa-user-graduate text-gray-400 text-3xl"></i>
                      </div>
                      <p className="text-base font-semibold text-gray-700 mb-1">
                        {searchQuery ? `No results found` : 'No students found'}
                      </p>
                      <p className="text-sm text-gray-500">
                        {searchQuery ? `Try adjusting your search for "${searchQuery}"` : 'Select a class to view students or add new students'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 bg-white">
                      <thead className="bg-gradient-to-r from-gray-50 to-gray-100 sticky top-0 z-10 shadow-sm">
                        <tr>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Student</th>
                          <th scope="col" className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">LRN</th>
                          <th scope="col" className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Form</th>
                          <th scope="col" className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Parent</th>
                          <th scope="col" className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredStudents.map((student) => {
                          // Find the grade object for this student
                          const gradeObj = grades.find(g => g.name === student.grade);
                          const badgeColor = gradeObj ? getBadgeColorClasses(gradeObj.color) : getBadgeColorClasses('blue');
                          // Map badge color to a light hover background
                          const hoverBgMap: Record<string, string> = {
                            'bg-blue-100 text-blue-800': 'hover:bg-blue-50',
                            'bg-green-100 text-green-800': 'hover:bg-green-50',
                            'bg-yellow-100 text-yellow-800': 'hover:bg-yellow-50',
                            'bg-purple-100 text-purple-800': 'hover:bg-purple-50',
                            'bg-red-100 text-red-800': 'hover:bg-red-50',
                            'bg-gray-100 text-gray-800': 'hover:bg-gray-50',
                          };
                          const hoverBg = hoverBgMap[badgeColor] || 'hover:bg-blue-50';
                          return (
                            <tr key={student.id} className={`transition-all duration-150 ${hoverBg} hover:shadow-sm`}>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div className="flex-shrink-0 h-9 w-9">
                                    <div className={`h-9 w-9 rounded-lg flex items-center justify-center shadow-sm ${badgeColor}`}>
                                      <span className="font-bold text-sm">
                                        {(() => {
                                          const studentFullName = student.name || '';
                                          let initial = '';
                                          if (studentFullName.includes(' ')) {
                                            const parts = studentFullName.split(' ');
                                            if (parts[0]) initial = parts[0][0];
                                          } else {
                                            const parts = studentFullName.trim().split(' ');
                                            if (parts.length > 0) initial = parts[parts.length - 1][0];
                                          }
                                          return initial.toUpperCase();
                                        })()}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="ml-3">
                                    <div className="text-sm font-semibold text-gray-900 select-none">
                                      {(() => {
                                        const studentFullName = student.name || '';
                                        if (studentFullName.includes(' ')) {
                                          return studentFullName.replace(/\|/g, ' ');
                                        }
                                        return studentFullName;
                                      })()}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-center">
                                <div className="text-sm font-medium text-gray-700 select-none">{student.lrn || <span className="text-gray-400">-</span>}</div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-center">
                                <div className="flex justify-center items-center gap-2">
                                  {loadingISRStatus ? (
                                    <div className="w-4 h-4 border-2 border-gray-300 border-t-indigo-600 rounded-full animate-spin" title="Checking for completed sessions..."></div>
                                  ) : (
                                    student.id && studentsWithCompletedSessions.has(student.id) && (
                                      <span
                                        className="px-2 py-0.5 text-xs font-semibold text-green-700 bg-green-100 rounded-lg shadow-sm"
                                        title="Has completed reading session(s)"
                                      >
                                        <i className="fas fa-check-circle mr-1"></i>
                                        Completed
                                      </span>
                                    )
                                  )}
                                  <button
                                    onClick={() => handleGenerateForm(student)}
                                    disabled={loadingStudentId === student.id || loadingISRStatus}
                                    className={`font-semibold px-3 py-1.5 rounded-lg text-xs transition-all flex items-center gap-1.5 shadow-sm ${loadingStudentId === student.id || loadingISRStatus
                                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                      : student.id && studentsWithCompletedSessions.has(student.id)
                                        ? 'bg-green-500 hover:bg-green-600 text-white'
                                        : 'bg-indigo-100 hover:bg-indigo-200 text-indigo-700'
                                      }`}
                                    title={loadingISRStatus
                                      ? 'Checking for completed sessions...'
                                      : student.id && studentsWithCompletedSessions.has(student.id)
                                        ? `View Phil-IRI Form 3A for ${student.name} (has completed session data)`
                                        : `Generate Phil-IRI Form 3A for ${student.name} (no completed sessions yet)`
                                    }
                                  >
                                    {loadingStudentId === student.id ? (
                                      <>
                                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Loading...
                                      </>
                                    ) : (
                                      <>
                                        <i className="fas fa-file-alt"></i>
                                        Form 3A
                                      </>
                                    )}
                                  </button>
                                </div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-center align-middle">
                                <div className="flex justify-center items-center">
                                  {student.parentId ? (
                                    <span
                                      className="px-2.5 py-1 text-xs font-semibold text-green-700 bg-green-100 rounded-lg cursor-default select-none shadow-sm"
                                      title={student.parentName || "Parent linked"}
                                    >
                                      <i className="fas fa-check-circle mr-1"></i>
                                      Linked
                                    </span>
                                  ) : (
                                    <button
                                      onClick={() => student.id && handleLinkParent(student.id)}
                                      className="inline-flex items-center px-2.5 py-1 border border-indigo-200 text-xs font-semibold rounded-lg text-indigo-700 bg-indigo-50 hover:bg-indigo-100 hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 cursor-pointer select-none shadow-sm transition-all"
                                    >
                                      <i className="fas fa-link mr-1.5"></i>
                                      Link
                                    </button>
                                  )}
                                </div>
                              </td>

                              <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={() => student.id && handleViewProfile(student.id)}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 transition-all select-none"
                                    title="View Profile"
                                    disabled={loadingStudentId === student.id || !canManage}
                                  >
                                    {loadingStudentId === student.id ? (
                                      <span className="loader-spinner" style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid #f3f3f3', borderTop: '2px solid #4f46e5', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                                    ) : (
                                      <i className="fas fa-eye"></i>
                                    )}
                                  </button>
                                  <button
                                    onClick={() => student.id && handleEditStudent(student.id)}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-all select-none"
                                    title="Edit Student"
                                    disabled={!canManage}
                                  >
                                    <i className="fas fa-edit"></i>
                                  </button>
                                  {(!showArchived) ? (
                                    <button
                                      onClick={() => student.id && handleArchiveStudent(student.id, student.name)}
                                      className="w-8 h-8 flex items-center justify-center rounded-lg text-amber-600 hover:text-amber-700 hover:bg-amber-50 transition-all select-none"
                                      title="Archive Student"
                                      disabled={!canManage}
                                    >
                                      <i className="fas fa-archive"></i>
                                    </button>
                                  ) : (
                                    (student as any).archivedByAdmin ? (
                                      <span className="text-gray-500 text-xs italic select-none px-2" title="This student was archived by an administrator">
                                        Admin
                                      </span>
                                    ) : (
                                      <button
                                        onClick={() => student.id && handleRestoreStudent(student.id, student.name)}
                                        className="w-8 h-8 flex items-center justify-center rounded-lg text-green-600 hover:text-green-700 hover:bg-green-50 transition-all select-none"
                                        title="Restore Student"
                                        disabled={!canManage}
                                      >
                                        <i className="fas fa-undo"></i>
                                      </button>
                                    )
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Import Preview Modal */}
      {showImportPreview && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col pointer-events-auto overflow-hidden border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-indigo-600 to-purple-600 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-sm">
                  <i className="fas fa-file-import text-white text-lg"></i>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Import Preview</h3>
                  <p className="text-xs text-indigo-100 mt-0.5">Review students before importing</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCancelImport}
                  className="px-4 py-2 text-sm font-semibold text-indigo-700 bg-white hover:bg-indigo-50 border border-white/30 rounded-lg transition-all duration-200"
                >
                  Cancel
                </button>
                <div className="flex items-center gap-2">
                  {(duplicateStats.within > 0 || duplicateStats.existing > 0) && (
                    <button
                      onClick={() => {
                        // resolve by keeping only unique
                        setImportedStudents(duplicateDetails.unique);
                        setDuplicateStats({ within: 0, existing: 0 });
                      }}
                      className="inline-flex items-center px-3 py-2 text-xs font-semibold text-amber-800 bg-amber-100 rounded-lg hover:bg-amber-200 shadow-sm transition-all"
                      title="Remove duplicates from this file and keep unique students"
                    >
                      <i className="fas fa-broom mr-1.5"></i>Remove Duplicates
                    </button>
                  )}
                  <button
                    onClick={handleImportStudents}
                    disabled={isImporting || duplicateStats.within > 0 || duplicateStats.existing > 0}
                    className="inline-flex items-center px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 disabled:hover:shadow-lg"
                    title={duplicateStats.within > 0 || duplicateStats.existing > 0 ? 'Resolve duplicate entries before importing' : undefined}
                  >
                    {isImporting ? (
                      <span className="inline-flex items-center">
                        <span className="loader-spinner mr-2 w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        Importing...
                      </span>
                    ) : (
                      <>
                        <i className="fas fa-check-circle mr-2"></i>
                        Import Students
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
            <div className="p-5 bg-gradient-to-r from-gray-50 to-blue-50 border-b border-gray-200 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <i className="fas fa-info-circle text-indigo-600 text-lg"></i>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    Found <span className="text-indigo-600">{importedStudents.length}</span> students to import
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5">Please review the data below before importing</p>
                </div>
              </div>
              <div className={`flex items-start gap-3 text-xs sm:text-sm rounded-lg p-3 shadow-sm ${duplicateStats.within > 0 || duplicateStats.existing > 0 ? 'text-amber-800 bg-amber-50 border border-amber-200' : 'text-indigo-800 bg-indigo-50 border border-indigo-200'}`}>
                <i className={`fas ${duplicateStats.within > 0 || duplicateStats.existing > 0 ? 'fa-exclamation-triangle' : 'fa-check-circle'} mt-0.5 text-base`}></i>
                <div className="flex-1">
                  {duplicateStats.within > 0 || duplicateStats.existing > 0 ? (
                    <>
                      <p className="font-bold mb-1">We'll keep your list tidy</p>
                      <ul className="list-disc ml-5 space-y-0.5">
                        {duplicateStats.within > 0 && (
                          <li>{duplicateStats.within} repeated name/LRN entries in this file will be skipped automatically.</li>
                        )}
                        {duplicateStats.existing > 0 && (
                          <li>{duplicateStats.existing} students already in your class list will not be added again.</li>
                        )}
                      </ul>
                      {(duplicateDetails.within.length > 0 || duplicateDetails.existing.length > 0) && (
                        <details className="mt-2">
                          <summary className="cursor-pointer select-none font-semibold hover:text-amber-900 transition-colors">View duplicates</summary>
                          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {duplicateDetails.within.length > 0 && (
                              <div className="bg-white rounded p-2 border border-amber-200">
                                <div className="font-semibold text-amber-900 mb-1">In this file</div>
                                <ul className="list-disc ml-5 text-xs space-y-0.5">
                                  {duplicateDetails.within.slice(0, 5).map((s, i) => (
                                    <li key={`w-${i}`}>{(s.firstName || '').trim()} {(s.lastName || '').trim()} {s.lrn ? `(${s.lrn})` : ''}</li>
                                  ))}
                                  {duplicateDetails.within.length > 5 && <li className="text-amber-600">+{duplicateDetails.within.length - 5} more…</li>}
                                </ul>
                              </div>
                            )}
                            {duplicateDetails.existing.length > 0 && (
                              <div className="bg-white rounded p-2 border border-amber-200">
                                <div className="font-semibold text-amber-900 mb-1">Already in your class</div>
                                <ul className="list-disc ml-5 text-xs space-y-0.5">
                                  {duplicateDetails.existing.slice(0, 5).map((s, i) => (
                                    <li key={`e-${i}`}>{(s.firstName || '').trim()} {(s.lastName || '').trim()} {s.lrn ? `(${s.lrn})` : ''}</li>
                                  ))}
                                  {duplicateDetails.existing.length > 5 && <li className="text-amber-600">+{duplicateDetails.existing.length - 5} more…</li>}
                                </ul>
                              </div>
                            )}
                          </div>
                        </details>
                      )}
                    </>
                  ) : (
                    <p className="font-semibold">Looks good! We didn't find any duplicates in this file.</p>
                  )}
                </div>
              </div>
            </div>
            <div className="overflow-x-auto flex-1 bg-white">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100 sticky top-0 shadow-sm">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">First Name</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Last Name</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">LRN</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Age</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {importedStudents.map((student, index) => (
                    <tr key={index} className="hover:bg-indigo-50 transition-colors duration-150">
                      <td className="px-5 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{student.firstName || '-'}</td>
                      <td className="px-5 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{student.lastName || '-'}</td>
                      <td className="px-5 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{student.lrn || '-'}</td>
                      <td className="px-5 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{student.age || 10}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {importedStudents.length === 0 && (
              <div className="p-12 text-center bg-white">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                  <i className="fas fa-file-excel text-gray-400 text-3xl"></i>
                </div>
                <p className="text-base font-semibold text-gray-700 mb-1">No student data to preview</p>
                <p className="text-sm text-gray-500">Please upload a valid .xlsx, .xls, or .csv file</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Student Modal */}
      {editingStudent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-gray-200">
            <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-sm">
                  <i className="fas fa-user-edit text-white text-lg"></i>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Edit Student</h3>
                  <p className="text-xs text-blue-100 mt-0.5">Update student name and LRN only</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Student Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm transition-all"
                  placeholder="Enter student name"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  LRN (Learner Reference Number) <span className="text-gray-500 text-xs">(Cannot be changed)</span>
                </label>
                <input
                  type="text"
                  value={editForm.lrn}
                  readOnly
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 bg-gray-50 text-gray-600 cursor-not-allowed shadow-sm"
                  placeholder="LRN (read-only)"
                />
                <p className="text-xs text-gray-500 mt-1">LRN is the unique identifier and cannot be modified</p>
              </div>

              <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-lg p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <i className="fas fa-info-circle text-amber-600"></i>
                  </div>
                  <div className="text-sm text-amber-900">
                    <p className="font-semibold mb-1">Note:</p>
                    <p className="text-amber-800">Only the student's name can be modified. LRN is the unique identifier and cannot be changed. Other information like grade, reading level, and age cannot be changed here.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-5 border-t border-gray-200 bg-gray-50 rounded-b-2xl flex justify-end gap-3">
              <button
                onClick={handleCancelEdit}
                className="px-5 py-2.5 text-sm font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg shadow-sm transition-all duration-200"
                disabled={loadingStudentId === editingStudent.id}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={loadingStudentId === editingStudent.id || !editForm.name.trim()}
                className={`px-5 py-2.5 rounded-lg transition-all duration-200 flex items-center gap-2 shadow-md hover:shadow-lg ${loadingStudentId === editingStudent.id || !editForm.name.trim()
                  ? 'bg-gray-400 text-white cursor-not-allowed'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
              >
                {loadingStudentId === editingStudent.id ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <i className="fas fa-save"></i>
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phil-IRI Form 3A Modal */}
      {formModalOpen && selectedFormStudent && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && handleCloseForm()}
          onKeyDown={(e) => {
            if (e.key === 'Escape') handleCloseForm();
            if (e.key === 'p' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              handlePrintForm();
            }
          }}
          tabIndex={-1}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto border border-gray-200 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <div className="px-6 py-5 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-green-600 to-emerald-600 rounded-t-2xl">
              <div className="flex items-center gap-3 flex-1">
                <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-sm">
                  <i className="fas fa-file-alt text-white text-lg"></i>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white">
                    Phil-IRI Form 3A - {selectedFormStudent.name}
                  </h3>
                  {formData && (
                    <div className="text-xs text-green-100 mt-1.5 flex items-center gap-2 flex-wrap">
                      {hasISRData ? (
                        <>
                          <span className="inline-flex items-center gap-1 bg-white/20 px-2 py-0.5 rounded">
                            <i className="fas fa-check-circle"></i>
                            Data from completed session
                          </span>
                          {formData.sessionTitle && (
                            <span className="text-green-50">
                              {formData.sessionTitle}
                            </span>
                          )}
                          {formData.assessmentDate && (
                            <span className="text-green-50">
                              {new Date(formData.assessmentDate).toLocaleDateString()}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-amber-500/30 px-2 py-0.5 rounded">
                          <i className="fas fa-info-circle"></i>
                          Template form (no session data)
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={handleCloseForm}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-white hover:bg-white/20 transition-all duration-200 ml-3"
                title="Close"
              >
                <i className="fas fa-times text-lg"></i>
              </button>
            </div>

            <div className="p-6 bg-gray-50">
              {!formData ? (
                /* Loading State */
                <div className="flex items-center justify-center py-16">
                  <div className="text-center">
                    <div className="w-16 h-16 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mx-auto mb-4 shadow-lg"></div>
                    <p className="text-base font-semibold text-gray-700">Generating Phil-IRI Form 3A...</p>
                    <p className="text-sm text-gray-500 mt-2">Please wait while we process the student's reading data.</p>
                  </div>
                </div>
              ) : (
                /* Form Content */
                <div className="print-content bg-white p-6 rounded-lg font-mono text-sm border-2 border-gray-400 print:border-black print:shadow-none max-w-4xl mx-auto print:p-4 print:rounded-none">
                  <div className="text-right mb-6 font-bold text-base">
                    {formData.formTitle}
                  </div>

                  {/* PART A */}
                  <div className="mb-6 print:mb-4">
                    <div className="font-bold mb-3 text-base print:mb-2">PART A</div>

                    <div className="mb-4 space-y-2">
                      <div className="flex justify-between">
                        <span>Kabuuang Oras ng Pagbasa: <span className="underline inline-block min-w-[120px] text-center">{formData.partA.readingTime || '\u00A0'}</span></span>
                        <span>Rate ng Pagbasa: <span className="underline inline-block min-w-[120px] text-center">{formData.partA.readingRate || '\u00A0'}</span></span>
                      </div>
                    </div>

                    <div className="mb-4 print:mb-3">
                      <div className="flex justify-between items-center">
                        <div>
                          <span>Sagot sa mga Tanong: Marka: <span className="underline inline-block min-w-[30px] text-center">{formData.partA.correctAnswers || '\u00A0'}</span></span>
                          <span className="ml-4">%= <span className="underline inline-block min-w-[40px] text-center">{formData.partA.percentage ? `${formData.partA.percentage}%` : '\u00A0'}</span></span>
                        </div>
                        <div>
                          <span>Comprehension Level: <span className="underline inline-block min-w-[100px] text-center">{formData.partA.comprehensionLevel || '\u00A0'}</span></span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-12">
                      <div className="space-y-2">
                        {formData.partA.answers && formData.partA.answers.length > 0 ? (
                          formData.partA.answers.slice(0, 4).map((answer: string, index: number) => (
                            <div key={index} className="flex items-center">
                              <span className="mr-2">{index + 1}.</span>
                              <span className="underline inline-block min-w-[80px] text-center">{answer || '\u00A0'}</span>
                            </div>
                          ))
                        ) : (
                          [1, 2, 3, 4].map((num) => (
                            <div key={num} className="flex items-center">
                              <span className="mr-2">{num}.</span>
                              <span className="underline inline-block min-w-[80px] text-center">{'\u00A0'}</span>
                            </div>
                          ))
                        )}
                      </div>
                      <div className="space-y-2">
                        {formData.partA.answers && formData.partA.answers.length > 4 ? (
                          formData.partA.answers.slice(4).map((answer: string, index: number) => (
                            <div key={index + 4} className="flex items-center">
                              <span className="mr-2">{index + 5}.</span>
                              <span className="underline inline-block min-w-[80px] text-center">{answer || '\u00A0'}</span>
                            </div>
                          ))
                        ) : (
                          [5, 6, 7].map((num) => (
                            <div key={num} className="flex items-center">
                              <span className="mr-2">{num}.</span>
                              <span className="underline inline-block min-w-[80px] text-center">{'\u00A0'}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* PART B */}
                  <div>
                    <div className="font-bold mb-3 text-base print:mb-2">PART B</div>

                    <div className="mb-4">
                      <div className="font-bold text-sm">Word Reading (Pagbasa)</div>
                    </div>

                    <div className="mb-4 space-y-2 print:mb-3">
                      <div className="flex items-center space-x-8">
                        <span>Seleksyon: <span className="underline inline-block min-w-[150px] text-center">{formData.partB.wordReading.selection || '\u00A0'}</span></span>
                        <span>Level: <span className="underline inline-block min-w-[40px] text-center">{formData.partB.wordReading.level || '\u00A0'}</span></span>
                        <span>Set: <span className="underline inline-block min-w-[40px] text-center">{formData.partB.wordReading.set || '\u00A0'}</span></span>
                      </div>
                    </div>

                    {/* Miscues Table */}
                    <div className="border-2 border-black">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="border border-black p-3 text-center w-12 font-bold"></th>
                            <th className="border border-black p-3 text-center font-bold">
                              <div>Types of Miscues</div>
                              <div className="italic font-normal text-xs mt-1">(Uri ng Mali)</div>
                            </th>
                            <th className="border border-black p-3 text-center font-bold">
                              <div>Number of Miscues</div>
                              <div className="italic font-normal text-xs mt-1">(Bilang ng Salitang mali ang basa)</div>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="border border-black p-2 text-center font-bold">1</td>
                            <td className="border border-black p-2">Mispronunciation <span className="italic">(Maling Bigkas)</span></td>
                            <td className="border border-black p-2 text-center bg-gray-50">{formData.partB.miscues.mispronunciation}</td>
                          </tr>
                          <tr>
                            <td className="border border-black p-2 text-center font-bold">2</td>
                            <td className="border border-black p-2">Omission <span className="italic">(Pagkakaltas)</span></td>
                            <td className="border border-black p-2 text-center bg-gray-50">{formData.partB.miscues.omission}</td>
                          </tr>
                          <tr>
                            <td className="border border-black p-2 text-center font-bold">3</td>
                            <td className="border border-black p-2">Substitution <span className="italic">(Pagpapalit)</span></td>
                            <td className="border border-black p-2 text-center bg-gray-50">{formData.partB.miscues.substitution}</td>
                          </tr>
                          <tr>
                            <td className="border border-black p-2 text-center font-bold">4</td>
                            <td className="border border-black p-2">Insertion <span className="italic">(Pagsisingit)</span></td>
                            <td className="border border-black p-2 text-center bg-gray-50">{formData.partB.miscues.insertion}</td>
                          </tr>
                          <tr>
                            <td className="border border-black p-2 text-center font-bold">5</td>
                            <td className="border border-black p-2">Repetition <span className="italic">(Pag-uulit)</span></td>
                            <td className="border border-black p-2 text-center bg-gray-50">{formData.partB.miscues.repetition}</td>
                          </tr>
                          <tr>
                            <td className="border border-black p-2 text-center font-bold">6</td>
                            <td className="border border-black p-2">Transposition <span className="italic">(Pagpapalit ng lugar)</span></td>
                            <td className="border border-black p-2 text-center bg-gray-50">{formData.partB.miscues.transposition}</td>
                          </tr>
                          <tr>
                            <td className="border border-black p-2 text-center font-bold">7</td>
                            <td className="border border-black p-2">Reversal <span className="italic">(Paglilipat)</span></td>
                            <td className="border border-black p-2 text-center bg-gray-50">{formData.partB.miscues.reversal}</td>
                          </tr>
                          <tr className="bg-gray-200">
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2 font-bold">Total Miscues <span className="italic font-normal">(Kabuuan)</span></td>
                            <td className="border border-black p-2 text-center font-bold">{formData.partB.miscues.totalMiscues}</td>
                          </tr>
                          <tr>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2 font-bold">Number of Words in the Passage</td>
                            <td className="border border-black p-2 text-center bg-gray-50">{formData.partB.miscues.wordsInPassage || '\u00A0'}</td>
                          </tr>
                          <tr>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2 font-bold">Word Reading Score</td>
                            <td className="border border-black p-2 text-center bg-gray-50">{formData.partB.miscues.wordReadingScore || '\u00A0'}</td>
                          </tr>
                          <tr>
                            <td className="border border-black p-2"></td>
                            <td className="border border-black p-2 font-bold">Word Reading Level <span className="italic font-normal">(Antas ng Pagbasa)</span></td>
                            <td className="border border-black p-2 text-center bg-gray-50">{formData.partB.miscues.wordReadingLevel || '\u00A0'}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-6 pt-5 border-t border-gray-200 flex justify-end gap-3 no-print bg-white rounded-b-2xl px-6 pb-6 -mx-6 -mb-6">
                <button
                  onClick={handleCloseForm}
                  className="px-5 py-2.5 text-sm font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg shadow-sm transition-all duration-200"
                >
                  Close
                </button>
                <button
                  onClick={handlePrintForm}
                  disabled={!formData}
                  className={`px-5 py-2.5 rounded-lg transition-all duration-200 flex items-center gap-2 shadow-md hover:shadow-lg ${!formData
                    ? 'bg-gray-400 text-white cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                >
                  <i className="fas fa-print"></i>
                  Print Form
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClassList; 