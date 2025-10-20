import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { studentService, type Student } from '../../../services/studentService';
import { parentService, type Grade, type GradeSection } from '../../../services/parentService';
import { useNavigate } from 'react-router-dom';
import { BookOpenIcon, ChartBarIcon, MagnifyingGlassIcon, UserGroupIcon, EnvelopeIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { db } from '../../../config/firebase';
import { addDoc, collection, doc as fsDoc, getDoc, serverTimestamp } from 'firebase/firestore';

const MyChildren: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [children, setChildren] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState<string>('');
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [requestData, setRequestData] = useState({
    firstName: '',
    lastName: '',
    gradeLevel: '',
    section: '',
    relationship: '',
    message: ''
  });
  const [availableGrades, setAvailableGrades] = useState<Grade[]>([]);
  const [loadingGrades, setLoadingGrades] = useState(false);
  const [availableSections, setAvailableSections] = useState<GradeSection[]>([]);
  const [loadingSections, setLoadingSections] = useState(false);
  const [networkError, setNetworkError] = useState(false);

  // Helper function to capitalize names properly
  const capitalizeName = (name: string): string => {
    return name.trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  useEffect(() => {
    const fetchChildren = async () => {
      if (!currentUser?.uid) return;
      setLoading(true);
      try {
        const students = await studentService.getStudentsByParent(currentUser.uid);
        setChildren(students);
      } catch (err) {
        console.warn('Network issue fetching children, using empty array:', err);
        setChildren([]);
        setNetworkError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchChildren();
  }, [currentUser?.uid]);

  // Fetch real grades and sections from database
  useEffect(() => {
    const fetchGradesAndSections = async () => {
      setLoadingGrades(true);
      try {
        console.log('🔄 Component: Calling parentService.getGradesAndSections()...');
        const response = await parentService.getGradesAndSections();
        console.log('✅ Component: Received grades response:', response);
        console.log('📊 Component: Response grades length:', response.grades?.length);
        console.log('📊 Component: First grade:', response.grades?.[0]);
        console.log('Response type:', typeof response);
        console.log('Response.grades:', response.grades);
        console.log('Response.grades type:', typeof response.grades);
        console.log('Response.grades length:', response.grades?.length);
        if (response.grades && response.grades.length > 0) {
          console.log('First grade object:', response.grades[0]);
          console.log('First grade keys:', Object.keys(response.grades[0]));
        }
        setAvailableGrades(response.grades);
        console.log('Set available grades:', response.grades);
      } catch (error) {
        console.error('❌ Component: Error fetching grades and sections:', error);
        console.log('This error should not occur if fallback works properly');
        console.log('🔥 Component: This should not happen - service should return mock data');
        // Don't set network error immediately - let the service handle fallback
        // Don't set empty array - let the service handle fallback
        // setAvailableGrades([]);
        // setNetworkError(true); // Commented out to allow service fallback
      } finally {
        setLoadingGrades(false);
      }
    };
    
    fetchGradesAndSections();
  }, []);

  const grades = useMemo(() => Array.from(new Set(children.map(c => c.grade).filter(Boolean))), [children]);
  const filtered = useMemo(() => {
    return children.filter(c => (
      (!gradeFilter || c.grade === gradeFilter) &&
      (!search || (c.name?.toLowerCase().includes(search.toLowerCase())))
    ));
  }, [children, gradeFilter, search]);

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.uid) {
      alert('You must be signed in to submit a request.');
      return;
    }
    if (!requestData.firstName.trim() || !requestData.lastName.trim()) {
      alert("Please enter both first name and last name.");
      return;
    }
    if (!requestData.gradeLevel || !requestData.section) {
      alert('Please select both grade level and section.');
      return;
    }

    try {
      setSubmitting(true);

      // Resolve selected class grade (section) to fetch teacherId and details
      const classGradeRef = fsDoc(db, 'classGrades', requestData.section);
      const classGradeSnap = await getDoc(classGradeRef);
      if (!classGradeSnap.exists()) {
        alert('Selected section no longer exists. Please try again.');
        setSubmitting(false);
        return;
      }
      const classGrade = classGradeSnap.data() as any;
      const teacherId: string | undefined = classGrade.teacherId;

      // Create link request document
      const linkRequestsRef = collection(db, 'linkRequests');
      // Ensure proper capitalization
      const firstName = capitalizeName(requestData.firstName);
      const lastName = capitalizeName(requestData.lastName);
      
      await addDoc(linkRequestsRef, {
        parentId: currentUser.uid,
        parentEmail: currentUser.email || '',
        firstName: firstName,
        lastName: lastName,
        childName: `${firstName} ${lastName}`,
        classGradeId: requestData.section,
        gradeLevel: classGrade.gradeLevel || null,
        sectionName: classGrade.section || null,
        relationship: requestData.relationship || 'parent',
        message: requestData.message || '',
        teacherId: teacherId || null,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      setRequestSent(true);
      setTimeout(() => {
        setShowRequestForm(false);
        setRequestSent(false);
        setRequestData({ firstName: '', lastName: '', gradeLevel: '', section: '', relationship: '', message: '' });
      }, 1600);
    } catch (err) {
      console.error('Failed to submit link request:', err);
      alert('Failed to submit your request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (name === 'gradeLevel') {
      console.log('Grade level changed to:', value);
      console.log('Available grades at time of change:', availableGrades);
      
      // Reset section when grade level changes
      setRequestData(prev => ({
        ...prev,
        gradeLevel: value,
        section: ''
      }));
      
      // Fetch sections for the selected grade
      if (value) {
        fetchSectionsForGrade(value);
      } else {
        setAvailableSections([]);
      }
    } else if (name === 'firstName' || name === 'lastName') {
      // Capitalize names properly
      const capitalizedValue = capitalizeName(value);
      setRequestData(prev => ({
        ...prev,
        [name]: capitalizedValue
      }));
    } else {
      setRequestData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  // Get sections for selected grade from already loaded data
  const fetchSectionsForGrade = async (gradeId: string) => {
    setLoadingSections(true);
    try {
      console.log('Fetching sections for gradeId:', gradeId);
      console.log('Available grades:', availableGrades);
      
      // Find the selected grade and get its sections
      const selectedGrade = availableGrades.find(grade => grade.id === gradeId);
      console.log('Selected grade:', selectedGrade);
      
      if (selectedGrade) {
        console.log('Setting sections:', selectedGrade.sections);
        setAvailableSections(selectedGrade.sections);
      } else {
        console.log('No grade found, clearing sections');
        setAvailableSections([]);
      }
    } catch (error) {
      console.error('Error loading sections:', error);
      setAvailableSections([]);
    } finally {
      setLoadingSections(false);
    }
  };


  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100">
      {networkError && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
            <p className="text-sm text-yellow-800">
              <strong>Connection Issue:</strong> Some features may be limited due to network connectivity. The form will still work for requesting child links.
            </p>
          </div>
        </div>
      )}
      
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <h3 className="text-lg font-semibold text-gray-900">My Children</h3>
        <div className="flex items-center gap-2">
          <div className="relative">
            <MagnifyingGlassIcon className="h-4 w-4 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name..."
              className="pl-7 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white"
          >
            <option value="">All Grades</option>
            {grades.map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
          <button
            onClick={() => setShowRequestForm(true)}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-xl text-blue-700 bg-white border border-blue-100 hover:bg-blue-50"
          >
            <EnvelopeIcon className="h-4 w-4" /> Request Link
          </button>
        </div>
      </div>
      {loading ? (
        <div className="text-gray-500">Loading...</div>
      ) : children.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center mb-4">
            <UserGroupIcon className="h-10 w-10 text-blue-500" />
          </div>
          <h4 className="text-lg font-semibold text-gray-800 mb-2">Request to Link Your Child</h4>
          <p className="text-gray-500 text-center max-w-sm mb-6">Submit a request to link your child's account to yours. Our team will review and approve the connection.</p>
          <button
            onClick={() => setShowRequestForm(true)}
            className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium rounded-xl text-white bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            <EnvelopeIcon className="h-5 w-5" />
            Submit Link Request
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(child => (
            <div key={child.id} className="group relative overflow-hidden bg-gradient-to-br from-blue-50 to-white border border-blue-100 rounded-2xl p-5 flex flex-col transition-all">
              <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-blue-100/60 blur-2xl group-hover:scale-110 transition-transform" />
              <div className="flex items-center mb-2">
                <div className="h-12 w-12 rounded-xl bg-white/80 border border-blue-100 flex items-center justify-center text-lg font-bold text-blue-700 mr-3">
                  {child.name?.[0] || '?'}
                </div>
                <div>
                  <div className="font-semibold text-gray-900 text-lg">{child.name}</div>
                  <div className="text-xs text-gray-500">{child.grade}</div>
                </div>
              </div>
              <div className="flex flex-col gap-1 mt-2">
                <div className="text-sm"><span className="font-medium text-gray-700">Reading Level:</span> {child.readingLevel}</div>
                <div className="text-sm"><span className="font-medium text-gray-700">Performance:</span> <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${child.performance === 'Excellent' ? 'bg-green-100 text-green-700' : child.performance === 'Good' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>{child.performance}</span></div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => navigate('/parent/reading-practice', { state: { childId: child.id, childName: child.name } })}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg text-white bg-gradient-to-r from-blue-500 to-purple-500"
                  >
                    <BookOpenIcon className="h-4 w-4" /> Practice
                  </button>
                  <button
                    onClick={() => navigate('/parent/progress', { state: { childId: child.id } })}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg text-blue-700 bg-white border border-blue-100 hover:bg-blue-50"
                  >
                    <ChartBarIcon className="h-4 w-4" /> Progress
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Request Link Modal */}
      {showRequestForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Request Child Link</h3>
                <button
                  onClick={() => setShowRequestForm(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              
              {requestSent ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                    <CheckCircleIcon className="h-8 w-8 text-green-500" />
                  </div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">Request Submitted!</h4>
                  <p className="text-gray-500">Your request has been sent. We'll review and approve the child link within 24 hours.</p>
                </div>
              ) : (
                <form onSubmit={handleRequestSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                      <input
                        type="text"
                        name="firstName"
                        value={requestData.firstName}
                        onChange={handleInputChange}
                        required
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter first name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                      <input
                        type="text"
                        name="lastName"
                        value={requestData.lastName}
                        onChange={handleInputChange}
                        required
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter last name"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Grade Level</label>
                    <select
                      name="gradeLevel"
                      value={requestData.gradeLevel}
                      onChange={handleInputChange}
                      required
                      disabled={loadingGrades}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                    >
                      <option value="">
                        {loadingGrades ? 'Loading grades...' : availableGrades.length === 0 ? 'No grades available' : 'Select grade level'}
                      </option>
                      {availableGrades.map(grade => {
                        // Use new structure if available, fallback to parsing name
                        const getGradeDisplayName = () => {
                          // Check if we have the new structure with gradeLevel
                          if (grade.sections && grade.sections.length > 0 && grade.sections[0].gradeLevel) {
                            return `Grade ${grade.sections[0].gradeLevel}`;
                          }
                          // Fallback to old structure (parsing name)
                          if (grade.name) {
                            const parts = grade.name.split('-');
                            return parts[0].trim(); // Return "Grade 4" instead of "Grade 4 - Mango"
                          }
                          return grade.name || 'Unknown Grade';
                        };
                        
                        return (
                          <option key={grade.id} value={grade.id}>
                            {getGradeDisplayName()}
                          </option>
                        );
                      })}
                    </select>
                    {availableGrades.length === 0 && !loadingGrades && (
                      <p className="text-xs text-gray-500 mt-1">No active classes found. Please contact your school administrator.</p>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
                    <select
                      name="section"
                      value={requestData.section}
                      onChange={handleInputChange}
                      required
                      disabled={!requestData.gradeLevel || loadingSections}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                    >
                      <option value="">
                        {!requestData.gradeLevel 
                          ? 'Select grade level first' 
                          : loadingSections
                            ? 'Loading sections...'
                            : availableSections.length === 0 
                              ? 'No sections available' 
                              : 'Select section'
                        }
                      </option>
                      {availableSections.map(section => {
                        // Use new structure if available, fallback to parsing name
                        const getSectionDisplayName = () => {
                          // Check if we have the new structure with section field
                          if (section.sectionName) {
                            return section.sectionName;
                          }
                          // Fallback to old structure (parsing name)
                          if (section.name) {
                            const parts = section.name.split('-');
                            return parts.length > 1 ? parts[parts.length - 1].trim() : section.name.trim();
                          }
                          return section.name || 'Unknown Section';
                        };
                        
                        return (
                          <option key={section.id} value={section.id}>
                            {getSectionDisplayName()}
                          </option>
                        );
                      })}
                    </select>
                    {requestData.gradeLevel && !loadingSections && availableSections.length === 0 && (
                      <p className="text-xs text-gray-500 mt-1">No sections found for this grade level.</p>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Relationship</label>
                    <select
                      name="relationship"
                      value={requestData.relationship}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select relationship</option>
                      <option value="parent">Parent</option>
                      <option value="guardian">Guardian</option>
                      <option value="grandparent">Grandparent</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Additional Message (Optional)</label>
                    <textarea
                      name="message"
                      value={requestData.message}
                      onChange={handleInputChange}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Any additional information..."
                    />
                  </div>
                  
                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowRequestForm(false)}
                      className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all disabled:opacity-70"
                      disabled={submitting}
                    >
                      {submitting ? 'Submitting...' : 'Submit Request'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyChildren; 