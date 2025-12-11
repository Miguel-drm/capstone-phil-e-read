import React, { useState, useRef, useEffect } from 'react';
import type { Story } from '../../types/Story';

interface EditStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (storyData: Partial<Story>, file?: File) => Promise<void>;
  story: Story;
}

const EditStoryModal: React.FC<EditStoryModalProps> = ({ isOpen, onClose, onSave, story }) => {
  const [title, setTitle] = useState(story.title);
  const [description, setDescription] = useState(story.description);
  const [language, setLanguage] = useState(story.language || 'english');
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper function to convert database language codes to form values
  const getFormLanguage = (dbLanguage: string | undefined): string => {
    if (!dbLanguage || dbLanguage === 'none') return 'english';
    switch (dbLanguage) {
      case 'en':
        return 'english';
      case 'tl':
      case 'filipino':
        return 'tagalog';
      default:
        return dbLanguage;
    }
  };

  useEffect(() => {
    setTitle(story.title);
    setDescription(story.description);
    setLanguage(getFormLanguage(story.language));
  }, [story]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setIsSubmitting(true);
      await onSave({
        title,
        description,
        language,
      }, file || undefined);
      
      // Reset file input
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch {
      // Submit failed
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
    } else {
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl animate-scale-in">
        {/* Modal Header */}
        <div className="px-8 py-6 border-b border-gray-200">
          <h2 className="text-2xl font-semibold text-gray-900">Edit Story</h2>
        </div>
        
        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="p-8 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
              placeholder="Enter story title"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={4}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
              placeholder="Enter story description"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Language</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as 'english' | 'tagalog')}
              required
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
            >
              <option value="english">English</option>
              <option value="tagalog">Tagalog</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Story File</label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:border-blue-500 transition duration-200">
              <div className="space-y-2 text-center">
                <div className="mx-auto h-12 w-12 text-gray-400">
                  {file ? (
                    <svg className="h-12 w-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  )}
                </div>
                <div className="flex text-sm text-gray-600">
                  <label className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500">
                    <span>{file ? 'Change file' : 'Upload a new file'}</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf"
                      onChange={handleFileChange}
                      className="sr-only"
                    />
                  </label>
                  <p className="pl-1">{file ? file.name : 'or drag and drop'}</p>
                </div>
                <p className="text-xs text-gray-500">PDF up to 10MB (optional)</p>
              </div>
            </div>
          </div>
          </div>

          {/* Modal Footer */}
          <div className="px-8 py-6 border-t border-gray-200 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 border-2 border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-4 focus:ring-gray-200 transition-all duration-200"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 hover:scale-[1.02] hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-blue-200 transition-all duration-200 disabled:opacity-50"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditStoryModal; 