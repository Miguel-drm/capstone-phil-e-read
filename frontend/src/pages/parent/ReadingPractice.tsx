import React, { useState, useEffect, useCallback } from 'react';
import Swal from 'sweetalert2';
import { UnifiedStoryService } from '../../services/UnifiedStoryService';
import type { Story } from '../../types/Story';
import { useNavigate } from 'react-router-dom';
import {
  BookOpenIcon,
  PlayIcon,
} from '@heroicons/react/24/outline';
import ParentLoader from '../../components/parent/ParentLoader';
import { formatDateHuman } from '@/utils/date';

const ReadingPractice: React.FC = () => {
  const navigate = useNavigate();
  const [stories, setStories] = useState<Story[]>([]);
  const [storiesLoading, setStoriesLoading] = useState(true);
  const [storiesError, setStoriesError] = useState<string | null>(null);

  const loadStories = useCallback(async () => {
    try {
      setStoriesLoading(true);
      setStoriesError(null);
      const fetchedStories = await UnifiedStoryService.getInstance().getStories({});
      // Map IStory[] to Story[] to ensure type compatibility and add pdfUrl
      setStories(fetchedStories.map(story => ({
        ...story,
        _id: story._id?.toString(),
        createdBy: story.createdBy?.toString?.() ?? story.createdBy,
        language: story.language as 'english' | 'tagalog',
        pdfUrl: story._id ? UnifiedStoryService.getInstance().getStoryPdfUrl(story._id) : undefined
      })));
    } catch (error) {
      console.error('Error loading stories:', error);
      setStoriesError('Failed to load stories. Please try again.');
      Swal.fire('Error', 'Failed to load stories', 'error');
    } finally {
      setStoriesLoading(false);
    }
  }, []);

  // Load stories on component mount
  useEffect(() => {
    loadStories();
  }, [loadStories]);

  const handleStartPractice = async (story: Story) => {
    try {
      // Navigate to practice session with story ID
      navigate(`/parent/reading-practice/${story._id}`);
    } catch (error) {
      console.error('Error starting practice:', error);
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to start practice session. Please try again.',
      });
    }
  };

  const handleViewStoryDetails = async (story: Story) => {
    await Swal.fire({
      title: story.title,
      html: `
        <div class="text-left">
        <div class="mb-4">
          <h3 class="text-sm font-semibold text-gray-600 mb-1">Language</h3>
          <p class="text-gray-800">${story.language || 'Not specified'}</p>
        </div>
          <div class="mb-4">
            <h3 class="text-sm font-semibold text-gray-600 mb-1">Description</h3>
            <p class="text-gray-800">${story.description || 'No description available'}</p>
          </div>
          <div class="mt-6">
            ${story.pdfUrl ? `
              <div class="space-y-3">
                <a href="${story.pdfUrl}" 
                   target="_blank" 
                   class="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
                >
                  <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  View PDF
                </a>
                <p class="text-xs text-gray-500 italic">
                  PDF may not be available. The story text content is available in the practice session.
                </p>
              </div>
            ` : '<p class="text-red-500">No PDF available</p>'}
          </div>
        </div>
      `,
      showCloseButton: true,
      showConfirmButton: false,
      width: '32rem',
      customClass: {
        container: 'story-details-modal',
        popup: 'rounded-lg shadow-xl',
        htmlContainer: 'p-6'
      }
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center py-2 sm:py-6">
      <div className="w-full px-2 sm:px-4 md:px-6 lg:px-8 bg-white/90 rounded-2xl shadow-lg p-4 sm:p-8 border border-blue-100">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-blue-100 pb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-blue-900 tracking-tight flex items-center gap-2">
              <i className="fas fa-book-reader text-blue-400"></i> Reading Practice
            </h1>
            <p className="mt-1 text-sm text-gray-500">Choose a story to practice reading with your child</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 border border-gray-200">
              Updated {formatDateHuman(new Date())}
            </span>
          </div>
        </div>

        {/* Stories Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
          {storiesLoading ? (
            <ParentLoader label="Loading stories..." />
          ) : storiesError ? (
            <div className="col-span-full text-center py-10 text-red-500">{storiesError}</div>
          ) : stories.length === 0 ? (
            <div className="col-span-full text-center py-10 text-gray-500">No stories available for practice.</div>
          ) : (
            stories.map((story) => (
              <div key={story._id} className="bg-white rounded-xl shadow-md border border-blue-50 overflow-hidden flex flex-col h-full hover:shadow-lg transition-shadow">
                <div className="relative pb-[56.25%] bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                  <div className="absolute inset-0 flex items-center justify-center text-blue-300 text-2xl">
                    <BookOpenIcon className="h-12 w-12" />
                  </div>
                </div>
                <div className="p-4 flex-grow flex flex-col">
                  <div className="flex items-start gap-2 mb-2">
                    <h3 className="text-base md:text-lg font-semibold text-blue-900 break-words leading-snug flex-1 min-w-0">
                      {story.title}
                    </h3>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full flex-shrink-0 ${
                      story.language === 'tagalog' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {story.language || 'English'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mb-4 break-words flex-grow">
                    {story.description || 'No description available'}
                  </p>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between mt-auto gap-2">
                    <button
                      onClick={() => handleViewStoryDetails(story)}
                      className="inline-flex items-center justify-center text-blue-600 hover:text-white hover:bg-blue-500 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                    >
                      <span>Details</span>
                      <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleStartPractice(story)}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white rounded-md text-sm font-medium transition-all duration-200 shadow-sm hover:shadow-md"
                    >
                      <PlayIcon className="h-4 w-4" />
                      Practice
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Practice Info */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3 flex items-center gap-2">
            <i className="fas fa-info-circle text-blue-500"></i>
            About Reading Practice
          </h3>
          <div className="text-sm text-blue-800 space-y-2">
            <p>• Practice reading with your child using interactive stories</p>
            <p>• Track reading progress and identify areas for improvement</p>
            <p>• Support both English and Tagalog language stories</p>
            <p>• Practice sessions are for learning and don't affect official records</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReadingPractice;

