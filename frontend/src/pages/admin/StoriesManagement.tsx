import { useState, useEffect } from 'react';
import { UnifiedStoryService } from '../../services/UnifiedStoryService';
import Swal from 'sweetalert2';
import { collection, doc, getDoc, getDocs, query, where, deleteDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useNavigate } from 'react-router-dom';
import type { Story } from '../../types/Story';
import AddStoryModal from './AddStoryModal';
import { useAuth } from '../../contexts/AuthContext';

interface StoryFilters {
  language?: string;
  searchTerm?: string;
  set?: string;
}

export default function StoriesManagement() {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addToSet, setAddToSet] = useState<'A' | 'B' | 'C' | 'D' | null>(null);
  const [editingStory, setEditingStory] = useState<Story | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'sets'>('sets');
  const [filters, setFilters] = useState<StoryFilters>({
    language: '',
    set: ''
  });
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [storyIdToTests, setStoryIdToTests] = useState<Record<string, { id: string; testName: string; questionsCount: number }[]>>({});
  const [viewTest, setViewTest] = useState<{ id: string; testName: string; questions?: any[] } | null>(null);

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (viewTest) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [viewTest]);

  // Helper function to convert stored language codes to display names
  const getDisplayLanguage = (language: string | undefined): string => {
    console.log('getDisplayLanguage called with:', language, 'type:', typeof language);
    if (!language) return '';
    switch (language) {
      case 'en':
        console.log('Converting en to English');
        return 'English';
      case 'none':
        console.log('Converting none to Tagalog');
        return 'Tagalog';
      default:
        console.log('Returning default language:', language);
        return language;
    }
  };

  useEffect(() => {
    loadStories();
  }, [filters]);

  const loadStories = async () => {
    try {
      setLoading(true);
      const filterParams: any = {};
      if (filters.language) filterParams.language = filters.language;
      if (filters.set) filterParams.set = filters.set;
      
      const storiesData = await UnifiedStoryService.getInstance().getStories(filterParams);
      console.log('API /api/stories response:', storiesData);
      if (!Array.isArray(storiesData)) {
        console.error('API did not return an array:', storiesData);
        setStories([]);
      } else {
        // Client-side filtering for set if backend doesn't support it yet
        let filteredStories = storiesData;
        if (filters.set) {
          filteredStories = storiesData.filter(story => story.set === filters.set);
        }
        setStories(filteredStories);
      }
    } catch (error) {
      console.error('Error loading stories:', error);
      Swal.fire('Error', 'Failed to load stories', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddStory = async (storyData: Partial<Story>, file: File) => {
    try {
      if (!currentUser?.uid) {
        Swal.fire('Error', 'You must be logged in to add a story', 'error');
        return;
      }
      if (!storyData.title?.trim() || !storyData.description?.trim()) {
        Swal.fire('Error', 'Please fill in all required fields', 'error');
        return;
      }
      if (!file || file.type !== 'application/pdf') {
        Swal.fire('Error', 'Please upload a valid PDF file', 'error');
        return;
      }
      
      // Check if the set already has a story (each set can only have ONE story)
      if (storyData.set && groupedStories[storyData.set]) {
        const result = await Swal.fire({
          title: `Set ${storyData.set} already has a story`,
          text: `Set ${storyData.set} already contains "${groupedStories[storyData.set].title}". Each set can only have one story. Do you want to replace it?`,
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#d33',
          cancelButtonColor: '#3085d6',
          confirmButtonText: 'Replace Story',
          cancelButtonText: 'Cancel'
        });
        
        if (!result.isConfirmed) {
          return;
        }
        
        // Delete the existing story in this set
        await UnifiedStoryService.getInstance().deleteStory(groupedStories[storyData.set]._id!);
      }
      
      await UnifiedStoryService.getInstance().createStory(storyData, file);
      setShowAddModal(false);
      setAddToSet(null);
      await loadStories();
      Swal.fire('Success', 'Story added successfully', 'success');
    } catch (error) {
      console.error('Error adding story:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to add story';
      Swal.fire('Error', errorMessage, 'error');
    }
  };

  const handleEditStory = async (story: Story) => {
    try {
      if (!story._id) return;
      if (!story.title || !story.description || !story.grade) {
        Swal.fire('Error', 'Please fill in all required fields', 'error');
        return;
      }
      
      // Convert language values for database storage
      const storyToUpdate = {
        ...story,
        language: story.language === 'tagalog' ? 'none' : story.language === 'english' ? 'en' : story.language
      };
      
      await UnifiedStoryService.getInstance().updateStory(story._id, storyToUpdate);
      await loadStories();
      setEditingStory(null);
      Swal.fire('Success', 'Story updated successfully', 'success');
    } catch (error) {
      console.error('Error updating story:', error);
      Swal.fire('Error', 'Failed to update story', 'error');
    }
  };

  const handleDeleteStory = async (id: string) => {
    try {
      const result = await Swal.fire({
        title: 'Are you sure?',
        text: "You won't be able to revert this!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Yes, delete it!'
      });
      if (result.isConfirmed) {
        await UnifiedStoryService.getInstance().deleteStory(id);
        await loadStories();
        Swal.fire('Deleted!', 'Story has been deleted.', 'success');
      }
    } catch (error) {
      console.error('Error deleting story:', error);
      Swal.fire('Error', 'Failed to delete story', 'error');
    }
  };

  // After stories load, fetch tests per story
  useEffect(() => {
    const loadTestsByStory = async () => {
      const mapping: Record<string, { id: string; testName: string; questionsCount: number }[]> = {};
      if (Array.isArray(stories)) {
        for (const s of stories) {
          if (!s._id) continue;
          const q = query(collection(db, 'tests'), where('storyId', '==', String(s._id)));
          const snap = await getDocs(q);
          mapping[String(s._id)] = snap.docs.map(d => ({ id: d.id, testName: String((d.data() as any).testName || 'Untitled Test'), questionsCount: Array.isArray((d.data() as any).questions) ? (d.data() as any).questions.length : 0 }));
        }
      }
      setStoryIdToTests(mapping);
    };
    if (Array.isArray(stories) && stories.length) loadTestsByStory();
  }, [stories]);

  const handleOpenViewTest = async (testId: string) => {
    try {
      const ref = doc(db, 'tests', testId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() as any;
        setViewTest({ id: snap.id, testName: String(data.testName || 'Untitled Test'), questions: Array.isArray(data.questions) ? data.questions : [] });
      }
    } catch (e) {
      // ignore for now
    }
  };

  const handleDeleteTest = async (testId: string) => {
    try {
      const result = await Swal.fire({
        title: 'Delete this test?',
        text: 'This action cannot be undone.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Delete'
      });
      if (!result.isConfirmed) return;
      await deleteDoc(doc(db, 'tests', testId));
      // Refresh mapping after deletion
      const mapping: Record<string, { id: string; testName: string; questionsCount: number }[]> = {};
      if (Array.isArray(stories)) {
        for (const s of stories) {
          if (!s._id) continue;
          const q = query(collection(db, 'tests'), where('storyId', '==', String(s._id)));
          const snap = await getDocs(q);
          mapping[String(s._id)] = snap.docs.map(d => ({ id: d.id, testName: String((d.data() as any).testName || 'Untitled Test'), questionsCount: Array.isArray((d.data() as any).questions) ? (d.data() as any).questions.length : 0 }));
        }
      }
      setStoryIdToTests(mapping);
      Swal.fire('Deleted', 'Test has been deleted.', 'success');
    } catch (e) {
      Swal.fire('Error', 'Failed to delete test', 'error');
    }
  };

  // Group stories by set - each set should have only ONE story
  const groupedStories = Array.isArray(stories) ? stories.reduce((acc, story) => {
    const set = story.set || 'A';
    acc[set] = story; // Only one story per set
    return acc;
  }, {} as Record<string, Story>) : {};



  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Stories Management</h1>
          {viewMode === 'sets' && (
            <p className="text-sm text-gray-600 mt-1">
              Each set contains exactly one story and one quiz for ISR assessment
            </p>
          )}
        </div>
        <div className="flex gap-3">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('sets')}
              className={`px-3 py-1 rounded text-sm ${
                viewMode === 'sets' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Sets View
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 rounded text-sm ${
                viewMode === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              List View
            </button>
          </div>
          <button
            onClick={() => {
              setAddToSet(null);
              setShowAddModal(true);
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Add New Story
          </button>
        </div>
      </div>

      <div className="mb-6 flex gap-4">
        <select
          value={filters.language}
          onChange={(e) => setFilters({ ...filters, language: e.target.value })}
          className="border rounded-lg px-4 py-2"
        >
          <option value="">All Languages</option>
          <option value="english">English</option>
          <option value="tagalog">Tagalog</option>
        </select>
        
        {viewMode === 'list' && (
          <select
            value={filters.set}
            onChange={(e) => setFilters({ ...filters, set: e.target.value })}
            className="border rounded-lg px-4 py-2"
          >
            <option value="">All Sets</option>
            <option value="A">Set A</option>
            <option value="B">Set B</option>
            <option value="C">Set C</option>
            <option value="D">Set D</option>
          </select>
        )}
      </div>

      {loading ? (
        <div className="text-center py-4">Loading...</div>
      ) : viewMode === 'sets' ? (
        // Sets View - Each set contains exactly ONE story and ONE quiz
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {['A', 'B', 'C', 'D'].map(setLetter => {
            const setStory = groupedStories[setLetter];
            const hasStory = !!setStory;
            const tests = setStory ? (storyIdToTests[String(setStory._id)] || []) : [];
            const hasTest = tests.length > 0;
            const isComplete = hasStory && hasTest;
            
            return (
              <div key={setLetter} className={`bg-white rounded-xl border-2 p-6 transition-all hover:shadow-lg ${
                isComplete ? 'border-green-200 hover:border-green-300' : 
                hasStory ? 'border-yellow-200 hover:border-yellow-300' : 
                'border-gray-200 hover:border-gray-300'
              }`}>
                {/* Set Header */}
                <div className="text-center mb-4">
                  <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center text-2xl font-bold mb-3 ${
                    isComplete ? 'bg-green-100 text-green-700' :
                    hasStory ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-500'
                  }`}>
                    {setLetter}
                  </div>
                  <h3 className="text-xl font-bold text-gray-800">Set {setLetter}</h3>
                  <div className="flex justify-center gap-2 mt-2">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      hasStory ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {hasStory ? '✓' : '○'} Story
                    </span>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      hasTest ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {hasTest ? '✓' : '○'} Quiz
                    </span>
                  </div>
                </div>

                {/* Set Content */}
                {hasStory ? (
                  <div className="space-y-3">
                    {/* Story Info */}
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <h4 className="font-medium text-gray-900 text-sm truncate" title={setStory.title}>
                            📖 {setStory.title}
                          </h4>
                          <p className="text-xs text-gray-600 mt-1">
                            Grade {setStory.grade} • {getDisplayLanguage(setStory.language)}
                          </p>
                        </div>
                        <div className="flex gap-1 ml-2">
                          <button
                            onClick={() => setEditingStory(setStory)}
                            className="text-blue-600 hover:text-blue-800 text-xs px-1"
                            title="Edit story"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => setStory._id && handleDeleteStory(setStory._id)}
                            className="text-red-600 hover:text-red-800 text-xs px-1"
                            title="Delete story"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Quiz Info */}
                    {hasTest ? (
                      <div className="bg-green-50 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <h4 className="font-medium text-green-900 text-sm">
                              🧩 {tests[0].testName}
                            </h4>
                            <p className="text-xs text-green-700 mt-1">
                              {tests[0].questionsCount} questions
                            </p>
                          </div>
                          <div className="flex gap-1 ml-2">
                            <button
                              onClick={() => handleOpenViewTest(tests[0].id)}
                              className="text-green-600 hover:text-green-800 text-xs px-1"
                              title="View quiz"
                            >
                              👁️
                            </button>
                            <button
                              onClick={() => handleDeleteTest(tests[0].id)}
                              className="text-red-600 hover:text-red-800 text-xs px-1"
                              title="Delete quiz"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-yellow-50 rounded-lg p-3 text-center">
                        <p className="text-yellow-700 text-sm mb-2">Quiz needed</p>
                        <button
                          onClick={() => navigate(`/admin/resources?tab=create&storyId=${String(setStory._id || '')}`)}
                          className="bg-yellow-600 text-white py-1.5 px-3 rounded text-xs hover:bg-yellow-700"
                        >
                          Create Quiz
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <div className="text-4xl mb-3">📚</div>
                    <p className="text-gray-500 text-sm mb-4">Empty set</p>
                    <button
                      onClick={() => {
                        setAddToSet(setLetter as 'A' | 'B' | 'C' | 'D');
                        setShowAddModal(true);
                      }}
                      className="bg-blue-600 text-white py-2 px-4 rounded-lg text-sm hover:bg-blue-700 transition-colors"
                    >
                      Add Story
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        // List View - Original detailed view
        <div className="grid gap-6">
          {Array.isArray(stories) && stories.length === 0 ? (
            <div className="text-center text-gray-500 py-10">No stories available.</div>
          ) : (
            (Array.isArray(stories) ? stories : []).map((story) => (
              <div key={story._id} className="bg-white rounded-xl border p-6 transition-colors">
                {/* Header row: title + actions */}
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 truncate">{story.title}</h3>
                    <div className="mt-1 flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600">
                      <span>Grade: {story.grade}</span>
                      {story.language && (
                        <span>Language: {getDisplayLanguage(story.language)} (raw: {story.language})</span>
                      )}
                      {story.set && (
                        <span>Set: {story.set}</span>
                      )}
                    </div>
                    {story.description && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">Description: {story.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => navigate(`/admin/resources?tab=create&storyId=${String(story._id || '')}`)}
                      disabled={Boolean(storyIdToTests[String(story._id)] && storyIdToTests[String(story._id)].length > 0)}
                      className={`px-3 py-1.5 rounded-md text-sm ${storyIdToTests[String(story._id)] && storyIdToTests[String(story._id)].length > 0 ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'}`}
                    >
                      {storyIdToTests[String(story._id)] && storyIdToTests[String(story._id)].length > 0 ? 'Test Exists' : 'Create Test'}
                    </button>
                    <button onClick={() => setEditingStory(story)} className="px-3 py-1.5 rounded-md border text-sm hover:bg-gray-50">Edit</button>
                    <button onClick={() => story._id && handleDeleteStory(story._id)} className="px-3 py-1.5 rounded-md bg-red-600 text-white text-sm hover:bg-red-700">Delete</button>
                  </div>
                </div>
                <div className="mt-4 border-t pt-4">
                  <p className="text-sm font-medium text-gray-800 mb-2">Tests</p>
                  {storyIdToTests[String(story._id)] && storyIdToTests[String(story._id)].length > 0 ? (
                    <div className="grid grid-cols-1 gap-4">
                      {(() => {
                        const testsForStory = storyIdToTests[String(story._id)] || [];
                        const canDelete = testsForStory.length > 1;
                        return testsForStory.map(t => (
                        <div key={t.id} className="w-full h-24 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors px-5 py-4 flex items-center justify-between">
                          <div className="min-w-0 pr-4">
                            <div className="flex items-center gap-3">
                              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-sm font-bold">T</span>
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-gray-900 truncate" title={t.testName}>{t.testName}</div>
                                <div className="mt-1">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                                    {t.questionsCount} question{t.questionsCount === 1 ? '' : 's'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => handleOpenViewTest(t.id)} className="px-3 py-1.5 rounded-md border border-blue-200 text-blue-700 text-xs font-medium hover:bg-blue-50">View</button>
                            {canDelete && (
                              <button onClick={() => handleDeleteTest(t.id)} className="px-3 py-1.5 rounded-md border border-red-200 text-red-600 text-xs font-medium hover:bg-red-50">Delete</button>
                            )}
                          </div>
                        </div>
                      )); })()}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">No tests yet.</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
      {viewTest && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-lg w-full max-w-2xl p-6">
            <div className="flex items-start justify-between">
              <h3 className="text-xl font-bold text-gray-900">{viewTest.testName}</h3>
              <button onClick={() => setViewTest(null)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <div className="mt-4">
              {viewTest.questions && viewTest.questions.length > 0 ? (
                <ul className="space-y-2 max-h-80 overflow-auto pr-2">
                  {viewTest.questions.map((q: any, idx: number) => {
                    const choices: string[] = Array.isArray(q.choices) ? q.choices : [];
                    const correctIdx: number = typeof q.correctAnswer === 'number' ? q.correctAnswer : -1;
                    const correctText = correctIdx >= 0 && correctIdx < choices.length ? choices[correctIdx] : '';
                    return (
                      <li key={idx} className="border rounded-md p-3">
                        <div className="text-sm font-semibold text-gray-800">Question {idx + 1}</div>
                        <div className="text-sm text-gray-700 mb-1">{String(q.question || '')}</div>
                        <div className="text-xs text-green-700 font-medium">Correct answer: {correctText || 'N/A'}</div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="text-sm text-gray-500">No questions to display.</div>
              )}
            </div>
            <div className="mt-5 text-right">
              <button onClick={() => setViewTest(null)} className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">Close</button>
            </div>
          </div>
        </div>
      )}

      <AddStoryModal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setAddToSet(null);
        }}
        onSave={handleAddStory}
        preselectedSet={addToSet || undefined}
      />

      {editingStory && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <h2 className="text-xl font-bold mb-4">Edit Story</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Title</label>
                <input
                  type="text"
                  value={editingStory.title}
                  onChange={(e) => setEditingStory({ ...editingStory, title: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={editingStory.description}
                  onChange={(e) => setEditingStory({ ...editingStory, description: e.target.value })}
                  rows={3}
                  className="mt-1 block w-full rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Grade</label>
                <select
                  value={editingStory.grade}
                  onChange={(e) => setEditingStory({ ...editingStory, grade: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="1">Grade 1</option>
                  <option value="2">Grade 2</option>
                  <option value="3">Grade 3</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Language</label>
                <select
                  value={editingStory.language === 'none' ? 'tagalog' : editingStory.language === 'en' ? 'english' : editingStory.language}
                  onChange={(e) => setEditingStory({ ...editingStory, language: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="english">English</option>
                  <option value="tagalog">Tagalog</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Story Set</label>
                <select
                  value={editingStory.set || 'A'}
                  onChange={(e) => setEditingStory({ ...editingStory, set: e.target.value as 'A' | 'B' | 'C' | 'D' })}
                  className="mt-1 block w-full rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="A">Set A</option>
                  <option value="B">Set B</option>
                  <option value="C">Set C</option>
                  <option value="D">Set D</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={() => setEditingStory(null)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleEditStory(editingStory)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}