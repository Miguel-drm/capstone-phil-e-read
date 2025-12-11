import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { notificationService, type LinkRequest } from '../../services/notificationService';
import { db } from '../../config/firebase';
import { doc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { 
  XMarkIcon, 
  CheckIcon, 
  XCircleIcon,
  UserIcon,
  CalendarIcon,
  EnvelopeIcon,
  ChatBubbleLeftRightIcon,
  ExclamationTriangleIcon,
  AcademicCapIcon,
  BookOpenIcon
} from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';

interface LinkRequestApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  requestId?: string;
  onRequestUpdated?: () => void;
}

const LinkRequestApprovalModal: React.FC<LinkRequestApprovalModalProps> = ({
  isOpen,
  onClose,
  requestId,
  onRequestUpdated
}) => {
  const { currentUser } = useAuth();
  const [request, setRequest] = useState<LinkRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectionForm, setShowRejectionForm] = useState(false);
  const [parentName, setParentName] = useState<string>('');
  const [foundStudents, setFoundStudents] = useState<any[]>([]);
  const [searchingStudents, setSearchingStudents] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');

  useEffect(() => {
    if (isOpen && requestId && currentUser?.uid) {
      fetchRequestDetails();
    }
  }, [isOpen, requestId, currentUser?.uid]);

  const fetchRequestDetails = async () => {
    if (!requestId) return;
    
    setLoading(true);
    try {
      const requests = await notificationService.getAllLinkRequests(currentUser?.uid || '');
      const foundRequest = requests.find(r => r.id === requestId);
      setRequest(foundRequest || null);
      
      // Fetch parent's actual name from users collection
      if (foundRequest?.parentId) {
        try {
          const parentDoc = await getDoc(doc(db, 'users', foundRequest.parentId));
          if (parentDoc.exists()) {
            const parentData = parentDoc.data();
            // Use displayName if available, otherwise use email prefix
            const name = parentData.displayName || 
                        parentData.name || 
                        foundRequest.parentEmail?.split('@')[0] || 
                        'Unknown Parent';
            setParentName(name);
          } else {
            setParentName(foundRequest.parentEmail?.split('@')[0] || 'Unknown Parent');
          }
        } catch (error) {
          console.debug('Error fetching parent name:', error);
          setParentName(foundRequest.parentEmail?.split('@')[0] || 'Unknown Parent');
        }
      }

      // Search for students with matching name
      if (foundRequest?.firstName && foundRequest?.lastName && foundRequest?.classGradeId) {
        await searchForStudents(foundRequest.firstName, foundRequest.lastName, foundRequest.classGradeId);
      }
    } catch (error) {
      console.error('Error fetching request details:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchForStudents = async (firstName: string, lastName: string, classGradeId: string) => {
    setSearchingStudents(true);
    try {
      const students = await notificationService.searchStudentsByName(firstName, lastName, classGradeId);
      setFoundStudents(students);
      
      // Auto-select if only one student found
      if (students.length === 1) {
        setSelectedStudentId(students[0].id);
      }
    } catch (error) {
      console.error('Error searching for students:', error);
      setFoundStudents([]);
    } finally {
      setSearchingStudents(false);
    }
  };

  const handleApprove = async () => {
    if (!request || !currentUser?.uid) return;

    if (!selectedStudentId) {
      console.warn('Please select a student to approve this request.');
      return;
    }

    setActionLoading(true);
    try {
      const success = await notificationService.approveLinkRequest(request.id, currentUser.uid, selectedStudentId);
      if (success) {
        onRequestUpdated?.();
        onClose();
      }
    } catch (error) {
      console.error('Error approving request:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!request || !currentUser?.uid) return;

    setActionLoading(true);
    try {
      const success = await notificationService.rejectLinkRequest(
        request.id, 
        currentUser.uid, 
        rejectionReason || undefined
      );
      
      if (success) {
        // Create notification for parent in notifications collection
        await notificationService.createNotification({
          type: 'link_rejected',
          title: 'Link Request Rejected',
          message: rejectionReason 
            ? `Your request to link ${request.childName} was rejected!\nReason: ${rejectionReason}`
            : `Your request to link ${request.childName} was rejected!`,
          userId: request.parentId,
          isRead: false,
          data: { requestId: request.id, reason: rejectionReason }
        });

        // Also create notification in parentInbox for immediate visibility
        await addDoc(collection(db, 'parentInbox'), {
          title: 'Link Request Rejected',
          message: rejectionReason 
            ? `Your request to link ${request.childName} was rejected!\nReason: ${rejectionReason}`
            : `Your request to link ${request.childName} was rejected!`,
          type: 'link_rejected',
          recipientId: request.parentId,
          senderId: currentUser.uid,
          senderRole: 'teacher',
          senderName: 'Teacher',
          isRead: false,
          isArchived: false,
          priority: 'high',
          category: 'link_requests',
          createdAt: serverTimestamp(),
          data: { 
            requestId: request.id, 
            reason: rejectionReason,
            childName: request.childName
          }
        });

        onRequestUpdated?.();
        onClose();
      }
    } catch (error) {
      console.error('Error rejecting request:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleClose = () => {
    setRejectionReason('');
    setShowRejectionForm(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <UserIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900">Link Request Review</h3>
              <p className="text-sm text-gray-600">Review and approve or reject this parent's request</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-10 h-10 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all duration-200"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : request ? (
            <div className="space-y-6">
              {/* Request Details */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="font-semibold text-gray-900 mb-3">Request Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Child's Name</label>
                      <p className="text-sm text-gray-900">{request.childName}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Grade & Section</label>
                      <p className="text-sm text-gray-900">{request.gradeLevel} - {request.sectionName}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Relationship</label>
                      <p className="text-sm text-gray-900 capitalize">{request.relationship}</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Parent Name</label>
                      <p className="text-sm text-gray-900">{parentName || 'Loading...'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Parent Email</label>
                      <p className="text-sm text-gray-900">{request.parentEmail}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Request Date</label>
                      <p className="text-sm text-gray-900">
                        {formatDistanceToNow(request.createdAt.toDate(), { addSuffix: true })}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Status</label>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        request.status === 'pending' 
                          ? 'bg-yellow-100 text-yellow-800'
                          : request.status === 'approved'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Student Selection Section */}
              <div className="bg-blue-50 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
                  <UserIcon className="h-4 w-4" />
                  Student Selection
                </h4>
                
                {searchingStudents ? (
                  <div className="text-center py-4">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    <p className="text-sm text-blue-700 mt-2">Searching for students...</p>
                  </div>
                ) : foundStudents.length > 0 ? (
                  <div className="space-y-3">
                    <p className="text-sm text-blue-800">
                      Found {foundStudents.length} student{foundStudents.length !== 1 ? 's' : ''} matching "{request.firstName} {request.lastName}":
                    </p>
                    <div className="space-y-2">
                      {foundStudents.map((student) => (
                        <label
                          key={student.id}
                          className={`flex items-center p-3 rounded-lg border-2 cursor-pointer transition-all ${
                            selectedStudentId === student.id
                              ? 'border-blue-500 bg-blue-100'
                              : 'border-gray-200 bg-white hover:border-blue-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="selectedStudent"
                            value={student.id}
                            checked={selectedStudentId === student.id}
                            onChange={(e) => setSelectedStudentId(e.target.value)}
                            className="sr-only"
                          />
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{student.name}</div>
                            <div className="text-sm text-gray-600 flex items-center gap-3">
                              <span className="flex items-center gap-1">
                                <AcademicCapIcon className="h-3 w-3" />
                                Grade {student.grade}
                              </span>
                              <span className="flex items-center gap-1">
                                <BookOpenIcon className="h-3 w-3" />
                                Level {student.readingLevel}
                              </span>
                              <div className="flex items-center gap-1">
                                <div className={`w-2 h-2 rounded-full ${
                                  student.performance === 'Excellent' 
                                    ? 'bg-green-500' 
                                    : student.performance === 'Good' 
                                    ? 'bg-blue-500'
                                    : student.performance === 'Needs Improvement'
                                    ? 'bg-yellow-500'
                                    : 'bg-gray-400'
                                }`}></div>
                                <span className="text-xs font-medium text-gray-700">
                                  {student.performance === 'Good' ? 'On Track' : 
                                   student.performance === 'Excellent' ? 'Advanced' :
                                   student.performance === 'Needs Improvement' ? 'Support Needed' :
                                   student.performance}
                                </span>
                              </div>
                            </div>
                          </div>
                          {selectedStudentId === student.id && (
                            <CheckIcon className="h-5 w-5 text-blue-600" />
                          )}
                        </label>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <ExclamationTriangleIcon className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
                    <p className="text-sm text-yellow-800 font-medium">No students found</p>
                    <p className="text-xs text-yellow-700 mt-1">
                      No students found matching "{request.firstName} {request.lastName}" in this class.
                    </p>
                  </div>
                )}
              </div>

              {/* Additional Message */}
              {request.message && (
                <div className="bg-blue-50 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <ChatBubbleLeftRightIcon className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1">Additional Message</h4>
                      <p className="text-sm text-gray-700 italic">"{request.message}"</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Rejection Reason Form */}
              {showRejectionForm && (
                <div className="bg-red-50 rounded-xl p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">Rejection Reason</h4>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Please provide a reason for rejection (optional but recommended)..."
                    rows={3}
                    className="w-full px-3 py-2 border border-red-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                    dir="ltr"
                    style={{ direction: 'ltr', textAlign: 'left', unicodeBidi: 'embed' }}
                  />
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-6 border-t border-gray-200">
                <div className="flex items-center gap-3">
                  {!showRejectionForm ? (
                    <>
                      <button
                        onClick={handleApprove}
                        disabled={actionLoading || request.status !== 'pending' || !selectedStudentId}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 hover:scale-[1.02] hover:shadow-lg disabled:bg-gray-400 disabled:hover:scale-100 disabled:hover:shadow-none text-white font-semibold rounded-lg focus:outline-none focus:ring-4 focus:ring-green-200 transition-all duration-200"
                      >
                        <CheckIcon className="h-5 w-5" />
                        {actionLoading ? 'Approving...' : 'Approve Request'}
                      </button>
                      <button
                        onClick={() => setShowRejectionForm(true)}
                        disabled={actionLoading || request.status !== 'pending'}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 hover:scale-[1.02] hover:shadow-lg disabled:bg-gray-400 disabled:hover:scale-100 disabled:hover:shadow-none text-white font-semibold rounded-lg focus:outline-none focus:ring-4 focus:ring-red-200 transition-all duration-200"
                      >
                        <XCircleIcon className="h-5 w-5" />
                        Reject Request
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={handleReject}
                        disabled={actionLoading}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 hover:scale-[1.02] hover:shadow-lg disabled:bg-gray-400 disabled:hover:scale-100 disabled:hover:shadow-none text-white font-semibold rounded-lg focus:outline-none focus:ring-4 focus:ring-red-200 transition-all duration-200"
                      >
                        <XCircleIcon className="h-5 w-5" />
                        {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
                      </button>
                      <button
                        onClick={() => setShowRejectionForm(false)}
                        disabled={actionLoading}
                        className="px-5 py-2.5 border-2 border-gray-300 text-gray-700 font-medium hover:bg-gray-50 hover:border-gray-400 rounded-lg focus:outline-none focus:ring-4 focus:ring-gray-200 transition-all duration-200"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
                <button
                  onClick={handleClose}
                  className="px-5 py-2.5 text-gray-600 hover:text-gray-900 font-medium transition-colors duration-200"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <ExclamationTriangleIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Request not found or no longer available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LinkRequestApprovalModal;
