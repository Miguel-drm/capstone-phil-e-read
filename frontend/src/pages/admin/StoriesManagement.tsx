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
  const [targetGradeSet, setTargetGradeSet] = useState<{grade: '3' | '4' | '5' | '6', set: 'A' | 'B' | 'C' | 'D'} | null>(null);
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>('');
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
        // Debug: Log what we received from the API
        console.log('🔍 Stories from database:', storiesData.map(s => ({
          title: s.title,
          grade: s.grade,
          storySet: s.storySet,
          id: s._id
        })));
        
        // Client-side filtering for set if backend doesn't support it yet
        let filteredStories = storiesData;
        if (filters.set) {
          filteredStories = storiesData.filter(story => story.storySet === filters.set);
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
      if (!storyData.title?.trim()) {
        Swal.fire('Error', 'Please enter a story title', 'error');
        return;
      }
      if (!file || file.type !== 'application/pdf') {
        Swal.fire('Error', 'Please upload a valid PDF file', 'error');
        return;
      }
      
      // If we have a target grade-set, assign the story directly to it
      let finalStoryData = { ...storyData };
      
      if (targetGradeSet) {
        const key = `${targetGradeSet.grade}-${targetGradeSet.set}`;
        // Check if target grade-set already has a story
        if (groupedStories[key]) {
          const result = await Swal.fire({
            title: `Grade ${targetGradeSet.grade} Set ${targetGradeSet.set} already has a story`,
            text: `Replace "${groupedStories[key].title}" with "${storyData.title}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Replace',
            cancelButtonText: 'Cancel'
          });
          
          if (!result.isConfirmed) {
            return;
          }
          
          // Delete the existing story in this grade-set
          await UnifiedStoryService.getInstance().deleteStory(groupedStories[key]._id!);
        }
        
        // Assign to the target grade-set
        finalStoryData = {
          ...storyData,
          grade: targetGradeSet.grade,
          storySet: targetGradeSet.set
        };
        
        console.log('🔍 Frontend sending to backend:', {
          targetGradeSet: targetGradeSet,
          finalStoryData: finalStoryData,
          expectedGrade: targetGradeSet.grade,
          expectedSet: targetGradeSet.set
        });
      }
      
      await UnifiedStoryService.getInstance().createStory(finalStoryData, file);
      setShowAddModal(false);
      setTargetGradeSet(null);
      await loadStories();
      
      if (targetGradeSet) {
        Swal.fire('Success', `Story added to Grade ${targetGradeSet.grade} Set ${targetGradeSet.set}!`, 'success');
      } else {
        Swal.fire('Success', 'Story added successfully! You can now assign it to a set.', 'success');
      }
    } catch (error) {
      console.error('Error adding story:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to add story';
      Swal.fire('Error', errorMessage, 'error');
    }
  };

  const handleStartEditTitle = (story: Story) => {
    if (!story._id) return;
    setEditingTitleId(story._id);
    setEditingTitle(story.title);
  };

  const handleSaveTitle = async (storyId: string) => {
    try {
      if (!editingTitle.trim()) {
        Swal.fire('Error', 'Title cannot be empty', 'error');
        return;
      }

      await UnifiedStoryService.getInstance().updateStory(storyId, { title: editingTitle.trim() });
      await loadStories();
      setEditingTitleId(null);
      setEditingTitle('');
      Swal.fire('Success', 'Story title updated successfully', 'success');
    } catch (error) {
      console.error('Error updating story title:', error);
      Swal.fire('Error', 'Failed to update story title', 'error');
    }
  };

  const handleCancelEditTitle = () => {
    setEditingTitleId(null);
    setEditingTitle('');
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

  // Group stories by grade and set - each grade-set combination should have only ONE story
  const groupedStories = Array.isArray(stories) ? stories.reduce((acc, story) => {
    const grade = story.grade || '3';
    const set = story.storySet || 'A';
    const key = `${grade}-${set}`;
    
    console.log('🔍 Grouping story:', {
      title: story.title,
      grade: story.grade,
      storySet: story.storySet,
      computedKey: key
    });
    
    // If there's already a story in this slot, this one becomes unassigned
    if (acc[key]) {
      console.log(`⚠️ Conflict: ${key} already has "${acc[key].title}", "${story.title}" will be unassigned`);
    } else {
      acc[key] = story; // Only one story per grade-set combination
      console.log(`✅ Assigned "${story.title}" to ${key}`);
    }
    return acc;
  }, {} as Record<string, Story>) : {};

  // Get unassigned stories (stories without a set or grade, or stories that conflict)
  const unassignedStories = Array.isArray(stories) ? stories.filter(story => {
    // Stories without storySet or grade are unassigned
    if (!story.storySet || !story.grade) {
      return true;
    }
    
    // Check if this story's grade-set combination is already taken by another story
    const storiesInSameGradeSet = stories.filter(s => s.grade === story.grade && s.storySet === story.storySet);
    if (storiesInSameGradeSet.length > 1) {
      // If multiple stories in same grade-set, only keep the first one assigned, others are unassigned
      const isFirst = storiesInSameGradeSet[0]._id === story._id;
      return !isFirst;
    }
    return false;
  }) : [];

  // Function to assign story to grade-set combination
  const assignStoryToGradeSet = async (story: Story, targetGrade: '3' | '4' | '5' | '6', targetSet: 'A' | 'B' | 'C' | 'D') => {
    try {
      const key = `${targetGrade}-${targetSet}`;
      // Check if target grade-set already has a story
      if (groupedStories[key]) {
        const result = await Swal.fire({
          title: `Grade ${targetGrade} Set ${targetSet} already has a story`,
          text: `Replace "${groupedStories[key].title}" with "${story.title}"?`,
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#d33',
          cancelButtonColor: '#3085d6',
          confirmButtonText: 'Replace',
          cancelButtonText: 'Cancel'
        });
        
        if (!result.isConfirmed) return;
      }

      // Update the story's grade and set
      await UnifiedStoryService.getInstance().updateStory(story._id!, { ...story, grade: targetGrade, storySet: targetSet });
      await loadStories();
      Swal.fire('Success', `Story assigned to Grade ${targetGrade} Set ${targetSet}`, 'success');
    } catch (error) {
      console.error('Error assigning story to grade-set:', error);
      Swal.fire('Error', 'Failed to assign story to grade-set', 'error');
    }
  };



  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Stories Management</h1>
          {viewMode === 'sets' && (
            <p className="text-sm text-gray-600 mt-1">
              Stories organized by grade levels (3, 4, 5, 6) with sets A, B, C, D for each grade
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
{/* Add New Story button removed */}
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
        // Grade-based horizontal layout: Grade 3, 4, 5, 6 with sets A B C D for each
        <div className="space-y-8">
          {['3', '4', '5', '6'].map(grade => (
            <div key={grade} className="space-y-4">
              {/* Grade Header */}
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-800 py-4 border-t border-b border-gray-300">
                  Grade {grade}
                </h2>
              </div>
              
              {/* Sets A B C D in horizontal row */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {['A', 'B', 'C', 'D'].map(setLetter => {
                  const key = `${grade}-${setLetter}`;
                  const setStory = groupedStories[key];
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
                          <div className="bg-gray-50 rounded-lg p-3 group">
                            <div className="flex items-start justify-between">
                              <div className="min-w-0 flex-1">
                                {editingTitleId === setStory._id ? (
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm">📖</span>
                                    <input
                                      type="text"
                                      value={editingTitle}
                                      onChange={(e) => setEditingTitle(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          setStory._id && handleSaveTitle(setStory._id);
                                        } else if (e.key === 'Escape') {
                                          handleCancelEditTitle();
                                        }
                                      }}
                                      className="flex-1 text-sm font-medium border border-blue-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      autoFocus
                                    />
                                    <button
                                      onClick={() => setStory._id && handleSaveTitle(setStory._id)}
                                      className="text-green-600 hover:text-green-800 text-xs px-1"
                                      title="Save"
                                    >
                                      ✓
                                    </button>
                                    <button
                                      onClick={handleCancelEditTitle}
                                      className="text-gray-600 hover:text-gray-800 text-xs px-1"
                                      title="Cancel"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-medium text-gray-900 text-sm truncate" title={setStory.title}>
                                      📖 {setStory.title}
                                    </h4>
                                    <button
                                      onClick={() => handleStartEditTitle(setStory)}
                                      className="text-blue-600 hover:text-blue-800 text-xs px-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                      title="Edit title"
                                    >
                                      ✏️
                                    </button>
                                  </div>
                                )}
                                <p className="text-xs text-gray-600 mt-1">
                                  {getDisplayLanguage(setStory.language)}
                                </p>
                              </div>
                              <div className="flex gap-1 ml-2">
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
                              const target = { grade: grade as '3' | '4' | '5' | '6', set: setLetter as 'A' | 'B' | 'C' | 'D' };
                              console.log('🎯 BUTTON CLICKED:', {
                                gradeFromLoop: grade,
                                setFromLoop: setLetter,
                                targetGradeSet: target
                              });
                              setTargetGradeSet(target);
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
            </div>
          ))}

          {/* Unassigned Stories Section */}
          {unassignedStories.length > 0 && (
            <div className="bg-blue-50 rounded-xl border-2 border-blue-200 p-6 mt-8">
              <h3 className="text-lg font-bold text-blue-800 mb-4 flex items-center">
                📚 Available Stories ({unassignedStories.length})
                <span className="ml-2 text-sm font-normal text-blue-600">Click grade-set buttons to assign</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {unassignedStories.map(story => (
                  <div key={story._id} className="bg-white rounded-lg border p-4 hover:shadow-md transition-shadow group">
                    <div className="flex items-start justify-between mb-2">
                      <div className="min-w-0 flex-1">
                        {editingTitleId === story._id ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm">📖</span>
                            <input
                              type="text"
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  story._id && handleSaveTitle(story._id);
                                } else if (e.key === 'Escape') {
                                  handleCancelEditTitle();
                                }
                              }}
                              className="flex-1 text-sm font-medium border border-blue-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              autoFocus
                            />
                            <button
                              onClick={() => story._id && handleSaveTitle(story._id)}
                              className="text-green-600 hover:text-green-800 text-xs px-1"
                              title="Save"
                            >
                              ✓
                            </button>
                            <button
                              onClick={handleCancelEditTitle}
                              className="text-gray-600 hover:text-gray-800 text-xs px-1"
                              title="Cancel"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-gray-900 text-sm truncate" title={story.title}>
                              📖 {story.title}
                            </h4>
                            <button
                              onClick={() => handleStartEditTitle(story)}
                              className="text-blue-600 hover:text-blue-800 text-xs px-1 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Edit title"
                            >
                              ✏️
                            </button>
                          </div>
                        )}
                        <p className="text-xs text-gray-600 mt-1">
                          {getDisplayLanguage(story.language)}
                        </p>
                        {story.description && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2" title={story.description}>
                            {story.description}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    {/* Grade-Set Assignment Grid */}
                    <div className="space-y-2 mt-3">
                      {['3', '4', '5', '6'].map(gradeLevel => (
                        <div key={gradeLevel} className="space-y-1">
                          <p className="text-xs font-medium text-gray-600">Grade {gradeLevel}:</p>
                          <div className="flex gap-1">
                            {['A', 'B', 'C', 'D'].map(setLetter => {
                              const key = `${gradeLevel}-${setLetter}`;
                              const isOccupied = !!groupedStories[key];
                              return (
                                <button
                                  key={setLetter}
                                  onClick={() => assignStoryToGradeSet(story, gradeLevel as '3' | '4' | '5' | '6', setLetter as 'A' | 'B' | 'C' | 'D')}
                                  className={`flex-1 py-1 px-2 rounded text-xs font-medium transition-colors ${
                                    isOccupied
                                      ? 'bg-gray-100 text-gray-500 hover:bg-gray-200' 
                                      : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                  }`}
                                  title={isOccupied ? `Grade ${gradeLevel} Set ${setLetter} occupied` : `Assign to Grade ${gradeLevel} Set ${setLetter}`}
                                >
                                  {setLetter}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                      
                      {/* Story Actions */}
                      <div className="flex gap-1 pt-2 border-t border-gray-200">
                        <button
                          onClick={() => story._id && handleDeleteStory(story._id)}
                          className="w-full py-1.5 px-2 rounded text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        // List View - Original detailed view
        <div className="grid gap-6">
          {Array.isArray(stories) && stories.length === 0 ? (
            <div className="text-center text-gray-500 py-10">No stories available.</div>
          ) : (
            (Array.isArray(stories) ? stories : []).map((story) => (
              <div key={story._id} className="bg-white rounded-xl border p-6 transition-colors group">
                {/* Header row: title + actions */}
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    {editingTitleId === story._id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              story._id && handleSaveTitle(story._id);
                            } else if (e.key === 'Escape') {
                              handleCancelEditTitle();
                            }
                          }}
                          className="text-lg font-semibold border border-blue-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1"
                          autoFocus
                        />
                        <button
                          onClick={() => story._id && handleSaveTitle(story._id)}
                          className="text-green-600 hover:text-green-800 px-2"
                          title="Save"
                        >
                          ✓
                        </button>
                        <button
                          onClick={handleCancelEditTitle}
                          className="text-gray-600 hover:text-gray-800 px-2"
                          title="Cancel"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-gray-900 truncate">{story.title}</h3>
                        <button
                          onClick={() => handleStartEditTitle(story)}
                          className="text-blue-600 hover:text-blue-800 px-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Edit title"
                        >
                          ✏️
                        </button>
                      </div>
                    )}
                    <div className="mt-1 flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600">
                      <span>Grade: {story.grade}</span>
                      {story.language && (
                        <span>Language: {getDisplayLanguage(story.language)} (raw: {story.language})</span>
                      )}
                      {story.storySet && (
                        <span>Set: {story.storySet}</span>
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
          setTargetGradeSet(null);
        }}
        onSave={handleAddStory}
        targetGradeSet={targetGradeSet}
      />


    </div>
  );
}