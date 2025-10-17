// This file contains admin resources functionality
// Originally based on MakeTest.tsx but now standalone
import React, { useState, useRef, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import { collection, addDoc, Timestamp, getDocs, deleteDoc, doc, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useNavigate, useLocation } from 'react-router-dom';
import Swal from 'sweetalert2';
import Loader from '../../components/Loader';
import StoriesManagement from './StoriesManagement';
import { UnifiedStoryService } from '../../services/UnifiedStoryService';
import type { Story } from '../../types/Story';
 
import { useAuth } from '../../contexts/AuthContext';
import { formatDateHuman } from '@/utils/date';

type ToggleSwitchProps = {
  checked: boolean;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  label: string;
};

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ checked, onChange, label }) => (
  <label className="flex items-center cursor-pointer select-none gap-2">
    <div className="relative">
      <input type="checkbox" checked={checked} onChange={onChange} className="sr-only peer" />
      <div className="w-11 h-6 bg-gray-200 rounded-full peer-checked:bg-green-500 transition-colors duration-200"></div>
      <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform duration-200"></div>
    </div>
    <span className="text-sm font-medium text-gray-700">{label}</span>
  </label>
);

const Resources: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'stories' | 'create' | 'templates' | 'recent'>('stories');
  const [testCategory, setTestCategory] = useState('pre');
  
  const [questions, setQuestions] = useState([
    { question: '', choices: ['', '', '', ''], correctAnswer: 0 }
  ]);
  const [randomizeAnswers, setRandomizeAnswers] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [questionDragEnabled, setQuestionDragEnabled] = useState(false);
  const [testName, setTestName] = useState('');
  const [instructions, setInstructions] = useState('');
  const [allTests, setAllTests] = useState<{id: string; [key: string]: any}[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const allSelected = allTests.length > 0 && selectedTests.length === allTests.length;
  const [selectionMode, setSelectionMode] = useState(false);
  const [deletingIds, setDeletingIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [recentTests, setRecentTests] = useState<any[]>([]);
  const [recentTestsLoading, setRecentTestsLoading] = useState(false);
  const [stories, setStories] = useState<Story[]>([]);
  const [selectedStoryId, setSelectedStoryId] = useState<string>('');

  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const instructionSuggestions = [
    "Read each question carefully and select the best answer.",
    "Choose the correct answer from the options provided.",
    "Read the passage and answer the following questions.",
    "Mark only one answer for each question.",
    "Do not leave any questions unanswered.",
    "Check your answers before submitting."
  ];

  const questionRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (questionRefs.current.length && questionRefs.current[questions.length - 1]) {
      questionRefs.current[questions.length - 1]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const input = questionRefs.current[questions.length - 1]?.querySelector('input[type="text"]') as HTMLInputElement;
      if (input) input.focus();
    }
  }, [questions.length]);

  useEffect(() => {
    if (activeTab === 'templates') {
      const fetchTests = async () => {
        setTemplatesLoading(true);
        const querySnapshot = await getDocs(collection(db, 'tests'));
        setAllTests(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setTemplatesLoading(false);
      };
      fetchTests();
    }
  }, [activeTab]);

  // Sync tab and selected story with URL params (?tab=create&storyId=...)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    const storyParam = params.get('storyId');
    if (tabParam === 'create' || tabParam === 'stories' || tabParam === 'templates' || tabParam === 'recent') {
      setActiveTab(tabParam as 'stories' | 'create' | 'templates' | 'recent');
    }
    if (storyParam) {
      setSelectedStoryId(String(storyParam));
    }
  }, [location.search]);

  // Load stories for dropdown when creating
  useEffect(() => {
    const loadStories = async () => {
      try {
        const data = await UnifiedStoryService.getInstance().getStories({});
        if (Array.isArray(data)) setStories(data);
      } catch {
        setStories([]);
      }
    };
    if (activeTab === 'create') loadStories();
  }, [activeTab]);

  


  const validateTest = () => {
    if (!testName.trim()) return 'Test name is required.';
    if (!instructions.trim()) return 'Instructions are required.';
    for (let q of questions) {
      if (!q.question.trim()) return 'All questions must have text.';
      const trimmedChoices = q.choices.map(c => c.trim());
      if (trimmedChoices.some(c => !c)) return 'All choices must have text.';
      const unique = new Set(trimmedChoices);
      if (unique.size < trimmedChoices.length) return 'Choices must be unique.';
    }
    return null;
  };

  const saveTestToFirestore = async () => {
    const testData = {
      testCategory,
      storyId: selectedStoryId || null,
      questions,
      testName,
      instructions,
      createdAt: Timestamp.now(),
    };
    try {
      await addDoc(collection(db, 'tests'), testData);
    } catch (error: any) {
      console.error('Error saving test: ', error.message);
    }
  };

  const handleCreateTest = async () => {
    const error = validateTest();
    setValidationError(error);
    if (error) return;
    // Enforce one test per story
    if (selectedStoryId) {
      const existing = await getDocs(query(collection(db, 'tests'), where('storyId', '==', selectedStoryId)));
      if (!existing.empty) {
        await Swal.fire({ icon: 'warning', title: 'Test already exists', text: 'Only one test is allowed per story. Please edit or delete the existing test.' });
        return;
      }
    }
    setIsDeleting(true);
    setDeletingIds(prev => [...prev, testName]);
    try {
      await saveTestToFirestore();
      await Swal.fire({
        icon: 'success',
        title: 'Test Created!',
        text: `Successfully created ${testName}`,
        timer: 2000,
        showConfirmButton: false
      });
      setActiveTab('templates');
    } finally {
      setIsDeleting(false);
      setDeletingIds(prev => prev.filter(id => id !== testName));
    }
  };

  const handleTemplateSelection = async (template: {id: string; [key: string]: any}) => {
    if (!currentUser?.uid) return;
    // Navigate directly to the AdminViewTest (view-only for admin)
    navigate(`/admin/test/${template.id}`, {
      state: { 
        testName: template.testName || 'Untitled Test'
      }
    });
  };

  



  const handleQuestionChange = (index: number, value: string) => {
    const updated = [...questions];
    updated[index].question = value;
    setQuestions(updated);
  };

  const handleChoiceChange = (qIdx: number, cIdx: number, value: string) => {
    const updated = [...questions];
    updated[qIdx].choices[cIdx] = value;
    setQuestions(updated);
  };

  const handleCorrectAnswerChange = (qIdx: number, value: number) => {
    const updated = [...questions];
    updated[qIdx].correctAnswer = value;
    setQuestions(updated);
  };

  const addQuestion = () => {
    setQuestions([...questions, { question: '', choices: ['', '', '', ''], correctAnswer: 0 }]);
  };

  const removeQuestion = (index: number) => {
    if (questions.length > 1) {
      setQuestions(questions.filter((_, i) => i !== index));
    }
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const reordered = Array.from(questions);
    const [removed] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, removed);
    setQuestions(reordered);
  };

  const handleChoiceDragEnd = (qIdx: number, result: DropResult) => {
    if (!result.destination) return;
    const updated = [...questions];
    const choices = Array.from(updated[qIdx].choices);
    const [removed] = choices.splice(result.source.index, 1);
    choices.splice(result.destination.index, 0, removed);
    updated[qIdx].choices = choices;
    if (updated[qIdx].correctAnswer === result.source.index) {
      updated[qIdx].correctAnswer = result.destination.index;
    } else if (updated[qIdx].correctAnswer > result.source.index && updated[qIdx].correctAnswer <= result.destination.index) {
      updated[qIdx].correctAnswer -= 1;
    } else if (updated[qIdx].correctAnswer < result.source.index && updated[qIdx].correctAnswer >= result.destination.index) {
      updated[qIdx].correctAnswer += 1;
    }
    setQuestions(updated);
  };

  const handleInstructionSuggestion = (suggestion: string) => {
    setInstructions(suggestion);
  };

  const handleSingleDelete = async (testId: string, testName: string) => {
    setIsDeleting(true);
    setDeletingIds(prev => [...prev, testId]);
    try {
      await deleteDoc(doc(db, 'tests', testId));
      await Swal.fire({
        icon: 'success',
        title: 'Deleted!',
        text: `${testName} has been deleted.`,
        timer: 1800,
        showConfirmButton: false
      });
      setAllTests(prev => prev.filter(t => t.id !== testId));
    } finally {
      setIsDeleting(false);
      setDeletingIds(prev => prev.filter(id => id !== testId));
    }
  };

  const handleBulkDelete = async () => {
    const result = await Swal.fire({
      icon: 'error',
      title: '<span style="color:#dc2626">Delete Selected Tests?</span>',
      text: `Are you sure you want to delete ${selectedTests.length} test(s)? This action cannot be undone.`,
      showCancelButton: true,
      confirmButtonText: 'Delete',
      confirmButtonColor: '#dc2626',
      cancelButtonText: 'Cancel',
      focusCancel: true,
      customClass: {
        popup: 'border-2 border-red-200 shadow-lg',
        title: 'text-red-600 font-bold',
        confirmButton: 'bg-red-600 text-white',
        cancelButton: 'bg-white text-gray-700'
      },
      background: '#fff5f5'
    });
    if (result.isConfirmed) {
      setIsDeleting(true);
      const deletedTests = allTests.filter(t => selectedTests.includes(t.id));
      try {
        await Promise.all(deletedTests.map(t => deleteDoc(doc(db, 'tests', t.id))));
        setAllTests(prev => prev.filter(t => !selectedTests.includes(t.id)));
        setSelectedTests([]);
        await Swal.fire({
          icon: 'success',
          title: 'Deleted!',
          text: 'Selected tests have been deleted.',
          timer: 1800,
          showConfirmButton: false
        });
      } finally {
        setIsDeleting(false);
      }
    }
  };

  useEffect(() => {
    const fetchRecentTests = async () => {
      if (!currentUser?.uid) return;
      setRecentTestsLoading(true);
      try {
        const q = query(
          collection(db, 'results'),
          where('teacherId', '==', currentUser.uid),
          where('type', '==', 'test'),
          orderBy('createdAt', 'desc')
        );
        const querySnapshot = await getDocs(q);
        type TestResult = { id: string; createdAt?: any; [key: string]: any };
        const allTestResults: TestResult[] = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const getDate = (val: any) =>
          val && typeof val.toDate === 'function'
            ? val.toDate()
            : val
              ? new Date(val)
              : new Date(0);
        const sorted = allTestResults
          .sort((a, b) => {
            const dateA = getDate(a.createdAt);
            const dateB = getDate(b.createdAt);
            return dateB - dateA;
          })
          .slice(0, 10);
        setRecentTests(sorted);
      } catch (error) {
        console.error('Error fetching recent tests:', error);
        setRecentTests([]);
      } finally {
        setRecentTestsLoading(false);
      }
    };
    if (activeTab === 'recent') {
      fetchRecentTests();
    }
  }, [activeTab, currentUser?.uid]);

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Resources</h1>
            <p className="text-gray-600 mt-1">Create and manage reading assessments for your students</p>
          </div>
        </div>
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button onClick={() => setActiveTab('stories')} className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'stories' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Stories</button>
            <button onClick={() => setActiveTab('create')} className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'create' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Create Test</button>
            <button onClick={() => setActiveTab('templates')} className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'templates' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Test Templates</button>
            <button onClick={() => setActiveTab('recent')} className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'recent' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Recent Tests</button>
          </nav>
        </div>

        {activeTab === 'stories' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <StoriesManagement />
            </div>
          </div>
        )}
        {activeTab === 'create' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Create New Assessment</h2>
               <div className="grid grid-cols-1 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Test Category</label>
                  <select value={testCategory} onChange={(e) => setTestCategory(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    <option value="pre">Pre-Test</option>
                    <option value="post">Post-Test</option>
                  </select>
                </div>
              </div>
              
              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Story</label>
                <select value={selectedStoryId} onChange={(e) => setSelectedStoryId(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                  <option value="">Select a story...</option>
                  {stories.map((s) => (
                    <option key={String((s as any)._id)} value={String((s as any)._id)}>{s.title}</option>
                  ))}
                </select>
              </div>
              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Test Name</label>
                <input type="text" placeholder="Enter test name..." className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={testName} onChange={e => setTestName(e.target.value)} />
              </div>
              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Instructions</label>
                <div className="mb-3">
                  <span className="text-xs text-gray-500 block mb-1">Quick instructions:</span>
                  <div className="flex flex-wrap gap-2">
                    {instructionSuggestions.map((s, i) => (
                      <button key={i} type="button" className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium border border-blue-200 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors" style={{ whiteSpace: 'nowrap' }} aria-label={`Add instruction: ${s}`} title={s} onClick={() => handleInstructionSuggestion(s)}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea rows={4} placeholder="Enter test instructions..." className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={instructions} onChange={e => setInstructions(e.target.value)} />
              </div>
              <div className="mt-8">
                <h3 className="text-md font-semibold text-gray-800 mb-4">Questions</h3>
                <div className="flex items-center gap-8 mb-4">
                  <ToggleSwitch checked={questionDragEnabled} onChange={() => setQuestionDragEnabled(v => !v)} label="Reorder Questions (Drag & Drop)" />
                  <ToggleSwitch checked={randomizeAnswers} onChange={() => setRandomizeAnswers(v => !v)} label="Randomize Answer Order for Students" />
                </div>
                {validationError && <div className="text-red-600 mb-2">{validationError}</div>}
                <>
                  {questionDragEnabled ? (
                    <DragDropContext onDragEnd={onDragEnd}>
                      <Droppable droppableId="questions-droppable">
                        {(provided) => (
                          <div ref={provided.innerRef} {...provided.droppableProps}>
                            {questions.map((q, qIdx) => (
                              <Draggable key={qIdx} draggableId={`question-${qIdx}`} index={qIdx}>
                                {(dragProvided, dragSnapshot) => (
                                  <div ref={el => { dragProvided.innerRef(el); questionRefs.current[qIdx] = el; }} {...dragProvided.draggableProps} {...dragProvided.dragHandleProps} className={`mb-8 p-6 border rounded-xl bg-white shadow-sm hover:shadow-lg transition-shadow relative group ${dragSnapshot.isDragging ? 'ring-2 ring-blue-300' : ''}`}>
                                    <div className="flex justify-between items-center mb-3">
                                      <div className="flex items-center gap-2">
                                        <span className="cursor-move text-gray-400" title="Drag to reorder">
                                          <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><circle cx="5" cy="7" r="1.5"/><circle cx="5" cy="12" r="1.5"/><circle cx="5" cy="17" r="1.5"/><circle cx="12" cy="7" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="17" r="1.5"/><circle cx="19" cy="7" r="1.5"/><circle cx="19" cy="12" r="1.5"/><circle cx="19" cy="17" r="1.5"/></svg>
                                        </span>
                                        <label className="block text-base font-semibold text-gray-700">Question {qIdx + 1}</label>
                                      </div>
                                      {questions.length > 1 && (
                                        <button type="button" onClick={() => removeQuestion(qIdx)} className="text-red-500 text-xs px-2 py-1 rounded hover:bg-red-50" title="Remove this question" aria-label="Remove question">Remove</button>
                                      )}
                                    </div>
                                    <input type="text" value={q.question} onChange={e => handleQuestionChange(qIdx, e.target.value)} placeholder="Enter question text..." className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-2 focus:ring-2 focus:ring-blue-200" aria-label={`Question ${qIdx + 1} text`} />
                                    <div className="text-xs text-gray-500 mb-3">E.g., What is the main idea of the passage?</div>
                                    {questionDragEnabled ? (
                                      <DragDropContext onDragEnd={result => handleChoiceDragEnd(qIdx, result)}>
                                        <Droppable droppableId={`choices-droppable-${qIdx}`} direction="vertical">
                                          {(provided) => (
                                            <div ref={provided.innerRef} {...provided.droppableProps} className="flex flex-col gap-4 mb-2 w-full">
                                              {q.choices.map((choice, cIdx) => (
                                                <Draggable key={cIdx} draggableId={`choice-${qIdx}-${cIdx}`} index={cIdx}>
                                                  {(dragProvided) => (
                                                    <label ref={dragProvided ? dragProvided.innerRef : undefined} {...(dragProvided ? dragProvided.draggableProps : {})} {...(dragProvided ? dragProvided.dragHandleProps : {})} className={`flex items-center gap-2 border rounded-lg px-4 py-3 transition-colors relative group select-none w-full ${q.correctAnswer === cIdx ? 'border-blue-600 bg-blue-50 shadow-sm' : 'border-gray-200 bg-gray-50 hover:border-blue-300'}`} style={{ minHeight: '56px' }}>
                                                      <span className={`flex items-center justify-center font-bold w-8 h-8 rounded-full text-white text-base ${q.correctAnswer === cIdx ? 'bg-blue-600' : 'bg-gray-400 group-hover:bg-blue-400'}`}>{String.fromCharCode(65 + cIdx)}</span>
                                                      <input type="text" value={choice} onChange={e => handleChoiceChange(qIdx, cIdx, e.target.value)} placeholder={`Enter choice ${String.fromCharCode(65 + cIdx)}...`} className="w-full border-none bg-transparent focus:outline-none text-base" aria-label={`Choice ${String.fromCharCode(65 + cIdx)} for question ${qIdx + 1}`} />
                                                      <input type="radio" name={`correct-answer-${qIdx}`} checked={q.correctAnswer === cIdx} onChange={() => handleCorrectAnswerChange(qIdx, cIdx)} className="form-radio text-green-600 w-5 h-5 ml-2 accent-green-600 cursor-pointer" aria-label={`Mark choice ${String.fromCharCode(65 + cIdx)} as correct for question ${qIdx + 1}`} />
                                                      {q.correctAnswer === cIdx && (<span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600"><svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg></span>)}
                                                    </label>
                                                  )}
                                                </Draggable>
                                              ))}
                                              {provided.placeholder}
                                            </div>
                                          )}
                                        </Droppable>
                                      </DragDropContext>
                                    ) : (
                                      <div className="flex flex-col gap-4 mb-2 w-full">
                                        {q.choices.map((choice, cIdx) => (
                                          <label key={cIdx} className={`flex items-center gap-2 border rounded-lg px-4 py-3 transition-colors relative group select-none w-full ${q.correctAnswer === cIdx ? 'border-blue-600 bg-blue-50 shadow-sm' : 'border-gray-200 bg-gray-50 hover;border-blue-300'}`} style={{ minHeight: '56px' }}>
                                            <span className={`flex items-center justify-center font-bold w-8 h-8 rounded-full text-white text-base ${q.correctAnswer === cIdx ? 'bg-blue-600' : 'bg-gray-400 group-hover:bg-blue-400'}`}>{String.fromCharCode(65 + cIdx)}</span>
                                            <input type="text" value={choice} onChange={e => handleChoiceChange(qIdx, cIdx, e.target.value)} placeholder={`Enter choice ${String.fromCharCode(65 + cIdx)}...`} className="w-full border-none bg-transparent focus:outline-none text-base" aria-label={`Choice ${String.fromCharCode(65 + cIdx)} for question ${qIdx + 1}`} />
                                            <input type="radio" name={`correct-answer-${qIdx}`} checked={q.correctAnswer === cIdx} onChange={() => handleCorrectAnswerChange(qIdx, cIdx)} className="form-radio text-green-600 w-5 h-5 ml-2 accent-green-600 cursor-pointer" aria-label={`Mark choice ${String.fromCharCode(65 + cIdx)} as correct for question ${qIdx + 1}`} />
                                            {q.correctAnswer === cIdx && (<span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600"><svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg></span>)}
                                          </label>
                                        ))}
                                      </div>
                                    )}
                                    <div className="text-xs text-gray-500 mb-1">Select the correct answer by clicking the circle on the right.</div>
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </DragDropContext>
                  ) : (
                    <div>
                      {questions.map((q, qIdx) => (
                        <div key={qIdx} className="mb-8 p-6 border rounded-xl bg-white shadow-sm hover:shadow-lg transition-shadow relative group">
                          <div className="flex justify-between items-center mb-3">
                            <div className="flex items-center gap-2">
                              <label className="block text-base font-semibold text-gray-700">Question {qIdx + 1}</label>
                            </div>
                            {questions.length > 1 && (
                              <button type="button" onClick={() => removeQuestion(qIdx)} className="text-red-500 text-xs px-2 py-1 rounded hover:bg-red-50" title="Remove this question" aria-label="Remove question">Remove</button>
                            )}
                          </div>
                          <input type="text" value={q.question} onChange={e => handleQuestionChange(qIdx, e.target.value)} placeholder="Enter question text..." className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-2 focus:ring-2 focus:ring-blue-200" aria-label={`Question ${qIdx + 1} text`} />
                          <div className="text-xs text-gray-500 mb-3">E.g., What is the main idea of the passage?</div>
                          <div className="flex flex-col gap-4 mb-2 w-full">
                            {q.choices.map((choice, cIdx) => (
                              <label key={cIdx} className={`flex items-center gap-2 border rounded-lg px-4 py-3 transition-colors relative group select-none w-full ${q.correctAnswer === cIdx ? 'border-blue-600 bg-blue-50 shadow-sm' : 'border-gray-200 bg-gray-50 hover:border-blue-300'}`} style={{ minHeight: '56px' }}>
                                <span className={`flex items-center justify-center font-bold w-8 h-8 rounded-full text-white text-base ${q.correctAnswer === cIdx ? 'bg-blue-600' : 'bg-gray-400 group-hover:bg-blue-400'}`}>{String.fromCharCode(65 + cIdx)}</span>
                                <input type="text" value={choice} onChange={e => handleChoiceChange(qIdx, cIdx, e.target.value)} placeholder={`Enter choice ${String.fromCharCode(65 + cIdx)}...`} className="w-full border-none bg-transparent focus:outline-none text-base" aria-label={`Choice ${String.fromCharCode(65 + cIdx)} for question ${qIdx + 1}`} />
                                <input type="radio" name={`correct-answer-${qIdx}`} checked={q.correctAnswer === cIdx} onChange={() => handleCorrectAnswerChange(qIdx, cIdx)} className="form-radio text-green-600 w-5 h-5 ml-2 accent-green-600 cursor-pointer" aria-label={`Mark choice ${String.fromCharCode(65 + cIdx)} as correct for question ${qIdx + 1}`} />
                                {q.correctAnswer === cIdx && (<span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600"><svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg></span>)}
                              </label>
                            ))}
                          </div>
                          <div className="text-xs text-gray-500 mb-1">Select the correct answer by clicking the circle on the right.</div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
                <button type="button" onClick={addQuestion} className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg mt-2">Add Question</button>
              </div>
              <div className="mt-10 flex justify-center">
                <button onClick={handleCreateTest} className="w-full max-w-md bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 focus:outline-none text-white font-bold px-10 py-4 rounded-2xl shadow-2xl transition-all duration-200 text-xl tracking-wide">Create Test</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'templates' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Test Templates</h2>
              {!selectionMode && allTests.length > 0 && (
                <button onClick={() => setSelectionMode(true)} className="flex items-center justify-center w-10 h-10 rounded-full border border-gray-300 text-gray-700 hover:bg-blue-50 hover:text-blue-600 shadow-sm transition-all duration-150" title="Edit tests" aria-label="Edit tests">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 3.487a2.25 2.25 0 113.182 3.182L7.125 19.586a2.25 2.25 0 01-1.06.561l-4.125.825.825-4.125a2.25 2.25 0 01.561-1.06L16.862 3.487z" /></svg>
                </button>
              )}
            </div>
            {selectionMode && allTests.length > 0 && (
              <div className="flex items-center mb-4 gap-4">
                <input type="checkbox" checked={allSelected} onChange={e => setSelectedTests(e.target.checked ? allTests.map(t => t.id) : [])} className="w-5 h-5 rounded-full border-2 border-gray-400 checked:bg-blue-600 checked;border-blue-600 focus:ring-2 focus:ring-blue-400 appearance-none relative before:content-[''] before:absolute before:inset-0 before:rounded-full before:bg-blue-600 before:opacity-0 checked:before:opacity-100 after:content-['✓'] after:absolute after:inset-0 after:flex after:items-center after:justify-center after:text-white after:opacity-0 checked:after:opacity-100" aria-label="Select all tests" />
                <span className="text-sm">Select All</span>
                <button onClick={() => { setSelectionMode(false); setSelectedTests([]); }} className="ml-4 text-gray-500 hover:underline">Cancel</button>
              </div>
            )}
            {templatesLoading ? (
              <Loader label="Loading templates..." />
            ) : allTests.length === 0 ? (
              <div>No test templates found.</div>
            ) : (
              <div className="grid gap-4">
                {allTests.map((template) => (
                  <div key={template.id} className={`group bg-white rounded-lg shadow-sm border border-gray-200 p-6 transition-all duration-300 ease-in-out opacity-100`}>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                      {selectionMode && (
                        <input type="checkbox" checked={selectedTests.includes(template.id)} onChange={e => { setSelectedTests(prev => e.target.checked ? [...prev, template.id] : prev.filter(id => id !== template.id)); }} className="w-5 h-5 rounded-full border-2 border-gray-400 checked:bg-blue-600 checked:border-blue-600 focus:ring-2 focus:ring-blue-400 appearance-none relative before:content-[''] before:absolute before:inset-0 before:rounded-full before:bg-blue-600 before:opacity-0 checked:before:opacity-100 after:content-['✓'] after:absolute after:inset-0 after:flex after:items-center after:justify-center after:text-white after:opacity-0 checked:after:opacity-100 mr-2" aria-label="Select test" />
                      )}
                      <div className="flex-1">
                        <h3 className="text-lg font-medium text-gray-900">{template.testName || 'Untitled Test'}</h3>
                        <div className="mt-2 space-y-1 text-sm text-gray-600">
                          <div className="flex items-center space-x-4">
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{template.testCategory ? template.testCategory.charAt(0).toUpperCase() + template.testCategory.slice(1) : 'N/A'}</span>
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">{template.selectedLevel || 'N/A'}</span>
                          </div>
                          <p><i className="fas fa-question-circle mr-2"></i>{template.questions?.length || 0} questions</p>
                          <p><i className="fas fa-calendar mr-2"></i>Created: {template.createdAt?.toDate ? formatDateHuman(template.createdAt.toDate()) : 'N/A'}</p>
                        </div>
                      </div>
                      <div className="mt-4 sm:mt-0 flex flex-col sm:flex-row gap-2">
                        <button onClick={() => handleTemplateSelection(template)} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white px-4 py-2 rounded-lg shadow-sm transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-green-400" aria-label="Use this test template">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75A2.25 2.25 0 0014.25 4.5h-4.5A2.25 2.25 0 007.5 6.75v10.5A2.25 2.25 0 009.75 19.5h4.5A2.25 2.25 0 0016.5 17.25V13.5" /><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 12.75l7.5-7.5" /></svg>
                          Use Template
                        </button>
                        {selectionMode && (
                          <div className="flex items-center">
                            <button onClick={() => handleSingleDelete(template.id, template.testName || 'Untitled Test')} className="ml-2 p-2 rounded-full hover:bg-red-50 transition-colors group-hover:opacity-100 group-hover:pointer-events-auto focus:opacity-100 focus:pointer-events-auto" title="Delete" aria-label="Delete test" tabIndex={0} disabled={deletingIds.includes(template.id)}>
                              {deletingIds.includes(template.id) ? (
                                <svg className="animate-spin h-5 w-5 text-red-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-red-600"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {selectionMode && (
              <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white border border-gray-300 shadow-lg rounded-lg px-6 py-3 flex items-center gap-4 z-50 animate-fade-in">
                <span>{selectedTests.length > 0 ? `${selectedTests.length} selected` : 'Select tests to delete'}</span>
                <button onClick={handleBulkDelete} disabled={selectedTests.length === 0 || isDeleting} className={`flex items-center gap-2 border px-4 py-2 rounded-lg shadow-sm transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-red-400 ${selectedTests.length === 0 || isDeleting ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : 'border-red-600 text-red-600 hover:bg-red-50 active:bg-red-100'}`} aria-label="Delete selected tests">
                  {isDeleting ? (<svg className="animate-spin h-5 w-5 text-red-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>) : (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>)}
                  Delete
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'recent' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Tests</h2>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              {recentTestsLoading ? (
                <Loader label="Loading recent tests..." />
              ) : recentTests.length === 0 ? (
                <div className="p-6 text-gray-500">No recent tests found.</div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Test Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {recentTests.map((test, idx) => (
                      <tr key={test.id || idx} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm font-medium text-gray-900">{test.testName || 'Untitled Test'}</div></td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{test.studentName || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{test.createdAt?.toDate ? formatDateHuman(test.createdAt.toDate()) : '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap"><span className={`px-2 py-1 text-xs font-medium rounded-full ${test.score !== undefined ? (test.score >= 80 ? 'bg-green-100 text-green-800' : test.score >= 50 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800') : 'bg-gray-100 text-gray-800'}`}>{test.score !== undefined ? (test.score >= 80 ? 'Completed' : test.score >= 50 ? 'Partial' : 'Needs Review') : 'N/A'}</span></td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{test.score !== undefined ? `${test.score}%` : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default Resources;
