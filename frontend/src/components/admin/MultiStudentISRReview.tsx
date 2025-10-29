import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  UserIcon,
  CheckIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  PencilSquareIcon,
  ChatBubbleLeftRightIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import DepEdISRViewer from './DepEdISRViewer';

interface ISRStudentData {
  studentId: string;
  studentName: string;
  age?: string;
  gradeSection: string;
  school: string;
  teacher: string;
  language: 'English' | 'Filipino';
  readingData: {
    level: string;
    wordReading: {
      ind: boolean;
      ins: boolean;
      frus: boolean;
    };
    comprehension: {
      ind: boolean;
      ins: boolean;
      frus: boolean;
    };
    dateTaken: string;
  }[];
  observations: {
    wordByWord: boolean;
    lacksExpression: boolean;
    hardlyAudible: boolean;
    disregardsPunctuation: boolean;
    pointsToWords: boolean;
    littleAnalysis: boolean;
    otherObservations: string;
  };
}

interface ISRSubmissionData {
  id: string;
  teacherId: string;
  teacherName: string;
  className: string;
  grade: string;
  section: string;
  studentCount: number;
  submissionDate: Date;
  status: 'pending' | 'approved' | 'rejected' | 'revision_requested';
  students: ISRStudentData[];
}

interface MultiStudentISRReviewProps {
  submission: ISRSubmissionData;
  onApproveAll: () => void;
  onRequestRevision: (message: string, issues: string[]) => void;
  onClose: () => void;
  isLoading?: boolean;
}

