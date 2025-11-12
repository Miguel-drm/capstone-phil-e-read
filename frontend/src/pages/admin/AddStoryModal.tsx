import React, { useState, useEffect } from 'react';
import type { Story } from '../../types/Story';
import Swal from 'sweetalert2'; // Import Swal for validation messages

interface AddStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (storyData: Pick<Story, 'title' | 'description' | 'language'>, file: File) => Promise<void>;
  targetGradeSet?: { grade: '3' | '4' | '5' | '6', set: 'A' | 'B' | 'C' | 'D' } | null;
  defaultLanguage?: 'english' | 'tagalog';
}

const AddStoryModal: React.FC<AddStoryModalProps> = ({
  isOpen,
  onClose,
  onSave,
  targetGradeSet,
  defaultLanguage = 'english',
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [language, setLanguage] = useState<'english' | 'tagalog'>(defaultLanguage);
  const [isSaving, setIsSaving] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      // Reset form when modal closes
      setTitle('');
      setDescription('');
      setSelectedFile(null);
      setLanguage(defaultLanguage);
      setIsSaving(false);
      setIsDragOver(false);
    } else {
      // Set language when modal opens
      setLanguage(defaultLanguage);
    }
  }, [isOpen, defaultLanguage]);

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type === 'application/pdf') {
        setSelectedFile(file);
      } else {
        Swal.fire('Error', 'Please drop a valid PDF file.', 'error');
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type === 'application/pdf') {
        setSelectedFile(file);
      } else {
        Swal.fire('Error', 'Please select a valid PDF file.', 'error');
        e.target.value = '';
      }
    }
  };

  const handleSubmit = async () => {
    if (!title || !selectedFile || !language) {
      Swal.fire('Error', 'Please fill in the title, select a language, and upload a PDF file.', 'error');
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
          description: description.trim() || `A ${language} story for reading assessment.`, // Provide meaningful default
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
        <h2 className="text-xl font-semibold text-gray-800 mb-4 text-center">
          {targetGradeSet ? `Add Story to Grade ${targetGradeSet.grade} Set ${targetGradeSet.set}` : 'Add New Story'}
        </h2>
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Adding to:</strong> {targetGradeSet
              ? `Grade ${targetGradeSet.grade}, Set ${targetGradeSet.set}, ${language === 'english' ? 'English' : 'Tagalog'} language`
              : 'Available stories pool'
            }
          </p>
          {targetGradeSet && (
            <p className="text-xs text-blue-600 mt-1">
              The story will be automatically assigned to this specific set and language.
            </p>
          )}
        </div>
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
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Description <span className="text-gray-400 text-xs">(optional)</span>
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter a brief description of the story... (optional)"
              rows={3}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Story PDF</label>
            <div
              className={`relative w-full p-6 rounded-lg border-2 border-dashed transition-colors ${isDragOver
                ? 'border-blue-400 bg-blue-50'
                : selectedFile
                  ? 'border-green-400 bg-green-50'
                  : 'border-gray-300 bg-gray-50 hover:border-gray-400'
                }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                id="pdfFile"
                type="file"
                accept=".pdf"
                onChange={handleFileSelect}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="text-center">
                {selectedFile ? (
                  <div className="space-y-2">
                    <div className="text-green-600 text-2xl">📄</div>
                    <p className="text-sm font-medium text-green-800">{selectedFile.name}</p>
                    <p className="text-xs text-green-600">
                      {(selectedFile.size / 1024).toFixed(0)} KB • PDF Ready for Upload
                    </p>
                    <div className="flex items-center justify-center gap-1 text-xs text-green-600">
                      <span>✓</span>
                      <span>Valid PDF file selected</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedFile(null)}
                      className="text-xs text-red-600 hover:text-red-800 underline"
                    >
                      Remove file
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="text-gray-400 text-2xl">📁</div>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Drop your PDF here</span> or click to browse
                    </p>
                    <p className="text-xs text-gray-500">PDF files only</p>
                  </div>
                )}
              </div>
            </div>
          </div>



          <div>
            <label htmlFor="language" className="block text-sm font-medium text-gray-700 mb-1">
              Language {targetGradeSet && <span className="text-xs text-gray-500">(auto-selected based on current filter)</span>}
            </label>
            <select
              id="language"
              value={language}
              onChange={(e) => setLanguage(e.target.value as 'english' | 'tagalog')}
              disabled={!!targetGradeSet}
              className={`w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm ${targetGradeSet ? 'bg-gray-100 cursor-not-allowed' : ''}`}
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