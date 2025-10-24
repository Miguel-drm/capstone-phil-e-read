import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { db } from '../../../config/firebase';
import { collection, doc, getDocs, onSnapshot, query, updateDoc, where, writeBatch, getDoc } from 'firebase/firestore';
import { notificationService, type LinkRequest as ServiceLinkRequest } from '../../../services/notificationService';
import LinkRequestApprovalModal from '../../notifications/LinkRequestApprovalModal';
import { 
  UserPlusIcon, 
  ClockIcon, 
  EyeIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';

interface LinkRequest {
  id: string;
  parentId: string;
  parentEmail?: string;
  childName: string;
  classGradeId: string;
  gradeLevel?: number | null;
  sectionName?: string | null;
  relationship?: string;
  message?: string;
  teacherId?: string | null;
  status: 'pending' | 'approved' | 'denied';
  createdAt?: any;
}

interface StudentOption {
  id: string;
  name: string;
}

const PendingLinkRequests: React.FC = () => {
  const { currentUser, userRole } = useAuth();
  const [requests, setRequests] = useState<LinkRequest[]>([]);
  const [studentsByClass, setStudentsByClass] = useState<Record<string, StudentOption[]>>({});
  const [selectedStudentByRequest, setSelectedStudentByRequest] = useState<Record<string, string>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<LinkRequest | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [parentNames, setParentNames] = useState<Record<string, string>>({});

  // Subscribe to pending requests for this teacher
  useEffect(() => {
    if (!currentUser?.uid || userRole !== 'teacher') return;
    const col = collection(db, 'linkRequests');
    const q = query(col, where('status', '==', 'pending'), where('teacherId', '==', currentUser.uid));
    const unsub = onSnapshot(q, async (snap) => {
      const items: LinkRequest[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      setRequests(items);
      
      // Fetch parent names for all requests
      const names: Record<string, string> = {};
      for (const request of items) {
        if (request.parentId && !names[request.parentId]) {
          try {
            const parentDoc = await getDoc(doc(db, 'users', request.parentId));
            if (parentDoc.exists()) {
              const parentData = parentDoc.data();
              names[request.parentId] = parentData.displayName || 
                                      parentData.name || 
                                      request.parentEmail?.split('@')[0] || 
                                      'Unknown Parent';
            } else {
              names[request.parentId] = request.parentEmail?.split('@')[0] || 'Unknown Parent';
            }
          } catch (error) {
            console.debug('Error fetching parent name:', error);
            names[request.parentId] = request.parentEmail?.split('@')[0] || 'Unknown Parent';
          }
        }
      }
      setParentNames(names);
    }, () => setRequests([]));
    return () => unsub();
  }, [currentUser?.uid, userRole]);

  // Load students for each class in the pending list (once per class)
  useEffect(() => {
    const load = async () => {
      const missingClassIds = Array.from(new Set(requests.map(r => r.classGradeId))).filter(id => !studentsByClass[id]);
      if (missingClassIds.length === 0) return;
      const newMap: Record<string, StudentOption[]> = {};
      for (const classId of missingClassIds) {
        const studentsCol = collection(db, 'students');
        const q = query(studentsCol, where('gradeId', '==', classId));
        const snap = await getDocs(q);
        newMap[classId] = snap.docs.map(d => ({ id: d.id, name: (d.data() as any).name || 'Unnamed' }));
      }
      setStudentsByClass(prev => ({ ...prev, ...newMap }));
    };
    if (requests.length) load();
  }, [requests, studentsByClass]);

  const handleApprove = async (req: LinkRequest) => {
    const selectedStudentId = selectedStudentByRequest[req.id];
    if (!selectedStudentId) {
      console.warn('Please select a student to link.');
      return;
    }
    try {
      setSubmittingId(req.id);
      const batch = writeBatch(db);
      // Update student parentId (teachers are allowed by rules to update their students)
      batch.update(doc(db, 'students', selectedStudentId), { parentId: req.parentId });
      // Mark request approved
      batch.update(doc(db, 'linkRequests', req.id), { status: 'approved' });
      await batch.commit();
    } catch (e) {
      console.error('Approve failed', e);
      console.error('Failed to approve request.');
    } finally {
      setSubmittingId(null);
    }
  };

  const handleDeny = async (req: LinkRequest) => {
    try {
      setSubmittingId(req.id);
      await updateDoc(doc(db, 'linkRequests', req.id), { status: 'denied' });
    } catch (e) {
      console.error('Deny failed', e);
      console.error('Failed to deny request.');
    } finally {
      setSubmittingId(null);
    }
  };

  const handleViewRequest = (request: LinkRequest) => {
    setSelectedRequest(request);
    setShowApprovalModal(true);
  };

  const handleRequestUpdated = () => {
    // Refresh the requests list
    if (currentUser?.uid) {
      const col = collection(db, 'linkRequests');
      const q = query(col, where('status', '==', 'pending'), where('teacherId', '==', currentUser.uid));
      getDocs(q).then(snap => {
        const items: LinkRequest[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        setRequests(items);
      });
    }
  };

  if (userRole !== 'teacher') return null;

  return (
    <>
      <div className="bg-white rounded-2xl p-6 border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <UserPlusIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Pending Link Requests</h3>
              <p className="text-sm text-gray-500">{requests.length} request{requests.length !== 1 ? 's' : ''} awaiting approval</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
              {requests.length} Pending
            </span>
          </div>
        </div>

        {requests.length === 0 ? (
          <div className="text-center py-8">
            <UserPlusIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Pending Requests</h3>
            <p className="text-gray-500 text-sm">All link requests have been processed</p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.slice(0, 3).map((r) => (
              <div
                key={r.id}
                className="group p-4 border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-sm transition-all duration-200"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
                        <span className="text-sm font-semibold text-blue-700">
                          {r.childName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">{r.childName}</h4>
                        <p className="text-sm text-gray-600">Grade {r.gradeLevel || ''} {r.sectionName ? `• ${r.sectionName}` : ''}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 text-xs text-gray-500 mb-2">
                      <span className="flex items-center gap-1">
                        <ClockIcon className="h-3 w-3" />
                        {r.createdAt ? formatDistanceToNow(r.createdAt.toDate(), { addSuffix: true }) : 'Recently'}
                      </span>
                          <span>From: {parentNames[r.parentId] || r.parentEmail?.split('@')[0] || 'Unknown Parent'}</span>
                    </div>

                    {r.message && (
                      <p className="text-sm text-gray-600 italic bg-gray-50 p-2 rounded-lg">
                        "{r.message}"
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => handleViewRequest(r)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors group-hover:bg-blue-200"
                    >
                      <EyeIcon className="h-3 w-3" />
                      Review
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {requests.length > 3 && (
              <div className="text-center pt-2">
                <button className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                  View all {requests.length} requests
                </button>
              </div>
            )}
          </div>
        )}

        {/* Quick Stats */}
        {requests.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-lg font-semibold text-gray-900">{requests.length}</div>
                <div className="text-xs text-gray-500">Total Pending</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-blue-600">
                  {requests.filter(r => r.message && r.message.trim().length > 0).length}
                </div>
                <div className="text-xs text-gray-500">With Messages</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-orange-600">
                  {requests.filter(r => {
                    if (!r.createdAt) return false;
                    const hoursSinceRequest = (Date.now() - r.createdAt.toMillis()) / (1000 * 60 * 60);
                    return hoursSinceRequest > 24;
                  }).length}
                </div>
                <div className="text-xs text-gray-500">Over 24h</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Approval Modal */}
      <LinkRequestApprovalModal
        isOpen={showApprovalModal}
        onClose={() => setShowApprovalModal(false)}
        requestId={selectedRequest?.id}
        onRequestUpdated={handleRequestUpdated}
      />
    </>
  );
};

export default PendingLinkRequests;


