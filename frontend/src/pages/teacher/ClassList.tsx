import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { studentService, type Student, type ImportedStudent } from '../../services/studentService';
import { gradeService, type ClassGrade } from '../../services/gradeService';
import * as XLSX from 'xlsx';
import { showError, showSuccess, showConfirmation } from '../../services/alertService';
import Swal from 'sweetalert2';
import { onSnapshot, collection } from 'firebase/firestore';
import { getAllParents, getUserProfile } from '../../services/authService';
import { db } from '../../config/firebase';
import Loader from '../../components/Loader';
import { resultService } from '../../services/resultsService';

const ClassList: React.FC = () => {
  const { currentUser, userRole, isProfileComplete } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [isImporting, setIsImporting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [importedStudents, setImportedStudents] = useState<ImportedStudent[]>([]);
  const [duplicateStats, setDuplicateStats] = useState<{ within: number; existing: number }>({ within: 0, existing: 0 });
  const [duplicateDetails, setDuplicateDetails] = useState<{ within: ImportedStudent[]; existing: ImportedStudent[]; unique: ImportedStudent[] }>({ within: [], existing: [], unique: [] });
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [loadingStudentId, setLoadingStudentId] = useState<string | null>(null);
  const [loadingViewGradeId, setLoadingViewGradeId] = useState<string | null>(null);
  const [loadingAddStudentToGradeId, setLoadingAddStudentToGradeId] = useState<string | null>(null);
  const [loadingEditGradeId, setLoadingEditGradeId] = useState<string | null>(null);
  const [deletingAllStudents, setDeletingAllStudents] = useState(false);
  const [isCreatingGrade, setIsCreatingGrade] = useState(false);
  const [isAddingStudentToGrade, setIsAddingStudentToGrade] = useState(false);
  const [selectedGrades, setSelectedGrades] = useState<string[]>([]);
  const [showArchived, setShowArchived] = useState<boolean>(false);

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
  // Compute live counts per grade from the local students list (non-archived)
  const countsByGrade = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const g of grades) counts[g.id || ''] = 0;
    for (const s of students) {
      if ((s as any).archived) continue;
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

  // Filter students when search query or filter changes
  useEffect(() => {
    filterStudents();
  }, [students, searchQuery, selectedFilter, sortBy, showArchived, selectedGrade]);

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
    // If no grade is selected or 'all' is selected, filter students should be empty
    if (!selectedGrade || selectedGrade === 'all') {
      setFilteredStudents([]);
      return;
    }

    const gradeObj = grades.find(g => g.id === selectedGrade);
    if (!gradeObj) {
      setFilteredStudents([]);
      return;
    }

    // Use roster membership (grade subcollection) as the source of truth
    let rosterIds: string[] = [];
    try {
      const studentsInGrade = await gradeService.getStudentsInGrade(selectedGrade);
      rosterIds = studentsInGrade.map(sg => sg.studentId).filter(Boolean) as string[];
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
      // Active view: include roster membership OR grade match, exclude archived
      const gradeMatchIds = new Set(
        students
          .filter(student => student.grade === gradeObj.name && !(student as any).archived)
          .map(s => s.id)
          .filter(Boolean) as string[]
      );
      const unionIds = new Set<string>([...rosterIds, ...Array.from(gradeMatchIds)]);
      filtered = students.filter(student => !!student.id && unionIds.has(student.id) && !(student as any).archived);
      // If the stored studentCount differs from computed live count, reconcile in background
      if (gradeObj && typeof (gradeObj as any).studentCount === 'number') {
        const liveCount = countsByGrade[gradeObj.id || ''] ?? filtered.length;
        if ((gradeObj as any).studentCount !== liveCount) {
        (async () => {
          try {
            await gradeService.updateStudentCount(selectedGrade, liveCount);
          } catch {}
        })();
        }
      }
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(student => {
        const matchesName = student.name.toLowerCase().includes(query);
        const matchesGrade = String(student.grade).toLowerCase().includes(query);
        const matchesAge = String(student.age || '').includes(query);
        return matchesName || matchesGrade || matchesAge;
      });
    }
    // Remove performance-based filtering since we're using age now
    // if (selectedFilter !== 'all') {
    //   filtered = filtered.filter(student => student.performance === selectedFilter);
    // }
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
      } catch {}
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

      // Import students to main collection and add to selected class subcollection
      await studentService.importStudents(
        uniqueToImport.map(s => ({ ...s, grade: gradeObj.name })),
        currentUser.uid
      );
      // Add each imported student to the selected class subcollection
      // (Find the student in the main collection by name and grade)
      const allStudents = await studentService.getStudents(currentUser.uid);
      for (const imported of uniqueToImport) {
        const match = allStudents.find(s => s.name === imported.name && String(s.grade) === String(gradeObj.name));
        if (match && match.id) {
          await gradeService.addStudentToGrade(selectedGrade, {
            studentId: match.id,
            name: match.name
          });
        }
      }
      // Reload students and statistics
      await loadStudents();
      await loadClassStatistics();
      // Update student count in Firestore
      const studentsInGrade = await gradeService.getStudentsInGrade(selectedGrade);
      await gradeService.updateStudentCount(selectedGrade, studentsInGrade.length);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      showSuccess('Import Complete', 'Students imported successfully!');
    } catch (error) {
      console.error('Error importing students:', error);
      showError('Import Failed', 'An error occurred during student import. Please try again.');
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
    setLoadingStudentId(studentId);
    try {
      // No need to call showInfo here, as it's not used in the new implementation
    } finally {
      setLoadingStudentId(null);
    }
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

  const handleViewISR = async (student: Student) => {
    try {
      if (!student.id) return;
      const [readingResults, testResults] = await Promise.all([
        resultService.getReadingResults(student.id),
        resultService.getTestResults(student.id)
      ]);
      const latestReading = readingResults.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      const latestTest = testResults.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

      // Teacher profile for header info
      let teacherName = '';
      let schoolName = '';
      try {
        const profile: any = await (getUserProfile() as Promise<any>);
        teacherName = profile?.displayName || '';
        schoolName = profile?.school || '';
      } catch {}

      const safe = (v: any) => (v === undefined || v === null ? '' : String(v));
      const elapsedMins = latestReading?.elapsedTime ? (latestReading.elapsedTime / 60).toFixed(2) : '';
      const rate = safe(latestReading?.readingSpeed);
      const mark = safe(latestTest?.correctAnswers);
      const percent = latestTest?.comprehension != null ? `${latestTest.comprehension}%` : '';
      const compLevel = (() => {
        const v = typeof latestTest?.comprehension === 'string' ? parseFloat(latestTest?.comprehension) : latestTest?.comprehension;
        if (v == null || isNaN(v)) return '';
        if (v >= 80) return 'Independent';
        if (v >= 59) return 'Instructional';
        return 'Frustration';
      })();
      const wordReadingScore = latestReading?.oralReadingScore != null ? `${latestReading.oralReadingScore}%` : '';
      const wordReadingLevel = (() => {
        const v = typeof latestReading?.oralReadingScore === 'string' ? parseFloat(latestReading?.oralReadingScore) : latestReading?.oralReadingScore;
        if (v == null || isNaN(v)) return '';
        if (v >= 95) return 'Independent';
        if (v >= 90) return 'Instructional';
        return 'Frustrational';
      })();

      const answers: string[] = Array.from({ length: 7 }).map((_, i) => {
        const entry = (latestTest as any)?.answers?.[i];
        const sel = entry?.selectedAnswer ?? '';
        // If selected answer looks like a letter option, normalize to lowercase a/b/c/etc.
        const letterMatch = String(sel).trim().match(/^[A-Da-d]$/);
        return letterMatch ? letterMatch[0].toLowerCase() : String(sel);
      });

      const html = `
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Phil-IRI Form 3A</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
              .header { display:flex; justify-content: space-between; font-size:12px; margin-bottom: 6px; }
              .title { text-align:right; font-weight:700; }
              .row { margin: 8px 0; font-size: 13px; }
              table { width:100%; border-collapse: collapse; font-size:12px; }
              th, td { border:1.5px solid #9ca3af; padding:8px; }
              th { background:#f3f4f6; }
              .right { text-align:right; }
              .bold { font-weight:600; }
              .u { text-decoration: underline; }
              .no-print { margin-top: 16px; padding: 8px 12px; background:#2563eb; color:#fff; border:0; border-radius:6px; cursor:pointer; }
              .answers { width:100%; border:0; margin-top: 4px; }
              .answers td { border:0; padding: 4px 16px 4px 0; font-size:13px; }
              .ansline { display:inline-block; min-width: 90px; border-bottom: 1px solid #9ca3af; text-align:center; }
            </style>
          </head>
          <body>
            <div class="header">
              <div>
                <div class="bold">School: <span class="u">${safe(schoolName)}</span></div>
                <div class="bold">Teacher: <span class="u">${safe(teacherName)}</span></div>
                <div class="bold">Student: <span class="u">${safe(student.name)}</span></div>
              </div>
              <div class="title">Phil-IRI Form 3A, Pahina 4</div>
            </div>

            <div class="row bold">PART A</div>
            <div class="row">
              Kabuuang Oras ng Pagbasa: <span class="u">${elapsedMins}</span> minuto
              &nbsp;&nbsp;&nbsp; Rate ng Pagbasa: <span class="u">${rate}</span> salita /minuto
            </div>
            <div class="row">
              Sagot sa mga Tanong: Marka: <span class="u">${mark}</span>
              &nbsp;&nbsp; %: <span class="u">${percent}</span>
              &nbsp;&nbsp; Comprehension Level: <span class="u">${compLevel}</span>
            </div>

            <table class="answers">
              <tr>
                <td>1.&nbsp;<span class="ansline">${answers[0] || '&nbsp;'}</span></td>
                <td>5.&nbsp;<span class="ansline">${answers[4] || '&nbsp;'}</span></td>
              </tr>
              <tr>
                <td>2.&nbsp;<span class="ansline">${answers[1] || '&nbsp;'}</span></td>
                <td>6.&nbsp;<span class="ansline">${answers[5] || '&nbsp;'}</span></td>
              </tr>
              <tr>
                <td>3.&nbsp;<span class="ansline">${answers[2] || '&nbsp;'}</span></td>
                <td>7.&nbsp;<span class="ansline">${answers[6] || '&nbsp;'}</span></td>
              </tr>
              <tr>
                <td>4.&nbsp;<span class="ansline">${answers[3] || '&nbsp;'}</span></td>
                <td></td>
              </tr>
            </table>

            <div class="row bold">PART B</div>
            <div class="row bold">Word Reading (Pagbasa)</div>
            <div class="row">Seleksyon: <span class="u">${safe(latestReading?.book)}</span> &nbsp;&nbsp; Level: <span class="u">${safe(student.readingLevel)}</span> &nbsp;&nbsp; Set: <span class="u"></span></div>

            <table>
              <thead>
                <tr>
                  <th style="width:50px" class="right">#</th>
                  <th>Types of Miscues <span style="font-weight:400">(Uri ng Mali)</span></th>
                  <th class="right">Number of Miscues <span style="font-weight:400">(Bilang ng Salitang mali ang basa)</span></th>
                </tr>
              </thead>
              <tbody>
                ${[
                  'Mispronunciation (Maling Bigkas)',
                  'Omission (Pagkakaltas)',
                  'Substitution (Pagpapalit)',
                  'Insertion (Pagsisingit)',
                  'Repetition (Pag-uulit)',
                  'Transposition (Pagpapalit ng lugar)',
                  'Reversal (Paglilipat)'
                ].map((label, idx) => `
                  <tr>
                    <td class="right">${idx+1}</td>
                    <td>${label}</td>
                    <td class="right"></td>
                  </tr>
                `).join('')}
                <tr>
                  <td colspan="2" class="bold">Total Miscues (Kabuuan)</td>
                  <td class="right">${safe(latestReading?.miscues)}</td>
                </tr>
                <tr>
                  <td colspan="2" class="bold">Number of Words in the Passage</td>
                  <td class="right">${safe(latestReading?.totalWords)}</td>
                </tr>
                <tr>
                  <td colspan="2" class="bold">Word Reading Score</td>
                  <td class="right">${wordReadingScore}</td>
                </tr>
                <tr>
                  <td colspan="2" class="bold">Word Reading Level (Antas ng Pagbasa)</td>
                  <td class="right">${wordReadingLevel}</td>
                </tr>
              </tbody>
            </table>

            <button class="no-print" onclick="window.print()">Print</button>
          </body>
        </html>
      `;

      const w = window.open('', '_blank');
      if (!w) return;
      w.document.open();
      w.document.write(html);
      w.document.close();
      w.focus();
    } catch (e) {
      showError('Error', 'Failed to open ISR for this student.');
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
      await studentService.batchSetArchived([studentId], true);
      if (selectedGrade && selectedGrade !== 'all') {
        try {
          await gradeService.removeStudentFromGrade(selectedGrade, studentId);
          const updated = await gradeService.getStudentsInGrade(selectedGrade);
          await gradeService.updateStudentCount(selectedGrade, updated.length);
        } catch {}
      }
      showSuccess('Archived', `${studentName} was archived.`);
      await loadStudents();
      await loadGrades();
    } catch (e) {
      showError('Failed to Archive', 'Could not archive this student.');
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
      await studentService.batchSetArchived([studentId], false);
      if (selectedGrade && selectedGrade !== 'all') {
        try {
          await gradeService.addStudentToGrade(selectedGrade, studentId);
          const updated = await gradeService.getStudentsInGrade(selectedGrade);
          await gradeService.updateStudentCount(selectedGrade, updated.length);
        } catch {}
      }
      showSuccess('Restored', `${studentName} was restored.`);
      await loadStudents();
      await loadGrades();
    } catch (e) {
      showError('Failed to Restore', 'Could not restore this student.');
    }
  };

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
        // Update student count in Firestore
        const studentsInGrade = await gradeService.getStudentsInGrade(selectedGrade);
        await gradeService.updateStudentCount(selectedGrade, studentsInGrade.length);
      } catch (error) {
        Swal.close();
        showError('Failed to Remove', 'An error occurred while removing the student.');
      }
    }
  };


  // Load grades and their student counts
  const loadGrades = async () => {
    if (!currentUser?.uid) return;
    try {
      console.log('Starting to load grades...');
      const gradesData = await gradeService.getGradesByTeacherAll(currentUser.uid); // include active and archived
      console.log('Grades loaded successfully:', gradesData);
      // Get all students for the teacher
      let allStudents: Student[] = students;
      if (!allStudents.length && currentUser?.uid) {
        allStudents = await studentService.getStudents(currentUser.uid);
      }
      // Get student counts for each grade
      const gradesWithCounts = await Promise.all(gradesData.map(async (grade) => {
        try {
          if (grade.id) {
            const studentsInGrade = await gradeService.getStudentsInGrade(grade.id);
            // Only count students that exist in the main students collection
            const validStudentIds = allStudents.map(s => s.id);
            const filteredStudents = studentsInGrade.filter(sg => validStudentIds.includes(sg.studentId));
            return {
              ...grade,
              studentCount: filteredStudents.length
            };
          }
          return grade;
        } catch (error) {
          console.error(`Error getting students for grade ${grade.name}:`, error);
          return {
            ...grade,
            studentCount: 0
          };
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

  // View grade details
  const handleViewGrade = async (gradeId: string, gradeName: string) => {
    if (!currentUser?.uid) return;
    console.log(`[handleViewGrade] Setting loadingViewGradeId for grade: ${gradeId}`);
    setLoadingViewGradeId(gradeId);
    try {
      const grade = await gradeService.getGradeById(gradeId);
      const studentsInGradeSubcollection = await gradeService.getStudentsInGrade(gradeId);

      // Get the latest main student list
      const latestAllStudents = await studentService.getStudents(currentUser.uid);

      // Filter students from subcollection to only include those present in the main student list
      const validStudentsInGrade = studentsInGradeSubcollection.filter(sg => 
        latestAllStudents.some(s => s.id === sg.studentId)
      );

      if (grade) {
        await Swal.fire({
          title: gradeName,
          customClass: {
            popup: 'rounded-xl',
            title: 'text-white text-xl font-semibold',
            confirmButton: 'px-4 py-2 text-sm font-medium bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200',
          },
          backdrop: 'rgba(0,0,0,0.6)',
          background: '#fff',
          showCloseButton: true,
          html: `
            <div class="text-left p-4 bg-white rounded-b-xl -mt-4">
              <p class="mb-3 text-gray-700"><strong>Description:</strong> ${grade.description}</p>
              <p class="mb-5 text-gray-700"><strong>Total Students:</strong> ${validStudentsInGrade.length}</p>
              <h3 class="text-lg font-semibold text-gray-800 mb-3">Students in this Grade:</h3>
              <div class="max-h-60 overflow-y-auto border border-gray-200 rounded-lg">
                ${validStudentsInGrade.length > 0 ? `
                  <table class="min-w-full divide-y divide-gray-100">
                    <thead class="bg-gray-50">
                      <tr>
                        <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                        <th class="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-100">
                      ${validStudentsInGrade.map(student => `
                        <tr class="hover:bg-blue-50 transition-colors duration-150">
                          <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900">${student.name.replace(/\|/g, ' ')}</td>
                          <td class="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              onclick="window.removeStudent('${student.studentId}')"
                              class="text-red-600 hover:text-red-900 transition-colors duration-150 p-1"
                              title="Remove Student"
                            >
                              <i class="fas fa-user-minus"></i>
                            </button>
                          </td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                ` : `
                  <div class="p-4 text-center text-gray-500 italic">
                    <i class="fas fa-info-circle text-lg mb-2"></i>
                    <p>No students in this grade yet.</p>
                  </div>
                `}
              </div>
            </div>
          `,
          showConfirmButton: true,
          confirmButtonText: 'Close',
          showCancelButton: false,
          didOpen: (modalElement) => {
            (window as any).removeStudent = async (studentId: string) => {
              try {
                await gradeService.removeStudentFromGrade(gradeId, studentId);
                showSuccess('Student Removed', 'The student has been removed from the grade.');
                handleViewGrade(gradeId, gradeName); // Re-open modal to refresh student list
                await loadStudents();
                await loadGrades();
              } catch (error) {
                showError('Failed to Remove', 'An error occurred while removing the student.');
              }
            };
            // Adjust title bar background if needed
            const title = modalElement.querySelector('.swal2-title') as HTMLElement;
            if (title) {
              title.style.background = '#34495E'; // Solid dark blue color provided by user
              title.style.padding = '1rem 1.5rem';
              title.style.borderRadius = '0.75rem 0.75rem 0 0';
            }
          },
          willClose: () => {
            delete (window as any).removeStudent;
          }
        });
      } else {
        showError('Grade Not Found', 'The selected grade could not be found.');
      }
    } catch (error) {
      console.error('Error viewing grade:', error);
      showError('Error', 'Failed to load grade details.');
    } finally {
      console.log(`[handleViewGrade] Clearing loadingViewGradeId for grade: ${gradeId}`);
      setLoadingViewGradeId(null);
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
          popup: 'rounded-xl',
          title: 'text-white text-xl font-semibold',
          confirmButton: 'px-4 py-2 text-sm font-medium bg-blue-100 text-blue-700 rounded-lg shadow-md hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200',
          cancelButton: 'px-4 py-2 text-sm font-medium bg-white text-gray-700 rounded-lg shadow-md hover:bg-gray-100 transition-all duration-200',
        },
        backdrop: 'rgba(0,0,0,0.6)',
        background: '#fff',
        showCloseButton: true,
        html: `
          <div class="text-left p-4 bg-white rounded-b-xl -mt-4">
            <div class="mb-6">
              <label class="block text-sm font-medium text-gray-700 mb-2">Grade Level</label>
              <input id="grade-level" class="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm bg-gray-100 text-gray-700" value="${lockedGradeLevel}" disabled />
            </div>
            <div class="mb-6">
              <label class="block text-sm font-medium text-gray-700 mb-2">Section</label>
              <input id="grade-section" class="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="e.g., Athena" />
            </div>
            <div class="mb-6">
              <label class="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea
                id="grade-description"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., First grade students"
                rows="2"
              ></textarea>
            </div>
            <div class="mb-6">
              <label class="block text-sm font-medium text-gray-700 mb-2">Color</label>
              <select id="grade-color" class="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
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
        confirmButtonText: isCreatingGrade ? '<span class="inline-flex items-center"><span class="loader-spinner mr-2 w-4 h-4 border-white border-solid rounded-full animate-spin"></span> Creating...</span>' : 'Create Grade',
        cancelButtonText: 'Cancel',
        focusConfirm: false,
        allowOutsideClick: !isCreatingGrade,
        didOpen: (modalElement) => {
          // SweetAlert2 handles enabling/disabling based on preConfirm and confirmButtonText.
          // No need to manually enable/disable here.
          // Adjust title bar background if needed
          const title = modalElement.querySelector('.swal2-title') as HTMLElement;
          if (title) {
            title.style.background = '#34495E'; // Solid dark blue color provided by user
            title.style.padding = '1rem 1.5rem';
            title.style.borderRadius = '0.75rem 0.75rem 0 0';
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
            name: `${gradeLevel} - ${section}`,
            description,
            color
          };
        }
      });
      if (formValues) {
        const gradeData = {
          name: formValues.name.trim(),
          description: (formValues.description || '').trim(),
          studentCount: 0,
          color: formValues.color,
          isActive: true,
          ageRange: '' // Provide empty string for required field
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
            setSelectedGrade(gs[0].id || '');
          }
        });
      }
    })();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [currentUser?.uid]);

  // Always select the first class if none is selected and grades are loaded
  useEffect(() => {
    if (grades.length > 0 && (!selectedGrade || selectedGrade === 'all')) {
      const firstGradeId = grades[0].id || '';
      setSelectedGrade(firstGradeId);
      // Load students for the first class
      (async () => {
        try {
          const studentsInGrade = await gradeService.getStudentsInGrade(firstGradeId);
          const studentIds = studentsInGrade.map(s => s.studentId);
          const gradeStudents = students.filter(student => student.id && studentIds.includes(student.id));
          // Sort students by name A-Z
          gradeStudents.sort((a, b) => a.name.localeCompare(b.name));
          setFilteredStudents(gradeStudents);
        } catch (error) {
          setFilteredStudents([]);
        }
      })();
    }
  }, [grades, students]);

  const handleDeleteSelectedGrades = async () => {
    if (selectedGrades.length === 0) return;

    for (const gradeId of selectedGrades) {
      await gradeService.deleteGrade(gradeId);
    }
    
    setSelectedGrades([]);
    await loadGrades();
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
        <div class="text-left p-4 bg-white rounded-b-xl -mt-4">
          <input id="swal-parent-search" class="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-3" placeholder="Search parent..." value="${searchValue}" />
          <div style="max-height:220px;overflow-y:auto;">
            ${filteredParents.map(p => `
              <label for="parent-${p.id}" class="flex items-center space-x-3 py-2 px-2 rounded-md hover:bg-blue-50 transition cursor-pointer mb-1">
                <input type="radio" name="parent" value="${p.id}" id="parent-${p.id}" class="accent-blue-600" />
                <div class="flex flex-col">
                  <span class="font-semibold text-gray-900">${p.name}</span>
                  <span class="text-xs text-gray-500">${p.email}</span>
                </div>
              </label>
            `).join('')}
          </div>
        </div>
      `;
    };

    await Swal.fire({
      title: 'Link Parent',
      customClass: {
        popup: 'rounded-xl shadow-2xl',
        title: 'text-white text-xl font-semibold',
        confirmButton: 'px-4 py-2 text-sm font-medium bg-blue-100 text-blue-700 rounded-lg shadow-md hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200',
        cancelButton: 'px-4 py-2 text-sm font-medium bg-white text-gray-700 rounded-lg shadow-md hover:bg-gray-100 transition-all duration-200',
      },
      backdrop: 'rgba(0,0,0,0.6)',
      background: '#fff',
      showCloseButton: true,
      html: renderParentList(''),
      showCancelButton: true,
      confirmButtonText: 'Link',
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
          });
        }
        // Adjust title bar background if needed
        const title = modalElement.querySelector('.swal2-title') as HTMLElement;
        if (title) {
          title.style.background = '#34495E'; // Solid dark blue color provided by user
          title.style.padding = '1rem 1.5rem';
          title.style.borderRadius = '0.75rem 0.75rem 0 0';
        }
      },
    }).then(async (result) => {
      if (result.isConfirmed && result.value) {
        const parent = parents.find(p => p.id === result.value);
        if (!parent) return;
        try {
          await studentService.updateStudent(studentId, {
            parentId: parent.id,
            parentName: parent.name,
          });
          showSuccess('Parent linked!', `${parent.name} is now linked to this student.`);
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
          popup: 'rounded-xl',
          title: 'text-white text-xl font-semibold',
          confirmButton: 'px-4 py-2 text-sm font-medium bg-blue-100 text-blue-700 rounded-lg shadow-md hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200',
          cancelButton: 'px-4 py-2 text-sm font-medium bg-white text-gray-700 rounded-lg shadow-md hover:bg-gray-100 transition-all duration-200',
        },
        backdrop: 'rgba(0,0,0,0.6)',
        background: '#fff',
        showCloseButton: true,
        html: `
          <div class="text-left p-4 bg-white rounded-b-xl -mt-4">
            <div class="mb-4">
              <label class="block text-sm font-medium text-gray-700 mb-2">Name</label>
              <input id="student-name" class="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="e.g., Juan Dela Cruz">
            </div>
            <div class="mb-4">
              <label class="block text-sm font-medium text-gray-700 mb-2">Reading Level</label>
              <select id="student-reading-level" class="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                <option value="">Select reading level</option>
                <option value="Independent">Independent</option>
                <option value="Instructional">Instructional</option>
                <option value="Frustrational">Frustrational</option>
              </select>
            </div>
            <div class="mb-4">
              <label class="block text-sm font-medium text-gray-700 mb-2">Parent (optional)</label>
              <select id="student-parent-id" class="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                <option value="">No parent</option>
                ${parents.map(p => `<option value="${p.id}">${p.name} (${p.email})</option>`).join('')}
              </select>
            </div>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: isAddingStudentToGrade ? '<span class="inline-flex items-center"><span class="loader-spinner mr-2 w-4 h-4 border-t-2 border-r-2 border-white border-solid rounded-full animate-spin"></span> Adding...</span>' : 'Add',
        cancelButtonText: 'Cancel',
        focusConfirm: false,
        allowOutsideClick: !isAddingStudentToGrade,
        didOpen: (modalElement) => {
          // SweetAlert2 handles enabling/disabling based on preConfirm and confirmButtonText.
          // No need to manually enable/disable here.
          // Adjust title bar background if needed
          const title = modalElement.querySelector('.swal2-title') as HTMLElement;
          if (title) {
            title.style.background = '#34495E'; // Solid dark blue color provided by user
            title.style.padding = '1rem 1.5rem';
            title.style.borderRadius = '0.75rem 0.75rem 0 0';
          }
        },
        preConfirm: () => {
          // This is for the modal's confirm button loading state
          setIsAddingStudentToGrade(true);

          const name = (document.getElementById('student-name') as HTMLInputElement).value.trim();
          const readingLevel = (document.getElementById('student-reading-level') as HTMLSelectElement).value;
          const parentId = (document.getElementById('student-parent-id') as HTMLSelectElement).value;
          const parent = parents.find(p => p.id === parentId);
          if (!name || !readingLevel) {
            Swal.showValidationMessage('Please fill in all required fields');
            setIsAddingStudentToGrade(false); // Reset if validation fails
            return false;
          }
          return { name, readingLevel, parentId: parentId || undefined, parentName: parent ? parent.name : '' };
        }
      });

      if (formValues) {
        // Logic to add the student
        const newStudent = {
          name: formValues.name,
          grade: gradeName,
          readingLevel: formValues.readingLevel,
          age: 10, // Default age
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
        showSuccess('Student Added', `${formValues.name} has been added to ${gradeName}.`);
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
        setGrades((prevGrades) => prevGrades.map((g) =>
          g.id === gradeId ? { ...g, studentCount: snapshot.size } : g
        ));
        },
        (error) => {
          console.warn(`Permission denied for grade ${gradeId} students:`, error);
          // Don't update the count if permission is denied
        }
      );
      unsubscribes.push(unsubscribe);
    };
    grades.forEach((grade) => {
      if (grade.id) updateCounts(grade.id);
    });
    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [currentUser?.uid, grades.length]);

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
    <div className="min-h-screen bg-gray-50">
      {/* Profile Completion Warning */}
      {!isProfileComplete && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <i className="fas fa-exclamation-triangle text-yellow-400"></i>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                <strong>Profile Incomplete:</strong> Please complete your profile information to access all features. 
                Missing fields: {userRole === 'teacher' ? 'Phone Number, School' : userRole === 'parent' ? 'Phone Number' : 'Phone Number, School'}.
                <a href="/teacher/profile" className="font-medium underline hover:text-yellow-600 ml-1">
                  Update Profile
                </a>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-[1920px] mx-auto px-2 sm:px-4 lg:px-6 py-4">
        <div className="grid grid-cols-12 gap-4">
          {/* Class Grades Section */}
          <div className="col-span-12 lg:col-span-3">
            <div className="bg-gradient-to-b from-blue-50/60 to-white rounded-2xl shadow-lg h-[calc(100vh-6rem)] flex flex-col border border-blue-100">
              <div className="px-4 py-4 border-b border-blue-100 flex items-center justify-between rounded-t-2xl bg-white/80">
                <h3 className="text-lg font-bold text-blue-900 tracking-tight flex items-center gap-2">
                  <i className="fas fa-layer-group text-blue-400"></i> Class Grades
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowArchived(v => !v)}
                    className={`inline-flex items-center justify-center h-10 rounded-full px-3 ${showArchived ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'} hover:bg-amber-100 hover:text-amber-700 shadow focus:outline-none focus:ring-2 focus:ring-amber-400 transition`}
                    title={showArchived ? 'Showing Archived' : 'Show Archived'}
                  >
                    <i className="fas fa-archive mr-1"></i>
                    <span className="text-xs">{showArchived ? 'Archived' : 'Active'}</span>
                  </button>
                  {selectedGrades.length > 0 && (
                    <button
                      onClick={handleDeleteSelectedGrades}
                      className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-red-100 hover:bg-red-200 text-red-600 hover:text-red-700 shadow focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 transition"
                      title={`Delete ${selectedGrades.length} selected grade(s)`}
                      disabled={!canManage}
                    >
                      <i className="fas fa-trash text-lg"></i>
                    </button>
                  )}
                  <button
                    onClick={handleAddGrade}
                    className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-600 hover:text-blue-800 shadow focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 transition"
                    disabled={!canManage}
                    title="Add Grade"
                  >
                    <i className="fas fa-plus text-lg"></i>
                  </button>
                </div>
              </div>
              {/* Improved Grade Cards Container */}
              <div className="flex-1 overflow-y-auto p-2">
                <div className="flex flex-col gap-4 min-w-0 max-w-full lg:flex-col lg:flex-wrap">
                  {grades.length === 0 ? (
                    <div className="text-center text-gray-400 py-8 italic w-full">No grades found. Click + to add a grade.</div>
                  ) : (
                    grades
                      .filter(g => showArchived ? g.isActive === false : g.isActive !== false)
                      .map((grade) => (
                      <div
                        key={grade.id}
                        className={`flex flex-col w-full max-w-full rounded-xl border-2 cursor-pointer transition-all duration-200 bg-white/90 ${selectedGrade === grade.id ? 'border-blue-500 ring-2 ring-blue-200' : 'border-blue-100'} ${selectedGrades.includes(grade.id || '') ? 'bg-red-50' : ''} ${getGradeColorClasses(grade.color)}`}
                        style={{ minWidth: 0 }}
                        onClick={() => grade.id && handleGradeSelect(grade.id)}
                      >
                        <div className="flex items-center gap-3 p-4 pb-2 min-w-0">
                          <span className={`w-10 h-10 flex items-center justify-center rounded-full text-lg font-bold ${getBadgeColorClasses(grade.color)}`}>{grade.name[0]}</span>
                          <div className="flex flex-col min-w-0">
                            <span className="text-base font-semibold truncate max-w-[120px]">{grade.name}</span>
                            <span className="text-xs text-gray-500 truncate max-w-[120px]">{grade.description || 'No description'}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between px-4 pb-4 pt-2 min-w-0">
                          <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getBadgeColorClasses(grade.color)}`} title="Student count">{countsByGrade[grade.id || ''] ?? 0} students</span>
                          <div className="flex flex-row flex-nowrap items-center gap-2 min-w-0">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                grade.id && handleViewGrade(grade.id, grade.name);
                              }}
                              className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-600 hover:text-blue-800 shadow focus:outline-none focus:ring-2 focus:ring-blue-300 transition"
                              title="View Students"
                              disabled={loadingViewGradeId === grade.id || !canManage}
                            >
                              <i className="fas fa-eye"></i>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                grade.id && handleAddStudentsToGrade(grade.id, grade.name);
                              }}
                              className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-green-50 hover:bg-green-100 text-green-600 hover:text-green-800 shadow focus:outline-none focus:ring-2 focus:ring-green-300 transition"
                              title="Add Students"
                              disabled={loadingAddStudentToGradeId === grade.id || !canManage}
                            >
                              <i className="fas fa-user-plus"></i>
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
                              className={`inline-flex items-center justify-center w-9 h-9 rounded-full ${grade.isActive === false ? 'bg-green-50 hover:bg-green-100 text-green-600 hover:text-green-800 focus:ring-green-300' : 'bg-amber-50 hover:bg-amber-100 text-amber-600 hover:text-amber-800 focus:ring-amber-300'} shadow focus:outline-none focus:ring-2 transition ${deletingGradeId === grade.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                              title={`${grade.isActive === false ? 'Restore' : 'Archive'} ${grade.name}`}
                              aria-label={`${grade.isActive === false ? 'Restore' : 'Archive'} ${grade.name}`}
                              disabled={deletingGradeId === grade.id}
                            >
                              <i className={`fas ${grade.isActive === false ? 'fa-undo' : 'fa-archive'}`}></i>
                            </button>
                            {grade.isActive === false && (
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (!grade.id) return;
                                  await handleDeleteArchivedGrade(grade.id, grade.name);
                                }}
                                className={`inline-flex items-center justify-center w-9 h-9 rounded-full bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-800 shadow focus:outline-none focus:ring-2 focus:ring-red-300 transition`}
                              title={`Delete ${grade.name}`}
                              aria-label={`Delete ${grade.name}`}
                            >
                              <i className="fas fa-trash"></i>
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
                                      popup: 'rounded-xl',
                                      title: 'text-white text-xl font-semibold',
                                      confirmButton: 'px-4 py-2 text-sm font-medium bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200',
                                      cancelButton: 'px-4 py-2 text-sm font-medium bg-white text-gray-700 rounded-lg shadow-md hover:bg-gray-100 transition-all duration-200',
                                    },
                                    backdrop: 'rgba(0,0,0,0.6)',
                                    background: '#fff',
                                    showCloseButton: true,
                                    html: `
                                      <div class="text-left p-4 bg-white rounded-b-xl -mt-4">
                                        <div class="mb-6">
                                          <label class="block text-sm font-medium text-gray-700 mb-2">Grade Name</label>
                                          <input id="edit-grade-name" class="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" value="${grade.name}" />
                                        </div>
                                        <div class="mb-6">
                                          <label class="block text-sm font-medium text-gray-700 mb-2">Description</label>
                                          <textarea id="edit-grade-description" class="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" rows="2">${grade.description || ''}</textarea>
                                        </div>
                                        <div class="mb-6">
                                          <label class="block text-sm font-medium text-gray-700 mb-2">Color</label>
                                          <select id="edit-grade-color" class="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
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
                                    confirmButtonText: 'Save',
                                    cancelButtonText: 'Cancel',
                                    focusConfirm: false,
                                    preConfirm: () => {
                                      const name = (document.getElementById('edit-grade-name') as HTMLInputElement).value.trim();
                                      const description = (document.getElementById('edit-grade-description') as HTMLTextAreaElement).value.trim();
                                      const color = (document.getElementById('edit-grade-color') as HTMLSelectElement).value;
                                      if (!name || !description || !color) {
                                        Swal.showValidationMessage('Please fill in all required fields');
                                        return false;
                                      }
                                      return { name, description, color };
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
                              className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-yellow-50 hover:bg-yellow-100 text-yellow-600 hover:text-yellow-800 shadow focus:outline-none focus:ring-2 focus:ring-yellow-300 transition"
                              title="Edit Grade"
                              disabled={loadingEditGradeId === grade.id || !canManage}
                            >
                              <i className="fas fa-edit"></i>
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
            <div className="bg-white rounded-lg shadow h-[calc(100vh-6rem)] flex flex-col">
              <div className="px-3 py-3 border-b border-gray-200 sm:px-4 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <h3 className="text-lg font-semibold text-gray-900">Students</h3>
                  <span className="px-2 py-1 text-sm font-medium text-gray-600 bg-gray-100 rounded-full">
                    {(selectedGrade && selectedGrade !== 'all') ? filteredStudents.length : 0} {showArchived ? 'archived' : 'active'}
                  </span>
                </div>
                <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-3">
                  <select
                    aria-label="Filter students"
                    value={selectedFilter}
                    onChange={(e) => setSelectedFilter(e.target.value)}
                    className="block w-full pl-2.5 pr-8 py-1.5 text-sm border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
                  >
                    <option value="all">All Students</option>
                  </select>
                  <select
                    aria-label="Sort students"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="block w-full pl-2.5 pr-8 py-1.5 text-sm border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
                  >
                    <option value="name-asc">Name (A-Z)</option>
                    <option value="name-desc">Name (Z-A)</option>
                    <option value="readingLevel-desc">Reading Level (High to Low)</option>
                    <option value="readingLevel-asc">Reading Level (Low to High)</option>
                    <option value="age">Age (Low to High)</option>
                  </select>
                </div>
              </div>
              <div className="px-3 py-3 border-b border-gray-100 sm:px-4 flex flex-col sm:flex-row sm:items-center sm:justify-between bg-gray-50">
                <div className="flex-1 flex items-center space-x-3">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                      <i className="fas fa-search text-gray-400"></i>
                    </div>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by name, grade, contact, age..."
                      className="block w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
                  <button
                    onClick={handleArchiveAllStudents}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-md"
                    disabled={deletingAllStudents || !canManage}
                    title="Archive hides students from the roster without erasing their data"
                  >
                    {deletingAllStudents ? (
                      <span className="loader-spinner" style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid #f3f3f3', borderTop: '2px solid #d97706', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    ) : (
                      'Archive All Students'
                    )}
                  </button>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      disabled={!canManage}
                    >
                      <i className="fas fa-file-import mr-1.5"></i>
                      Import
                    </button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                    />
                    {showArchived ? (
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
                              .filter((s: any) => s.archived && s.grade === (gradeObj?.name || ''))
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
                            showSuccess('Restored', 'All archived students were restored.');
                            await loadStudents();
                            await loadGrades();
                          } catch (e) {
                            showError('Failed to Restore', 'Could not restore archived students.');
                          }
                        }}
                        className="inline-flex items-center px-2.5 py-1.5 text-sm font-medium rounded-md shadow-sm text-green-700 bg-green-100 hover:bg-green-200"
                        disabled={!canManage}
                      >
                        <i className="fas fa-undo mr-1.5"></i>
                        Restore All
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
              {/* Students List */}
              <div className="flex-1 overflow-auto">
                {filteredStudents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full bg-gray-50">
                    <div className="text-center p-8">
                      <i className="fas fa-search text-4xl text-gray-400 mb-4"></i>
                      <p className="text-sm text-gray-500">
                        {searchQuery ? `No results for "${searchQuery}"` : 'No students found'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr>
                        <th scope="col" className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                        <th scope="col" className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">LRN</th>
                        <th scope="col" className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Parent</th>
                        <th scope="col" className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ISR</th>
                        <th scope="col" className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
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
                          <tr key={student.id} className={`transition-colors ${hoverBg}`}>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="flex-shrink-0 h-8 w-8">
                                  <div className={`h-8 w-8 rounded-full flex items-center justify-center ${badgeColor}`}>
                                    <span className="font-medium text-sm">
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
                                  <div className="text-sm font-medium text-gray-900 select-none">
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
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="text-sm text-gray-900 select-none">{student.lrn || '-'}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-left align-middle">
                              <div className="flex items-center h-8">
                                {student.parentId ? (
                                  <span
                                    className="px-2 py-0.5 text-xs font-medium text-green-700 bg-green-100 rounded-full cursor-default select-none"
                                    title={student.parentName || "Parent linked"}
                                  >
                                    Linked
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => student.id && handleLinkParent(student.id)}
                                    className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer select-none"
                                  >
                                    <><i className="fas fa-link mr-1.5"></i>Link Parent</>
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <button
                                onClick={() => handleViewISR(student)}
                                className="px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 hover:bg-blue-200"
                                title="View ISR"
                              >
                                View
                              </button>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                              <div className="flex justify-end space-x-2">
                                <button
                                  onClick={() => student.id && handleViewProfile(student.id)}
                                  className="text-blue-600 hover:text-blue-900 select-none"
                                  title="View Profile"
                                  disabled={loadingStudentId === student.id || !canManage}
                                >
                                  {loadingStudentId === student.id ? (
                                    <span className="loader-spinner" style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid #f3f3f3', borderTop: '2px solid #3498db', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                                  ) : (
                                    <i className="fas fa-eye"></i>
                                  )}
                                </button>
                                <button
                                  onClick={() => student.id && handleEditStudent(student.id)}
                                  className="text-indigo-600 hover:text-indigo-900 select-none"
                                  title="Edit Student"
                                  disabled={!canManage}
                                >
                                    <i className="fas fa-edit"></i>
                                </button>
                                {(!showArchived) ? (
                                <button
                                    onClick={() => student.id && handleArchiveStudent(student.id, student.name)}
                                    className="text-amber-600 hover:text-amber-800 select-none"
                                    title="Archive Student"
                                  disabled={!canManage}
                                >
                                    <i className="fas fa-archive"></i>
                                </button>
                                ) : (
                                  <button
                                    onClick={() => student.id && handleRestoreStudent(student.id, student.name)}
                                    className="text-green-600 hover:text-green-800 select-none"
                                    title="Restore Student"
                                    disabled={!canManage}
                                  >
                                    <i className="fas fa-undo"></i>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Import Preview Modal */}
      {showImportPreview && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col pointer-events-auto overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-[#34495E] rounded-t-xl">
              <h3 className="text-lg font-semibold text-white">Import Preview</h3>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleCancelImport}
                  className="px-4 py-2 text-sm font-medium text-white bg-transparent border border-white rounded-lg hover:bg-white hover:text-blue-600 transition-all duration-200"
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
                      className="inline-flex items-center px-3 py-2 text-xs font-medium text-amber-700 bg-amber-100 rounded-lg hover:bg-amber-200 transition"
                      title="Remove duplicates from this file and keep unique students"
                    >
                      <i className="fas fa-broom mr-2"></i>Remove Duplicates
                    </button>
                  )}
                <button
                  onClick={handleImportStudents}
                    disabled={isImporting || duplicateStats.within > 0 || duplicateStats.existing > 0}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 bg-white rounded-lg shadow-md hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                    title={duplicateStats.within > 0 || duplicateStats.existing > 0 ? 'Resolve duplicate entries before importing' : undefined}
                >
                  {isImporting ? (
                    <span className="inline-flex items-center"><span className="loader-spinner mr-2 w-4 h-4 border-t-2 border-r-2 border-blue-600 border-solid rounded-full animate-spin"></span> Importing...</span>
                  ) : (
                    'Import Students'
                  )}
                </button>
              </div>
            </div>
            </div>
            <div className="p-4 bg-gray-50 border-b border-gray-200 space-y-2">
              <div className="flex items-center">
              <i className="fas fa-info-circle text-blue-500 mr-3 text-lg"></i>
              <p className="text-sm text-gray-700">
                Found {importedStudents.length} students to import. Please review the data below.
              </p>
              </div>
              <div className={`flex items-start text-xs sm:text-sm rounded-md p-2 ${duplicateStats.within > 0 || duplicateStats.existing > 0 ? 'text-amber-800 bg-amber-50 border border-amber-200' : 'text-blue-800 bg-blue-50 border border-blue-200'}`}>
                <i className={`fas ${duplicateStats.within > 0 || duplicateStats.existing > 0 ? 'fa-exclamation-triangle' : 'fa-info-circle'} mt-0.5 mr-2`}></i>
                <div>
                  {duplicateStats.within > 0 || duplicateStats.existing > 0 ? (
                    <>
                      <p className="font-semibold">We’ll keep your list tidy</p>
                      <ul className="list-disc ml-5">
                        {duplicateStats.within > 0 && (
                          <li>{duplicateStats.within} repeated name/LRN entries in this file will be skipped automatically.</li>
                        )}
                        {duplicateStats.existing > 0 && (
                          <li>{duplicateStats.existing} students already in your class list will not be added again.</li>
                        )}
                      </ul>
                      {(duplicateDetails.within.length > 0 || duplicateDetails.existing.length > 0) && (
                        <details className="mt-1">
                          <summary className="cursor-pointer select-none underline">View duplicates</summary>
                          <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {duplicateDetails.within.length > 0 && (
                              <div>
                                <div className="font-medium">In this file</div>
                                <ul className="list-disc ml-5">
                                  {duplicateDetails.within.slice(0,5).map((s,i)=> (
                                    <li key={`w-${i}`}>{(s.firstName||'').trim()} {(s.lastName||'').trim()} {s.lrn ? `(${s.lrn})` : ''}</li>
                                  ))}
                                  {duplicateDetails.within.length > 5 && <li>+{duplicateDetails.within.length-5} more…</li>}
                                </ul>
                              </div>
                            )}
                            {duplicateDetails.existing.length > 0 && (
                              <div>
                                <div className="font-medium">Already in your class</div>
                                <ul className="list-disc ml-5">
                                  {duplicateDetails.existing.slice(0,5).map((s,i)=> (
                                    <li key={`e-${i}`}>{(s.firstName||'').trim()} {(s.lastName||'').trim()} {s.lrn ? `(${s.lrn})` : ''}</li>
                                  ))}
                                  {duplicateDetails.existing.length > 5 && <li>+{duplicateDetails.existing.length-5} more…</li>}
                                </ul>
                              </div>
                            )}
                          </div>
                        </details>
                      )}
                    </>
                  ) : (
                    <p>Looks good! We didn’t find any duplicates in this file.</p>
                  )}
                </div>
              </div>
            </div>
            <div className="overflow-x-auto flex-1">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">First Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Last Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">LRN</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Age</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {importedStudents.map((student, index) => (
                    <tr key={index} className="hover:bg-blue-50 transition-colors duration-150">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{student.firstName || '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{student.lastName || '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{student.lrn || '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{student.age || 10}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {importedStudents.length === 0 && (
              <div className="p-6 text-center text-gray-500 italic bg-white">
                <i className="fas fa-file-excel text-4xl mb-4 text-gray-300"></i>
                <p>No student data to preview.</p>
                <p className="text-xs mt-2">Please upload a valid .xlsx, .xls, or .csv file.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ClassList; 