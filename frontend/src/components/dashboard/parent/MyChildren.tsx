import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { studentService, type Student } from '../../../services/studentService';
import { useNavigate } from 'react-router-dom';
import { BookOpenIcon, ChartBarIcon, MagnifyingGlassIcon, UserGroupIcon, EnvelopeIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { db } from '../../../config/firebase';
import { addDoc, collection, doc as fsDoc, getDoc, serverTimestamp, onSnapshot, query, where } from 'firebase/firestore';
import ParentLoader from '../../parent/ParentLoader';

// Local types to avoid any mock/service fallbacks
type GradeSection = { id: string; sectionName?: string; name?: string; gradeLevel?: string };
type Grade = { id: string; name?: string; sections: GradeSection[] };

const MyChildren: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [children, setChildren] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
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
  const [debugInfo, setDebugInfo] = useState<string>('');

  // Helper function to capitalize names properly
  const capitalizeName = (name: string): string => {
    return name.trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  useEffect(() => {
      if (!currentUser?.uid) return;
      setLoading(true);
    const studentsQuery = query(collection(db, studentService.getCollectionName()), where('parentId', '==', currentUser.uid));
    const unsub = onSnapshot(studentsQuery, (snap) => {
      const list: Student[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Student[];
      setChildren(list);
      setNetworkError(false);
      setLoading(false);
    }, () => {
        setChildren([]);
        setNetworkError(true);
        setLoading(false);
    });
    return () => unsub();
  }, [currentUser?.uid]);

  // Realtime grades/sections derived from classGrades collection
  useEffect(() => {
      setLoadingGrades(true);
    const unsub = onSnapshot(collection(db, 'classGrades'), (snap) => {
      console.log('📊 Loading classGrades data...', snap.docs.length, 'documents');
      const gradeLevelToSections = new Map<string, GradeSection[]>();
      snap.forEach(docSnap => {
        const data = docSnap.data() as any;
        console.log('📊 ClassGrade document:', docSnap.id, data);
        
        // Extract grade level - convert to string for consistent matching
        let gradeLevel: string | undefined = data.gradeLevel ? String(data.gradeLevel) : data.grade || data.gradeName;
        // Fallback: parse from name (e.g., "Grade 4 - Mango")
        if (!gradeLevel && data.name) {
          const match = String(data.name).match(/\d+/);
          if (match) gradeLevel = match[0];
        }
        const sectionName: string | undefined = data.section || data.sectionName || (() => {
          if (data.name && String(data.name).includes('-')) {
            const parts = String(data.name).split('-');
            return parts[parts.length - 1].trim();
          }
          return undefined;
        })();
        
        console.log('📊 Extracted - gradeLevel:', gradeLevel, 'sectionName:', sectionName);
        
        if (!gradeLevel) {
          console.log('⚠️ Skipping document - no gradeLevel found');
          return;
        }
        
        const s: GradeSection = { 
          id: docSnap.id, 
          sectionName, 
          gradeLevel,
          name: data.name // Store the full name for reference
        };
        const list = gradeLevelToSections.get(gradeLevel) || [];
        list.push(s);
        gradeLevelToSections.set(gradeLevel, list);
      });
      
      console.log('📊 GradeLevel to Sections map:', gradeLevelToSections);
      
      const grades: Grade[] = Array.from(gradeLevelToSections.entries()).map(([gradeLevel, sections]) => ({
        id: gradeLevel,
        name: `Grade ${gradeLevel}`,
        sections
      }));
      
      console.log('📊 Final grades array:', grades);
      setAvailableGrades(grades);
      setLoadingGrades(false);
    }, (error) => {
      console.error('❌ Error loading classGrades:', error);
      setAvailableGrades([]);
        setLoadingGrades(false);
    });
    return () => unsub();
  }, []);

  const grades = useMemo(() => Array.from(new Set(children.map(c => c.grade).filter(Boolean))), [children]);

  // Debounce search for smoother UX
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchInput.trim()), 250);
    return () => clearTimeout(id);
  }, [searchInput]);
  const filtered = useMemo(() => {
    const byGrade = !gradeFilter ? children : children.filter(c => c.grade === gradeFilter);
    if (!debouncedSearch) return byGrade;
    const q = debouncedSearch.toLowerCase();
    return byGrade.filter(c => (c.name || '').toLowerCase().includes(q));
  }, [children, gradeFilter, debouncedSearch]);

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.uid) {
      console.warn('You must be signed in to submit a request.');
      return;
    }
    if (!requestData.firstName.trim() || !requestData.lastName.trim()) {
      console.warn("Please enter both first name and last name.");
      return;
    }
    if (!requestData.gradeLevel || !requestData.section) {
      console.warn('Please select both grade level and section.');
      return;
    }

    try {
      setSubmitting(true);

      // Resolve selected class grade (section) to fetch teacherId and details
      const classGradeRef = fsDoc(db, 'classGrades', requestData.section);
      const classGradeSnap = await getDoc(classGradeRef);
      if (!classGradeSnap.exists()) {
        console.warn('Selected section no longer exists. Please try again.');
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
      console.error('Failed to submit your request. Please try again.');
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
  const fetchSectionsForGrade = useCallback(async (gradeId: string) => {
    setLoadingSections(true);
    try {
      console.log('🔍 Fetching sections for gradeId:', gradeId);
      console.log('🔍 Available grades:', availableGrades);
      
      // Find the selected grade and get its sections
      const selectedGrade = availableGrades.find(grade => grade.id === gradeId);
      console.log('🔍 Selected grade:', selectedGrade);
      
      if (selectedGrade && selectedGrade.sections) {
        console.log('✅ Found grade with sections:', selectedGrade.sections.length, 'sections');
        console.log('✅ Section details:', selectedGrade.sections);
        setAvailableSections(selectedGrade.sections);
        setDebugInfo(`Found ${selectedGrade.sections.length} sections for grade ${gradeId}`);
      } else {
        console.log('❌ No grade found or no sections available');
        console.log('❌ Available grades for debugging:', availableGrades.map(g => ({ id: g.id, name: g.name, sectionsCount: g.sections?.length || 0 })));
        setAvailableSections([]);
        setDebugInfo(`No grade found for ID: ${gradeId}. Available grades: ${availableGrades.map(g => g.id).join(', ')}`);
      }
    } catch (error) {
      console.error('❌ Error loading sections:', error);
      setAvailableSections([]);
      setDebugInfo(`Error: ${error}`);
    } finally {
      setLoadingSections(false);
    }
  }, [availableGrades]); // Memoize with availableGrades dependency


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
        <div className="flex items-center gap-2">
        <h3 className="text-lg font-semibold text-gray-900">My Children</h3>
          <span className="text-xs px-2 py-0.5 rounded-full border bg-gray-50 text-gray-700">{children.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <MagnifyingGlassIcon className="h-4 w-4 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by name..."
              className="pl-7 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="hidden md:flex items-center gap-2">
            <button
              type="button"
              onClick={() => setGradeFilter('')}
              className={`px-3 py-1.5 text-xs rounded-full border ${gradeFilter === '' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
              aria-pressed={gradeFilter === ''}
            >All Grades</button>
            {grades.map(g => (
              <button
                key={g}
                type="button"
                onClick={() => setGradeFilter(g as string)}
                className={`px-3 py-1.5 text-xs rounded-full border ${gradeFilter === g ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
                aria-pressed={gradeFilter === g}
              >{g}</button>
            ))}
          </div>
          <select
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            className="md:hidden px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white"
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
        <ParentLoader label="Loading your children..." />
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
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-3">
            <MagnifyingGlassIcon className="h-7 w-7 text-gray-400" />
          </div>
          <h4 className="text-base font-semibold text-gray-800 mb-1">No matches found</h4>
          <p className="text-sm text-gray-500">Try adjusting your search or grade filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(child => (
            <div key={child.id} className="group relative overflow-hidden bg-white border border-gray-200 rounded-2xl p-5 flex flex-col transition-all hover:shadow-sm">
              <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-blue-100/60 blur-2xl group-hover:scale-110 transition-transform" />
              <div className="flex items-center mb-2">
                <div className="h-12 w-12 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center text-lg font-bold text-gray-700 mr-3">
                  {child.name?.[0] || '?'}
                </div>
                <div>
                  <div className="font-semibold text-gray-900 text-lg">{child.name}</div>
                  <div className="text-xs text-gray-500">{child.grade}</div>
                </div>
              </div>
              <div className="flex flex-col gap-1 mt-2">
                <div className="text-sm flex items-center gap-2"><span className="font-medium text-gray-700">Reading Level:</span> <span className="px-2 py-0.5 rounded-full bg-gray-50 border border-gray-200 text-xs text-gray-700">{child.readingLevel || 'N/A'}</span></div>
                <div className="text-sm flex items-center gap-2"><span className="font-medium text-gray-700">Performance:</span> <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${child.performance === 'Excellent' ? 'bg-green-100 text-green-700' : child.performance === 'Good' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-800'}`}>{child.performance || '—'}</span></div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => navigate('/parent/reading-practice', { state: { childId: child.id, childName: child.name } })}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg text-white bg-blue-600 hover:bg-blue-700"
                  >
                    <BookOpenIcon className="h-4 w-4" /> Practice
                  </button>
                  <button
                    onClick={() => navigate('/parent/progress', { state: { childId: child.id } })}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg text-blue-700 bg-white border border-blue-200 hover:bg-blue-50"
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
                        
                        console.log('🎯 Grade option:', { id: grade.id, name: grade.name, sectionsCount: grade.sections?.length || 0 });
                        
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
                        
                        console.log('📚 Section option:', { 
                          id: section.id, 
                          name: section.name, 
                          sectionName: section.sectionName, 
                          gradeLevel: section.gradeLevel,
                          displayName: getSectionDisplayName()
                        });
                        
                        return (
                          <option key={section.id} value={section.id}>
                            {getSectionDisplayName()}
                          </option>
                        );
                      })}
                    </select>
                    {requestData.gradeLevel && !loadingSections && availableSections.length === 0 && (
                      <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                        <p className="text-yellow-800 font-medium">No sections found for this grade level.</p>
                        <p className="text-yellow-700 mt-1">Debug info: {debugInfo}</p>
                        <button 
                          onClick={() => {
                            console.log('🔄 Manual refresh triggered');
                            console.log('Current availableGrades:', availableGrades);
                            console.log('Current requestData.gradeLevel:', requestData.gradeLevel);
                            fetchSectionsForGrade(requestData.gradeLevel);
                          }}
                          className="mt-1 text-blue-600 hover:text-blue-800 underline"
                        >
                          Refresh sections
                        </button>
                      </div>
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