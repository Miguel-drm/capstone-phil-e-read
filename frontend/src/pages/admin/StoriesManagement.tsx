import { useState, useEffect } from 'react';
import { UnifiedStoryService } from '../../services/UnifiedStoryService';
import Swal from 'sweetalert2';
import type { Story } from '../../types/Story';
import AddStoryModal from './AddStoryModal';
import { useAuth } from '../../contexts/AuthContext';

interface StoryFilters {
  language?: string;
  searchTerm?: string;
}

export default function StoriesManagement() {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStory, setEditingStory] = useState<Story | null>(null);
  const [filters, setFilters] = useState<StoryFilters>({
    language: ''
  });
  const { currentUser } = useAuth();

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
      const storiesData = await UnifiedStoryService.getInstance().getStories(
        filters.language ? { language: filters.language } : {}
      );
      console.log('API /api/stories response:', storiesData);
      if (!Array.isArray(storiesData)) {
        console.error('API did not return an array:', storiesData);
        setStories([]);
      } else {
        setStories(storiesData);
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
      await UnifiedStoryService.getInstance().createStory(storyData, file);
      setShowAddModal(false);
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

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Stories Management</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          Add New Story
        </button>
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
      </div>

      {loading ? (
        <div className="text-center py-4">Loading...</div>
      ) : (
        <div className="grid gap-6">
          {Array.isArray(stories) && stories.length === 0 ? (
            <div className="text-center text-gray-500 py-10">No stories available.</div>
          ) : (
            (Array.isArray(stories) ? stories : []).map((story) => (
              <div key={story._id} className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-800">{story.title}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Grade: {story.grade}
                    </p>
                    {story.language && (
                      <p className="text-sm text-gray-500 mt-1">
                        Language: {getDisplayLanguage(story.language)} (raw: {story.language})
                      </p>
                    )}
                    <p className="text-sm text-gray-500 mt-1">
                      Description: {story.description}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingStory(story)}
                      className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => story._id && handleDeleteStory(story._id)}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <AddStoryModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleAddStory}
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
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={editingStory.description}
                  onChange={(e) => setEditingStory({ ...editingStory, description: e.target.value })}
                  rows={3}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Grade</label>
                <select
                  value={editingStory.grade}
                  onChange={(e) => setEditingStory({ ...editingStory, grade: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
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
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="english">English</option>
                  <option value="tagalog">Tagalog</option>
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