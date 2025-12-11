import React, { useState, useEffect } from 'react';
import { formatDateHuman } from '@/utils/date';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../config/firebase';
import { collection, onSnapshot, query, where, addDoc, serverTimestamp, doc } from 'firebase/firestore';
import { 
  DocumentTextIcon,
  PaperAirplaneIcon,
  PlusIcon,
  CheckCircleIcon,
  UserIcon,
  CalendarIcon,
  AcademicCapIcon
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
  const [savedReports, setSavedReports] = useState<Array<{ 
    id: string; 
    title: string; 
    createdAt: Date; 
    childName?: string;
    message?: string;
    reportType?: string;
    teacherName?: string;
    status?: string;
    senderRole?: string;
  }>>([]);

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sentBanner, setSentBanner] = useState<string | null>(null);
  const [isLoadingTeacher, setIsLoadingTeacher] = useState(false);
  const [reportType, setReportType] = useState<'issue' | 'bug' | 'general'>('issue');





  // Load parent's children with enhanced data
  useEffect(() => {
    if (!currentUser?.uid) return;
    const studentsQ = query(collection(db, 'students'), where('parentId', '==', currentUser.uid));
    const unsub = onSnapshot(studentsQ, (snap) => {
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
      
      // Only set first child if no child is currently selected
      if (list.length > 0 && !selectedChildId) {
        setSelectedChildId(list[0].id);
      }
      
      // Teacher info will be loaded by the separate useEffect that watches selectedChildId
    });
    return () => unsub();
  }, [currentUser?.uid]);

  const handleSendToTeacher = async () => {
    const child = children.find(c => c.id === selectedChildId);
    if (!currentUser?.uid || !child?.teacherId) return;
    try {
      setSending(true);
      
      // Get parent name for display
      const parentName = currentUser.displayName || currentUser.email?.split('@')[0] || 'Parent';
      
      // Store parent report in teacherInbox collection
      await addDoc(collection(db, 'teacherInbox'), {
        // Core notification fields
        title: subject.trim() || `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report from Parent`,
        message: message.trim() || '',
        type: 'parent_report',
        recipientId: child.teacherId,
        senderId: currentUser.uid,
        senderRole: 'parent',
        senderName: parentName,
        isRead: false,
        isArchived: false,
        priority: reportType === 'issue' ? 'high' : reportType === 'general' ? 'low' : 'medium',
        category: 'parent_reports',
        createdAt: serverTimestamp(),
        
        // Additional data for context
        data: {
        teacherId: child.teacherId,
        parentId: currentUser.uid,
        parentEmail: currentUser.email || '',
        childId: child.id,
        childName,
        reportType,
        subject: subject.trim() || `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`,
          status: 'new',
          parentDisplayName: parentName,
          reportDate: new Date().toISOString()
        }
      });

      // Also add to parent's inbox so they can see their sent messages
      await addDoc(collection(db, 'parentInbox'), {
        // Core notification fields
        title: subject.trim() || `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`,
        message: message.trim() || '',
        type: 'parent_report',
        recipientId: child.teacherId,
        senderId: currentUser.uid,
        senderRole: 'parent',
        senderName: parentName,
        isRead: true, // Mark as read since parent sent it
        isArchived: false,
        priority: reportType === 'issue' ? 'high' : reportType === 'general' ? 'low' : 'medium',
        category: 'parent_reports',
        createdAt: serverTimestamp(),
        
        // Additional data for context
        data: {
        teacherId: child.teacherId,
        parentId: currentUser.uid,
        parentEmail: currentUser.email || '',
        childId: child.id,
        childName,
        reportType,
        subject: subject.trim() || `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`,
          status: 'sent',
          parentDisplayName: parentName,
          reportDate: new Date().toISOString(),
          teacherName: teacherName || 'Teacher'
        }
      });
      
      setSentBanner('Your report has been sent to the teacher! 📩');
      setTimeout(()=> setSentBanner(null), 3000);
      setMessage('');
    } catch {
      setSentBanner('Oops! Something went wrong. Please try sending again.');
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
    
    // Only set up new listener if teacherId exists
    if (!child.teacherId) {
      setTeacherEmail('');
      setTeacherName('');
      setIsLoadingTeacher(false);
      return;
    }
    
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
    }, () => {
      setTeacherEmail('');
      setTeacherName('');
      setIsLoadingTeacher(false);
    });
    
    // Cleanup function to unsubscribe when child changes
    return () => {
      unsub();
    };
  }, [selectedChildId, children]);

  // Realtime saved reports for this parent
  useEffect(() => {
    if (!currentUser?.uid) return;
    
    // Load parent's sent messages from parentInbox (simplified query to avoid index requirement)
    const savedQ = query(
      collection(db, 'parentInbox'), 
      where('senderId', '==', currentUser.uid)
    );
    
    const unsub = onSnapshot(savedQ, (snap) => {
      const items = snap.docs
        .map(d => {
          const data = d.data() as any;
          return { 
            id: d.id, 
            title: data.title || data.subject || 'Report', 
            createdAt: (data.createdAt?.toDate?.() || new Date()) as Date,
            childName: data.data?.childName || data.childName || '',
            message: data.message || '',
            reportType: data.data?.reportType || 'general',
            teacherName: data.data?.teacherName || 'Teacher',
            status: data.data?.status || 'sent',
            senderRole: data.senderRole
          };
        })
        .filter(item => item.senderRole === 'parent') // Client-side filtering to avoid index requirement
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()); // Client-side sorting
      
      setSavedReports(items);
      setIsLoadingSaved(false);
    }, () => {
      setSavedReports([]); 
      setIsLoadingSaved(false);
    });
    
    return () => unsub();
  }, [currentUser?.uid]);

  return (
    <div className="p-6 space-y-6">

        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-red-50 via-orange-50 to-yellow-50 border border-gray-100">
          <div className="px-6 py-6 sm:px-8 sm:py-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-extrabold text-red-900">Report to Teacher</h2>
              <p className="text-sm text-red-700 mt-1">Report issues, concerns, or problems to your child's teacher</p>
            </div>
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center">
                <PaperAirplaneIcon className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        </div>



        {/* Report Form */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8">
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <PaperAirplaneIcon className="w-6 h-6 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Create New Report</h2>
            <p className="text-gray-600">Fill out the form below to report an issue to your child's teacher</p>
          </div>
          
          {sentBanner && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm flex items-center gap-2">
              <CheckCircleIcon className="w-5 h-5 text-green-600" />
              {sentBanner}
            </div>
          )}
          
          <div className="space-y-4">
            {/* Report Type Selection */}
            <div className="mb-6">
              <label className="block text-lg font-semibold text-gray-900 mb-4">What type of report is this?</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { type: 'issue', label: 'Learning Issue', desc: 'Problems with reading or learning', icon: '📚', color: 'red' },
                  { type: 'bug', label: 'Technical Problem', desc: 'App or website not working', icon: '🔧', color: 'yellow' },
                  { type: 'general', label: 'General Concern', desc: 'Other questions or concerns', icon: '💭', color: 'blue' }
                ].map(({ type, label, desc, icon, color }) => (
                  <button
                    key={type}
                    onClick={() => setReportType(type as any)}
                    className={`p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                      reportType === type
                        ? `border-${color}-500 bg-${color}-50 text-${color}-700`
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="text-2xl mb-2">{icon}</div>
                    <div className="font-semibold text-sm mb-1">{label}</div>
                    <div className="text-xs opacity-75">{desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-lg font-semibold text-gray-900 mb-3">Select your child</label>
                <select
                  value={selectedChildId}
                  onChange={(e) => setSelectedChildId(e.target.value)}
                  className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white hover:bg-gray-50 transition-colors"
                >
                  {children.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.grade && `(Grade ${c.grade})`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <UserIcon className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-blue-900 mb-1">Teacher Information</p>
                    {isLoadingTeacher ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin"></div>
                        <span className="text-sm text-blue-700">Loading teacher info...</span>
                      </div>
                    ) : (
                      <p className="text-sm text-blue-800">
                        {teacherName && teacherEmail ? `${teacherName}` : 
                         teacherEmail ? teacherEmail : 'No teacher assigned yet'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-lg font-semibold text-gray-900 mb-3">Report title (optional)</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief title for your report"
                className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white hover:bg-gray-50 transition-colors"
              />
            </div>
            
            <div className="mb-8">
              <label className="block text-lg font-semibold text-gray-900 mb-3">
                Describe the {reportType === 'issue' ? 'learning issue' : reportType === 'bug' ? 'technical problem' : 'concern'}
                <span className="text-red-500 ml-1">*</span>
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={8}
                placeholder={
                  reportType === 'issue' ? "Please describe the learning problem or concern about your child. Include details like when it happens, what you've noticed, and any specific examples." :
                  reportType === 'bug' ? "Please describe what's not working. Include what you were trying to do, what happened instead, and any error messages you saw." :
                  "Please describe your concern or question for the teacher. Include any relevant details that would help them understand the situation."
                }
                className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none bg-white hover:bg-gray-50 transition-colors"
              />
              <p className="text-sm text-gray-500 mt-2">Please provide as much detail as possible to help the teacher understand and address your concern.</p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center pt-6 border-t border-gray-200">
              <div className="flex-1">
                <p className="text-sm text-gray-600 mb-2">Ready to send your report?</p>
                <p className="text-xs text-gray-500">Your teacher will receive this report and can respond to you.</p>
              </div>
              <div className="flex-shrink-0">
                <button
                  onClick={handleSendToTeacher}
                  disabled={!teacherEmail || sending || !message.trim()}
                  className={`px-8 py-3 rounded-xl text-base font-semibold transition-all duration-200 flex items-center justify-center gap-3 min-w-[160px] ${
                    !teacherEmail || sending || !message.trim()
                      ? 'bg-gray-400 text-white cursor-not-allowed'
                      : 'bg-red-600 text-white hover:bg-red-700 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
                  }`}
                >
                  {sending ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Sending Report...
                    </>
                  ) : (
                    <>
                      <PaperAirplaneIcon className="w-5 h-5" />
                      Send Report
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Previous Reports */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <DocumentTextIcon className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">Previous Reports</h3>
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
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <DocumentTextIcon className="w-8 h-8 text-gray-600" />
              </div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">No reports yet</h4>
              <p className="text-gray-600 max-w-md mx-auto">
                Your reports to the teacher will appear here after you send your first report.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {savedReports.map(r => (
                <div key={r.id} className="p-4 border border-blue-200 rounded-lg bg-blue-50 hover:bg-white transition-all duration-200">
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      r.reportType === 'issue' ? 'bg-red-100' :
                      r.reportType === 'bug' ? 'bg-yellow-100' :
                      'bg-blue-100'
                    }`}>
                      <DocumentTextIcon className={`w-4 h-4 ${
                        r.reportType === 'issue' ? 'text-red-600' :
                        r.reportType === 'bug' ? 'text-yellow-600' :
                        'text-blue-600'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-medium text-blue-900">{r.title}</div>
                          {r.message && (
                            <div className="text-sm text-gray-700 mt-1 line-clamp-2">
                              {r.message}
                            </div>
                          )}
                          <div className="text-sm text-blue-600 flex items-center gap-2 mt-2">
                            <CalendarIcon className="w-3 h-3" />
                            {formatDateHuman(r.createdAt)}
                            {r.childName && (
                              <>
                                <span>•</span>
                                <UserIcon className="w-3 h-3" />
                                <span>{r.childName}</span>
                              </>
                            )}
                            {r.teacherName && (
                              <>
                                <span>•</span>
                                <AcademicCapIcon className="w-3 h-3" />
                                <span>To: {r.teacherName}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                          r.reportType === 'issue' ? 'bg-red-100 text-red-700' :
                          r.reportType === 'bug' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {r.reportType === 'issue' ? 'Concern Shared' :
                           r.reportType === 'bug' ? 'Tech Issue' :
                           'General Chat'}
                        </div>
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
  );
};

export default ReportsPage; 