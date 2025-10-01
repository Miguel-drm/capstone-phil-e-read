import React, { useState, useEffect } from 'react';
import type { Story } from '../../../types/Story';
import { UnifiedStoryService } from '../../../services/UnifiedStoryService';
import Swal from 'sweetalert2';

interface StorySelectorProps {
  onStorySelect: (story: Story) => void;
  selectedStoryId?: string;
}

const StorySelector: React.FC<StorySelectorProps> = ({ onStorySelect, selectedStoryId }) => {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    level: '',
    category: '',
    language: ''
  });

  // Helper function to convert stored language codes to display names
  const getDisplayLanguage = (language: string | undefined): string => {
    if (!language) return '';
    switch (language) {
      case 'en':
        return 'English';
      case 'none':
        return 'Tagalog';
      default:
        return language;
    }
  };

  useEffect(() => {
    loadStories();
  }, [filters]);

  const loadStories = async () => {
    try {
      setLoading(true);
      const storiesData = await UnifiedStoryService.getInstance().getStories(filters);
      setStories(storiesData);
    } catch (error) {
      console.error('Error loading stories:', error);
      Swal.fire('Error', 'Failed to load stories', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg p-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-4">Select a Story</h2>
      
      {/* Filters */}
      <div className="mb-6 flex gap-4">
        <select
          value={filters.level}
          onChange={(e) => setFilters({ ...filters, level: e.target.value })}
          className="border rounded-lg px-4 py-2"
        >
          <option value="">All Levels</option>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>

        <input
          type="text"
          placeholder="Filter by category"
          value={filters.category}
          onChange={(e) => setFilters({ ...filters, category: e.target.value })}
          className="border rounded-lg px-4 py-2"
        />

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

      {/* Stories List */}
      {loading ? (
        <div className="text-center py-4">Loading...</div>
      ) : (
        <div className="grid gap-4">
          {stories.length === 0 ? (
            <div className="text-center text-gray-500 py-10">No stories available.</div>
          ) : (
            stories.map((story) => (
              <div
                key={story._id}
                className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                  selectedStoryId === story._id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300'
                }`}
                onClick={() => onStorySelect(story)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-medium text-gray-800">{story.title}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Level: {story.readingLevel} | Category: {story.categories?.join(', ')} | Language: {getDisplayLanguage(story.language)}
                    </p>
                  </div>
                  {selectedStoryId === story._id && (
                    <span className="text-blue-600">✓ Selected</span>
                  )}
                </div>
                <p className="mt-2 text-gray-600 line-clamp-2">PDF URL: <a href={story.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{story.pdfUrl}</a></p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default StorySelector; 