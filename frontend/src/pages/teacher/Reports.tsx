import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { studentService, type Student } from '../../services/studentService';
import { resultService } from '../../services/resultsService';
import { getUserProfile } from '../../services/authService';
// import { gradeService } from '../../services/gradeService';
import { formatDateHuman } from '@/utils/date';

interface ISRObservation {
  wordByWord: boolean;
  lacksExpression: boolean;
  hardlyAudible: boolean;
  disregardsPunctuation: boolean;
  pointsToWords: boolean;
  littleAnalysis: boolean;
  otherObservations: string;
}

interface ISRData {
  student: Student;
  readingLevel: string;
  comprehensionLevel: string;
  dateTaken: string;
  observations: ISRObservation;
  language: 'English' | 'Filipino';
}

const Reports: React.FC<{ setIsHeaderDarkened?: (v: boolean) => void }> = ({ setIsHeaderDarkened }) => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  // Removed unused classGrades state after redesign to always show all classes
  // Deprecated: selectedClass no longer used in ISR pages (all classes always shown)
  // const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedPeriod, setSelectedPeriod] = useState('month');

  // selectedClass reset no longer needed
  const [studentReadingResults, setStudentReadingResults] = useState<Record<string, any[]>>({});
  const [studentTestResults, setStudentTestResults] = useState<Record<string, any[]>>({});
  
  // ISR Report states
  const [isrModalOpen, setIsrModalOpen] = useState(false);
  const [isrStudent, setIsrStudent] = useState<Student | null>(null);
  const [isrObservations, setIsrObservations] = useState<ISRObservation>({
    wordByWord: false,
    lacksExpression: false,
    hardlyAudible: false,
    disregardsPunctuation: false,
    pointsToWords: false,
    littleAnalysis: false,
    otherObservations: ''
  });
  const [isrLanguage, setIsrLanguage] = useState<'English' | 'Filipino'>('Filipino');
  const [isrLoading, setIsrLoading] = useState(false);
  
  // Class report states
  const [classReportModalOpen, setClassReportModalOpen] = useState(false);
  const [classReportLoading, setClassReportLoading] = useState(false);
  const [classReportTargetClass, setClassReportTargetClass] = useState<string | null>(null);

  // Share-to-parent modal state
  const [shareOpen, setShareOpen] = useState(false);
  const [shareStudent, setShareStudent] = useState<Student | null>(null);
  const [parentEmail, setParentEmail] = useState('');
  
  // Collapsible class state
  const [collapsedClasses, setCollapsedClasses] = useState<Set<string>>(new Set());

  // Removed fetching of class grades since UI always displays all classes based on students

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


  // Removed studentsToDisplay memo; UI now always renders all classes

  // Helper functions for ISR data processing
  const determineReadingLevel = (score: number | string | undefined | null): 'Ind' | 'Ins' | 'Frus' => {
    if (score === undefined || score === null) return 'Frus';
    const n = typeof score === 'string' ? parseFloat(score) : score;
    if (isNaN(n)) return 'Frus';
    if (n >= 95) return 'Ind';
    if (n >= 90) return 'Ins';
    return 'Frus';
  };

  const determineComprehensionLevel = (score: number | string | undefined | null): 'Ind' | 'Ins' | 'Frus' => {
    if (score === undefined || score === null) return 'Frus';
    const n = typeof score === 'string' ? parseFloat(score) : score;
    if (isNaN(n)) return 'Frus';
    if (n >= 80) return 'Ind';
    if (n >= 59) return 'Ins';
    return 'Frus';
  };

  const getLatestResults = (studentId: string) => {
    const readingList = studentReadingResults[studentId] || [];
    const testList = studentTestResults[studentId] || [];
    
        const latestReading = readingList.length
          ? [...readingList].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
          : null;
        const latestTest = testList.length
          ? [...testList].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
          : null;

    return { latestReading, latestTest };
  };

  const getStudentISRData = (student: Student): ISRData => {
    const { latestReading, latestTest } = getLatestResults(student.id || '');
    
    return {
      student,
      readingLevel: determineReadingLevel(latestReading?.oralReadingScore),
      comprehensionLevel: determineComprehensionLevel(latestTest?.comprehension),
      dateTaken: latestReading?.createdAt || latestTest?.createdAt || new Date().toISOString(),
      observations: isrObservations,
      language: isrLanguage
    };
  };

  // ISR Report Generation Functions
  const generateISRHTML = (isrData: ISRData, teacherName: string, schoolName: string) => {
    
    const safe = (v: any) => (v === undefined || v === null ? '' : String(v));
    const levels = ['K', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
    
    // Convert reading level to Roman numeral
    const toRoman = (num?: number | null) => {
      if (num === undefined || num === null) return '';
      const map: Record<number, string> = {1:'I',2:'II',3:'III',4:'IV',5:'V',6:'VI',7:'VII'};
      return map[num] || '';
    };
    const startedLevel = toRoman(typeof isrData.student.readingLevel === 'number' ? isrData.student.readingLevel : parseInt(String(isrData.student.readingLevel || ''), 10));

    return `
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Individual Summary Record - ${safe(isrData.student.name?.replace(/\|/g,' '))}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111827; line-height: 1.4; }
            .title { text-align: center; font-weight: 700; font-size: 18px; margin-bottom: 8px; }
            .subtitle { text-align: center; color: #374151; margin-bottom: 20px; }
            .form-section { margin-bottom: 24px; }
            .row { display: flex; gap: 16px; margin-bottom: 8px; }
            .field { flex: 1; }
            .label { font-size: 12px; color: #374151; margin-bottom: 4px; }
            .value { border-bottom: 1px solid #d1d5db; padding: 4px 0; min-height: 18px; }
            .checkbox-row { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
            .checkbox { width: 16px; height: 16px; border: 1px solid #d1d5db; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
            th, td { border: 1px solid #e5e7eb; padding: 6px; text-align: center; vertical-align: middle; }
            th { background: #f9fafb; font-weight: 600; }
            .section-title { margin-top: 20px; font-weight: 600; font-size: 14px; margin-bottom: 8px; }
            .note { font-size: 11px; color: #6b7280; margin-top: 6px; }
            .legend { font-size: 11px; margin-top: 8px; }
            .observation-table { margin-top: 12px; }
            .observation-table td:first-child { text-align: left; padding-left: 8px; }
            .observation-table td:last-child { text-align: center; width: 60px; }
            @media print { 
              .no-print { display: none; } 
              body { padding: 12px; }
            }
            .btn { margin-top: 16px; padding: 8px 12px; background: #2563eb; color: white; border: 0; border-radius: 6px; cursor: pointer; }
            .center { text-align: center; }
            .language-section { margin-bottom: 16px; }
            .language-option { display: inline-flex; align-items: center; gap: 4px; margin-right: 16px; }
          </style>
        </head>
        <body>
          <div class="title">Individual Summary Record (ISR)</div>
          <div class="subtitle">Talaan ng Indibidwal na Pagbabasa (TIP)</div>

          <div class="form-section">
            <div class="row">
              <div class="field">
                <div class="label">Name:</div>
                <div class="value">${safe(isrData.student.name?.replace(/\|/g,' '))}</div>
              </div>
              <div class="field">
                <div class="label">Age:</div>
                <div class="value"></div>
              </div>
              <div class="field">
                <div class="label">Grade/Section:</div>
                <div class="value">${safe(isrData.student.grade)}</div>
              </div>
            </div>
            <div class="row">
              <div class="field">
                <div class="label">School:</div>
                <div class="value">${safe(schoolName)}</div>
              </div>
              <div class="field">
                <div class="label">Teacher:</div>
                <div class="value">${safe(teacherName)}</div>
              </div>
            </div>
            <div class="language-section">
              <div class="label">Language:</div>
              <div class="language-option">
                <span>English:</span>
                <span>${isrData.language === 'English' ? '✓' : '☐'}</span>
              </div>
              <div class="language-option">
                <span>Filipino:</span>
                <span>${isrData.language === 'Filipino' ? '✓' : '☐'}</span>
              </div>
            </div>
          </div>

          <div class="section-title">Instructional Level Summary</div>
          <table>
            <thead>
              <tr>
                <th class="center" colspan="2">Level Started<br/><span style="font-weight:400; font-size:10px;">Mark with an *</span></th>
                <th class="center" rowspan="2">Level</th>
                <th class="center" rowspan="2">Set<br/><span style="font-weight:400; font-size:10px;">Indicate if A, B, C, or D</span></th>
                <th class="center" colspan="3">Word Reading</th>
                <th class="center" colspan="3">Comprehension</th>
                <th class="center" rowspan="2">Date Taken</th>
              </tr>
              <tr>
                <th class="center" colspan="2"></th>
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
                const wrInd = isrData.readingLevel === 'Ind' ? '✓' : '';
                const wrIns = isrData.readingLevel === 'Ins' ? '✓' : '';
                const wrFr  = isrData.readingLevel === 'Frus' ? '✓' : '';
                const cInd  = isrData.comprehensionLevel === 'Ind' ? '✓' : '';
                const cIns  = isrData.comprehensionLevel === 'Ins' ? '✓' : '';
                const cFr   = isrData.comprehensionLevel === 'Frus' ? '✓' : '';
                const dateTaken = formatDateHuman(new Date(isrData.dateTaken));
                return `
                <tr>
                  <td class="center" style="width:60px">${isStarted}</td>
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
          <div class="legend"><strong>Legend:</strong> <strong>Ind</strong> - Independent; <strong>Ins</strong> - Instructional; <strong>Frus</strong> - Frustration</div>

          <div class="section-title">Oral Reading Observation Checklist</div>
          <div class="note">Talaan ng mga Puna Habang Nagbabasa</div>
          <table class="observation-table">
            <tbody>
              <tr>
                <td>Does word-by-word reading (Nagbabasa nang pa-isa isang salita)</td>
                <td>${isrData.observations.wordByWord ? '✓' : '☐'}</td>
              </tr>
              <tr>
                <td>Lacks expression; reads in a monotonous tone (Walang damdamin; walang pagbabago ang tono)</td>
                <td>${isrData.observations.lacksExpression ? '✓' : '☐'}</td>
              </tr>
              <tr>
                <td>Voice is hardly audible (Hindi madaling marinig ang boses)</td>
                <td>${isrData.observations.hardlyAudible ? '✓' : '☐'}</td>
              </tr>
              <tr>
                <td>Disregards punctuation (Hindi pinapansin ang mga bantas)</td>
                <td>${isrData.observations.disregardsPunctuation ? '✓' : '☐'}</td>
              </tr>
              <tr>
                <td>Points to each word with his/her finger (Itinuturo ang bawat salita)</td>
                <td>${isrData.observations.pointsToWords ? '✓' : '☐'}</td>
              </tr>
              <tr>
                <td>Employs little or no method of analysis (Bahagya o walang paraan ng pagsusuri)</td>
                <td>${isrData.observations.littleAnalysis ? '✓' : '☐'}</td>
              </tr>
              <tr>
                <td>Other observations: (Ibang Puna)</td>
                <td></td>
              </tr>
            </tbody>
          </table>
          <div style="margin-top: 8px; padding: 8px; border: 1px solid #e5e7eb; min-height: 40px;">
            ${isrData.observations.otherObservations || ''}
          </div>

          <button class="btn no-print" onclick="window.print()">Print Report</button>
        </body>
      </html>
    `;
  };

  // ISR Modal Handlers
  const handleOpenISRModal = (student: Student) => {
    setIsrStudent(student);
    setIsrModalOpen(true);
    setIsHeaderDarkened?.(true);
    
    // Reset observations for new student
    setIsrObservations({
      wordByWord: false,
      lacksExpression: false,
      hardlyAudible: false,
      disregardsPunctuation: false,
      pointsToWords: false,
      littleAnalysis: false,
      otherObservations: ''
    });
  };

  const handleCloseISRModal = () => {
    setIsrModalOpen(false);
    setIsrStudent(null);
    setIsHeaderDarkened?.(false);
  };

  const handleGenerateIndividualISR = async () => {
    if (!isrStudent) return;
    
    setIsrLoading(true);
    try {
      // Get teacher profile for school/teacher name
    let teacherName = '';
    let schoolName = '';
    try {
      const profile: any = await (getUserProfile() as Promise<any>);
      teacherName = profile?.displayName || '';
      schoolName = profile?.school || '';
    } catch {}

      const isrData = getStudentISRData(isrStudent);
      const html = generateISRHTML(isrData, teacherName, schoolName);

      const w = window.open('', '_blank');
      if (!w) return;
      w.document.open();
      w.document.write(html);
      w.document.close();
      w.focus();
      
      handleCloseISRModal();
    } catch (error) {
      console.error('Error generating ISR:', error);
    } finally {
      setIsrLoading(false);
    }
  };

  const handleGenerateClassISR = async () => {
    setClassReportLoading(true);
    try {
      // Get teacher profile for school/teacher name
      let teacherName = '';
      let schoolName = '';
      try {
        const profile: any = await (getUserProfile() as Promise<any>);
        teacherName = profile?.displayName || '';
        schoolName = profile?.school || '';
      } catch {}

      const target = classReportTargetClass;
      const sourceStudents = target ? (studentsByClass[target] || []) : students;
      const classISRData = sourceStudents.map(student => getStudentISRData(student));
      
      // Generate combined HTML for all students in class
      const escapeAttr = (v: any) => String(v ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
      const reportTitleText = target ? `Class ISR Report - ${target}` : 'All Classes ISR Report';
      const mailSubject = encodeURIComponent(reportTitleText);
      const mailBodyLines = [
        `School: ${schoolName}`,
        `Teacher: ${teacherName}`,
        `Class: ${target || 'All Classes'}`,
        `Date: ${formatDateHuman(new Date())}`,
        '',
        'Please see the attached/printed ISR summary.'
      ];
      const mailBody = encodeURIComponent(mailBodyLines.join('\n'));
      const mailtoHref = `mailto:?subject=${mailSubject}&body=${mailBody}`;
      const combinedHTML = `
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>${escapeAttr(reportTitleText)}</title>
          <style>
              body { font-family: Arial, sans-serif; padding: 24px; color: #111827; line-height: 1.4; }
              .class-title { text-align: center; font-weight: 700; font-size: 20px; margin-bottom: 20px; }
              .student-report { page-break-after: always; margin-bottom: 40px; }
              .student-report:last-child { page-break-after: auto; }
            .title { text-align: center; font-weight: 700; font-size: 18px; margin-bottom: 8px; }
            .subtitle { text-align: center; color: #374151; margin-bottom: 20px; }
              .form-section { margin-bottom: 24px; }
            .row { display: flex; gap: 16px; margin-bottom: 8px; }
            .field { flex: 1; }
              .label { font-size: 12px; color: #374151; margin-bottom: 4px; }
            .value { border-bottom: 1px solid #d1d5db; padding: 4px 0; min-height: 18px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
              th, td { border: 1px solid #e5e7eb; padding: 6px; text-align: center; vertical-align: middle; }
              th { background: #f9fafb; font-weight: 600; }
              .section-title { margin-top: 20px; font-weight: 600; font-size: 14px; margin-bottom: 8px; }
              .legend { font-size: 11px; margin-top: 8px; }
              .observation-table { margin-top: 12px; }
              .observation-table td:first-child { text-align: left; padding-left: 8px; }
              .observation-table td:last-child { text-align: center; width: 60px; }
            .center { text-align: center; }
              .language-section { margin-bottom: 16px; }
              .language-option { display: inline-flex; align-items: center; gap: 4px; margin-right: 16px; }
              @media print { 
                .no-print { display: none; } 
                body { padding: 12px; }
              }
              .btn { margin-top: 16px; padding: 8px 12px; background: #2563eb; color: white; border: 0; border-radius: 6px; cursor: pointer; }
              .btn-secondary { background: #059669; }
              .actions { display:flex; gap:12px; justify-content:center; margin-top:24px; }
              .toast { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: #111827; color: #fff; padding: 8px 12px; border-radius: 6px; font-size: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); opacity: 0; transition: opacity .2s ease; }
              .toast.show { opacity: 1; }
          </style>
        </head>
        <body>
            <div class="class-title">${escapeAttr(reportTitleText)}</div>
            <div class="class-title">School: ${schoolName} | Teacher: ${teacherName}</div>
            <div id="isr-config" data-teacher="${escapeAttr(teacherName)}" data-school="${escapeAttr(schoolName)}" data-class="${escapeAttr(target || 'All Classes')}" data-count="${classISRData.length}"></div>
            
            ${classISRData.map((isrData) => {
              
              const safe = (v: any) => (v === undefined || v === null ? '' : String(v));
              const levels = ['K', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
              
              const toRoman = (num?: number | null) => {
                if (num === undefined || num === null) return '';
                const map: Record<number, string> = {1:'I',2:'II',3:'III',4:'IV',5:'V',6:'VI',7:'VII'};
                return map[num] || '';
              };
              const startedLevel = toRoman(typeof isrData.student.readingLevel === 'number' ? isrData.student.readingLevel : parseInt(String(isrData.student.readingLevel || ''), 10));

              return `
                <div class="student-report">
          <div class="title">Individual Summary Record (ISR)</div>
          <div class="subtitle">Talaan ng Indibidwal na Pagbabasa (TIP)</div>

                  <div class="form-section">
          <div class="row">
                      <div class="field">
                        <div class="label">Name:</div>
                        <div class="value">${safe(isrData.student.name?.replace(/\|/g,' '))}</div>
          </div>
                      <div class="field">
                        <div class="label">Age:</div>
                        <div class="value"></div>
                      </div>
                      <div class="field">
                        <div class="label">Grade/Section:</div>
                        <div class="value">${safe(isrData.student.grade)}</div>
                      </div>
          </div>
          <div class="row">
                      <div class="field">
                        <div class="label">School:</div>
                        <div class="value">${safe(schoolName)}</div>
                      </div>
                      <div class="field">
                        <div class="label">Teacher:</div>
                        <div class="value">${safe(teacherName)}</div>
                      </div>
                    </div>
                    <div class="language-section">
                      <div class="label">Language:</div>
                      <div class="language-option">
                        <span>English:</span>
                        <span>${isrData.language === 'English' ? '✓' : '☐'}</span>
                      </div>
                      <div class="language-option">
                        <span>Filipino:</span>
                        <span>${isrData.language === 'Filipino' ? '✓' : '☐'}</span>
                      </div>
                    </div>
          </div>

                  <div class="section-title">Instructional Level Summary</div>
          <table>
            <thead>
              <tr>
                        <th class="center" colspan="2">Level Started<br/><span style="font-weight:400; font-size:10px;">Mark with an *</span></th>
                <th class="center" rowspan="2">Level</th>
                        <th class="center" rowspan="2">Set<br/><span style="font-weight:400; font-size:10px;">Indicate if A, B, C, or D</span></th>
                <th class="center" colspan="3">Word Reading</th>
                <th class="center" colspan="3">Comprehension</th>
                <th class="center" rowspan="2">Date Taken</th>
              </tr>
              <tr>
                        <th class="center" colspan="2"></th>
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
                        const wrInd = isrData.readingLevel === 'Ind' ? '✓' : '';
                        const wrIns = isrData.readingLevel === 'Ins' ? '✓' : '';
                        const wrFr  = isrData.readingLevel === 'Frus' ? '✓' : '';
                        const cInd  = isrData.comprehensionLevel === 'Ind' ? '✓' : '';
                        const cIns  = isrData.comprehensionLevel === 'Ins' ? '✓' : '';
                        const cFr   = isrData.comprehensionLevel === 'Frus' ? '✓' : '';
                        const dateTaken = formatDateHuman(new Date(isrData.dateTaken));
                return `
                <tr>
                          <td class="center" style="width:60px">${isStarted}</td>
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
                  <div class="legend"><strong>Legend:</strong> <strong>Ind</strong> - Independent; <strong>Ins</strong> - Instructional; <strong>Frus</strong> - Frustration</div>

                  <div class="section-title">Oral Reading Observation Checklist</div>
                  <div style="font-size: 11px; color: #6b7280; margin-bottom: 8px;">Talaan ng mga Puna Habang Nagbabasa</div>
                  <table class="observation-table">
            <tbody>
                      <tr>
                        <td>Does word-by-word reading (Nagbabasa nang pa-isa isang salita)</td>
                        <td>${isrData.observations.wordByWord ? '✓' : '☐'}</td>
                      </tr>
                      <tr>
                        <td>Lacks expression; reads in a monotonous tone (Walang damdamin; walang pagbabago ang tono)</td>
                        <td>${isrData.observations.lacksExpression ? '✓' : '☐'}</td>
                      </tr>
                      <tr>
                        <td>Voice is hardly audible (Hindi madaling marinig ang boses)</td>
                        <td>${isrData.observations.hardlyAudible ? '✓' : '☐'}</td>
                      </tr>
                      <tr>
                        <td>Disregards punctuation (Hindi pinapansin ang mga bantas)</td>
                        <td>${isrData.observations.disregardsPunctuation ? '✓' : '☐'}</td>
                      </tr>
                      <tr>
                        <td>Points to each word with his/her finger (Itinuturo ang bawat salita)</td>
                        <td>${isrData.observations.pointsToWords ? '✓' : '☐'}</td>
                      </tr>
                      <tr>
                        <td>Employs little or no method of analysis (Bahagya o walang paraan ng pagsusuri)</td>
                        <td>${isrData.observations.littleAnalysis ? '✓' : '☐'}</td>
                      </tr>
                      <tr>
                        <td>Other observations: (Ibang Puna)</td>
                        <td></td>
                      </tr>
            </tbody>
          </table>
                  <div style="margin-top: 8px; padding: 8px; border: 1px solid #e5e7eb; min-height: 40px;">
                    ${isrData.observations.otherObservations || ''}
                  </div>
                </div>
              `;
            }).join('')}
            
            <div class="actions no-print">
              <button id="printBtn" class="btn" onclick="window.print()">Print Class Report</button>
              <a class="btn btn-secondary" href="${mailtoHref}">Submit Report</a>
            </div>
        </body>
      </html>
    `;

    const w = window.open('', '_blank');
    if (!w) return;
    w.document.open();
      w.document.write(combinedHTML);
    w.document.close();
    w.focus();
      
      setClassReportModalOpen(false);
      setClassReportTargetClass(null);
    } catch (error) {
      console.error('Error generating class ISR:', error);
    } finally {
      setClassReportLoading(false);
    }
  };

  const handleOpenShare = (student: Student) => {
    setShareStudent(student);
    setShareOpen(true);
    setIsHeaderDarkened?.(true);
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
    const subject = encodeURIComponent(`ISR Report for ${shareStudent?.name || ''}`);
    const lines: string[] = [];
    if (shareStudent) {
      lines.push(`Individual Summary Record (ISR) for ${shareStudent.name}`);
      lines.push(`Grade: ${shareStudent.grade || 'N/A'}`);
      lines.push(`Reading Level: ${shareStudent.readingLevel || 'N/A'}`);
    }
    if (latestReadingForShare) {
      lines.push('');
      lines.push('Latest Reading Assessment:');
      if (latestReadingForShare.sessionTitle) lines.push(`- Session: ${latestReadingForShare.sessionTitle}`);
      if (latestReadingForShare.book) lines.push(`- Story: ${latestReadingForShare.book}`);
      if (latestReadingForShare.wordsRead != null) lines.push(`- Words Read: ${latestReadingForShare.wordsRead}`);
      if (latestReadingForShare.miscues != null) lines.push(`- Miscues: ${latestReadingForShare.miscues}`);
      if (latestReadingForShare.oralReadingScore != null) lines.push(`- Oral Reading Score: ${latestReadingForShare.oralReadingScore}%`);
      if (latestReadingForShare.readingSpeed != null) lines.push(`- Speed: ${latestReadingForShare.readingSpeed} WPM`);
      if (latestReadingForShare.createdAt) lines.push(`- Date: ${formatDateHuman(new Date(latestReadingForShare.createdAt))}`);
    }
    if (latestTestForShare) {
      lines.push('');
      lines.push('Latest Comprehension Assessment:');
      if (latestTestForShare.testName) lines.push(`- Test: ${latestTestForShare.testName}`);
      if (latestTestForShare.score != null) lines.push(`- Score: ${latestTestForShare.score}`);
      if (latestTestForShare.comprehension != null) lines.push(`- Comprehension: ${latestTestForShare.comprehension}%`);
      if (latestTestForShare.correctAnswers != null && latestTestForShare.totalQuestions != null) lines.push(`- Correct: ${latestTestForShare.correctAnswers}/${latestTestForShare.totalQuestions}`);
      if (latestTestForShare.createdAt) lines.push(`- Date: ${formatDateHuman(new Date(latestTestForShare.createdAt))}`);
    }
    lines.push('', 'Please contact me if you have any questions about your child\'s reading progress.');
    const body = encodeURIComponent(lines.join('\n'));
    return `mailto:${to}?subject=${subject}&body=${body}`;
  }, [parentEmail, shareStudent, latestReadingForShare, latestTestForShare]);

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


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Individual Summary Records (ISR)</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">Generate comprehensive reading assessment reports for students</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm sm:text-base focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          >
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
          </select>
        </div>
      </div>

      {/* Combined ISR Report (Individual + Class) */}
        <div className="space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">Individual Student ISR Reports</h2>
          </div>
          
          {/* Collapse/Expand Controls - always show since we're showing all classes */}
          {Object.keys(studentsByClass).length > 0 && (
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

          {/* Empty state */}
          {Object.keys(studentsByClass).length === 0 && (
            <div className="bg-white border border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-600">
              <i className="fas fa-users-slash text-2xl text-gray-400"></i>
              <div className="mt-2 font-medium">No classes found</div>
              <div className="text-sm">Add students to your class list to view and generate ISR reports.</div>
            </div>
          )}
          
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <span className="hidden sm:inline">Class / Student</span>
                      <span className="sm:hidden">Student</span>
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28 whitespace-nowrap">
                      Reading Level
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-56 whitespace-nowrap">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {/* Show all students grouped by class */}
                  {Object.entries(studentsByClass).map(([className, classStudents]) => {
                      const isCollapsed = collapsedClasses.has(className);
                      return (
                        <React.Fragment key={className}>
                          {/* Class Header Row */}
                          <tr className="bg-gray-100">
                            <td colSpan={2} className="px-3 sm:px-6 py-3">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => toggleClassCollapse(className)}
                                  className="inline-flex items-center gap-2 text-gray-700 hover:text-gray-900"
                                  title={isCollapsed ? 'Expand' : 'Collapse'}
                                  aria-expanded={!isCollapsed}
                                  aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} class ${className}`}
                                >
                                <i className={`fas fa-chevron-${isCollapsed ? 'right' : 'down'} text-gray-600 transition-transform duration-200 text-sm`}></i>
                                <i className="fas fa-users text-gray-600 text-sm"></i>
                                <span className="font-semibold text-gray-800 text-sm sm:text-base">{className}</span>
                                <span className="text-xs sm:text-sm text-gray-600">({classStudents.length} students)</span>
                                </button>
                              </div>
                            </td>
                            <td className="px-3 sm:px-6 py-3">
                              <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => { setClassReportTargetClass(className); setClassReportModalOpen(true); }}
                                    className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded shadow-sm"
                                  aria-label={`Generate ISR for class ${className}`}
                                  >
                                    <i className="fas fa-file-alt mr-1"></i>
                                    Generate Class ISR
                                  </button>
                              </div>
                            </td>
                          </tr>
                          {/* Students in this class - only show if not collapsed */}
                          {!isCollapsed && classStudents.length === 0 && (
                            <tr>
                              <td colSpan={3} className="px-3 sm:px-6 py-4 text-sm text-gray-500">
                                No students yet in this class.
                              </td>
                            </tr>
                          )}
                          {!isCollapsed && classStudents.map((student, rowIdx) => (
                            student.id ? (
                            <tr key={student.id} className={rowIdx % 2 === 0 ? "bg-white hover:bg-gray-50" : "bg-gray-50 hover:bg-gray-100"}>
                              <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap flex items-center gap-2 sm:gap-3">
                                <span className="inline-flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-200 text-blue-700 font-bold text-sm sm:text-lg">
                                  {student.name.replace(/\|/g, ' ').trim().charAt(0).toUpperCase()}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="font-semibold text-gray-900 text-sm sm:text-base truncate">{student.name.replace(/\|/g, ' ')}</div>
                                  <div className="text-xs text-gray-500">{student.grade || 'No grade assigned'}</div>
                                </div>
                              </td>
                              <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap w-28">
                                <div className="flex flex-col items-start">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  Level {student.readingLevel || 'N/A'}
                                  </span>
                                {(() => {
                                  const { latestReading, latestTest } = getLatestResults(student.id);
                                    const latestDateStr = latestReading?.createdAt || latestTest?.createdAt
                                      ? formatDateHuman(new Date(latestReading?.createdAt || latestTest?.createdAt))
                                      : null;
                                    if (latestDateStr) {
                                      return (
                                        <span className="mt-1 text-[11px] text-gray-500">Last assessed: {latestDateStr}</span>
                                      );
                                    }
                                    return (
                                      <button
                                        onClick={() => navigate(`/teacher/reading-session?studentId=${encodeURIComponent(String(student.id || ''))}`)}
                                        className="mt-1 text-[11px] text-blue-700 hover:text-blue-900 underline"
                                        aria-label={`Start assessment for ${student.name}`}
                                      >
                                        Assess now
                                      </button>
                                    );
                                })()}
                                </div>
                              </td>
                              <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap w-56">
                                <div className="flex gap-2 justify-end">
                                  <button
                                    className="bg-blue-100 hover:bg-blue-200 text-blue-700 font-semibold px-2 sm:px-4 py-1 sm:py-2 rounded text-xs sm:text-sm"
                                    onClick={() => handleOpenISRModal(student)}
                                    aria-label={`Generate ISR for ${student.name}`}
                                  >
                                    <i className="fas fa-file-alt mr-1"></i>
                                    <span className="hidden sm:inline">Generate ISR</span>
                                    <span className="sm:hidden">ISR</span>
                                  </button>
                                <button
                                  className="bg-green-100 hover:bg-green-200 text-green-700 font-semibold px-2 sm:px-4 py-1 sm:py-2 rounded text-xs sm:text-sm"
                                  onClick={() => handleOpenShare(student)}
                                  aria-label={`Share ISR summary for ${student.name}`}
                                >
                                    <i className="fas fa-share mr-1"></i>
                                    <span className="hidden sm:inline">Share</span>
                                  <span className="sm:hidden">Share</span>
                                </button>
                                </div>
                              </td>
                            </tr>
                            ) : null
                          ))}
                        </React.Fragment>
                      );
                    })
                  }
                </tbody>
              </table>
            </div>
          </div>
          {/* Class ISR Report - Overview section removed per request */}
      </div>

      {/* Individual ISR Modal */}
      {isrModalOpen && isrStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
          <div className="bg-white rounded-2xl p-8 w-full max-w-4xl relative max-h-[90vh] overflow-y-auto border border-gray-200">
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-red-500 text-2xl font-bold"
              onClick={handleCloseISRModal}
              title="Close"
            >
              ×
            </button>
            <h2 className="text-2xl font-extrabold mb-6 text-gray-900 tracking-tight flex items-center gap-2">
              <i className="fas fa-file-alt text-blue-500 text-2xl"></i>
              Individual Summary Record (ISR) for <span className="text-blue-700">{isrStudent.name}</span>
            </h2>
            
            <div className="space-y-6">
              {/* Student Information */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Student Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <div className="text-sm text-gray-900">{isrStudent.name?.replace(/\|/g, ' ')}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Grade/Section</label>
                    <div className="text-sm text-gray-900">{isrStudent.grade || 'N/A'}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Reading Level</label>
                    <div className="text-sm text-gray-900">Level {isrStudent.readingLevel || 'N/A'}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
                    <div className="flex gap-4">
                      <label className="flex items-center">
              <input
                          type="radio"
                          name="language"
                          value="English"
                          checked={isrLanguage === 'English'}
                          onChange={(e) => setIsrLanguage(e.target.value as 'English' | 'Filipino')}
                          className="mr-2"
                        />
                        English
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="language"
                          value="Filipino"
                          checked={isrLanguage === 'Filipino'}
                          onChange={(e) => setIsrLanguage(e.target.value as 'English' | 'Filipino')}
                          className="mr-2"
                        />
                        Filipino
                      </label>
            </div>
                  </div>
                </div>
              </div>

              {/* Latest Assessment Results */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Latest Assessment Results</h3>
                {(() => {
                  const { latestReading, latestTest } = getLatestResults(isrStudent.id || '');
                    return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-medium text-gray-700 mb-2">Reading Assessment</h4>
                        {latestReading ? (
                          <div className="space-y-1 text-sm">
                            <div><span className="font-medium">Score:</span> {latestReading.oralReadingScore || 'N/A'}%</div>
                            <div><span className="font-medium">Words Read:</span> {latestReading.wordsRead || 'N/A'}</div>
                            <div><span className="font-medium">Miscues:</span> {latestReading.miscues || 'N/A'}</div>
                            <div><span className="font-medium">Speed:</span> {latestReading.readingSpeed || 'N/A'} WPM</div>
                            <div><span className="font-medium">Level:</span> {determineReadingLevel(latestReading.oralReadingScore)}</div>
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500">No reading assessment data</div>
                      )}
                    </div>
                      <div>
                        <h4 className="font-medium text-gray-700 mb-2">Comprehension Assessment</h4>
                        {latestTest ? (
                          <div className="space-y-1 text-sm">
                            <div><span className="font-medium">Score:</span> {latestTest.score || 'N/A'}</div>
                            <div><span className="font-medium">Comprehension:</span> {latestTest.comprehension || 'N/A'}%</div>
                            <div><span className="font-medium">Correct:</span> {latestTest.correctAnswers || 'N/A'}/{latestTest.totalQuestions || 'N/A'}</div>
                            <div><span className="font-medium">Level:</span> {determineComprehensionLevel(latestTest.comprehension)}</div>
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500">No comprehension assessment data</div>
                        )}
                      </div>
                    </div>
                  );
                                })()}
                            </div>

              {/* Oral Reading Observation Checklist */}
              <div className="bg-yellow-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Oral Reading Observation Checklist</h3>
                <div className="space-y-3">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={isrObservations.wordByWord}
                      onChange={(e) => setIsrObservations(prev => ({ ...prev, wordByWord: e.target.checked }))}
                      className="mr-3"
                    />
                    <span className="text-sm">Does word-by-word reading (Nagbabasa nang pa-isa isang salita)</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={isrObservations.lacksExpression}
                      onChange={(e) => setIsrObservations(prev => ({ ...prev, lacksExpression: e.target.checked }))}
                      className="mr-3"
                    />
                    <span className="text-sm">Lacks expression; reads in a monotonous tone (Walang damdamin; walang pagbabago ang tono)</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={isrObservations.hardlyAudible}
                      onChange={(e) => setIsrObservations(prev => ({ ...prev, hardlyAudible: e.target.checked }))}
                      className="mr-3"
                    />
                    <span className="text-sm">Voice is hardly audible (Hindi madaling marinig ang boses)</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={isrObservations.disregardsPunctuation}
                      onChange={(e) => setIsrObservations(prev => ({ ...prev, disregardsPunctuation: e.target.checked }))}
                      className="mr-3"
                    />
                    <span className="text-sm">Disregards punctuation (Hindi pinapansin ang mga bantas)</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={isrObservations.pointsToWords}
                      onChange={(e) => setIsrObservations(prev => ({ ...prev, pointsToWords: e.target.checked }))}
                      className="mr-3"
                    />
                    <span className="text-sm">Points to each word with his/her finger (Itinuturo ang bawat salita)</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={isrObservations.littleAnalysis}
                      onChange={(e) => setIsrObservations(prev => ({ ...prev, littleAnalysis: e.target.checked }))}
                      className="mr-3"
                    />
                    <span className="text-sm">Employs little or no method of analysis (Bahagya o walang paraan ng pagsusuri)</span>
                  </label>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Other observations: (Ibang Puna)</label>
                    <textarea
                      value={isrObservations.otherObservations}
                      onChange={(e) => setIsrObservations(prev => ({ ...prev, otherObservations: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={3}
                      placeholder="Enter additional observations..."
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={handleCloseISRModal}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerateIndividualISR}
                  disabled={isrLoading}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-400"
                >
                  {isrLoading ? (
                    <>
                      <i className="fas fa-spinner fa-spin mr-2"></i>
                      Generating...
                        </>
                      ) : (
                        <>
                      <i className="fas fa-file-alt mr-2"></i>
                      Generate ISR Report
                        </>
                      )}
                </button>
                    </div>
                  </div>
          </div>
        </div>
      )}

      {/* Class ISR Confirmation Modal */}
      {classReportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md relative border border-gray-200">
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-red-500 text-2xl font-bold"
              onClick={() => setClassReportModalOpen(false)}
              title="Close"
            >
              ×
            </button>
            <h2 className="text-xl font-extrabold mb-4 text-gray-900">
              {classReportTargetClass ? `Generate ISR for ${classReportTargetClass}` : 'Generate All Classes ISR Report'}
            </h2>
            <p className="text-gray-600 mb-6">
              {classReportTargetClass
                ? `This will generate ISR for all students in ${classReportTargetClass} (${(studentsByClass[classReportTargetClass] || []).length} students).`
                : `This will generate Individual Summary Records for all students across all classes. The report will include ${students.length} students from ${Object.keys(studentsByClass).length} classes.`}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setClassReportModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateClassISR}
                disabled={classReportLoading}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-400"
              >
                {classReportLoading ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    Generating...
                  </>
                ) : (
                  <>
                    <i className="fas fa-file-alt mr-2"></i>
                    {classReportTargetClass ? 'Generate Class Report' : 'Generate All Classes Report'}
                  </>
                )}
              </button>
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
            <h2 className="text-xl font-extrabold mb-4 text-gray-900 tracking-tight">Share ISR Report to Parent</h2>
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
                This will open your email client with a pre-filled ISR summary for {shareStudent.name}.
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