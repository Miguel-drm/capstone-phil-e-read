import React, { useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const ReportsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [teacherEmail, setTeacherEmail] = useState('');
  const [childName, setChildName] = useState('');
  const [notes, setNotes] = useState('');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [recipient, setRecipient] = useState<'teacher' | 'admin'>('teacher');
  const [subject, setSubject] = useState('Reading Practice Update');
  const [message, setMessage] = useState('');

  const shareMailtoHref = useMemo(() => {
    const to = encodeURIComponent(teacherEmail.trim());
    const subjectLine = encodeURIComponent(`Parent report${childName ? ` for ${childName}` : ''}`);
    const bodyLines = [
      `Parent: ${currentUser?.email || ''}`,
      childName ? `Child: ${childName}` : '',
      '',
      'Notes:',
      notes || '-'
    ].filter(Boolean);
    const body = encodeURIComponent(bodyLines.join('\n'));
    return `mailto:${to}?subject=${subjectLine}&body=${body}`;
  }, [teacherEmail, childName, notes, currentUser?.email]);

  return (
    <div className="p-6 space-y-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border border-gray-100">
        <div className="px-6 py-6 sm:px-8 sm:py-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold text-blue-900">Reports</h2>
            <p className="text-sm text-blue-700 mt-1">View analytics, export summaries, or send a report to a teacher/admin.</p>
          </div>
          <div className="flex gap-2">
            <input type="text" placeholder="Search reports..." className="border border-blue-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white" />
            <button className="px-4 py-2 rounded-xl text-blue-700 bg-white border border-blue-100 hover:bg-blue-50 transition">Filter</button>
            <button onClick={() => setIsCreateOpen(true)} className="px-4 py-2 rounded-xl text-white bg-gradient-to-r from-blue-500 to-purple-500">Create Report</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl p-4 bg-white border border-gray-100"><div className="text-xs text-gray-500">Total Sessions</div><div className="text-2xl font-extrabold text-blue-700 mt-1">12</div></div>
        <div className="rounded-2xl p-4 bg-white border border-gray-100"><div className="text-xs text-gray-500">Avg. Score</div><div className="text-2xl font-extrabold text-green-700 mt-1">86%</div></div>
        <div className="rounded-2xl p-4 bg-white border border-gray-100"><div className="text-xs text-gray-500">Avg. WPM</div><div className="text-2xl font-extrabold text-yellow-700 mt-1">92</div></div>
        <div className="rounded-2xl p-4 bg-white border border-gray-100"><div className="text-xs text-gray-500">This Week</div><div className="text-2xl font-extrabold text-purple-700 mt-1">3 sessions</div></div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Share Report to Teacher</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teacher email</label>
            <input
              type="email"
              value={teacherEmail}
              onChange={(e) => setTeacherEmail(e.target.value)}
              placeholder="teacher@example.com"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Child name (optional)</label>
            <input
              type="text"
              value={childName}
              onChange={(e) => setChildName(e.target.value)}
              placeholder="Your child's name"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
              placeholder="Write anything you want to share about your child's reading..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-end gap-3">
          <a
            href={shareMailtoHref}
            className={`px-4 py-2 rounded-lg text-white ${teacherEmail.trim() ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'}`}
            aria-disabled={!teacherEmail.trim()}
          >
            Open Email
          </a>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Saved Reports</h3>
        <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-gray-500">No reports available yet.</div>
      </div>

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center">
          <div className="bg-white rounded-2xl border border-gray-100 w-full max-w-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900">Create Report</h4>
              <button onClick={() => setIsCreateOpen(false)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div className="flex gap-2">
                <label className={`px-3 py-1.5 text-sm rounded-xl border ${recipient==='teacher'?'bg-blue-50 border-blue-200 text-blue-700':'border-gray-200'}`}>
                  <input type="radio" name="recipient" value="teacher" checked={recipient==='teacher'} onChange={() => setRecipient('teacher')} className="mr-2" /> Teacher
                </label>
                <label className={`px-3 py-1.5 text-sm rounded-xl border ${recipient==='admin'?'bg-blue-50 border-blue-200 text-blue-700':'border-gray-200'}`}>
                  <input type="radio" name="recipient" value="admin" checked={recipient==='admin'} onChange={() => setRecipient('admin')} className="mr-2" /> Admin
                </label>
              </div>
              <input value={subject} onChange={(e)=>setSubject(e.target.value)} placeholder="Subject" className="px-3 py-2 border border-gray-200 rounded-xl" />
              <textarea value={message} onChange={(e)=>setMessage(e.target.value)} placeholder="Write your message..." rows={6} className="px-3 py-2 border border-gray-200 rounded-xl" />
              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-500">This will be sent to your {recipient} via the system.</div>
                <div className="flex gap-2">
                  <button onClick={()=>setIsCreateOpen(false)} className="px-4 py-2 rounded-xl border border-gray-200 bg-white">Cancel</button>
                  <button onClick={()=>{ setIsCreateOpen(false); }} className="px-4 py-2 rounded-xl text-white bg-gradient-to-r from-blue-500 to-purple-500">Send Report</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsPage; 