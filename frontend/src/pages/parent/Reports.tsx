import React, { useMemo, useState, useEffect } from 'react';
import { formatDateHuman } from '@/utils/date';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../config/firebase';
import { collection, onSnapshot, query, where, orderBy, addDoc, serverTimestamp, doc } from 'firebase/firestore';
import { 
  ClockIcon, 
  DocumentTextIcon,
  PaperAirplaneIcon,
  EnvelopeIcon,
  PlusIcon,
  CheckCircleIcon,
  UserIcon,
  CalendarIcon,
  ArrowTrendingUpIcon,
  BookOpenIcon,
  StarIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';

const ReportsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [teacherEmail, setTeacherEmail] = useState('');
  const [teacherName, setTeacherName] = useState('');
  const [childName, setChildName] = useState('');
  const [children, setChildren] = useState<Array<{ id: string; name: string; teacherId?: string; grade?: string; readingLevel?: string }>>([]);
  const [selectedChildId, setSelectedChildId] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isLoadingSaved, setIsLoadingSaved] = useState(true);
  const [savedReports, setSavedReports] = useState<Array<{ id: string; title: string; createdAt: Date; childName?: string }>>([]);
  const [metrics, setMetrics] = useState<{ 
    totalSessions: number; 
    avgScore: number; 
    avgWpm: number; 
    lastUpdated?: Date;
    improvementTrend: 'up' | 'down' | 'stable';
    streakDays: number;
    totalReadingTime: number;
  }>({ 
    totalSessions: 0, 
    avgScore: 0, 
    avgWpm: 0, 
    improvementTrend: 'stable',
    streakDays: 0,
    totalReadingTime: 0
  });
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sentBanner, setSentBanner] = useState<string | null>(null);
  const [isLoadingTeacher, setIsLoadingTeacher] = useState(false);
  const [reportType, setReportType] = useState<'progress' | 'issue' | 'bug' | 'general'>('progress');

  const shareMailtoHref = useMemo(() => {
    const to = encodeURIComponent(teacherEmail.trim());
    
    const getSubjectLine = () => {
      if (subject) return subject;
      const typeLabels = {
        progress: 'Reading Progress Update',
        issue: 'Issue Report',
        bug: 'Bug Report',
        general: 'General Inquiry'
      };
      return `${typeLabels[reportType]} for ${childName}`;
    };
    
    const subjectLine = encodeURIComponent(getSubjectLine());
    
    const getBodyTemplate = () => {
      const typeTemplates = {
        progress: [
          `Dear ${teacherName || 'Teacher'},`,
          '',
          `I wanted to share an update about ${childName}'s reading progress:`,
          '',
          message || 'Please see the attached reading progress report.',
          '',
          `Current Reading Level: ${children.find(c => c.id === selectedChildId)?.readingLevel || 'Not specified'}`,
          `Total Sessions: ${metrics.totalSessions}`,
          `Average Score: ${metrics.avgScore}%`,
          `Average WPM: ${metrics.avgWpm}`,
          '',
          'Thank you for your continued support!'
        ],
        issue: [
          `Dear ${teacherName || 'Teacher'},`,
          '',
          `I am writing to report an issue regarding ${childName}:`,
          '',
          message || 'Please provide details about the issue you are experiencing.',
          '',
          'I would appreciate your assistance in resolving this matter.'
        ],
        bug: [
          `Dear ${teacherName || 'Teacher'},`,
          '',
          `I am reporting a technical issue I encountered:`,
          '',
          message || 'Please describe the bug or technical problem you experienced.',
          '',
          'Thank you for your attention to this matter.'
        ],
        general: [
          `Dear ${teacherName || 'Teacher'},`,
          '',
          `I hope this message finds you well.`,
          '',
          message || 'Please write your message here.',
          '',
          'Thank you for your time.'
        ]
      };
      
      return [
        ...typeTemplates[reportType],
        '',
        `Best regards,`,
        `${currentUser?.displayName || currentUser?.email || 'Parent'}`
      ];
    };
    
    const body = encodeURIComponent(getBodyTemplate().join('\n'));
    return `mailto:${to}?subject=${subjectLine}&body=${body}`;
  }, [teacherEmail, teacherName, childName, subject, message, children, selectedChildId, metrics, currentUser, reportType]);

  // Enhanced realtime metrics for parent's children
  useEffect(() => {
    if (!currentUser?.uid) return;
    const studentsQ = query(collection(db, 'students'), where('parentId', '==', currentUser.uid));
    const unsubStudents = onSnapshot(studentsQ, (snap) => {
      const childIds = snap.docs.map(d => d.id);
      if (childIds.length === 0) { 
        setMetrics({ 
          totalSessions: 0, 
          avgScore: 0, 
          avgWpm: 0, 
          improvementTrend: 'stable',
          streakDays: 0,
          totalReadingTime: 0
        }); 
        return; 
      }
      
      // Firestore 'in' queries are limited to 10 items, so we need to handle this properly
      const batchSize = 10;
      const batches = [];
      for (let i = 0; i < childIds.length; i += batchSize) {
        batches.push(childIds.slice(i, i + batchSize));
      }
      
      // For now, let's just use the first batch to avoid the error
      // In a production app, you'd want to combine results from multiple batches
      const firstBatch = batches[0] || [];
      if (firstBatch.length === 0) {
        setMetrics({ 
          totalSessions: 0, 
          avgScore: 0, 
          avgWpm: 0, 
          improvementTrend: 'stable',
          streakDays: 0,
          totalReadingTime: 0
        });
        return;
      }
      
      const resultsQ = query(collection(db, 'readingResults'), where('studentId', 'in', firstBatch));
      const unsubResults = onSnapshot(resultsQ, (rs) => {
        const rows = rs.docs.map(d => d.data() as any);
        
        // Calculate comprehensive metrics
        const scores = rows.map(r => r.oralReadingScore ?? r.accuracy ?? r.score).filter((n: any) => typeof n === 'number') as number[];
        const wpms = rows.map(r => r.readingSpeed ?? r.wpm ?? r.wordsPerMinute).filter((n: any) => typeof n === 'number') as number[];
        const readingTimes = rows.map(r => r.readingTime ?? r.duration ?? r.timeSpent).filter((n: any) => typeof n === 'number') as number[];
        
        const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length) : 0;
        const totalReadingTime = readingTimes.reduce((a,b) => a + b, 0);
        
        // Calculate improvement trend
        const sortedScores = scores.sort((a, b) => a - b);
        const recentScores = sortedScores.slice(-5);
        const olderScores = sortedScores.slice(0, Math.min(5, sortedScores.length - 5));
        const recentAvg = recentScores.length ? recentScores.reduce((a,b) => a + b, 0) / recentScores.length : 0;
        const olderAvg = olderScores.length ? olderScores.reduce((a,b) => a + b, 0) / olderScores.length : 0;
        
        let improvementTrend: 'up' | 'down' | 'stable' = 'stable';
        if (recentAvg > olderAvg + 5) improvementTrend = 'up';
        else if (recentAvg < olderAvg - 5) improvementTrend = 'down';
        
        // Calculate streak (simplified - consecutive days with sessions)
        const sessionDates = rows
          .map(r => new Date((r as any).createdAt?.toDate?.() || (r as any).createdAt))
          .filter(d => !isNaN(d.getTime()))
          .map(d => d.toDateString())
          .filter((date, index, arr) => arr.indexOf(date) === index)
          .sort()
          .reverse();
        
        let streakDays = 0;
        let currentDate = new Date();
        for (let i = 0; i < 30; i++) {
          if (sessionDates.includes(currentDate.toDateString())) {
            streakDays++;
            currentDate.setDate(currentDate.getDate() - 1);
          } else {
            break;
          }
        }
        
        const last = rows
          .map(r => new Date((r as any).createdAt?.toDate?.() || (r as any).createdAt))
          .filter(d => !isNaN(d.getTime()))
          .sort((a,b)=> b.getTime()-a.getTime())[0];
          
        setMetrics({ 
          totalSessions: rows.length, 
          avgScore: avg(scores), 
          avgWpm: avg(wpms), 
          lastUpdated: last,
          improvementTrend,
          streakDays,
          totalReadingTime: Math.round(totalReadingTime / 60) // Convert to minutes
        });
      }, (error) => {
        console.warn('Error fetching reading results:', error);
        setMetrics({ 
          totalSessions: 0, 
          avgScore: 0, 
          avgWpm: 0, 
          improvementTrend: 'stable',
          streakDays: 0,
          totalReadingTime: 0
        });
      });
      return () => unsubResults();
    }, (error) => {
      console.warn('Error fetching students:', error);
      setChildren([]);
    });
    return () => unsubStudents();
  }, [currentUser?.uid]);

  // Load parent's children with enhanced data
  useEffect(() => {
    if (!currentUser?.uid) return;
    const studentsQ = query(collection(db, 'students'), where('parentId', '==', currentUser.uid));
    const unsub = onSnapshot(studentsQ, async (snap) => {
      const list = snap.docs.map(d => {
        const data = d.data() as any;
        return { 
          id: d.id, 
          name: data.name || 'Student', 
          teacherId: data.teacherId,
          grade: data.grade || data.gradeLevel,
          readingLevel: data.readingLevel || data.currentLevel
        };
      });
      setChildren(list);
      const first = list[0];
      if (first) {
        setSelectedChildId(first.id);
        setChildName(first.name);
        // fetch teacher info from users collection by uid
        if (first.teacherId) {
          setIsLoadingTeacher(true);
          // Use direct document reference instead of query for better performance
          const teacherDocRef = doc(db, 'users', first.teacherId);
          onSnapshot(teacherDocRef, (teacherDoc) => {
            if (teacherDoc.exists()) {
              const teacherData = teacherDoc.data();
              setTeacherEmail(teacherData?.email || '');
              setTeacherName(teacherData?.displayName || teacherData?.name || '');
            } else {
              setTeacherEmail('');
              setTeacherName('');
            }
            setIsLoadingTeacher(false);
          }, (error) => {
            console.warn('Error fetching teacher data:', error);
            setTeacherEmail('');
            setTeacherName('');
            setIsLoadingTeacher(false);
          });
        } else {
          setTeacherEmail('');
          setTeacherName('');
          setIsLoadingTeacher(false);
        }
      }
    });
    return () => unsub();
  }, [currentUser?.uid]);

  const handleSendToTeacher = async () => {
    const child = children.find(c => c.id === selectedChildId);
    if (!currentUser?.uid || !child?.teacherId) return;
    try {
      setSending(true);
      await addDoc(collection(db, 'teacherInbox'), {
        teacherId: child.teacherId,
        parentId: currentUser.uid,
        parentEmail: currentUser.email || '',
        childId: child.id,
        childName,
        reportType,
        subject: subject.trim() || `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`,
        message: message.trim() || '',
        createdAt: serverTimestamp(),
        read: false,
        status: 'new'
      });
      setSentBanner('Report sent to your child\'s teacher.');
      setTimeout(()=> setSentBanner(null), 3000);
      setMessage('');
    } catch (e) {
      setSentBanner('Failed to send. Please try again.');
      setTimeout(()=> setSentBanner(null), 3000);
    } finally {
      setSending(false);
    }
  };

  // When child changes, update teacher info and childName
  useEffect(() => {
    const child = children.find(c => c.id === selectedChildId);
    if (!child) return;
    setChildName(child.name);
    if (child.teacherId) {
      setIsLoadingTeacher(true);
      // Use direct document reference instead of query for better performance
      const teacherDocRef = doc(db, 'users', child.teacherId);
      const unsub = onSnapshot(teacherDocRef, (teacherDoc) => {
        if (teacherDoc.exists()) {
          const teacherData = teacherDoc.data();
          setTeacherEmail(teacherData?.email || '');
          setTeacherName(teacherData?.displayName || teacherData?.name || '');
        } else {
          setTeacherEmail('');
          setTeacherName('');
        }
        setIsLoadingTeacher(false);
      }, (error) => {
        console.warn('Error fetching teacher data:', error);
        setTeacherEmail('');
        setTeacherName('');
        setIsLoadingTeacher(false);
      });
      return () => unsub();
    } else {
      setTeacherEmail('');
      setTeacherName('');
      setIsLoadingTeacher(false);
    }
  }, [selectedChildId, children]);

  // Realtime saved reports for this parent
  useEffect(() => {
    if (!currentUser?.uid) return;
    const savedQ = query(collection(db, 'parentReports'), where('parentId', '==', currentUser.uid), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(savedQ, (snap) => {
      const items = snap.docs.map(d => {
        const data = d.data() as any;
        return { 
          id: d.id, 
          title: data.title || data.subject || 'Report', 
          createdAt: (data.createdAt?.toDate?.() || new Date()) as Date,
          childName: data.childName || ''
        };
      });
      setSavedReports(items);
      setIsLoadingSaved(false);
    }, () => { setSavedReports([]); setIsLoadingSaved(false); });
    return () => unsub();
  }, [currentUser?.uid]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4 shadow-lg">
            <PaperAirplaneIcon className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-blue-900">
            Parent-Teacher Communication
          </h1>
          <p className="text-lg text-blue-700 max-w-2xl mx-auto">
            Send messages, report issues, or share updates with your child's teacher
          </p>
        </div>

        {/* Quick Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-md border border-blue-100 hover:shadow-lg transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-blue-900">{metrics.totalSessions}</p>
                <p className="text-sm font-medium text-blue-600">Reading Sessions</p>
              </div>
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <BookOpenIcon className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-4 shadow-md border border-blue-100 hover:shadow-lg transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-blue-900">{metrics.avgScore}%</p>
                <p className="text-sm font-medium text-blue-600">Average Score</p>
                {metrics.improvementTrend === 'up' && (
                  <div className="flex items-center mt-1">
                    <ArrowTrendingUpIcon className="w-3 h-3 text-green-500 mr-1" />
                    <span className="text-xs text-green-600 font-medium">Improving</span>
                  </div>
                )}
              </div>
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <StarIcon className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-4 shadow-md border border-blue-100 hover:shadow-lg transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-blue-900">{metrics.avgWpm}</p>
                <p className="text-sm font-medium text-blue-600">Words Per Minute</p>
              </div>
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <ClockIcon className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-4 shadow-md border border-blue-100 hover:shadow-lg transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-blue-900">
                  {metrics.lastUpdated ? formatDateHuman(metrics.lastUpdated) : 'No data yet'}
                </p>
                <p className="text-sm font-medium text-blue-600">Last Session</p>
                {metrics.streakDays > 0 && (
                  <div className="flex items-center mt-1">
                    <SparklesIcon className="w-3 h-3 text-blue-500 mr-1" />
                    <span className="text-xs text-blue-600 font-medium">{metrics.streakDays} day streak</span>
                  </div>
                )}
              </div>
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <CalendarIcon className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Communication Form */}
        <div className="bg-white rounded-xl shadow-lg border border-blue-100 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <PaperAirplaneIcon className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-xl font-bold text-blue-900">Send Message to Teacher</h3>
          </div>
          
          {sentBanner && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm flex items-center gap-2">
              <CheckCircleIcon className="w-5 h-5 text-green-600" />
              {sentBanner}
            </div>
          )}
          
          <div className="space-y-4">
            {/* Report Type Selection */}
            <div>
              <label className="block text-sm font-semibold text-blue-900 mb-3">Message Type</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { type: 'progress', label: 'Progress Update', icon: '📈' },
                  { type: 'issue', label: 'Report Issue', icon: '⚠️' },
                  { type: 'bug', label: 'Bug Report', icon: '🐛' },
                  { type: 'general', label: 'General Message', icon: '💬' }
                ].map(({ type, label, icon }) => (
                  <button
                    key={type}
                    onClick={() => setReportType(type as any)}
                    className={`p-3 rounded-lg border-2 transition-all duration-200 ${
                      reportType === type
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:bg-blue-50'
                    }`}
                  >
                    <div className="text-lg mb-1">{icon}</div>
                    <div className="text-xs font-medium">{label}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-blue-900 mb-2">Select Your Child</label>
                <select
                  value={selectedChildId}
                  onChange={(e) => setSelectedChildId(e.target.value)}
                  className="w-full border border-blue-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-blue-50 hover:bg-white transition-colors"
                >
                  {children.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.grade && `(${c.grade})`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <UserIcon className="w-4 h-4 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">Teacher</p>
                    {isLoadingTeacher ? (
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin"></div>
                        <span className="text-xs text-blue-700">Loading...</span>
                      </div>
                    ) : (
                      <p className="text-xs text-blue-800">
                        {teacherName && teacherEmail ? `${teacherName}` : 
                         teacherEmail ? teacherEmail : 'No teacher assigned'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-blue-900 mb-2">Subject (Optional)</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Enter a subject line or leave blank for auto-generated..."
                className="w-full border border-blue-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-blue-50 hover:bg-white transition-colors"
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-blue-900 mb-2">Your Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                placeholder={
                  reportType === 'progress' ? "Share your observations about your child's reading progress, achievements, or areas for improvement..." :
                  reportType === 'issue' ? "Describe the issue you are experiencing with your child's learning or the system..." :
                  reportType === 'bug' ? "Describe the technical problem or bug you encountered..." :
                  "Write your message to the teacher..."
                }
                className="w-full border border-blue-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-blue-50 hover:bg-white transition-colors"
              />
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 justify-end pt-4">
              <a
                href={shareMailtoHref}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
                  teacherEmail.trim() 
                    ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200' 
                    : 'bg-gray-50 text-gray-400 cursor-not-allowed border border-gray-100'
                }`}
                aria-disabled={!teacherEmail.trim()}
              >
                <EnvelopeIcon className="w-4 h-4" />
                Open Email
              </a>
              <button
                onClick={handleSendToTeacher}
                disabled={!teacherEmail || sending || !message.trim()}
                className={`px-6 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
                  !teacherEmail || sending || !message.trim()
                    ? 'bg-gray-400 text-white cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg'
                }`}
              >
                {sending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <PaperAirplaneIcon className="w-4 h-4" />
                    Send Message
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Message History */}
        <div className="bg-white rounded-xl shadow-lg border border-blue-100 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <DocumentTextIcon className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-xl font-bold text-blue-900">Message History</h3>
          </div>

          {isLoadingSaved ? (
            <div className="space-y-4">
              {[1,2,3].map(i => (
                <div key={i} className="flex items-center justify-between p-4 border border-gray-100 rounded-xl">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gray-100 rounded-xl animate-pulse" />
                    <div className="space-y-2">
                      <div className="h-4 w-48 bg-gray-100 rounded animate-pulse" />
                      <div className="h-3 w-32 bg-gray-100 rounded animate-pulse" />
                    </div>
                  </div>
                  <div className="h-8 w-20 bg-gray-100 rounded-lg animate-pulse" />
                </div>
              ))}
            </div>
          ) : savedReports.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <DocumentTextIcon className="w-8 h-8 text-blue-600" />
              </div>
              <h4 className="text-lg font-semibold text-blue-900 mb-2">No messages yet</h4>
              <p className="text-blue-700 max-w-md mx-auto">
                Your message history will appear here once you start communicating with your child's teacher.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {savedReports.map(r => (
                <div key={r.id} className="p-4 border border-blue-200 rounded-lg bg-blue-50 hover:bg-white transition-all duration-200">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                      <DocumentTextIcon className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-medium text-blue-900">{r.title}</div>
                      <div className="text-sm text-blue-600 flex items-center gap-2">
                        <CalendarIcon className="w-3 h-3" />
                        {formatDateHuman(r.createdAt)}
                        {r.childName && (
                          <>
                            <span>•</span>
                            <span>{r.childName}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create Message Modal */}
        {isCreateOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b border-blue-200">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                    <PlusIcon className="w-4 h-4 text-white" />
                  </div>
                  <h4 className="text-xl font-bold text-blue-900">Create New Message</h4>
                </div>
                <button 
                  onClick={() => setIsCreateOpen(false)} 
                  className="w-8 h-8 flex items-center justify-center text-blue-400 hover:text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                >
                  ×
                </button>
              </div>
              
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-blue-900 mb-2">Select Child</label>
                    <select
                      value={selectedChildId}
                      onChange={(e) => setSelectedChildId(e.target.value)}
                      className="w-full border border-blue-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-blue-50 hover:bg-white transition-colors"
                    >
                      {children.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.grade && `(${c.grade})`}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <UserIcon className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-900">Teacher</span>
                    </div>
                    <p className="text-sm text-blue-800 mt-1">
                      {teacherName && teacherEmail ? `${teacherName}` : 
                       teacherEmail ? teacherEmail : 'No teacher assigned'}
                    </p>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-blue-900 mb-2">Subject (Optional)</label>
                  <input 
                    value={subject} 
                    onChange={(e) => setSubject(e.target.value)} 
                    placeholder="Enter a subject line or leave blank for auto-generated..." 
                    className="w-full border border-blue-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-blue-50 hover:bg-white transition-colors" 
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-blue-900 mb-2">Your Message</label>
                  <textarea 
                    value={message} 
                    onChange={(e) => setMessage(e.target.value)} 
                    placeholder="Write your message to the teacher..." 
                    rows={5} 
                    className="w-full border border-blue-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-blue-50 hover:bg-white transition-colors" 
                  />
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3 justify-end pt-4 border-t border-blue-200">
                  <button 
                    onClick={() => setIsCreateOpen(false)} 
                    className="px-4 py-2 border border-blue-300 rounded-lg text-blue-700 hover:bg-blue-50 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => { 
                      setIsCreateOpen(false); 
                      // Here you could add logic to save the message
                    }} 
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 font-medium shadow-md hover:shadow-lg"
                  >
                    Create Message
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportsPage; 