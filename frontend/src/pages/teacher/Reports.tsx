import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { studentService, type Student } from '../../services/studentService';
import { resultService } from '../../services/resultsService';
import { getUserProfile } from '../../services/authService';
import { gradeService, type ClassGrade } from '../../services/gradeService';

const Reports: React.FC<{ setIsHeaderDarkened?: (v: boolean) => void }> = ({ setIsHeaderDarkened }) => {
  const { currentUser } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [classGrades, setClassGrades] = useState<ClassGrade[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedReport, setSelectedReport] = useState('overview');
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [studentMetrics, setStudentMetrics] = useState<Record<string, any>>({});
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [progressOpen, setProgressOpen] = useState(false);
  const [progressData, setProgressData] = useState<any>(null);
  const [progressLoading, setProgressLoading] = useState(false);
  const [studentCombinedResults, setStudentCombinedResults] = useState<Record<string, any[]>>({});
  const [studentReadingResults, setStudentReadingResults] = useState<Record<string, any[]>>({});
  const [studentTestResults, setStudentTestResults] = useState<Record<string, any[]>>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'reading' | 'test' | null>(null);
  const [modalStudent, setModalStudent] = useState<Student | null>(null);
  const [modalSearchTerm, setModalSearchTerm] = useState('');

  // Student-specific printable report
  const [selectedStudentIdForISR, setSelectedStudentIdForISR] = useState<string>('');

  // Share-to-parent modal state
  const [shareOpen, setShareOpen] = useState(false);
  const [shareStudent, setShareStudent] = useState<Student | null>(null);
  const [parentEmail, setParentEmail] = useState('');
  
  // Collapsible class state
  const [collapsedClasses, setCollapsedClasses] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchClassGrades = async () => {
      if (!currentUser?.uid) return;
      try {
        const fetchedGrades = await gradeService.getGradesByTeacher(currentUser.uid);
        setClassGrades(fetchedGrades || []);
      } catch (error) {
        console.error('Error fetching class grades:', error);
        setClassGrades([]);
      }
    };
    fetchClassGrades();
  }, [currentUser?.uid]);

  useEffect(() => {
    const fetchStudents = async () => {
      if (!currentUser?.uid) return;
      try {
        const fetchedStudents = await studentService.getStudents(currentUser.uid);
        setStudents(fetchedStudents);
      } catch (error) {
        setStudents([]);
      }
    };
    fetchStudents();
  }, [currentUser?.uid]);

  useEffect(() => {
    const fetchMetrics = async () => {
      const metrics: Record<string, any> = {};
      for (const student of students) {
        if (student.id) {
          try {
            metrics[student.id] = await resultService.getStudentCombinedMetrics(student.id);
          } catch (e) {
            metrics[student.id] = {};
          }
        }
      }
      setStudentMetrics(metrics);
    };
    if (students.length > 0) fetchMetrics();
  }, [students]);

  useEffect(() => {
    const fetchCombinedResults = async () => {
      const combined: Record<string, any[]> = {};
      for (const student of students) {
        if (student.id) {
          try {
            combined[student.id] = await resultService.getCombinedResults(student.id);
          } catch (e) {
            combined[student.id] = [];
          }
        }
      }
      setStudentCombinedResults(combined);
    };
    if (students.length > 0) fetchCombinedResults();
  }, [students]);

  useEffect(() => {
    const fetchResults = async () => {
      const reading: Record<string, any[]> = {};
      const test: Record<string, any[]> = {};
      for (const student of students) {
        if (student.id) {
          try {
            reading[student.id] = await resultService.getReadingResults(student.id);
          } catch (e) {
            reading[student.id] = [];
          }
          try {
            test[student.id] = await resultService.getTestResults(student.id);
          } catch (e) {
            test[student.id] = [];
          }
        }
      }
      setStudentReadingResults(reading);
      setStudentTestResults(test);
    };
    if (students.length > 0) fetchResults();
  }, [students]);

  // Group students by class
  const studentsByClass = useMemo(() => {
    const grouped: Record<string, Student[]> = {};
    students.forEach(student => {
      const className = student.grade || 'Unassigned';
      if (!grouped[className]) {
        grouped[className] = [];
      }
      grouped[className].push(student);
    });
    return grouped;
  }, [students]);

  // Filter students based on selected class
  const filteredStudents = useMemo(() => {
    if (!selectedClass) return students;
    return students.filter(student => student.grade === selectedClass);
  }, [students, selectedClass]);

  // Get students to display in the table (filtered by class if selected)
  const studentsToDisplay = useMemo(() => {
    if (selectedClass) {
      return studentsByClass[selectedClass] || [];
    }
    return students;
  }, [selectedClass, studentsByClass, students]);

  const classStats = {
    totalStudents: filteredStudents.length,
    averageReadingLevel: 2.3,
    totalReadingSessions: 156,
    completedAssessments: 89,
    improvementRate: 15.2
  };

  const studentPerformance = [
    {
      id: 1,
      name: 'Emma Wilson',
      readingLevel: 2,
      progress: 85,
      assessments: 8,
      avgScore: 88,
      trend: 'up'
    },
    {
      id: 2,
      name: 'Jack Davis',
      readingLevel: 1,
      progress: 65,
      assessments: 6,
      avgScore: 72,
      trend: 'up'
    },
    {
      id: 3,
      name: 'Sarah Miller',
      readingLevel: 2,
      progress: 78,
      assessments: 9,
      avgScore: 85,
      trend: 'stable'
    },
    {
      id: 4,
      name: 'Tim Wilson',
      readingLevel: 1,
      progress: 45,
      assessments: 5,
      avgScore: 68,
      trend: 'down'
    }
  ];

  const monthlyData = [
    { month: 'Sep', readingLevel: 1.8 },
    { month: 'Oct', readingLevel: 1.9 },
    { month: 'Nov', readingLevel: 2.1 },
    { month: 'Dec', readingLevel: 2.2 },
    { month: 'Jan', readingLevel: 2.3 }
  ];

  const handleExportReport = (reportType: string) => {
    try {
      const headers = [
        'Student Name',
        'Grade',
        'Reading Level',
        'Latest Reading: Words Read',
        'Latest Reading: Miscues',
        'Latest Reading: Oral Reading Score (%)',
        'Latest Reading: Speed (WPM)',
        'Latest Reading: Date',
        'Latest Test: Name',
        'Latest Test: Score',
        'Latest Test: Comprehension (%)',
        'Latest Test: Correct/Total',
        'Latest Test: Date'
      ];

      const escape = (val: any) => {
        if (val === null || val === undefined) return '';
        const s = String(val).replace(/\n/g, ' ').replace(/\r/g, ' ');
        if (/[",]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
        return s;
      };

      const rows: string[][] = [headers];
      for (const student of students) {
        if (!student.id) continue;
        const readingList = studentReadingResults[student.id] || [];
        const testList = studentTestResults[student.id] || [];
        const latestReading = readingList.length
          ? [...readingList].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
          : null;
        const latestTest = testList.length
          ? [...testList].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
          : null;

        rows.push([
          escape(student.name?.replace(/\|/g, ' ') || ''),
          escape(student.grade || ''),
          escape(student.readingLevel ?? ''),
          escape(latestReading?.wordsRead ?? ''),
          escape(latestReading?.miscues ?? ''),
          escape(latestReading?.oralReadingScore ?? ''),
          escape(latestReading?.readingSpeed ?? ''),
          escape(latestReading?.createdAt ? new Date(latestReading.createdAt).toLocaleString() : ''),
          escape(latestTest?.testName ?? ''),
          escape(latestTest?.score ?? ''),
          escape(latestTest?.comprehension ?? ''),
          escape(latestTest && latestTest.correctAnswers != null && latestTest.totalQuestions != null ? `${latestTest.correctAnswers}/${latestTest.totalQuestions}` : ''),
          escape(latestTest?.createdAt ? new Date(latestTest.createdAt).toLocaleString() : '')
        ]);
      }

      const csv = rows.map(r => r.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const ts = new Date().toISOString().replace(/[:T]/g, '-').split('.')[0];
      link.download = `report-${reportType}-${ts}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      // optional toast
    }
  };

  const handleGenerateReport = async (reportType: string) => {
    if (reportType !== 'student-isr') return;
    const student = students.find(s => s.id === selectedStudentIdForISR);
    if (!student || !student.id) return;

    const readingList = studentReadingResults[student.id] || [];
    const testList = studentTestResults[student.id] || [];
    const latestReading = readingList.length
      ? [...readingList].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
      : null;
    const latestTest = testList.length
      ? [...testList].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
      : null;

    const safe = (v: any) => (v === undefined || v === null ? '' : String(v));

    // Helpers to map scores to ISR buckets
    const determineReadingLevelBucket = (score: number | string | undefined | null) => {
      if (score === undefined || score === null) return '';
      const n = typeof score === 'string' ? parseFloat(score) : score;
      if (isNaN(n)) return '' as any;
      if (n >= 95) return 'Ind';
      if (n >= 90) return 'Ins';
      return 'Frus';
    };
    const determineComprehensionBucket = (score: number | string | undefined | null) => {
      if (score === undefined || score === null) return '';
      const n = typeof score === 'string' ? parseFloat(score) : score;
      if (isNaN(n)) return '' as any;
      if (n >= 80) return 'Ind';
      if (n >= 59) return 'Ins';
      return 'Frus';
    };

    const readingBucket = determineReadingLevelBucket(latestReading?.oralReadingScore);
    const compBucket = determineComprehensionBucket(latestTest?.comprehension);
    const levels = ['K','I','II','III','IV','V','VI','VII'];
    const toRoman = (num?: number | null) => {
      if (num === undefined || num === null) return '';
      const map: Record<number, string> = {1:'I',2:'II',3:'III',4:'IV',5:'V',6:'VI',7:'VII'};
      return map[num] || '';
    };
    const startedLevel = toRoman(typeof student.readingLevel === 'number' ? student.readingLevel : parseInt(String(student.readingLevel || ''), 10));

    // Attempt to infer story language from latest reading/test or default to Filipino
    const storyLanguage = (latestReading?.language || latestTest?.language || 'Filipino').toString();

    // Try to fetch teacher profile for school/teacher name
    let teacherName = '';
    let schoolName = '';
    try {
      // getUserProfile reads the current logged-in user (teacher)
      const profile: any = await (getUserProfile() as Promise<any>);
      teacherName = profile?.displayName || '';
      schoolName = profile?.school || '';
    } catch {}

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Individual Summary Record</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
            .title { text-align: center; font-weight: 700; font-size: 18px; margin-bottom: 8px; }
            .subtitle { text-align: center; color: #374151; margin-bottom: 20px; }
            .row { display: flex; gap: 16px; margin-bottom: 8px; }
            .field { flex: 1; }
            .label { font-size: 12px; color: #374151; }
            .value { border-bottom: 1px solid #d1d5db; padding: 4px 0; min-height: 18px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
            th, td { border: 1px solid #e5e7eb; padding: 6px; text-align: left; vertical-align: middle; }
            th { background: #f9fafb; }
            .section { margin-top: 20px; font-weight: 600; }
            .note { font-size: 11px; color: #6b7280; margin-top: 6px; }
            @media print { .no-print { display: none; } }
            .btn { margin-top: 16px; padding: 8px 12px; background: #2563eb; color: white; border: 0; border-radius: 6px; cursor: pointer; }
            .center { text-align: center; }
          </style>
        </head>
        <body>
          <div class="title">Individual Summary Record (ISR)</div>
          <div class="subtitle">Talaan ng Indibidwal na Pagbabasa (TIP)</div>

          <div class="row">
            <div class="field"><div class="label">Name</div><div class="value">${safe(student.name?.replace(/\|/g,' '))}</div></div>
            <div class="field"><div class="label">Age</div><div class="value"></div></div>
            <div class="field"><div class="label">Grade/Section</div><div class="value">${safe(student.grade)}</div></div>
          </div>
          <div class="row">
            <div class="field"><div class="label">School</div><div class="value">${safe(schoolName)}</div></div>
            <div class="field"><div class="label">Teacher</div><div class="value">${safe(teacherName)}</div></div>
          </div>
          <div class="row">
            <div class="field"><div class="label">Language</div><div class="value">${storyLanguage === 'Filipino' || storyLanguage.toLowerCase() === 'tagalog' || storyLanguage === 'none' ? 'Filipino ✓  English ☐' : 'Filipino ☐  English ✓'}</div></div>
            <div class="field"><div class="label">Reading Level</div><div class="value">${safe(student.readingLevel)}</div></div>
          </div>

          <!-- Latest Results removed per request -->

          <div class="section">Instructional Level Summary</div>
          <table>
            <thead>
              <tr>
                <th class="center" colspan="2">Level Started</th>
                <th class="center" rowspan="2">Level</th>
                <th class="center" rowspan="2">Set<br/><span style="font-weight:400">Indicate if A, B, C, or D</span></th>
                <th class="center" colspan="3">Word Reading</th>
                <th class="center" colspan="3">Comprehension</th>
                <th class="center" rowspan="2">Date Taken</th>
              </tr>
              <tr>
                <th class="center" colspan="2">Mark with an *</th>
                <th class="center">Ind</th>
                <th class="center">Ins</th>
                <th class="center">Frus</th>
                <th class="center">Ind</th>
                <th class="center">Ins</th>
                <th class="center">Frus</th>
              </tr>
            </thead>
            <tbody>
              ${levels.map(lvl => {
                const isStarted = startedLevel && lvl === startedLevel ? '*' : '';
                const wrInd = readingBucket === 'Ind' ? '✓' : '';
                const wrIns = readingBucket === 'Ins' ? '✓' : '';
                const wrFr  = readingBucket === 'Frus' ? '✓' : '';
                const cInd  = compBucket === 'Ind' ? '✓' : '';
                const cIns  = compBucket === 'Ins' ? '✓' : '';
                const cFr   = compBucket === 'Frus' ? '✓' : '';
                const dateReading = latestReading?.createdAt ? new Date(latestReading.createdAt).toLocaleDateString() : '';
                const dateTest = latestTest?.createdAt ? new Date(latestTest.createdAt).toLocaleDateString() : '';
                const dateTaken = dateReading || dateTest;
                return `
                <tr>
                  <td class="center" style="width:90px">${isStarted}</td>
                  <td class="center" style="width:60px"></td>
                  <td class="center" style="width:60px">${lvl}</td>
                  <td class="center" style="width:120px"></td>
                  <td class="center" style="width:50px">${wrInd}</td>
                  <td class="center" style="width:50px">${wrIns}</td>
                  <td class="center" style="width:50px">${wrFr}</td>
                  <td class="center" style="width:50px">${cInd}</td>
                  <td class="center" style="width:50px">${cIns}</td>
                  <td class="center" style="width:50px">${cFr}</td>
                  <td class="center" style="width:110px">${dateTaken}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
          <div class="note"><strong>Legend:</strong> <strong>Ind</strong> - Independent; <strong>Ins</strong> - Instructional; <strong>Frus</strong> - Frustration</div>

          <div class="section">Oral Reading Observation Checklist</div>
          <div class="note">Mark with ✓ or X as applicable.</div>
          <table>
            <tbody>
              <tr><td>Does word-by-word reading</td><td>☐</td></tr>
              <tr><td>Lacks expression; reads in a monotonous tone</td><td>☐</td></tr>
              <tr><td>Voice is hardly audible</td><td>☐</td></tr>
              <tr><td>Disregards punctuation</td><td>☐</td></tr>
              <tr><td>Points to each word with finger</td><td>☐</td></tr>
              <tr><td>Employs little or no method of analysis</td><td>☐</td></tr>
              <tr><td>Other observations</td><td>______________________________</td></tr>
            </tbody>
          </table>

          <button class="btn no-print" onclick="window.print()">Print</button>
        </body>
      </html>
    `;

    const w = window.open('', '_blank');
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
  };

  const handleViewProgress = async (student: Student) => {
    if (!student.id) return; // Ensure id is defined
    setSelectedStudent(student);
    setProgressOpen(true);
    setProgressLoading(true);
    setIsHeaderDarkened?.(true);
    try {
      const data = await resultService.getStudentCombinedMetrics(student.id);
      setProgressData(data);
    } catch (e) {
      setProgressData(null);
    }
    setProgressLoading(false);
  };

  const handleOpenModal = (student: Student, type: 'reading' | 'test') => {
    setModalStudent(student);
    setModalType(type);
    setModalOpen(true);
    setIsHeaderDarkened?.(true);
  };
  const handleOpenShare = (student: Student) => {
    setShareStudent(student);
    setShareOpen(true);
    setIsHeaderDarkened?.(true);
  };
  const handleCloseModal = () => {
    setModalOpen(false);
    setModalType(null);
    setModalStudent(null);
    setIsHeaderDarkened?.(false);
  };
  const handleCloseShare = () => {
    setShareOpen(false);
    setShareStudent(null);
    setParentEmail('');
    setIsHeaderDarkened?.(false);
  };

  const latestReadingForShare = useMemo(() => {
    if (!shareStudent?.id) return null;
    const list = studentReadingResults[shareStudent.id] || [];
    if (!list.length) return null;
    return [...list].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  }, [shareStudent, studentReadingResults]);

  const latestTestForShare = useMemo(() => {
    if (!shareStudent?.id) return null;
    const list = studentTestResults[shareStudent.id] || [];
    if (!list.length) return null;
    return [...list].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  }, [shareStudent, studentTestResults]);

  const shareMailtoHref = useMemo(() => {
    const to = encodeURIComponent(parentEmail.trim());
    const subject = encodeURIComponent(`Progress report for ${shareStudent?.name || ''}`);
    const lines: string[] = [];
    if (shareStudent) {
      lines.push(`Student: ${shareStudent.name}`);
      if (shareStudent.grade) lines.push(`Grade: ${shareStudent.grade}`);
      if (shareStudent.readingLevel) lines.push(`Reading Level: ${shareStudent.readingLevel}`);
    }
    if (latestReadingForShare) {
      lines.push('');
      lines.push('Latest Reading Session:');
      if (latestReadingForShare.sessionTitle) lines.push(`- Session: ${latestReadingForShare.sessionTitle}`);
      if (latestReadingForShare.book) lines.push(`- Story: ${latestReadingForShare.book}`);
      if (latestReadingForShare.wordsRead != null) lines.push(`- Words Read: ${latestReadingForShare.wordsRead}`);
      if (latestReadingForShare.miscues != null) lines.push(`- Miscues: ${latestReadingForShare.miscues}`);
      if (latestReadingForShare.oralReadingScore != null) lines.push(`- Oral Reading Score: ${latestReadingForShare.oralReadingScore}%`);
      if (latestReadingForShare.readingSpeed != null) lines.push(`- Speed: ${latestReadingForShare.readingSpeed} WPM`);
      if (latestReadingForShare.elapsedTime != null) lines.push(`- Time: ${latestReadingForShare.elapsedTime}s`);
      if (latestReadingForShare.createdAt) lines.push(`- Date: ${new Date(latestReadingForShare.createdAt).toLocaleString()}`);
    }
    if (latestTestForShare) {
      lines.push('');
      lines.push('Latest Assessment:');
      if (latestTestForShare.testName) lines.push(`- Test: ${latestTestForShare.testName}`);
      if (latestTestForShare.score != null) lines.push(`- Score: ${latestTestForShare.score}`);
      if (latestTestForShare.comprehension != null) lines.push(`- Comprehension: ${latestTestForShare.comprehension}%`);
      if (latestTestForShare.correctAnswers != null && latestTestForShare.totalQuestions != null) lines.push(`- Correct: ${latestTestForShare.correctAnswers}/${latestTestForShare.totalQuestions}`);
      if (latestTestForShare.createdAt) lines.push(`- Date: ${new Date(latestTestForShare.createdAt).toLocaleString()}`);
    }
    lines.push('', 'Notes:', '- ');
    const body = encodeURIComponent(lines.join('\n'));
    return `mailto:${to}?subject=${subject}&body=${body}`;
  }, [parentEmail, shareStudent, latestReadingForShare, latestTestForShare]);

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <i className="fas fa-arrow-up text-green-500"></i>;
      case 'down':
        return <i className="fas fa-arrow-down text-red-500"></i>;
      case 'stable':
        return <i className="fas fa-minus text-gray-500"></i>;
      default:
        return null;
    }
  };

  // Toggle class collapse/expand
  const toggleClassCollapse = (className: string) => {
    setCollapsedClasses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(className)) {
        newSet.delete(className);
      } else {
        newSet.add(className);
      }
      return newSet;
    });
  };

  // Expand all classes
  const expandAllClasses = () => {
    setCollapsedClasses(new Set());
  };

  // Collapse all classes
  const collapseAllClasses = () => {
    const allClassNames = Object.keys(studentsByClass);
    setCollapsedClasses(new Set(allClassNames));
  };

  // Ensure header is not darkened on unmount
  useEffect(() => {
    return () => {
      setIsHeaderDarkened?.(false);
    };
  }, [setIsHeaderDarkened]);

  // When progress modal closes
  useEffect(() => {
    if (!progressOpen) setIsHeaderDarkened?.(false);
  }, [progressOpen, setIsHeaderDarkened]);


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">Comprehensive insights into your class performance</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm sm:text-base focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
          </select>
          <button
            onClick={() => handleExportReport(selectedReport === 'performance' ? 'performance' : 'comprehensive')}
            className="bg-gray-600 hover:bg-gray-700 text-white px-3 sm:px-4 py-2 rounded-lg transition-colors text-sm sm:text-base"
          >
            <i className="fas fa-download mr-1 sm:mr-2"></i>
            <span className="hidden sm:inline">Export</span>
            <span className="sm:hidden">Export</span>
          </button>
        </div>
      </div>

      {/* Report Type Selector */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedReport('overview')}
            className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
              selectedReport === 'overview'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <i className="fas fa-chart-pie mr-1 sm:mr-2"></i>
            <span className="hidden sm:inline">Overview</span>
            <span className="sm:hidden">Overview</span>
          </button>
          <button
            onClick={() => setSelectedReport('performance')}
            className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
              selectedReport === 'performance'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <i className="fas fa-user-graduate mr-1 sm:mr-2"></i>
            <span className="hidden sm:inline">Student Performance</span>
            <span className="sm:hidden">Performance</span>
          </button>
        </div>
      </div>

      {/* Overview Report */}
      {selectedReport === 'overview' && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-6">
            <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
              <div className="flex items-center">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <i className="fas fa-users text-blue-600 text-lg sm:text-xl"></i>
                </div>
                <div className="ml-3 sm:ml-4">
                  <p className="text-xs sm:text-sm text-gray-600">Total Students</p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900">{classStats.totalStudents}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
              <div className="flex items-center">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <i className="fas fa-book text-purple-600 text-lg sm:text-xl"></i>
                </div>
                <div className="ml-3 sm:ml-4">
                  <p className="text-xs sm:text-sm text-gray-600">Avg Reading Level</p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900">{classStats.averageReadingLevel}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
              <div className="flex items-center">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <i className="fas fa-clock text-yellow-600 text-lg sm:text-xl"></i>
                </div>
                <div className="ml-3 sm:ml-4">
                  <p className="text-xs sm:text-sm text-gray-600">Reading Sessions</p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900">{classStats.totalReadingSessions}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
              <div className="flex items-center">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <i className="fas fa-clipboard-check text-indigo-600 text-lg sm:text-xl"></i>
                </div>
                <div className="ml-3 sm:ml-4">
                  <p className="text-xs sm:text-sm text-gray-600">Completed Assessments</p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900">{classStats.completedAssessments}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
              <div className="flex items-center">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-pink-100 rounded-lg flex items-center justify-center">
                  <i className="fas fa-trending-up text-pink-600 text-lg sm:text-xl"></i>
                </div>
                <div className="ml-3 sm:ml-4">
                  <p className="text-xs sm:text-sm text-gray-600">Improvement Rate</p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900">+{classStats.improvementRate}%</p>
                </div>
              </div>
            </div>
          </div>

          {/* Monthly Progress Chart */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Monthly Progress</h3>
            <div className="space-y-3 sm:space-y-4">
              {monthlyData.map((data, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-xs sm:text-sm font-medium text-gray-700 w-10 sm:w-12">{data.month}</span>
                  <div className="flex-1 mx-2 sm:mx-4">
                    <div className="flex items-center space-x-2 sm:space-x-4">
                      <div className="flex-1">
                        <div className="flex justify-between text-xs text-gray-600 mb-1">
                          <span>Reading Level</span>
                          <span>{data.readingLevel}</span>
                        </div>
                        {/* Remove progress bar for readingLevel as a number */}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Student Performance Report */}
      {selectedReport === 'performance' && (
        <div className="space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">Student Performance Report</h2>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm sm:text-base focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Classes</option>
                {classGrades.map(grade => (
                  <option key={grade.id} value={grade.name}>{grade.name}</option>
                ))}
              </select>
              <select
                value={selectedStudentIdForISR}
                onChange={(e) => setSelectedStudentIdForISR(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm sm:text-base focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select student…</option>
                {filteredStudents.map(s => s.id ? (
                  <option key={s.id} value={s.id}>{s.name.replace(/\|/g,' ')}</option>
                ) : null)}
              </select>
              <button
                onClick={() => handleGenerateReport('student-isr')}
                disabled={!selectedStudentIdForISR}
                className={`px-3 sm:px-4 py-2 rounded-lg transition-colors text-white text-sm sm:text-base ${selectedStudentIdForISR ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'}`}
              >
                <i className="fas fa-file-alt mr-1 sm:mr-2"></i>
                <span className="hidden sm:inline">Generate Report</span>
                <span className="sm:hidden">Generate</span>
              </button>
            </div>
          </div>
          
          {/* Collapse/Expand Controls - only show when viewing all classes */}
          {!selectedClass && Object.keys(studentsByClass).length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-4">
              <div className="flex gap-2">
                <button
                  onClick={expandAllClasses}
                  className="px-2 sm:px-3 py-1 text-xs sm:text-sm bg-green-100 hover:bg-green-200 text-green-700 rounded-lg transition-colors"
                >
                  <i className="fas fa-expand-arrows-alt mr-1"></i>
                  <span className="hidden sm:inline">Expand All</span>
                  <span className="sm:hidden">Expand</span>
                </button>
                <button
                  onClick={collapseAllClasses}
                  className="px-2 sm:px-3 py-1 text-xs sm:text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                >
                  <i className="fas fa-compress-arrows-alt mr-1"></i>
                  <span className="hidden sm:inline">Collapse All</span>
                  <span className="sm:hidden">Collapse</span>
                </button>
              </div>
              <span className="text-xs sm:text-sm text-gray-500">
                {Object.keys(studentsByClass).length} classes • {collapsedClasses.size} collapsed
              </span>
            </div>
          )}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <span className="hidden sm:inline">Class / Student</span>
                      <span className="sm:hidden">Student</span>
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <span className="hidden sm:inline">Reading Session Results</span>
                      <span className="sm:hidden">Reading</span>
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <span className="hidden sm:inline">Test Results</span>
                      <span className="sm:hidden">Tests</span>
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Share
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {selectedClass ? (
                    // Show only selected class students
                    studentsToDisplay.map((student, rowIdx) => (
                      student.id ? (
                      <tr key={student.id} className={rowIdx % 2 === 0 ? "bg-white hover:bg-gray-50" : "bg-gray-50 hover:bg-gray-100"}>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap flex items-center gap-2 sm:gap-3">
                          <span className="inline-flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-200 text-blue-700 font-bold text-sm sm:text-lg">
                            {student.name.replace(/\|/g, ' ').trim().charAt(0).toUpperCase()}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-gray-900 text-sm sm:text-base truncate">{student.name.replace(/\|/g, ' ')}</div>
                            <div className="text-xs text-gray-500">{student.readingLevel ? `Level ${student.readingLevel}` : ''}</div>
                          </div>
                        </td>
                        {/* Reading Session Results Column */}
                        <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                          {studentReadingResults[student.id as string] && studentReadingResults[student.id as string].length > 0 ? (
                            <button
                              className="bg-blue-100 hover:bg-blue-200 text-blue-700 font-semibold px-2 sm:px-4 py-1 sm:py-2 rounded text-xs sm:text-sm"
                              onClick={() => handleOpenModal(student, 'reading')}
                            >
                              <span className="hidden sm:inline">View ({studentReadingResults[student.id as string].length})</span>
                              <span className="sm:hidden">({studentReadingResults[student.id as string].length})</span>
                            </button>
                          ) : (
                            <span className="text-gray-400 text-xs sm:text-sm flex items-center gap-1">
                              <i className="fas fa-info-circle text-xs"></i> 
                              <span className="hidden sm:inline">No reading session results</span>
                              <span className="sm:hidden">No results</span>
                            </span>
                          )}
                        </td>
                        {/* Test Results Column */}
                        <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                          {studentTestResults[student.id as string] && studentTestResults[student.id as string].length > 0 ? (
                            <button
                              className="bg-yellow-100 hover:bg-yellow-200 text-yellow-700 font-semibold px-2 sm:px-4 py-1 sm:py-2 rounded text-xs sm:text-sm"
                              onClick={() => handleOpenModal(student, 'test')}
                            >
                              <span className="hidden sm:inline">View ({studentTestResults[student.id as string].length})</span>
                              <span className="sm:hidden">({studentTestResults[student.id as string].length})</span>
                            </button>
                          ) : (
                            <span className="text-gray-400 text-xs sm:text-sm flex items-center gap-1">
                              <i className="fas fa-info-circle text-xs"></i> 
                              <span className="hidden sm:inline">No test results</span>
                              <span className="sm:hidden">No results</span>
                            </span>
                          )}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                          <button
                            className="bg-green-100 hover:bg-green-200 text-green-700 font-semibold px-2 sm:px-4 py-1 sm:py-2 rounded text-xs sm:text-sm"
                            onClick={() => handleOpenShare(student)}
                          >
                            <span className="hidden sm:inline">Share to Parent</span>
                            <span className="sm:hidden">Share</span>
                          </button>
                        </td>
                      </tr>
                      ) : null
                    ))
                  ) : (
                    // Show all students grouped by class
                    Object.entries(studentsByClass).map(([className, classStudents]) => {
                      const isCollapsed = collapsedClasses.has(className);
                      return (
                        <React.Fragment key={className}>
                          {/* Class Header Row */}
                          <tr className="bg-gray-100 hover:bg-gray-200 cursor-pointer" onClick={() => toggleClassCollapse(className)}>
                            <td colSpan={4} className="px-3 sm:px-6 py-3">
                              <div className="flex items-center gap-2">
                                <i className={`fas fa-chevron-${isCollapsed ? 'right' : 'down'} text-gray-600 transition-transform duration-200 text-sm`}></i>
                                <i className="fas fa-users text-gray-600 text-sm"></i>
                                <span className="font-semibold text-gray-800 text-sm sm:text-base">{className}</span>
                                <span className="text-xs sm:text-sm text-gray-600">({classStudents.length} students)</span>
                                {isCollapsed && (
                                  <span className="text-xs text-gray-500 ml-auto hidden sm:inline">Click to expand</span>
                                )}
                              </div>
                            </td>
                          </tr>
                          {/* Students in this class - only show if not collapsed */}
                          {!isCollapsed && classStudents.map((student, rowIdx) => (
                            student.id ? (
                            <tr key={student.id} className={rowIdx % 2 === 0 ? "bg-white hover:bg-gray-50" : "bg-gray-50 hover:bg-gray-100"}>
                              <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap flex items-center gap-2 sm:gap-3">
                                <span className="inline-flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-200 text-blue-700 font-bold text-sm sm:text-lg">
                                  {student.name.replace(/\|/g, ' ').trim().charAt(0).toUpperCase()}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="font-semibold text-gray-900 text-sm sm:text-base truncate">{student.name.replace(/\|/g, ' ')}</div>
                                  <div className="text-xs text-gray-500">{student.readingLevel ? `Level ${student.readingLevel}` : ''}</div>
                                </div>
                              </td>
                              {/* Reading Session Results Column */}
                              <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                                {studentReadingResults[student.id as string] && studentReadingResults[student.id as string].length > 0 ? (
                                  <button
                                    className="bg-blue-100 hover:bg-blue-200 text-blue-700 font-semibold px-2 sm:px-4 py-1 sm:py-2 rounded text-xs sm:text-sm"
                                    onClick={() => handleOpenModal(student, 'reading')}
                                  >
                                    <span className="hidden sm:inline">View ({studentReadingResults[student.id as string].length})</span>
                                    <span className="sm:hidden">({studentReadingResults[student.id as string].length})</span>
                                  </button>
                                ) : (
                                  <span className="text-gray-400 text-xs sm:text-sm flex items-center gap-1">
                                    <i className="fas fa-info-circle text-xs"></i> 
                                    <span className="hidden sm:inline">No reading session results</span>
                                    <span className="sm:hidden">No results</span>
                                  </span>
                                )}
                              </td>
                              {/* Test Results Column */}
                              <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                                {studentTestResults[student.id as string] && studentTestResults[student.id as string].length > 0 ? (
                                  <button
                                    className="bg-yellow-100 hover:bg-yellow-200 text-yellow-700 font-semibold px-2 sm:px-4 py-1 sm:py-2 rounded text-xs sm:text-sm"
                                    onClick={() => handleOpenModal(student, 'test')}
                                  >
                                    <span className="hidden sm:inline">View ({studentTestResults[student.id as string].length})</span>
                                    <span className="sm:hidden">({studentTestResults[student.id as string].length})</span>
                                  </button>
                                ) : (
                                  <span className="text-gray-400 text-xs sm:text-sm flex items-center gap-1">
                                    <i className="fas fa-info-circle text-xs"></i> 
                                    <span className="hidden sm:inline">No test results</span>
                                    <span className="sm:hidden">No results</span>
                                  </span>
                                )}
                              </td>
                              <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                                <button
                                  className="bg-green-100 hover:bg-green-200 text-green-700 font-semibold px-2 sm:px-4 py-1 sm:py-2 rounded text-xs sm:text-sm"
                                  onClick={() => handleOpenShare(student)}
                                >
                                  <span className="hidden sm:inline">Share to Parent</span>
                                  <span className="sm:hidden">Share</span>
                                </button>
                              </td>
                            </tr>
                            ) : null
                          ))}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      

      {progressOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-xl p-8 w-full max-w-md relative">
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-red-500"
              onClick={() => setProgressOpen(false)}
              title="Close"
            >
              ×
            </button>
            <h2 className="text-xl font-bold mb-4">
              {selectedStudent?.name}'s Progress
            </h2>
            {progressLoading ? (
              <div>Loading...</div>
            ) : progressData ? (
              <div className="space-y-2">
                <div><strong>Miscues:</strong> {progressData.miscues ?? '-'}</div>
                <div><strong>Accuracy (Oral Reading Score):</strong> {progressData.oralReadingScore ?? '-'}</div>
                <div><strong>Total Words:</strong> {progressData.totalWords ?? '-'}</div>
                <div><strong>Reading Speed:</strong> {progressData.readingSpeed ?? '-'}</div>
                <div><strong>Comprehension:</strong> {progressData.comprehension ?? '-'}</div>
              </div>
            ) : (
              <div>No progress data found.</div>
            )}
          </div>
        </div>
      )}

      {/* Modal for viewing all results */}
      {modalOpen && modalStudent && modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
          <div className="bg-white rounded-2xl p-10 w-full max-w-3xl relative max-h-[90vh] overflow-y-auto border border-gray-200">
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-red-500 text-2xl font-bold"
              onClick={handleCloseModal}
              title="Close"
            >
              ×
            </button>
            <h2 className="text-2xl font-extrabold mb-6 text-gray-900 tracking-tight flex items-center gap-2">
              {modalType === 'reading' ? (
                <i className="fas fa-book-reader text-blue-500 text-2xl"></i>
              ) : (
                <i className="fas fa-clipboard-check text-yellow-600 text-2xl"></i>
              )}
              {modalType === 'reading' ? 'Reading Session Results' : 'Test Results'} for <span className="text-blue-700">{modalStudent.name}</span>
            </h2>
            {/* Search Bar */}
            <div className="mb-4">
              <input
                type="text"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Search results..."
                value={modalSearchTerm}
                onChange={e => setModalSearchTerm(e.target.value)}
              />
            </div>
            {/* Scrollable Results List */}
            <div className="flex flex-col gap-6 max-h-[55vh] overflow-y-auto pr-2">
              {((modalType === 'reading' ? studentReadingResults[modalStudent.id as string] : studentTestResults[modalStudent.id as string]) || [])
                .filter((result: any) => {
                  const term = modalSearchTerm.toLowerCase();
                  if (!term) return true;
                  if (modalType === 'reading') {
                    return (
                      (result.sessionTitle && result.sessionTitle.toLowerCase().includes(term)) ||
                      (result.book && result.book.toLowerCase().includes(term)) ||
                      (result.wordsRead && String(result.wordsRead).includes(term)) ||
                      (result.miscues && String(result.miscues).includes(term)) ||
                      (result.oralReadingScore && String(result.oralReadingScore).includes(term)) ||
                      (result.readingSpeed && String(result.readingSpeed).includes(term))
                    );
                  } else {
                    return (
                      (result.testName && result.testName.toLowerCase().includes(term)) ||
                      (result.score && String(result.score).includes(term)) ||
                      (result.comprehension && String(result.comprehension).includes(term)) ||
                      (result.totalQuestions && String(result.totalQuestions).includes(term)) ||
                      (result.correctAnswers && String(result.correctAnswers).includes(term))
                    );
                  }
                })
                .map((result: any, idx: number) => (
                  <div key={result._id || result.id || idx} className={
                   (modalType === 'reading'
                     ? "bg-blue-50 border-l-8 border-blue-400"
                     : "bg-yellow-50 border-l-8 border-yellow-400"
                   ) + " p-6 rounded-xl flex flex-col gap-2"
                 }>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-base font-semibold text-gray-700">
                        {new Date(result.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                      {modalType === 'reading' ? (
                        <i className="fas fa-book-reader text-blue-500 text-lg"></i>
                      ) : (
                        <i className="fas fa-clipboard-check text-yellow-600 text-lg"></i>
                      )}
                    </div>
                    <div className="text-base text-gray-800">
                      {modalType === 'reading' ? (
                        <>
                          {result.sessionTitle ? (<div className="mb-1"><span className="font-semibold">Session Title:</span> {result.sessionTitle}</div>) : null}
                          {result.book ? (<div className="mb-1"><span className="font-semibold">Story:</span> {result.book}</div>) : null}
                          <div className="mb-1"><span className="font-semibold">Words:</span> <span className="text-lg font-bold">{result.wordsRead ?? '-'}</span></div>
                          <div className="mb-1"><span className="font-semibold">Miscues:</span> <span className="text-lg font-bold">{result.miscues ?? '-'}</span></div>
                          <div className="mb-1"><span className="font-semibold">Score:</span> <span className="text-lg font-bold">{result.oralReadingScore ?? '-'}{(result.oralReadingScore !== undefined && result.oralReadingScore !== null && result.oralReadingScore !== '-') ? '%' : ''}</span></div>
                          <div className="mb-1"><span className="font-semibold">Speed:</span> <span className="text-lg font-bold">{result.readingSpeed ?? '-'} wpm</span></div>
                          {/* Level based on oralReadingScore for reading results only */}
                          {modalType === 'reading' && (typeof result.oralReadingScore === 'number' || (typeof result.oralReadingScore === 'string' && result.oralReadingScore !== undefined)) ? (
                            <div className="mb-1">
                              <span className="font-semibold">Level:</span> <span className="text-lg font-bold">
                                {(() => {
                                  const score = typeof result.oralReadingScore === 'string' ? parseFloat(result.oralReadingScore) : result.oralReadingScore;
                                  if (isNaN(score)) return '-';
                                  if (score >= 95) return 'Independent';
                                  if (score >= 90) return 'Instructional';
                                  return 'Frustrational';
                                })()}
                              </span>
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <>
                          {result.testName ? (<div className="mb-1"><span className="font-semibold">Test:</span> {result.testName}</div>) : null}
                          <div className="mb-1"><span className="font-semibold">Score:</span> <span className="text-lg font-bold">{result.score ?? '-'}</span></div>
                          <div className="mb-1"><span className="font-semibold">Comprehension:</span> <span className="text-lg font-bold">{result.comprehension ?? '-'}{(result.comprehension !== undefined && result.comprehension !== null && result.comprehension !== '-') ? '%' : ''}</span></div>
                          <div className="mb-1"><span className="font-semibold">Questions:</span> <span className="text-lg font-bold">{result.totalQuestions ?? '-'}</span></div>
                          <div className="mb-1"><span className="font-semibold">Correct:</span> <span className="text-lg font-bold">{result.correctAnswers ?? '-'}</span></div>
                          {/* Level based on comprehension for test results only */}
                          {modalType === 'test' && (typeof result.comprehension === 'number' || (typeof result.comprehension === 'string' && result.comprehension !== undefined)) ? (
                            <div className="mb-1">
                              <span className="font-semibold">Level:</span> <span className="text-lg font-bold">
                                {(() => {
                                  const score = typeof result.comprehension === 'string' ? parseFloat(result.comprehension) : result.comprehension;
                                  if (isNaN(score)) return '-';
                                  if (score >= 80) return 'Independent';
                                  if (score >= 59) return 'Instructional';
                                  return 'Frustrational';
                                })()}
                              </span>
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Share to Parent Modal */}
      {shareOpen && shareStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
          <div className="bg-white rounded-2xl p-8 w-full max-w-lg relative border border-gray-200">
            <button
              className="absolute top-3 right-4 text-gray-400 hover:text-red-500 text-2xl font-bold"
              onClick={handleCloseShare}
              title="Close"
            >
              ×
            </button>
            <h2 className="text-xl font-extrabold mb-4 text-gray-900 tracking-tight">Share Report to Parent</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Parent email</label>
                <input
                  type="email"
                  value={parentEmail}
                  onChange={(e) => setParentEmail(e.target.value)}
                  placeholder="parent@example.com"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-900">
                This will open your email client with a pre-filled summary for {shareStudent.name}.
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={handleCloseShare}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <a
                  href={shareMailtoHref}
                  onClick={handleCloseShare}
                  className={`px-4 py-2 rounded-lg text-white ${parentEmail.trim() ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'}`}
                  aria-disabled={!parentEmail.trim()}
                >
                  Open Email
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports; 