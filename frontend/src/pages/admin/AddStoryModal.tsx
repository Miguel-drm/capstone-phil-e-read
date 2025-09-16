import React, { useState, useEffect } from 'react';
import type { Story } from '../../types/Story';
import Swal from 'sweetalert2'; // Import Swal for validation messages

interface AddStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (storyData: Pick<Story, 'title' | 'description' | 'language'>, file: File) => Promise<void>;
}

const AddStoryModal: React.FC<AddStoryModalProps> = ({
  isOpen,
  onClose,
  onSave,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [language, setLanguage] = useState<'english' | 'tagalog'>('english');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      // Reset form when modal closes
      setTitle('');
      setDescription('');
      setSelectedFile(null);
      setLanguage('english');
      setIsSaving(false);
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!title || !selectedFile || !language || !description) {
      Swal.fire('Error', 'Please fill in all fields and select a PDF file.', 'error');
      return;
    }

    if (selectedFile.type !== 'application/pdf') {
      Swal.fire('Error', 'Please upload a valid PDF file.', 'error');
      setSelectedFile(null);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(
        {
          title,
          description,
          language,
        },
        selectedFile
      );
      onClose();
    } catch (error) {
      console.error("Error saving story from modal:", error);
      Swal.fire('Error', 'Failed to add story. Please try again.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} // Directly set background color with rgba
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-6 text-center">Add New Story</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">Story Title</label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., The Ant and the Grasshopper"
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter a brief description of the story..."
              rows={3}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
            />
          </div>

          <div>
            <label htmlFor="pdfFile" className="block text-sm font-medium text-gray-700 mb-1">Story PDF</label>
            <input
              id="pdfFile"
              type="file"
              accept=".pdf"
              onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          <div>
            <label htmlFor="language" className="block text-sm font-medium text-gray-700 mb-1">Language</label>
            <select
              id="language"
              value={language}
              onChange={(e) => setLanguage(e.target.value as 'english' | 'tagalog')}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
            >
              <option value="english">English</option>
              <option value="tagalog">Tagalog</option>
            </select>
          </div>
        </div>
        <div className="mt-8 flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-5 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving}
            className="px-5 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Adding Story...' : 'Add Story'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddStoryModal; 