const MultiStudentISRReview: React.FC<MultiStudentISRReviewProps> = ({
  submission,
  onApproveAll,
  onRequestRevision,
  onClose,
  isLoading = false
}) => {
  const [selectedStudentIndex, setSelectedStudentIndex] = useState(0);
  const [showISRViewer, setShowISRViewer] = useState(false);
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [revisionMessage, setRevisionMessage] = useState('');
  const [selectedIssues, setSelectedIssues] = useState<string[]>([]);
  const [showAutoSelectNotification, setShowAutoSelectNotification] = useState(false);

  // Memoized values for better performance
  const isSubmissionApproved = useMemo(() => submission.status === 'approved', [submission.status]);
  const isSubmissionRejected = useMemo(() => submission.status === 'rejected', [submission.status]);
  const currentStudent = useMemo(() => submission.students[selectedStudentIndex], [submission.students, selectedStudentIndex]);

  // Modal focus management and keyboard navigation
  useEffect(() => {
    // Prevent body scroll and interaction with background elements
    const originalOverflow = document.body.style.overflow;
    const originalPointerEvents = document.body.style.pointerEvents;

    document.body.style.overflow = 'hidden';
    document.body.style.pointerEvents = 'none';

    // Add a class to body to help with CSS targeting
    document.body.classList.add('modal-open');

    const handleKeyDown = (e: KeyboardEvent) => {
      if (showISRViewer) return; // Don't handle keys when ISR viewer is open

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          handlePreviousStudent();
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleNextStudent();
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      // Restore body interaction and scroll
      document.body.style.overflow = originalOverflow;
      document.body.style.pointerEvents = originalPointerEvents;
      document.body.classList.remove('modal-open');
    };
  }, [showISRViewer, selectedStudentIndex, submission.students.length, onClose]);

  const handlePreviousStudent = useCallback(() => {
    setSelectedStudentIndex(prev => Math.max(0, prev - 1));
  }, []);

  const handleNextStudent = useCallback(() => {
    setSelectedStudentIndex(prev => Math.min(submission.students.length - 1, prev + 1));
  }, [submission.students.length]);

  const handleViewStudentISR = useCallback(() => {
    setShowISRViewer(true);
  }, []);

  const handleStudentSelect = useCallback((index: number) => {
    setSelectedStudentIndex(index);
  }, []);

  // Memoized helper functions for better performance
  const getReadingLevel = useCallback((student: ISRStudentData) => {
    const latestReading = student.readingData?.[0];
    if (!latestReading) return 'No data';

    if (latestReading.wordReading.ind && latestReading.comprehension.ind) return 'Independent';
    if (latestReading.wordReading.ins && latestReading.comprehension.ins) return 'Instructional';
    return 'Frustration';
  }, []);

  // Memoized data completeness analysis
  const analyzeDataCompleteness = useCallback((student: ISRStudentData) => {
    const issues: string[] = [];
    const warnings: string[] = [];

    // Check basic information
    if (!student.age || student.age.trim() === '') {
      issues.push('Age not specified');
    }

    // Check reading data
    if (!student.readingData || student.readingData.length === 0) {
      issues.push('No reading assessment data');
    } else {
      const latestReading = student.readingData[0];
      if (!latestReading.dateTaken || latestReading.dateTaken.trim() === '') {
        warnings.push('Assessment date missing');
      }

      // Check if reading levels are properly set
      const hasWordReading = latestReading.wordReading.ind || latestReading.wordReading.ins || latestReading.wordReading.frus;
      const hasComprehension = latestReading.comprehension.ind || latestReading.comprehension.ins || latestReading.comprehension.frus;

      if (!hasWordReading) {
        issues.push('Word reading level not set');
      }
      if (!hasComprehension) {
        issues.push('Comprehension level not set');
      }
    }

    // Check observations - if all are false, it might indicate incomplete data
    const observations = student.observations;
    const hasAnyObservation = observations.wordByWord || observations.lacksExpression ||
      observations.hardlyAudible || observations.disregardsPunctuation ||
      observations.pointsToWords || observations.littleAnalysis ||
      (observations.otherObservations && observations.otherObservations.trim() !== '');

    if (!hasAnyObservation) {
      warnings.push('No reading observations recorded');
    }

    return {
      isComplete: issues.length === 0,
      hasWarnings: warnings.length > 0,
      issues,
      warnings,
      status: issues.length === 0 ? (warnings.length === 0 ? 'complete' : 'warning') : 'incomplete'
    };
  }, []);

  const handleRequestRevision = useCallback(() => {
    setShowRevisionModal(true);

    // Auto-select all detected issues based on comprehensive data analysis
    const detectedIssues: string[] = [];
    const issueMapping = {
      'Age not specified': 'Age not specified for some students',
      'No reading assessment data': 'Missing reading assessment data',
      'Word reading level not set': 'Word reading level not set',
      'Comprehension level not set': 'Comprehension level not set',
      'Assessment date missing': 'Assessment date missing',
      'No reading observations recorded': 'No reading observations recorded'
    };

    // Analyze all students and collect unique issues
    submission.students.forEach(student => {
      const analysis = analyzeDataCompleteness(student);
      
      // Map analysis issues to modal options
      analysis.issues.forEach(issue => {
        const mappedIssue = issueMapping[issue as keyof typeof issueMapping];
        if (mappedIssue && !detectedIssues.includes(mappedIssue)) {
          detectedIssues.push(mappedIssue);
        }
      });

      // Also check for warnings that should be flagged
      analysis.warnings.forEach(warning => {
        const mappedIssue = issueMapping[warning as keyof typeof issueMapping];
        if (mappedIssue && !detectedIssues.includes(mappedIssue)) {
          detectedIssues.push(mappedIssue);
        }
      });
    });

    // Check for incomplete student information (general check)
    const hasIncompleteInfo = submission.students.some(student => 
      !student.age || !student.studentName || !student.gradeSection
    );
    if (hasIncompleteInfo && !detectedIssues.includes('Incomplete student information')) {
      detectedIssues.push('Incomplete student information');
    }

    // Auto-select all detected issues
    setSelectedIssues(detectedIssues);
    
    // Show notification if issues were auto-selected
    if (detectedIssues.length > 0) {
      setShowAutoSelectNotification(true);
      setTimeout(() => setShowAutoSelectNotification(false), 3000);
    }
  }, [submission.students, analyzeDataCompleteness]);

  const handleSendRevisionRequest = useCallback(() => {
    if (selectedIssues.length === 0 && !revisionMessage.trim()) {
      return; // Don't send empty requests
    }

    onRequestRevision(revisionMessage, selectedIssues);
    setShowRevisionModal(false);
    setRevisionMessage('');
    setSelectedIssues([]);
  }, [revisionMessage, selectedIssues, onRequestRevision]);

  const handleIssueToggle = useCallback((issue: string) => {
    setSelectedIssues(prev =>
      prev.includes(issue)
        ? prev.filter(i => i !== issue)
        : [...prev, issue]
    );
  }, []);

  // Memoized status indicator
  const getStatusIndicator = useCallback((student: ISRStudentData) => {
    // If submission is approved, all students show as approved
    if (isSubmissionApproved) {
      return {
        icon: <CheckIcon className="h-5 w-5 text-green-500" />,
        tooltip: 'Class approved - All students included'
      };
    }

    // If submission is rejected, all students show as rejected
    if (isSubmissionRejected) {
      return {
        icon: <XMarkIcon className="h-5 w-5 text-red-500" />,
        tooltip: 'Class rejected - All students included'
      };
    }

    // For pending submissions, analyze data completeness
    const analysis = analyzeDataCompleteness(student);

    if (analysis.status === 'complete') {
      return {
        icon: (
          <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-white"></div>
          </div>
        ),
        tooltip: 'Complete data - Ready for review'
      };
    } else if (analysis.status === 'warning') {
      return {
        icon: (
          <div className="w-5 h-5 rounded-full bg-yellow-500 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-white"></div>
          </div>
        ),
        tooltip: `Minor issues: ${analysis.warnings.join(', ')}`
      };
    } else {
      return {
        icon: (
          <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-white"></div>
          </div>
        ),
        tooltip: `Missing data: ${analysis.issues.join(', ')}`
      };
    }
  }, [isSubmissionApproved, isSubmissionRejected, analyzeDataCompleteness]);

  // Memoized data quality analysis for better performance
  const dataQualityAnalysis = useMemo(() => {
    return submission.students.reduce((acc, student) => {
      const analysis = analyzeDataCompleteness(student);
      if (analysis.status === 'complete') acc.complete++;
      else if (analysis.status === 'warning') acc.warning++;
      else acc.incomplete++;
      return acc;
    }, { complete: 0, warning: 0, incomplete: 0 });
  }, [submission.students, analyzeDataCompleteness]);

  // Memoized current student analysis
  const currentStudentAnalysis = useMemo(() =>
    analyzeDataCompleteness(currentStudent),
    [currentStudent, analyzeDataCompleteness]
  );

  return (
    <>
      {/* Full screen overlay to block all interactions behind modal */}
      <div
        className="fixed inset-0 z-[999998] bg-transparent"
        style={{
          pointerEvents: 'auto',
          cursor: 'default'
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      />

      <div
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[999999] p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(e) => {
          // Close modal when clicking on backdrop
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
        style={{ pointerEvents: 'auto' }}
      >
        <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl pointer-events-auto">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 id="modal-title" className="text-xl font-bold">Class ISR Review</h2>
                <p className="text-blue-100 text-sm">
                  {submission.className} • {submission.teacherName} • {submission.students.length} students
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-white hover:text-gray-200 text-2xl font-bold p-1 rounded hover:bg-white hover:bg-opacity-20 transition-colors"
                aria-label="Close modal"
                title="Close (Esc)"
              >
                ×
              </button>
            </div>

            {/* Status and Data Quality Summary */}
            <div className="mt-4 flex gap-6 text-sm">
              <div className="flex gap-4">
                <div className="flex items-center gap-1">
                  <div className={`w-3 h-3 rounded-full ${isSubmissionApproved ? 'bg-green-400' :
                    isSubmissionRejected ? 'bg-red-500' : 'bg-yellow-400'
                    }`}></div>
                  <span className="font-medium">
                    Status: {isSubmissionApproved ? 'Approved' : isSubmissionRejected ? 'Rejected' : 'Pending Review'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <UserIcon className="h-4 w-4 text-blue-300" />
                  <span>Total Students: {submission.students.length}</span>
                </div>
              </div>

              {/* Data Quality Summary */}
              <div className="flex gap-4 border-l border-blue-400 pl-4">
                <div className="flex items-center gap-1" title="Students with complete data">
                  <div className="w-3 h-3 rounded-full bg-green-400"></div>
                  <span>Complete: {dataQualityAnalysis.complete}</span>
                </div>
                <div className="flex items-center gap-1" title="Students with minor data issues">
                  <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                  <span>Warnings: {dataQualityAnalysis.warning}</span>
                </div>
                <div className="flex items-center gap-1" title="Students with missing critical data">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span>Incomplete: {dataQualityAnalysis.incomplete}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex flex-1 overflow-hidden">
            {/* Student List Sidebar */}
            <div className="w-80 bg-gray-50 border-r border-gray-200 overflow-y-auto">
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Students ({submission.students.length})</h3>
                <div className="space-y-2">
                  {submission.students.map((student, index) => {
                    const statusIndicator = getStatusIndicator(student);
                    return (
                      <button
                        key={student.studentId}
                        onClick={() => handleStudentSelect(index)}
                        className={`w-full p-3 rounded-lg cursor-pointer transition-all duration-200 text-left ${selectedStudentIndex === index
                          ? 'bg-blue-100 border-2 border-blue-300 shadow-sm'
                          : 'bg-white border border-gray-200 hover:bg-gray-50 hover:shadow-sm'
                          }`}
                        aria-pressed={selectedStudentIndex === index}
                        aria-label={`Select ${student.studentName}, ${getReadingLevel(student)} reading level`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900 text-sm">{student.studentName}</p>
                            <p className="text-xs text-gray-500">
                              {student.age ? `Age: ${student.age}` : 'Age not specified'}
                            </p>
                            <p className="text-xs text-gray-600 mt-1">
                              Reading: {getReadingLevel(student)}
                            </p>
                          </div>
                          <div className="ml-2 flex-shrink-0">
                            <div
                              className="relative group"
                              title={statusIndicator.tooltip}
                              aria-label={statusIndicator.tooltip}
                            >
                              {statusIndicator.icon}

                              {/* Enhanced Tooltip */}
                              <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap z-20 shadow-lg">
                                {statusIndicator.tooltip}
                                <div className="absolute top-full right-3 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Student Details */}
            <div className="flex-1 flex flex-col">
              {/* Student Navigation */}
              <div className="bg-white border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={handlePreviousStudent}
                      disabled={selectedStudentIndex === 0}
                      className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                      aria-label="Previous student"
                      title="Previous student (←)"
                    >
                      <ChevronLeftIcon className="h-4 w-4" />
                    </button>

                    <div className="text-center min-w-0 flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 truncate">{currentStudent.studentName}</h3>
                      <p className="text-sm text-gray-500">
                        Student {selectedStudentIndex + 1} of {submission.students.length}
                      </p>
                    </div>

                    <button
                      onClick={handleNextStudent}
                      disabled={selectedStudentIndex === submission.students.length - 1}
                      className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                      aria-label="Next student"
                      title="Next student (→)"
                    >
                      <ChevronRightIcon className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleViewStudentISR}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                      aria-label="View full ISR report for current student"
                    >
                      View Full ISR
                    </button>
                  </div>
                </div>
              </div>

              {/* Student Summary */}
              <div className="flex-1 p-6 overflow-y-auto">
                <div className="max-w-2xl">
                  {/* Data Quality Alert - Optimized */}
                  {currentStudentAnalysis.status === 'incomplete' && (
                    <div className="bg-red-50 border-l-4 border-red-400 rounded-lg p-4 mb-6" role="alert">
                      <div className="flex items-start gap-3">
                        <ExclamationTriangleIcon className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-red-800 mb-2">Missing Critical Data</h4>
                          <ul className="text-sm text-red-700 space-y-1">
                            {currentStudentAnalysis.issues.map((issue, index) => (
                              <li key={index} className="flex items-center gap-2">
                                <span className="w-1 h-1 bg-red-500 rounded-full flex-shrink-0"></span>
                                {issue}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  {currentStudentAnalysis.status === 'warning' && (
                    <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded-lg p-4 mb-6" role="alert">
                      <div className="flex items-start gap-3">
                        <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-yellow-800 mb-2">Minor Data Issues</h4>
                          <ul className="text-sm text-yellow-700 space-y-1">
                            {currentStudentAnalysis.warnings.map((warning, index) => (
                              <li key={index} className="flex items-center gap-2">
                                <span className="w-1 h-1 bg-yellow-500 rounded-full flex-shrink-0"></span>
                                {warning}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  {currentStudentAnalysis.status === 'complete' && (
                    <div className="bg-green-50 border-l-4 border-green-400 rounded-lg p-4 mb-6">
                      <div className="flex items-center gap-3">
                        <CheckIcon className="h-5 w-5 text-green-500 flex-shrink-0" />
                        <div>
                          <h4 className="font-medium text-green-800">Complete Data</h4>
                          <p className="text-sm text-green-700">All required information is present and ready for review.</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Basic Info */}
                  <div className="bg-gray-50 rounded-lg p-4 mb-6">
                    <h4 className="font-semibold text-gray-900 mb-3">Student Information</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Age:</span>
                        <span className="ml-2 text-gray-900">{currentStudent.age || 'Not specified'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Language:</span>
                        <span className="ml-2 text-gray-900">{currentStudent.language}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Grade/Section:</span>
                        <span className="ml-2 text-gray-900">{currentStudent.gradeSection}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">School:</span>
                        <span className="ml-2 text-gray-900">{currentStudent.school}</span>
                      </div>
                    </div>
                  </div>

                  {/* Reading Performance */}
                  <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
                    <h4 className="font-semibold text-gray-900 mb-3">Reading Performance</h4>
                    {currentStudent.readingData.map((data, index) => (
                      <div key={index} className="mb-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Word Reading:</span>
                            <span className="ml-2 text-gray-900">
                              {data.wordReading.ind ? 'Independent' :
                                data.wordReading.ins ? 'Instructional' : 'Frustration'}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Comprehension:</span>
                            <span className="ml-2 text-gray-900">
                              {data.comprehension.ind ? 'Independent' :
                                data.comprehension.ins ? 'Instructional' : 'Frustration'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Observations */}
                  <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
                    <h4 className="font-semibold text-gray-900 mb-3">Reading Observations</h4>
                    <div className="space-y-2 text-sm">
                      {[
                        { key: 'wordByWord', label: 'Word-by-word reading' },
                        { key: 'lacksExpression', label: 'Lacks expression' },
                        { key: 'hardlyAudible', label: 'Hardly audible' },
                        { key: 'disregardsPunctuation', label: 'Disregards punctuation' },
                        { key: 'pointsToWords', label: 'Points to words' },
                        { key: 'littleAnalysis', label: 'Little analysis' }
                      ].map(({ key, label }) => (
                        <div key={key} className="flex items-center">
                          <span className={`w-4 h-4 rounded border mr-2 flex items-center justify-center ${currentStudent.observations[key as keyof typeof currentStudent.observations]
                            ? 'bg-red-100 border-red-300 text-red-600'
                            : 'bg-green-100 border-green-300 text-green-600'
                            }`}>
                            {currentStudent.observations[key as keyof typeof currentStudent.observations] ? '✓' : '✗'}
                          </span>
                          <span className="text-gray-700">{label}</span>
                        </div>
                      ))}
                    </div>

                    {currentStudent.observations.otherObservations && (
                      <div className="mt-4">
                        <span className="text-gray-500 text-sm">Other observations:</span>
                        <p className="text-gray-900 text-sm mt-1">{currentStudent.observations.otherObservations}</p>
                      </div>
                    )}
                  </div>

                  {/* Class Summary */}
                  {(isSubmissionApproved || isSubmissionRejected) && (
                    <div className={`${isSubmissionApproved ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} border rounded-lg p-4`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center ${isSubmissionApproved ? 'bg-green-500' : 'bg-red-500'}`}>
                          {isSubmissionApproved ? (
                            <CheckIcon className="h-3 w-3 text-white" />
                          ) : (
                            <XMarkIcon className="h-3 w-3 text-white" />
                          )}
                        </div>
                        <div>
                          <h4 className={`font-medium ${isSubmissionApproved ? 'text-green-900' : 'text-red-900'}`}>
                            {isSubmissionApproved ? 'Class Approved' : 'Class Rejected'}
                          </h4>
                          <p className={`text-sm ${isSubmissionApproved ? 'text-green-700' : 'text-red-700'}`}>
                            {isSubmissionApproved
                              ? 'All students in this class have been approved.'
                              : 'All students in this class have been rejected.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="bg-gray-50 border-t border-gray-200 px-6 py-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-600">
                  {isSubmissionApproved || isSubmissionRejected
                    ? `Class ${submission.status}: All ${submission.students.length} students included`
                    : `Reviewing class with ${submission.students.length} students`
                  }
                </div>

                {!isSubmissionApproved && !isSubmissionRejected && dataQualityAnalysis.incomplete > 0 && (
                  <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 px-3 py-1 rounded-full">
                    <ExclamationTriangleIcon className="h-4 w-4" />
                    <span>{dataQualityAnalysis.incomplete} students need attention</span>
                  </div>
                )}

                <div className="text-xs text-gray-400 hidden sm:block">
                  Use ← → to navigate • Esc to close
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isLoading}
                  aria-label="Cancel and close modal"
                >
                  Cancel
                </button>

                {/* Show action buttons for pending, status buttons for approved/rejected */}
                {!isSubmissionApproved && !isSubmissionRejected ? (
                  <>
                    <button
                      onClick={handleRequestRevision}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-amber-500 flex items-center gap-2"
                      disabled={isLoading}
                      aria-label="Request revision from teacher"
                    >
                      <PencilSquareIcon className="h-4 w-4" />
                      {isLoading ? 'Processing...' : 'Request Revision'}
                    </button>

                    <button
                      onClick={onApproveAll}
                      className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-green-500 flex items-center gap-2"
                      disabled={isLoading || dataQualityAnalysis.incomplete > 0}
                      aria-label="Approve this class"
                      title={dataQualityAnalysis.incomplete > 0 ? 'Cannot approve: Some students have incomplete data' : 'Approve this class'}
                    >
                      {isLoading && (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      )}
                      {isLoading ? 'Processing...' : 'Approve'}
                    </button>
                  </>
                ) : (
                  <>
                    {/* Status buttons showing current state */}
                    <button
                      className={`px-4 py-2 rounded-lg flex items-center gap-2 cursor-default ${submission.status === 'revision_requested'
                        ? 'bg-amber-600 text-white'
                        : 'bg-gray-200 text-gray-500'
                        }`}
                      disabled
                      aria-label="Revision request status"
                    >
                      <PencilSquareIcon className="h-4 w-4" />
                      REVISION REQUESTED
                    </button>

                    <button
                      className={`px-6 py-2 rounded-lg flex items-center gap-2 cursor-default ${isSubmissionApproved
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-200 text-gray-500'
                        }`}
                      disabled
                      aria-label="Class approval status"
                    >
                      <CheckIcon className="h-4 w-4" />
                      APPROVED
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Individual ISR Viewer Modal */}
          {showISRViewer && (
            <DepEdISRViewer
              data={currentStudent}
              onClose={() => setShowISRViewer(false)}
              viewOnly={true}
            />
          )}

          {/* Revision Request Modal */}
          {showRevisionModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[999999] p-4">
              <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl">
                {/* Modal Header */}
                <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <PencilSquareIcon className="h-6 w-6" />
                      <div>
                        <h3 className="text-lg font-semibold">Request Revision</h3>
                        <p className="text-amber-100 text-sm">
                          {submission.className} • {submission.teacherName}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowRevisionModal(false)}
                      className="text-white hover:text-amber-200 text-2xl font-bold p-1 rounded hover:bg-white hover:bg-opacity-20 transition-colors"
                    >
                      ×
                    </button>
                  </div>
                </div>

                {/* Modal Content */}
                <div className="p-6 overflow-y-auto max-h-[60vh]">
                  {/* Auto-selection notification */}
                  {showAutoSelectNotification && selectedIssues.length > 0 && (
                    <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg animate-pulse">
                      <div className="flex items-center gap-2">
                        <CheckIcon className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-green-800">
                          {selectedIssues.length} issue{selectedIssues.length !== 1 ? 's' : ''} automatically detected and selected
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="mb-6">
                    <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <InformationCircleIcon className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-blue-800">
                        <p className="font-medium mb-1">Collaborative Review Process</p>
                        <p>Instead of rejecting the submission, you can request specific improvements from the teacher. This helps maintain a positive learning environment while ensuring data quality.</p>
                      </div>
                    </div>
                  </div>

                  {/* Common Issues Checklist */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                        <ExclamationTriangleIcon className="h-5 w-5 text-amber-600" />
                        Issues Found (Select all that apply)
                      </h4>
                      <div className="flex items-center gap-2">
                        {selectedIssues.length > 0 && (
                          <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                            <CheckIcon className="h-4 w-4" />
                            {selectedIssues.length} selected
                          </div>
                        )}
                        <div className="flex gap-1">
                          <button
                            onClick={() => setSelectedIssues([
                              'Age not specified for some students',
                              'Missing reading assessment data',
                              'Word reading level not set',
                              'Comprehension level not set',
                              'Assessment date missing',
                              'No reading observations recorded',
                              'Incomplete student information'
                            ])}
                            className="text-xs text-amber-600 hover:text-amber-700 px-2 py-1 rounded hover:bg-amber-50 transition-colors"
                          >
                            Select All
                          </button>
                          <span className="text-gray-300">|</span>
                          <button
                            onClick={() => setSelectedIssues([])}
                            className="text-xs text-gray-600 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-50 transition-colors"
                          >
                            Clear All
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    {selectedIssues.length > 0 && (
                      <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <div className="flex items-start gap-2">
                          <InformationCircleIcon className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                          <div className="text-sm text-amber-800">
                            <p className="font-medium">Issues detected automatically</p>
                            <p>Based on the data analysis, we've pre-selected the issues found in this submission. You can modify the selection as needed.</p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      {[
                        'Age not specified for some students',
                        'Missing reading assessment data',
                        'Word reading level not set',
                        'Comprehension level not set',
                        'Assessment date missing',
                        'No reading observations recorded',
                        'Incomplete student information'
                      ].map((issue) => {
                        const isAutoSelected = selectedIssues.includes(issue);
                        return (
                          <label 
                            key={issue} 
                            className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all duration-200 ${
                              isAutoSelected 
                                ? 'border-amber-300 bg-amber-50 hover:bg-amber-100' 
                                : 'border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedIssues.includes(issue)}
                              onChange={() => handleIssueToggle(issue)}
                              className="w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500"
                            />
                            <span className={`text-sm flex-1 ${
                              isAutoSelected ? 'text-amber-900 font-medium' : 'text-gray-700'
                            }`}>
                              {issue}
                            </span>
                            {isAutoSelected && (
                              <div className="flex items-center gap-1 text-xs text-amber-700 bg-amber-200 px-2 py-1 rounded-full">
                                <CheckIcon className="h-3 w-3" />
                                Auto-detected
                              </div>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Custom Message */}
                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Additional Message (Optional)
                    </label>
                    <textarea
                      value={revisionMessage}
                      onChange={(e) => setRevisionMessage(e.target.value)}
                      placeholder="Add any specific instructions or feedback for the teacher..."
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm"
                    />
                  </div>

                  {/* Preview */}
                  {(selectedIssues.length > 0 || revisionMessage.trim()) && (
                    <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                      <h5 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                        <ChatBubbleLeftRightIcon className="h-4 w-4" />
                        Message Preview
                      </h5>
                      <div className="text-sm text-gray-700 space-y-2">
                        <p>Dear {submission.teacherName},</p>
                        <p>Thank you for submitting the ISR for {submission.className}. To ensure the highest quality of data, we've identified some areas that need attention:</p>

                        {selectedIssues.length > 0 && (
                          <ul className="list-disc list-inside space-y-1 ml-4">
                            {selectedIssues.map((issue, index) => (
                              <li key={index}>{issue}</li>
                            ))}
                          </ul>
                        )}

                        {revisionMessage.trim() && (
                          <div className="mt-3 p-2 bg-white border-l-4 border-amber-400 rounded">
                            <p className="italic">{revisionMessage}</p>
                          </div>
                        )}

                        <p className="mt-3">Please review and update the submission when possible. Thank you for your cooperation!</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Modal Footer */}
                <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3">
                  <button
                    onClick={() => setShowRevisionModal(false)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSendRevisionRequest}
                    disabled={selectedIssues.length === 0 && !revisionMessage.trim()}
                    className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                    title={selectedIssues.length === 0 && !revisionMessage.trim() ? 'Please select at least one issue or add a message' : `Send revision request with ${selectedIssues.length} issue${selectedIssues.length !== 1 ? 's' : ''}`}
                  >
                    <PencilSquareIcon className="h-4 w-4" />
                    Send Revision Request
                    {selectedIssues.length > 0 && (
                      <span className="bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full ml-1">
                        {selectedIssues.length}
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default MultiStudentISRReview;