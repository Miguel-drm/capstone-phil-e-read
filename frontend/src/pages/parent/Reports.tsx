import React, { useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { resultService } from '../../services/resultsService';

const ReportsPage: React.FC = () => {
  const { currentUser, userRole } = useAuth();
  const [teacherEmail, setTeacherEmail] = useState('');
  const [childName, setChildName] = useState('');
  const [notes, setNotes] = useState('');

  const shareMailtoHref = useMemo(() => {
    const to = encodeURIComponent(teacherEmail.trim());
    const subject = encodeURIComponent(`Parent report${childName ? ` for ${childName}` : ''}`);
    const bodyLines = [
      `Parent: ${currentUser?.email || ''}`,
      childName ? `Child: ${childName}` : '',
      '',
      'Notes:',
      notes || '-'
    ].filter(Boolean);
    const body = encodeURIComponent(bodyLines.join('\n'));
    return `mailto:${to}?subject=${subject}&body=${body}`;
  }, [teacherEmail, childName, notes, currentUser?.email]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900">Reports</h2>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
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

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <p className="text-gray-500 text-sm">More detailed parent report features will be added soon.</p>
      </div>
    </div>
  );
};

export default ReportsPage; 